# Employee Onboarding Link Feature - Complete Implementation

## Overview
A comprehensive employee onboarding system that allows HR/Admin to generate shareable onboarding links for new employees. New joiners can use these links to fill in their information independently without needing an account.

## Features Implemented

### 1. Backend Routes (`backend/routes/onboarding.js`)

#### Public Endpoints (No Authentication Required)
- **GET `/api/onboarding/validate/:token`** - Validate an onboarding link and get employee details
- **POST `/api/onboarding/submit`** - Submit completed onboarding form data

#### Protected Endpoints (HR/Admin Only)
- **POST `/api/onboarding/generate-link`** - Generate a shareable onboarding link for a new employee
- **GET `/api/onboarding/links`** - Get all onboarding links with filtering
- **GET `/api/onboarding/submissions`** - Get all onboarding submissions
- **GET `/api/onboarding/submissions/:id`** - Get a specific submission
- **PUT `/api/onboarding/submissions/:id/approve`** - Approve an onboarding submission
- **PUT `/api/onboarding/submissions/:id/reject`** - Reject an onboarding submission

### 2. Frontend Components

#### OnboardingPage (`frontend/src/app/pages/public/OnboardingPage.tsx`)
- Public page accessible via `/onboarding/:token`
- 5-step form wizard:
  1. **Personal Information** - First name, last name, phone, DOB, gender, address
  2. **Official Information** - Employee ID, joining date, department, designation, employment type, work location
  3. **Emergency Contact** - Contact name, relationship, phone
  4. **Banking Information** - Aadhar, PAN, bank account, IFSC code
  5. **Review & Submit** - Review all information before submission

Features:
- Progress tracking with visual indicators
- Section validation before proceeding
- Real-time form validation
- Success/error notifications
- Automatic redirect after successful submission

#### OnboardingLinkGenerator (`frontend/src/app/components/OnboardingLinkGenerator.tsx`)
- Modal dialog for generating onboarding links
- Two-step process:
  1. **Form Step** - Enter employee email, name, and department
  2. **Result Step** - Display generated link with copy and email options

Features:
- Form validation
- Copy-to-clipboard functionality
- Email sending capability (placeholder)
- Link expiration display (30 days)

### 3. Database Models

#### OnboardingLink Model
```javascript
{
  token: String (unique),
  employeeEmail: String,
  employeeName: String,
  department: String,
  organizationName: String,
  organizationId: String,
  createdBy: ObjectId (ref: User),
  expiresAt: Date,
  isUsed: Boolean,
  timestamps: true
}
```

#### OnboardingSubmission Model
```javascript
{
  employeeId: String,
  employeeName: String,
  email: String,
  phone: String,
  personalInfo: {
    firstName, lastName, dateOfBirth, gender, address
  },
  officialInfo: {
    employeeId, joiningDate, department, designation, employmentType, workLocation
  },
  sensitiveInfo: {
    aadharNumber, panNumber, bankAccount, ifscCode
  },
  emergencyContact: {
    name, relation, phone
  },
  documents: Array,
  submittedBy: ObjectId (ref: User),
  submittedAt: Date,
  status: String (pending/verified/rejected),
  timestamps: true
}
```

### 4. Updated Components

#### Employees Page (`frontend/src/app/pages/admin/Employees.tsx`)
- Added "Generate Onboarding Link" button
- Integrated OnboardingLinkGenerator modal
- Button opens modal to create new onboarding links

#### Routes (`frontend/src/app/routes.tsx`)
- Added public route: `/onboarding/:token` → OnboardingPage
- Route is not protected (public access)

#### Server (`backend/server.js`)
- Imported onboarding routes
- Mounted at `/api/onboarding`

## User Flow

### For HR/Admin:
1. Go to Admin → Employees
2. Click "Generate Onboarding Link" button
3. Fill in employee email, name, and department
4. Click "Generate Link"
5. Copy the link or send via email
6. Share link with new employee

### For New Employee:
1. Receive onboarding link via email or message
2. Click the link (e.g., `http://localhost:5173/onboarding/abc123...`)
3. Fill in 5-step form with personal, official, emergency, and banking information
4. Review information
5. Click "Submit Onboarding"
6. Receive success confirmation

### For HR/Admin (After Submission):
1. Go to Admin → Onboarding Submissions
2. Review submitted information
3. Approve or reject submission
4. Create user account (future enhancement)

## Form Fields

### Personal Information
- First Name (required)
- Last Name (required)
- Email (read-only, from link)
- Phone Number (required)
- Date of Birth (required)
- Gender (required)
- Address (required)

### Official Information
- Employee ID (required)
- Joining Date (required)
- Department (read-only, from link)
- Designation (required)
- Employment Type (required) - Full-time, Part-time, Contract, Temporary
- Work Location (required)

### Emergency Contact
- Contact Name (required)
- Relationship (required)
- Phone Number (required)

### Banking Information
- Aadhar Number (required)
- PAN Number (required)
- Bank Account Number (required)
- IFSC Code (required)

## Security Features

1. **Token-based Access** - Unique 32-byte hex tokens for each link
2. **Link Expiration** - Links expire after 30 days
3. **One-time Use** - Links can only be used once
4. **Validation** - All form fields are validated before submission
5. **Secure Storage** - Sensitive information stored in database
6. **Authentication** - Link generation requires HR/Admin role

## API Response Examples

### Generate Link Response
```json
{
  "success": true,
  "message": "Onboarding link generated successfully",
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "token": "abc123def456...",
    "employeeEmail": "john@company.com",
    "employeeName": "John Doe",
    "onboardingUrl": "http://localhost:5173/onboarding/abc123def456...",
    "expiresAt": "2026-06-02T02:33:51.000Z",
    "createdAt": "2026-05-03T02:33:51.000Z"
  }
}
```

### Submit Form Response
```json
{
  "success": true,
  "message": "Onboarding form submitted successfully",
  "data": {
    "submissionId": "507f1f77bcf86cd799439012",
    "status": "pending",
    "submittedAt": "2026-05-03T02:35:00.000Z"
  }
}
```

## Testing Instructions

### 1. Generate Onboarding Link
1. Log in as Admin
2. Go to Admin → Employees
3. Click "Generate Onboarding Link"
4. Fill in:
   - Email: `newemployee@company.com`
   - Name: `Jane Smith`
   - Department: `Engineering`
5. Click "Generate Link"
6. Copy the generated URL

### 2. Complete Onboarding Form
1. Open the copied URL in a new browser/incognito window
2. Fill in all 5 sections:
   - Personal: John, Doe, 9876543210, 1990-01-15, Male, 123 Main St
   - Official: EMP001, 2026-05-03, Engineering, Senior Developer, Full-time, New York
   - Emergency: Jane Doe, Spouse, 9876543211
   - Banking: 123456789012, ABCD1234567, 1234567890123456, SBIN0001234
3. Review information
4. Click "Submit Onboarding"
5. See success message

### 3. Verify Submission
1. Log in as Admin
2. Go to Admin → Onboarding Submissions (future page)
3. See the submitted form with status "pending"
4. Approve or reject the submission

## Future Enhancements

1. **Email Integration** - Automatically send onboarding links via email
2. **Document Upload** - Allow employees to upload documents during onboarding
3. **User Account Creation** - Automatically create user account upon approval
4. **Workflow Integration** - Integrate with employee lifecycle engine
5. **Bulk Onboarding** - Generate multiple links at once via CSV
6. **Onboarding Checklist** - Track onboarding tasks and completion
7. **Email Reminders** - Send reminders if onboarding not completed
8. **Mobile App** - Mobile-friendly onboarding form
9. **Multi-language Support** - Support multiple languages
10. **Custom Fields** - Allow organizations to add custom fields

## Files Created/Modified

### Created Files
- `backend/routes/onboarding.js` - Onboarding routes
- `frontend/src/app/pages/public/OnboardingPage.tsx` - Public onboarding form page
- `frontend/src/app/components/OnboardingLinkGenerator.tsx` - Link generator modal
- `ONBOARDING_LINK_FEATURE.md` - This documentation

### Modified Files
- `backend/server.js` - Added onboarding routes import and mounting
- `frontend/src/app/routes.tsx` - Updated onboarding route import
- `frontend/src/app/pages/admin/Employees.tsx` - Added link generator button and modal
- `backend/models/Document.js` - Added orgId field (for consistency)

## Deployment Notes

1. **Environment Variables** - Ensure `FRONTEND_URL` is set in `.env` for correct onboarding URLs
2. **Email Service** - Configure email service for sending onboarding links
3. **Database** - Ensure OnboardingLink and OnboardingSubmission models are created
4. **CORS** - Ensure CORS is configured to allow public access to validation endpoint
5. **Rate Limiting** - Consider adding rate limiting to prevent abuse

## Support & Troubleshooting

### Link Not Working
- Check if link has expired (30 days)
- Verify token is correct
- Check if link has already been used

### Form Submission Failing
- Ensure all required fields are filled
- Check browser console for errors
- Verify backend is running

### Email Not Sending
- Configure email service in backend
- Check email configuration in `.env`
- Verify email address is valid

## Contact & Support
For issues or questions, contact the development team.
