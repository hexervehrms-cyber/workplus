import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiClient, ApiError } from '../../utils/api';
import { apiGet } from '../../utils/apiHelper';
import { OrgRequiredNotice } from '../../components/OrgRequiredNotice';
import { toast } from '../../utils/portalToast';
import { authUserKey } from '../../utils/safeUi';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Switch } from '../../components/ui/switch';
import { Eye, EyeOff, Loader2, Save, Edit2, X } from 'lucide-react';

interface AdminData {
  _id: string;
  name: string;
  email: string;
  role: string;
}

interface NotificationIntegrationsPayload {
  integrations?: {
    smtp?: Record<string, unknown> & { passConfigured?: boolean };
    teams?: { enabled?: boolean; webhookConfigured?: boolean };
  };
  notificationRouting?: {
    notifyAdminsOnLeaveSubmit?: boolean;
    notifyAdminsOnExpenseSubmit?: boolean;
    notifyEmployeeOnLeaveDecision?: boolean;
    notifyEmployeeOnExpenseDecision?: boolean;
    adminRoles?: string[];
  };
}

export default function AdminSettings() {
  const { user } = useAuth();
  const [admin, setAdmin] = useState<AdminData | null>(null);
  const [editedAdmin, setEditedAdmin] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const canManageOrgNotifications = ['admin', 'hr', 'super_admin'].includes(user?.role || '');
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifSaving, setNotifSaving] = useState(false);
  const [smtpPassConfigured, setSmtpPassConfigured] = useState(false);
  const [teamsWebhookConfigured, setTeamsWebhookConfigured] = useState(false);
  const [integrations, setIntegrations] = useState({
    smtp: {
      useCustom: false,
      host: '',
      port: 587,
      secure: false,
      user: '',
      pass: '',
      fromEmail: '',
      fromName: ''
    },
    teams: {
      enabled: false,
      webhookUrl: ''
    }
  });
  const [notificationRouting, setNotificationRouting] = useState({
    notifyAdminsOnLeaveSubmit: true,
    notifyAdminsOnExpenseSubmit: true,
    notifyEmployeeOnLeaveDecision: true,
    notifyEmployeeOnExpenseDecision: true,
    adminRoles: ['admin', 'hr', 'manager'] as string[]
  });

  // Fetch admin data
  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        setLoading(true);
        // Get admin info from user data
        if (user) {
          const adminData = {
            _id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
          };
          setAdmin(adminData);
          setEditedAdmin(adminData);
        }
      } catch (error) {
        console.error('Error fetching admin data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (authUserKey(user)) {
      fetchAdminData();
    }
  }, [user?.userId, user?.id]);

  useEffect(() => {
    const loadNotif = async () => {
      if (!canManageOrgNotifications || !authUserKey(user)) return;
      try {
        setNotifLoading(true);
        const res = await apiGet<{
          success?: boolean;
          data?: NotificationIntegrationsPayload;
        }>('/admin/notification-integrations');
        const d = res?.data;
        if (res?.success !== false && d) {
          const loadedIntegrations = d.integrations;
          if (loadedIntegrations) {
            setIntegrations((prev) => ({
              ...prev,
              smtp: {
                ...prev.smtp,
                ...(loadedIntegrations.smtp || {}),
                pass: ''
              },
              teams: {
                enabled: !!loadedIntegrations.teams?.enabled,
                webhookUrl: ''
              }
            }));
            setSmtpPassConfigured(!!loadedIntegrations.smtp?.passConfigured);
            setTeamsWebhookConfigured(!!loadedIntegrations.teams?.webhookConfigured);
          }
          const loadedRouting = d.notificationRouting;
          if (loadedRouting) {
            setNotificationRouting((prev) => ({
              ...prev,
              ...loadedRouting,
              adminRoles: loadedRouting.adminRoles?.length
                ? loadedRouting.adminRoles
                : prev.adminRoles
            }));
          }
        }
      } catch (e) {
        console.error(e);
        const err = e as { code?: string; status?: number; message?: string };
        const missingOrg =
          (e instanceof ApiError &&
            (e.code === 'MISSING_ORG_CONTEXT' || e.status === 403 || e.status === 400)) ||
          err.code === 'MISSING_ORG_CONTEXT' ||
          err.status === 403 ||
          err.status === 400;
        if (missingOrg) {
          toast.error(
            (e instanceof ApiError ? e.getUserMessage() : err.message) ||
              'Could not load notification settings. Try signing out and back in.'
          );
        }
      } finally {
        setNotifLoading(false);
      }
    };
    loadNotif();
  }, [user?.id, user?.role, canManageOrgNotifications]);

  const handleSaveAdminInfo = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editedAdmin?.name || !editedAdmin?.email) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      setSaving(true);

      const response = await apiClient.put<unknown>(`/users/${admin?._id}`, {
        name: editedAdmin.name,
        email: editedAdmin.email
      });

      if (response.success) {
        setAdmin(editedAdmin);
        setIsEditingInfo(false);
        toast.success('Admin information updated successfully');
      } else {
        toast.error('Failed to update admin information');
      }
    } catch (error: any) {
      console.error('Error updating admin info:', error);
      toast.error(error.response?.data?.message || 'Failed to update admin information');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotificationSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setNotifSaving(true);
      const smtpPayload: Record<string, unknown> = {
        useCustom: integrations.smtp.useCustom,
        host: integrations.smtp.host,
        port: Number(integrations.smtp.port) || 587,
        secure: integrations.smtp.secure,
        user: integrations.smtp.user,
        fromEmail: integrations.smtp.fromEmail,
        fromName: integrations.smtp.fromName
      };
      if (integrations.smtp.pass.trim()) {
        smtpPayload.pass = integrations.smtp.pass.trim();
      }
      const res = await apiClient.patch<NotificationIntegrationsPayload>('/admin/notification-integrations', {
        integrations: {
          smtp: smtpPayload,
          teams: {
            enabled: integrations.teams.enabled,
            webhookUrl: integrations.teams.webhookUrl.trim()
          }
        },
        notificationRouting
      });
      if (res.success) {
        toast.success('Notification settings saved');
        setIntegrations((p) => ({ ...p, smtp: { ...p.smtp, pass: '' } }));
        if (res.data?.integrations?.smtp?.passConfigured !== undefined) {
          setSmtpPassConfigured(!!res.data.integrations.smtp.passConfigured);
        }
        if (res.data?.integrations?.teams?.webhookConfigured !== undefined) {
          setTeamsWebhookConfigured(!!res.data.integrations.teams.webhookConfigured);
        }
      } else {
        toast.error(res.message || 'Save failed');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save notification settings');
    } finally {
      setNotifSaving(false);
    }
  };

  // Handle password reset
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      toast.error('Please fill in all password fields');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }

    try {
      setSaving(true);
      const response = await apiClient.post<unknown>('/auth/reset-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });

      if (response.success) {
        toast.success('Password reset successfully');
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
        setShowPasswordForm(false);
      }
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast.error(error.response?.data?.message || 'Failed to reset password');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <OrgRequiredNotice user={user} />
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-2">Manage your account settings and preferences</p>
        </div>

        {/* Admin Information Card */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-foreground">Admin Information</h2>
            {!isEditingInfo && (
              <Button
                onClick={() => setIsEditingInfo(true)}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </Button>
            )}
          </div>
          
          {admin && (
            <>
              {isEditingInfo ? (
                <form onSubmit={handleSaveAdminInfo} className="space-y-4">
                  {/* Name */}
                  <div>
                    <label className="text-sm font-medium text-foreground">Name</label>
                    <Input
                      type="text"
                      placeholder="Enter name"
                      value={editedAdmin?.name || ''}
                      onChange={(e) => setEditedAdmin({
                        ...editedAdmin!,
                        name: e.target.value
                      })}
                      className="mt-2"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="text-sm font-medium text-foreground">Email</label>
                    <Input
                      type="email"
                      placeholder="Enter email"
                      value={editedAdmin?.email || ''}
                      onChange={(e) => setEditedAdmin({
                        ...editedAdmin!,
                        email: e.target.value
                      })}
                      className="mt-2"
                    />
                  </div>

                  {/* Role (Read-only) */}
                  <div>
                    <label className="text-sm font-medium text-foreground">Role</label>
                    <p className="text-foreground mt-2 capitalize">{admin.role}</p>
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-3 pt-4">
                    <Button
                      type="submit"
                      disabled={saving}
                      className="flex items-center gap-2"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Save Changes
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsEditingInfo(false);
                        setEditedAdmin(admin);
                      }}
                      className="flex items-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Name</label>
                    <p className="text-foreground mt-1">{admin.name}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Email</label>
                    <p className="text-foreground mt-1">{admin.email}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Role</label>
                    <p className="text-foreground mt-1 capitalize">{admin.role}</p>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>

        {canManageOrgNotifications && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Notifications &amp; integrations</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Route leave and expense alerts to admins over email, in-app, and Microsoft Teams. Optional org SMTP overrides server defaults.
                </p>
              </div>
              {notifLoading && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
            </div>

            <form onSubmit={handleSaveNotificationSettings} className="space-y-6">
              <div className="space-y-3 rounded-lg border border-border p-4">
                <h3 className="text-sm font-semibold text-foreground">Who gets employee requests</h3>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={notificationRouting.notifyAdminsOnLeaveSubmit}
                      onCheckedChange={(v) =>
                        setNotificationRouting((p) => ({ ...p, notifyAdminsOnLeaveSubmit: v }))
                      }
                    />
                    Leave → admins
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={notificationRouting.notifyAdminsOnExpenseSubmit}
                      onCheckedChange={(v) =>
                        setNotificationRouting((p) => ({ ...p, notifyAdminsOnExpenseSubmit: v }))
                      }
                    />
                    Expense → admins
                  </label>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Admin roles (comma-separated)</label>
                  <Input
                    className="mt-1"
                    value={notificationRouting.adminRoles.join(', ')}
                    onChange={(e) =>
                      setNotificationRouting((p) => ({
                        ...p,
                        adminRoles: e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                      }))
                    }
                    placeholder="admin, hr, manager"
                  />
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Organization SMTP (optional)</h3>
                  <Switch
                    checked={integrations.smtp.useCustom}
                    onCheckedChange={(v) =>
                      setIntegrations((p) => ({ ...p, smtp: { ...p.smtp, useCustom: v } }))
                    }
                  />
                </div>
                {integrations.smtp.useCustom && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="text-sm font-medium">SMTP host</label>
                      <Input
                        className="mt-1"
                        value={integrations.smtp.host}
                        onChange={(e) =>
                          setIntegrations((p) => ({ ...p, smtp: { ...p.smtp, host: e.target.value } }))
                        }
                        placeholder="smtp.office365.com"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Port</label>
                      <Input
                        type="number"
                        className="mt-1"
                        value={integrations.smtp.port}
                        onChange={(e) =>
                          setIntegrations((p) => ({
                            ...p,
                            smtp: { ...p.smtp, port: Number(e.target.value) || 587 }
                          }))
                        }
                      />
                    </div>
                    <div className="flex items-end pb-2">
                      <label className="flex items-center gap-2 text-sm">
                        <Switch
                          checked={integrations.smtp.secure}
                          onCheckedChange={(v) =>
                            setIntegrations((p) => ({ ...p, smtp: { ...p.smtp, secure: v } }))
                          }
                        />
                        SSL (465)
                      </label>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Username</label>
                      <Input
                        className="mt-1"
                        value={integrations.smtp.user}
                        onChange={(e) =>
                          setIntegrations((p) => ({ ...p, smtp: { ...p.smtp, user: e.target.value } }))
                        }
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Password</label>
                      <Input
                        type="password"
                        className="mt-1"
                        autoComplete="new-password"
                        value={integrations.smtp.pass}
                        onChange={(e) =>
                          setIntegrations((p) => ({ ...p, smtp: { ...p.smtp, pass: e.target.value } }))
                        }
                        placeholder={smtpPassConfigured ? '•••••••• (leave blank to keep)' : ''}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">From email</label>
                      <Input
                        className="mt-1"
                        value={integrations.smtp.fromEmail}
                        onChange={(e) =>
                          setIntegrations((p) => ({ ...p, smtp: { ...p.smtp, fromEmail: e.target.value } }))
                        }
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">From name</label>
                      <Input
                        className="mt-1"
                        value={integrations.smtp.fromName}
                        onChange={(e) =>
                          setIntegrations((p) => ({ ...p, smtp: { ...p.smtp, fromName: e.target.value } }))
                        }
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3 rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Microsoft Teams (incoming webhook)</h3>
                  <Switch
                    checked={integrations.teams.enabled}
                    onCheckedChange={(v) =>
                      setIntegrations((p) => ({ ...p, teams: { ...p.teams, enabled: v } }))
                    }
                  />
                </div>
                {integrations.teams.enabled && (
                  <div>
                    <label className="text-sm font-medium">Webhook URL</label>
                    <Textarea
                      className="mt-1 font-mono text-xs"
                      rows={3}
                      value={integrations.teams.webhookUrl}
                      onChange={(e) =>
                        setIntegrations((p) => ({
                          ...p,
                          teams: { ...p.teams, webhookUrl: e.target.value }
                        }))
                      }
                      placeholder="https://outlook.office.com/webhook/..."
                    />
                    {teamsWebhookConfigured && !integrations.teams.webhookUrl && (
                      <p className="text-xs text-muted-foreground mt-1">
                        A webhook is already saved. Paste a new URL to replace it.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <Button type="submit" disabled={notifSaving || notifLoading} className="gap-2">
                {notifSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save notification settings
              </Button>
            </form>
          </Card>
        )}

        {/* Password Reset Card */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-foreground">Security</h2>
            {!showPasswordForm && (
              <Button
                onClick={() => setShowPasswordForm(true)}
                variant="outline"
              >
                Reset Password
              </Button>
            )}
          </div>

          {showPasswordForm && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              {/* Current Password */}
              <div>
                <label className="text-sm font-medium text-foreground">Current Password</label>
                <div className="relative mt-2">
                  <Input
                    type={showCurrentPassword ? 'text' : 'password'}
                    placeholder="Enter current password"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({
                      ...passwordData,
                      currentPassword: e.target.value
                    })}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="text-sm font-medium text-foreground">New Password</label>
                <div className="relative mt-2">
                  <Input
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="Enter new password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({
                      ...passwordData,
                      newPassword: e.target.value
                    })}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="text-sm font-medium text-foreground">Confirm Password</label>
                <div className="relative mt-2">
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm new password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({
                      ...passwordData,
                      confirmPassword: e.target.value
                    })}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Password
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowPasswordForm(false);
                    setPasswordData({
                      currentPassword: '',
                      newPassword: '',
                      confirmPassword: ''
                    });
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
