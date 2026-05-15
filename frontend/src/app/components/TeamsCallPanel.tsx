import { Phone, Video, X, ExternalLink } from 'lucide-react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';

interface TeamsCallPanelProps {
  open: boolean;
  onClose: () => void;
  joinWebUrl: string | null;
  subject: string;
  withVideo: boolean;
  peerName: string;
}

export function TeamsCallPanel({
  open,
  onClose,
  joinWebUrl,
  subject,
  withVideo,
  peerName,
}: TeamsCallPanelProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[min(96vw,1100px)] w-full h-[min(88vh,820px)] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {withVideo ? (
                <Video className="w-5 h-5 text-primary shrink-0" />
              ) : (
                <Phone className="w-5 h-5 text-primary shrink-0" />
              )}
              <div className="min-w-0">
                <DialogTitle className="text-base truncate">{subject}</DialogTitle>
                <DialogDescription className="text-xs">
                  Microsoft Teams with {peerName} — allow camera and microphone when prompted
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {joinWebUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(joinWebUrl, '_blank', 'noopener,noreferrer')}
                >
                  <ExternalLink className="w-4 h-4 mr-1" />
                  Open in Teams
                </Button>
              )}
              <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="End call view">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        {joinWebUrl ? (
          <iframe
            title={`Teams meeting with ${peerName}`}
            src={joinWebUrl}
            className="flex-1 w-full min-h-0 border-0 bg-muted"
            allow="camera; microphone; fullscreen; display-capture; autoplay"
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground p-6 text-center">
            Could not load the Teams meeting. Check that Teams integration is configured on the server.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
