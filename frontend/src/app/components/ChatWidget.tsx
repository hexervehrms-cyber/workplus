/**
 * Compact Chat Widget for Dashboard Integration
 * Displays recent conversations and quick messaging
 */

import { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, X, Minimize2, Maximize2, Loader2, UserPlus, UsersRound } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Card } from './ui/card';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { apiClient } from '../utils/api';
import { socketService as chatSocket } from '../utils/socket';
import { toast } from '../utils/portalToast';
import { useAuth } from '../context/AuthContext';

interface ChatUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  isOnline: boolean;
  unreadCount: number;
  lastMessage?: string;
  lastMessageTime?: string;
}

interface ChatMessage {
  messageId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  timestamp: Date;
  isOwn: boolean;
  status: 'sent' | 'delivered' | 'read';
}

interface ChatWidgetProps {
  maxHeight?: string;
  compact?: boolean;
}

function resolveAuthUserId(user: { id?: string; userId?: string } | null | undefined): string {
  if (!user) return '';
  return String(user.userId || user.id || '');
}

function chatPathForRole(role?: string): string {
  if (role === 'super_admin') return '/super-admin/chat';
  if (role === 'admin' || role === 'hr' || role === 'manager') return '/admin/chat';
  return '/employee/chat';
}

export default function ChatWidget({ maxHeight = 'h-96', compact = true }: ChatWidgetProps) {
  const { user: authUser } = useAuth();
  const navigate = useNavigate();
  const authUserId = resolveAuthUserId(authUser);
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedUserRef = useRef<ChatUser | null>(null);
  selectedUserRef.current = selectedUser;

  useEffect(() => {
    if (!authUserId) return;

    let cancelled = false;

    const onNewMessage = (data: {
      messageId: string;
      senderId: string;
      senderName: string;
      senderAvatar?: string;
      content: string;
      timestamp: string;
    }) => {
      if (cancelled) return;
      const senderId = String(data.senderId);

      if (selectedUserRef.current?.id === senderId) {
        setMessages((prev) => [
          ...prev,
          {
            messageId: data.messageId,
            senderId,
            senderName: data.senderName,
            senderAvatar: data.senderAvatar,
            content: data.content,
            timestamp: new Date(data.timestamp),
            isOwn: false,
            status: 'delivered',
          },
        ]);
      } else {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === senderId
              ? {
                  ...u,
                  unreadCount: u.unreadCount + 1,
                  lastMessage: data.content,
                  lastMessageTime: new Date().toLocaleTimeString(),
                }
              : u
          )
        );
        setUnreadCount((prev) => prev + 1);
      }
    };

    const onMessageRead = (data: { messageId: string }) => {
      if (cancelled) return;
      setMessages((prev) =>
        prev.map((msg) =>
          msg.messageId === data.messageId ? { ...msg, status: 'read' } : msg
        )
      );
    };

    const initSocket = async () => {
      try {
        if (!chatSocket.isConnected()) {
          await chatSocket.connect(
            authUserId,
            authUser?.role || 'employee',
            authUser?.orgId || authUser?.tenantId || undefined
          );
        }

        chatSocket.on('chat:new_message', onNewMessage);
        chatSocket.on('chat:message_read', onMessageRead);
      } catch (error) {
        console.error('Socket initialization failed:', error);
      }
    };

    void initSocket();

    return () => {
      cancelled = true;
      chatSocket.off('chat:new_message', onNewMessage);
      chatSocket.off('chat:message_read', onMessageRead);
    };
  }, [authUserId, authUser?.role, authUser?.orgId, authUser?.tenantId]);

  useEffect(() => {
    const fetchUsers = async () => {
      if (!authUserId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const response = await apiClient.get<any[]>('/chat/users');

        if (response.data && Array.isArray(response.data)) {
          const myId = authUserId;
          const hideSuperAdmin = authUser?.role !== 'super_admin';
          const formattedUsers: ChatUser[] = response.data
            .filter((u: any) => String(u._id || u.id) !== myId)
            .filter((u: any) => !hideSuperAdmin || u.role !== 'super_admin')
            .map((u: any) => ({
              id: String(u._id || u.id),
              name: (u.name && String(u.name).trim()) || 'User',
              email: (u.email && String(u.email).trim()) || 'Email not on file',
              avatar: u.avatar,
              isOnline: true,
              unreadCount: 0,
              lastMessage: '',
              lastMessageTime: '',
            }));

          setUsers(formattedUsers);
          setUnreadCount(0);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchUsers();
  }, [authUserId, authUser?.role]);

  useEffect(() => {
    if (!selectedUser?.id || !chatSocket.isConnected() || !authUserId) return;

    const myId = authUserId;
    const conversationId = [myId, selectedUser.id].sort().join('_');

    const handleHistory = (data: { messages?: any[] }) => {
      const formattedMessages: ChatMessage[] = (data.messages || []).map((msg: any) => ({
        messageId: String(msg._id),
        senderId: String(msg.senderId),
        senderName: msg.sender?.name || 'Unknown',
        senderAvatar: msg.sender?.avatar,
        content: msg.content?.text || '',
        timestamp: new Date(msg.createdAt),
        isOwn: String(msg.senderId) === myId,
        status: msg.status,
      }));

      setMessages(formattedMessages.reverse());
    };

    chatSocket.on('chat:history', handleHistory);
    chatSocket.emit('chat:get_history', {
      conversationId,
      page: 1,
      limit: 20,
    });

    setUsers((prev) =>
      prev.map((u) => (u.id === selectedUser.id ? { ...u, unreadCount: 0 } : u))
    );

    return () => {
      chatSocket?.off('chat:history', handleHistory);
    };
  }, [selectedUser?.id, authUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedUser || !chatSocket.isConnected() || !authUserId) return;

    const myId = authUserId;
    const text = messageInput.trim();
    const tempId = `temp-${Date.now()}`;

    try {
      setSending(true);

      setMessages((prev) => [
        ...prev,
        {
          messageId: tempId,
          senderId: myId,
          senderName: authUser?.name || 'You',
          content: text,
          timestamp: new Date(),
          isOwn: true,
          status: 'sent',
        },
      ]);

      chatSocket.emit('chat:send_message', {
        recipientId: selectedUser.id,
        content: text,
        messageType: 'text',
      });

      await apiClient.post('/chat/messages', {
        recipientId: selectedUser.id,
        content: { text },
        messageType: 'text',
      });

      setMessageInput('');
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages((prev) => prev.filter((m) => m.messageId !== tempId));
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 rounded-full w-14 h-14 shadow-lg"
        size="lg"
      >
        <div className="relative">
          <MessageSquare className="w-6 h-6" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-2 -right-2 w-5 h-5 p-0 flex items-center justify-center text-xs">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </div>
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 w-96 shadow-2xl flex flex-col z-50" style={{ maxHeight: '600px' }}>
      <div className="p-4 border-b border-border flex items-center justify-between bg-gradient-to-r from-primary/10 to-secondary/10">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Messages</h3>
          {unreadCount > 0 && <Badge variant="default" className="ml-auto">{unreadCount}</Badge>}
        </div>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            title="Add contact"
            onClick={() => navigate(`${chatPathForRole(authUser?.role)}?open=add`)}
          >
            <UserPlus className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            title="Create group"
            onClick={() => navigate(`${chatPathForRole(authUser?.role)}?open=group`)}
          >
            <UsersRound className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setIsMinimized(!isMinimized)}>
            {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsOpen(false);
              setSelectedUser(null);
            }}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {!selectedUser ? (
            <ScrollArea className="flex-1">
              <div className="p-2">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : users.length > 0 ? (
                  users.map((chatUser) => (
                    <button
                      key={chatUser.id}
                      onClick={() => setSelectedUser(chatUser)}
                      className="w-full p-2 rounded-lg mb-1 text-left hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={chatUser.avatar} />
                            <AvatarFallback>{(chatUser.name || 'U').charAt(0)}</AvatarFallback>
                          </Avatar>
                          {chatUser.isOnline && (
                            <div className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border border-background" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{chatUser.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {chatUser.lastMessage || chatUser.email}
                          </p>
                        </div>
                        {chatUser.unreadCount > 0 && (
                          <Badge variant="default" className="text-xs">
                            {chatUser.unreadCount}
                          </Badge>
                        )}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm">No users available</div>
                )}
              </div>
            </ScrollArea>
          ) : (
            <>
              <div className="p-3 border-b border-border flex items-center justify-between bg-accent/50">
                <button
                  onClick={() => setSelectedUser(null)}
                  className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={selectedUser.avatar} />
                    <AvatarFallback>{(selectedUser.name || 'U').charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="text-left">
                    <p className="text-sm font-medium">{selectedUser.name}</p>
                    <p className="text-xs text-muted-foreground">Click to go back</p>
                  </div>
                </button>
              </div>

              <ScrollArea className="flex-1 p-3">
                <div className="space-y-2">
                  {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                      <p>No messages yet</p>
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.messageId}
                        className={`flex ${message.isOwn ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                            message.isOwn
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-accent text-accent-foreground'
                          }`}
                        >
                          <p>{message.content}</p>
                          <p className="text-xs opacity-70 mt-1">
                            {new Date(message.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              <div className="border-t border-border bg-card p-3">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Type message..."
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void handleSendMessage();
                      }
                    }}
                    className="text-sm h-8"
                  />
                  <Button
                    onClick={() => void handleSendMessage()}
                    disabled={!messageInput.trim() || sending}
                    size="sm"
                    className="h-8 w-8 p-0"
                  >
                    {sending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Send className="w-3 h-3" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </Card>
  );
}
