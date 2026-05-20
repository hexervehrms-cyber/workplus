import React, { useState, useEffect } from 'react';
import OnboardingForm from '../../components/OnboardingForm';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Search, UserPlus, Loader2 } from 'lucide-react';
import { apiPost } from '../../utils/apiHelper';
import { EmployeeService } from '../../utils/api';
import { toast } from '../../utils/portalToast';

interface EmployeeRow {
  _id: string;
  name: string;
  email: string;
  department: string;
}

const HREmployeeOnboarding: React.FC = () => {
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await EmployeeService.getAllEmployees();
        const rows: EmployeeRow[] = (data || []).map((emp: Record<string, unknown>) => {
          const u = emp.userId as { name?: string; email?: string } | undefined;
          return {
            _id: String(emp._id),
            name: u?.name || String(emp.employeeCode || 'Employee'),
            email: u?.email || '',
            department: String(emp.department || '—'),
          };
        });
        setEmployees(rows);
      } catch (e) {
        console.error(e);
        toast.error('Failed to load employees');
        setEmployees([]);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const filtered = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleFormSubmit = async (formData: FormData) => {
    try {
      formData.append('employeeId', selectedEmployee);
      formData.append('submittedBy', 'hr_admin');
      const data = await apiPost('/onboarding/submit', formData);
      if (data.success) {
        toast.success('Employee onboarding form submitted successfully');
        setShowForm(false);
        setSelectedEmployee('');
      } else {
        toast.error(data.message || 'Please try again.');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error('Error submitting form. Please try again.');
    }
  };

  if (showForm) {
    return (
      <div>
        <div className="mb-6">
          <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="rounded-xl">
            ← Back to Employee Selection
          </Button>
        </div>
        <OnboardingForm isHRMode={true} employeeId={selectedEmployee} onSubmit={handleFormSubmit} />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Employee Onboarding</h1>
        <p className="text-muted-foreground">
          Select an employee to complete onboarding documentation
        </p>
      </div>

      <Card className="p-6 rounded-2xl">
        <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
          <Search className="w-5 h-5" />
          Select employee
        </h3>
        <Label>Search</Label>
        <Input
          placeholder="Name, email, or department…"
          className="mt-2 rounded-xl mb-4"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No employees found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((employee) => (
              <Card
                key={employee._id}
                role="button"
                tabIndex={0}
                className="p-4 cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-primary/50"
                onClick={() => {
                  setSelectedEmployee(employee._id);
                  setShowForm(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedEmployee(employee._id);
                    setShowForm(true);
                  }
                }}
              >
                <h4 className="font-medium">{employee.name}</h4>
                <p className="text-sm text-muted-foreground">{employee.email}</p>
                <p className="text-xs text-muted-foreground mt-1">{employee.department}</p>
              </Card>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default HREmployeeOnboarding;
