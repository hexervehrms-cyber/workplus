import { useState } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Users, Plus, Search, Filter, Edit, Trash2, X, Eye } from 'lucide-react';
import UserInfoModal from '../../components/UserInfoModal';

interface GlobalUser {
  id: number;
  name: string;
  email: string;
  role: string;
  organization: string;
  status: string;
  avatar: string;
}

export default function GlobalUsers() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingUser, setEditingUser] = useState<GlobalUser | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const [showUserInfo, setShowUserInfo] = useState(false);
  const [selectedUser, setSelectedUser] = useState<GlobalUser | null>(null);
  
  const [users, setUsers] = useState<GlobalUser[]>([
    { id: 1, name: 'John Smith', email: 'john@techcorp.com', role: 'Super Admin', organization: 'Tech Corp', status: 'Active', avatar: 'JS' },
    { id: 2, name: 'Sarah Johnson', email: 'sarah@innovation.com', role: 'Admin', organization: 'Innovation Inc', status: 'Active', avatar: 'SJ' },
    { id: 3, name: 'Michael Chen', email: 'michael@globalsolutions.com', role: 'Employee', organization: 'Global Solutions', status: 'Active', avatar: 'MC' },
    { id: 4, name: 'Emma Wilson', email: 'emma@workplus.com', role: 'Manager', organization: 'WorkPlus', status: 'Active', avatar: 'EW' },
    { id: 5, name: 'David Brown', email: 'david@startup.com', role: 'Employee', organization: 'Startup Co', status: 'Active', avatar: 'DB' }
  ]);

  const handleAddUser = () => {
    setShowAddForm(true);
  };

  const handleEditUser = (user: GlobalUser) => {
    setEditingUser(user);
    setShowEditForm(true);
  };

  const handleDeleteUser = (id: number) => {
    setDeletingUserId(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    setUsers(users.filter(user => user.id !== deletingUserId));
    setShowDeleteConfirm(false);
    setDeletingUserId(null);
    console.log('User deleted:', deletingUserId);
  };

  const handleViewUser = (user: GlobalUser) => {
    setSelectedUser(user);
    setShowUserInfo(true);
  };

  const handleSaveUser = (newUser: GlobalUser) => {
    if (editingUser) {
      // Update existing user
      setUsers(users.map(user => 
        user.id === editingUser.id 
          ? { ...user, ...newUser }
          : user
      ));
      setShowEditForm(false);
      setEditingUser(null);
      console.log('User updated:', newUser);
    } else {
      // Add new user
      const newId = Math.max(...users.map(u => u.id)) + 1;
      setUsers([...users, {
        id: newId,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        organization: newUser.organization,
        status: 'Active',
        avatar: newUser.name.split(' ').map(n => n[0]).join('').toUpperCase()
      }]);
      setShowAddForm(false);
      console.log('New user added:', newUser);
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
              <Button variant="ghost" onClick={() => setShowAddForm(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Full Name</label>
                <input
                  type="text"
                  placeholder="Enter user name..."
                  className="w-full mt-1 px-3 py-2 border rounded-xl bg-background"
                  id="user-name"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <input
                  type="email"
                  placeholder="user@example.com"
                  className="w-full mt-1 px-3 py-2 border rounded-xl bg-background"
                  id="user-email"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Role</label>
                <select className="w-full mt-1 px-3 py-2 border rounded-xl bg-background" id="user-role">
                  <option>Super Admin</option>
                  <option>Admin</option>
                  <option>Manager</option>
                  <option>Employee</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Organization</label>
                <input
                  type="text"
                  placeholder="Organization name..."
                  className="w-full mt-1 px-3 py-2 border rounded-xl bg-background"
                  id="user-organization"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
              <Button onClick={() => {
                const newUser: GlobalUser = {
                  id: Math.max(...users.map(u => u.id)) + 1,
                  name: (document.getElementById('user-name') as HTMLInputElement).value,
                  email: (document.getElementById('user-email') as HTMLInputElement).value,
                  role: (document.getElementById('user-role') as HTMLSelectElement).value,
                  organization: (document.getElementById('user-organization') as HTMLInputElement).value,
                  status: 'Active',
                  avatar: (document.getElementById('user-name') as HTMLInputElement).value.split(' ').map(n => n[0]).join('').toUpperCase()
                };
                handleSaveUser(newUser);
              }}>
                Save User
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
              <Button variant="ghost" onClick={() => setShowEditForm(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Full Name</label>
                <input
                  type="text"
                  defaultValue={editingUser.name}
                  placeholder="Enter user name..."
                  className="w-full mt-1 px-3 py-2 border rounded-xl bg-background"
                  id="edit-user-name"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <input
                  type="email"
                  defaultValue={editingUser.email}
                  placeholder="user@example.com"
                  className="w-full mt-1 px-3 py-2 border rounded-xl bg-background"
                  id="edit-user-email"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Role</label>
                <select className="w-full mt-1 px-3 py-2 border rounded-xl bg-background" defaultValue={editingUser.role} id="edit-user-role">
                  <option>Super Admin</option>
                  <option>Admin</option>
                  <option>Manager</option>
                  <option>Employee</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Organization</label>
                <input
                  type="text"
                  defaultValue={editingUser.organization}
                  placeholder="Organization name..."
                  className="w-full mt-1 px-3 py-2 border rounded-xl bg-background"
                  id="edit-user-organization"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowEditForm(false)}>
                Cancel
              </Button>
              <Button onClick={() => {
                const updatedUser: GlobalUser = {
                  id: editingUser.id,
                  name: (document.getElementById('edit-user-name') as HTMLInputElement).value,
                  email: (document.getElementById('edit-user-email') as HTMLInputElement).value,
                  role: (document.getElementById('edit-user-role') as HTMLSelectElement).value,
                  organization: (document.getElementById('edit-user-organization') as HTMLInputElement).value,
                  status: 'Active',
                  avatar: (document.getElementById('edit-user-name') as HTMLInputElement).value.split(' ').map(n => n[0]).join('').toUpperCase()
                };
                handleSaveUser(updatedUser);
              }}>
                Update User
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
                <Button variant="outline" onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletingUserId(null);
                }}>
                  Cancel
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={confirmDelete}
                  className="rounded-xl"
                >
                  Delete User
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
                <tr key={user.id} className="border-b hover:bg-accent/50">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium">{user.avatar}</span>
                      </div>
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-sm text-muted-foreground">ID: 1000{user.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">{user.email}</td>
                  <td className="p-4">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                      {user.role}
                    </span>
                  </td>
                  <td className="p-4">{user.organization}</td>
                  <td className="p-4">
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                      {user.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleViewUser(user)}
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
                        onClick={() => handleDeleteUser(user.id)}
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
