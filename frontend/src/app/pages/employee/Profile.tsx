import { User, Mail, Phone, MapPin, Calendar, Briefcase, FileText, Edit, Lock, Globe, Loader, X, Upload, Download, Trash2, Check, LockOpen, Clock } from 'lucide-react';
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
import { apiGet, apiPost, apiPut, apiDelete, apiUpload } from '../../utils/apiHelper';

// IndexedDB helper functions
const DB_NAME = 'WorkplusDB';
const STORE_NAME = 'documents';

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: '_id' });
      }
    };
  });
};

const saveDocumentToDB = async (doc: Document): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(doc);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

const getDocumentsFromDB = async (): Promise<Document[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
};

const deleteDocumentFromDB = async (docId: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(docId);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

const clearDocumentsFromDB = async (): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

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
  sensitiveInfoLocks?: {
    aadharNumber?: number;
    panNumber?: number;
    bankAccount?: number;
    ifscCode?: number;
  };
}

interface Document {
  _id: string;
  name: string;
  size: string;
  uploadedAt: string;
  status: string;
  filePath?: string;
  category?: string;
  fileBlob?: Blob;
}

export default function Profile() {
  const { selectedCurrency, formatCurrency } = useCurrency();
  const [showCurrencySelector, setShowCurrencySelector] = useState(false);
  const [employee, setEmployee] = useState<EmployeeData | null>(null);
  const [loading, setLoading] = useState(true);

  // State declarations - MUST be before useEffect hooks
  const [isEditingPersonal, setIsEditingPersonal] = useState(false);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  
  // Initialize documents from IndexedDB to prevent race condition
  const [documents, setDocuments] = useState<Document[]>([]);
  
  const [uploadingFile, setUploadingFile] = useState(false);
  const [documentType, setDocumentType] = useState<'personal' | 'experience'>('personal');
  const [selectedCategory, setSelectedCategory] = useState<string>('Letter of Intent');

  // Educational Documents State - Initialize from localStorage
  const [educationalDocuments, setEducationalDocuments] = useState<{
    [key: string]: { certificate?: Document; marksheet?: Document; others?: Document };
  }>(() => {
    try {
      const stored = localStorage.getItem('educationalDocuments');
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed;
      }
    } catch (error) {
      console.error('Error initializing educational documents from storage:', error);
    }
    return {
      '10th': {},
      '12th': {},
      'Graduation': {},
      'Post Graduation': {},
      'Diploma': {},
      'Certificate': {},
      'Drop out': {}
    };
  });
  const [uploadingEducation, setUploadingEducation] = useState<string | null>(null);
  const [uploadingEducationType, setUploadingEducationType] = useState<'certificate' | 'marksheet' | 'others' | null>(null);
  const [submittingEducation, setSubmittingEducation] = useState(false);
  const [submittingDocuments, setSubmittingDocuments] = useState(false);

  // Confidential Information Lock States
  const [isEditingSensitive, setIsEditingSensitive] = useState(false);
  const [sensitiveForm, setSensitiveForm] = useState({
    aadharNumber: '',
    panNumber: '',
    bankAccount: '',
    ifscCode: ''
  });
  const [lockedFields, setLockedFields] = useState<{ [key: string]: boolean }>({
    aadharNumber: false,
    panNumber: false,
    bankAccount: false,
    ifscCode: false
  });
  const [lockTimestamps, setLockTimestamps] = useState<{ [key: string]: number }>({});
  const [remainingTime, setRemainingTime] = useState<{ [key: string]: string }>({});

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

  useEffect(() => {
    fetchEmployeeData();
    
    // Load documents from backend
    const loadDocuments = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const userId = localStorage.getItem('userId');
        
        if (!userId) {
          console.warn('No userId found in localStorage');
          return;
        }

        try {
          const data = await apiGet(`/documents/employee/${userId}`);
          const backendDocs = data.data || [];
          
          setDocuments(backendDocs);
        } catch (error) {
          console.error('Error loading documents from backend:', error);
        }
      } catch (error) {
        console.error('Error loading documents from backend:', error);
      }
    };
    
    loadDocuments();
    // Commented out until backend endpoint is created
    // fetchEducationalDocuments();
  }, []);



  // Documents are now persisted on the backend, no need to save to IndexedDB
  // This useEffect is kept for reference but disabled
  /*
  useEffect(() => {
    const saveDocuments = async () => {
      try {
        // Clear old documents and save new ones
        await clearDocumentsFromDB();
        
        for (const doc of documents) {
          await saveDocumentToDB(doc);
        }
        
        console.log('Saved', documents.length, 'documents to IndexedDB');
      } catch (error) {
        console.error('Error saving documents to IndexedDB:', error);
        if (error instanceof Error && error.name === 'QuotaExceededError') {
          toast.error('Storage quota exceeded. Please delete some documents.');
        }
      }
    };
    
    if (documents.length > 0 || documents.length === 0) {
      saveDocuments();
    }
  }, [documents]);
  */

  // Save educational documents to localStorage whenever they change
  useEffect(() => {
    try {
      const serialized = JSON.stringify(educationalDocuments);
      // Check localStorage size (most browsers have 5-10MB limit)
      const sizeInBytes = new Blob([serialized]).size;
      
      if (sizeInBytes > 5 * 1024 * 1024) {
        console.warn('Educational documents exceed 5MB limit, may not persist');
      }
      
      localStorage.setItem('educationalDocuments', serialized);
    } catch (error) {
      console.error('Error saving educational documents to storage:', error);
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        toast.error('Storage quota exceeded. Please delete some documents.');
      }
    }
  }, [educationalDocuments]);

  // Fetch educational documents
  const fetchEducationalDocuments = async () => {
    try {
      const data = await apiGet('/employee-dashboard/documents?type=education');
      
      if (data.success && data.data && Array.isArray(data.data)) {
        // Parse and organize documents by education level and type
        const organizedDocs: {
          [key: string]: { certificate?: Document; marksheet?: Document; others?: Document };
        } = {
          '10th': {},
          '12th': {},
          'Graduation': {},
          'Post Graduation': {},
          'Diploma': {},
          'Certificate': {},
          'Drop out': {}
        };

        // Process each document and place it in the correct category
        data.data.forEach((doc: any) => {
          const docType = doc.type || '';
          // Parse type like "education_10th_certificate"
          const match = docType.match(/education_(.+)_(certificate|marksheet|others)/);
          
          if (match) {
            const levelKey = match[1].replace(/_/g, ' ');
            const docTypeKey = match[2] as 'certificate' | 'marksheet' | 'others';
            
            // Find matching education level (case-insensitive)
            const educationLevel = Object.keys(organizedDocs).find(
              level => level.toLowerCase().replace(/\s+/g, '_') === levelKey.toLowerCase()
            );
            
            if (educationLevel) {
              const document: Document = {
                _id: doc._id || doc.id,
                name: doc.name,
                size: doc.size || 'Unknown',
                uploadedAt: doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : 'Unknown',
                status: doc.status || 'uploaded',
                filePath: doc.filePath || doc.url
              };
              
              organizedDocs[educationLevel][docTypeKey] = document;
            }
          }
        });

        setEducationalDocuments(organizedDocs);
      }
    } catch (error) {
      console.error('Error fetching educational documents:', error);
    }
  };

  const fetchEmployeeData = async () => {
    try {
      setLoading(true);
      const data = await apiGet('/profile');
      const payload = data?.data || data;
      const profileData = payload?.user || {};
      const employeeProfile = payload?.employee || {};
      
      // Ensure all required fields are present
      const employeeData: EmployeeData = {
        _id: employeeProfile?._id || profileData?._id || '',
        firstName: employeeProfile?.firstName || profileData?.profile?.firstName || '',
        lastName: employeeProfile?.lastName || profileData?.profile?.lastName || '',
        email: profileData?.email || '',
        phone: employeeProfile?.phone || profileData?.contact?.phone || '',
        dateOfBirth: '',
        gender: '',
        address: employeeProfile?.address || profileData?.contact?.address?.street || '',
        employeeId: employeeProfile?.employeeId || employeeProfile?.employeeCode || '',
        department: employeeProfile?.department || '',
        designation: employeeProfile?.designation || '',
        joiningDate: employeeProfile?.joiningDate || '',
        employmentType: '',
        workLocation: employeeProfile?.workLocation || '',
        aadharNumber: employeeProfile?.aadharNumber || '',
        panNumber: employeeProfile?.panNumber || '',
        bankAccount: employeeProfile?.bankAccount || employeeProfile?.bankDetails?.accountNumber || '',
        ifscCode: employeeProfile?.ifscCode || employeeProfile?.bankDetails?.ifscCode || '',
        sensitiveInfoLocks: employeeProfile?.sensitiveInfoLocks || {}
      };
      
      setEmployee(employeeData);
      
      // Directly update form states
      setPersonalForm({
        firstName: employeeData.firstName,
        lastName: employeeData.lastName,
        phone: employeeData.phone,
        dateOfBirth: '',
        gender: '',
        address: employeeData.address
      });

      setOfficialForm({
        employeeId: employeeData.employeeId,
        joiningDate: employeeData.joiningDate ? (typeof employeeData.joiningDate === 'string' ? employeeData.joiningDate.split('T')[0] : new Date(employeeData.joiningDate).toISOString().split('T')[0]) : '',
        department: employeeData.department,
        designation: employeeData.designation
      });
    } catch (error) {
      console.error('❌ Error fetching employee data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Initialize sensitive form and check lock status
  useEffect(() => {
    if (employee) {
      setSensitiveForm({
        aadharNumber: employee.aadharNumber || '',
        panNumber: employee.panNumber || '',
        bankAccount: employee.bankAccount || '',
        ifscCode: employee.ifscCode || ''
      });

      // Check lock status for each field
      if (employee.sensitiveInfoLocks) {
        const now = Date.now();
        const LOCK_DURATION = 12 * 60 * 60 * 1000; // 12 hours in milliseconds

        const newLockedFields: { [key: string]: boolean } = {};
        const newLockTimestamps: { [key: string]: number } = {};

        Object.entries(employee.sensitiveInfoLocks).forEach(([field, timestamp]) => {
          if (timestamp) {
            const timeSinceLock = now - timestamp;
            const isLocked = timeSinceLock < LOCK_DURATION;
            newLockedFields[field] = isLocked;
            if (isLocked) {
              newLockTimestamps[field] = timestamp;
            }
          }
        });

        setLockedFields(newLockedFields);
        setLockTimestamps(newLockTimestamps);
      }
    }
  }, [employee]);

  // Update countdown timers
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const LOCK_DURATION = 12 * 60 * 60 * 1000;
      const newRemainingTime: { [key: string]: string } = {};
      const newLockedFields: { [key: string]: boolean } = { ...lockedFields };

      Object.entries(lockTimestamps).forEach(([field, timestamp]) => {
        const timeSinceLock = now - timestamp;
        const timeRemaining = LOCK_DURATION - timeSinceLock;

        if (timeRemaining > 0) {
          const hours = Math.floor(timeRemaining / (60 * 60 * 1000));
          const minutes = Math.floor((timeRemaining % (60 * 60 * 1000)) / (60 * 1000));
          newRemainingTime[field] = `${hours}h ${minutes}m`;
          newLockedFields[field] = true;
        } else {
          newLockedFields[field] = false;
          delete newRemainingTime[field];
        }
      });

      setRemainingTime(newRemainingTime);
      setLockedFields(newLockedFields);
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [lockTimestamps]);

  const documentCategories = [
    'Letter of Intent',
    'Offer Letter',
    'Appointment Letter',
    'Appraisal Letter',
    'Salary Slips',
    'Experience Letter',
    'Relieving Letter'
  ];

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader className="w-8 h-8 animate-spin" />
          <p className="text-muted-foreground"></p>
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
      await apiPut('/profile', {
        profile: {
          firstName: personalForm.firstName,
          lastName: personalForm.lastName
        },
        contact: {
          phone: personalForm.phone,
          address: {
            street: personalForm.address
          }
        },
        employeeDetails: {
          phone: personalForm.phone,
          address: personalForm.address
        }
      });

      // Add a small delay to ensure database is updated
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Refresh employee data from backend to ensure consistency
      await fetchEmployeeData();

      setIsEditingPersonal(false);
      toast.success('Personal information updated successfully');
    } catch (error) {
      console.error('❌ Error updating profile:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update personal information');
    }
  };

  // Handle document upload
  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingFile(true);
      const token = localStorage.getItem('authToken');
      
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('document', file);
      formData.append('name', selectedCategory);
      formData.append('type', documentType);

      // Upload to backend
      const data = await apiUpload('/documents/upload', formData);
      const uploadedDoc = data.data;

      // Create document object with backend data
      const newDoc: Document = {
        _id: uploadedDoc._id,
        name: uploadedDoc.name,
        size: uploadedDoc.size,
        uploadedAt: new Date(uploadedDoc.uploadedAt).toLocaleDateString(),
        status: uploadedDoc.status,
        filePath: uploadedDoc.filePath,
        category: uploadedDoc.type
      };

      // Update state
      setDocuments([newDoc, ...documents]);

      toast.success(`${selectedCategory} uploaded successfully`);
      
      // Reset file input
      if (e.target) {
        e.target.value = '';
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error(error instanceof Error ? error.message : 'An unexpected error occurred. Please try again later.');
      
      // Reset file input on error
      if (e.target) {
        e.target.value = '';
      }
    } finally {
      setUploadingFile(false);
    }
  };

  // Calculate educational documents progress
  const calculateEducationProgress = () => {
    const educationLevels = Object.keys(educationalDocuments);
    let totalSlots = educationLevels.length * 3; // 3 documents per level (certificate + marksheet + others)
    let filledSlots = 0;

    Object.values(educationalDocuments).forEach((docs) => {
      if (docs.certificate) filledSlots++;
      if (docs.marksheet) filledSlots++;
      if (docs.others) filledSlots++;
    });

    return Math.round((filledSlots / totalSlots) * 100);
  };

  // Handle educational document upload
  const handleEducationDocumentUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    educationLevel: string,
    docType: 'certificate' | 'marksheet' | 'others'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingFile(true);
      
      // Convert file to base64 for storage
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      
      // Simulate upload delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Create document object
      const newDoc: Document = {
        _id: `temp_${Date.now()}`,
        name: file.name,
        size: `${(file.size / 1024).toFixed(2)} KB`,
        uploadedAt: new Date().toLocaleDateString(),
        status: 'uploaded',
        filePath: base64 // Store base64 data
      };

      // Update state
      setEducationalDocuments((prev) => ({
        ...prev,
        [educationLevel]: {
          ...prev[educationLevel],
          [docType]: newDoc
        }
      }));

      toast.success(`${educationLevel} ${docType} uploaded successfully`);
      
      // Reset selections after successful upload
      setUploadingEducation(null);
      setUploadingEducationType(null);
      
      // Reset file input
      if (e.target) {
        e.target.value = '';
      }
    } catch (error) {
      console.error('Error uploading education document:', error);
      toast.error(error instanceof Error ? error.message : 'An unexpected error occurred. Please try again later.');
      
      // Reset file input on error
      if (e.target) {
        e.target.value = '';
      }
    } finally {
      setUploadingFile(false);
    }
  };

  // Handle confidential information update
  const handleUpdateSensitive = async () => {
    try {
      const data = await apiPut('/profile', {
        sensitiveInfo: {
          aadharNumber: sensitiveForm.aadharNumber,
          panNumber: sensitiveForm.panNumber,
          bankAccount: sensitiveForm.bankAccount,
          ifscCode: sensitiveForm.ifscCode
        }
      });

      console.log('Confidential info update response:', data);

      // Add a small delay to ensure database is updated
      await new Promise(resolve => setTimeout(resolve, 500));

      // Refresh employee data from backend to ensure consistency
      await fetchEmployeeData();

      setIsEditingSensitive(false);
      toast.success('Confidential information updated and locked for 12 hours');
    } catch (error) {
      console.error('Error updating confidential information:', error);
      toast.error('Failed to update confidential information');
    }
  };

  // Handle educational documents submission
  const handleSubmitEducationalDocuments = async () => {
    try {
      setSubmittingEducation(true);
      
      // Prepare educational documents data
      const educationData = Object.entries(educationalDocuments).reduce((acc, [level, docs]) => {
        acc[level] = {
          certificate: docs.certificate ? { id: docs.certificate._id, name: docs.certificate.name } : null,
          marksheet: docs.marksheet ? { id: docs.marksheet._id, name: docs.marksheet.name } : null,
          others: docs.others ? { id: docs.others._id, name: docs.others.name } : null
        };
        return acc;
      }, {} as any);

      await apiPut('/profile', {
        educationalDocuments: educationData
      });

      toast.success('Educational documents submitted successfully');
    } catch (error) {
      console.error('Error submitting educational documents:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit educational documents');
    } finally {
      setSubmittingEducation(false);
    }
  };

  // Handle employment documents submission
  const handleSubmitEmploymentDocuments = async () => {
    try {
      setSubmittingDocuments(true);
      
      // Prepare employment documents data
      const docsData = documents.map(doc => ({
        id: doc._id,
        name: doc.name,
        category: selectedCategory
      }));

      await apiPut('/profile', {
        employmentDocuments: docsData
      });

      toast.success('Employment documents submitted successfully');
    } catch (error) {
      console.error('Error submitting employment documents:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit employment documents');
    } finally {
      setSubmittingDocuments(false);
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
            <span className="font-medium">{Math.min(75 + Math.floor((documents.length / 7) * 25), 100)}%</span>
          </div>
          <Progress value={Math.min(75 + Math.floor((documents.length / 7) * 25), 100)} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {documents.length === 0 
              ? 'Upload documents to complete your profile' 
              : `${documents.length} of 7 documents uploaded`}
          </p>
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
              <div>
                <h3 className="font-semibold text-lg">Official Information</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  <Lock className="w-3 h-3 inline mr-1" />
                  This information can only be edited by Admin/HR
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label>Employee ID</Label>
                <Input 
                  value={officialForm.employeeId}
                  disabled={true}
                  className="mt-2 rounded-xl bg-muted cursor-not-allowed"
                  placeholder="Enter employee ID"
                />
              </div>
              <div>
                <Label>Joining Date</Label>
                <Input 
                  type="date" 
                  value={officialForm.joiningDate}
                  disabled={true}
                  className="mt-2 rounded-xl bg-muted cursor-not-allowed"
                />
              </div>
              <div>
                <Label>Department</Label>
                <Input 
                  value={officialForm.department}
                  disabled={true}
                  className="mt-2 rounded-xl bg-muted cursor-not-allowed"
                  placeholder="Enter department"
                />
              </div>
              <div>
                <Label>Designation</Label>
                <Input 
                  value={officialForm.designation}
                  disabled={true}
                  className="mt-2 rounded-xl bg-muted cursor-not-allowed"
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

          {/* Confidential Information */}
          <Card className="p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold text-lg">Confidential Information</h3>
                <p className="text-sm text-muted-foreground">Locked fields for security - 12 hour edit restriction</p>
              </div>
              {!isEditingSensitive ? (
                <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setIsEditingSensitive(true)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setIsEditingSensitive(false)}>
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button size="sm" className="rounded-xl" onClick={handleUpdateSensitive}>
                    <Check className="w-4 h-4 mr-2" />
                    Save & Lock
                  </Button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label>Aadhar Number</Label>
                <div className="mt-2 flex items-center gap-2">
                  {isEditingSensitive ? (
                    <Input 
                      value={sensitiveForm.aadharNumber}
                      onChange={(e) => setSensitiveForm({...sensitiveForm, aadharNumber: e.target.value})}
                      disabled={lockedFields.aadharNumber}
                      className={`rounded-xl ${lockedFields.aadharNumber ? 'bg-muted cursor-not-allowed' : 'bg-background border-primary'}`}
                      placeholder="Enter Aadhar number"
                    />
                  ) : (
                    <Input 
                      value={employee.aadharNumber ? '**** **** ****' : 'Not provided'} 
                      disabled 
                      className="rounded-xl bg-muted" 
                    />
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="rounded-xl"
                    disabled={!isEditingSensitive || lockedFields.aadharNumber}
                    title={lockedFields.aadharNumber ? `Locked for ${remainingTime.aadharNumber || '12h'}` : 'Field is editable'}
                  >
                    {lockedFields.aadharNumber ? (
                      <div className="flex items-center gap-1">
                        <Lock className="w-4 h-4" />
                        <span className="text-xs">{remainingTime.aadharNumber}</span>
                      </div>
                    ) : (
                      <LockOpen className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div>
                <Label>PAN Number</Label>
                <div className="mt-2 flex items-center gap-2">
                  {isEditingSensitive ? (
                    <Input 
                      value={sensitiveForm.panNumber}
                      onChange={(e) => setSensitiveForm({...sensitiveForm, panNumber: e.target.value})}
                      disabled={lockedFields.panNumber}
                      className={`rounded-xl ${lockedFields.panNumber ? 'bg-muted cursor-not-allowed' : 'bg-background border-primary'}`}
                      placeholder="Enter PAN number"
                    />
                  ) : (
                    <Input 
                      value={employee.panNumber ? '*****' + employee.panNumber.slice(-4) : 'Not provided'} 
                      disabled 
                      className="rounded-xl bg-muted" 
                    />
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="rounded-xl"
                    disabled={!isEditingSensitive || lockedFields.panNumber}
                    title={lockedFields.panNumber ? `Locked for ${remainingTime.panNumber || '12h'}` : 'Field is editable'}
                  >
                    {lockedFields.panNumber ? (
                      <div className="flex items-center gap-1">
                        <Lock className="w-4 h-4" />
                        <span className="text-xs">{remainingTime.panNumber}</span>
                      </div>
                    ) : (
                      <LockOpen className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div>
                <Label>Bank Account</Label>
                <div className="mt-2 flex items-center gap-2">
                  {isEditingSensitive ? (
                    <Input 
                      value={sensitiveForm.bankAccount}
                      onChange={(e) => setSensitiveForm({...sensitiveForm, bankAccount: e.target.value})}
                      disabled={lockedFields.bankAccount}
                      className={`rounded-xl ${lockedFields.bankAccount ? 'bg-muted cursor-not-allowed' : 'bg-background border-primary'}`}
                      placeholder="Enter bank account number"
                    />
                  ) : (
                    <Input 
                      value={employee.bankAccount ? '*********' + employee.bankAccount.slice(-4) : 'Not provided'} 
                      disabled 
                      className="rounded-xl bg-muted" 
                    />
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="rounded-xl"
                    disabled={!isEditingSensitive || lockedFields.bankAccount}
                    title={lockedFields.bankAccount ? `Locked for ${remainingTime.bankAccount || '12h'}` : 'Field is editable'}
                  >
                    {lockedFields.bankAccount ? (
                      <div className="flex items-center gap-1">
                        <Lock className="w-4 h-4" />
                        <span className="text-xs">{remainingTime.bankAccount}</span>
                      </div>
                    ) : (
                      <LockOpen className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div>
                <Label>IFSC Code</Label>
                <div className="mt-2 flex items-center gap-2">
                  {isEditingSensitive ? (
                    <Input 
                      value={sensitiveForm.ifscCode}
                      onChange={(e) => setSensitiveForm({...sensitiveForm, ifscCode: e.target.value})}
                      disabled={lockedFields.ifscCode}
                      className={`rounded-xl ${lockedFields.ifscCode ? 'bg-muted cursor-not-allowed' : 'bg-background border-primary'}`}
                      placeholder="Enter IFSC code"
                    />
                  ) : (
                    <Input 
                      value={employee.ifscCode || 'Not provided'} 
                      disabled 
                      className="rounded-xl bg-muted" 
                    />
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="rounded-xl"
                    disabled={!isEditingSensitive || lockedFields.ifscCode}
                    title={lockedFields.ifscCode ? `Locked for ${remainingTime.ifscCode || '12h'}` : 'Field is editable'}
                  >
                    {lockedFields.ifscCode ? (
                      <div className="flex items-center gap-1">
                        <Lock className="w-4 h-4" />
                        <span className="text-xs">{remainingTime.ifscCode}</span>
                      </div>
                    ) : (
                      <LockOpen className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
            {isEditingSensitive && Object.values(lockedFields).some(locked => locked) && (
              <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2">
                <Clock className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium">Some fields are locked</p>
                  <p className="text-xs mt-1">Locked fields cannot be edited until the 12-hour restriction expires.</p>
                </div>
              </div>
            )}
          </Card>

          {/* Educational Documents Section */}
          <Card className="p-6 rounded-2xl">
            <div className="mb-6">
              <h3 className="font-semibold text-lg mb-2">Educational Documents</h3>
              <p className="text-sm text-muted-foreground">Upload your educational certificates and marksheets</p>
            </div>

            {/* Progress Bar */}
            <div className="mb-6 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Documents Uploaded</span>
                <span className="font-medium">{calculateEducationProgress()}%</span>
              </div>
              <Progress value={calculateEducationProgress()} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {Object.values(educationalDocuments).reduce((count, docs) => {
                  if (docs.certificate) count++;
                  if (docs.marksheet) count++;
                  if (docs.others) count++;
                  return count;
                }, 0)} of 21 documents uploaded
              </p>
            </div>

            {/* Upload Form */}
            <div className="bg-muted/30 rounded-xl p-6 mb-6 border-2 border-dashed border-border">
              <h4 className="font-semibold mb-4 flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Upload New Document
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Education Level Selector */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Education Level</Label>
                  <select
                    value={uploadingEducation || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      console.log('Education level selected:', value);
                      setUploadingEducation(value || null);
                      // Reset document type when education level changes
                      setUploadingEducationType(null);
                    }}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer hover:border-primary transition-colors"
                  >
                    <option value="">Select Level</option>
                    {Object.keys(educationalDocuments).map((level) => (
                      <option key={level} value={level}>{level}</option>
                    ))}
                  </select>
                </div>

                {/* Document Type Selector */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Document Type</Label>
                  <select
                    value={uploadingEducationType || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      console.log('Document type selected:', value);
                      if (value === '') {
                        setUploadingEducationType(null);
                      } else {
                        setUploadingEducationType(value as 'certificate' | 'marksheet' | 'others');
                      }
                    }}
                    className={`w-full rounded-xl border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-colors ${
                      !uploadingEducation 
                        ? 'bg-muted cursor-not-allowed opacity-60' 
                        : 'bg-background cursor-pointer hover:border-primary'
                    }`}
                    disabled={!uploadingEducation}
                  >
                    <option value="">Select Type</option>
                    <option value="certificate">Certificate</option>
                    <option value="marksheet">Marksheet</option>
                    <option value="others">Others</option>
                  </select>
                  {!uploadingEducation && (
                    <p className="text-xs text-muted-foreground mt-1">Select education level first</p>
                  )}
                </div>

                {/* File Upload */}
                <div className="md:col-span-2">
                  <Label className="text-sm font-medium mb-2 block">Upload File</Label>
                  <div className="relative flex gap-2">
                    <input
                      type="file"
                      id="education-file-upload"
                      className="hidden"
                      onChange={(e) => {
                        if (uploadingEducation && uploadingEducationType) {
                          handleEducationDocumentUpload(e, uploadingEducation, uploadingEducationType);
                        } else {
                          toast.error('Please select education level and document type first');
                          e.target.value = '';
                        }
                      }}
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      disabled={!uploadingEducation || !uploadingEducationType || uploadingFile}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 rounded-xl"
                      disabled={!uploadingEducation || !uploadingEducationType || uploadingFile}
                      onClick={() => document.getElementById('education-file-upload')?.click()}
                    >
                      {uploadingFile ? (
                        <>
                          <Loader className="w-4 h-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Choose & Upload
                        </>
                      )}
                    </Button>
                  </div>
                  {(!uploadingEducation || !uploadingEducationType) && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {!uploadingEducation ? 'Select education level and type first' : 'Select document type first'}
                    </p>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Supported formats: PDF, DOC, DOCX, JPG, PNG (Max 10MB)
              </p>
            </div>

            {/* Uploaded Documents List */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm mb-3">Uploaded Documents</h4>
              {Object.entries(educationalDocuments).map(([level, docs]) => {
                const hasDocuments = docs.certificate || docs.marksheet || docs.others;
                if (!hasDocuments) return null;

                return (
                  <div key={level} className="border border-border rounded-xl p-4 bg-muted/20">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="font-semibold text-sm flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" />
                        {level}
                      </h5>
                      <div className="flex gap-2">
                        {docs.certificate && (
                          <Badge variant="default" className="bg-green-600 text-xs">
                            <Check className="w-3 h-3 mr-1" />
                            Certificate
                          </Badge>
                        )}
                        {docs.marksheet && (
                          <Badge variant="default" className="bg-blue-600 text-xs">
                            <Check className="w-3 h-3 mr-1" />
                            Marksheet
                          </Badge>
                        )}
                        {docs.others && (
                          <Badge variant="default" className="bg-purple-600 text-xs">
                            <Check className="w-3 h-3 mr-1" />
                            Others
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {docs.certificate && (
                        <div className="flex items-center justify-between p-3 bg-background rounded-lg border border-border">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
                              <FileText className="w-4 h-4 text-green-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{docs.certificate.name}</p>
                              <p className="text-xs text-muted-foreground">Certificate • {docs.certificate.size}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                // Download functionality
                                if (docs.certificate?.filePath) {
                                  window.open(docs.certificate.filePath, '_blank');
                                }
                              }}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              onClick={() => {
                                // Delete functionality
                                setEducationalDocuments((prev) => ({
                                  ...prev,
                                  [level]: {
                                    ...prev[level],
                                    certificate: undefined
                                  }
                                }));
                                toast.success('Certificate removed');
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {docs.marksheet && (
                        <div className="flex items-center justify-between p-3 bg-background rounded-lg border border-border">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                              <FileText className="w-4 h-4 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{docs.marksheet.name}</p>
                              <p className="text-xs text-muted-foreground">Marksheet • {docs.marksheet.size}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                // Download functionality
                                if (docs.marksheet?.filePath) {
                                  window.open(docs.marksheet.filePath, '_blank');
                                }
                              }}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              onClick={() => {
                                // Delete functionality
                                setEducationalDocuments((prev) => ({
                                  ...prev,
                                  [level]: {
                                    ...prev[level],
                                    marksheet: undefined
                                  }
                                }));
                                toast.success('Marksheet removed');
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {docs.others && (
                        <div className="flex items-center justify-between p-3 bg-background rounded-lg border border-border">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center flex-shrink-0">
                              <FileText className="w-4 h-4 text-purple-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{docs.others.name}</p>
                              <p className="text-xs text-muted-foreground">Others • {docs.others.size}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                // Download functionality
                                if (docs.others?.filePath) {
                                  window.open(docs.others.filePath, '_blank');
                                }
                              }}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              onClick={() => {
                                // Delete functionality
                                setEducationalDocuments((prev) => ({
                                  ...prev,
                                  [level]: {
                                    ...prev[level],
                                    others: undefined
                                  }
                                }));
                                toast.success('Document removed');
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {Object.values(educationalDocuments).every(docs => !docs.certificate && !docs.marksheet && !docs.others) && (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No documents uploaded yet</p>
                  <p className="text-xs mt-1">Use the form above to upload your educational documents</p>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="mt-6 flex justify-end">
              <Button 
                onClick={handleSubmitEducationalDocuments}
                disabled={submittingEducation || calculateEducationProgress() === 0}
                className="rounded-xl"
              >
                {submittingEducation ? (
                  <>
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Submit Educational Documents
                  </>
                )}
              </Button>
            </div>
          </Card>

          {/* Document Upload Section */}
          <Card className="p-6 rounded-2xl">
            <div className="mb-6">
              <h3 className="font-semibold text-lg mb-2">Upload Your Documents</h3>
              <p className="text-sm text-muted-foreground">Upload employment documents from your earlier organization</p>
            </div>

            {/* Progress Bar */}
            <div className="mb-6 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Documents Uploaded</span>
                <span className="font-medium">{documents.length > 0 ? Math.round((documents.length / documentCategories.length) * 100) : 0}%</span>
              </div>
              <Progress value={documents.length > 0 ? Math.round((documents.length / documentCategories.length) * 100) : 0} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {documents.length} of {documentCategories.length} documents uploaded
              </p>
            </div>

            {/* Upload Form */}
            <div className="bg-muted/30 rounded-xl p-6 mb-6 border-2 border-dashed border-border">
              <h4 className="font-semibold mb-4 flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Upload New Document
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Document Category Selector */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Document Category</Label>
                  <select
                    value={selectedCategory || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSelectedCategory(value || documentCategories[0]);
                      console.log('Document category selected:', value);
                    }}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer hover:border-primary transition-colors"
                  >
                    <option value="">Select Category</option>
                    {documentCategories.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>

                {/* File Upload */}
                <div className="md:col-span-2">
                  <Label className="text-sm font-medium mb-2 block">Upload File</Label>
                  <div className="relative flex gap-2">
                    <input
                      type="file"
                      id="employment-doc-upload"
                      className="hidden"
                      onChange={(e) => {
                        if (selectedCategory) {
                          handleDocumentUpload(e);
                        } else {
                          toast.error('Please select a document category first');
                          e.target.value = '';
                        }
                      }}
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      disabled={!selectedCategory || uploadingFile}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 rounded-xl"
                      disabled={!selectedCategory || uploadingFile}
                      onClick={() => document.getElementById('employment-doc-upload')?.click()}
                    >
                      {uploadingFile ? (
                        <>
                          <Loader className="w-4 h-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Choose & Upload
                        </>
                      )}
                    </Button>
                  </div>
                  {!selectedCategory && (
                    <p className="text-xs text-muted-foreground mt-1">Select a category first</p>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Supported formats: PDF, DOC, DOCX, JPG, PNG (Max 10MB)
              </p>
            </div>

            {/* Uploaded Documents List */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm mb-3">Uploaded Documents</h4>
              {documents.length > 0 ? (
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div key={doc._id} className="border border-border rounded-xl p-4 bg-muted/20">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="font-semibold text-sm flex items-center gap-2">
                          <FileText className="w-4 h-4 text-primary" />
                          {doc.name}
                        </h5>
                        <Badge variant="default" className="bg-blue-600 text-xs">
                          <Check className="w-3 h-3 mr-1" />
                          {doc.category || 'Document'}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-background rounded-lg border border-border">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                            <FileText className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{doc.name}</p>
                            <p className="text-xs text-muted-foreground">{doc.size} • {doc.uploadedAt}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              // Download functionality
                              if (doc.filePath) {
                                const apiUrl = (import.meta as any).env.VITE_API_URL || '';
                                const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
                                let fullUrl = doc.filePath;
                                if (doc.filePath.startsWith('/')) {
                                  if (baseUrl.endsWith('/api')) {
                                    fullUrl = baseUrl.slice(0, -4) + doc.filePath;
                                  } else {
                                    fullUrl = baseUrl + doc.filePath;
                                  }
                                }
                                const link = document.createElement('a');
                                link.href = fullUrl;
                                link.download = doc.name;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              }
                            }}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            onClick={async () => {
                              // Delete functionality
                              try {
                                await apiDelete(`/documents/${doc._id}`);
                                setDocuments(documents.filter(d => d._id !== doc._id));
                                toast.success('Document deleted');
                              } catch (error) {
                                console.error('Error deleting document:', error);
                                toast.error('Failed to delete document');
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No documents uploaded yet</p>
                  <p className="text-xs mt-1">Use the form above to upload your employment documents</p>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="mt-6 flex justify-end">
              <Button 
                onClick={handleSubmitEmploymentDocuments}
                disabled={submittingDocuments || documents.length === 0}
                className="rounded-xl"
              >
                {submittingDocuments ? (
                  <>
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Submit Employment Documents
                  </>
                )}
              </Button>
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

