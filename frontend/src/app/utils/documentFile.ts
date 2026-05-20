import { buildApiUrl } from './apiHelper';
import { ensureAccessToken } from './sessionAuth';

function parseFilenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const utf8 = header.match(/filename\*=UTF-8''([^;\s]+)/i);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1]);
    } catch {
      return utf8[1];
    }
  }
  const plain = header.match(/filename="?([^";\n]+)"?/i);
  return plain?.[1] ? plain[1].trim() : null;
}

/** Fetch document bytes via authenticated API (works when public /uploads is unavailable). */
export async function fetchDocumentBlob(
  documentId: string,
  options?: { download?: boolean }
): Promise<{ blob: Blob; fileName: string }> {
  const token = await ensureAccessToken();
  const qs = options?.download ? '?download=1' : '';
  const url = buildApiUrl(`/documents/download/${documentId}${qs}`);

  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ||
        `Could not load document (${response.status})`
    );
  }

  const blob = await response.blob();
  const fileName =
    parseFilenameFromDisposition(response.headers.get('Content-Disposition')) ||
    'document';

  return { blob, fileName };
}

export async function openDocumentInNewTab(
  documentId: string,
  hint?: { fileName?: string; name?: string }
): Promise<void> {
  const { blob, fileName } = await fetchDocumentBlob(documentId);
  const label = (hint?.fileName || hint?.name || fileName).toLowerCase();
  const mime =
    blob.type ||
    (label.endsWith('.pdf')
      ? 'application/pdf'
      : label.endsWith('.png')
        ? 'image/png'
        : label.endsWith('.jpg') || label.endsWith('.jpeg')
          ? 'image/jpeg'
          : 'application/octet-stream');

  const typed = blob.type ? blob : new Blob([blob], { type: mime });
  const blobUrl = URL.createObjectURL(typed);
  window.open(blobUrl, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(blobUrl), 120_000);
}

/** Open or download a company-wide generated document (admin upload / digital doc). */
export async function fetchCompanyGeneratedDocumentBlob(
  documentId: string,
  options?: { download?: boolean }
): Promise<{ blob: Blob; fileName: string }> {
  const token = await ensureAccessToken();
  const qs = options?.download ? '?download=1' : '';
  const url = buildApiUrl(`/documents/generated/${encodeURIComponent(documentId)}/file${qs}`);

  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ||
        `Could not open document (${response.status})`
    );
  }

  const blob = await response.blob();
  const fileName =
    parseFilenameFromDisposition(response.headers.get('Content-Disposition')) ||
    'document';

  return { blob, fileName };
}

export async function openCompanyGeneratedDocument(
  documentId: string,
  hint?: { fileName?: string; title?: string }
): Promise<void> {
  const { blob, fileName } = await fetchCompanyGeneratedDocumentBlob(documentId);
  const label = (hint?.fileName || hint?.title || fileName).toLowerCase();
  const mime =
    blob.type ||
    (label.endsWith('.pdf')
      ? 'application/pdf'
      : label.endsWith('.png')
        ? 'image/png'
        : label.endsWith('.jpg') || label.endsWith('.jpeg')
          ? 'image/jpeg'
          : 'application/octet-stream');

  const typed = blob.type ? blob : new Blob([blob], { type: mime });
  const blobUrl = URL.createObjectURL(typed);
  window.open(blobUrl, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(blobUrl), 120_000);
}

export async function downloadCompanyGeneratedDocument(
  documentId: string,
  fallbackName?: string
): Promise<void> {
  const { blob, fileName } = await fetchCompanyGeneratedDocumentBlob(documentId, {
    download: true,
  });
  const base = fallbackName || fileName || 'document';
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = base;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
}

export async function downloadDocumentFile(
  documentId: string,
  fallbackName?: string
): Promise<void> {
  const { blob, fileName } = await fetchDocumentBlob(documentId, { download: true });
  const base = fallbackName || fileName || 'document';
  const hasExt = /\.[a-z0-9]{2,5}$/i.test(base);
  const downloadName = hasExt ? base : fileName.includes('.') ? fileName : base;

  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = downloadName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
}
