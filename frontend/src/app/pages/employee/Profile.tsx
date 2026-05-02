import { User, Mail, Phone, MapPin, Calendar, Briefcase, FileText, Edit, Lock, Globe, Loader, X, Upload, Download, Trash2, Check } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Separator } from '../../components/ui/separator';
import { Progress } from '../../components/ui/progress';
import { useCurrency } from '../../context/CurrencyContext';
import CurrencySelector from '../../components/CurrencySelector';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';

interface EmployeeData {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  employeeId: string;
  department: string;
  designation: string;
  joiningDate: string;
  employmentType: string;
  workLocation: string;
  aadharNumber?: string;
  panNumber?: string;
  bankAccount?: string;
  ifscCode?: string;
}

interface Document {
  _id: string;
  name: string;
  size: string;
  uploadedAt: string;
  status: string;
  filePath?: string;
}

export default function Profile() {
  const { selectedCurrency, formatCurrency } = useCurrency();
  const [showCurrencySelector, setShowCurrencySelector] = useState(false);
  const [employee, setEmployee] = useState<EmployeeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmployeeData();
  }, []);

  const fetchEmployeeData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch('http://localhost:5000/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch employee data');
      }

      const data = await response.json();
      console.log('Raw response data:', data);
      
      // The response data is already in the correct format
      const profileData = data.data || data;
      console.log('Profile data:', profileData);
      
      // Ensure all required fields are present
      const employeeData: EmployeeData = {
        _id: profileData._id || '',
        firstName: profileData.firstName || '',
        lastName: profileData.lastName || '',
        email: profileData.email || '',
        phone: profileData.phone || '',
        dateOfBirth: profileData.dateOfBirth || '',
        gender: profileData.gender || '',
        address: profileData.address || '',
        employeeId: profileData.employeeId || profileData.employeeCode || '',
        department: profileData.department || '',
        designation: profileData.designation || '',
        joiningDate: profileData.joiningDate || '',
        employmentType: profileData.employmentType || '',
        workLocation: profileData.workLocation || '',
        aadharNumber: profileData.aadharNumber || '',
        panNumber: profileData.panNumber || '',
        bankAccount: profileData.bankAccount || '',
        ifscCode: profileData.ifscCode || ''
      };
      
      console.log('Employee data to set:', employeeData);
      setEmployee(employeeData);
      
      // Directly update form states
      setPersonalForm({
        firstName: employeeData.firstName,
        lastName: employeeData.lastName,
        phone: employeeData.phone,
        dateOfBirth: employeeData.dateOfBirth ? (typeof employeeData.dateOfBirth === 'string' ? employeeData.dateOfBirth.split('T')[0] : new Date(employeeData.dateOfBirth).toISOString().split('T')[0]) : '',
        gender: employeeData.gender,
        address: employeeData.address
      });

      setOfficialForm({
        employeeId: employeeData.employeeId,
        joiningDate: employeeData.joiningDate ? (typeof employeeData.joiningDate === 'string' ? employeeData.joiningDate.split('T')[0] : new Date(employeeData.joiningDate).toISOString().split('T')[0]) : '',
        department: employeeData.department,
        designation: employeeData.designation
      });
      
      console.log('Form states directly updated');
    } catch (error) {
      console.error('Error fetching employee data:', error);
      toast.error('Failed to load employee data');
    } finally {
      setLoading(false);
    }
  };
  const [isEditingPersonal, setIsEditingPersonal] = useState(false);
  const [isEditingOfficial, setIsEditingOfficial] = useState(false);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [experienceDocuments, setExperienceDocuments] = useState<Document[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [documentType, setDocumentType] = useState<'personal' | 'experience'>('personal');

  // Edit form states
  const [personalForm, setPersonalForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    address: ''
  });

  const [officialForm, setOfficialForm] = useState({
    employeeId: '',
    joiningDate: '',
    department: '',
    designation: ''
  });

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader className="w-8 h-8 animate-spin" />
          <p className="text-muted-foreground">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <Card className="p-6 text-center">
          <p className="text-muted-foreground mb-4">Unable to load employee data</p>
          <Button onClick={fetchEmployeeData}>Retry</Button>
        </Card>
      </div>
    );
  }

  const fullName = `${employee.firstName} ${employee.lastName}`;
  const initials = `${employee.firstName?.[0]}${employee.lastName?.[0]}`.toUpperCase();

  // Handle personal information update
  const handleUpdatePersonal = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('http://localhost:5000/api/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          profile: {
            firstName: personalForm.firstName,
            lastName: personalForm.lastName
          },
          contact: {
            phone: personalForm.phone,
            address: personalForm.address
          },
          employeeDetails: {
            phone: personalForm.phone,
            address: personalForm.address
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      // Add a small delay to ensure database is updated
      await new Promise(resolve => setTimeout(resolve, 500));

      // Refresh employee data from backend to ensure consistency
      await fetchEmployeeData();

      setIsEditingPersonal(false);
      toast.success('Personal information updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update personal information');
    }
  };

  // Handle official information update
  const handleUpdateOfficial = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('http://localhost:5000/api/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          employeeDetails: {
            employeeId: officialForm.employeeId,
            joiningDate: officialForm.joiningDate,
            department: officialForm.department,
            designation: officialForm.designation
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update official information');
      }

      const data = await response.json();
      console.log('Update response:', data);

      // Add a small delay to ensure database is updated
      await new Promise(resolve => setTimeout(resolve, 500));

      // Refresh employee data from backend to ensure consistency
      await fetchEmployeeData();

      setIsEditingOfficial(false);
      toast.success('Official information updated successfully');
    } catch (error) {
      console.error('Error updating official information:', error);
      toast.error('Failed to update official information');
    }
  };

  // Handle document upload
  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingFile(true);
      const token = localStorage.getItem('authToken');
      const formData = new FormData();
      formData.append('document', file);
      formData.append('name', file.name);
      formData.append('type', documentType === 'personal' ? 'general' : 'experience_letter');

      const response = await fetch('http://localhost:5000/api/employee-dashboard/documents', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload document');
      }

      const data = await response.json();
      const newDoc: Document = {
        _id: data.data.id,
        name: data.data.name,
        size: data.data.size,
        uploadedAt: new Date(data.data.uploadedAt).toLocaleDateString(),
        status: data.data.status === 'uploaded' ? 'Pending' : data.data.status,
        filePath: data.data.filePath
      };

      if (documentType === 'personal') {
        setDocuments([newDoc, ...documents]);
      } else {
        setExperienceDocuments([newDoc, ...experienceDocuments]);
      }

      toast.success('Document uploaded successfully');
      setIsUploadingDocument(false);
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload document');
    } finally {
      setUploadingFile(false);
    }
  };

  return (
    <div className="p-8 space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">My Profile</h1>
        <p className="text-muted-foreground">Manage your personal information and documents</p>
      </div>

      {/* Profile Completion */}
      <Card className="p-6 rounded-2xl bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-lg">Profile Completion</h3>
            <p className="text-sm text-muted-foreground">Complete your profile to unlock all features</p>
          </div>
          <Button variant="outline" className="rounded-xl">Complete Profile</Button>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Profile Completion</span>
            <span className="font-medium">75%</span>
          </div>
          <Progress value={75} className="h-2" />
          <p className="text-xs text-muted-foreground">Add emergency contact and banking details to complete</p>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="lg:col-span-1">
          <Card className="p-6 rounded-2xl text-center">
            <div className="relative inline-block mb-4">
              <Avatar className="w-32 h-32">
                <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${fullName}`} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <Button
                size="icon"
                className="absolute bottom-0 right-0 rounded-full w-10 h-10"
              >
                <Edit className="w-4 h-4" />
              </Button>
            </div>
            <h2 className="text-2xl font-bold mb-1">{fullName}</h2>
            <p className="text-muted-foreground mb-4">{employee.designation}</p>
            <Badge className="mb-6">{employee.employmentType} Employee</Badge>

            <div className="space-y-3 text-left">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span>{employee.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span>{employee.phone}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span>{employee.address}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span>Joined {new Date(employee.joiningDate).toLocaleDateString()}</span>
              </div>
            </div>

            <Separator className="my-6" />

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Employee ID</span>
                <span className="font-medium">{employee.employeeId}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Department</span>
                <span className="font-medium">{employee.department}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Work Location</span>
                <span className="font-medium">{employee.workLocation}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Information */}
          <Card className="p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-lg">Personal Information</h3>
              {!isEditingPersonal ? (
                <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setIsEditingPersonal(true)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setIsEditingPersonal(false)}>
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button size="sm" className="rounded-xl" onClick={handleUpdatePersonal}>
                    <Check className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label>First Name</Label>
                <Input 
                  value={personalForm.firstName}
                  onChange={(e) => setPersonalForm({...personalForm, firstName: e.target.value})}
                  disabled={!isEditingPersonal}
                  className={`mt-2 rounded-xl ${isEditingPersonal ? 'bg-background border-primary' : 'bg-muted'}`}
                  placeholder="Enter first name"
                />
              </div>
              <div>
                <Label>Last Name</Label>
                <Input 
                  value={personalForm.lastName}
                  onChange={(e) => setPersonalForm({...personalForm, lastName: e.target.value})}
                  disabled={!isEditingPersonal}
                  className={`mt-2 rounded-xl ${isEditingPersonal ? 'bg-background border-primary' : 'bg-muted'}`}
                  placeholder="Enter last name"
                />
              </div>
              <div>
                <Label>Email Address</Label>
                <Input value={employee.email} disabled className="mt-2 rounded-xl bg-muted" />
              </div>
              <div>
                <Label>Phone Number</Label>
                <Input 
                  value={personalForm.phone}
                  onChange={(e) => setPersonalForm({...personalForm, phone: e.target.value})}
                  disabled={!isEditingPersonal}
                  className={`mt-2 rounded-xl ${isEditingPersonal ? 'bg-background border-primary' : 'bg-muted'}`}
                  placeholder="Enter phone number"
                />
              </div>
              <div>
                <Label>Date of Birth</Label>
                <Input 
                  type="date" 
                  value={personalForm.dateOfBirth}
                  onChange={(e) => setPersonalForm({...personalForm, dateOfBirth: e.target.value})}
                  disabled={!isEditingPersonal}
                  className={`mt-2 rounded-xl ${isEditingPersonal ? 'bg-background border-primary' : 'bg-muted'}`}
                />
              </div>
              <div>
                <Label>Gender</Label>
                <Input 
                  value={personalForm.gender}
                  onChange={(e) => setPersonalForm({...personalForm, gender: e.target.value})}
                  disabled={!isEditingPersonal}
                  className={`mt-2 rounded-xl ${isEditingPersonal ? 'bg-background border-primary' : 'bg-muted'}`}
                  placeholder="Enter gender"
                />
              </div>
              <div className="col-span-2">
                <Label>Address</Label>
                <Input 
                  value={personalForm.address}
                  onChange={(e) => setPersonalForm({...personalForm, address: e.target.value})}
                  disabled={!isEditingPersonal}
                  className={`mt-2 rounded-xl ${isEditingPersonal ? 'bg-background border-primary' : 'bg-muted'}`}
                  placeholder="Enter address"
                />
              </div>
            </div>
          </Card>

          {/* Official Information */}
          <Card className="p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-lg">Official Information</h3>
              {!isEditingOfficial ? (
                <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setIsEditingOfficial(true)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setIsEditingOfficial(false)}>
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button size="sm" className="rounded-xl" onClick={handleUpdateOfficial}>
                    <Check className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label>Employee ID</Label>
                <Input 
                  value={officialForm.employeeId}
                  onChange={(e) => setOfficialForm({...officialForm, employeeId: e.target.value})}
                  disabled={!isEditingOfficial}
                  className={`mt-2 rounded-xl ${isEditingOfficial ? 'bg-background border-primary' : 'bg-muted'}`}
                  placeholder="Enter employee ID"
                />
              </div>
              <div>
                <Label>Joining Date</Label>
                <Input 
                  type="date" 
                  value={officialForm.joiningDate}
                  onChange={(e) => setOfficialForm({...officialForm, joiningDate: e.target.value})}
                  disabled={!isEditingOfficial}
                  className={`mt-2 rounded-xl ${isEditingOfficial ? 'bg-background border-primary' : 'bg-muted'}`}
                />
              </div>
              <div>
                <Label>Department</Label>
                <Input 
                  value={officialForm.department}
                  onChange={(e) => setOfficialForm({...officialForm, department: e.target.value})}
                  disabled={!isEditingOfficial}
                  className={`mt-2 rounded-xl ${isEditingOfficial ? 'bg-background border-primary' : 'bg-muted'}`}
                  placeholder="Enter department"
                />
              </div>
              <div>
                <Label>Designation</Label>
                <Input 
                  value={officialForm.designation}
                  onChange={(e) => setOfficialForm({...officialForm, designation: e.target.value})}
                  disabled={!isEditingOfficial}
                  className={`mt-2 rounded-xl ${isEditingOfficial ? 'bg-background border-primary' : 'bg-muted'}`}
                  placeholder="Enter designation"
                />
              </div>
            </div>
          </Card>

          {/* Currency Settings */}
          <Card className="p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Currency Settings</h3>
                  <p className="text-sm text-muted-foreground">Choose your preferred currency</p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowCurrencySelector(true)}
                className="rounded-xl"
              >
                <Edit className="w-4 h-4 mr-2" />
                Change
              </Button>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-accent/50 border border-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center">
                  <span className="text-lg font-bold">{selectedCurrency.symbol}</span>
                </div>
                <div>
                  <div className="font-medium">{selectedCurrency.code}</div>
                  <div className="text-sm text-muted-foreground">{selectedCurrency.name}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Example:</div>
                <div className="font-semibold">{formatCurrency(1000)}</div>
              </div>
            </div>
          </Card>

          {/* Sensitive Information */}
          <Card className="p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold text-lg">Sensitive Information</h3>
                <p className="text-sm text-muted-foreground">Locked fields for security</p>
              </div>
              <Lock className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label>Aadhar Number</Label>
                <div className="mt-2 flex items-center gap-2">
                  <Input value={employee.aadharNumber ? '**** **** ****' : 'Not provided'} disabled className="rounded-xl bg-muted" />
                  <Button variant="outline" size="sm" className="rounded-xl">
                    <Lock className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label>PAN Number</Label>
                <div className="mt-2 flex items-center gap-2">
                  <Input value={employee.panNumber ? '*****' + employee.panNumber.slice(-4) : 'Not provided'} disabled className="rounded-xl bg-muted" />
                  <Button variant="outline" size="sm" className="rounded-xl">
                    <Lock className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label>Bank Account</Label>
                <div className="mt-2 flex items-center gap-2">
                  <Input value={employee.bankAccount ? '*********' + employee.bankAccount.slice(-4) : 'Not provided'} disabled className="rounded-xl bg-muted" />
                  <Button variant="outline" size="sm" className="rounded-xl">
                    <Lock className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label>IFSC Code</Label>
                <div className="mt-2 flex items-center gap-2">
                  <Input value={employee.ifscCode || 'Not provided'} disabled className="rounded-xl bg-muted" />
                  <Button variant="outline" size="sm" className="rounded-xl">
                    <Lock className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* Documents */}
          <Card className="rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">Documents</h3>
                <p className="text-sm text-muted-foreground">Upload and manage your documents</p>
              </div>
              <Dialog open={isUploadingDocument && documentType === 'personal'} onOpenChange={(open) => {
                if (!open) setIsUploadingDocument(false);
              }}>
                <Button className="rounded-xl" onClick={() => {
                  setDocumentType('personal');
                  setIsUploadingDocument(true);
                }}>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Document
                </Button>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Upload Document</DialogTitle>
                    <DialogDescription>Upload a document for verification</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="border-2 border-dashed rounded-xl p-6 text-center">
                      <input
                        type="file"
                        id="doc-upload"
                        className="hidden"
                        onChange={handleDocumentUpload}
                        disabled={uploadingFile}
                      />
                      <label htmlFor="doc-upload" className="cursor-pointer">
                        <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm font-medium">Click to upload or drag and drop</p>
                        <p className="text-xs text-muted-foreground">PDF, DOC, DOCX up to 10MB</p>
                      </label>
                    </div>
                    {uploadingFile && <p className="text-sm text-center text-muted-foreground">Uploading...</p>}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="divide-y divide-border">
              {documents.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  <p>No documents uploaded yet</p>
                </div>
              ) : (
                documents.map((doc) => (
                  <div key={doc._id} className="p-6 flex items-center justify-between hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <FileText className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold">{doc.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {doc.size} • Uploaded {doc.uploadedAt}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={doc.status === 'Verified' ? 'default' : 'secondary'}>
                        {doc.status}
                      </Badge>
                      <Button variant="outline" size="sm" className="rounded-xl">
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Experience */}
          <Card className="rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">Experience</h3>
                <p className="text-sm text-muted-foreground">Upload and manage your experience documents</p>
              </div>
              <Dialog open={isUploadingDocument && documentType === 'experience'} onOpenChange={(open) => {
                if (!open) setIsUploadingDocument(false);
              }}>
                <Button className="rounded-xl" onClick={() => {
                  setDocumentType('experience');
                  setIsUploadingDocument(true);
                }}>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Document
                </Button>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Upload Experience Document</DialogTitle>
                    <DialogDescription>Upload an experience document for verification</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="border-2 border-dashed rounded-xl p-6 text-center">
                      <input
                        type="file"
                        id="exp-upload"
                        className="hidden"
                        onChange={handleDocumentUpload}
                        disabled={uploadingFile}
                      />
                      <label htmlFor="exp-upload" className="cursor-pointer">
                        <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm font-medium">Click to upload or drag and drop</p>
                        <p className="text-xs text-muted-foreground">PDF, DOC, DOCX up to 10MB</p>
                      </label>
                    </div>
                    {uploadingFile && <p className="text-sm text-center text-muted-foreground">Uploading...</p>}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="divide-y divide-border">
              {experienceDocuments.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  <p>No experience documents uploaded yet</p>
                </div>
              ) : (
                experienceDocuments.map((doc) => (
                  <div key={doc._id} className="p-6 flex items-center justify-between hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <FileText className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold">{doc.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {doc.size} • Uploaded {doc.uploadedAt}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={doc.status === 'Verified' ? 'default' : 'secondary'}>
                        {doc.status}
                      </Badge>
                      <Button variant="outline" size="sm" className="rounded-xl">
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Currency Selector Modal */}
      {showCurrencySelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CurrencySelector 
              onClose={() => setShowCurrencySelector(false)}
              showSaveButton={true}
            />
          </div>
        </div>
      )}
    </div>
  );
}
