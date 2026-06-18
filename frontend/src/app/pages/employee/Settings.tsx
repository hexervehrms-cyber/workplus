import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../utils/api';
import { apiPut, clearApiCache } from '../../utils/apiHelper';
import { toast } from '../../utils/portalToast';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Eye, EyeOff, Loader2, Save, Pencil, X } from 'lucide-react';

interface EmployeeData {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  department?: string;
  designation?: string;
  employeeCode?: string;
}

interface EditForm {
  firstName: string;
  lastName: string;
  phone: string;
}

function mapEmployeeRecord(raw: Record<string, unknown>, fallbackEmail?: string): EmployeeData {
  const userRef = raw.userId as Record<string, unknown> | string | undefined;
  const userObj = userRef && typeof userRef === 'object' ? userRef : null;

  return {
    _id: String(raw._id || ''),
    firstName: String(raw.firstName || ''),
    lastName: String(raw.lastName || ''),
    email: String(userObj?.email || raw.email || fallbackEmail || ''),
    phone: String(raw.phone || ''),
    department: String(raw.department || ''),
    designation: String(raw.designation || ''),
    employeeCode: String(raw.employeeCode || raw.employeeId || ''),
  };
}

export default function EmployeeSettings() {
  const { user, setUser, logout } = useAuth();
  const [employee, setEmployee] = useState<EmployeeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    firstName: '',
    lastName: '',
    phone: '',
  });
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const fetchEmployeeData = useCallback(async () => {
    const authUserId = user?.userId || user?.id;
    if (!authUserId) return;

    try {
      setLoading(true);
      const response = await apiClient.get<Record<string, unknown>>(`/employees/user/${authUserId}`);
      const payload = response.data;
      if (payload && typeof payload === 'object') {
        const mapped = mapEmployeeRecord(payload, user.email);
        setEmployee(mapped);
        setEditForm({
          firstName: mapped.firstName,
          lastName: mapped.lastName,
          phone: mapped.phone || '',
        });
      }
    } catch (error) {
      console.error('Error fetching employee data:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.userId, user?.id, user?.email]);

  useEffect(() => {
    void fetchEmployeeData();
  }, [fetchEmployeeData]);

  const handleStartEdit = () => {
    if (employee) {
      setEditForm({
        firstName: employee.firstName,
        lastName: employee.lastName,
        phone: employee.phone || '',
      });
    }
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (employee) {
      setEditForm({
        firstName: employee.firstName,
        lastName: employee.lastName,
        phone: employee.phone || '',
      });
    }
    setIsEditing(false);
  };

  const handleSaveEmployeeInfo = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editForm.firstName.trim() || !editForm.lastName.trim()) {
      toast.error('First name and last name are required');
      return;
    }

    try {
      setSaving(true);
      const response = await apiPut<{
        success?: boolean;
        message?: string;
        data?: { user?: { name?: string }; employee?: EmployeeData };
      }>('/profile', {
        profile: {
          firstName: editForm.firstName.trim(),
          lastName: editForm.lastName.trim(),
        },
        contact: {
          phone: editForm.phone.trim(),
        },
        employeeDetails: {
          phone: editForm.phone.trim(),
        },
      });

      if (response?.success === false) {
        throw new Error(response.message || 'Failed to save changes');
      }

      const fullName = `${editForm.firstName.trim()} ${editForm.lastName.trim()}`;

      setEmployee((prev) =>
        prev
          ? {
              ...prev,
              firstName: editForm.firstName.trim(),
              lastName: editForm.lastName.trim(),
              phone: editForm.phone.trim(),
            }
          : null
      );

      if (user) {
        setUser({
          ...user,
          name: fullName,
        });
      }

      clearApiCache();
      setIsEditing(false);
      toast.success('Employee information updated');

      setTimeout(() => {
        void fetchEmployeeData();
      }, 400);
    } catch (error) {
      console.error('Error saving employee info:', error);
      const message = error instanceof Error ? error.message : 'Failed to save changes';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

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
      const response = await apiClient.post('/auth/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });

      if (response.success) {
        toast.success('Password changed successfully. Please login again.');
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
        setShowPasswordForm(false);

        // Backend has revoked tokens, so logout and redirect to login
        setTimeout(async () => {
          try {
            await logout();
          } catch (error) {
            console.error('Logout after password change failed:', error);
            // Force redirect to login even if logout errors
            window.location.href = '/login';
          }
        }, 1500);
      }
    } catch (error: unknown) {
      console.error('Error changing password:', error);
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      toast.error(err.response?.data?.message || err.message || 'Failed to change password');
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
        <div>
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-2">Manage your account settings and preferences</p>
        </div>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-foreground">Employee Information</h2>
            {employee && !isEditing && (
              <Button type="button" variant="outline" size="sm" className="gap-2" onClick={handleStartEdit}>
                <Pencil className="w-4 h-4" />
                Edit
              </Button>
            )}
          </div>

          {employee ? (
            isEditing ? (
              <form onSubmit={handleSaveEmployeeInfo} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={editForm.firstName}
                      onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                      className="mt-1"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={editForm.lastName}
                      onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                      className="mt-1"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label>Email</Label>
                  <p className="text-sm text-muted-foreground mt-1">{employee.email || 'Not set'}</p>
                  <p className="text-xs text-muted-foreground mt-1">Contact HR to change your email.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Employee Code</Label>
                    <p className="text-foreground mt-1">{employee.employeeCode || 'N/A'}</p>
                  </div>
                  <div>
                    <Label>Department</Label>
                    <p className="text-foreground mt-1">{employee.department || 'N/A'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Designation</Label>
                    <p className="text-foreground mt-1">{employee.designation || 'N/A'}</p>
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="mt-1"
                      placeholder="Phone number"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button type="submit" disabled={saving} className="gap-2">
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
                  <Button type="button" variant="outline" disabled={saving} onClick={handleCancelEdit} className="gap-2">
                    <X className="w-4 h-4" />
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">First Name</Label>
                    <p className="text-foreground mt-1">{employee.firstName}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Last Name</Label>
                    <p className="text-foreground mt-1">{employee.lastName}</p>
                  </div>
                </div>

                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <p className="text-foreground mt-1">{employee.email || 'Not set'}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Employee Code</Label>
                    <p className="text-foreground mt-1">{employee.employeeCode || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Department</Label>
                    <p className="text-foreground mt-1">{employee.department || 'N/A'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Designation</Label>
                    <p className="text-foreground mt-1">{employee.designation || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Phone</Label>
                    <p className="text-foreground mt-1">{employee.phone || 'N/A'}</p>
                  </div>
                </div>
              </div>
            )
          ) : (
            <p className="text-sm text-muted-foreground">Employee profile not found.</p>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-foreground">Security</h2>
            {!showPasswordForm && (
              <Button type="button" onClick={() => setShowPasswordForm(true)} variant="outline">
                Reset Password
              </Button>
            )}
          </div>

          {showPasswordForm && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <Label>Current Password</Label>
                <div className="relative mt-2">
                  <Input
                    type={showCurrentPassword ? 'text' : 'password'}
                    placeholder="Enter current password"
                    value={passwordData.currentPassword}
                    onChange={(e) =>
                      setPasswordData({
                        ...passwordData,
                        currentPassword: e.target.value,
                      })
                    }
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <Label>New Password</Label>
                <div className="relative mt-2">
                  <Input
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="Enter new password"
                    value={passwordData.newPassword}
                    onChange={(e) =>
                      setPasswordData({
                        ...passwordData,
                        newPassword: e.target.value,
                      })
                    }
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <Label>Confirm Password</Label>
                <div className="relative mt-2">
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm new password"
                    value={passwordData.confirmPassword}
                    onChange={(e) =>
                      setPasswordData({
                        ...passwordData,
                        confirmPassword: e.target.value,
                      })
                    }
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="submit" disabled={saving} className="flex items-center gap-2">
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
                      confirmPassword: '',
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
