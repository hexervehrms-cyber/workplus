/**
 * Compact Chat Widget for Dashboard Integration
 * Displays recent conversations and quick messaging
 */

import { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, X, Minimize2, Maximize2, Loader2 } from 'lucide-react';
import { Card } from './ui/card';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { apiClient } from '../utils/api';
import { SocketService } from '../utils/socket';
import { toast } from 'sonner';

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

export default function ChatWidget({ maxHeight = 'h-96', compact = true }: ChatWidgetProps) {
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
  const socketService = useRef<SocketService | null>(null);

  // Initialize Socket.IO connection
  useEffect(() => {
    const initSocket = async () => {
      try {
        socketService.current = new SocketService();
        const token = localStorage.getItem('authToken');
        const user = JSON.parse(localStorage.getItem('user') || '{}');

        if (token && user.id) {
          await socketService.current.connect(user.id, user.role, user.orgId);

          // Listen for new messages
          socketService.current.on('chat:new_message', (data) => {
            if (selectedUser?.id === data.senderId) {
              setMessages(prev => [...prev, {
                messageId: data.messageId,
                senderId: data.senderId,
                senderName: data.senderName,
                senderAvatar: data.senderAvatar,
                content: data.content,
                timestamp: new Date(data.timestamp),
                isOwn: false,
                status: 'delivered'
              }]);
            } else {
              // Update unread count for other users
              setUsers(prev => prev.map(u =>
                u.id === data.senderId
                  ? { ...u, unreadCount: u.unreadCount + 1, lastMessage: data.content, lastMessageTime: new Date().toLocaleTimeString() }
                  : u
              ));
              setUnreadCount(prev => prev + 1);
            }
          });

          // Listen for message read receipts
          socketService.current.on('chat:message_read', (data) => {
            setMessages(prev => prev.map(msg =>
              msg.messageId === data.messageId ? { ...msg, status: 'read' } : msg
            ));
          });
        }
      } catch (error) {
        console.error('Socket initialization failed:', error);
      }
    };

    initSocket();

    return () => {
      if (socketService.current) {
        socketService.current.disconnect();
      }
    };
  }, [selectedUser?.id]);

  // Fetch users for chat with role-based filtering
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get<any[]>('/chat/users');

        if (response.data && Array.isArray(response.data)) {
          const formattedUsers: ChatUser[] = response.data.map((user: any) => ({
            id: user._id,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
            isOnline: true,
            unreadCount: 0,
            lastMessage: '',
            lastMessageTime: ''
          }));

          setUsers(formattedUsers);
          const totalUnread = formattedUsers.reduce((sum, u) => sum + u.unreadCount, 0);
          setUnreadCount(totalUnread);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // Load messages when user is selected
  useEffect(() => {
    if (selectedUser && socketService.current) {
      const conversationId = [localStorage.getItem('userId'), selectedUser.id].sort().join('_');
      socketService.current.emit('chat:get_history', {
        conversationId,
        page: 1,
        limit: 20
      });

      socketService.current.on('chat:history', (data) => {
        const formattedMessages: ChatMessage[] = data.messages.map((msg: any) => ({
          messageId: msg._id,
          senderId: msg.senderId,
          senderName: msg.sender?.name || 'Unknown',
          senderAvatar: msg.sender?.avatar,
          content: msg.content?.text || '',
          timestamp: new Date(msg.createdAt),
          isOwn: msg.senderId === localStorage.getItem('userId'),
          status: msg.status
        }));

        setMessages(formattedMessages.reverse());
      });

      // Clear unread count for selected user
      setUsers(prev => prev.map(u =>
        u.id === selectedUser.id ? { ...u, unreadCount: 0 } : u
      ));
    }
  }, [selectedUser]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle sending message
  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedUser || !socketService.current) return;

    try {
      setSending(true);

      // Send via Socket.IO for real-time delivery
      socketService.current.emit('chat:send_message', {
        recipientId: selectedUser.id,
        content: messageInput,
        messageType: 'text'
      });

      // Also send via API for persistence
      await apiClient.post('/chat/messages', {
        recipientId: selectedUser.id,
        content: {
          text: messageInput
        },
        messageType: 'text'
      });

      setMessageInput('');
    } catch (error) {
      console.error('Error sending message:', error);
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
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between bg-gradient-to-r from-primary/10 to-secondary/10">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Messages</h3>
          {unreadCount > 0 && (
            <Badge variant="default" className="ml-auto">{unreadCount}</Badge>
          )}
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMinimized(!isMinimized)}
          >
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
            // Users List
            <ScrollArea className="flex-1">
              <div className="p-2">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : users.length > 0 ? (
                  users.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => setSelectedUser(user)}
                      className="w-full p-2 rounded-lg mb-1 text-left hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.avatar} />
                            <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          {user.isOnline && (
                            <div className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border border-background" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{user.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.lastMessage || user.email}</p>
                        </div>
                        {user.unreadCount > 0 && (
                          <Badge variant="default" className="text-xs">{user.unreadCount}</Badge>
                        )}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No users available
                  </div>
                )}
              </div>
            </ScrollArea>
          ) : (
            // Chat View
            <>
              {/* Chat Header */}
              <div className="p-3 border-b border-border flex items-center justify-between bg-accent/50">
                <button
                  onClick={() => setSelectedUser(null)}
                  className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={selectedUser.avatar} />
                    <AvatarFallback>{selectedUser.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="text-left">
                    <p className="text-sm font-medium">{selectedUser.name}</p>
                    <p className="text-xs text-muted-foreground">Click to go back</p>
                  </div>
                </button>
              </div>

              {/* Messages */}
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
                            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Message Input */}
              <div className="border-t border-border bg-card p-3">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Type message..."
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    className="text-sm h-8"
                  />
                  <Button
                    onClick={handleSendMessage}
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
