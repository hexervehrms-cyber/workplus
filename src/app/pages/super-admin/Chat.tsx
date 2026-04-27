import { useState } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { MessageSquare, Send, Search, Users, Building2, Phone, Mail } from 'lucide-react';

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

  const mockClients: Client[] = [
    {
      id: '1',
      name: 'John Smith',
      company: 'Tech Corp',
      email: 'john@techcorp.com',
      phone: '+1 (555) 123-4567',
      avatar: 'JS',
      lastMessage: 'Thank you for the quick response!',
      lastMessageTime: '2 min ago',
      isOnline: true,
      unreadCount: 2
    },
    {
      id: '2',
      name: 'Sarah Johnson',
      company: 'Innovation Inc',
      email: 'sarah@innovation.com',
      phone: '+1 (555) 987-6543',
      avatar: 'SJ',
      lastMessage: 'Can we schedule a demo?',
      lastMessageTime: '1 hour ago',
      isOnline: false,
      unreadCount: 0
    },
    {
      id: '3',
      name: 'Michael Chen',
      company: 'Global Solutions',
      email: 'michael@globalsolutions.com',
      phone: '+1 (555) 456-7890',
      avatar: 'MC',
      lastMessage: 'The new features look great!',
      lastMessageTime: '3 hours ago',
      isOnline: true,
      unreadCount: 1
    }
  ];

  const mockMessages: Message[] = [
    {
      id: '1',
      senderId: '1',
      senderName: 'John Smith',
      message: 'Hi, I have a question about the enterprise plan.',
      timestamp: '10:30 AM',
      isOwn: false
    },
    {
      id: '2',
      senderId: 'me',
      senderName: 'You',
      message: 'Hello John! I\'d be happy to help with the enterprise plan. What specific questions do you have?',
      timestamp: '10:32 AM',
      isOwn: true
    },
    {
      id: '3',
      senderId: '1',
      senderName: 'John Smith',
      message: 'Thank you for the quick response!',
      timestamp: '10:35 AM',
      isOwn: false
    }
  ];

  const filteredClients = mockClients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.company.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSendMessage = () => {
    if (message.trim()) {
      // Send message logic here
      console.log('Sending message:', message);
      setMessage('');
    }
  };

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
                {mockMessages.map((msg) => (
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
                ))}
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
