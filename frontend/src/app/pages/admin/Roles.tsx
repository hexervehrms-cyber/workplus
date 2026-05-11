import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Checkbox } from '../../components/ui/checkbox';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Shield, 
  Calculator, 
  UserCheck, 
  Settings,
  FileText,
  AlertCircle,
  Loader
} from 'lucide-react';
import { PERMISSIONS, ROLES, Role, Permission } from '../../utils/roles';
import { useAuth } from '../../context/AuthContext';
import { apiGet, apiPost, apiPut, apiDelete } from '../../utils/apiHelper';

interface CustomRole extends Role {
  isCustom?: boolean;
  selectedPermissions?: string[];
}

export default function AdminRoles() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newRole, setNewRole] = useState({
    name: '',
    description: '',
    level: 50,
    selectedPermissions: [] as string[]
  });

  const permissionCategories = [
    {
      name: 'Dashboard',
      permissions: [PERMISSIONS.VIEW_DASHBOARD]
    },
    {
      name: 'Employee Management',
      permissions: [
        PERMISSIONS.VIEW_EMPLOYEES,
        PERMISSIONS.ADD_EMPLOYEES,
        PERMISSIONS.EDIT_EMPLOYEES,
        PERMISSIONS.DELETE_EMPLOYEES
      ]
    },
    {
      name: 'Department Management',
      permissions: [
        PERMISSIONS.VIEW_DEPARTMENTS,
        PERMISSIONS.ADD_DEPARTMENTS,
        PERMISSIONS.EDIT_DEPARTMENTS,
        PERMISSIONS.DELETE_DEPARTMENTS
      ]
    },
    {
      name: 'Expense Management',
      permissions: [
        PERMISSIONS.VIEW_EXPENSES,
        PERMISSIONS.ADD_EXPENSES,
        PERMISSIONS.EDIT_EXPENSES,
        PERMISSIONS.DELETE_EXPENSES,
        PERMISSIONS.APPROVE_EXPENSES
      ]
    },
    {
      name: 'Accounting & Finance',
      permissions: [
        PERMISSIONS.VIEW_ACCOUNTING,
        PERMISSIONS.MANAGE_PAYROLL,
        PERMISSIONS.MANAGE_TAXES,
        PERMISSIONS.VIEW_FINANCIAL_REPORTS,
        PERMISSIONS.MANAGE_BILLING
      ]
    },
    {
      name: 'Profile Management',
      permissions: [
        PERMISSIONS.VIEW_PROFILE,
        PERMISSIONS.EDIT_PROFILE
      ]
    },
    {
      name: 'System Administration',
      permissions: [
        PERMISSIONS.VIEW_SYSTEM_LOGS,
        PERMISSIONS.MANAGE_SETTINGS
      ]
    }
  ];

  // Load roles on mount
  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await apiGet('/roles');
      const rolesData = result.data || result.roles || [];
      
      // Convert to CustomRole format and filter out super admin
      const formattedRoles = rolesData
        .filter((role: any) => role.id !== 'SUPER_ADMIN' && role.name !== 'Super Admin')
        .map((role: any) => ({
          id: role.id || role._id,
          name: role.name,
          description: role.description,
          level: role.level || 50,
          permissions: role.permissions || [],
          isCustom: role.isCustom || false
        }));

      setRoles(formattedRoles);
    } catch (err) {
      console.error('Error loading roles:', err);
      setError('Failed to load roles. Using default roles.');
      // Fallback to default roles (excluding super admin)
      const defaultRoles = Object.values(ROLES).filter(role => role.id !== 'SUPER_ADMIN');
      setRoles(defaultRoles);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async () => {
    if (!newRole.name || !newRole.description || newRole.selectedPermissions.length === 0) {
      setError('Please fill in all fields and select at least one permission');
      return;
    }

    try {
      setError(null);
      
      const rolePermissions = newRole.selectedPermissions.map(id => 
        Object.values(PERMISSIONS).find(p => p.id === id)
      ).filter(Boolean) as Permission[];

      await apiPost('/roles', {
        name: newRole.name,
        description: newRole.description,
        level: newRole.level,
        permissions: rolePermissions
      });

      if (!response.ok) {
        throw new Error('Failed to create role');
      }

      const result = await response.json();
      const createdRole: CustomRole = {
        id: result.data?.id || result.data?._id || `CUSTOM_${Date.now()}`,
        name: newRole.name,
        description: newRole.description,
        level: newRole.level,
        permissions: rolePermissions,
        isCustom: true
      };

      setRoles([...roles, createdRole]);
      setNewRole({
        name: '',
        description: '',
        level: 50,
        selectedPermissions: []
      });
      setShowCreateForm(false);
    } catch (err) {
      console.error('Error creating role:', err);
      setError('Failed to create role. Please try again.');
    }
  };

  const handleEditRole = (role: CustomRole) => {
    setEditingRole({
      ...role,
      selectedPermissions: role.permissions.map(p => p.id)
    });
    setShowCreateForm(true);
  };

  const handleUpdateRole = async () => {
    if (!editingRole || !editingRole.name || !editingRole.description) {
      setError('Please fill in all fields');
      return;
    }

    try {
      setError(null);
      
      const updatedPermissions = editingRole.selectedPermissions?.map(id => 
        Object.values(PERMISSIONS).find(p => p.id === id)
      ).filter(Boolean) as Permission[] || editingRole.permissions;

      await apiPut(`/roles/${editingRole.id}`, {
        name: editingRole.name,
        description: editingRole.description,
        level: editingRole.level,
        permissions: updatedPermissions
      });

      const updatedRole: CustomRole = {
        ...editingRole,
        permissions: updatedPermissions
      };

      setRoles(roles.map(r => r.id === editingRole.id ? updatedRole : r));
      setEditingRole(null);
      setShowCreateForm(false);
    } catch (err) {
      console.error('Error updating role:', err);
      setError('Failed to update role. Please try again.');
    }
  };

  const handleDeleteRole = (roleId: string) => {
    setDeletingRoleId(roleId);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!deletingRoleId) return;

    try {
      setError(null);
      
      await apiDelete(`/roles/${deletingRoleId}`);

      setRoles(roles.filter(r => r.id !== deletingRoleId));
      setShowDeleteConfirm(false);
      setDeletingRoleId(null);
    } catch (err) {
      console.error('Error deleting role:', err);
      setError('Failed to delete role. Please try again.');
    }
  };

  const handlePermissionToggle = (permissionId: string, isChecked: boolean) => {
    if (showCreateForm) {
      if (editingRole) {
        const updatedPermissions = isChecked
          ? [...(editingRole.selectedPermissions || []), permissionId]
          : (editingRole.selectedPermissions || []).filter(id => id !== permissionId);
        
        setEditingRole({
          ...editingRole,
          selectedPermissions: updatedPermissions
        });
      } else {
        const updatedPermissions = isChecked
          ? [...newRole.selectedPermissions, permissionId]
          : newRole.selectedPermissions.filter(id => id !== permissionId);
        
        setNewRole({
          ...newRole,
          selectedPermissions: updatedPermissions
        });
      }
    }
  };

  const getRoleIcon = (roleId: string) => {
    switch (roleId) {
      case 'ADMIN': return <Shield className="w-4 h-4" />;
      case 'ACCOUNTANT': return <Calculator className="w-4 h-4" />;
      case 'MANAGER': return <UserCheck className="w-4 h-4" />;
      case 'EMPLOYEE': return <Settings className="w-4 h-4" />;
      default: return <Settings className="w-4 h-4" />;
    }
  };

  const getRoleColor = (roleId: string) => {
    switch (roleId) {
      case 'ADMIN': return 'bg-purple-100 text-purple-800';
      case 'ACCOUNTANT': return 'bg-blue-100 text-blue-800';
      case 'MANAGER': return 'bg-green-100 text-green-800';
      case 'EMPLOYEE': return 'bg-gray-100 text-gray-800';
      default: return 'bg-orange-100 text-orange-800';
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground"></p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Role Management</h1>
          <p className="text-muted-foreground">View and manage organization roles</p>
        </div>
        <Button className="rounded-xl" onClick={() => setShowCreateForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create New Role
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">Error</h3>
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Create/Edit Role Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto mx-4 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">
                {editingRole ? 'Edit Role' : 'Create New Role'}
              </h2>
              <Button variant="ghost" onClick={() => {
                setShowCreateForm(false);
                setEditingRole(null);
                setNewRole({
                  name: '',
                  description: '',
                  level: 50,
                  selectedPermissions: []
                });
              }}>
                ✕
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Role Information */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg mb-4">Role Information</h3>
                
                <div>
                  <Label>Role Name</Label>
                  <Input
                    value={editingRole ? editingRole.name : newRole.name}
                    onChange={(e) => editingRole 
                      ? setEditingRole({...editingRole, name: e.target.value})
                      : setNewRole({...newRole, name: e.target.value})
                    }
                    placeholder="Enter role name..."
                    className="mt-2 rounded-xl"
                  />
                </div>

                <div>
                  <Label>Description</Label>
                  <textarea
                    value={editingRole ? editingRole.description : newRole.description}
                    onChange={(e) => editingRole
                      ? setEditingRole({...editingRole, description: e.target.value})
                      : setNewRole({...newRole, description: e.target.value})
                    }
                    placeholder="Describe the role responsibilities..."
                    className="w-full mt-2 px-3 py-2 border rounded-xl bg-background min-h-[100px]"
                  />
                </div>

                <div>
                  <Label>Access Level</Label>
                  <Input
                    type="number"
                    value={editingRole ? editingRole.level : newRole.level}
                    onChange={(e) => editingRole
                      ? setEditingRole({...editingRole, level: parseInt(e.target.value)})
                      : setNewRole({...newRole, level: parseInt(e.target.value)})
                    }
                    placeholder="50"
                    className="mt-2 rounded-xl"
                    min="1"
                    max="100"
                  />
                </div>

                <div className="text-sm text-muted-foreground">
                  <p>• Higher numbers = more access</p>
                  <p>• Admin = 80, Manager = 60</p>
                </div>
              </div>

              {/* Permissions Selection */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="font-semibold text-lg mb-4">Permissions</h3>
                
                <div className="space-y-6">
                  {permissionCategories.map((category) => (
                    <div key={category.name} className="border rounded-xl p-4">
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        {category.name}
                      </h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {category.permissions.map((permission) => {
                          const currentPermissions = editingRole 
                            ? editingRole.selectedPermissions || []
                            : newRole.selectedPermissions;
                          
                          const isChecked = currentPermissions.includes(permission.id);

                          return (
                            <div key={permission.id} className="flex items-center space-x-2 p-2 rounded-lg hover:bg-accent/50">
                              <Checkbox
                                id={permission.id}
                                checked={isChecked}
                                onCheckedChange={(checked) => handlePermissionToggle(permission.id, checked as boolean)}
                              />
                              <div className="flex-1">
                                <Label 
                                  htmlFor={permission.id} 
                                  className="text-sm font-medium cursor-pointer"
                                >
                                  {permission.name}
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                  {permission.description}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Permission Summary */}
                <div className="mt-4 p-4 bg-muted/50 rounded-xl">
                  <h4 className="font-medium mb-2">Selected Permissions Summary</h4>
                  <div className="flex flex-wrap gap-2">
                    {(editingRole ? editingRole.selectedPermissions : newRole.selectedPermissions)?.map((permId) => {
                      const permission = Object.values(PERMISSIONS).find(p => p.id === permId);
                      return permission ? (
                        <Badge key={permId} variant="secondary" className="text-xs">
                          {permission.name}
                        </Badge>
                      ) : null;
                    }) || []}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => {
                setShowCreateForm(false);
                setEditingRole(null);
                setNewRole({
                  name: '',
                  description: '',
                  level: 50,
                  selectedPermissions: []
                });
              }}>
                Cancel
              </Button>
              <Button 
                onClick={editingRole ? handleUpdateRole : handleCreateRole}
                className="rounded-xl"
                disabled={!((editingRole ? editingRole.name : newRole.name) && 
                         ((editingRole ? editingRole.selectedPermissions : newRole.selectedPermissions)?.length > 0))}
              >
                {editingRole ? 'Update Role' : 'Create Role'}
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
              <h2 className="text-xl font-semibold mb-2">Delete Role</h2>
              <p className="text-muted-foreground mb-6">
                Are you sure you want to delete this role? This action cannot be undone.
              </p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletingRoleId(null);
                }}>
                  Cancel
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={confirmDelete}
                  className="rounded-xl"
                >
                  Delete Role
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Roles List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {roles.map((role) => (
          <Card key={role.id} className="p-6 rounded-xl">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getRoleColor(role.id)}`}>
                  {getRoleIcon(role.id)}
                </div>
                <div>
                  <h3 className="font-semibold">{role.name}</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Level {role.level}</span>
                    {role.isCustom && (
                      <Badge variant="outline" className="text-xs">Custom</Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                {role.isCustom && (
                  <>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleEditRole(role)}
                      className="rounded-lg"
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleDeleteRole(role.id)}
                      className="rounded-lg text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            <p className="text-sm text-muted-foreground mb-4">{role.description}</p>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Permissions</span>
                <span className="font-medium">{role.permissions.length}</span>
              </div>
              
              <div className="flex flex-wrap gap-1">
                {role.permissions.slice(0, 3).map((permission) => (
                  <Badge key={permission.id} variant="secondary" className="text-xs">
                    {permission.name}
                  </Badge>
                ))}
                {role.permissions.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{role.permissions.length - 3} more
                  </Badge>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
