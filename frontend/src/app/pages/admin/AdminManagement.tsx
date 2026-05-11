import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Plus, Search, Filter, Edit, Trash2, X, Eye, AlertCircle, Loader2 } from 'lucide-react';
import { apiClient } from '../../utils/api';
import { toast } from 'sonner';

interface AdminUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  adminRole?: string;
  organization?: string;
  status?: string;
  avatar: string;
  isActive?: boolean;
}

export default function AdminManagement() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'admin',
    adminRole: 'manager' // Role/designation for the admin
  });

  useEffect(() => {
    loadAdmins();
  }, []);

  const loadAdmins = async () => {
    try {
      setPageLoading(true);
      const response = await apiClient.get('/api/users?role=admin');
      if (response.data) {
        const userList = Array.isArray(response.data) ? response.data : response.data.users || [];
        const formattedUsers = userList
          .filter((user: any) => user.role === 'admin')
          .map((user: any) => ({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            organization: user.organization || 'WorkPlus Inc.',
            status: user.isActive ? 'Active' : 'Inactive',
            avatar: user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase(),
            isActive: user.isActive
          }));
        setAdmins(formattedUsers);
      }
    } catch (err) {
      console.error('Error loading admins:', err);
    } finally {
      setPageLoading(false);
    }
  };

  const handleAddAdmin = () => {
    setError(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'admin',
      adminRole: 'manager'
    });
    setShowAddForm(true);
  };

  const handleCreateAdmin = async () => {
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
      const response = await apiClient.post('/api/users', {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: 'admin',
        adminRole: formData.adminRole,
        isActive: true
      });

      if (response.data) {
        const userData = response.data;
        const newAdmin: AdminUser = {
          _id: userData._id,
          name: userData.name,
          email: userData.email,
          role: userData.role,
          adminRole: formData.adminRole,
          organization: userData.organization || 'WorkPlus Inc.',
          status: 'Active',
          avatar: formData.name.split(' ').map((n: string) => n[0]).join('').toUpperCase(),
          isActive: true
        };
        
        setAdmins([...admins, newAdmin]);
        setShowAddForm(false);
        setFormData({
          name: '',
          email: '',
          password: '',
          role: 'admin',
          adminRole: 'manager'
        });
        toast.success('Admin user created successfully!');
      }
    } catch (err: any) {
      console.error('Error creating admin:', err);
      const errorMsg = err.response?.data?.message || err.message || 'Failed to create admin user';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleEditAdmin = (admin: AdminUser) => {
    setEditingUser(admin);
    setFormData({
      name: admin.name,
      email: admin.email,
      password: '',
      role: 'admin',
      adminRole: admin.adminRole || 'manager'
    });
    setShowEditForm(true);
  };

  const handleDeleteAdmin = (id: string) => {
    setDeletingUserId(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!deletingUserId) return;

    setLoading(true);
    try {
      const response = await apiClient.delete(`/api/users/${deletingUserId}`);
      if (response.success) {
        setAdmins(admins.filter(admin => admin._id !== deletingUserId));
        setShowDeleteConfirm(false);
        setDeletingUserId(null);
        toast.success('Admin user deleted successfully');
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to delete admin user';
      setError(errorMsg);
      toast.error(errorMsg);
      console.error('Error deleting admin:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAdmin = async () => {
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
        role: 'admin',
        adminRole: formData.adminRole
      };

      if (formData.password && formData.password.length >= 6) {
        updateData.password = formData.password;
      }

      const response = await apiClient.put(`/api/users/${editingUser._id}`, updateData);

      if (response.data) {
        const updatedData = response.data;
        setAdmins(admins.map(admin => 
          admin._id === editingUser._id 
            ? {
                ...admin,
                name: updatedData.name,
                email: updatedData.email,
                role: updatedData.role,
                adminRole: formData.adminRole,
                avatar: updatedData.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()
              }
            : admin
        ));
        setShowEditForm(false);
        setEditingUser(null);
        setFormData({
          name: '',
          email: '',
          password: '',
          role: 'admin',
          adminRole: 'manager'
        });
        toast.success('Admin user updated successfully');
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to update admin user';
      setError(errorMsg);
      toast.error(errorMsg);
      console.error('Error updating admin:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredAdmins = admins.filter(admin =>
    admin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    admin.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="p-6 space-y-6">
        {/* Add Admin Modal */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4 p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Add New Admin</h2>
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
                    placeholder="Enter admin name..."
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
                    placeholder="admin@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-xl bg-background"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Password *</label>
                  <input
                    type="password"
                    placeholder="Enter password (min 6 characters)"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-xl bg-background"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Admin Role *</label>
                  <select 
                    value={formData.adminRole}
                    onChange={(e) => setFormData({ ...formData, adminRole: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-xl bg-background" 
                    disabled={loading}
                  >
                    <option value="manager">Manager</option>
                    <option value="hr">HR</option>
                    <option value="accountant">Accountant</option>
                    <option value="recruiter">Recruiter</option>
                  </select>
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
                  onClick={handleCreateAdmin}
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Admin'
                  )}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Edit Admin Modal */}
        {showEditForm && editingUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4 p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Edit Admin</h2>
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
                    placeholder="Enter admin name..."
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
                    placeholder="admin@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-xl bg-background"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Password (leave blank to keep current)</label>
                  <input
                    type="password"
                    placeholder="Enter new password (min 6 characters)"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-xl bg-background"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Admin Role *</label>
                  <select 
                    value={formData.adminRole}
                    onChange={(e) => setFormData({ ...formData, adminRole: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-xl bg-background" 
                    disabled={loading}
                  >
                    <option value="manager">Manager</option>
                    <option value="hr">HR</option>
                    <option value="accountant">Accountant</option>
                    <option value="recruiter">Recruiter</option>
                  </select>
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
                  onClick={handleUpdateAdmin}
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update Admin'
                  )}
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
                <h2 className="text-xl font-semibold mb-2">Delete Admin</h2>
                <p className="text-muted-foreground mb-6">
                  Are you sure you want to delete this admin user? This action cannot be undone.
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
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      'Delete Admin'
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Admin Management</h1>
            <p className="text-muted-foreground">Create and manage admin users in your organization</p>
          </div>
          <Button className="rounded-xl" onClick={handleAddAdmin}>
            <Plus className="w-4 h-4 mr-2" />
            Add Admin
          </Button>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search admins..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-xl bg-background"
            />
          </div>
          <Button variant="outline" className="rounded-xl">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
        </div>

        {filteredAdmins.length > 0 ? (
          <Card className="rounded-xl">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-4">Admin Name</th>
                    <th className="text-left p-4">Email</th>
                    <th className="text-left p-4">Role</th>
                    <th className="text-left p-4">Admin Role</th>
                    <th className="text-left p-4">Status</th>
                    <th className="text-left p-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAdmins.map((admin) => (
                    <tr key={admin._id} className="border-b hover:bg-accent/50">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium">{admin.avatar}</span>
                          </div>
                          <div>
                            <p className="font-medium">{admin.name}</p>
                            <p className="text-sm text-muted-foreground">ID: {admin._id.toString().slice(-8)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">{admin.email}</td>
                      <td className="p-4">
                        <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full font-medium">
                          {admin.role.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium capitalize">
                          {admin.adminRole || 'Manager'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                          {admin.status || 'Active'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleEditAdmin(admin)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-destructive"
                            onClick={() => handleDeleteAdmin(admin._id)}
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
        ) : (
          <Card className="rounded-xl p-12 text-center">
            <div className="text-muted-foreground">
              <p className="text-lg font-medium mb-2">No admin users found</p>
              <p className="text-sm mb-4">Create your first admin user to get started</p>
              <Button onClick={handleAddAdmin}>
                <Plus className="w-4 h-4 mr-2" />
                Create Admin
              </Button>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
