import { useState } from 'react';
import { Send, Search, MoreVertical, Paperclip, Smile, Phone, Video } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { ScrollArea } from '../../components/ui/scroll-area';

const channels = [
  { id: 1, name: 'General', type: 'channel', unread: 3, active: false },
  { id: 2, name: 'Engineering', type: 'channel', unread: 0, active: false },
  { id: 3, name: 'Design Team', type: 'channel', unread: 5, active: false },
  { id: 4, name: 'HR Updates', type: 'channel', unread: 1, active: false },
];

const directMessages = [
  { id: 1, name: 'Sarah Johnson', avatar: 'SJ', status: 'online', unread: 2, active: true, lastMessage: 'Thanks for the update!' },
  { id: 2, name: 'Mike Chen', avatar: 'MC', status: 'away', unread: 0, active: false, lastMessage: 'See you tomorrow' },
  { id: 3, name: 'Emma Wilson', avatar: 'EW', status: 'offline', unread: 0, active: false, lastMessage: 'Perfect, let\'s do it' },
  { id: 4, name: 'Alex Brown', avatar: 'AB', status: 'online', unread: 1, active: false, lastMessage: 'Can we reschedule?' },
];

const messages = [
  { id: 1, sender: 'Sarah Johnson', avatar: 'SJ', message: 'Hey! Did you finish the presentation?', time: '10:30 AM', isOwn: false },
  { id: 2, sender: 'You', avatar: 'JD', message: 'Yes, just sent it over. Let me know what you think!', time: '10:32 AM', isOwn: true },
  { id: 3, sender: 'Sarah Johnson', avatar: 'SJ', message: 'Looks great! I made a few minor suggestions.', time: '10:35 AM', isOwn: false },
  { id: 4, sender: 'You', avatar: 'JD', message: 'Perfect, I\'ll review them now.', time: '10:36 AM', isOwn: true },
  { id: 5, sender: 'Sarah Johnson', avatar: 'SJ', message: 'Thanks for the update!', time: '10:40 AM', isOwn: false },
];

export default function Chat() {
  const [messageInput, setMessageInput] = useState('');
  const activeChat = directMessages.find(dm => dm.active);

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Sidebar */}
      <div className="w-80 border-r border-border bg-card flex flex-col">
        {/* Search */}
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search messages..."
              className="pl-10 rounded-xl bg-background/50"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          {/* Channels */}
          <div className="p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Channels</h3>
            <div className="space-y-1">
              {channels.map((channel) => (
                <button
                  key={channel.id}
                  className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors ${
                    channel.active ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                    <span className="font-medium">{channel.name}</span>
                  </div>
                  {channel.unread > 0 && (
                    <Badge variant="secondary" className="h-5 min-w-5 px-1.5">
                      {channel.unread}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Direct Messages */}
          <div className="p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Direct Messages</h3>
            <div className="space-y-1">
              {directMessages.map((dm) => (
                <button
                  key={dm.id}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                    dm.active ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                  }`}
                >
                  <div className="relative">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className={dm.active ? 'bg-primary-foreground text-primary' : ''}>
                        {dm.avatar}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 ${
                      dm.active ? 'border-primary' : 'border-card'
                    } ${
                      dm.status === 'online' ? 'bg-secondary' :
                      dm.status === 'away' ? 'bg-accent' :
                      'bg-muted'
                    }`} />
                  </div>
                  <div className="flex-1 text-left overflow-hidden">
                    <p className="font-medium truncate">{dm.name}</p>
                    <p className={`text-xs truncate ${dm.active ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                      {dm.lastMessage}
                    </p>
                  </div>
                  {dm.unread > 0 && (
                    <Badge variant="secondary" className="h-5 min-w-5 px-1.5">
                      {dm.unread}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-background">
        {/* Chat Header */}
        <div className="h-16 border-b border-border flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="w-10 h-10">
                <AvatarFallback>{activeChat?.avatar}</AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-background bg-secondary" />
            </div>
            <div>
              <h3 className="font-semibold">{activeChat?.name}</h3>
              <p className="text-xs text-muted-foreground">Active now</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="rounded-xl">
              <Phone className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="rounded-xl">
              <Video className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="rounded-xl">
              <MoreVertical className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-6">
          <div className="space-y-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.isOwn ? 'flex-row-reverse' : ''}`}
              >
                {!msg.isOwn && (
                  <Avatar className="w-10 h-10">
                    <AvatarFallback>{msg.avatar}</AvatarFallback>
                  </Avatar>
                )}
                <div className={`flex flex-col ${msg.isOwn ? 'items-end' : ''}`}>
                  <div className={`max-w-md p-4 rounded-2xl ${
                    msg.isOwn
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-accent rounded-bl-sm'
                  }`}>
                    {!msg.isOwn && (
                      <p className="text-xs font-semibold mb-1">{msg.sender}</p>
                    )}
                    <p className="text-sm">{msg.message}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 px-1">{msg.time}</p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Message Input */}
        <div className="p-6 border-t border-border">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <div className="relative">
                <Input
                  placeholder="Type a message..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  className="pr-24 py-6 rounded-2xl"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      setMessageInput('');
                    }
                  }}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl">
                    <Paperclip className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl">
                    <Smile className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
            <Button size="lg" className="rounded-2xl px-8">
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
