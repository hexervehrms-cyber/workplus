import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { User, Mail, Phone, MapPin, Calendar, Briefcase, FileText, Lock, AlertCircle, CheckCircle, Loader, Upload, Check, Download, Trash2, Camera } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { PasswordInput } from '../../components/PasswordInput';
import { Label } from '../../components/ui/label';
import { Separator } from '../../components/ui/separator';
import { Progress } from '../../components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { toast } from 'sonner';
import { buildApiUrl } from '../../utils/apiHelper';

interface FormData {
  // Personal Information
  firstName: string;
  lastName: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  profilePhoto?: File | null;

  // Confidential Information
  aadharNumber: string;
  panNumber: string;
  bankAccount: string;
  ifscCode: string;

  // Emergency Contact
  emergencyName: string;
  emergencyRelation: string;
  emergencyPhone: string;

  // Login Credentials
  password: string;
  confirmPassword: string;
}

interface Document {
  _id: string;
  name: string;
  size: string;
  uploadedAt: string;
  status: string;
  filePath?: string;
}

interface EducationDocuments {
  [key: string]: { certificate?: Document; marksheet?: Document };
}

interface OnboardingData {
  employeeEmail: string;
  employeeName: string;
  department: string;
  organizationName: string;
}

const OnboardingPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentSection, setCurrentSection] = useState(0);
  const [onboardingData, setOnboardingData] = useState<OnboardingData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    address: '',
    profilePhoto: null,
    aadharNumber: '',
    panNumber: '',
    bankAccount: '',
    ifscCode: '',
    emergencyName: '',
    emergencyRelation: '',
    emergencyPhone: '',
    password: '',
    confirmPassword: ''
  });

  // Educational Documents State
  const [educationalDocuments, setEducationalDocuments] = useState<EducationDocuments>({
    '10th': {},
    '12th': {},
    'Graduation': {},
    'Post Graduation': {},
    'Diploma': {},
    'Certificate': {},
    'Drop out': {}
  });

  // Employment Documents State
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('Letter of Intent');

  // Load documents from localStorage on mount
  useEffect(() => {
    const savedEducationalDocs = localStorage.getItem('onboarding_educational_docs');
    const savedEmploymentDocs = localStorage.getItem('onboarding_employment_docs');
    const savedCategory = localStorage.getItem('onboarding_selected_category');
    const savedFormData = localStorage.getItem('onboarding_form_data');

    if (savedEducationalDocs) {
      try {
        setEducationalDocuments(JSON.parse(savedEducationalDocs));
      } catch (e) {
        console.error('Failed to load educational documents from localStorage:', e);
      }
    }

    if (savedEmploymentDocs) {
      try {
        setDocuments(JSON.parse(savedEmploymentDocs));
      } catch (e) {
        console.error('Failed to load employment documents from localStorage:', e);
      }
    }

    if (savedCategory) {
      setSelectedCategory(savedCategory);
    }

    if (savedFormData) {
      try {
        const parsedFormData = JSON.parse(savedFormData);
        setFormData(prev => ({
          ...prev,
          ...parsedFormData
        }));
      } catch (e) {
        console.error('Failed to load form data from localStorage:', e);
      }
    }
  }, []);

  // Save documents to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('onboarding_educational_docs', JSON.stringify(educationalDocuments));
  }, [educationalDocuments]);

  useEffect(() => {
    localStorage.setItem('onboarding_employment_docs', JSON.stringify(documents));
  }, [documents]);

  useEffect(() => {
    localStorage.setItem('onboarding_selected_category', selectedCategory);
  }, [selectedCategory]);

  // Save form data to localStorage
  useEffect(() => {
    localStorage.setItem('onboarding_form_data', JSON.stringify(formData));
  }, [formData]);

  // Photo preview state
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Load photo from localStorage on mount
  useEffect(() => {
    const savedPhoto = localStorage.getItem('onboarding_profile_photo');
    if (savedPhoto) {
      setPhotoPreview(savedPhoto);
    }
  }, []);

  const documentCategories = [
    'Letter of Intent',
    'Offer Letter',
    'Appointment Letter',
    'Appraisal Letter',
    'Salary Slips',
    'Experience Letter',
    'Relieving Letter'
  ];

  const sections = [
    { title: 'Personal Information', icon: User },
    { title: 'Profile Photo', icon: Upload },
    { title: 'Emergency Contact', icon: Phone },
    { title: 'Banking Information', icon: Lock },
    { title: 'Educational Documents', icon: FileText },
    { title: 'Experience Document', icon: Upload },
    { title: 'Login Credentials', icon: Lock },
    { title: 'Review & Submit', icon: CheckCircle }
  ];

  // Validate onboarding link on mount
  useEffect(() => {
    const validateLink = async () => {
      if (!token) {
        setError('Invalid onboarding link');
        setValidating(false);
        return;
      }

      try {
        // Use buildApiUrl to ensure correct API endpoint
        const apiUrl = buildApiUrl(`/onboarding/validate/${token}`);
        console.log('🔗 [ONBOARDING] Validating link:', { token: token.substring(0, 10) + '...', apiUrl });
        
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });
        
        const data = await response.json();

        if (!response.ok) {
          console.error('❌ [ONBOARDING] Validation failed:', { status: response.status, message: data.message });
          setError(data.message || 'Invalid or expired onboarding link');
          setValidating(false);
          return;
        }

        console.log('✅ [ONBOARDING] Link validated successfully:', { employeeName: data.data?.employeeName });
        setOnboardingData(data.data);
        setFormData(prev => ({
          ...prev,
          department: data.data.department
        }));
        setValidating(false);
      } catch (err) {
        console.error('❌ [ONBOARDING] Validation error:', err);
        setError('Failed to validate onboarding link. Please check your connection and try again.');
        setValidating(false);
      }
    };

    validateLink();
  }, [token, buildApiUrl]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle profile photo upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    // Store file in formData
    setFormData(prev => ({
      ...prev,
      profilePhoto: file
    }));

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      const preview = reader.result as string;
      setPhotoPreview(preview);
      localStorage.setItem('onboarding_profile_photo', preview);
      toast.success('Photo uploaded successfully');
    };
    reader.readAsDataURL(file);
  };

  // Remove profile photo
  const removeProfilePhoto = () => {
    setFormData(prev => ({
      ...prev,
      profilePhoto: null
    }));
    setPhotoPreview(null);
    localStorage.removeItem('onboarding_profile_photo');
    toast.success('Photo removed');
  };

  // Handle educational document selection (store file references, not upload)
  const handleEducationDocumentUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    educationLevel: string,
    docType: 'certificate' | 'marksheet'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Store file reference locally (will be uploaded after profile creation)
      const newDoc: Document = {
        _id: `temp_${Date.now()}_${Math.random()}`,
        name: file.name,
        size: `${(file.size / 1024).toFixed(1)} KB`,
        uploadedAt: new Date().toLocaleDateString(),
        status: 'Pending Upload',
        filePath: ''
      };

      setEducationalDocuments((prev) => ({
        ...prev,
        [educationLevel]: {
          ...prev[educationLevel],
          [docType]: newDoc
        }
      }));

      toast.success(`${educationLevel} ${docType} selected successfully`);
      
      if (e.target) {
        e.target.value = '';
      }
    } catch (error) {
      console.error('Error selecting education document:', error);
      toast.error('Failed to select document');
      
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  // Handle employment document selection (store file references, not upload)
  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Store file reference locally (will be uploaded after profile creation)
      const newDoc: Document = {
        _id: `temp_${Date.now()}_${Math.random()}`,
        name: file.name,
        size: `${(file.size / 1024).toFixed(1)} KB`,
        uploadedAt: new Date().toLocaleDateString(),
        status: 'Pending Upload',
        filePath: ''
      };

      setDocuments([newDoc, ...documents]);

      toast.success('Document selected successfully');
      
      if (e.target) {
        e.target.value = '';
      }
    } catch (error) {
      console.error('Error selecting document:', error);
      toast.error('Failed to select document');
      
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  const calculateEducationProgress = () => {
    const educationLevels = Object.keys(educationalDocuments);
    let totalSlots = educationLevels.length * 2;
    let filledSlots = 0;

    Object.values(educationalDocuments).forEach((docs) => {
      if (docs.certificate) filledSlots++;
      if (docs.marksheet) filledSlots++;
    });

    return Math.round((filledSlots / totalSlots) * 100);
  };

  // Delete educational document
  const deleteEducationDocument = (educationLevel: string, docType: 'certificate' | 'marksheet') => {
    setEducationalDocuments((prev) => ({
      ...prev,
      [educationLevel]: {
        ...prev[educationLevel],
        [docType]: undefined
      }
    }));
    toast.success(`${educationLevel} ${docType} removed`);
  };

  // Delete employment document
  const deleteEmploymentDocument = (docId: string) => {
    setDocuments((prev) => prev.filter((doc) => doc._id !== docId));
    toast.success('Document removed');
  };

  // Password strength calculator
  const getPasswordStrength = (password: string): number => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[!@#$%^&*]/.test(password)) strength++;
    return Math.min(strength, 4); // Return 0-4
  };

  // Validate password requirements
  const isPasswordValid = (password: string): boolean => {
    return (
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[0-9]/.test(password) &&
      /[!@#$%^&*]/.test(password)
    );
  };

  const validateSection = (section: number): boolean => {
    switch (section) {
      case 0: // Personal Information
        return !!(formData.firstName && formData.lastName && formData.phone && formData.dateOfBirth && formData.gender && formData.address);
      case 1: // Profile Photo
        return !!formData.profilePhoto; // Photo is required
      case 2: // Emergency Contact
        return !!(formData.emergencyName && formData.emergencyRelation && formData.emergencyPhone);
      case 3: // Banking Information
        return !!(formData.aadharNumber && formData.panNumber && formData.bankAccount && formData.ifscCode);
      case 4: // Educational Documents
        return true; // Optional
      case 5: // Upload Documents
        return true; // Optional
      case 6: // Login Credentials
        return !!(formData.password && formData.confirmPassword && isPasswordValid(formData.password) && formData.password === formData.confirmPassword);
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateSection(currentSection)) {
      if (currentSection < sections.length - 1) {
        setCurrentSection(currentSection + 1);
      }
    } else {
      toast.error('Please fill in all required fields');
    }
  };

  const handlePrevious = () => {
    if (currentSection > 0) {
      setCurrentSection(currentSection - 1);
    }
  };

  const handleSubmit = async () => {
    if (!token) {
      toast.error('Invalid onboarding link');
      return;
    }

    try {
      setSubmitting(true);

      // Prepare educational documents data
      const educationData = Object.entries(educationalDocuments).reduce((acc, [level, docs]) => {
        acc[level] = {
          certificate: docs.certificate ? { id: docs.certificate._id, name: docs.certificate.name } : null,
          marksheet: docs.marksheet ? { id: docs.marksheet._id, name: docs.marksheet.name } : null
        };
        return acc;
      }, {} as any);

      // Prepare employment documents data
      const docsData = documents.map(doc => ({
        id: doc._id,
        name: doc.name,
        category: selectedCategory
      }));

      const apiUrl = buildApiUrl('/onboarding/submit');
      console.log('📤 [ONBOARDING] Submitting form:', { token: token.substring(0, 10) + '...', apiUrl });

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          token,
          profilePhoto: photoPreview, // Send the base64 photo
          personalInfo: {
            firstName: formData.firstName,
            lastName: formData.lastName,
            phone: formData.phone,
            dateOfBirth: formData.dateOfBirth,
            gender: formData.gender,
            address: formData.address
          },
          sensitiveInfo: {
            aadharNumber: formData.aadharNumber,
            panNumber: formData.panNumber,
            bankAccount: formData.bankAccount,
            ifscCode: formData.ifscCode
          },
          emergencyContact: {
            name: formData.emergencyName,
            relation: formData.emergencyRelation,
            phone: formData.emergencyPhone
          },
          educationalDocuments: educationData,
          employmentDocuments: docsData,
          password: formData.password // Include password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to submit onboarding form');
      }

      toast.success('✅ Onboarding completed! Your employee profile has been created.');
      
      console.log('Employee Profile Created:', {
        userId: data.data.userId,
        employeeId: data.data.employeeId,
        submissionId: data.data.submissionId
      });

      // Clear localStorage after successful submission
      localStorage.removeItem('onboarding_educational_docs');
      localStorage.removeItem('onboarding_employment_docs');
      localStorage.removeItem('onboarding_selected_category');
      localStorage.removeItem('onboarding_profile_photo');

      setTimeout(() => {
        navigate('/');
      }, 3000);
    } catch (err) {
      console.error('Submit error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to submit onboarding form');
    } finally {
      setSubmitting(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5">
        <Card className="p-8 rounded-2xl text-center">
          <Loader className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Validating your onboarding link...</p>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5 p-4">
        <Card className="p-8 rounded-2xl max-w-md w-full">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto mb-4">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-center mb-2">Invalid Link</h2>
          <p className="text-muted-foreground text-center mb-6">{error}</p>
          <Button 
            className="w-full rounded-xl"
            onClick={() => navigate('/')}
          >
            Go to Home
          </Button>
        </Card>
      </div>
    );
  }

  if (!onboardingData) {
    return null;
  }

  const progressPercentage = ((currentSection + 1) / sections.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Welcome to {onboardingData.organizationName}</h1>
          <p className="text-muted-foreground">Complete your employee onboarding form</p>
        </div>

        {/* Progress */}
        <Card className="p-6 rounded-2xl mb-8">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Step {currentSection + 1} of {sections.length}</span>
              <span className="text-sm text-muted-foreground">{Math.round(progressPercentage)}%</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>
        </Card>

        {/* Section Tabs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-8">
          {sections.map((section, index) => {
            const Icon = section.icon;
            const isActive = index === currentSection;
            const isCompleted = index < currentSection;

            return (
              <button
                key={index}
                onClick={() => index <= currentSection && setCurrentSection(index)}
                className={`p-3 rounded-xl transition-all ${
                  isActive
                    ? 'bg-primary text-white shadow-lg'
                    : isCompleted
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                } ${index <= currentSection ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
              >
                <Icon className="w-4 h-4 mx-auto mb-1" />
                <span className="text-xs font-medium text-center block">{section.title.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>

        {/* Form Content */}
        <Card className="p-8 rounded-2xl mb-8">
          {/* Personal Information */}
          {currentSection === 0 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-6">Personal Information</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label>First Name *</Label>
                  <Input
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    placeholder="Enter your first name"
                    className="mt-2 rounded-xl"
                  />
                </div>
                <div>
                  <Label>Last Name *</Label>
                  <Input
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    placeholder="Enter your last name"
                    className="mt-2 rounded-xl"
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    value={onboardingData.employeeEmail}
                    disabled
                    className="mt-2 rounded-xl bg-muted"
                  />
                </div>
                <div>
                  <Label>Phone Number *</Label>
                  <Input
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="Enter your phone number"
                    className="mt-2 rounded-xl"
                  />
                </div>
                <div>
                  <Label>Date of Birth *</Label>
                  <Input
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleInputChange}
                    className="mt-2 rounded-xl"
                  />
                </div>
                <div>
                  <Label>Gender *</Label>
                  <Select value={formData.gender} onValueChange={(value) => handleSelectChange('gender', value)}>
                    <SelectTrigger className="mt-2 rounded-xl">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label>Address *</Label>
                  <Textarea
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder="Enter your address"
                    className="mt-2 rounded-xl"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Profile Photo */}
          {currentSection === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-6">Profile Photo</h2>
                <p className="text-muted-foreground">Upload a professional photo to be used as your profile picture</p>
              </div>

              <div className="flex flex-col items-center justify-center gap-6">
                {/* Photo Preview */}
                <div className="w-48 h-48 rounded-full border-4 border-dashed border-primary/30 flex items-center justify-center bg-primary/5 overflow-hidden">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Profile preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Camera className="w-12 h-12 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">No photo selected</p>
                    </div>
                  )}
                </div>

                {/* Upload Input */}
                <div className="w-full max-w-md">
                  <Label htmlFor="photo-upload" className="cursor-pointer">
                    <div className="border-2 border-dashed border-primary/30 rounded-xl p-6 text-center hover:border-primary/50 transition-colors">
                      <Upload className="w-8 h-8 mx-auto mb-2 text-primary" />
                      <p className="font-semibold text-primary">Click to upload photo</p>
                      <p className="text-sm text-muted-foreground mt-1">PNG, JPG, GIF up to 5MB</p>
                    </div>
                  </Label>
                  <input
                    id="photo-upload"
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </div>

                {/* Remove Button */}
                {photoPreview && (
                  <Button
                    variant="destructive"
                    onClick={removeProfilePhoto}
                    className="rounded-xl"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remove Photo
                  </Button>
                )}

                {/* Validation Message */}
                {!formData.profilePhoto && (
                  <div className="w-full bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
                    ⚠️ Profile photo is required to proceed
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Emergency Contact */}
          {currentSection === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-6">Emergency Contact</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label>Contact Name *</Label>
                  <Input
                    name="emergencyName"
                    value={formData.emergencyName}
                    onChange={handleInputChange}
                    placeholder="Enter emergency contact name"
                    className="mt-2 rounded-xl"
                  />
                </div>
                <div>
                  <Label>Relationship *</Label>
                  <Input
                    name="emergencyRelation"
                    value={formData.emergencyRelation}
                    onChange={handleInputChange}
                    placeholder="e.g., Spouse, Parent, Sibling"
                    className="mt-2 rounded-xl"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Phone Number *</Label>
                  <Input
                    name="emergencyPhone"
                    value={formData.emergencyPhone}
                    onChange={handleInputChange}
                    placeholder="Enter emergency contact phone number"
                    className="mt-2 rounded-xl"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Banking Information */}
          {currentSection === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-6">Banking Information</h2>
                <p className="text-sm text-muted-foreground mb-6">This information is securely stored and used for salary processing</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label>Aadhar Number *</Label>
                  <Input
                    name="aadharNumber"
                    value={formData.aadharNumber}
                    onChange={handleInputChange}
                    placeholder="Enter your Aadhar number"
                    className="mt-2 rounded-xl"
                  />
                </div>
                <div>
                  <Label>PAN Number *</Label>
                  <Input
                    name="panNumber"
                    value={formData.panNumber}
                    onChange={handleInputChange}
                    placeholder="Enter your PAN number"
                    className="mt-2 rounded-xl"
                  />
                </div>
                <div>
                  <Label>Bank Account Number *</Label>
                  <Input
                    name="bankAccount"
                    value={formData.bankAccount}
                    onChange={handleInputChange}
                    placeholder="Enter your bank account number"
                    className="mt-2 rounded-xl"
                  />
                </div>
                <div>
                  <Label>IFSC Code *</Label>
                  <Input
                    name="ifscCode"
                    value={formData.ifscCode}
                    onChange={handleInputChange}
                    placeholder="Enter your IFSC code"
                    className="mt-2 rounded-xl"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Educational Documents */}
          {currentSection === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">Educational Documents</h2>
                <p className="text-sm text-muted-foreground mb-6">Upload your certificates and marksheets for each education level (Optional)</p>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Documents Uploaded</span>
                  <span className="font-medium">{calculateEducationProgress()}%</span>
                </div>
                <Progress value={calculateEducationProgress()} className="h-2" />
              </div>

              {/* Education Levels Grid */}
              <div className="space-y-4">
                {Object.entries(educationalDocuments).map(([level, docs]) => (
                  <div key={level} className="border border-border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-sm">{level}</h4>
                      <div className="flex gap-2">
                        {docs.certificate && (
                          <Badge variant="default" className="bg-green-600">
                            Certificate ✓
                          </Badge>
                        )}
                        {docs.marksheet && (
                          <Badge variant="default" className="bg-blue-600">
                            Marksheet ✓
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Certificate Upload */}
                      <div className="border-2 border-dashed rounded-lg p-4 text-center bg-muted/30 hover:bg-muted/50 transition-colors">
                        <input
                          type="file"
                          id={`cert-${level}`}
                          className="hidden"
                          onChange={(e) => handleEducationDocumentUpload(e, level, 'certificate')}
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        />
                        <label htmlFor={`cert-${level}`} className="cursor-pointer block">
                          {docs.certificate ? (
                            <div className="flex flex-col items-center gap-2">
                              <Check className="w-5 h-5 text-green-600" />
                              <p className="text-xs font-medium text-green-600">Certificate Selected</p>
                              <p className="text-xs text-muted-foreground">{docs.certificate.name}</p>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="mt-2 rounded-lg"
                                onClick={(e) => {
                                  e.preventDefault();
                                  deleteEducationDocument(level, 'certificate');
                                }}
                              >
                                <Trash2 className="w-3 h-3 mr-1" />
                                Remove
                              </Button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-2">
                              <Upload className="w-5 h-5 text-muted-foreground" />
                              <p className="text-xs font-medium">Select Certificate</p>
                              <p className="text-xs text-muted-foreground">PDF, DOC, DOCX, JPG, PNG</p>
                            </div>
                          )}
                        </label>
                      </div>

                      {/* Marksheet Upload */}
                      <div className="border-2 border-dashed rounded-lg p-4 text-center bg-muted/30 hover:bg-muted/50 transition-colors">
                        <input
                          type="file"
                          id={`mark-${level}`}
                          className="hidden"
                          onChange={(e) => handleEducationDocumentUpload(e, level, 'marksheet')}
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        />
                        <label htmlFor={`mark-${level}`} className="cursor-pointer block">
                          {docs.marksheet ? (
                            <div className="flex flex-col items-center gap-2">
                              <Check className="w-5 h-5 text-green-600" />
                              <p className="text-xs font-medium text-green-600">Marksheet Selected</p>
                              <p className="text-xs text-muted-foreground">{docs.marksheet.name}</p>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="mt-2 rounded-lg"
                                onClick={(e) => {
                                  e.preventDefault();
                                  deleteEducationDocument(level, 'marksheet');
                                }}
                              >
                                <Trash2 className="w-3 h-3 mr-1" />
                                Remove
                              </Button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-2">
                              <Upload className="w-5 h-5 text-muted-foreground" />
                              <p className="text-xs font-medium">Select Marksheet</p>
                              <p className="text-xs text-muted-foreground">PDF, DOC, DOCX, JPG, PNG</p>
                            </div>
                          )}
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload Your Documents */}
          {currentSection === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">Upload your experience document</h2>
                <p className="text-sm text-muted-foreground mb-6">Upload employment documents from your earlier organization (Optional)</p>
              </div>

              {/* Document Categories Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                {documentCategories.map((category) => (
                  <div
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      selectedCategory === category
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FileText className={`w-4 h-4 ${selectedCategory === category ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className={`text-sm font-medium ${selectedCategory === category ? 'text-primary' : 'text-foreground'}`}>
                        {category}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Upload Area */}
              <div className="border-2 border-dashed rounded-xl p-8 text-center bg-muted/30 hover:bg-muted/50 transition-colors">
                <input
                  type="file"
                  id="category-doc-upload"
                  className="hidden"
                  onChange={handleDocumentUpload}
                  accept=".pdf,.doc,.docx"
                />
                <label htmlFor="category-doc-upload" className="cursor-pointer block">
                  <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm font-medium mb-1">Click to select or drag and drop</p>
                  <p className="text-xs text-muted-foreground mb-3">PDF, DOC, DOCX up to 10MB</p>
                  <p className="text-xs text-primary font-medium">Selected: {selectedCategory}</p>
                </label>
              </div>

              {/* Uploaded Documents List */}
              {documents.length > 0 && (
                <div className="pt-6 border-t border-border">
                  <h4 className="font-semibold text-sm mb-4">Selected Documents</h4>
                  <div className="space-y-3">
                    {documents.map((doc) => (
                      <div key={doc._id} className="flex items-center justify-between p-4 rounded-lg bg-accent/50 border border-border">
                        <div className="flex items-center gap-3 flex-1">
                          <FileText className="w-5 h-5 text-primary" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{doc.name}</p>
                            <p className="text-xs text-muted-foreground">{doc.size} • {doc.uploadedAt}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={doc.status === 'Verified' ? 'default' : 'secondary'} className="text-xs">
                            {doc.status}
                          </Badge>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="rounded-lg"
                            onClick={() => deleteEmploymentDocument(doc._id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Login Credentials */}
          {currentSection === 6 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-6">Login Credentials</h2>
                <p className="text-sm text-muted-foreground mb-6">Create a secure password for your account login</p>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div>
                  <Label>Password *</Label>
                  <PasswordInput
                    autoComplete="new-password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="Enter a strong password"
                    className="mt-2 rounded-xl"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Password must be at least 8 characters with uppercase, lowercase, number, and special character
                  </p>
                  
                  {/* Password Strength Indicator */}
                  {formData.password && (
                    <div className="mt-3 space-y-2">
                      <div className="flex gap-1">
                        {[0, 1, 2, 3].map((i) => {
                          const strength = getPasswordStrength(formData.password);
                          const isFilled = i < strength;
                          return (
                            <div
                              key={i}
                              className={`h-2 flex-1 rounded-full transition-colors ${
                                isFilled
                                  ? strength === 1
                                    ? 'bg-red-500'
                                    : strength === 2
                                    ? 'bg-yellow-500'
                                    : strength === 3
                                    ? 'bg-blue-500'
                                    : 'bg-green-500'
                                  : 'bg-muted'
                              }`}
                            />
                          );
                        })}
                      </div>
                      <p className="text-xs font-medium">
                        Strength: {
                          getPasswordStrength(formData.password) === 1
                            ? 'Weak'
                            : getPasswordStrength(formData.password) === 2
                            ? 'Fair'
                            : getPasswordStrength(formData.password) === 3
                            ? 'Good'
                            : 'Strong'
                        }
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <Label>Confirm Password *</Label>
                  <PasswordInput
                    autoComplete="new-password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    placeholder="Re-enter your password"
                    className="mt-2 rounded-xl"
                  />
                  {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                    <p className="text-xs text-red-600 mt-2">Passwords do not match</p>
                  )}
                  {formData.confirmPassword && formData.password === formData.confirmPassword && (
                    <p className="text-xs text-green-600 mt-2">✓ Passwords match</p>
                  )}
                </div>

                {/* Password Requirements */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
                  <p className="text-sm font-semibold text-blue-900">Password Requirements:</p>
                  <ul className="text-xs text-blue-800 space-y-1">
                    <li className={formData.password?.length >= 8 ? 'text-green-600' : ''}>
                      ✓ At least 8 characters
                    </li>
                    <li className={/[A-Z]/.test(formData.password) ? 'text-green-600' : ''}>
                      ✓ At least one uppercase letter
                    </li>
                    <li className={/[a-z]/.test(formData.password) ? 'text-green-600' : ''}>
                      ✓ At least one lowercase letter
                    </li>
                    <li className={/[0-9]/.test(formData.password) ? 'text-green-600' : ''}>
                      ✓ At least one number
                    </li>
                    <li className={/[!@#$%^&*]/.test(formData.password) ? 'text-green-600' : ''}>
                      ✓ At least one special character (!@#$%^&*)
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Review & Submit */}
          {currentSection === 7 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-6">Review Your Information</h2>
              </div>

              <div className="space-y-6">
                {/* Profile Photo */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Camera className="w-4 h-4" />
                    Profile Photo
                  </h3>
                  {photoPreview ? (
                    <div className="w-32 h-32 rounded-full border-2 border-primary overflow-hidden">
                      <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No photo uploaded</p>
                  )}
                </div>

                <Separator />

                {/* Personal Information */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Personal Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 p-4 rounded-lg">
                    <div>
                      <span className="text-muted-foreground">First Name:</span>
                      <p className="font-medium">{formData.firstName}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Last Name:</span>
                      <p className="font-medium">{formData.lastName}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Email:</span>
                      <p className="font-medium">{onboardingData?.employeeEmail}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Phone:</span>
                      <p className="font-medium">{formData.phone}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Date of Birth:</span>
                      <p className="font-medium">{formData.dateOfBirth}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Gender:</span>
                      <p className="font-medium">{formData.gender}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Address:</span>
                      <p className="font-medium">{formData.address}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Emergency Contact */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Emergency Contact
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 p-4 rounded-lg">
                    <div>
                      <span className="text-muted-foreground">Contact Name:</span>
                      <p className="font-medium">{formData.emergencyName}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Relationship:</span>
                      <p className="font-medium">{formData.emergencyRelation}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Phone Number:</span>
                      <p className="font-medium">{formData.emergencyPhone}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Banking Information */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Banking Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div>
                      <span className="text-muted-foreground">Aadhar Number:</span>
                      <p className="font-medium">{formData.aadharNumber}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">PAN Number:</span>
                      <p className="font-medium">{formData.panNumber}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Bank Account Number:</span>
                      <p className="font-medium">{formData.bankAccount}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">IFSC Code:</span>
                      <p className="font-medium">{formData.ifscCode}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Login Credentials */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Login Credentials
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Password:</span>
                      <p className="font-medium">••••••••</p>
                    </div>
                  </div>
                </div>

                <Separator />
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Educational Documents
                  </h3>
                  <div className="space-y-2 text-sm">
                    {Object.entries(educationalDocuments).map(([level, docs]) => (
                      (docs.certificate || docs.marksheet) && (
                        <div key={level} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <span className="font-medium">{level}</span>
                          <div className="flex gap-2">
                            {docs.certificate && <Badge className="bg-green-600 text-xs">Certificate</Badge>}
                            {docs.marksheet && <Badge className="bg-blue-600 text-xs">Marksheet</Badge>}
                          </div>
                        </div>
                      )
                    ))}
                    {Object.values(educationalDocuments).every(docs => !docs.certificate && !docs.marksheet) && (
                      <p className="text-muted-foreground italic">No educational documents uploaded</p>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Employment Documents Summary */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Employment Documents
                  </h3>
                  <div className="space-y-2 text-sm">
                    {documents.length > 0 ? (
                      documents.map((doc) => (
                        <div key={doc._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <span className="font-medium">{doc.name}</span>
                          <Badge variant="secondary" className="text-xs">{doc.status}</Badge>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground italic">No employment documents uploaded</p>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-sm text-blue-900">
                    ✓ By submitting this form, you confirm that all the information provided is accurate and complete.
                  </p>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Navigation Buttons */}
        <div className="flex justify-between gap-4">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentSection === 0}
            className="rounded-xl"
          >
            ← Previous
          </Button>

          {currentSection < sections.length - 1 ? (
            <Button
              onClick={handleNext}
              className="rounded-xl"
            >
              Next →
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-xl bg-green-600 hover:bg-green-700"
            >
              {submitting ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Submit Onboarding
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
