import { buildApiUrl } from './apiHelper';
import { ensureAccessToken } from './sessionAuth';

export function receiptFilenameFromPath(receiptPath: string): string | null {
  if (!receiptPath || typeof receiptPath !== 'string') return null;
  const trimmed = receiptPath.trim();
  if (!trimmed || trimmed === 'undefined') return null;
  const base = trimmed.split('/').pop();
  return base && !base.includes('..') ? base : null;
}

export async function fetchExpenseReceiptBlob(
  receiptPath: string,
  options?: { download?: boolean }
): Promise<Blob> {
  const filename = receiptFilenameFromPath(receiptPath);
  if (!filename) {
    throw new Error('Receipt file path is invalid');
  }

  const token = await ensureAccessToken();
  const qs = options?.download ? '' : '?inline=1';
  const url = buildApiUrl(`/expenses/receipt/${encodeURIComponent(filename)}${qs}`);

  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ||
        `Could not load receipt (${response.status})`
    );
  }

  return response.blob();
}

export async function openExpenseReceiptInDialog(receiptPath: string): Promise<string> {
  const blob = await fetchExpenseReceiptBlob(receiptPath, { download: false });
  const label = receiptFilenameFromPath(receiptPath)?.toLowerCase() || '';
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
  return URL.createObjectURL(typed);
}

export async function downloadExpenseReceipt(
  receiptPath: string,
  fallbackName?: string
): Promise<void> {
  const blob = await fetchExpenseReceiptBlob(receiptPath, { download: true });
  const filename = receiptFilenameFromPath(receiptPath) || fallbackName || 'receipt';
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
}
