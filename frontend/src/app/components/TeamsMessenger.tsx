/**
 * Microsoft Teams Integrated Messenger Component
 * Enables chat between admin and users with Teams synchronization
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Send,
  Search,
  MoreVertical,
  Paperclip,
  Smile,
  Phone,
  Video,
  MessageSquare,
  Loader2,
  Check,
  CheckCheck,
  User,
  Trash2,
  UserPlus,
  UserMinus,
  Camera,
  UsersRound,
} from 'lucide-react';
import { Checkbox } from './ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { TeamsCallPanel } from './TeamsCallPanel';
import {
  NativeCallPanel,
  type IncomingCallOffer,
  type NativeCallRole,
} from './NativeCallPanel';
import { ApiError } from '../utils/api';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';
import { apiClient } from '../utils/api';
import { buildFileUrl } from '../utils/apiHelper';
import { socketService as appSocket } from '../utils/socket';
import { toast } from '../utils/portalToast';
import { useAuth } from '../context/AuthContext';

interface ChatUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  isOnline: boolean;
  unreadCount: number;
  lastMessage?: string;
  lastMessageTime?: string;
  /** When set, this row is a group thread (id === conversationId). */
  chatKind?: 'direct' | 'group';
  conversationId?: string;
  memberIds?: string[];
}

interface Message {
  messageId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  recipientId?: string;
  content: string;
  timestamp: Date | string;
  isOwn: boolean;
  status: 'sent' | 'delivered' | 'read';
  messageType?: string;
  teamsIntegration?: {
    enabled: boolean;
    chatId?: string;
    messageId?: string;
  };
}

interface Conversation {
  _id: string;
  lastMessage: {
    content: { text: string };
    createdAt: string;
    sender: { name: string };
  };
  unreadCount: number;
  messageCount: number;
}

function resolveAuthUserId(user: { id?: string; userId?: string } | null | undefined): string {
  if (!user) return '';
  return String(user.userId || user.id || '');
}

function getActiveConversationId(selected: ChatUser | null, myId: string): string {
  if (!selected) return '';
  if (selected.chatKind === 'group' && selected.conversationId) {
    return selected.conversationId;
  }
  return [myId, selected.id].sort().join('_');
}

export default function TeamsMessenger() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const myAuthId = resolveAuthUserId(user);
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [_conversations, setConversations] = useState<Conversation[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const [teamsChatIds, setTeamsChatIds] = useState<Record<string, string>>({});
  const [callOpen, setCallOpen] = useState(false);
  const [callJoinUrl, setCallJoinUrl] = useState<string | null>(null);
  const [callSubject, setCallSubject] = useState('');
  const [callWithVideo, setCallWithVideo] = useState(true);
  const [callLoading, setCallLoading] = useState(false);
  const [nativeCallOpen, setNativeCallOpen] = useState(false);
  const [nativeCallRole, setNativeCallRole] = useState<NativeCallRole>('caller');
  const [nativeCallPeer, setNativeCallPeer] = useState<{ id: string; name: string } | null>(null);
  const [nativeIncomingOffer, setNativeIncomingOffer] = useState<IncomingCallOffer | null>(null);
  const nativeCallBusyRef = useRef(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const selectedUserRef = useRef<ChatUser | null>(null);
  const socketListenersRef = useRef<Array<{ event: string; handler: (...args: unknown[]) => void }>>([]);
  selectedUserRef.current = selectedUser;

  const CHAT_EMOJIS = ['😀', '😊', '👍', '🙏', '❤️', '🎉', '✅', '🔥', '💼', '📎', '🙂', '😅'];
  const [hiddenContactIds, setHiddenContactIds] = useState<Set<string>>(() => new Set());
  const [showAddContactDialog, setShowAddContactDialog] = useState(false);
  const [addContactSearch, setAddContactSearch] = useState('');
  const [groupChats, setGroupChats] = useState<ChatUser[]>([]);
  const [showCreateGroupDialog, setShowCreateGroupDialog] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [createGroupMemberIds, setCreateGroupMemberIds] = useState<Set<string>>(() => new Set());
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const profileAvatarInputRef = useRef<HTMLInputElement>(null);

  const hiddenStorageKey = myAuthId ? `workplus-chat-hidden-${myAuthId}` : null;

  const resolveAvatarUrl = (avatar?: string) => {
    if (!avatar) return undefined;
    if (avatar.startsWith('http')) return avatar;
    const path = avatar.startsWith('/') ? avatar : `/${avatar}`;
    return buildFileUrl(path);
  };

  const roleBadgeClass = (role: string, selected: boolean) => {
    if (selected) {
      return 'bg-background/90 text-foreground border-border';
    }
    if (role === 'admin') return 'bg-red-50 text-red-700 border-red-200';
    if (role === 'super_admin') return 'bg-purple-50 text-purple-700 border-purple-200';
    return 'bg-blue-50 text-blue-700 border-blue-200';
  };

  const formatRoleLabel = (role: string) =>
    role === 'super_admin' ? 'Super Admin' : role.charAt(0).toUpperCase() + role.slice(1);

  const mapApiUser = (u: any): ChatUser => ({
    id: String(u._id || u.id),
    name: u.name || 'User',
    email: (u.email && String(u.email).trim()) || 'Email not on file',
    role: u.role || 'employee',
    avatar: resolveAvatarUrl(u.avatar),
    isOnline: true,
    unreadCount: 0,
    lastMessage: '',
    lastMessageTime: '',
  });

  useEffect(() => {
    if (!hiddenStorageKey) return;
    try {
      const raw = localStorage.getItem(hiddenStorageKey);
      if (raw) {
        const ids: string[] = JSON.parse(raw);
        setHiddenContactIds(new Set(ids.map(String)));
      }
    } catch {
      setHiddenContactIds(new Set());
    }
  }, [hiddenStorageKey]);

  const persistHiddenContacts = (ids: Set<string>) => {
    setHiddenContactIds(ids);
    if (hiddenStorageKey) {
      localStorage.setItem(hiddenStorageKey, JSON.stringify([...ids]));
    }
  };

  const appendEmoji = (emoji: string) => {
    setMessageInput((prev) => `${prev}${emoji}`);
    setEmojiOpen(false);
  };

  const fetchSidebarRef = useRef<() => Promise<void>>(async () => {});

  const fetchSidebar = useCallback(async () => {
    if (!myAuthId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const myId = myAuthId;
      const [usersRes, convRes, groupsRes] = await Promise.all([
        apiClient.get<any[]>('/chat/users'),
        apiClient.get<any[]>('/chat/conversations').catch(() => ({ success: false, data: [] })),
        apiClient.get<any[]>('/chat/groups').catch(() => ({ success: false, data: [] })),
      ]);

      const rawUsers = Array.isArray(usersRes.data) ? usersRes.data : [];
      const hideSuperAdmin = user.role !== 'super_admin';
      const formattedUsers: ChatUser[] = rawUsers
        .filter((u: any) => String(u._id || u.id) !== myId)
        .filter((u: any) => !hideSuperAdmin || u.role !== 'super_admin')
        .map(mapApiUser);

      const convList = Array.isArray(convRes.data) ? convRes.data : [];
      const previewByPeer = new Map<string, { text: string; time: string }>();
      const previewByGroupId = new Map<string, { text: string; time: string }>();

      for (const conv of convList) {
        const last = conv.lastMessage;
        if (!last) continue;
        const convKey = String(conv._id || last.conversationId || '');
        if (convKey.startsWith('grp_')) {
          previewByGroupId.set(convKey, {
            text: last.content?.text || '',
            time: last.createdAt
              ? new Date(last.createdAt).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '',
          });
          continue;
        }
        const parts = convKey.split('_').filter(Boolean);
        const peerId = parts.find((p: string) => p !== myId);
        if (!peerId) continue;
        previewByPeer.set(peerId, {
          text: last.content?.text || '',
          time: last.createdAt
            ? new Date(last.createdAt).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })
            : '',
        });
      }

      const rawGroups = Array.isArray(groupsRes.data) ? groupsRes.data : [];
      const groupRows: ChatUser[] = rawGroups.map((g: any) => {
        const cid = String(g.conversationId || '');
        const preview = previewByGroupId.get(cid);
        return {
          id: cid,
          name: g.name || 'Group',
          email: `${(g.members || []).length} members`,
          role: 'employee',
          avatar: undefined,
          isOnline: true,
          unreadCount: 0,
          chatKind: 'group' as const,
          conversationId: cid,
          memberIds: (g.members || []).map(String),
          lastMessage: preview?.text || '',
          lastMessageTime: preview?.time || '',
        };
      });

      setGroupChats(groupRows);
      setUsers(
        formattedUsers.map((u) => {
          const preview = previewByPeer.get(u.id);
          return preview
            ? { ...u, lastMessage: preview.text, lastMessageTime: preview.time }
            : u;
        })
      );
      setConversations(convList);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  }, [myAuthId, user?.role]);

  fetchSidebarRef.current = fetchSidebar;

  useEffect(() => {
    fetchSidebar();
  }, [fetchSidebar]);

  useEffect(() => {
    const open = searchParams.get('open');
    if (open === 'add') {
      setShowAddContactDialog(true);
    } else if (open === 'group') {
      setNewGroupName('');
      setCreateGroupMemberIds(new Set());
      setShowCreateGroupDialog(true);
    }
    if (open) {
      const next = new URLSearchParams(searchParams);
      next.delete('open');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Initialize Socket.IO connection (AuthContext + token mirror; avoids cleared localStorage)
  useEffect(() => {
    if (!myAuthId) return;

    let cancelled = false;

    const onGroupCreated = () => {
      if (cancelled) return;
      void fetchSidebarRef.current();
    };

    const initSocket = async () => {
      try {
        if (!appSocket.isConnected()) {
          await appSocket.connect(
            myAuthId,
            user.role,
            user.orgId || user.tenantId || undefined
          );
        }

        const myId = myAuthId;
        const listeners: Array<{ event: string; handler: (...args: unknown[]) => void }> = [];
        const reg = (event: string, handler: (...args: unknown[]) => void) => {
          listeners.push({ event, handler });
          appSocket.on(event, handler);
        };

        appSocket.on('chat:group_created', onGroupCreated);

        reg('chat:new_message', (data: {
          messageId: string;
          senderId: string;
          conversationId?: string;
          content: string;
          senderName: string;
          senderAvatar?: string;
          timestamp: string;
          messageType?: string;
        }) => {
          if (cancelled) return;
          const incomingId = String(data.messageId);
          const senderId = String(data.senderId);
          const convId = String(data.conversationId || '');

          setMessages((prev) => {
            const sel = selectedUserRef.current;
            const activeConv = getActiveConversationId(sel, myId);
            if (!activeConv || convId !== activeConv) {
              return prev;
            }

            if (prev.some((m) => String(m.messageId) === incomingId)) {
              return prev;
            }

            if (senderId === myId) {
              let replaced = false;
              const next = prev.map((msg) => {
                if (
                  !replaced &&
                  msg.messageId.startsWith('temp-') &&
                  msg.content === data.content
                ) {
                  replaced = true;
                  return {
                    ...msg,
                    messageId: incomingId,
                    status: 'delivered' as const,
                    timestamp: new Date(data.timestamp),
                    messageType: data.messageType || msg.messageType,
                  };
                }
                return msg;
              });
              return replaced ? next : prev;
            }

            return [
              ...prev,
              {
                messageId: incomingId,
                senderId,
                senderName: data.senderName,
                senderAvatar: data.senderAvatar,
                content: data.content,
                timestamp: new Date(data.timestamp),
                isOwn: false,
                status: 'delivered' as const,
                messageType: data.messageType || 'text',
              },
            ];
          });
        });

        reg('chat:message_read', (data: { messageId: string }) => {
          if (cancelled) return;
          setMessages((prev) =>
            prev.map((msg) =>
              String(msg.messageId) === String(data.messageId) ? { ...msg, status: 'read' } : msg
            )
          );
        });

        reg('chat:user_typing', (data: {
          conversationId?: string;
          userId: string;
          isTyping: boolean;
        }) => {
          if (cancelled) return;
          const sel = selectedUserRef.current;
          if (!sel) return;
          if (sel.chatKind === 'group') {
            if (String(data.conversationId || '') !== String(sel.conversationId)) return;
            if (String(data.userId) === myId) return;
            setIsTyping(!!data.isTyping);
            return;
          }
          if (String(data.userId) === sel.id) {
            setIsTyping(!!data.isTyping);
          }
        });

        reg('chat:message_edited', (data: { messageId?: string; newContent?: string; conversationId?: string }) => {
          if (cancelled) return;
          const sel = selectedUserRef.current;
          if (
            data.conversationId &&
            getActiveConversationId(sel, myId) !== String(data.conversationId)
          ) {
            return;
          }
          setMessages((prev) =>
            prev.map((msg) =>
              String(msg.messageId) === String(data.messageId)
                ? { ...msg, content: data.newContent ?? msg.content }
                : msg
            )
          );
        });

        reg('chat:avatar_updated', (data: { userId: string; avatar: string }) => {
          if (cancelled) return;
          const url = resolveAvatarUrl(data.avatar);
          setUsers((prev) =>
            prev.map((u) => (u.id === String(data.userId) ? { ...u, avatar: url } : u))
          );
          setSelectedUser((prev) =>
            prev && prev.id === String(data.userId) ? { ...prev, avatar: url } : prev
          );
        });

        reg('chat:message_deleted', (data: { messageId?: string; conversationId?: string }) => {
          if (cancelled) return;
          const sel = selectedUserRef.current;
          if (
            data.conversationId &&
            getActiveConversationId(sel, myId) !== String(data.conversationId)
          ) {
            return;
          }
          setMessages((prev) => prev.filter((msg) => String(msg.messageId) !== String(data.messageId)));
        });

        appSocket.emit('chat:get_conversations', {});
        reg('chat:conversations', (data: { conversations: unknown }) => {
          if (cancelled) return;
          setConversations(data.conversations);
        });

        reg(
          'call:incoming',
          (data: {
            callerId: string;
            callerName: string;
            sdp: RTCSessionDescriptionInit;
            withVideo: boolean;
          }) => {
            if (cancelled || nativeCallBusyRef.current) return;
            nativeCallBusyRef.current = true;
            const offer: IncomingCallOffer = {
              callerId: String(data.callerId),
              callerName: data.callerName || 'User',
              sdp: data.sdp,
              withVideo: !!data.withVideo,
            };
            setNativeIncomingOffer(offer);
            setNativeCallRole('callee');
            setNativeCallPeer({ id: offer.callerId, name: offer.callerName });
            setCallWithVideo(offer.withVideo);
            setNativeCallOpen(true);
            toast.info(`Incoming call from ${offer.callerName}`);
          }
        );

        socketListenersRef.current = listeners;
      } catch (error) {
        console.error('Socket initialization failed:', error);
        toast.error('Could not connect to chat server');
      }
    };

    initSocket();

    return () => {
      cancelled = true;
      for (const { event, handler } of socketListenersRef.current) {
        appSocket.off(event, handler);
      }
      socketListenersRef.current = [];
      appSocket.off('chat:group_created', onGroupCreated);
    };
  }, [myAuthId, user?.role, user?.orgId, user?.tenantId, fetchSidebar]);

  // Load messages when user is selected
  useEffect(() => {
    if (!selectedUser || !appSocket || !myAuthId) return;

    const myId = myAuthId;
    const conversationId = getActiveConversationId(selectedUser, myId);
      
      // Remove old listener before adding new one
      appSocket.off('chat:history');
      
      // Emit request for history
      appSocket.emit('chat:get_history', {
        conversationId,
        page: 1,
        limit: 50
      });

      // Set up listener for history response
      const handleHistory = (data: any) => {
        if (String(data.conversationId) !== conversationId) return;
        const seen = new Set<string>();
        const formattedMessages: Message[] = [];

        for (const msg of data.messages || []) {
          const id = String(msg._id);
          if (seen.has(id)) continue;
          seen.add(id);
          formattedMessages.push({
            messageId: id,
            senderId: String(msg.senderId),
            senderName: msg.sender?.name || 'Unknown',
            senderAvatar: resolveAvatarUrl(msg.sender?.avatar),
            content: msg.content?.text || '',
            timestamp: new Date(msg.createdAt),
            isOwn: String(msg.senderId) === myId,
            status: msg.status,
            messageType: msg.messageType,
            teamsIntegration: msg.metadata?.teamsIntegration,
          });
        }

        setMessages(formattedMessages.reverse());
      };

      appSocket.on('chat:history', handleHistory);

      return () => {
        appSocket?.off('chat:history', handleHistory);
      };
  }, [selectedUser, myAuthId]);

  // Auto-scroll chat pane only (not the main layout)
  useEffect(() => {
    const el = messagesScrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, isTyping, selectedUser?.id, selectedUser?.conversationId]);

  // Link Microsoft Teams chat when a conversation is opened
  useEffect(() => {
    if (!selectedUser || selectedUser.chatKind === 'group' || teamsChatIds[selectedUser.id]) return;

    const linkTeamsChat = async () => {
      try {
        const res = await apiClient.post<{ teamsChatId?: string }>('/chat/teams/create', {
          recipientId: selectedUser.id,
          topic: `WorkPlus — ${user?.name} & ${selectedUser.name}`,
        });
        const chatId = (res.data as { teamsChatId?: string })?.teamsChatId;
        if (chatId) {
          setTeamsChatIds((prev) => ({ ...prev, [selectedUser.id]: chatId }));
        }
      } catch {
        /* Teams sync optional — in-app chat still works */
      }
    };

    linkTeamsChat();
  }, [selectedUser?.id, user?.name, teamsChatIds]);

  // Handle sending message
  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedUser || !appSocket || !myAuthId) return;

    try {
      setSending(true);

      const isGroup = selectedUser.chatKind === 'group' && selectedUser.conversationId;

      // Create the message object
      const newMessage: Message = {
        messageId: `temp-${Date.now()}`, // Temporary ID until server confirms
        senderId: myAuthId,
        senderName: user.name || 'You',
        recipientId: isGroup ? undefined : selectedUser.id,
        content: messageInput,
        timestamp: new Date(),
        isOwn: true,
        status: 'sent',
        messageType: 'text'
      };
      
      // Optimistically add message to UI immediately
      setMessages(prev => [...prev, newMessage]);
      
      // Clear input immediately for better UX
      const messageToSend = messageInput;
      setMessageInput('');

      if (isGroup) {
        appSocket.emit('chat:send_message', {
          conversationId: selectedUser.conversationId,
          content: messageToSend,
          messageType: 'text',
        });
      } else {
        const teamsChatId = teamsChatIds[selectedUser.id];

        // Socket persists and delivers (single source — avoids duplicate DB rows)
        appSocket.emit('chat:send_message', {
          recipientId: selectedUser.id,
          content: messageToSend,
          messageType: 'text',
          teamsIntegration: teamsChatId
            ? { enabled: true, chatId: teamsChatId }
            : undefined,
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
      // Remove the optimistically added message on error
      setMessages(prev => prev.filter(msg => !msg.messageId.startsWith('temp-')));
    } finally {
      setSending(false);
    }
  };

  // Handle typing indicator
  const handleTyping = () => {
    if (!selectedUser || !appSocket) return;

    if (selectedUser.chatKind === 'group' && selectedUser.conversationId) {
      appSocket.emit('chat:typing', {
        conversationId: selectedUser.conversationId,
        isTyping: true
      });
    } else {
      appSocket.emit('chat:typing', {
        recipientId: selectedUser.id,
        isTyping: true
      });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (!selectedUserRef.current || !appSocket) return;
      const sel = selectedUserRef.current;
      if (sel.chatKind === 'group' && sel.conversationId) {
        appSocket.emit('chat:typing', {
          conversationId: sel.conversationId,
          isTyping: false
        });
      } else {
        appSocket?.emit('chat:typing', {
          recipientId: sel.id,
          isTyping: false
        });
      }
    }, 3000);
  };

  const startNativeCall = (withVideo: boolean, peer: ChatUser, role: NativeCallRole = 'caller') => {
    nativeCallBusyRef.current = true;
    setNativeIncomingOffer(null);
    setNativeCallRole(role);
    setNativeCallPeer({ id: peer.id, name: peer.name });
    setCallWithVideo(withVideo);
    setNativeCallOpen(true);
  };

  const closeNativeCall = () => {
    nativeCallBusyRef.current = false;
    setNativeCallOpen(false);
    setNativeIncomingOffer(null);
    setNativeCallPeer(null);
  };

  const shouldFallbackToNative = (error: unknown) => {
    if (!(error instanceof ApiError)) return false;
    return (
      error.status === 503 ||
      error.code === 'TEAMS_NOT_CONFIGURED' ||
      (error.status !== undefined && error.status >= 500)
    );
  };

  const startTeamsCall = async (withVideo: boolean) => {
    if (!selectedUser || selectedUser.chatKind === 'group') return;
    try {
      setCallWithVideo(withVideo);
      setCallLoading(true);
      const res = await apiClient.post<{
        joinWebUrl: string;
        subject: string;
        withVideo: boolean;
      }>('/chat/teams/meeting', {
        recipientId: selectedUser.id,
        withVideo,
      });

      const payload = res.data;
      if (!payload?.joinWebUrl) {
        throw new Error(res.message || 'No meeting URL returned');
      }

      setCallJoinUrl(payload.joinWebUrl);
      setCallSubject(payload.subject || `Call with ${selectedUser.name}`);
      setCallOpen(true);
    } catch (error: unknown) {
      console.error('Teams meeting error:', error);
      if (shouldFallbackToNative(error)) {
        toast.info('Using in-app call');
        startNativeCall(withVideo, selectedUser, 'caller');
        return;
      }
      toast.error(
        error instanceof ApiError
          ? error.getUserMessage()
          : error instanceof Error
            ? error.message
            : 'Could not start call.'
      );
    } finally {
      setCallLoading(false);
    }
  };

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedUser || !appSocket || !myAuthId) return;

    try {
      setSending(true);
      const formData = new FormData();
      formData.append('file', file);
      if (selectedUser.chatKind === 'group' && selectedUser.conversationId) {
        formData.append('conversationId', selectedUser.conversationId);
      } else {
        formData.append('recipientId', selectedUser.id);
      }

      const response = await apiClient.upload<{
        fileUrl?: string;
        messageId?: string;
        fileName?: string;
      }>('/chat/upload', formData);

      const payload = (response as { data?: { fileUrl?: string; messageId?: string } }).data;
      const fileUrl = payload?.fileUrl;
      if (fileUrl) {
        const newMessage: Message = {
          messageId: payload?.messageId || `temp-${Date.now()}`,
          senderId: myAuthId,
          senderName: user.name || 'You',
          recipientId: selectedUser.chatKind === 'group' ? undefined : selectedUser.id,
          content: fileUrl,
          timestamp: new Date(),
          isOwn: true,
          status: 'delivered',
          messageType: 'file',
        };

        setMessages((prev) => {
          const id = String(newMessage.messageId);
          if (prev.some((m) => String(m.messageId) === id)) return prev;
          return [...prev, newMessage];
        });

        toast.success('File uploaded successfully');
      } else {
        throw new Error('Upload did not return a file URL');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload file');
    } finally {
      setSending(false);
      if (event.target) event.target.value = '';
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (messageId.startsWith('temp-')) {
      setMessages((prev) => prev.filter((m) => m.messageId !== messageId));
      return;
    }
    try {
      await apiClient.delete(`/chat/messages/${messageId}`);
      setMessages((prev) => prev.filter((m) => m.messageId !== messageId));
      toast.success('Message deleted');
    } catch {
      toast.error('Failed to delete message');
    }
  };

  const handleRemoveContact = () => {
    if (!selectedUser || selectedUser.chatKind === 'group') return;
    const next = new Set(hiddenContactIds);
    next.add(selectedUser.id);
    persistHiddenContacts(next);
    setSelectedUser(null);
    setMessages([]);
    toast.success(`${selectedUser.name} removed from your chat list`);
  };

  const handleRestoreContact = (contactId: string) => {
    const next = new Set(hiddenContactIds);
    next.delete(contactId);
    persistHiddenContacts(next);
    const restored = users.find((u) => u.id === contactId);
    if (restored) {
      setSelectedUser(restored);
      setShowAddContactDialog(false);
      toast.success(`${restored.name} added to your chat list`);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    if (!selectedUser || !myAuthId) return;
    if (selectedUser.chatKind === 'group') {
      toast.error('Profile photos are only available in direct chats');
      return;
    }
    const canEditOther =
      user.role === 'admin' || user.role === 'super_admin';
    const isSelf = selectedUser.id === myAuthId;
    if (!isSelf && !canEditOther) {
      toast.error('You can only change your own profile photo here');
      return;
    }

    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const endpoint = isSelf
        ? '/profile/avatar'
        : `/chat/users/${selectedUser.id}/avatar`;
      const res = await apiClient.upload<{ avatarPath?: string; user?: { avatar?: string } }>(
        endpoint,
        formData
      );
      const avatarPath = res.data?.avatarPath || res.data?.user?.avatar;
      const url = resolveAvatarUrl(avatarPath);
      setUsers((prev) =>
        prev.map((u) => (u.id === selectedUser.id ? { ...u, avatar: url } : u))
      );
      setSelectedUser((prev) => (prev ? { ...prev, avatar: url } : prev));
      toast.success('Profile photo updated');
    } catch {
      toast.error('Failed to upload photo');
    } finally {
      setAvatarUploading(false);
      if (profileAvatarInputRef.current) profileAvatarInputRef.current.value = '';
    }
  };

  const canDeleteMessage = (message: Message) =>
    message.isOwn || user?.role === 'admin' || user?.role === 'super_admin';

  const visibleUsers = users
    .filter((u) => !hiddenContactIds.has(u.id))
    .filter((u) => user?.role === 'super_admin' || u.role !== 'super_admin');
  const filteredUsers = visibleUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredGroups = groupChats.filter(
    (g) =>
      g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const createGroupCandidates = visibleUsers.filter((u) => !u.chatKind);

  const addContactCandidates = users
    .filter((u) => u.id !== myAuthId)
    .filter((u) => user?.role === 'super_admin' || u.role !== 'super_admin')
    .filter(
      (u) =>
        u.name.toLowerCase().includes(addContactSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(addContactSearch.toLowerCase())
    );

  const handleOpenContactChat = (contact: ChatUser) => {
    setSelectedUser(contact);
    setShowAddContactDialog(false);
    setAddContactSearch('');
  };

  const handleCreateGroupSubmit = async () => {
    const name = newGroupName.trim();
    if (!name) {
      toast.error('Enter a group name');
      return;
    }
    if (createGroupMemberIds.size === 0) {
      toast.error('Select at least one employee');
      return;
    }
    setCreatingGroup(true);
    try {
      const res = await apiClient.post<{
        conversationId: string;
        name: string;
        memberIds: string[];
      }>('/chat/groups', { name, memberIds: [...createGroupMemberIds] });
      if (!res.success || !res.data) {
        throw new Error(res.message || 'Could not create group');
      }
      const d = res.data;
      toast.success('Group created');
      setShowCreateGroupDialog(false);
      setNewGroupName('');
      setCreateGroupMemberIds(new Set());
      await fetchSidebar();
      setSelectedUser({
        id: d.conversationId,
        name: d.name,
        email: `${d.memberIds.length} members`,
        role: 'employee',
        isOnline: true,
        unreadCount: 0,
        chatKind: 'group',
        conversationId: d.conversationId,
        memberIds: d.memberIds.map(String),
      });
    } catch (e: unknown) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Failed to create group');
    } finally {
      setCreatingGroup(false);
    }
  };

  return (
    <>
    <div className="h-full min-h-0 flex flex-1 bg-background overflow-hidden">
      {/* Sidebar - Users List */}
      <div className="w-80 shrink-0 border-r border-border bg-card flex flex-col min-h-0">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4 gap-2">
            <h2 className="text-lg font-semibold">Messages</h2>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1"
                onClick={() => setShowAddContactDialog(true)}
              >
                <UserPlus className="w-4 h-4" />
                Add
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1"
                onClick={() => {
                  setNewGroupName('');
                  setCreateGroupMemberIds(new Set());
                  setShowCreateGroupDialog(true);
                }}
              >
                <UsersRound className="w-4 h-4" />
                Group
              </Button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search people and groups..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 rounded-xl bg-background/50"
            />
          </div>
        </div>

        {/* Users List */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <div className="p-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredGroups.length === 0 && filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No chats match your search
              </div>
            ) : (
              <>
                {filteredGroups.length > 0 ? (
                  <>
                    <p className="px-2 text-xs font-semibold text-muted-foreground mb-1">Groups</p>
                    {filteredGroups.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setSelectedUser(g)}
                        className={`w-full p-3 rounded-lg mb-2 text-left transition-colors ${
                          selectedUser?.id === g.id
                            ? 'bg-accent border border-primary/40 shadow-sm'
                            : 'border border-transparent hover:bg-accent'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>
                              <UsersRound className="h-5 w-5 text-muted-foreground" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate text-foreground">{g.name}</p>
                              <Badge
                                variant="outline"
                                className="text-xs shrink-0 bg-muted text-foreground border-border"
                              >
                                Group
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{g.email}</p>
                            {g.lastMessage ? (
                              <p className="text-xs text-muted-foreground/80 truncate mt-0.5">
                                {g.lastMessage}
                                {g.lastMessageTime ? ` · ${g.lastMessageTime}` : ''}
                              </p>
                            ) : null}
                          </div>
                          {g.unreadCount > 0 && (
                            <Badge variant="default" className="ml-2">
                              {g.unreadCount}
                            </Badge>
                          )}
                        </div>
                      </button>
                    ))}
                  </>
                ) : null}
                {filteredUsers.length > 0 ? (
                  <>
                    {filteredGroups.length > 0 ? (
                      <p className="px-2 text-xs font-semibold text-muted-foreground mt-2 mb-1">
                        People
                      </p>
                    ) : null}
                    {filteredUsers.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => setSelectedUser(contact)}
                  className={`w-full p-3 rounded-lg mb-2 text-left transition-colors ${
                    selectedUser?.id === contact.id
                      ? 'bg-accent border border-primary/40 shadow-sm'
                      : 'border border-transparent hover:bg-accent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={contact.avatar} />
                        <AvatarFallback>{contact.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      {contact.isOnline && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate text-foreground">{contact.name}</p>
                        <Badge
                          variant="outline"
                          className={`text-xs shrink-0 ${roleBadgeClass(contact.role, selectedUser?.id === contact.id)}`}
                        >
                          {formatRoleLabel(contact.role)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
                      {contact.lastMessage ? (
                        <p className="text-xs text-muted-foreground/80 truncate mt-0.5">
                          {contact.lastMessage}
                          {contact.lastMessageTime ? ` · ${contact.lastMessageTime}` : ''}
                        </p>
                      ) : null}
                    </div>
                    {contact.unreadCount > 0 && (
                      <Badge variant="default" className="ml-2">{contact.unreadCount}</Badge>
                    )}
                  </div>
                </button>
                    ))}
                  </>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        {selectedUser ? (
          <>
            {/* Chat Header */}
            <div className="border-b border-border bg-card p-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={selectedUser.avatar} />
                  <AvatarFallback>
                    {selectedUser.chatKind === 'group' ? (
                      <UsersRound className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      (selectedUser.name || 'U').charAt(0)
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold truncate">{selectedUser.name}</p>
                    {selectedUser.chatKind === 'group' ? (
                      <Badge variant="outline" className="text-xs shrink-0 bg-muted text-foreground border-border">
                        Group
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className={`text-xs shrink-0 ${
                          selectedUser.role === 'admin'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : selectedUser.role === 'super_admin'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}
                      >
                        {selectedUser.role === 'super_admin'
                          ? 'Super Admin'
                          : selectedUser.role.charAt(0).toUpperCase() + selectedUser.role.slice(1)}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground break-all truncate">
                    {selectedUser.chatKind === 'group'
                      ? selectedUser.memberIds?.length
                        ? `${selectedUser.memberIds.length} members`
                        : 'Group chat'
                      : selectedUser.email}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {selectedUser.chatKind !== 'group' ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      title="Microsoft Teams voice call (in app)"
                      disabled={callLoading}
                      onClick={() => startTeamsCall(false)}
                    >
                      {callLoading && !callWithVideo ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Phone className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      title="Microsoft Teams video call (in app)"
                      disabled={callLoading}
                      onClick={() => startTeamsCall(true)}
                    >
                      {callLoading && callWithVideo ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Video className="w-4 h-4" />
                      )}
                    </Button>
                  </>
                ) : null}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" type="button" aria-label="More chat options">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={() => setShowProfileDialog(true)}>
                      <User className="w-4 h-4 mr-2" />
                      {selectedUser.chatKind === 'group' ? 'Group details' : 'View profile'}
                    </DropdownMenuItem>
                    {selectedUser.chatKind !== 'group' ? (
                      <DropdownMenuItem onClick={() => profileAvatarInputRef.current?.click()}>
                        <Camera className="w-4 h-4 mr-2" />
                        Change photo
                      </DropdownMenuItem>
                    ) : null}
                    {selectedUser.chatKind !== 'group' ? <DropdownMenuSeparator /> : null}
                    {selectedUser.chatKind !== 'group' ? (
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={handleRemoveContact}
                      >
                        <UserMinus className="w-4 h-4 mr-2" />
                        Remove contact
                      </DropdownMenuItem>
                    ) : null}
                    {selectedUser.chatKind !== 'group' ? (
                      <DropdownMenuItem
                        onClick={() =>
                          toast.info(
                            'Calls use Microsoft Teams meetings inside WorkPlus. Your org must have Teams Graph permissions configured.'
                          )
                        }
                      >
                        About Teams calls
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Messages Area */}
            <div
              ref={messagesScrollRef}
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4"
            >
              <div className="space-y-4">
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <p>No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.messageId}
                      className={`group flex items-end gap-2 ${message.isOwn ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          message.isOwn
                            ? 'bg-green-500 text-white'
                            : 'bg-orange-500 text-white'
                        }`}
                      >
                        {message.messageType === 'file' && message.content ? (
                          <a
                            href={buildFileUrl(message.content)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm underline break-all"
                          >
                            View attachment
                          </a>
                        ) : (
                          <>
                            {!message.isOwn &&
                              selectedUser.chatKind === 'group' &&
                              message.messageType !== 'system' && (
                                <p className="text-xs font-semibold opacity-95 mb-1">
                                  {message.senderName}
                                </p>
                              )}
                            <p className="text-sm break-words">{message.content}</p>
                          </>
                        )}
                        <div className="flex items-center gap-1 mt-1 text-xs opacity-90">
                          <span>
                            {new Date(message.timestamp).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric' 
                            })} {new Date(message.timestamp).toLocaleTimeString('en-US', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </span>
                          {message.isOwn && (
                            message.status === 'read' ? (
                              <CheckCheck className="w-3 h-3" />
                            ) : (
                              <Check className="w-3 h-3" />
                            )
                          )}
                        </div>
                      </div>
                      {canDeleteMessage(message) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0 text-muted-foreground hover:text-destructive"
                          aria-label="Delete message"
                          onClick={() => handleDeleteMessage(message.messageId)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  ))
                )}
                {isTyping && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </div>
                    <span className="text-xs">
                      {selectedUser.chatKind === 'group'
                        ? 'Someone is typing…'
                        : `${selectedUser.name} is typing…`}
                    </span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Message Input */}
            <div className="border-t border-border bg-card p-4 shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                disabled={sending}
                onChange={handleFileUpload}
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={sending}
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Attach file"
                >
                  <Paperclip className="w-4 h-4" />
                </Button>
                <Input
                  placeholder="Type a message..."
                  value={messageInput}
                  onChange={(e) => {
                    setMessageInput(e.target.value);
                    handleTyping();
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="flex-1"
                />
                <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="ghost" size="sm" aria-label="Insert emoji">
                      <Smile className="w-4 h-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2" align="end">
                    <div className="grid grid-cols-6 gap-1">
                      {CHAT_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          className="text-lg hover:bg-muted rounded p-1"
                          onClick={() => appendEmoji(emoji)}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <Button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || sending}
                  size="sm"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Select a person or group to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>

    <TeamsCallPanel
      open={callOpen}
      onClose={() => {
        setCallOpen(false);
        setCallJoinUrl(null);
      }}
      joinWebUrl={callJoinUrl}
      subject={callSubject}
      withVideo={callWithVideo}
      peerName={selectedUser?.name || 'User'}
    />

    {nativeCallPeer && (
      <NativeCallPanel
        open={nativeCallOpen}
        onClose={closeNativeCall}
        role={nativeCallRole}
        peerId={nativeCallPeer.id}
        peerName={nativeCallPeer.name}
        withVideo={callWithVideo}
        localUserName={user?.name || 'User'}
        socket={appSocket}
        incomingOffer={nativeIncomingOffer}
      />
    )}

    <input
      ref={profileAvatarInputRef}
      type="file"
      accept="image/jpeg,image/png,image/gif,image/webp"
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) handleAvatarUpload(file);
      }}
    />

    <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>{selectedUser?.name || 'Contact'}</DialogTitle>
          <DialogDescription>
            {selectedUser?.chatKind === 'group' ? 'Members in this group' : 'Profile information'}
          </DialogDescription>
        </DialogHeader>
        {selectedUser && selectedUser.chatKind === 'group' ? (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              {(selectedUser.memberIds || []).length} members
            </p>
            <ul className="list-disc pl-5 space-y-1 max-h-52 overflow-y-auto">
              {(selectedUser.memberIds || []).map((mid) => (
                <li key={mid}>
                  {mid === myAuthId
                    ? `${user?.name || 'You'} (you)`
                    : users.find((u) => u.id === mid)?.name || `User`}
                </li>
              ))}
            </ul>
          </div>
        ) : selectedUser ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-14 w-14">
                <AvatarImage src={selectedUser.avatar} />
                <AvatarFallback>{selectedUser.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{selectedUser.name}</p>
                <Badge variant="outline" className="mt-1 capitalize">
                  {selectedUser.role.replace('_', ' ')}
                </Badge>
              </div>
            </div>
            <div className="text-sm space-y-2">
              <p>
                <span className="text-muted-foreground">Email: </span>
                {selectedUser.email}
              </p>
              <p>
                <span className="text-muted-foreground">Status: </span>
                {selectedUser.isOnline ? 'Online' : 'Offline'}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              disabled={avatarUploading}
              onClick={() => profileAvatarInputRef.current?.click()}
            >
              {avatarUploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
              {avatarUploading ? 'Uploading…' : 'Change profile photo'}
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>

    <Dialog open={showCreateGroupDialog} onOpenChange={setShowCreateGroupDialog}>
      <DialogContent className="z-[200] max-w-md rounded-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Create group</DialogTitle>
          <DialogDescription>
            Name the group and choose employees from your organization. You will be added automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1 shrink-0">
          <Input
            placeholder="Group name"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
          />
        </div>
        <p className="text-xs font-medium text-muted-foreground">Members</p>
        <div className="min-h-0 flex-1 overflow-y-auto border rounded-lg p-2 space-y-1 max-h-64">
          {createGroupCandidates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No employees available to add.</p>
          ) : (
            createGroupCandidates.map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer"
              >
                <Checkbox
                  checked={createGroupMemberIds.has(c.id)}
                  onCheckedChange={(checked) => {
                    setCreateGroupMemberIds((prev) => {
                      const next = new Set(prev);
                      if (checked === true) next.add(c.id);
                      else next.delete(c.id);
                      return next;
                    });
                  }}
                />
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={c.avatar} />
                  <AvatarFallback>{c.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                </div>
              </label>
            ))
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setShowCreateGroupDialog(false);
              setNewGroupName('');
              setCreateGroupMemberIds(new Set());
            }}
          >
            Cancel
          </Button>
          <Button type="button" disabled={creatingGroup} onClick={() => void handleCreateGroupSubmit()}>
            {creatingGroup ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create group'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={showAddContactDialog} onOpenChange={setShowAddContactDialog}>
      <DialogContent className="z-[200] max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Add contact</DialogTitle>
          <DialogDescription>
            Search your organization, then add a removed contact back or open a chat.
          </DialogDescription>
        </DialogHeader>
        <Input
          placeholder="Search by name or email…"
          value={addContactSearch}
          onChange={(e) => setAddContactSearch(e.target.value)}
          className="mb-3"
        />
        <div className="max-h-64 overflow-y-auto space-y-1">
          {addContactCandidates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No users match your search.
            </p>
          ) : (
            addContactCandidates.map((contact) => {
              const isHidden = hiddenContactIds.has(contact.id);
              return (
                <div
                  key={contact.id}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent"
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage src={contact.avatar} />
                    <AvatarFallback>{contact.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{contact.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
                  </div>
                  {isHidden ? (
                    <Button
                      type="button"
                      size="sm"
                      className="shrink-0"
                      onClick={() => handleRestoreContact(contact.id)}
                    >
                      Add
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => handleOpenContactChat(contact)}
                    >
                      Message
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setShowAddContactDialog(false);
              setAddContactSearch('');
            }}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
