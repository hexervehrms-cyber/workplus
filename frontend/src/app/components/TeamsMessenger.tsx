/**
 * Microsoft Teams Integrated Messenger Component
 * Enables chat between admin and users with Teams synchronization
 */

import { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { TeamsCallPanel } from './TeamsCallPanel';
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
} from './ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';
import { apiClient, TokenManager } from '../utils/api';
import { buildApiUrl, buildFileUrl } from '../utils/apiHelper';
import { SocketService } from '../utils/socket';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  isOnline: boolean;
  unreadCount: number;
  lastMessage?: string;
  lastMessageTime?: string;
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

export default function TeamsMessenger() {
  const { user } = useAuth();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [_conversations, setConversations] = useState<Conversation[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const socketService = useRef<SocketService | null>(null);
  const [teamsChatIds, setTeamsChatIds] = useState<Record<string, string>>({});
  const [callOpen, setCallOpen] = useState(false);
  const [callJoinUrl, setCallJoinUrl] = useState<string | null>(null);
  const [callSubject, setCallSubject] = useState('');
  const [callWithVideo, setCallWithVideo] = useState(true);
  const [callLoading, setCallLoading] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const selectedUserRef = useRef<User | null>(null);
  selectedUserRef.current = selectedUser;

  const CHAT_EMOJIS = ['😀', '😊', '👍', '🙏', '❤️', '🎉', '✅', '🔥', '💼', '📎', '🙂', '😅'];
  const [hiddenContactIds, setHiddenContactIds] = useState<Set<string>>(() => new Set());
  const [showAddContactDialog, setShowAddContactDialog] = useState(false);
  const [addContactSearch, setAddContactSearch] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const profileAvatarInputRef = useRef<HTMLInputElement>(null);

  const hiddenStorageKey = user?.id ? `workplus-chat-hidden-${user.id}` : null;

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

  const mapApiUser = (u: any): User => ({
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

  // Initialize Socket.IO connection (AuthContext + token mirror; avoids cleared localStorage)
  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;

    const initSocket = async () => {
      try {
        socketService.current = new SocketService();
        const token = TokenManager.get();
        if (!token) {
          console.warn('TeamsMessenger: no bearer token in memory for socket auth');
        }

        await socketService.current.connect(
          user.id,
          user.role,
          user.orgId || user.tenantId || undefined
        );

        const myId = String(user.id);

        socketService.current.on('chat:new_message', (data) => {
          if (cancelled) return;
          const incomingId = String(data.messageId);
          const senderId = String(data.senderId);

          setMessages((prev) => {
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
              },
            ];
          });
        });

        socketService.current.on('chat:message_read', (data) => {
          if (cancelled) return;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.messageId === data.messageId ? { ...msg, status: 'read' } : msg
            )
          );
        });

        socketService.current.on('chat:user_typing', (data) => {
          if (cancelled) return;
          if (data.userId === selectedUserRef.current?.id) {
            setIsTyping(data.isTyping);
          }
        });

        socketService.current.on('chat:message_edited', (data) => {
          if (cancelled) return;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.messageId === data.messageId ? { ...msg, content: data.newContent } : msg
            )
          );
        });

        socketService.current.on('chat:avatar_updated', (data: { userId: string; avatar: string }) => {
          if (cancelled) return;
          const url = resolveAvatarUrl(data.avatar);
          setUsers((prev) =>
            prev.map((u) => (u.id === String(data.userId) ? { ...u, avatar: url } : u))
          );
          setSelectedUser((prev) =>
            prev && prev.id === String(data.userId) ? { ...prev, avatar: url } : prev
          );
        });

        socketService.current.on('chat:message_deleted', (data) => {
          if (cancelled) return;
          setMessages((prev) => prev.filter((msg) => msg.messageId !== data.messageId));
        });

        socketService.current.emit('chat:get_conversations', {});
        socketService.current.on('chat:conversations', (data) => {
          if (cancelled) return;
          setConversations(data.conversations);
        });
      } catch (error) {
        console.error('Socket initialization failed:', error);
        toast.error('Could not connect to chat server');
      }
    };

    initSocket();

    return () => {
      cancelled = true;
      if (socketService.current) {
        socketService.current.disconnect();
      }
    };
  }, [user?.id, user?.role, user?.orgId, user?.tenantId]);

  // Fetch org users + conversation previews for chat sidebar
  useEffect(() => {
    const fetchUsers = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const myId = String(user.id);
        const [usersRes, convRes] = await Promise.all([
          apiClient.get<any[]>('/chat/users'),
          apiClient.get<any[]>('/chat/conversations').catch(() => ({ success: false, data: [] })),
        ]);

        const rawUsers = Array.isArray(usersRes.data) ? usersRes.data : [];
        const formattedUsers: User[] = rawUsers
          .filter((u: any) => String(u._id || u.id) !== myId)
          .map(mapApiUser);

        const convList = Array.isArray(convRes.data) ? convRes.data : [];
        const previewByPeer = new Map<string, { text: string; time: string }>();

        for (const conv of convList) {
          const last = conv.lastMessage;
          if (!last) continue;
          const parts = String(conv._id || last.conversationId || '')
            .split('_')
            .filter(Boolean);
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
        toast.error('Failed to load users');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [user?.id]);

  // Load messages when user is selected
  useEffect(() => {
    if (!selectedUser || !socketService.current || !user?.id) return;

    const myId = String(user.id);
    const conversationId = [myId, selectedUser.id].sort().join('_');
      
      // Remove old listener before adding new one
      socketService.current.off('chat:history');
      
      // Emit request for history
      socketService.current.emit('chat:get_history', {
        conversationId,
        page: 1,
        limit: 50
      });

      // Set up listener for history response
      const handleHistory = (data: any) => {
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
            senderAvatar: msg.sender?.avatar,
            content: msg.content?.text || '',
            timestamp: new Date(msg.createdAt),
            isOwn: String(msg.senderId) === myId,
            status: msg.status,
            teamsIntegration: msg.metadata?.teamsIntegration,
          });
        }

        setMessages(formattedMessages.reverse());
      };

      socketService.current.on('chat:history', handleHistory);

      return () => {
        socketService.current?.off('chat:history', handleHistory);
      };
  }, [selectedUser, user?.id]);

  // Auto-scroll chat pane only (not the main layout)
  useEffect(() => {
    const el = messagesScrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, isTyping, selectedUser?.id]);

  // Link Microsoft Teams chat when a conversation is opened
  useEffect(() => {
    if (!selectedUser || teamsChatIds[selectedUser.id]) return;

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
    if (!messageInput.trim() || !selectedUser || !socketService.current || !user?.id) return;

    try {
      setSending(true);

      // Create the message object
      const newMessage: Message = {
        messageId: `temp-${Date.now()}`, // Temporary ID until server confirms
        senderId: user.id,
        senderName: user.name || 'You',
        recipientId: selectedUser.id,
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

      const teamsChatId = teamsChatIds[selectedUser.id];

      // Socket persists and delivers (single source — avoids duplicate DB rows)
      socketService.current.emit('chat:send_message', {
        recipientId: selectedUser.id,
        content: messageToSend,
        messageType: 'text',
        teamsIntegration: teamsChatId
          ? { enabled: true, chatId: teamsChatId }
          : undefined,
      });
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
    if (!selectedUser || !socketService.current) return;

    socketService.current.emit('chat:typing', {
      recipientId: selectedUser.id,
      isTyping: true
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socketService.current?.emit('chat:typing', {
        recipientId: selectedUser.id,
        isTyping: false
      });
    }, 3000);
  };

  const startTeamsCall = async (withVideo: boolean) => {
    if (!selectedUser) return;
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

      const payload = res.data as
        | { joinWebUrl?: string; subject?: string }
        | undefined;
      if (!payload?.joinWebUrl) {
        throw new Error(res.message || 'No meeting URL returned');
      }

      setCallJoinUrl(payload.joinWebUrl);
      setCallSubject(payload.subject || `Call with ${selectedUser.name}`);
      setCallWithVideo(withVideo);
      setCallOpen(true);
    } catch (error: unknown) {
      console.error('Teams meeting error:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not start Teams call. Check Microsoft Teams integration on the server.'
      );
    } finally {
      setCallLoading(false);
    }
  };

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedUser || !socketService.current || !user?.id) return;

    try {
      setSending(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('recipientId', selectedUser.id);

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
          senderId: String(user.id),
          senderName: user.name || 'You',
          recipientId: selectedUser.id,
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
    if (!selectedUser) return;
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
    if (!selectedUser || !user?.id) return;
    const canEditOther =
      user.role === 'admin' || user.role === 'super_admin';
    const isSelf = selectedUser.id === String(user.id);
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

  const visibleUsers = users.filter((u) => !hiddenContactIds.has(u.id));
  const hiddenUsers = users.filter((u) => hiddenContactIds.has(u.id));

  const filteredUsers = visibleUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addContactCandidates = hiddenUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(addContactSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(addContactSearch.toLowerCase())
  );

  return (
    <>
    <div className="h-full min-h-0 flex flex-1 bg-background overflow-hidden">
      {/* Sidebar - Users List */}
      <div className="w-80 shrink-0 border-r border-border bg-card flex flex-col min-h-0">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Messages</h2>
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
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
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
            ) : filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => setSelectedUser(user)}
                  className={`w-full p-3 rounded-lg mb-2 text-left transition-colors ${
                    selectedUser?.id === user.id
                      ? 'bg-accent border border-primary/40 shadow-sm'
                      : 'border border-transparent hover:bg-accent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatar} />
                        <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      {user.isOnline && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate text-foreground">{user.name}</p>
                        <Badge
                          variant="outline"
                          className={`text-xs shrink-0 ${roleBadgeClass(user.role, selectedUser?.id === user.id)}`}
                        >
                          {formatRoleLabel(user.role)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      {user.lastMessage ? (
                        <p className="text-xs text-muted-foreground/80 truncate mt-0.5">
                          {user.lastMessage}
                          {user.lastMessageTime ? ` · ${user.lastMessageTime}` : ''}
                        </p>
                      ) : null}
                    </div>
                    {user.unreadCount > 0 && (
                      <Badge variant="default" className="ml-2">{user.unreadCount}</Badge>
                    )}
                  </div>
                </button>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No users found
              </div>
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
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedUser.avatar} />
                  <AvatarFallback>{selectedUser.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{selectedUser.name}</p>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        selectedUser.role === 'admin' ? 'bg-red-50 text-red-700 border-red-200' :
                        selectedUser.role === 'super_admin' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                        'bg-blue-50 text-blue-700 border-blue-200'
                      }`}
                    >
                      {selectedUser.role === 'super_admin' ? 'Super Admin' : selectedUser.role.charAt(0).toUpperCase() + selectedUser.role.slice(1)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground break-all">{selectedUser.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" type="button" aria-label="More chat options">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={() => setShowProfileDialog(true)}>
                      <User className="w-4 h-4 mr-2" />
                      View profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => profileAvatarInputRef.current?.click()}>
                      <Camera className="w-4 h-4 mr-2" />
                      Change photo
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={handleRemoveContact}
                    >
                      <UserMinus className="w-4 h-4 mr-2" />
                      Remove contact
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        toast.info(
                          'Calls use Microsoft Teams meetings inside WorkPlus. Your org must have Teams Graph permissions configured.'
                        )
                      }
                    >
                      About Teams calls
                    </DropdownMenuItem>
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
                          <p className="text-sm break-words">{message.content}</p>
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
                    <span className="text-xs">{selectedUser.name} is typing...</span>
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
              <p>Select a user to start messaging</p>
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
          <DialogDescription>Profile information</DialogDescription>
        </DialogHeader>
        {selectedUser && (
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
        )}
      </DialogContent>
    </Dialog>

    <Dialog open={showAddContactDialog} onOpenChange={setShowAddContactDialog}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Add contact</DialogTitle>
          <DialogDescription>
            Restore a removed contact or pick someone from your organization.
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
              No hidden contacts. All organization users are already in your list.
            </p>
          ) : (
            addContactCandidates.map((contact) => (
              <button
                key={contact.id}
                type="button"
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent text-left"
                onClick={() => handleRestoreContact(contact.id)}
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src={contact.avatar} />
                  <AvatarFallback>{contact.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-medium truncate">{contact.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
