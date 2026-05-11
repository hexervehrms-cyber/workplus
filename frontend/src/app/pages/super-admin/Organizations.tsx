import { useState } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Building2, Plus, Search, Filter, X, Edit, Trash2 } from 'lucide-react';

export default function Organizations() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingOrg, setEditingOrg] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingOrgId, setDeletingOrgId] = useState<number | null>(null);
  
  const [organizations, setOrganizations] = useState([
    { id: 1, organizationId: 'ORG-001', name: 'Organization 1', email: 'admin@org1.com', phone: '+1 (555) 000-0001', users: 110, status: 'Active', created: '2024-01-01' },
    { id: 2, organizationId: 'ORG-002', name: 'Organization 2', email: 'admin@org2.com', phone: '+1 (555) 000-0002', users: 160, status: 'Active', created: '2024-01-02' },
    { id: 3, organizationId: 'ORG-003', name: 'Organization 3', email: 'admin@org3.com', phone: '+1 (555) 000-0003', users: 210, status: 'Active', created: '2024-01-03' },
    { id: 4, organizationId: 'ORG-004', name: 'Organization 4', email: 'admin@org4.com', phone: '+1 (555) 000-0004', users: 260, status: 'Active', created: '2024-01-04' },
    { id: 5, organizationId: 'ORG-005', name: 'Organization 5', email: 'admin@org5.com', phone: '+1 (555) 000-0005', users: 310, status: 'Active', created: '2024-01-05' },
    { id: 6, organizationId: 'ORG-006', name: 'Organization 6', email: 'admin@org6.com', phone: '+1 (555) 000-0006', users: 360, status: 'Active', created: '2024-01-06' },
  ]);

  const handleAddOrganization = () => {
    setShowAddForm(true);
  };

  const handleEditOrganization = (org: any) => {
    setEditingOrg(org);
    setShowEditForm(true);
  };

  const handleDeleteOrganization = (id: number) => {
    setDeletingOrgId(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    setOrganizations(organizations.filter(org => org.id !== deletingOrgId));
    setShowDeleteConfirm(false);
    setDeletingOrgId(null);
  };

  const handleSaveOrganization = (newOrg: any) => {
    if (editingOrg) {
      // Update existing organization
      setOrganizations(organizations.map(org => 
        org.id === editingOrg.id 
          ? { ...org, ...newOrg }
          : org
      ));
      setShowEditForm(false);
      setEditingOrg(null);
    } else {
      // Add new organization
      const newId = Math.max(...organizations.map(o => o.id)) + 1;
      setOrganizations([...organizations, {
        id: newId,
        organizationId: newOrg.organizationId,
        name: newOrg.name,
        email: newOrg.email,
        phone: newOrg.phone,
        users: 0,
        status: 'Active',
        created: new Date().toISOString().split('T')[0]
      }]);
      setShowAddForm(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Add Organization Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Add New Organization</h2>
              <Button variant="ghost" onClick={() => setShowAddForm(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Organization ID</label>
                <input
                  type="text"
                  placeholder="Enter organization ID (e.g., ORG-001)"
                  className="w-full mt-1 px-3 py-2 border rounded-xl bg-background"
                  id="org-id"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Organization Name</label>
                <input
                  type="text"
                  placeholder="Enter organization name..."
                  className="w-full mt-1 px-3 py-2 border rounded-xl bg-background"
                  id="org-name"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Initial Admin Email</label>
                <input
                  type="email"
                  placeholder="admin@example.com"
                  className="w-full mt-1 px-3 py-2 border rounded-xl bg-background"
                  id="admin-email"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Contact Phone</label>
                <input
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  className="w-full mt-1 px-3 py-2 border rounded-xl bg-background"
                  id="contact-phone"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
              <Button onClick={() => {
                const newOrg = {
                  organizationId: (document.getElementById('org-id') as HTMLInputElement).value,
                  name: (document.getElementById('org-name') as HTMLInputElement).value,
                  email: (document.getElementById('admin-email') as HTMLInputElement).value,
                  phone: (document.getElementById('contact-phone') as HTMLInputElement).value
                };
                handleSaveOrganization(newOrg);
              }}>
                Save Organization
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Edit Organization Modal */}
      {showEditForm && editingOrg && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Edit Organization</h2>
              <Button variant="ghost" onClick={() => setShowEditForm(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Organization ID</label>
                <input
                  type="text"
                  defaultValue={editingOrg.organizationId || ''}
                  placeholder="Enter organization ID (e.g., ORG-001)"
                  className="w-full mt-1 px-3 py-2 border rounded-xl bg-background"
                  id="edit-org-id"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Organization Name</label>
                <input
                  type="text"
                  defaultValue={editingOrg.name}
                  placeholder="Enter organization name..."
                  className="w-full mt-1 px-3 py-2 border rounded-xl bg-background"
                  id="edit-org-name"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Admin Email</label>
                <input
                  type="email"
                  defaultValue={editingOrg.email || 'admin@example.com'}
                  placeholder="admin@example.com"
                  className="w-full mt-1 px-3 py-2 border rounded-xl bg-background"
                  id="edit-admin-email"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Contact Phone</label>
                <input
                  type="tel"
                  defaultValue={editingOrg.phone || '+1 (555) 000-0000'}
                  placeholder="+1 (555) 000-0000"
                  className="w-full mt-1 px-3 py-2 border rounded-xl bg-background"
                  id="edit-contact-phone"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowEditForm(false)}>
                Cancel
              </Button>
              <Button onClick={() => {
                const updatedOrg = {
                  organizationId: (document.getElementById('edit-org-id') as HTMLInputElement).value,
                  name: (document.getElementById('edit-org-name') as HTMLInputElement).value,
                  email: (document.getElementById('edit-admin-email') as HTMLInputElement).value,
                  phone: (document.getElementById('edit-contact-phone') as HTMLInputElement).value
                };
                handleSaveOrganization(updatedOrg);
              }}>
                Update Organization
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
              <h2 className="text-xl font-semibold mb-2">Delete Organization</h2>
              <p className="text-muted-foreground mb-6">
                Are you sure you want to delete this organization? This action cannot be undone.
              </p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletingOrgId(null);
                }}>
                  Cancel
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={confirmDelete}
                  className="rounded-xl"
                >
                  Delete Organization
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Organizations</h1>
          <p className="text-muted-foreground">Manage all organizations in the system</p>
        </div>
        <Button className="rounded-xl" onClick={handleAddOrganization}>
          <Plus className="w-4 h-4 mr-2" />
          Add Organization
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search organizations..."
            className="w-full pl-10 pr-4 py-2 border rounded-xl bg-background"
          />
        </div>
        <Button variant="outline" className="rounded-xl">
          <Filter className="w-4 h-4 mr-2" />
          Filter
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {organizations.map((org) => (
          <Card key={org.id} className="p-6 rounded-xl">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                {org.status}
              </span>
            </div>
            <h3 className="font-semibold mb-2">{org.name}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Organization details and management information...
            </p>
            <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
              <span>Users: {org.users}</span>
              <span>Created: {org.created}</span>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="rounded-lg"
                onClick={() => handleEditOrganization(org)}
              >
                <Edit className="w-4 h-4 mr-1" />
                Edit
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="rounded-lg text-destructive hover:bg-destructive/10"
                onClick={() => handleDeleteOrganization(org.id)}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
