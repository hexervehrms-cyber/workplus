import React, { useEffect, useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import {
  Download,
  CheckCircle2,
  X,
  Clock,
  BookOpen,
  FileCheck,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import {
  fetchCompanyGeneratedDocumentBlob,
  downloadCompanyGeneratedDocument,
} from '../utils/documentFile';
import { toast } from '../utils/portalToast';

interface CompanyDocument {
  id: string;
  title: string;
  description: string;
  category: string;
  content?: string;
  organizationId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  status: 'Published' | 'Draft' | 'Archived';
  documentUrl: string;
  fileName: string;
  fileSize: string;
  downloadCount: number;
  isPublic: boolean;
}

interface DocumentReaderProps {
  document: CompanyDocument | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (documentId: string, accepted: boolean, ipAddress: string) => void;
  employeeId: string;
  isAlreadyAcknowledged?: boolean;
}

const DocumentReader: React.FC<DocumentReaderProps> = ({
  document,
  isOpen,
  onClose,
  onSubmit,
  isAlreadyAcknowledged = false,
}) => {
  const [hasRead, setHasRead] = useState(false);
  const [acceptsTerms, setAcceptsTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acknowledgmentGenerated, setAcknowledgmentGenerated] = useState(isAlreadyAcknowledged);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);

  useEffect(() => {
    if (!isOpen || !document) return;

    setHasRead(false);
    setAcceptsTerms(false);
    setAcknowledgmentGenerated(isAlreadyAcknowledged);
    setPreviewError(null);

    let revoked: string | null = null;

    const loadPreview = async () => {
      const hasFile =
        Boolean(document.documentUrl) ||
        /\.(pdf|png|jpe?g|gif|txt)$/i.test(document.fileName || '');

      if (!hasFile || !document.id) {
        setPreviewUrl(null);
        setIsPdf(false);
        return;
      }

      setPreviewLoading(true);
      try {
        const { blob, fileName } = await fetchCompanyGeneratedDocumentBlob(document.id);
        const label = (fileName || document.fileName || '').toLowerCase();
        const pdf = label.endsWith('.pdf') || blob.type === 'application/pdf';
        setIsPdf(pdf);
        const mime =
          blob.type ||
          (pdf
            ? 'application/pdf'
            : label.endsWith('.png')
              ? 'image/png'
              : label.endsWith('.jpg') || label.endsWith('.jpeg')
                ? 'image/jpeg'
                : 'text/plain');
        const typed = blob.type ? blob : new Blob([blob], { type: mime });
        revoked = URL.createObjectURL(typed);
        setPreviewUrl(revoked);
      } catch (e) {
        console.error('Document preview failed:', e);
        setPreviewError(
          e instanceof Error ? e.message : 'Could not load document preview'
        );
        setPreviewUrl(null);
      } finally {
        setPreviewLoading(false);
      }
    };

    void loadPreview();

    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
      setPreviewUrl(null);
    };
  }, [isOpen, document, isAlreadyAcknowledged]);

  if (!isOpen || !document) return null;

  const getUserIP = async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip as string;
    } catch {
      return '127.0.0.1';
    }
  };

  const handleSubmit = async () => {
    if (!hasRead || !acceptsTerms) return;
    setIsSubmitting(true);
    try {
      const userIP = await getUserIP();
      await onSubmit(document.id, true, userIP);
      setAcknowledgmentGenerated(true);
    } catch (error) {
      console.error('Error submitting acknowledgment:', error);
      toast.error('Failed to submit acknowledgment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setHasRead(false);
    setAcceptsTerms(false);
    setAcknowledgmentGenerated(false);
    onClose();
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  const textBody =
    document.content?.trim() ||
    document.description?.trim() ||
    'No text content for this document. Use Download to save the file.';

  const handleDownloadFile = async () => {
    try {
      await downloadCompanyGeneratedDocument(document.id, document.fileName || document.title);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Download failed');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{document.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {document.category} · Last updated {formatDate(document.updatedAt)}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleClose}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-muted/30 min-h-[280px]">
              {previewLoading && (
                <div className="flex items-center justify-center py-16 text-muted-foreground">
                    <Clock className="w-5 h-5 mr-2 animate-spin" />
                    Loading document…
                  </div>
              )}

              {!previewLoading && previewError && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 mb-4">
                  <div className="flex items-start gap-2 text-destructive">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Could not open file</p>
                      <p className="text-sm opacity-90">{previewError}</p>
                    </div>
                  </div>
                </div>
              )}

              {!previewLoading && previewUrl && isPdf && (
                <iframe
                  title={document.title}
                  src={previewUrl}
                  className="w-full h-[min(55vh,520px)] rounded-xl border border-border bg-white"
                />
              )}

              {!previewLoading && previewUrl && !isPdf && (
                <div className="flex flex-col items-center gap-3 py-6">
                  <img
                    src={previewUrl}
                    alt={document.title}
                    className="max-h-[min(55vh,520px)] rounded-xl border border-border object-contain"
                  />
                </div>
              )}

              {!previewLoading && !previewUrl && (
                <div className="prose prose-sm max-w-none bg-background rounded-xl border border-border p-6">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">{textBody}</div>
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <Button variant="outline" size="sm" className="rounded-xl" onClick={handleDownloadFile}>
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                {previewUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open in new tab
                  </Button>
                )}
              </div>
            </div>

            {acknowledgmentGenerated || isAlreadyAcknowledged ? (
              <div className="p-6 border-t border-border bg-green-50 shrink-0">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                  <div>
                      <h3 className="font-semibold text-green-800">
                        {isAlreadyAcknowledged ? 'Already acknowledged' : 'Acknowledgment submitted'}
                      </h3>
                      <p className="text-sm text-green-700">
                        Your acknowledgment is on record for this document.
                      </p>
                    </div>
                </div>
                <Button variant="outline" onClick={handleClose} className="rounded-xl mt-4">
                  Close
                </Button>
              </div>
            ) : (
              <div className="p-6 border-t border-border bg-background shrink-0">
                <h3 className="font-semibold text-lg mb-2">Document acknowledgment</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Confirm that you have read and understood this document.
                </p>
                <div className="space-y-3 mb-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasRead}
                      onChange={(e) => setHasRead(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm">I have read this document</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={acceptsTerms}
                      onChange={(e) => setAcceptsTerms(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm">I accept the terms</span>
                  </label>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={handleClose} className="rounded-xl">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={!hasRead || !acceptsTerms || isSubmitting}
                    className="rounded-xl"
                  >
                    {isSubmitting ? (
                      <>
                        <Clock className="w-4 h-4 mr-2 animate-spin" />
                        Submitting…
                      </>
                    ) : (
                      <>
                        <FileCheck className="w-4 h-4 mr-2" />
                        Submit acknowledgment
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
  );
};

export default DocumentReader;
