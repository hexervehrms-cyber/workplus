import React, { useState } from 'react';
import OnboardingForm from '../../components/OnboardingForm';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Search, UserPlus } from 'lucide-react';
import { apiPost } from '../../utils/apiHelper';

const HREmployeeOnboarding: React.FC = () => {
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Mock employee data - in real app, this would come from API
  const employees = [
    { id: '1', name: 'John Doe', email: 'john.doe@workplus.com', department: 'Engineering' },
    { id: '2', name: 'Jane Smith', email: 'jane.smith@workplus.com', department: 'HR' },
    { id: '3', name: 'Mike Johnson', email: 'mike.johnson@workplus.com', department: 'Sales' },
  ];

  const handleFormSubmit = async (formData: FormData) => {
    try {
      // Add additional metadata to FormData
      formData.append('employeeId', selectedEmployee);
      formData.append('submittedBy', 'hr_admin');

      // Submit to backend API with FormData
      const data = await apiPost('/onboarding/submit', formData);

      if (data.success) {
        alert('Employee onboarding form submitted successfully!');
        setShowForm(false);
        setSelectedEmployee('');
      } else {
        alert('Error submitting form: ' + (data.message || 'Please try again.'));
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      alert('Error submitting form. Please try again.');
    }
  };

  if (showForm) {
    return (
      <div>
        <div className="mb-6">
          <Button 
            variant="outline" 
            onClick={() => setShowForm(false)}
            className="rounded-xl"
          >
            ← Back to Employee Selection
          </Button>
        </div>
        <OnboardingForm 
          isHRMode={true}
          employeeId={selectedEmployee}
          onSubmit={handleFormSubmit}
        />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Employee Onboarding</h1>
        <p className="text-muted-foreground">
          Select an employee to fill out their onboarding form or create a new employee profile
        </p>
      </div>

      {/* Employee Selection */}
      <Card className="p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Search className="w-5 h-5" />
            Select Employee
          </h3>
          <Button 
            className="rounded-xl"
            onClick={() => {
              setSelectedEmployee('new_employee_' + Date.now());
              setShowForm(true);
            }}
          >
            <UserPlus className="w-4 h-4 mr-2" />
            New Employee
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <Label>Search Employee</Label>
            <Input
              placeholder="Type employee name or email..."
              className="mt-2 rounded-xl"
            />
          </div>

          <div>
            <Label>Or select from existing employees</Label>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {employees.map((employee) => (
                <Card 
                  key={employee.id}
                  className="p-4 cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-primary/50"
                  onClick={() => {
                    setSelectedEmployee(employee.id);
                    setShowForm(true);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-primary font-semibold">
                        {employee.name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-medium">{employee.name}</h4>
                      <p className="text-sm text-muted-foreground">{employee.email}</p>
                      <p className="text-xs text-muted-foreground">{employee.department}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 rounded-2xl text-center hover:shadow-md transition-shadow cursor-pointer">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
            <UserPlus className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="font-semibold mb-2">New Employee</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create onboarding form for a new employee
          </p>
          <Button 
            variant="outline" 
            className="rounded-xl w-full"
            onClick={() => {
              setSelectedEmployee('new_employee_' + Date.now());
              setShowForm(true);
            }}
          >
            Start Onboarding
          </Button>
        </Card>

        <Card className="p-6 rounded-2xl text-center hover:shadow-md transition-shadow cursor-pointer">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="font-semibold mb-2">Existing Employee</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Complete or update existing employee information
          </p>
          <Button variant="outline" className="rounded-xl w-full" disabled>
            Select Employee
          </Button>
        </Card>

        <Card className="p-6 rounded-2xl text-center hover:shadow-md transition-shadow cursor-pointer">
          <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4">
            <UserPlus className="w-8 h-8 text-purple-600" />
          </div>
          <h3 className="font-semibold mb-2">Bulk Onboarding</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Upload multiple employees at once using CSV
          </p>
          <Button variant="outline" className="rounded-xl w-full" disabled>
            Upload CSV
          </Button>
        </Card>
      </div>
    </div>
  );
};

export default HREmployeeOnboarding;
