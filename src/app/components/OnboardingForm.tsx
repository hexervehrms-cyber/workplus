import React, { useState } from 'react';
import { User, Mail, Phone, MapPin, Calendar, Briefcase, FileText, Upload, Check, AlertCircle, Lock } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { Progress } from './ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';

interface FormData {
  // Personal Information
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  avatar: File | null;
  
  // Official Information
  employeeId: string;
  joiningDate: string;
  department: string;
  designation: string;
  employmentType: string;
  workLocation: string;
  
  // Sensitive Information
  aadharNumber: string;
  panNumber: string;
  bankAccount: string;
  ifscCode: string;
  
  // Emergency Contact
  emergencyName: string;
  emergencyRelation: string;
  emergencyPhone: string;
}

interface DocumentUpload {
  type: string;
  name: string;
  file: File | null;
  required: boolean;
}

const OnboardingForm: React.FC<{ 
  isHRMode?: boolean; 
  employeeId?: string;
  onSubmit?: (data: any) => void;
}> = ({ isHRMode = false, employeeId = '', onSubmit }) => {
  const [currentSection, setCurrentSection] = useState(0);
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    address: '',
    avatar: null,
    employeeId: employeeId,
    joiningDate: '',
    department: '',
    designation: '',
    employmentType: '',
    workLocation: '',
    aadharNumber: '',
    panNumber: '',
    bankAccount: '',
    ifscCode: '',
    emergencyName: '',
    emergencyRelation: '',
    emergencyPhone: ''
  });

  const [documents, setDocuments] = useState<DocumentUpload[]>([
    { type: 'resume', name: 'Resume', file: null, required: true },
    { type: 'id_proof', name: 'ID Proof', file: null, required: true },
    { type: 'education_certificate', name: 'Education Certificate', file: null, required: true },
    { type: 'address_proof', name: 'Address Proof', file: null, required: true },
    { type: 'experience_letter', name: 'Experience Letter', file: null, required: false },
    { type: 'offer_letter', name: 'Offer Letter', file: null, required: true },
    { type: 'relieving_letter', name: 'Relieving Letter', file: null, required: false },
    { type: 'appraisal_letter', name: 'Appraisal Letter', file: null, required: false },
    { type: 'salary_slips', name: 'Salary Slips', file: null, required: false },
    { type: 'bank_statement', name: 'Bank Statement', file: null, required: false }
  ]);

  const sections = [
    { title: 'Personal Information', icon: User, completed: false },
    { title: 'Official Information', icon: Briefcase, completed: false },
    { title: 'Emergency Contact', icon: Phone, completed: false },
    { title: 'Banking Information', icon: Lock, completed: false },
    { title: 'Documents Upload', icon: FileText, completed: false },
    { title: 'Experience Documents', icon: Briefcase, completed: false }
  ];

  const handleInputChange = (field: keyof FormData, value: string | File | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAvatarUpload = (file: File) => {
    // Validate file type and size
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(file.type)) {
      alert('Please upload a valid image file (JPEG, PNG, or GIF)');
      return;
    }

    if (file.size > maxSize) {
      alert('Image size should be less than 5MB');
      return;
    }

    setFormData(prev => ({ ...prev, avatar: file }));
  };

  const handleFileUpload = (index: number, file: File) => {
    const newDocuments = [...documents];
    newDocuments[index].file = file;
    setDocuments(newDocuments);
  };

  const calculateProgress = () => {
    let filledFields = 0;
    const totalFields = Object.keys(formData).length;
    
    Object.values(formData).forEach(value => {
      if (value.trim() !== '') filledFields++;
    });

    const uploadedFiles = documents.filter(doc => doc.file !== null).length;
    const totalFiles = documents.length;
    
    return Math.round(((filledFields / totalFields) * 0.7 + (uploadedFiles / totalFiles) * 0.3) * 100);
  };

  const handleNext = () => {
    if (currentSection < sections.length - 1) {
      setCurrentSection(currentSection + 1);
    }
  };

  const handlePrevious = () => {
    if (currentSection > 0) {
      setCurrentSection(currentSection - 1);
    }
  };

  const handleSubmit = async () => {
    // Create FormData for file uploads
    const formDataToSend = new FormData();
    
    // Add all form fields
    Object.keys(formData).forEach(key => {
      if (key === 'avatar' && formData[key]) {
        // Handle avatar file separately
        formDataToSend.append('avatar', formData[key]);
      } else if (key !== 'avatar') {
        formDataToSend.append(key, formData[key]);
      }
    });
    
    // Add documents
    documents.forEach((doc, index) => {
      if (doc.file) {
        formDataToSend.append(`document_${index}`, doc.file);
        formDataToSend.append(`document_${index}_type`, doc.type);
        formDataToSend.append(`document_${index}_name`, doc.name);
      }
    });
    
    if (onSubmit) {
      onSubmit(formDataToSend);
    }
  };

  const renderPersonalInformation = () => (
    <Card className="p-6 rounded-2xl">
      <h3 className="font-semibold text-lg mb-6 flex items-center gap-2">
        <User className="w-5 h-5" />
        Personal Information
      </h3>
      <div className="grid grid-cols-2 gap-6">
        {/* Avatar Upload */}
        <div className="col-span-2">
          <Label>Profile Picture</Label>
          <div className="mt-2 flex items-center gap-6">
            <div className="relative">
              {formData.avatar ? (
                <img 
                  src={URL.createObjectURL(formData.avatar)} 
                  alt="Profile" 
                  className="w-24 h-24 rounded-full object-cover border-4 border-primary/20"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-muted border-4 border-primary/20 flex items-center justify-center">
                  <User className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
              <div className="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center border-2 border-background">
                <Upload className="w-4 h-4 text-primary-foreground" />
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-3">
                Upload a professional profile picture (JPEG, PNG, or GIF, max 5MB)
              </p>
              <div className="flex gap-2">
                <label className="cursor-pointer">
                  <Input
                    type="file"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])}
                    accept="image/jpeg,image/jpg,image/png,image/gif"
                  />
                  <Button variant="outline" size="sm" className="rounded-xl" asChild>
                    <span>
                      <Upload className="w-4 h-4 mr-2" />
                      {formData.avatar ? 'Change Photo' : 'Upload Photo'}
                    </span>
                  </Button>
                </label>
                {formData.avatar && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="rounded-xl"
                    onClick={() => handleInputChange('avatar', null)}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
        <div>
          <Label>First Name *</Label>
          <Input 
            value={formData.firstName} 
            onChange={(e) => handleInputChange('firstName', e.target.value)}
            className="mt-2 rounded-xl" 
            placeholder="Enter first name"
          />
        </div>
        <div>
          <Label>Last Name *</Label>
          <Input 
            value={formData.lastName} 
            onChange={(e) => handleInputChange('lastName', e.target.value)}
            className="mt-2 rounded-xl" 
            placeholder="Enter last name"
          />
        </div>
        <div>
          <Label>Email Address *</Label>
          <Input 
            type="email"
            value={formData.email} 
            onChange={(e) => handleInputChange('email', e.target.value)}
            className="mt-2 rounded-xl" 
            placeholder="Enter email address"
          />
        </div>
        <div>
          <Label>Phone Number *</Label>
          <Input 
            value={formData.phone} 
            onChange={(e) => handleInputChange('phone', e.target.value)}
            className="mt-2 rounded-xl" 
            placeholder="Enter phone number"
          />
        </div>
        <div>
          <Label>Date of Birth *</Label>
          <Input 
            type="date"
            value={formData.dateOfBirth} 
            onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
            className="mt-2 rounded-xl" 
          />
        </div>
        <div>
          <Label>Gender *</Label>
          <Select value={formData.gender} onValueChange={(value) => handleInputChange('gender', value)}>
            <SelectTrigger className="mt-2 rounded-xl">
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <Label>Address *</Label>
          <Textarea 
            value={formData.address} 
            onChange={(e) => handleInputChange('address', e.target.value)}
            className="mt-2 rounded-xl" 
            placeholder="Enter complete address"
            rows={3}
          />
        </div>
      </div>
    </Card>
  );

  const renderOfficialInformation = () => (
    <Card className="p-6 rounded-2xl">
      <h3 className="font-semibold text-lg mb-6 flex items-center gap-2">
        <Briefcase className="w-5 h-5" />
        Official Information
      </h3>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <Label>Employee ID</Label>
          <Input 
            value={formData.employeeId} 
            onChange={(e) => handleInputChange('employeeId', e.target.value)}
            className="mt-2 rounded-xl" 
            placeholder="Enter your employee ID"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Enter your official employee ID provided by HR
          </p>
        </div>
        <div>
          <Label>Joining Date</Label>
          <Input 
            type="date"
            value={formData.joiningDate} 
            disabled={!isHRMode}
            onChange={(e) => handleInputChange('joiningDate', e.target.value)}
            className="mt-2 rounded-xl bg-muted" 
          />
        </div>
        <div>
          <Label>Department</Label>
          <Input 
            value={formData.department} 
            disabled={!isHRMode}
            onChange={(e) => handleInputChange('department', e.target.value)}
            className="mt-2 rounded-xl bg-muted" 
          />
        </div>
        <div>
          <Label>Designation</Label>
          <Input 
            value={formData.designation} 
            disabled={!isHRMode}
            onChange={(e) => handleInputChange('designation', e.target.value)}
            className="mt-2 rounded-xl bg-muted" 
          />
        </div>
        <div>
          <Label>Employment Type</Label>
          <Select value={formData.employmentType} onValueChange={(value) => handleInputChange('employmentType', value)} disabled={!isHRMode}>
            <SelectTrigger className="mt-2 rounded-xl bg-muted">
              <SelectValue placeholder="Select employment type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full-time">Full-time</SelectItem>
              <SelectItem value="part-time">Part-time</SelectItem>
              <SelectItem value="contract">Contract</SelectItem>
              <SelectItem value="intern">Intern</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Work Location</Label>
          <Input 
            value={formData.workLocation} 
            disabled={!isHRMode}
            onChange={(e) => handleInputChange('workLocation', e.target.value)}
            className="mt-2 rounded-xl bg-muted" 
          />
        </div>
      </div>
    </Card>
  );

  const renderEmergencyContact = () => (
    <Card className="p-6 rounded-2xl">
      <h3 className="font-semibold text-lg mb-6 flex items-center gap-2">
        <Phone className="w-5 h-5" />
        Emergency Contact
      </h3>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <Label>Contact Name *</Label>
          <Input 
            value={formData.emergencyName} 
            onChange={(e) => handleInputChange('emergencyName', e.target.value)}
            className="mt-2 rounded-xl" 
            placeholder="Enter emergency contact name"
          />
        </div>
        <div>
          <Label>Relationship *</Label>
          <Input 
            value={formData.emergencyRelation} 
            onChange={(e) => handleInputChange('emergencyRelation', e.target.value)}
            className="mt-2 rounded-xl" 
            placeholder="e.g., Spouse, Parent, Sibling"
          />
        </div>
        <div className="col-span-2">
          <Label>Contact Number *</Label>
          <Input 
            value={formData.emergencyPhone} 
            onChange={(e) => handleInputChange('emergencyPhone', e.target.value)}
            className="mt-2 rounded-xl" 
            placeholder="Enter emergency contact number"
          />
        </div>
      </div>
    </Card>
  );

  const renderBankingInformation = () => (
    <Card className="p-6 rounded-2xl">
      <h3 className="font-semibold text-lg mb-6 flex items-center gap-2">
        <Lock className="w-5 h-5" />
        Banking Information
        <span className="text-sm text-muted-foreground font-normal">(Secure & Encrypted)</span>
      </h3>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <Label>Aadhar Number *</Label>
          <Input 
            value={formData.aadharNumber} 
            onChange={(e) => handleInputChange('aadharNumber', e.target.value)}
            className="mt-2 rounded-xl" 
            placeholder="Enter 12-digit Aadhar number"
            maxLength={12}
          />
        </div>
        <div>
          <Label>PAN Number *</Label>
          <Input 
            value={formData.panNumber} 
            onChange={(e) => handleInputChange('panNumber', e.target.value)}
            className="mt-2 rounded-xl" 
            placeholder="Enter PAN number"
            maxLength={10}
          />
        </div>
        <div>
          <Label>Bank Account Number *</Label>
          <Input 
            value={formData.bankAccount} 
            onChange={(e) => handleInputChange('bankAccount', e.target.value)}
            className="mt-2 rounded-xl" 
            placeholder="Enter bank account number"
          />
        </div>
        <div>
          <Label>IFSC Code *</Label>
          <Input 
            value={formData.ifscCode} 
            onChange={(e) => handleInputChange('ifscCode', e.target.value)}
            className="mt-2 rounded-xl" 
            placeholder="Enter IFSC code"
            maxLength={11}
          />
        </div>
      </div>
    </Card>
  );

  const renderDocumentsUpload = () => {
    const generalDocs = documents.filter(doc => 
      ['resume', 'id_proof', 'education_certificate', 'address_proof'].includes(doc.type)
    );

    return (
      <Card className="p-6 rounded-2xl">
        <h3 className="font-semibold text-lg mb-6 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Required Documents
        </h3>
        <div className="space-y-4">
          {generalDocs.map((doc, index) => (
            <div key={doc.type} className="border border-border rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium">{doc.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {doc.required ? 'Required' : 'Optional'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {doc.file && (
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      <Check className="w-3 h-3 mr-1" />
                      Uploaded
                    </Badge>
                  )}
                  <label className="cursor-pointer">
                    <Input
                      type="file"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleFileUpload(documents.indexOf(doc), e.target.files[0])}
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    />
                    <Button variant="outline" size="sm" className="rounded-xl" asChild>
                      <span>
                        <Upload className="w-4 h-4 mr-2" />
                        {doc.file ? 'Change' : 'Upload'}
                      </span>
                    </Button>
                  </label>
                </div>
              </div>
              {doc.file && (
                <div className="mt-3 text-sm text-muted-foreground">
                  File: {doc.file.name} ({(doc.file.size / 1024).toFixed(1)} KB)
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    );
  };

  const renderExperienceDocuments = () => {
    const experienceDocs = documents.filter(doc => 
      ['experience_letter', 'offer_letter', 'relieving_letter', 'appraisal_letter', 'salary_slips', 'bank_statement'].includes(doc.type)
    );

    return (
      <Card className="p-6 rounded-2xl">
        <h3 className="font-semibold text-lg mb-6 flex items-center gap-2">
          <Briefcase className="w-5 h-5" />
          Experience Documents
          <span className="text-sm text-muted-foreground font-normal">(Available for HR/Admin to view)</span>
        </h3>
        <div className="space-y-4">
          {experienceDocs.map((doc) => (
            <div key={doc.type} className="border border-border rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium">{doc.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {doc.required ? 'Required' : 'Optional'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {doc.file && (
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      <Check className="w-3 h-3 mr-1" />
                      Uploaded
                    </Badge>
                  )}
                  <label className="cursor-pointer">
                    <Input
                      type="file"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleFileUpload(documents.indexOf(doc), e.target.files[0])}
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    />
                    <Button variant="outline" size="sm" className="rounded-xl" asChild>
                      <span>
                        <Upload className="w-4 h-4 mr-2" />
                        {doc.file ? 'Change' : 'Upload'}
                      </span>
                    </Button>
                  </label>
                </div>
              </div>
              {doc.file && (
                <div className="mt-3 text-sm text-muted-foreground">
                  File: {doc.file.name} ({(doc.file.size / 1024).toFixed(1)} KB)
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    );
  };

  const renderCurrentSection = () => {
    switch (currentSection) {
      case 0:
        return renderPersonalInformation();
      case 1:
        return renderOfficialInformation();
      case 2:
        return renderEmergencyContact();
      case 3:
        return renderBankingInformation();
      case 4:
        return renderDocumentsUpload();
      case 5:
        return renderExperienceDocuments();
      default:
        return null;
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">
          {isHRMode ? 'Employee Onboarding Form' : 'Complete Your Profile'}
        </h1>
        <p className="text-muted-foreground">
          {isHRMode 
            ? 'Fill in employee details section by section'
            : 'Please fill in your information completely to proceed with onboarding'
          }
        </p>
      </div>

      {/* Progress */}
      <Card className="p-6 rounded-2xl bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">Form Completion</h3>
            <span className="font-medium">{calculateProgress()}%</span>
          </div>
          <Progress value={calculateProgress()} className="h-2" />
          
          {/* Section Progress */}
          <div className="grid grid-cols-6 gap-2 mt-6">
            {sections.map((section, index) => (
              <div key={index} className="text-center">
                <div className={`w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center ${
                  index <= currentSection 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted text-muted-foreground'
                }`}>
                  <section.icon className="w-5 h-5" />
                </div>
                <p className="text-xs font-medium">{section.title.split(' ')[0]}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Form Content */}
      <div className="space-y-6">
        {renderCurrentSection()}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button 
          variant="outline" 
          onClick={handlePrevious}
          disabled={currentSection === 0}
          className="rounded-xl"
        >
          Previous
        </Button>
        
        <div className="flex gap-2">
          {currentSection === sections.length - 1 ? (
            <Button 
              onClick={handleSubmit}
              className="rounded-xl bg-green-600 hover:bg-green-700"
            >
              <Check className="w-4 h-4 mr-2" />
              Submit Form
            </Button>
          ) : (
            <Button onClick={handleNext} className="rounded-xl">
              Next Section
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingForm;
