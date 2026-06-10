import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Users, Plus, Search, Filter, Edit, Trash2, X, Eye, AlertCircle } from 'lucide-react';
import UserInfoModal from '../../components/UserInfoModal';
import { apiClient } from '../../utils/api';
import { safeInitials } from '../../utils/safeUi';
import { toast } from '../../utils/portalToast';
import { PasswordInput } from '../../components/PasswordInput';

interface GlobalUser {
  id?: string;
  _id?: string;
  name: string;
  email: string;
  role: string;
  organization?: string;
  status?: string;
  avatar: string;
  isActive?: boolean;
}

interface ApiUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  organization?: string;
  isActive?: boolean;
}

// Support multiple response formats from backend:
// 1. Direct array: ApiUser[]
// 2. Wrapped with users key: { users?: ApiUser[] }
// 3. Wrapped with data key: { data: ApiUser[] }
// 4. Full API response: { success, data: ApiUser[], pagination }
type UsersListResponse = ApiUser[] | { users?: ApiUser[] } | { data?: ApiUser[] };

export default function GlobalUsers() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingUser, setEditingUser] = useState<GlobalUser | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [showUserInfo, setShowUserInfo] = useState(false);
  const [selectedUser, setSelectedUser] = useState<GlobalUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<GlobalUser[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'employee',
    organization: ''
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await apiClient.get<UsersListResponse>('/api/users');
      if (response.success && response.data) {
        // Handle multiple response formats:
        // 1. Direct array from response.data
        // 2. Wrapped with users key: response.data.users
        // 3. Wrapped with data key: response.data.data
        let userList: ApiUser[] = [];
        
        if (Array.isArray(response.data)) {
          // Format 1: response.data is already an array
          userList = response.data;
        } else if (response.data.users) {
          // Format 2: response.data = { users: [...] }
          userList = response.data.users;
        } else if ((response.data as any).data && Array.isArray((response.data as any).data)) {
          // Format 3: response.data = { data: [...] }
          userList = (response.data as any).data;
        }
        
        const formattedUsers = userList.map((user) => ({
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          organization: user.organization || 'WorkPlus Inc.',
          status: user.isActive ? 'Active' : 'Inactive',
          avatar: safeInitials(user.name, 'U'),
          isActive: user.isActive
        }));
        setUsers(formattedUsers);
      }
    } catch (err) {
      console.error('Error loading users:', err);
    }
  };

  const handleAddUser = () => {
    setError(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'employee',
      organization: ''
    });
    setShowAddForm(true);
  };

  const handleCreateUser = async () => {
    if (!formData.name || !formData.email || !formData.password) {
      setError('Name, email, and password are required');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post<ApiUser>('/api/users', {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        organization: formData.organization || 'WorkPlus Inc.',
        isActive: true
      });

      if (response.success && response.data) {
        const userData = response.data;
        const newUser: GlobalUser = {
          _id: userData._id,
          name: userData.name,
          email: userData.email,
          role: userData.role,
          organization: userData.organization || 'WorkPlus Inc.',
          status: 'Active',
          avatar: safeInitials(formData.name, 'U'),
          isActive: true
        };
        
        setUsers([...users, newUser]);
        setShowAddForm(false);
        setFormData({
          name: '',
          email: '',
          password: '',
          role: 'employee',
          organization: ''
        });
        toast.success('User created successfully');
      }
    } catch (err: any) {
      console.error('Error creating user:', err);
      const errorMsg = err.response?.data?.message || err.message || 'Failed to create user';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (user: GlobalUser) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      organization: user.organization || ''
    });
    setShowEditForm(true);
  };

  const handleDeleteUser = (id: string) => {
    setDeletingUserId(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!deletingUserId) return;

    setLoading(true);
    try {
      const response = await apiClient.delete(`/api/users/${deletingUserId}`);
      if (response.success) {
        setUsers(users.filter(user => (user._id || user.id) !== deletingUserId));
        setShowDeleteConfirm(false);
        setDeletingUserId(null);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete user');
      console.error('Error deleting user:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser || !editingUser._id) return;

    if (!formData.name || !formData.email) {
      setError('Name and email are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const updateData: any = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        organization: formData.organization || 'WorkPlus Inc.'
      };

      if (formData.password && formData.password.length >= 6) {
        updateData.password = formData.password;
      }

      const response = await apiClient.put<ApiUser>(`/api/users/${editingUser._id}`, updateData);

      if (response.success && response.data) {
        const updatedData = response.data;
        setUsers(users.map(user => 
          user._id === editingUser._id 
            ? {
                ...user,
                name: updatedData.name,
                email: updatedData.email,
                role: updatedData.role,
                organization: updatedData.organization,
                avatar: safeInitials(updatedData.name, 'U')
              }
            : user
        ));
        setShowEditForm(false);
        setEditingUser(null);
        setFormData({
          name: '',
          email: '',
          password: '',
          role: 'employee',
          organization: ''
        });
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to update user';
      setError(errorMsg);
      console.error('Error updating user:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="p-6 space-y-6">
        {/* Add User Modal */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4 p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Add New User</h2>
                <button onClick={() => setShowAddForm(false)} disabled={loading}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg flex gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Full Name *</label>
                  <input
                    type="text"
                    placeholder="Enter user name..."
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-xl bg-background"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Email *</label>
                  <input
                    type="email"
                    placeholder="user@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-xl bg-background"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Password *</label>
                  <PasswordInput
                    autoComplete="new-password"
                    placeholder="Enter password (min 6 characters)"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-xl bg-background"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Role *</label>
                  <select 
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-xl bg-background" 
                    disabled={loading}
                  >
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="hr">HR</option>
                    <option value="admin">Admin</option>
                    <option value="accountant">Accountant</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Organization</label>
                  <input
                    type="text"
                    placeholder="Organization name..."
                    value={formData.organization}
                    onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-xl bg-background"
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <Button 
                  variant="outline" 
                  onClick={() => setShowAddForm(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateUser}
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? 'Creating...' : 'Create User'}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Edit User Modal */}
        {showEditForm && editingUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4 p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Edit User</h2>
                <button onClick={() => setShowEditForm(false)} disabled={loading}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg flex gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Full Name *</label>
                  <input
                    type="text"
                    placeholder="Enter user name..."
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-xl bg-background"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Email *</label>
                  <input
                    type="email"
                    placeholder="user@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-xl bg-background"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Password (leave blank to keep current)</label>
                  <PasswordInput
                    autoComplete="new-password"
                    placeholder="Enter new password (min 6 characters)"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-xl bg-background"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Role *</label>
                  <select 
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-xl bg-background" 
                    disabled={loading}
                  >
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="hr">HR</option>
                    <option value="admin">Admin</option>
                    <option value="accountant">Accountant</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Organization</label>
                  <input
                    type="text"
                    placeholder="Organization name..."
                    value={formData.organization}
                    onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-xl bg-background"
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <Button 
                  variant="outline" 
                  onClick={() => setShowEditForm(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleUpdateUser}
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? 'Updating...' : 'Update User'}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4 p-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-8 h-8 text-red-600" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Delete User</h2>
                <p className="text-muted-foreground mb-6">
                  Are you sure you want to delete this user? This action cannot be undone.
                </p>
                <div className="flex gap-2 justify-center">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeletingUserId(null);
                    }}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={confirmDelete}
                    disabled={loading}
                    className="rounded-xl"
                  >
                    {loading ? 'Deleting...' : 'Delete User'}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Global Users</h1>
            <p className="text-muted-foreground">Manage all users across all organizations</p>
          </div>
          <Button className="rounded-xl" onClick={handleAddUser}>
            <Plus className="w-4 h-4 mr-2" />
            Add User
          </Button>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search users..."
              className="w-full pl-10 pr-4 py-2 border rounded-xl bg-background"
            />
          </div>
          <Button variant="outline" className="rounded-xl">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
        </div>

        <Card className="rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-4">User</th>
                  <th className="text-left p-4">Email</th>
                  <th className="text-left p-4">Role</th>
                  <th className="text-left p-4">Organization</th>
                  <th className="text-left p-4">Status</th>
                  <th className="text-left p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user._id || user.id} className="border-b hover:bg-accent/50">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium">{user.avatar}</span>
                        </div>
                        <div>
                          <p className="font-medium">{user.name}</p>
                          <p className="text-sm text-muted-foreground">ID: {user._id?.toString().slice(-8) || user.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">{user.email}</td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                        {user.role}
                      </span>
                    </td>
                    <td className="p-4">{user.organization || 'WorkPlus Inc.'}</td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                        {user.status || 'Active'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user);
                            setShowUserInfo(true);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleEditUser(user)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-destructive"
                          onClick={() => handleDeleteUser(user._id || user.id?.toString() || '')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* User Info Modal */}
      {showUserInfo && selectedUser && (
        <UserInfoModal
          user={selectedUser}
          isOpen={showUserInfo}
          onClose={() => {
            setShowUserInfo(false);
            setSelectedUser(null);
          }}
        />
      )}
    </>
  );
}
