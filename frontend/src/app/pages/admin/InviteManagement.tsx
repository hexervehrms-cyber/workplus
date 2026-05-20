import { useState, useEffect, useCallback } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import {
  Plus,
  Copy,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  Loader2,
} from 'lucide-react';
import { apiClient, ApiError } from '../../utils/api';
import { toast } from '../../utils/portalToast';
import { useAuth } from '../../context/AuthContext';
import { useDepartments } from '../../hooks/useDepartments';
import { apiPost } from '../../utils/apiHelper';

interface InviteLinkRow {
  id: string;
  token?: string;
  email: string;
  employeeName?: string;
  role?: string;
  department: string;
  status: 'pending' | 'completed' | 'expired';
  createdAt: string;
  expiresAt: string;
}

type ApiInviteLink = {
  id: string;
  token?: string;
  employeeEmail: string;
  employeeName?: string;
  department?: string;
  status: string;
  createdAt: string;
  expiresAt: string;
};

export default function InviteManagement() {
  const { user } = useAuth();
  const { departmentNames, loading: deptLoading } = useDepartments();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [inviteLinks, setInviteLinks] = useState<InviteLinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [newInvite, setNewInvite] = useState({
    email: '',
    employeeName: '',
    role: '',
    department: '',
    expirationDays: 7,
  });

  const mapApiStatus = (s: string): InviteLinkRow['status'] => {
    if (s === 'used') return 'completed';
    if (s === 'expired') return 'expired';
    return 'pending';
  };

  const loadLinks = useCallback(async () => {
    try {
      setLoading(true);
      const oid = user?.orgId || user?.tenantId;
      let url = '/onboarding/links?limit=100';
      if (user?.role === 'super_admin' && oid && oid !== 'system') {
        url += `&orgId=${encodeURIComponent(String(oid))}`;
      }
      const res = await apiClient.get<{ links?: ApiInviteLink[] }>(url);

      const rows: ApiInviteLink[] = res.data?.links ?? [];
      setInviteLinks(
        rows.map((link) => ({
          id: link.id,
          token: link.token,
          email: link.employeeEmail,
          employeeName: link.employeeName,
          department: link.department || '—',
          status: mapApiStatus(link.status),
          createdAt: link.createdAt,
          expiresAt: link.expiresAt,
        }))
      );
    } catch (err) {
      console.error('Failed to load invite links:', err);
      toast.error(err instanceof ApiError ? err.getUserMessage() : 'Failed to load invite links');
      setInviteLinks([]);
    } finally {
      setLoading(false);
    }
  }, [user?.orgId, user?.tenantId, user?.role]);

  useEffect(() => {
    void loadLinks();
  }, [loadLinks]);

  const generateInviteLink = async () => {
    if (!newInvite.email || !newInvite.employeeName || !newInvite.department) {
      toast.error('Email, employee name, and department are required');
      return;
    }

    setSubmitting(true);
    try {
      const oid = user?.orgId || user?.tenantId;
      const res = await apiClient.post<{
        token: string;
        employeeEmail: string;
        employeeName: string;
        expiresAt: string;
        onboardingUrl?: string;
      }>('/onboarding/generate-link', {
        employeeEmail: newInvite.email.trim(),
        employeeName: newInvite.employeeName.trim(),
        department: newInvite.department,
        ...(user?.role === 'super_admin' && oid && oid !== 'system'
          ? { organizationId: String(oid) }
          : {}),
      });

      if (!res.success || !res.data?.token) {
        throw new Error(res.message || 'Failed to generate link');
      }

      toast.success('Onboarding link created');
      setNewInvite({ email: '', employeeName: '', role: '', department: '', expirationDays: 7 });
      setShowCreateForm(false);
      await loadLinks();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.getUserMessage() : 'Failed to generate invite link');
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = (token: string) => {
    const inviteUrl = `${window.location.origin}/onboarding/${token}`;
    void navigator.clipboard.writeText(inviteUrl);
    toast.success('Link copied');
  };

  const sendInviteEmail = async (invite: InviteLinkRow) => {
    if (!invite.token) {
      toast.error('Token missing for this invite — regenerate the link');
      return;
    }
    const onboardingUrl = `${window.location.origin}/onboarding/${invite.token}`;
    setSubmitting(true);
    try {
      const data = await apiPost<{ message?: string }>(
        'onboarding/send-email',
        {
          token: invite.token,
          employeeEmail: invite.email,
          employeeName: invite.employeeName || invite.email,
          onboardingUrl,
        },
        { timeoutMs: 90_000 }
      );
      toast.success(data?.message || 'Invite email sent');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'expired':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'expired':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const isExpired = (expiresAt: string) => new Date() > new Date(expiresAt);

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Employee Invites</h1>
          <p className="text-muted-foreground">Generate and manage real onboarding invite links</p>
        </div>
        <Button type="button" className="rounded-xl" onClick={() => setShowCreateForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Invite
        </Button>
      </div>

      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg p-6">
            <h2 className="text-xl font-semibold mb-4">New onboarding invite</h2>
            <div className="space-y-4">
              <div>
                <Label>Employee email *</Label>
                <Input
                  type="email"
                  value={newInvite.email}
                  onChange={(e) => setNewInvite({ ...newInvite, email: e.target.value })}
                  className="mt-2 rounded-xl"
                />
              </div>
              <div>
                <Label>Employee name *</Label>
                <Input
                  value={newInvite.employeeName}
                  onChange={(e) => setNewInvite({ ...newInvite, employeeName: e.target.value })}
                  className="mt-2 rounded-xl"
                />
              </div>
              <div>
                <Label>Department *</Label>
                <select
                  value={newInvite.department}
                  onChange={(e) => setNewInvite({ ...newInvite, department: e.target.value })}
                  className="w-full mt-2 px-3 py-2 border rounded-xl bg-background"
                  disabled={deptLoading}
                >
                  <option value="">Select department</option>
                  {departmentNames.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setShowCreateForm(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={submitting}
                onClick={() => void generateInviteLink()}
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Generate link'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold">Generated links</h2>
          <Badge variant="secondary">{inviteLinks.length} total</Badge>
          <Button type="button" variant="outline" size="sm" onClick={() => void loadLinks()} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : inviteLinks.length === 0 ? (
          <Card className="p-12 text-center rounded-xl">
            <p className="text-muted-foreground">No invite links yet. Create one to onboard an employee.</p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {inviteLinks.map((invite) => (
              <Card key={invite.id} className="p-6 rounded-xl">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-3 mb-2">
                      <Users className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold">{invite.email}</h3>
                      <Badge className={getStatusColor(invite.status)}>
                        <span className="flex items-center gap-1">
                          {getStatusIcon(invite.status)}
                          {invite.status}
                        </span>
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {invite.employeeName || '—'} · {invite.department}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Created {formatDate(invite.createdAt)} · Expires {formatDate(invite.expiresAt)}
                    </p>
                  </div>
                  {invite.status === 'pending' && !isExpired(invite.expiresAt) && invite.token && (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(invite.token!)}
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Copy
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={submitting}
                        onClick={() => void sendInviteEmail(invite)}
                      >
                        <Send className="w-3 h-3 mr-1" />
                        Email
                      </Button>
                    </div>
                  )}
                </div>
                {invite.token && invite.status === 'pending' && !isExpired(invite.expiresAt) && (
                  <code className="text-xs block mt-3 p-2 bg-muted rounded break-all">
                    {window.location.origin}/onboarding/{invite.token}
                  </code>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
