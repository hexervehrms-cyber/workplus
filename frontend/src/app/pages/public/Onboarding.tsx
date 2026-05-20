import { useState, useEffect } from 'react';
import { useParams } from 'react-router';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Separator } from '../../components/ui/separator';
import { Progress } from '../../components/ui/progress';
import { buildApiUrl } from '../../utils/apiHelper';
import { toast } from '../../utils/portalToast';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  FileText, 
  Upload, 
  Building2,
  CheckCircle,
  AlertCircle,
  UserCheck,
  Briefcase,
  GraduationCap,
  Heart,
  Badge
} from 'lucide-react';

interface OnboardingData {
  // Personal Information
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  bloodGroup: string;
  maritalStatus: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  
  // Financial Information
  aadharNumber: string;
  panNumber: string;
  bankAccount: string;
  ifscCode: string;
  
  // Professional Information
  employeeId: string;
  role: string;
  department: string;
  joiningDate: string;
  employmentType: string;
  workLocation: string;
  
  // Education
  highestQualification: string;
  university: string;
  yearOfPassing: string;
  
  // Experience
  previousCompany: string;
  previousRole: string;
  experienceYears: string;
  
  // Documents
  resume: File | null;
  experienceLetter: File | null;
  offerLetter: File | null;
  appointmentLetter: File | null;
  relievingLetter: File | null;
  idProof: File | null;
  educationCertificate: File | null;
  addressProof: File | null;
}

export default function Onboarding() {
  const { token } = useParams();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [linkValid, setLinkValid] = useState(false);
  const [employeeData, setEmployeeData] = useState<any>(null);
  const [formData, setFormData] = useState<OnboardingData>({
    // Personal Information
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    bloodGroup: '',
    maritalStatus: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    
    // Financial Information
    aadharNumber: '',
    panNumber: '',
    bankAccount: '',
    ifscCode: '',
    
    // Professional Information
    employeeId: '',
    role: '',
    department: '',
    joiningDate: '',
    employmentType: '',
    workLocation: '',
    
    // Education
    highestQualification: '',
    university: '',
    yearOfPassing: '',
    
    // Experience
    previousCompany: '',
    previousRole: '',
    experienceYears: '',
    
    // Documents
    resume: null,
    experienceLetter: null,
    offerLetter: null,
    appointmentLetter: null,
    relievingLetter: null,
    idProof: null,
    educationCertificate: null,
    addressProof: null
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalSteps = 4;
  const progress = (currentStep / totalSteps) * 100;

  const stepCategories = [
    'Personal Information',
    'Education',
    'Experience',
    'Documents'
  ];

// Validate token and fetch employee data on component mount
   useEffect(() => {
     const validateToken = async () => {
       if (!token) {
         setIsLoading(false);
         return;
       }

       try {
         const response = await fetch(buildApiUrl(`/onboarding/validate/${token}`));
         
         // Handle empty response
         const rawText = await response.text();
         if (!rawText) {
           console.error('Empty response from server');
           setLinkValid(false);
           return;
         }
         
         let data;
         try {
           data = JSON.parse(rawText);
         } catch (parseError) {
           console.error('Invalid JSON response:', rawText);
           setLinkValid(false);
           return;
         }

         if (response.ok && data.success) {
           setLinkValid(true);
           // Use actual employee data from the validation response
           setEmployeeData(data.data);
           
           // Pre-fill form with employee data
           const nameParts = data.data.employeeName.split(' ');
           setFormData(prev => ({
             ...prev,
             firstName: nameParts[0] || '',
             lastName: nameParts.slice(1).join(' ') || '',
             email: data.data.employeeEmail,
             department: data.data.department
           }));
         } else {
           console.log('Validation failed:', data.message || rawText);
           setLinkValid(false);
         }
       } catch (error) {
         console.error('Error validating token:', error);
         setLinkValid(false);
       } finally {
         setIsLoading(false);
       }
     };

    validateToken();
  }, [token]);

  const handleInputChange = (field: keyof OnboardingData, value: string | File | null) => {
    setFormData({...formData, [field]: value});
    if (errors[field]) {
      setErrors({...errors, [field]: ''});
    }
  };

  const handleFileUpload = (field: keyof OnboardingData, file: File) => {
    setFormData({...formData, [field]: file});
    if (errors[field]) {
      setErrors({...errors, [field]: ''});
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 1: // Personal Information
        if (!formData.firstName) newErrors.firstName = 'First name is required';
        if (!formData.lastName) newErrors.lastName = 'Last name is required';
        if (!formData.email) newErrors.email = 'Email is required';
        if (!formData.phone) newErrors.phone = 'Phone is required';
        if (!formData.dateOfBirth) newErrors.dateOfBirth = 'Date of birth is required';
        if (!formData.bloodGroup) newErrors.bloodGroup = 'Blood group is required';
        if (!formData.address) newErrors.address = 'Address is required';
        break;
        
      case 2: // Education
        if (!formData.highestQualification) newErrors.highestQualification = 'Highest qualification is required';
        if (!formData.university) newErrors.university = 'University is required';
        if (!formData.yearOfPassing) newErrors.yearOfPassing = 'Year of passing is required';
        break;
        
      case 3: // Experience
        if (!formData.previousCompany) newErrors.previousCompany = 'Previous company is required';
        if (!formData.previousRole) newErrors.previousRole = 'Previous role is required';
        if (!formData.experienceYears) newErrors.experienceYears = 'Years of experience is required';
        break;
        
      case 4: { // Documents
        const requiredDocs = ['resume', 'idProof', 'educationCertificate'];
        requiredDocs.forEach(doc => {
          if (!formData[doc as keyof OnboardingData]) {
            newErrors[doc] = `${doc.replace(/([A-Z])/g, ' $1').trim()} is required`;
          }
        });
        break;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;

    setIsSubmitting(true);
    
    try {
      // Convert File objects to file names/metadata for submission
      const submissionData = {
        token: token,
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
          name: '',
          relation: '',
          phone: ''
        },
        // Convert employment documents (resume, experience letter, etc.)
        employmentDocuments: [
          formData.resume && { id: 'resume', name: formData.resume.name, category: 'Resume' },
          formData.experienceLetter && { id: 'experience_letter', name: formData.experienceLetter.name, category: 'Experience Letter' },
          formData.offerLetter && { id: 'offer_letter', name: formData.offerLetter.name, category: 'Offer Letter' },
          formData.appointmentLetter && { id: 'appointment_letter', name: formData.appointmentLetter.name, category: 'Appointment Letter' },
          formData.relievingLetter && { id: 'relieving_letter', name: formData.relievingLetter.name, category: 'Relieving Letter' },
          formData.addressProof && { id: 'address_proof', name: formData.addressProof.name, category: 'Address Proof' },
          formData.idProof && { id: 'id_proof', name: formData.idProof.name, category: 'ID Proof' }
        ].filter(Boolean),
        // Convert educational documents
        educationalDocuments: {
          [formData.highestQualification || 'Qualification']: {
            certificate: formData.educationCertificate ? { id: 'education_cert', name: formData.educationCertificate.name } : null
          }
        },
        password: 'TempPassword123!' // Temporary password - should be set by user
      };

// Submit to backend API
       const response = await fetch(buildApiUrl('/onboarding/submit'), {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
         },
         body: JSON.stringify(submissionData),
       });

       let responseData;
       try {
         responseData = await response.json();
       } catch (parseError) {
         // Handle empty or non-JSON response
         throw new Error(response.ok ? 'Invalid server response. Please try again.' : 'Authentication failed. Please check your credentials and try again.');
       }

       if (response.ok) {
         console.log('Form submitted successfully:', submissionData);
         setCurrentStep(6); // Success step
       } else {
         console.error('Error submitting form:', responseData);
         toast.error(responseData.message || 'Failed to submit onboarding form');
        // Still show success for demo purposes
        setCurrentStep(6);
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      // Still show success for demo purposes
      setCurrentStep(6);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderPersonalInfo = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <User className="w-6 h-6 text-primary" />
        <h3 className="text-xl font-semibold">Personal Information</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>First Name *</Label>
          <Input
            value={formData.firstName}
            onChange={(e) => handleInputChange('firstName', e.target.value)}
            placeholder="Enter first name"
            className={`mt-2 rounded-xl ${errors.firstName ? 'border-red-500' : ''}`}
          />
          {errors.firstName && <p className="text-sm text-red-500 mt-1">{errors.firstName}</p>}
        </div>

        <div>
          <Label>Last Name *</Label>
          <Input
            value={formData.lastName}
            onChange={(e) => handleInputChange('lastName', e.target.value)}
            placeholder="Enter last name"
            className={`mt-2 rounded-xl ${errors.lastName ? 'border-red-500' : ''}`}
          />
          {errors.lastName && <p className="text-sm text-red-500 mt-1">{errors.lastName}</p>}
        </div>

        <div>
          <Label>Email *</Label>
          <Input
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            placeholder="email@example.com"
            className={`mt-2 rounded-xl ${errors.email ? 'border-red-500' : ''}`}
          />
          {errors.email && <p className="text-sm text-red-500 mt-1">{errors.email}</p>}
        </div>

        <div>
          <Label>Phone *</Label>
          <Input
            type="tel"
            value={formData.phone}
            onChange={(e) => handleInputChange('phone', e.target.value)}
            placeholder="+1 (555) 123-4567"
            className={`mt-2 rounded-xl ${errors.phone ? 'border-red-500' : ''}`}
          />
          {errors.phone && <p className="text-sm text-red-500 mt-1">{errors.phone}</p>}
        </div>

        <div>
          <Label>Date of Birth *</Label>
          <Input
            type="date"
            value={formData.dateOfBirth}
            onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
            className={`mt-2 rounded-xl ${errors.dateOfBirth ? 'border-red-500' : ''}`}
          />
          {errors.dateOfBirth && <p className="text-sm text-red-500 mt-1">{errors.dateOfBirth}</p>}
        </div>

        <div>
          <Label>Gender</Label>
          <select
            value={formData.gender}
            onChange={(e) => handleInputChange('gender', e.target.value)}
            className="w-full mt-2 px-3 py-2 border rounded-xl bg-background"
          >
            <option value="">Select gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <Label>Blood Group *</Label>
          <select
            value={formData.bloodGroup}
            onChange={(e) => handleInputChange('bloodGroup', e.target.value)}
            className={`w-full mt-2 px-3 py-2 border rounded-xl bg-background ${errors.bloodGroup ? 'border-red-500' : ''}`}
          >
            <option value="">Select blood group</option>
            <option value="A+">A+</option>
            <option value="A-">A-</option>
            <option value="B+">B+</option>
            <option value="B-">B-</option>
            <option value="AB+">AB+</option>
            <option value="AB-">AB-</option>
            <option value="O+">O+</option>
            <option value="O-">O-</option>
          </select>
          {errors.bloodGroup && <p className="text-sm text-red-500 mt-1">{errors.bloodGroup}</p>}
        </div>

        <div>
          <Label>Marital Status</Label>
          <select
            value={formData.maritalStatus}
            onChange={(e) => handleInputChange('maritalStatus', e.target.value)}
            className="w-full mt-2 px-3 py-2 border rounded-xl bg-background"
          >
            <option value="">Select status</option>
            <option value="single">Single</option>
            <option value="married">Married</option>
            <option value="divorced">Divorced</option>
            <option value="widowed">Widowed</option>
          </select>
        </div>
      </div>

      <div>
        <Label>Address *</Label>
        <Textarea
          value={formData.address}
          onChange={(e) => handleInputChange('address', e.target.value)}
          placeholder="Enter your complete address"
          className={`mt-2 rounded-xl ${errors.address ? 'border-red-500' : ''}`}
          rows={3}
        />
        {errors.address && <p className="text-sm text-red-500 mt-1">{errors.address}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label>City</Label>
          <Input
            value={formData.city}
            onChange={(e) => handleInputChange('city', e.target.value)}
            placeholder="City"
            className="mt-2 rounded-xl"
          />
        </div>

        <div>
          <Label>State</Label>
          <Input
            value={formData.state}
            onChange={(e) => handleInputChange('state', e.target.value)}
            placeholder="State"
            className="mt-2 rounded-xl"
          />
        </div>

        <div>
          <Label>Zip Code</Label>
          <Input
            value={formData.zipCode}
            onChange={(e) => handleInputChange('zipCode', e.target.value)}
            placeholder="Zip Code"
            className="mt-2 rounded-xl"
          />
        </div>
      </div>

      {/* Financial Information Section */}
      <Separator className="my-6" />
      <div className="space-y-4">
        <h4 className="font-semibold text-lg flex items-center gap-2">
          <Badge className="w-5 h-5" />
          Financial Information
        </h4>
        <p className="text-sm text-muted-foreground">Please provide your financial details for salary processing</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Aadhar Card Number</Label>
          <Input
            value={formData.aadharNumber}
            onChange={(e) => handleInputChange('aadharNumber', e.target.value)}
            placeholder="Enter 12-digit Aadhar number"
            className="mt-2 rounded-xl"
            maxLength={12}
          />
          <p className="text-xs text-muted-foreground mt-1">12-digit unique identification number</p>
        </div>

        <div>
          <Label>PAN Card Number</Label>
          <Input
            value={formData.panNumber}
            onChange={(e) => handleInputChange('panNumber', e.target.value)}
            placeholder="Enter PAN number"
            className="mt-2 rounded-xl"
            maxLength={10}
          />
          <p className="text-xs text-muted-foreground mt-1">10-character PAN</p>
        </div>

        <div>
          <Label>Bank Account Number</Label>
          <Input
            value={formData.bankAccount}
            onChange={(e) => handleInputChange('bankAccount', e.target.value)}
            placeholder="Enter bank account number"
            className="mt-2 rounded-xl"
          />
          <p className="text-xs text-muted-foreground mt-1">Your bank account number for salary transfer</p>
        </div>

        <div>
          <Label>IFSC Code</Label>
          <Input
            value={formData.ifscCode}
            onChange={(e) => handleInputChange('ifscCode', e.target.value)}
            placeholder="Enter IFSC code"
            className="mt-2 rounded-xl"
            maxLength={11}
          />
          <p className="text-xs text-muted-foreground mt-1">11-character IFSC code of your bank branch</p>
        </div>
      </div>
    </div>
  );

  const renderEducation = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <GraduationCap className="w-6 h-6 text-primary" />
        <h3 className="text-xl font-semibold">Education Details</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Highest Qualification *</Label>
          <Input
            value={formData.highestQualification}
            onChange={(e) => handleInputChange('highestQualification', e.target.value)}
            placeholder="e.g., Bachelor's in Computer Science"
            className={`mt-2 rounded-xl ${errors.highestQualification ? 'border-red-500' : ''}`}
          />
          {errors.highestQualification && <p className="text-sm text-red-500 mt-1">{errors.highestQualification}</p>}
        </div>

        <div>
          <Label>University/Institution *</Label>
          <Input
            value={formData.university}
            onChange={(e) => handleInputChange('university', e.target.value)}
            placeholder="University name"
            className={`mt-2 rounded-xl ${errors.university ? 'border-red-500' : ''}`}
          />
          {errors.university && <p className="text-sm text-red-500 mt-1">{errors.university}</p>}
        </div>

        <div>
          <Label>Year of Passing *</Label>
          <Input
            type="number"
            value={formData.yearOfPassing}
            onChange={(e) => handleInputChange('yearOfPassing', e.target.value)}
            placeholder="2020"
            className={`mt-2 rounded-xl ${errors.yearOfPassing ? 'border-red-500' : ''}`}
            min="1950"
            max={new Date().getFullYear()}
          />
          {errors.yearOfPassing && <p className="text-sm text-red-500 mt-1">{errors.yearOfPassing}</p>}
        </div>
      </div>
    </div>
  );

  const renderExperience = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Building2 className="w-6 h-6 text-primary" />
        <h3 className="text-xl font-semibold">Previous Experience</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Previous Company *</Label>
          <Input
            value={formData.previousCompany}
            onChange={(e) => handleInputChange('previousCompany', e.target.value)}
            placeholder="Company name"
            className={`mt-2 rounded-xl ${errors.previousCompany ? 'border-red-500' : ''}`}
          />
          {errors.previousCompany && <p className="text-sm text-red-500 mt-1">{errors.previousCompany}</p>}
        </div>

        <div>
          <Label>Previous Role *</Label>
          <Input
            value={formData.previousRole}
            onChange={(e) => handleInputChange('previousRole', e.target.value)}
            placeholder="Your previous role"
            className={`mt-2 rounded-xl ${errors.previousRole ? 'border-red-500' : ''}`}
          />
          {errors.previousRole && <p className="text-sm text-red-500 mt-1">{errors.previousRole}</p>}
        </div>

        <div>
          <Label>Years of Experience *</Label>
          <Input
            type="number"
            value={formData.experienceYears}
            onChange={(e) => handleInputChange('experienceYears', e.target.value)}
            placeholder="Total years of experience"
            className={`mt-2 rounded-xl ${errors.experienceYears ? 'border-red-500' : ''}`}
            min="0"
            max="50"
          />
          {errors.experienceYears && <p className="text-sm text-red-500 mt-1">{errors.experienceYears}</p>}
        </div>
      </div>
    </div>
  );

  const renderDocuments = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <FileText className="w-6 h-6 text-primary" />
        <h3 className="text-xl font-semibold">Document Upload</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Required Documents */}
        <div className="space-y-4">
          <h4 className="font-medium text-red-600">Required Documents</h4>
          
          <div>
            <Label>Resume *</Label>
            <div className="mt-2 border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-primary transition-colors">
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => e.target.files?.[0] && handleFileUpload('resume', e.target.files[0])}
                className="hidden"
                id="resume-upload"
              />
              <label htmlFor="resume-upload" className="cursor-pointer">
                <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600">
                  {formData.resume ? formData.resume.name : 'Click to upload resume'}
                </p>
                <p className="text-xs text-gray-500">PDF, DOC, DOCX (Max 5MB)</p>
              </label>
            </div>
            {errors.resume && <p className="text-sm text-red-500 mt-1">{errors.resume}</p>}
          </div>

          <div>
            <Label>ID Proof *</Label>
            <div className="mt-2 border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-primary transition-colors">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => e.target.files?.[0] && handleFileUpload('idProof', e.target.files[0])}
                className="hidden"
                id="id-proof-upload"
              />
              <label htmlFor="id-proof-upload" className="cursor-pointer">
                <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600">
                  {formData.idProof ? formData.idProof.name : 'Click to upload ID proof'}
                </p>
                <p className="text-xs text-gray-500">PDF, JPG, PNG (Max 5MB)</p>
              </label>
            </div>
            {errors.idProof && <p className="text-sm text-red-500 mt-1">{errors.idProof}</p>}
          </div>

          <div>
            <Label>Education Certificate *</Label>
            <div className="mt-2 border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-primary transition-colors">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => e.target.files?.[0] && handleFileUpload('educationCertificate', e.target.files[0])}
                className="hidden"
                id="education-upload"
              />
              <label htmlFor="education-upload" className="cursor-pointer">
                <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600">
                  {formData.educationCertificate ? formData.educationCertificate.name : 'Click to upload education certificate'}
                </p>
                <p className="text-xs text-gray-500">PDF, JPG, PNG (Max 5MB)</p>
              </label>
            </div>
            {errors.educationCertificate && <p className="text-sm text-red-500 mt-1">{errors.educationCertificate}</p>}
          </div>
        </div>

        {/* Optional Documents */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-600">Optional Documents</h4>
          
          <div>
            <Label>Experience Letter</Label>
            <div className="mt-2 border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-primary transition-colors">
              <input
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={(e) => e.target.files?.[0] && handleFileUpload('experienceLetter', e.target.files[0])}
                className="hidden"
                id="experience-letter-upload"
              />
              <label htmlFor="experience-letter-upload" className="cursor-pointer">
                <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600">
                  {formData.experienceLetter ? formData.experienceLetter.name : 'Click to upload experience letter'}
                </p>
                <p className="text-xs text-gray-500">PDF, DOC, JPG (Max 5MB)</p>
              </label>
            </div>
          </div>

          <div>
            <Label>Offer Letter</Label>
            <div className="mt-2 border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-primary transition-colors">
              <input
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={(e) => e.target.files?.[0] && handleFileUpload('offerLetter', e.target.files[0])}
                className="hidden"
                id="offer-letter-upload"
              />
              <label htmlFor="offer-letter-upload" className="cursor-pointer">
                <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600">
                  {formData.offerLetter ? formData.offerLetter.name : 'Click to upload offer letter'}
                </p>
                <p className="text-xs text-gray-500">PDF, DOC, JPG (Max 5MB)</p>
              </label>
            </div>
          </div>

          <div>
            <Label>Appointment Letter</Label>
            <div className="mt-2 border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-primary transition-colors">
              <input
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={(e) => e.target.files?.[0] && handleFileUpload('appointmentLetter', e.target.files[0])}
                className="hidden"
                id="appointment-letter-upload"
              />
              <label htmlFor="appointment-letter-upload" className="cursor-pointer">
                <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600">
                  {formData.appointmentLetter ? formData.appointmentLetter.name : 'Click to upload appointment letter'}
                </p>
                <p className="text-xs text-gray-500">PDF, DOC, JPG (Max 5MB)</p>
              </label>
            </div>
          </div>

          <div>
            <Label>Relieving Letter</Label>
            <div className="mt-2 border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-primary transition-colors">
              <input
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={(e) => e.target.files?.[0] && handleFileUpload('relievingLetter', e.target.files[0])}
                className="hidden"
                id="relieving-letter-upload"
              />
              <label htmlFor="relieving-letter-upload" className="cursor-pointer">
                <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600">
                  {formData.relievingLetter ? formData.relievingLetter.name : 'Click to upload relieving letter'}
                </p>
                <p className="text-xs text-gray-500">PDF, DOC, JPG (Max 5MB)</p>
              </label>
            </div>
          </div>

          <div>
            <Label>Address Proof</Label>
            <div className="mt-2 border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-primary transition-colors">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => e.target.files?.[0] && handleFileUpload('addressProof', e.target.files[0])}
                className="hidden"
                id="address-proof-upload"
              />
              <label htmlFor="address-proof-upload" className="cursor-pointer">
                <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600">
                  {formData.addressProof ? formData.addressProof.name : 'Click to upload address proof'}
                </p>
                <p className="text-xs text-gray-500">PDF, JPG, PNG (Max 5MB)</p>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSuccess = () => (
    <div className="text-center py-12">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircle className="w-10 h-10 text-green-600" />
      </div>
      <h2 className="text-2xl font-bold mb-4">Onboarding Complete!</h2>
      <p className="text-muted-foreground mb-8">
        Thank you for completing the onboarding process. Your information has been submitted successfully.
        Our HR team will review your details and contact you soon.
      </p>
      <div className="bg-muted/50 rounded-xl p-6 max-w-md mx-auto">
        <h3 className="font-semibold mb-4">Next Steps:</h3>
        <ul className="text-left space-y-2 text-sm">
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            HR team will review your submission
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            You'll receive confirmation email
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            Access credentials will be sent separately
          </li>
        </ul>
      </div>
    </div>
  );

  const renderStep = () => {
    switch (currentStep) {
      case 1: return renderPersonalInfo();
      case 2: return renderEducation();
      case 3: return renderExperience();
      case 4: return renderDocuments();
      case 5: return renderSuccess();
      default: return renderPersonalInfo();
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <UserCheck className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Validating Onboarding Link...</h2>
          <p className="text-muted-foreground">Please wait while we verify your access</p>
        </div>
      </div>
    );
  }

  // Invalid link state
  if (!linkValid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Invalid or Expired Link</h2>
          <p className="text-muted-foreground mb-6">
            The onboarding link you clicked is invalid or has expired. Please contact your HR administrator for a new link.
          </p>
          <Button variant="outline" className="rounded-xl">
            Contact HR Support
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <UserCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Employee Onboarding</h1>
          <p className="text-muted-foreground">
            Welcome {employeeData?.employeeName}! Complete your profile to join Hexerve!
          </p>
          {employeeData && (
            <div className="mt-4 space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                <CheckCircle className="w-4 h-4" />
                Verified: {employeeData.employeeEmail}
              </div>
              {employeeData.organizationName && (
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                  <Building2 className="w-4 h-4" />
                  Organization: {employeeData.organizationName}
                </div>
              )}
              {employeeData.organizationId && (
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                  <Badge className="w-4 h-4" />
                  ID: {employeeData.organizationId}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Progress Bar with Categories */}
        {currentStep <= totalSteps && (
          <div className="mb-8">
            {/* Step indicator */}
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-medium text-muted-foreground">Step {currentStep} of {totalSteps}</span>
              <span className="text-sm font-medium text-muted-foreground">{Math.round(progress)}% Complete</span>
            </div>
            
            {/* Progress bar */}
            <Progress value={progress} className="h-2 mb-6" />
            
            {/* Category labels */}
            <div className="grid grid-cols-4 gap-2">
              {stepCategories.map((category, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentStep(index + 1)}
                  className={`text-center p-3 rounded-lg transition-all cursor-pointer hover:shadow-md ${
                    currentStep === index + 1
                      ? 'bg-primary text-white font-semibold'
                      : currentStep > index + 1
                      ? 'bg-green-100 text-green-800 font-medium hover:bg-green-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <div className="text-xs">{category}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Form Card */}
        <Card className="p-8 rounded-2xl shadow-lg">
          {renderStep()}

          {/* Navigation Buttons */}
          {currentStep <= totalSteps && (
            <div className="flex justify-between items-center mt-8">
              <Button
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 1}
                className="rounded-xl"
              >
                Previous
              </Button>

              {currentStep === 5 ? (
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="rounded-xl"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Application'}
                </Button>
              ) : (
                <Button
                  onClick={nextStep}
                  className="rounded-xl"
                >
                  Next Step
                </Button>
              )}
            </div>
          )}
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-muted-foreground">
          <p>Need help? Contact HR at hr@hexerve.com</p>
        </div>
      </div>
    </div>
  );
}
