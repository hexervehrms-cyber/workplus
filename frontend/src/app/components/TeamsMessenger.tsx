/**
 * Microsoft Teams Integrated Messenger Component
 * Enables chat between admin and users with Teams synchronization
 */

import { useState, useEffect, useRef } from 'react';
import { Send, Search, MoreVertical, Paperclip, Smile, Phone, Video, Users, MessageSquare, Loader2, Check, CheckCheck } from 'lucide-react';
import { Card } from './ui/card';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { apiClient } from '../utils/api';
import { SocketService } from '../utils/socket';
import { toast } from 'sonner';

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
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [teamsEnabled, setTeamsEnabled] = useState(false);
  const [teamsChatId, setTeamsChatId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketService = useRef<SocketService | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

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
            const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
            
            // Only add message if it's from another user (not our own sent message)
            // Our sent messages are already added optimistically
            if (data.senderId !== currentUser.id) {
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
              // If it's our own message coming back, update the temp message with real ID
              setMessages(prev => prev.map(msg => {
                // Find temp message and replace with real one
                if (msg.messageId.startsWith('temp-') && msg.content === data.content) {
                  return {
                    ...msg,
                    messageId: data.messageId,
                    status: 'delivered',
                    timestamp: new Date(data.timestamp)
                  };
                }
                return msg;
              }));
            }
          });

          // Listen for message read receipts
          socketService.current.on('chat:message_read', (data) => {
            setMessages(prev => prev.map(msg =>
              msg.messageId === data.messageId ? { ...msg, status: 'read' } : msg
            ));
          });

          // Listen for typing indicators
          socketService.current.on('chat:user_typing', (data) => {
            if (data.userId === selectedUser?.id) {
              setIsTyping(data.isTyping);
            }
          });

          // Listen for message edits
          socketService.current.on('chat:message_edited', (data) => {
            setMessages(prev => prev.map(msg =>
              msg.messageId === data.messageId
                ? { ...msg, content: data.newContent }
                : msg
            ));
          });

          // Listen for message deletes
          socketService.current.on('chat:message_deleted', (data) => {
            setMessages(prev => prev.filter(msg => msg.messageId !== data.messageId));
          });

          // Get conversations
          socketService.current.emit('chat:get_conversations', {});
          socketService.current.on('chat:conversations', (data) => {
            setConversations(data.conversations);
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
  }, []);

  // Fetch users for chat with role-based filtering
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get<any[]>('/chat/users');

        if (response.data && Array.isArray(response.data)) {
          const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
          
          // Filter out Super Admin users and current user
          const formattedUsers: User[] = response.data
            .filter((user: any) => user.role !== 'super_admin' && user._id !== currentUser.id)
            .map((user: any) => ({
              id: user._id,
              name: user.name,
              email: user.email,
              role: user.role,
              avatar: user.avatar,
              isOnline: true,
              unreadCount: 0,
              lastMessage: '',
              lastMessageTime: ''
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
  }, []);

  // Load messages when user is selected
  useEffect(() => {
    if (selectedUser && socketService.current) {
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const conversationId = [currentUser.id, selectedUser.id].sort().join('_');
      
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
          isOwn: msg.senderId === currentUser.id,
          status: msg.status,
          teamsIntegration: msg.metadata?.teamsIntegration
        }));

        setMessages(formattedMessages.reverse());
      };

      socketService.current.on('chat:history', handleHistory);

      // Cleanup listener when component unmounts or user changes
      return () => {
        socketService.current?.off('chat:history', handleHistory);
      };
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
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      
      // Create the message object
      const newMessage: Message = {
        messageId: `temp-${Date.now()}`, // Temporary ID until server confirms
        senderId: currentUser.id,
        senderName: currentUser.name,
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
        teamsIntegration: {
          enabled: teamsEnabled,
          chatId: teamsChatId
        }
      });

      // Also send via API for persistence
      const response = await apiClient.post('/chat/messages', {
        recipientId: selectedUser.id,
        content: {
          text: messageToSend
        },
        messageType: 'text',
        teamsIntegration: {
          enabled: teamsEnabled,
          chatId: teamsChatId
        }
      });
      
      // Update the temporary message with the real message ID from server
      if (response.data?.messageId) {
        setMessages(prev => prev.map(msg => 
          msg.messageId === newMessage.messageId 
            ? { ...msg, messageId: response.data.messageId, status: 'delivered' }
            : msg
        ));
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

  // Create Teams chat
  const handleCreateTeamsChat = async () => {
    if (!selectedUser) return;

    try {
      const response = await apiClient.post('/chat/teams/create', {
        recipientId: selectedUser.id,
        topic: `Chat with ${selectedUser.name}`
      });

      if (response.data?.teamsChatId) {
        setTeamsChatId(response.data.teamsChatId);
        setTeamsEnabled(true);
        toast.success('Teams chat created successfully');
      }
    } catch (error) {
      console.error('Error creating Teams chat:', error);
      toast.error('Failed to create Teams chat');
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
                      ? 'bg-primary text-primary-foreground'
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
                  <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {teamsEnabled && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    <MessageSquare className="w-3 h-3 mr-1" />
                    Teams Connected
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCreateTeamsChat}
                  title="Connect to Microsoft Teams"
                >
                  <Users className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm">
                  <Phone className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm">
                  <Video className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="w-4 h-4" />
                </Button>
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
                        <p className="text-sm">{message.content}</p>
                        <div className="flex items-center gap-1 mt-1 text-xs opacity-90">
                          <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
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
                <Button variant="ghost" size="sm">
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
