import { useState } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Building2, Plus, Search, Filter, Edit, Trash2, Users, X } from 'lucide-react';

interface Department {
  id: number;
  name: string;
  description: string;
  head: string;
  employeeCount: number;
  status: string;
  created: string;
}

export default function Departments() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingDepartmentId, setDeletingDepartmentId] = useState<number | null>(null);
  
  const [departments, setDepartments] = useState<Department[]>([
    { id: 1, name: 'Engineering', description: 'Software development and technical operations', head: 'Sarah Johnson', employeeCount: 45, status: 'Active', created: '2024-01-01' },
    { id: 2, name: 'Marketing', description: 'Marketing campaigns and brand management', head: 'Mike Chen', employeeCount: 28, status: 'Active', created: '2024-01-02' },
    { id: 3, name: 'Sales', description: 'Sales operations and client relationships', head: 'Emily Davis', employeeCount: 35, status: 'Active', created: '2024-01-03' },
    { id: 4, name: 'Human Resources', description: 'Employee management and recruitment', head: 'David Wilson', employeeCount: 12, status: 'Active', created: '2024-01-04' },
    { id: 5, name: 'Finance', description: 'Financial planning and accounting', head: 'Lisa Anderson', employeeCount: 18, status: 'Active', created: '2024-01-05' },
    { id: 6, name: 'Operations', description: 'Business operations and logistics', head: 'Tom Brown', employeeCount: 22, status: 'Active', created: '2024-01-06' }
  ]);

  const handleAddDepartment = () => {
    setShowAddForm(true);
  };

  const handleEditDepartment = (department: Department) => {
    setEditingDepartment(department);
    setShowEditForm(true);
  };

  const handleDeleteDepartment = (id: number) => {
    setDeletingDepartmentId(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    setDepartments(departments.filter(dept => dept.id !== deletingDepartmentId));
    setShowDeleteConfirm(false);
    setDeletingDepartmentId(null);
  };

  const handleSaveDepartment = (newDepartment: Department) => {
    if (editingDepartment) {
      // Update existing department
      setDepartments(departments.map(dept => 
        dept.id === editingDepartment.id 
          ? { ...dept, ...newDepartment }
          : dept
      ));
      setShowEditForm(false);
      setEditingDepartment(null);
    } else {
      // Add new department
      const newId = Math.max(...departments.map(d => d.id)) + 1;
      setDepartments([...departments, {
        id: newId,
        name: newDepartment.name,
        description: newDepartment.description,
        head: newDepartment.head,
        employeeCount: 0,
        status: 'Active',
        created: new Date().toISOString().split('T')[0]
      }]);
      setShowAddForm(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Add Department Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Add New Department</h2>
              <Button variant="ghost" onClick={() => setShowAddForm(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Department Name</label>
                <input
                  type="text"
                  placeholder="Enter department name..."
                  className="w-full mt-1 px-3 py-2 border rounded-xl bg-background"
                  id="dept-name"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <textarea
                  placeholder="Enter department description..."
                  className="w-full mt-1 px-3 py-2 border rounded-xl bg-background"
                  id="dept-description"
                  rows={3}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Department Head</label>
                <input
                  type="text"
                  placeholder="Enter department head name..."
                  className="w-full mt-1 px-3 py-2 border rounded-xl bg-background"
                  id="dept-head"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
              <Button onClick={() => {
                const newDepartment: Department = {
                  id: Math.max(...departments.map(d => d.id)) + 1,
                  name: (document.getElementById('dept-name') as HTMLInputElement).value,
                  description: (document.getElementById('dept-description') as HTMLTextAreaElement).value,
                  head: (document.getElementById('dept-head') as HTMLInputElement).value,
                  employeeCount: 0,
                  status: 'Active',
                  created: new Date().toISOString().split('T')[0]
                };
                handleSaveDepartment(newDepartment);
              }}>
                Save Department
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Edit Department Modal */}
      {showEditForm && editingDepartment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Edit Department</h2>
              <Button variant="ghost" onClick={() => setShowEditForm(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Department Name</label>
                <input
                  type="text"
                  defaultValue={editingDepartment.name}
                  placeholder="Enter department name..."
                  className="w-full mt-1 px-3 py-2 border rounded-xl bg-background"
                  id="edit-dept-name"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <textarea
                  defaultValue={editingDepartment.description}
                  placeholder="Enter department description..."
                  className="w-full mt-1 px-3 py-2 border rounded-xl bg-background"
                  id="edit-dept-description"
                  rows={3}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Department Head</label>
                <input
                  type="text"
                  defaultValue={editingDepartment.head}
                  placeholder="Enter department head name..."
                  className="w-full mt-1 px-3 py-2 border rounded-xl bg-background"
                  id="edit-dept-head"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowEditForm(false)}>
                Cancel
              </Button>
              <Button onClick={() => {
                const updatedDepartment: Department = {
                  id: editingDepartment.id,
                  name: (document.getElementById('edit-dept-name') as HTMLInputElement).value,
                  description: (document.getElementById('edit-dept-description') as HTMLTextAreaElement).value,
                  head: (document.getElementById('edit-dept-head') as HTMLInputElement).value,
                  employeeCount: editingDepartment.employeeCount,
                  status: 'Active',
                  created: editingDepartment.created
                };
                handleSaveDepartment(updatedDepartment);
              }}>
                Update Department
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
              <h2 className="text-xl font-semibold mb-2">Delete Department</h2>
              <p className="text-muted-foreground mb-6">
                Are you sure you want to delete this department? This action cannot be undone.
              </p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletingDepartmentId(null);
                }}>
                  Cancel
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={confirmDelete}
                  className="rounded-xl"
                >
                  Delete Department
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Departments</h1>
          <p className="text-muted-foreground">Manage all departments across organizations</p>
        </div>
        <Button className="rounded-xl" onClick={handleAddDepartment}>
          <Plus className="w-4 h-4 mr-2" />
          Add Department
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search departments..."
            className="w-full pl-10 pr-4 py-2 border rounded-xl bg-background"
          />
        </div>
        <Button variant="outline" className="rounded-xl">
          <Filter className="w-4 h-4 mr-2" />
          Filter
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {departments.map((department) => (
          <Card key={department.id} className="p-6 rounded-xl">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                {department.status}
              </span>
            </div>
            <h3 className="font-semibold mb-2">{department.name}</h3>
            <p className="text-sm text-muted-foreground mb-4">{department.description}</p>
            <div className="space-y-2 text-sm text-muted-foreground mb-4">
              <div className="flex items-center justify-between">
                <span>Head:</span>
                <span className="font-medium">{department.head}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Employees:</span>
                <span className="font-medium">{department.employeeCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Created:</span>
                <span className="font-medium">{department.created}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="rounded-lg"
                onClick={() => handleEditDepartment(department)}
              >
                <Edit className="w-4 h-4 mr-1" />
                Edit
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="rounded-lg text-destructive hover:bg-destructive/10"
                onClick={() => handleDeleteDepartment(department.id)}
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
