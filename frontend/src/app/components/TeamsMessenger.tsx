/**
 * Microsoft Teams Integrated Messenger Component
 * Enables chat between admin and users with Teams synchronization
 */

import { useState, useEffect, useRef } from 'react';
import { Send, Search, MoreVertical, Paperclip, Smile, Phone, Video, MessageSquare, Loader2, Check, CheckCheck } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { apiClient, TokenManager } from '../utils/api';
import { buildFileUrl } from '../utils/apiHelper';
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
  const socketService = useRef<SocketService | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const selectedUserRef = useRef<User | null>(null);
  selectedUserRef.current = selectedUser;

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
          if (data.senderId !== myId) {
            setMessages((prev) => [
              ...prev,
              {
                messageId: data.messageId,
                senderId: data.senderId,
                senderName: data.senderName,
                senderAvatar: data.senderAvatar,
                content: data.content,
                timestamp: new Date(data.timestamp),
                isOwn: false,
                status: 'delivered',
              },
            ]);
          } else {
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.messageId.startsWith('temp-') && msg.content === data.content) {
                  return {
                    ...msg,
                    messageId: data.messageId,
                    status: 'delivered',
                    timestamp: new Date(data.timestamp),
                  };
                }
                return msg;
              })
            );
          }
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

  // Fetch users for chat with role-based filtering
  useEffect(() => {
    const fetchUsers = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const response = await apiClient.get<any[]>('/chat/users');

        if (response.data && Array.isArray(response.data)) {
          const myId = String(user.id);
          const formattedUsers: User[] = response.data
            .filter((u: any) => u.role !== 'super_admin' && String(u._id) !== myId)
            .map((u: any) => ({
              id: u._id,
              name: u.name || 'User',
              email: (u.email && String(u.email).trim()) || 'Email not on file',
              role: u.role,
              avatar: u.avatar,
              isOnline: true,
              unreadCount: 0,
              lastMessage: '',
              lastMessageTime: '',
            }));

          setUsers(formattedUsers);
        }
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
        const formattedMessages: Message[] = data.messages.map((msg: any) => ({
          messageId: msg._id,
          senderId: msg.senderId,
          senderName: msg.sender?.name || 'Unknown',
          senderAvatar: msg.sender?.avatar,
          content: msg.content?.text || '',
          timestamp: new Date(msg.createdAt),
          isOwn: msg.senderId === myId,
          status: msg.status,
          teamsIntegration: msg.metadata?.teamsIntegration
        }));

        setMessages(formattedMessages.reverse());
      };

      socketService.current.on('chat:history', handleHistory);

      return () => {
        socketService.current?.off('chat:history', handleHistory);
      };
  }, [selectedUser, user?.id]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

      // Send via Socket.IO for real-time delivery
      socketService.current.emit('chat:send_message', {
        recipientId: selectedUser.id,
        content: messageToSend,
        messageType: 'text',
      });

      // Also send via API for persistence
      const response = await apiClient.post('/chat/messages', {
        recipientId: selectedUser.id,
        content: {
          text: messageToSend
        },
        messageType: 'text',
      });
      
      const saved = response.data as { messageId?: string; _id?: string } | undefined;
      const realId = saved?.messageId || (saved?._id != null ? String(saved._id) : undefined);
      if (realId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.messageId === newMessage.messageId
              ? { ...msg, messageId: realId, status: 'delivered' as const }
              : msg
          )
        );
      }

      toast.success('Message sent');
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

  // Open a browser-based meeting room (no Microsoft Teams dependency)
  const openQuickMeeting = (withVideo: boolean) => {
    if (!selectedUser || !user?.id) return;
    const room = encodeURIComponent(`WorkPlus-${[String(user.id), selectedUser.id].sort().join('-')}`);
    const base = withVideo
      ? `https://meet.jit.si/${room}`
      : `https://meet.jit.si/${room}#config.startWithVideoMuted=true`;
    window.open(base, '_blank', 'noopener,noreferrer');
    toast.success(withVideo ? 'Opening video room in a new tab' : 'Opening voice-first room in a new tab');
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

      const response = await apiClient.upload<{ fileUrl?: string; messageId?: string; fileName?: string }>(
        '/chat/upload',
        formData
      );

      const payload = response.data;
      if (payload?.fileUrl) {
        const newMessage: Message = {
          messageId: payload.messageId || `temp-${Date.now()}`,
          senderId: user.id,
          senderName: user.name || 'You',
          recipientId: selectedUser.id,
          content: payload.fileUrl,
          timestamp: new Date(),
          isOwn: true,
          status: 'delivered',
          messageType: 'file',
        };

        setMessages((prev) => [...prev, newMessage]);

        socketService.current.emit('chat:send_message', {
          recipientId: selectedUser.id,
          content: payload.fileUrl,
          messageType: 'file',
          fileName: file.name,
          fileSize: file.size,
        });

        toast.success('File uploaded successfully');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload file');
    } finally {
      setSending(false);
      if (event.target) event.target.value = '';
    }
  };

  // Filter users based on search
  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-4rem)] flex bg-background">
      {/* Sidebar - Users List */}
      <div className="w-80 border-r border-border bg-card flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold mb-4">Messages</h2>
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
        <ScrollArea className="flex-1">
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
                      ? 'bg-primary text-primary-foreground ring-2 ring-primary/50 ring-offset-2 ring-offset-background shadow-md'
                      : 'hover:bg-accent'
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
                        <p className="font-medium truncate">{user.name}</p>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            user.role === 'admin' ? 'bg-red-50 text-red-700 border-red-200' :
                            user.role === 'super_admin' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                            'bg-blue-50 text-blue-700 border-blue-200'
                          }`}
                        >
                          {user.role === 'super_admin' ? 'Super Admin' : user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
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
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedUser ? (
          <>
            {/* Chat Header */}
            <div className="border-b border-border bg-card p-4 flex items-center justify-between">
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
                  title="Voice call (opens browser meeting)"
                  onClick={() => openQuickMeeting(false)}
                >
                  <Phone className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  title="Video call (opens browser meeting)"
                  onClick={() => openQuickMeeting(true)}
                >
                  <Video className="w-4 h-4" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" type="button" aria-label="More chat options">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem
                      onClick={() =>
                        toast.info('Meetings open in a new browser tab (Jitsi). Allow camera/microphone when prompted.')
                      }
                    >
                      About browser calls
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Messages Area */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <p>No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.messageId}
                      className={`flex ${message.isOwn ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          message.isOwn
                            ? 'bg-green-500 text-white'
                            : 'bg-orange-500 text-white'
                        }`}
                      >
                        {message.messageType === 'file' && message.content?.startsWith('/') ? (
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
            </ScrollArea>

            {/* Message Input */}
            <div className="border-t border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={sending}
                  />
                  <Button 
                    variant="ghost" 
                    size="sm"
                    disabled={sending}
                    asChild
                  >
                    <span>
                      <Paperclip className="w-4 h-4" />
                    </span>
                  </Button>
                </label>
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
                <Button variant="ghost" size="sm">
                  <Smile className="w-4 h-4" />
                </Button>
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
  );
}
