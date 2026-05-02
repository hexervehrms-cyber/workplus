import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { MessageSquare, Send, Search, Users, Building2, Phone, Mail, Loader2 } from 'lucide-react';
import { apiClient } from '../../utils/api';
import { toast } from 'sonner';

interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  avatar: string;
  lastMessage: string;
  lastMessageTime: string;
  isOnline: boolean;
  unreadCount: number;
}

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: string;
  isOwn: boolean;
}

export default function SuperAdminChat() {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Fetch admins and users as clients
  useEffect(() => {
    const fetchClients = async () => {
      try {
        setLoading(true);
        // Fetch all users to display as chat clients
        const response = await apiClient.get<any[]>('/users');
        
        if (response.data && Array.isArray(response.data)) {
          const formattedClients: Client[] = response.data
            .filter((user: any) => user.role !== 'super_admin' && user.role !== 'superadmin')
            .map((user: any) => ({
              id: user._id || user.id,
              name: user.name,
              company: user.organization || 'WorkPlus',
              email: user.email,
              phone: user.phone || 'N/A',
              avatar: user.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'U',
              lastMessage: 'Click to start conversation',
              lastMessageTime: 'Now',
              isOnline: user.isActive || false,
              unreadCount: 0
            }));
          setClients(formattedClients);
        }
      } catch (error: any) {
        console.error('Error fetching clients:', error);
        toast.error('Failed to load users');
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, []);

  // Fetch messages when client is selected
  useEffect(() => {
    if (selectedClient) {
      // In a real app, you would fetch messages from an API
      // For now, we'll initialize with an empty array
      setMessages([]);
    }
  }, [selectedClient]);

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.company.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSendMessage = async () => {
    if (message.trim() && selectedClient) {
      try {
        setSending(true);
        // In a real app, send message via API
        // await apiClient.post('/messages', { recipientId: selectedClient.id, message });
        
        const newMessage: Message = {
          id: Date.now().toString(),
          senderId: 'me',
          senderName: 'You',
          message: message.trim(),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isOwn: true
        };
        
        setMessages(prev => [...prev, newMessage]);
        setMessage('');
        toast.success('Message sent');
      } catch (error: any) {
        toast.error('Failed to send message');
      } finally {
        setSending(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="p-6 h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 h-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Client Chat</h1>
          <p className="text-muted-foreground">Communicate with clients across all organizations</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-200px)]">
        {/* Clients List */}
        <div className="lg:col-span-1">
          <Card className="h-full rounded-xl">
            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search clients..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="overflow-y-auto h-[calc(100%-80px)]">
              {filteredClients.map((client) => (
                <div
                  key={client.id}
                  onClick={() => setSelectedClient(client)}
                  className={`p-4 border-b cursor-pointer hover:bg-accent transition-colors ${
                    selectedClient?.id === client.id ? 'bg-accent' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="relative">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium">{client.avatar}</span>
                      </div>
                      {client.isOnline && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background"></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium truncate">{client.name}</p>
                        <span className="text-xs text-muted-foreground">{client.lastMessageTime}</span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate mb-1">{client.company}</p>
                      <p className="text-sm text-muted-foreground truncate">{client.lastMessage}</p>
                    </div>
                    {client.unreadCount > 0 && (
                      <div className="w-6 h-6 bg-destructive rounded-full flex items-center justify-center">
                        <span className="text-xs text-white">{client.unreadCount}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Chat Area */}
        <div className="lg:col-span-3">
          {selectedClient ? (
            <Card className="h-full rounded-xl flex flex-col">
              {/* Chat Header */}
              <div className="p-4 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium">{selectedClient.avatar}</span>
                    </div>
                    <div>
                      <p className="font-medium">{selectedClient.name}</p>
                      <p className="text-sm text-muted-foreground">{selectedClient.company}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm">
                      <Phone className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Mail className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No messages yet. Start the conversation!</p>
                    </div>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.isOwn ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-xl p-3 ${
                          msg.isOwn
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-accent'
                        }`}
                      >
                        <p className="text-sm">{msg.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">{msg.timestamp}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Message Input */}
              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Input
                    placeholder="Type your message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    className="flex-1"
                  />
                  <Button onClick={handleSendMessage} className="rounded-xl">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="h-full rounded-xl flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Select a Client</h3>
                <p className="text-muted-foreground">Choose a client from the list to start chatting</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
