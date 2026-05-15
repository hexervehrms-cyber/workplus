import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff, X } from 'lucide-react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import type { SocketService } from '../utils/socket';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export type NativeCallRole = 'caller' | 'callee';

export interface IncomingCallOffer {
  callerId: string;
  callerName: string;
  sdp: RTCSessionDescriptionInit;
  withVideo: boolean;
}

interface NativeCallPanelProps {
  open: boolean;
  onClose: () => void;
  role: NativeCallRole;
  peerId: string;
  peerName: string;
  withVideo: boolean;
  localUserName: string;
  socket: SocketService | null;
  incomingOffer?: IncomingCallOffer | null;
}

export function NativeCallPanel({
  open,
  onClose,
  role,
  peerId,
  peerName,
  withVideo,
  localUserName,
  socket,
  incomingOffer,
}: NativeCallPanelProps) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const startedRef = useRef(false);

  const [phase, setPhase] = useState<'ringing' | 'connecting' | 'active' | 'ended'>('ringing');
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(!withVideo);
  const [error, setError] = useState<string | null>(null);

  const cleanup = useCallback(() => {
    startedRef.current = false;
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  }, []);

  const endCall = useCallback(
    (notifyPeer = true) => {
      if (notifyPeer && socket && peerId) {
        socket.emit('call:end', { recipientId: peerId });
      }
      cleanup();
      setPhase('ended');
      onClose();
    },
    [cleanup, onClose, peerId, socket]
  );

  const getMedia = useCallback(async (video: boolean) => {
    return navigator.mediaDevices.getUserMedia({
      audio: true,
      video: video ? { facingMode: 'user' } : false,
    });
  }, []);

  const createPeer = useCallback(
    (stream: MediaStream) => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        const remote = event.streams[0];
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remote;
        }
        setPhase('active');
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && socket && peerId) {
          socket.emit('call:ice-candidate', {
            recipientId: peerId,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
          setError('Call connection lost');
        }
      };

      pcRef.current = pc;
      return pc;
    },
    [peerId, socket]
  );

  const startOutgoing = useCallback(async () => {
    if (!socket || !peerId || startedRef.current) return;
    startedRef.current = true;
    setPhase('connecting');

    try {
      const stream = await getMedia(withVideo);
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = createPeer(stream);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('call:offer', {
        recipientId: peerId,
        sdp: offer,
        withVideo,
        callerName: localUserName,
      });
    } catch (err) {
      console.error('Outgoing call error:', err);
      setError(
        err instanceof Error ? err.message : 'Could not access camera or microphone'
      );
    }
  }, [createPeer, getMedia, localUserName, peerId, socket, withVideo]);

  const acceptIncoming = useCallback(async () => {
    if (!socket || !peerId || !incomingOffer || startedRef.current) return;
    startedRef.current = true;
    setPhase('connecting');

    try {
      const stream = await getMedia(incomingOffer.withVideo);
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = createPeer(stream);
      await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('call:answer', {
        recipientId: peerId,
        sdp: answer,
      });
    } catch (err) {
      console.error('Accept call error:', err);
      setError(
        err instanceof Error ? err.message : 'Could not access camera or microphone'
      );
      endCall(false);
    }
  }, [createPeer, endCall, getMedia, incomingOffer, peerId, socket]);

  const declineIncoming = useCallback(() => {
    socket?.emit('call:decline', { recipientId: peerId });
    cleanup();
    onClose();
  }, [cleanup, onClose, peerId, socket]);

  useEffect(() => {
    if (!open || !socket) return;

    const onAnswered = async (data: { answererId: string; sdp: RTCSessionDescriptionInit }) => {
      if (data.answererId !== peerId || role !== 'caller') return;
      const pc = pcRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        setPhase('active');
      } catch (err) {
        console.error('Set remote answer error:', err);
        setError('Failed to connect call');
      }
    };

    const onIce = async (data: { fromUserId: string; candidate: RTCIceCandidateInit }) => {
      if (data.fromUserId !== peerId) return;
      const pc = pcRef.current;
      if (!pc || !data.candidate) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch {
        /* ignore late candidates */
      }
    };

    const onEnded = (data: { fromUserId: string }) => {
      if (data.fromUserId !== peerId) return;
      cleanup();
      onClose();
    };

    const onDeclined = (data: { fromUserId: string }) => {
      if (data.fromUserId !== peerId) return;
      setError('Call declined');
      cleanup();
      onClose();
    };

    socket.on('call:answered', onAnswered);
    socket.on('call:ice-candidate', onIce);
    socket.on('call:ended', onEnded);
    socket.on('call:declined', onDeclined);

    return () => {
      socket.off('call:answered', onAnswered);
      socket.off('call:ice-candidate', onIce);
      socket.off('call:ended', onEnded);
      socket.off('call:declined', onDeclined);
    };
  }, [cleanup, onClose, open, peerId, role, socket]);

  useEffect(() => {
    if (!open) {
      cleanup();
      setPhase('ringing');
      setError(null);
      setMuted(false);
      setVideoOff(!withVideo);
      return;
    }

    if (role === 'caller') {
      startOutgoing();
    }
  }, [cleanup, open, role, startOutgoing, withVideo]);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const toggleMute = () => {
    const audio = localStreamRef.current?.getAudioTracks()[0];
    if (audio) {
      audio.enabled = !audio.enabled;
      setMuted(!audio.enabled);
    }
  };

  const toggleVideo = () => {
    const video = localStreamRef.current?.getVideoTracks()[0];
    if (video) {
      video.enabled = !video.enabled;
      setVideoOff(!video.enabled);
    }
  };

  const statusLabel =
    role === 'callee' && phase === 'ringing'
      ? `Incoming ${withVideo ? 'video' : 'voice'} call`
      : phase === 'connecting'
        ? 'Connecting…'
        : phase === 'active'
          ? 'Connected'
          : 'Calling…';

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) endCall();
      }}
    >
      <DialogContent className="max-w-[min(96vw,900px)] w-full p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b shrink-0">
          <CallHeaderRow
            peerName={peerName}
            statusLabel={statusLabel}
            withVideo={withVideo}
            onClose={() => endCall()}
          />
        </DialogHeader>

        <div className="relative aspect-video bg-zinc-900">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
          {phase !== 'active' && (
            <CallWaitingOverlay peerName={peerName} withVideo={withVideo} />
          )}
          {withVideo && (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`absolute bottom-3 right-3 w-28 h-20 rounded-lg border-2 border-background object-cover shadow-lg z-10 ${
                videoOff ? 'hidden' : ''
              }`}
            />
          )}
        </div>

        {error && (
          <p className="px-4 py-2 text-sm text-destructive text-center border-t">{error}</p>
        )}

        <div className="flex items-center justify-center gap-3 px-4 py-4 border-t bg-muted/30">
          {role === 'callee' && phase === 'ringing' ? (
            <>
              <Button variant="outline" onClick={declineIncoming}>
                Decline
              </Button>
              <Button onClick={acceptIncoming}>Accept</Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant={muted ? 'destructive' : 'outline'}
                size="icon"
                onClick={toggleMute}
                aria-label={muted ? 'Unmute' : 'Mute'}
              >
                {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
              {withVideo && (
                <Button
                  type="button"
                  variant={videoOff ? 'destructive' : 'outline'}
                  size="icon"
                  onClick={toggleVideo}
                  aria-label={videoOff ? 'Turn camera on' : 'Turn camera off'}
                >
                  {videoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                </Button>
              )}
              <Button
                type="button"
                variant="destructive"
                size="icon"
                onClick={() => endCall()}
                aria-label="End call"
              >
                <PhoneOff className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CallHeaderRow({
  peerName,
  statusLabel,
  withVideo,
  onClose,
}: {
  peerName: string;
  statusLabel: string;
  withVideo: boolean;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <CallHeaderText peerName={peerName} statusLabel={statusLabel} withVideo={withVideo} />
      <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close">
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}

function CallHeaderText({
  peerName,
  statusLabel,
  withVideo,
}: {
  peerName: string;
  statusLabel: string;
  withVideo: boolean;
}) {
  return (
    <div className="min-w-0">
      <DialogTitle className="text-base truncate">{peerName}</DialogTitle>
      <DialogDescription className="text-xs flex items-center gap-1">
        {withVideo ? <Video className="w-3 h-3 shrink-0" /> : <Phone className="w-3 h-3 shrink-0" />}
        {statusLabel} — in-app call
      </DialogDescription>
    </div>
  );
}

function CallVideoArea({
  withVideo,
  videoOff,
  remoteVideoRef,
  localVideoRef,
  peerName,
  phase,
}: {
  withVideo: boolean;
  videoOff: boolean;
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  peerName: string;
  phase: string;
}) {
  return (
    <div className="relative aspect-video bg-zinc-900">
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />
      {phase !== 'active' && <CallWaitingOverlay peerName={peerName} withVideo={withVideo} />}
      {withVideo && (
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className={`absolute bottom-3 right-3 w-28 h-20 rounded-lg border-2 border-background object-cover shadow-lg z-10 ${
            videoOff ? 'hidden' : ''
          }`}
        />
      )}
    </div>
  );
}

function CallWaitingOverlay({
  peerName,
  withVideo,
}: {
  peerName: string;
  withVideo: boolean;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-white/90 z-[1]">
      <CallAvatar peerName={peerName} />
      <p className="text-sm mt-3 opacity-80">
        {withVideo ? 'Waiting for video…' : 'Voice call'}
      </p>
    </div>
  );
}

function CallAvatar({ peerName }: { peerName: string }) {
  return (
    <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-2xl font-semibold text-primary-foreground">
      {peerName.charAt(0).toUpperCase()}
    </div>
  );
}
