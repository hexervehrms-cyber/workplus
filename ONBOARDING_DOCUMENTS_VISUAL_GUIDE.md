# Onboarding Documents - Visual Guide

## Problem & Solution

### ❌ BEFORE: Upload During Onboarding
```
┌─────────────────────────────────────┐
│   Onboarding Form (Public)          │
│                                     │
│  Step 4: Educational Documents     │
│  ┌─────────────────────────────┐   │
│  │ Select Certificate          │   │
│  │ [Choose File] → Upload ❌   │   │
│  │ "Invalid token" Error       │   │
│  └─────────────────────────────┘   │
│                                     │
│  Form Submission: BLOCKED           │
└─────────────────────────────────────┘
```

### ✅ AFTER: Select During Onboarding, Upload After Login
```
┌─────────────────────────────────────┐
│   Onboarding Form (Public)          │
│                                     │
│  Step 4: Educational Documents     │
│  ┌─────────────────────────────┐   │
│  │ Select Certificate          │   │
│  │ [Choose File] → Select ✅   │   │
│  │ File stored locally         │   │
│  └─────────────────────────────┘   │
│                                     │
│  Form Submission: SUCCESS ✅        │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│   Employee Profile Created          │
│   Login Credentials Sent            │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│   Employee Logs In (Authenticated)  │
│                                     │
│  Profile > Documents                │
│  ┌─────────────────────────────┐   │
│  │ Upload Certificate          │   │
│  │ [Choose File] → Upload ✅   │   │
│  │ Valid JWT Token             │   │
│  └─────────────────────────────┘   │
│                                     │
│  Document Upload: SUCCESS ✅        │
└─────────────────────────────────────┘
```

## Form Flow Diagram

```
START
  │
  ├─→ Step 1: Personal Information
  │   ├─ First Name
  │   ├─ Last Name
  │   ├─ Phone
  │   ├─ Date of Birth
  │   ├─ Gender
  │   └─ Address
  │
  ├─→ Step 2: Emergency Contact
  │   ├─ Contact Name
  │   ├─ Relationship
  │   └─ Phone
  │
  ├─→ Step 3: Banking Information
  │   ├─ Aadhar Number
  │   ├─ PAN Number
  │   ├─ Bank Account
  │   └─ IFSC Code
  │
  ├─→ Step 4: Educational Documents ✨ NEW
  │   ├─ 10th (Certificate + Marksheet)
  │   ├─ 12th (Certificate + Marksheet)
  │   ├─ Graduation (Certificate + Marksheet)
  │   ├─ Post Graduation (Certificate + Marksheet)
  │   ├─ Diploma (Certificate + Marksheet)
  │   ├─ Certificate (Certificate + Marksheet)
  │   └─ Drop out (Certificate + Marksheet)
  │   
  │   ✅ Files selected locally
  │   ✅ No upload to server
  │   ✅ No authentication needed
  │
  ├─→ Step 5: Upload Documents ✨ NEW
  │   ├─ Select Category
  │   │  ├─ Letter of Intent
  │   │  ├─ Offer Letter
  │   │  ├─ Appointment Letter
  │   │  ├─ Appraisal Letter
  │   │  ├─ Salary Slips
  │   │  ├─ Experience Letter
  │   │  └─ Relieving Letter
  │   │
  │   └─ Select Documents
  │      ✅ Files selected locally
  │      ✅ No upload to server
  │      ✅ No authentication needed
  │
  ├─→ Step 6: Review & Submit
  │   ├─ Review Personal Information
  │   ├─ Review Emergency Contact
  │   ├─ Review Banking Information
  │   ├─ Review Educational Documents
  │   ├─ Review Employment Documents
  │   └─ Submit Form
  │
  └─→ SUCCESS
      ├─ Employee Profile Created
      ├─ User Account Created
      ├─ Login Credentials Sent
      └─ Redirect to Home
```

## Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    ONBOARDING PROCESS                        │
└──────────────────────────────────────────────────────────────┘

PHASE 1: FORM FILLING (Public, No Auth)
┌─────────────────────────────────────────────────────────────┐
│ Employee Browser                                            │
│                                                             │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ Onboarding Form                                     │   │
│ │                                                     │   │
│ │ Personal Info ──┐                                  │   │
│ │ Emergency Info ─┼─→ Form State (Local)            │   │
│ │ Banking Info ───┤                                  │   │
│ │ Edu Docs ───────┼─→ File References (Local)       │   │
│ │ Emp Docs ───────┘                                  │   │
│ │                                                     │   │
│ │ [Submit Form]                                       │   │
│ └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ↓                                  │
│                    POST /api/onboarding/submit             │
│                    (No Auth Header)                        │
└─────────────────────────────────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Backend Server                                              │
│                                                             │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ Onboarding Endpoint                                 │   │
│ │                                                     │   │
│ │ 1. Validate Token                                   │   │
│ │ 2. Create User Account                              │   │
│ │ 3. Create Employee Profile                          │   │
│ │ 4. Store Document References                        │   │
│ │ 5. Mark Link as Used                                │   │
│ │ 6. Return Success + Credentials                     │   │
│ └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ↓                                  │
│                  Database Update                           │
│                  ├─ User Created                           │
│                  ├─ Employee Created                       │
│                  ├─ Submission Stored                      │
│                  └─ Link Marked Used                       │
└─────────────────────────────────────────────────────────────┘
                          │
                          ↓
PHASE 2: EMPLOYEE LOGIN (Authenticated)
┌─────────────────────────────────────────────────────────────┐
│ Employee Browser                                            │
│                                                             │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ Login Page                                           │   │
│ │                                                     │   │
│ │ Email: [employee@company.com]                       │   │
│ │ Password: [temp_password_XXXXXXXX]                  │   │
│ │                                                     │   │
│ │ [Login]                                              │   │
│ └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ↓                                  │
│                    POST /api/auth/login                    │
│                    (Credentials)                           │
└─────────────────────────────────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Backend Server                                              │
│                                                             │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ Auth Endpoint                                       │   │
│ │                                                     │   │
│ │ 1. Validate Credentials                             │   │
│ │ 2. Generate JWT Token                               │   │
│ │ 3. Return Token + User Info                         │   │
│ └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          │
                          ↓
PHASE 3: DOCUMENT UPLOAD (Authenticated)
┌─────────────────────────────────────────────────────────────┐
│ Employee Browser                                            │
│                                                             │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ Profile > Documents                                 │   │
│ │                                                     │   │
│ │ [Select File] → [Upload]                            │   │
│ │                                                     │   │
│ │ Authorization: Bearer JWT_TOKEN ✅                  │   │
│ └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ↓                                  │
│            POST /api/employee-dashboard/documents          │
│            (With Valid JWT Token)                          │
└─────────────────────────────────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Backend Server                                              │
│                                                             │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ Document Upload Endpoint                            │   │
│ │                                                     │   │
│ │ 1. Authenticate (JWT Valid ✅)                      │   │
│ │ 2. Validate File                                    │   │
│ │ 3. Store File                                       │   │
│ │ 4. Create Document Record                           │   │
│ │ 5. Return Success                                   │   │
│ └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ↓                                  │
│                  Database Update                           │
│                  └─ Document Stored                        │
└─────────────────────────────────────────────────────────────┘
                          │
                          ↓
                    SUCCESS ✅
```

## State Management

### Form State
```javascript
{
  // Personal Information
  firstName: "John",
  lastName: "Doe",
  phone: "9876543210",
  dateOfBirth: "1990-01-15",
  gender: "Male",
  address: "123 Main St",
  
  // Emergency Contact
  emergencyName: "Jane Doe",
  emergencyRelation: "Spouse",
  emergencyPhone: "9876543211",
  
  // Banking Information
  aadharNumber: "1234567890123456",
  panNumber: "ABCDE1234F",
  bankAccount: "1234567890",
  ifscCode: "SBIN0001234"
}
```

### Educational Documents State
```javascript
{
  '10th': {
    certificate: {
      _id: "temp_1234567890_0.1",
      name: "10th_certificate.pdf",
      size: "1.2 MB",
      uploadedAt: "5/3/2026",
      status: "Pending Upload",
      filePath: ""
    },
    marksheet: {
      _id: "temp_1234567890_0.2",
      name: "10th_marksheet.pdf",
      size: "0.8 MB",
      uploadedAt: "5/3/2026",
      status: "Pending Upload",
      filePath: ""
    }
  },
  '12th': { /* ... */ },
  'Graduation': { /* ... */ },
  // ... other levels
}
```

### Employment Documents State
```javascript
[
  {
    _id: "temp_1234567890_1.1",
    name: "offer_letter.pdf",
    size: "2.1 MB",
    uploadedAt: "5/3/2026",
    status: "Pending Upload",
    filePath: "",
    category: "Offer Letter"
  },
  {
    _id: "temp_1234567890_1.2",
    name: "experience_letter.pdf",
    size: "1.5 MB",
    uploadedAt: "5/3/2026",
    status: "Pending Upload",
    filePath: "",
    category: "Experience Letter"
  }
]
```

## UI Components

### Educational Documents Section
```
┌─────────────────────────────────────────────────────┐
│ Educational Documents                              │
│ Upload certificates and marksheets (Optional)      │
│                                                     │
│ Progress: 25% [████░░░░░░░░░░░░░░░░░░░░░░░░░░░░] │
│ 7 of 28 documents uploaded                         │
│                                                     │
│ ┌─────────────────────────────────────────────┐   │
│ │ 10th                    [Certificate ✓]     │   │
│ │                         [Marksheet  ]       │   │
│ │ ┌──────────────────┐ ┌──────────────────┐  │   │
│ │ │ Select           │ │ Select           │  │   │
│ │ │ Certificate      │ │ Marksheet        │  │   │
│ │ │ PDF, DOC, DOCX   │ │ PDF, DOC, DOCX   │  │   │
│ │ │ JPG, PNG         │ │ JPG, PNG         │  │   │
│ │ └──────────────────┘ └──────────────────┘  │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│ ┌─────────────────────────────────────────────┐   │
│ │ 12th                    [Certificate ✓]     │   │
│ │                         [Marksheet ✓]       │   │
│ │ ┌──────────────────┐ ┌──────────────────┐  │   │
│ │ │ 12th_cert.pdf    │ │ 12th_marks.pdf   │  │   │
│ │ │ Selected ✓       │ │ Selected ✓       │  │   │
│ │ └──────────────────┘ └──────────────────┘  │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│ ... (other education levels)                       │
└─────────────────────────────────────────────────────┘
```

### Employment Documents Section
```
┌─────────────────────────────────────────────────────┐
│ Upload Your Documents                              │
│ Upload employment documents (Optional)             │
│                                                     │
│ ┌─────────────────────────────────────────────┐   │
│ │ [Letter of Intent] [Offer Letter]           │   │
│ │ [Appointment Letter] [Appraisal Letter]     │   │
│ │ [Salary Slips] [Experience Letter]          │   │
│ │ [Relieving Letter]                          │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│ ┌─────────────────────────────────────────────┐   │
│ │ 📄 Click to select or drag and drop         │   │
│ │ PDF, DOC, DOCX up to 10MB                   │   │
│ │ Selected: Offer Letter                      │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│ Uploaded Documents                                 │
│ ┌─────────────────────────────────────────────┐   │
│ │ 📄 offer_letter.pdf                         │   │
│ │    2.1 MB • 5/3/2026 • [Pending Upload]    │   │
│ │                                             │   │
│ │ 📄 experience_letter.pdf                    │   │
│ │    1.5 MB • 5/3/2026 • [Pending Upload]    │   │
│ └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## Status Indicators

### During Onboarding
```
✅ Selected    - File has been selected locally
⏳ Pending Upload - File will be uploaded after login
```

### After Login
```
⏳ Pending     - File uploaded, awaiting HR review
✅ Verified    - HR has verified the document
❌ Rejected    - HR rejected the document
```

## Error Handling

### Before (Broken)
```
User selects file
    ↓
System tries to upload
    ↓
❌ "Invalid token" Error
    ↓
Form submission blocked
```

### After (Fixed)
```
User selects file
    ✅ File stored locally
    ✅ No upload attempt
    ✅ No errors
    ✅ Form submission succeeds
```

## Timeline

```
Day 1: Onboarding
├─ 09:00 - Employee receives onboarding link
├─ 09:15 - Fills onboarding form
├─ 09:20 - Selects educational documents
├─ 09:25 - Selects employment documents
└─ 09:30 - Submits form ✅

Day 1: Profile Creation
├─ 09:31 - Backend creates profile
├─ 09:32 - Backend creates user account
├─ 09:33 - Credentials sent to email
└─ 09:35 - Employee receives credentials

Day 1: Employee Login
├─ 14:00 - Employee logs in
├─ 14:01 - Gets valid JWT token
└─ 14:02 - Can now upload documents

Day 1: Document Upload
├─ 14:05 - Goes to Profile > Documents
├─ 14:10 - Uploads educational documents ✅
├─ 14:15 - Uploads employment documents ✅
└─ 14:20 - All documents uploaded

Day 2: HR Review
├─ 10:00 - HR reviews documents
├─ 10:30 - HR verifies documents
└─ 10:45 - Employee notified ✅
```

## Summary

✅ **Problem Solved**: No more "Invalid token" errors
✅ **Better UX**: Faster form submission
✅ **More Secure**: Real authentication for uploads
✅ **More Flexible**: Upload documents anytime
✅ **Better Visibility**: HR can review all documents
