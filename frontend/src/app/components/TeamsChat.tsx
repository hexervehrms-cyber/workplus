import { useState, useEffect } from 'react';
import { MessageSquare, X, Send, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiPost } from '../utils/apiHelper';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface TeamsChatProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TeamsChat({ isOpen, onClose }: TeamsChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [teamsLoaded, setTeamsLoaded] = useState(false);

  useEffect(() => {
    if (isOpen && !teamsLoaded) {
      loadTeamsChat();
    }
  }, [isOpen, teamsLoaded]);

  const loadTeamsChat = async () => {
    try {
      setLoading(true);
      // Initialize Microsoft Teams Web App SDK
      if (window.microsoftTeams) {
        window.microsoftTeams.initialize();
        setTeamsLoaded(true);
      } else {
        // Load Teams SDK if not already loaded
        const script = document.createElement('script');
        script.src = 'https://res.cdn.office.net/teams-js/2.0.0/js/microsoft.teams.min.js';
        script.onload = () => {
          if (window.microsoftTeams) {
            window.microsoftTeams.initialize();
            setTeamsLoaded(true);
          }
        };
        document.head.appendChild(script);
      }
    } catch (error) {
      console.error('Failed to load Teams chat:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      // Add message to local state
      const message = {
        id: Date.now(),
        sender: user?.name || 'You',
        content: newMessage,
        timestamp: new Date().toISOString(),
        isOwn: true
      };

      // Use functional update to ensure we have the latest state
      setMessages(prev => [...prev, message]);
      setNewMessage('');

      // Send to backend to log/store
      await apiPost('teams/messages', {
        userId: user?.id,
        message: newMessage,
        timestamp: new Date().toISOString(),
      }).catch((err) => console.error('Failed to log message:', err));
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-0 right-0 w-96 h-96 bg-card border border-border rounded-t-lg shadow-2xl flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-primary text-primary-foreground rounded-t-lg">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          <h3 className="font-semibold">Microsoft Teams Chat</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-primary/80 rounded transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageSquare className="w-12 h-12 mb-2 opacity-50" />
            <p className="text-sm">No messages yet</p>
            <p className="text-xs mt-1">Start a conversation with your team</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.isOwn ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs px-3 py-2 rounded-lg ${
                  msg.isOwn
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-accent text-accent-foreground'
                }`}
              >
                <p className="text-xs font-semibold mb-1">{msg.sender}</p>
                <p className="text-sm">{msg.content}</p>
                <p className="text-xs opacity-70 mt-1">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-border bg-background">
        <div className="flex gap-2">
          <Input
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            className="flex-1"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!newMessage.trim()}
            size="sm"
            className="px-3"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          💡 Tip: Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

// Extend window interface for Teams SDK
declare global {
  interface Window {
    microsoftTeams: any;
  }
}
