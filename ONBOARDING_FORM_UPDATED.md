# Onboarding Form Updated - Educational & Employment Documents

## Summary
The employee onboarding form has been completely restructured to:
- **Remove** "Official Information" section (Step 2)
- **Add** "Educational Documents" section (Step 4)
- **Add** "Upload Your Documents" section (Step 5)

## Changes Made

### Frontend Changes

#### File: `frontend/src/app/pages/public/OnboardingPage.tsx`

**1. Updated Imports**
- Added `Badge` component for document status badges
- Added `Upload`, `Check`, `Download`, `Trash2` icons for document handling

**2. Updated Form Data Interface**
- Removed: `employeeId`, `joiningDate`, `department`, `designation`, `employmentType`, `workLocation`
- Kept: Personal info, sensitive info, emergency contact

**3. New Interfaces Added**
```typescript
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
```

**4. Updated Form Sections (6 steps total)**
- Step 0: Personal Information
- Step 1: Emergency Contact (was Step 2)
- Step 2: Banking Information (was Step 3)
- Step 3: **Educational Documents** (NEW)
- Step 4: **Upload Your Documents** (NEW)
- Step 5: Review & Submit (was Step 4)

**5. New State Variables**
```typescript
// Educational Documents
const [educationalDocuments, setEducationalDocuments] = useState<EducationDocuments>({
  '10th': {},
  '12th': {},
  'Graduation': {},
  'Post Graduation': {},
  'Diploma': {},
  'Certificate': {},
  'Drop out': {}
});

// Employment Documents
const [documents, setDocuments] = useState<Document[]>([]);
const [selectedCategory, setSelectedCategory] = useState<string>('Letter of Intent');

const documentCategories = [
  'Letter of Intent',
  'Offer Letter',
  'Appointment Letter',
  'Appraisal Letter',
  'Salary Slips',
  'Experience Letter',
  'Relieving Letter'
];
```

**6. New Handler Functions**
- `handleEducationDocumentUpload()`: Upload certificate/marksheet for each education level
- `handleDocumentUpload()`: Upload employment documents
- `calculateEducationProgress()`: Calculate progress percentage for educational documents

**7. Updated Form Sections**

**Educational Documents Section (Step 3)**
- 7 education levels: 10th, 12th, Graduation, Post Graduation, Diploma, Certificate, Drop out
- Each level has 2 upload slots: Certificate and Marksheet
- Progress bar showing completion percentage
- Visual feedback with badges for uploaded documents
- Optional section

**Upload Your Documents Section (Step 4)**
- 7 document categories to choose from
- Drag-and-drop upload area
- List of uploaded documents with status
- Optional section

**8. Updated Review Section (Step 5)**
- Removed Official Information display
- Added Educational Documents summary
- Added Employment Documents summary
- Shows which documents were uploaded for each education level

### Backend Changes

#### File: `backend/routes/onboarding.js`

**Updated POST /api/onboarding/submit Endpoint**
- Removed: `officialInfo` parameter handling
- Added: `educationalDocuments` parameter handling
- Added: `employmentDocuments` parameter handling
- Updated Employee creation to include:
  - `firstName`, `lastName` (from personalInfo)
  - `dateOfBirth`, `gender` (from personalInfo)
  - `aadharNumber`, `panNumber` (from sensitiveInfo)
  - Removed: `employeeCode` from officialInfo (now auto-generated)

#### File: `backend/models/OnboardingSubmission.js`

**Updated Schema**
- Added `educationalDocuments` field (Map type):
  ```javascript
  educationalDocuments: {
    type: Map,
    of: {
      certificate: { id: String, name: String },
      marksheet: { id: String, name: String }
    },
    default: {}
  }
  ```
- Added `employmentDocuments` field (Array type):
  ```javascript
  employmentDocuments: [{
    id: String,
    name: String,
    category: String
  }]
  ```
- Kept `documents` field for backward compatibility

## Form Flow

### Step 1: Personal Information
- First Name, Last Name, Phone, Date of Birth, Gender, Address
- Email is pre-filled from onboarding link

### Step 2: Emergency Contact
- Contact Name, Relationship, Phone Number

### Step 3: Banking Information
- Aadhar Number, PAN Number, Bank Account Number, IFSC Code
- Marked as sensitive information

### Step 4: Educational Documents (Optional)
- Upload certificate and marksheet for each education level
- 7 education levels available
- Progress tracking

### Step 5: Upload Your Documents (Optional)
- Select document category
- Upload employment documents
- View uploaded documents with status

### Step 6: Review & Submit
- Review all entered information
- See summary of uploaded documents
- Submit to create employee profile

## Data Submitted

```json
{
  "token": "onboarding_token",
  "personalInfo": {
    "firstName": "John",
    "lastName": "Doe",
    "phone": "9876543210",
    "dateOfBirth": "1990-01-15",
    "gender": "Male",
    "address": "123 Main St"
  },
  "sensitiveInfo": {
    "aadharNumber": "1234567890123456",
    "panNumber": "ABCDE1234F",
    "bankAccount": "1234567890",
    "ifscCode": "SBIN0001234"
  },
  "emergencyContact": {
    "name": "Jane Doe",
    "relation": "Spouse",
    "phone": "9876543211"
  },
  "educationalDocuments": {
    "10th": {
      "certificate": { "id": "doc_id", "name": "10th_cert.pdf" },
      "marksheet": { "id": "doc_id", "name": "10th_marks.pdf" }
    },
    "Graduation": {
      "certificate": { "id": "doc_id", "name": "degree.pdf" },
      "marksheet": null
    }
  },
  "employmentDocuments": [
    { "id": "doc_id", "name": "offer_letter.pdf", "category": "Offer Letter" },
    { "id": "doc_id", "name": "experience.pdf", "category": "Experience Letter" }
  ]
}
```

## Employee Profile Created

When onboarding is submitted, the following are created:
1. **User Account** with role: employee
2. **Employee Profile** with:
   - Personal information from form
   - Sensitive information (Aadhar, PAN, Bank details)
   - Emergency contact information
   - `createdViaOnboarding: true` flag
   - Status: active

## Testing Checklist

- [ ] Generate onboarding link from Admin > Employees
- [ ] Access onboarding form with link
- [ ] Fill Personal Information
- [ ] Fill Emergency Contact
- [ ] Fill Banking Information
- [ ] Upload educational documents (optional)
- [ ] Upload employment documents (optional)
- [ ] Review all information
- [ ] Submit form
- [ ] Verify employee profile created in Admin Dashboard
- [ ] Verify employee appears with "Onboarding" badge
- [ ] Verify documents are stored correctly

## Notes

- Educational documents and employment documents are optional
- All other sections are required
- Document uploads are handled through existing `/api/employee-dashboard/documents` endpoint
- Employee profile is created immediately upon submission
- Onboarding link is marked as used after submission
