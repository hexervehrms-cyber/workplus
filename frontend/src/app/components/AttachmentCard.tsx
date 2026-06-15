/**
 * AttachmentCard Component
 * Displays file attachments with file icon, name, size, and action buttons
 */

import { useState } from 'react';
import {
  File,
  FileText,
  FileImage,
  FileAudio,
  FileVideo,
  FileArchive,
  Download,
  Eye,
  Loader2,
} from 'lucide-react';
import { Button } from './ui/button';
import { toast } from '../utils/portalToast';

interface AttachmentCardProps {
  fileName: string;
  fileSize: number;
  mimeType?: string;
  messageId: string;
  onView?: (messageId: string) => Promise<void>;
  onDownload?: (messageId: string) => Promise<void>;
}

// Get file icon based on MIME type
function getFileIcon(mimeType?: string) {
  if (!mimeType) return File;
  
  if (mimeType.startsWith('text/')) return FileText;
  if (mimeType.startsWith('image/')) return FileImage;
  if (mimeType.startsWith('audio/')) return FileAudio;
  if (mimeType.startsWith('video/')) return FileVideo;
  if (
    mimeType.includes('zip') ||
    mimeType.includes('archive') ||
    mimeType.includes('compressed')
  ) {
    return FileArchive;
  }
  if (mimeType.includes('pdf')) return FileText;
  if (
    mimeType.includes('word') ||
    mimeType.includes('document') ||
    mimeType.includes('spreadsheet')
  ) {
    return FileText;
  }
  
  return File;
}

// Format file size for display
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export default function AttachmentCard({
  fileName,
  fileSize,
  mimeType,
  messageId,
  onView,
  onDownload,
}: AttachmentCardProps) {
  const [viewLoading, setViewLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);

  const FileIcon = getFileIcon(mimeType);
  const fileSizeFormatted = formatFileSize(fileSize);

  const handleView = async () => {
    if (!onView) return;
    try {
      setViewLoading(true);
      await onView(messageId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to view file';
      toast.error(message);
    } finally {
      setViewLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!onDownload) return;
    try {
      setDownloadLoading(true);
      await onDownload(messageId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to download file';
      toast.error(message);
    } finally {
      setDownloadLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3 bg-muted/50 rounded-lg p-3 border border-border">
      {/* File Icon */}
      <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded flex items-center justify-center">
        <FileIcon className="w-5 h-5 text-primary" />
      </div>

      {/* File Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate text-foreground" title={fileName}>
          {fileName}
        </p>
        <p className="text-xs text-muted-foreground">
          {fileSizeFormatted}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 flex-shrink-0">
        {onView && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleView}
            disabled={viewLoading || downloadLoading}
            title="View file"
            aria-label={`View ${fileName}`}
          >
            {viewLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </Button>
        )}
        {onDownload && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={downloadLoading || viewLoading}
            title="Download file"
            aria-label={`Download ${fileName}`}
          >
            {downloadLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
