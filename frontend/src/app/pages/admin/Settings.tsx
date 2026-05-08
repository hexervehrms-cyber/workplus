import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../utils/api';
import { toast } from 'sonner';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Eye, EyeOff, Loader2, Save, Edit2, X } from 'lucide-react';

interface AdminData {
  _id: string;
  name: string;
  email: string;
  role: string;
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
        toast.error('Failed to load admin information');
      } finally {
        setLoading(false);
      }
    };

    if (user?.id) {
      fetchAdminData();
    }
  }, [user]);

  // Handle save admin information
  const handleSaveAdminInfo = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editedAdmin?.name || !editedAdmin?.email) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      setSaving(true);
      
      const response = await apiClient.put(`/users/${admin?._id}`, {
        name: editedAdmin.name,
        email: editedAdmin.email
      });

      // Backend returns { success: true, message: "...", data: {...} }
      if (response.data?.success) {
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
      const response = await apiClient.post('/auth/reset-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });

      if (response.data?.success) {
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
      <div className="max-w-2xl mx-auto space-y-6">
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
