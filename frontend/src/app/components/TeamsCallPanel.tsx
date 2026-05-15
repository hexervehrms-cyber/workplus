import { useEffect, useRef } from 'react';
import { ExternalLink, Phone, Video, X } from 'lucide-react';
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
  const openedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open || !joinWebUrl || openedRef.current === joinWebUrl) return;
    openedRef.current = joinWebUrl;
    window.open(joinWebUrl, '_blank', 'noopener,noreferrer');
  }, [open, joinWebUrl]);

  useEffect(() => {
    if (!open) openedRef.current = null;
  }, [open]);

  const openMeeting = () => {
    if (joinWebUrl) {
      window.open(joinWebUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <CallDialogHeader onClose={onClose} subject={subject} withVideo={withVideo} peerName={peerName} />
        </DialogHeader>

        {joinWebUrl ? (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Teams opens in a new browser tab (embedded meetings are blocked by Microsoft).
              Allow camera and microphone when prompted.
            </p>
            <Button type="button" className="w-full" onClick={openMeeting}>
              <ExternalLink className="w-4 h-4 mr-2" />
              Join Teams {withVideo ? 'video' : 'voice'} call
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Could not load the Teams meeting. Check that Teams integration is configured on the
            server, or use in-app calling instead.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CallDialogHeader({
  onClose,
  subject,
  withVideo,
  peerName,
}: {
  onClose: () => void;
  subject: string;
  withVideo: boolean;
  peerName: string;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        {withVideo ? (
          <Video className="w-5 h-5 text-primary shrink-0" />
        ) : (
          <Phone className="w-5 h-5 text-primary shrink-0" />
        )}
        <div className="min-w-0">
          <DialogTitle className="text-base truncate">{subject}</DialogTitle>
          <DialogDescription className="text-xs">
            Microsoft Teams meeting with {peerName}
          </DialogDescription>
        </div>
      </div>
      <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close">
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}
