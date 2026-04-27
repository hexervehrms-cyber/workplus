import { useState } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Separator } from '../../components/ui/separator';
import { 
  Link, 
  Plus, 
  Copy, 
  Mail, 
  Users, 
  Calendar, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Send,
  FileText,
  Shield,
  UserCheck
} from 'lucide-react';

interface InviteLink {
  id: string;
  token: string;
  email: string;
  role: string;
  department: string;
  status: 'pending' | 'completed' | 'expired';
  createdAt: string;
  expiresAt: string;
  sentAt?: string;
  completedAt?: string;
  employeeName?: string;
}

export default function InviteManagement() {
  console.log('InviteManagement component rendered');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [inviteLinks, setInviteLinks] = useState<InviteLink[]>([
    {
      id: '1',
      token: 'abc123xyz',
      email: 'john.doe@example.com',
      role: 'Software Engineer',
      department: 'Engineering',
      status: 'pending',
      createdAt: '2024-01-15T10:00:00Z',
      expiresAt: '2024-01-22T10:00:00Z',
      sentAt: '2024-01-15T10:05:00Z'
    },
    {
      id: '2',
      token: 'def456uvw',
      email: 'jane.smith@example.com',
      role: 'UX Designer',
      department: 'Design',
      status: 'completed',
      createdAt: '2024-01-10T09:00:00Z',
      expiresAt: '2024-01-17T09:00:00Z',
      sentAt: '2024-01-10T09:05:00Z',
      completedAt: '2024-01-12T14:30:00Z',
      employeeName: 'Jane Smith'
    },
    {
      id: '3',
      token: 'ghi789rst',
      email: 'mike.wilson@example.com',
      role: 'Product Manager',
      department: 'Product',
      status: 'expired',
      createdAt: '2024-01-05T08:00:00Z',
      expiresAt: '2024-01-12T08:00:00Z',
      sentAt: '2024-01-05T08:05:00Z'
    }
  ]);

  const [newInvite, setNewInvite] = useState({
    email: '',
    role: '',
    department: '',
    expirationDays: 7
  });

  // Test function to verify invite generation
  const testInviteGeneration = () => {
    console.log('Testing invite generation...');
    const testInvite = {
      email: 'test@example.com',
      role: 'Software Engineer',
      department: 'Engineering',
      expirationDays: 7
    };
    setNewInvite(testInvite);
    setShowCreateForm(true);
    console.log('Test invite form opened with:', testInvite);
  };

  const roleOptions = [
    'Software Engineer',
    'Product Manager',
    'UX Designer',
    'Data Analyst',
    'Marketing Manager',
    'HR Specialist',
    'Accountant',
    'Sales Representative'
  ];

  const departmentOptions = [
    'Engineering',
    'Product',
    'Design',
    'Analytics',
    'Marketing',
    'HR',
    'Finance',
    'Sales',
    'Operations'
  ];

  const generateInviteLink = () => {
    console.log('Generating invite link with data:', newInvite);
    
    if (!newInvite.email || !newInvite.role || !newInvite.department) {
      console.log('Validation failed:', {
        email: !!newInvite.email,
        role: !!newInvite.role,
        department: !!newInvite.department
      });
      return;
    }

    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + newInvite.expirationDays * 24 * 60 * 60 * 1000);

    const newLink: InviteLink = {
      id: Date.now().toString(),
      token,
      email: newInvite.email,
      role: newInvite.role,
      department: newInvite.department,
      status: 'pending',
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString()
    };

    console.log('New invite link created:', newLink);
    setInviteLinks([newLink, ...inviteLinks]);
    setNewInvite({
      email: '',
      role: '',
      department: '',
      expirationDays: 7
    });
    setShowCreateForm(false);
  };

  const copyToClipboard = (token: string) => {
    const inviteUrl = `${window.location.origin}/onboarding/${token}`;
    navigator.clipboard.writeText(inviteUrl);
  };

  const sendInviteEmail = (inviteId: string) => {
    const invite = inviteLinks.find(link => link.id === inviteId);
    if (invite) {
      const inviteUrl = `${window.location.origin}/onboarding/${invite.token}`;
      console.log('Sending invite email to:', invite.email);
      console.log('Invite URL:', inviteUrl);
      
      setInviteLinks(inviteLinks.map(link => 
        link.id === inviteId 
          ? { ...link, sentAt: new Date().toISOString() }
          : link
      ));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'expired': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'expired': return <XCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isExpired = (expiresAt: string) => {
    return new Date() > new Date(expiresAt);
  };

  return (
    <div className="p-8 space-y-8">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Employee Invites</h1>
          <p className="text-muted-foreground">Generate and manage employee onboarding invite links</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl" onClick={testInviteGeneration}>
            Test Invite
          </Button>
          <Button className="rounded-xl" onClick={() => setShowCreateForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Generate Invite Link
          </Button>
        </div>
      </div>

      {/* Create Invite Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Generate Invite Link</h2>
              <Button variant="ghost" onClick={() => setShowCreateForm(false)}>
                <XCircle className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Email Address</Label>
                <Input
                  type="email"
                  value={newInvite.email}
                  onChange={(e) => setNewInvite({...newInvite, email: e.target.value})}
                  placeholder="employee@company.com"
                  className="mt-2 rounded-xl"
                />
              </div>

              <div>
                <Label>Role</Label>
                <select
                  value={newInvite.role}
                  onChange={(e) => setNewInvite({...newInvite, role: e.target.value})}
                  className="w-full mt-2 px-3 py-2 border rounded-xl bg-background"
                >
                  <option value="">Select a role</option>
                  {roleOptions.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Department</Label>
                <select
                  value={newInvite.department}
                  onChange={(e) => setNewInvite({...newInvite, department: e.target.value})}
                  className="w-full mt-2 px-3 py-2 border rounded-xl bg-background"
                >
                  <option value="">Select a department</option>
                  {departmentOptions.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Expiration (Days)</Label>
                <Input
                  type="number"
                  value={newInvite.expirationDays}
                  onChange={(e) => setNewInvite({...newInvite, expirationDays: parseInt(e.target.value)})}
                  placeholder="7"
                  className="mt-2 rounded-xl"
                  min="1"
                  max="30"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowCreateForm(false)} className="rounded-xl">
                Cancel
              </Button>
              <Button 
                onClick={generateInviteLink}
                className="rounded-xl"
                disabled={!newInvite.email || !newInvite.role || !newInvite.department}
                type="button"
              >
                Generate Link
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Invite Links List */}
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold">Generated Links</h2>
          <Badge variant="secondary">{inviteLinks.length} total</Badge>
        </div>

        <div className="grid gap-4">
          {inviteLinks.map((invite) => (
            <Card key={invite.id} className="p-6 rounded-xl">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{invite.email}</h3>
                      <p className="text-sm text-muted-foreground">
                        {invite.role} - {invite.department}
                      </p>
                    </div>
                    <Badge className={getStatusColor(invite.status)}>
                      <div className="flex items-center gap-1">
                        {getStatusIcon(invite.status)}
                        {invite.status.charAt(0).toUpperCase() + invite.status.slice(1)}
                      </div>
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Created:</span>
                      <p className="font-medium">{formatDate(invite.createdAt)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Expires:</span>
                      <p className="font-medium">{formatDate(invite.expiresAt)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status:</span>
                      <p className="font-medium">
                        {invite.completedAt && `Completed: ${formatDate(invite.completedAt)}`}
                        {invite.sentAt && !invite.completedAt && `Sent: ${formatDate(invite.sentAt)}`}
                        {!invite.sentAt && !invite.completedAt && 'Not sent'}
                      </p>
                    </div>
                  </div>

                  {invite.employeeName && (
                    <div className="mt-3 p-3 bg-green-50 rounded-lg">
                      <p className="text-sm text-green-800">
                        <CheckCircle className="w-4 h-4 inline mr-1" />
                        Completed by: {invite.employeeName}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 ml-4">
                  {invite.status === 'pending' && !isExpired(invite.expiresAt) && (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => copyToClipboard(invite.token)}
                        className="rounded-lg"
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Copy Link
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => sendInviteEmail(invite.id)}
                        className="rounded-lg"
                      >
                        <Send className="w-3 h-3 mr-1" />
                        Send Email
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Invite Link Display */}
              {invite.status === 'pending' && !isExpired(invite.expiresAt) && (
                <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <code className="text-sm bg-background px-2 py-1 rounded">
                      {window.location.origin}/onboarding/{invite.token}
                    </code>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => copyToClipboard(invite.token)}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
