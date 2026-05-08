# Onboarding Document Upload Fix - "Invalid Token" Error

## Problem
When submitting educational documents or employment documents during the onboarding form, users were getting an "Invalid token" error. This was because:

1. **No Authentication During Onboarding** - The onboarding form is a public endpoint that doesn't require authentication
2. **Document Upload Endpoint Requires Auth** - The `/api/employee-dashboard/documents` endpoint requires a valid authentication token via the `authenticate` middleware
3. **Temporary Token Not Valid** - Using a hardcoded `'temp_token'` was not a valid JWT token

## Root Cause
The document upload endpoint is protected by the `authenticate` middleware which validates JWT tokens:

```javascript
router.post('/documents',
  authenticate,  // ❌ This requires valid JWT token
  upload.single('document'),
  // ...
);
```

During onboarding, there's no valid authentication token because the employee profile hasn't been created yet.

## Solution Implemented

### Changed Approach: Local File Selection Instead of Upload

Instead of uploading documents during onboarding, we now:

1. **Allow file selection** - Users select files locally during the form
2. **Store file references** - File names and metadata are stored in the form state
3. **Submit with form** - File references are sent with the onboarding submission
4. **Upload after profile creation** - Documents are uploaded after the employee profile is created and the user has a valid token

### Changes Made

#### Frontend: OnboardingPage.tsx

**Before:**
```javascript
// ❌ Tried to upload immediately with invalid token
const response = await fetch('http://localhost:5000/api/employee-dashboard/documents', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer temp_token`  // Invalid token
  },
  body: formDataObj
});
```

**After:**
```javascript
// ✅ Store file reference locally
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
```

### UI Changes

**Educational Documents Section:**
- Changed from "Upload Certificate" to "Select Certificate"
- Removed loading spinner during upload
- Shows "Selected" status instead of "Uploaded"
- Files are stored locally, not uploaded to server

**Employment Documents Section:**
- Changed from "Click to upload" to "Click to select"
- Removed upload progress indicator
- Shows selected files with "Pending Upload" status
- Files are stored locally, not uploaded to server

### Data Flow

```
1. User fills onboarding form
   ↓
2. User selects educational documents (stored locally)
   ↓
3. User selects employment documents (stored locally)
   ↓
4. User submits onboarding form
   ↓
5. Backend creates employee profile and user account
   ↓
6. Employee receives login credentials
   ↓
7. Employee logs in with valid token
   ↓
8. Employee can upload documents from profile page
```

## Backend Changes

### OnboardingSubmission Model
The model now stores document references instead of actual files:

```javascript
educationalDocuments: {
  type: Map,
  of: {
    certificate: {
      id: String,
      name: String
    },
    marksheet: {
      id: String,
      name: String
    }
  },
  default: {}
},
employmentDocuments: [{
  id: String,
  name: String,
  category: String
}]
```

### Onboarding Submit Endpoint
The endpoint now accepts document references:

```javascript
router.post('/submit', asyncHandler(async (req, res) => {
  const { 
    token, 
    personalInfo, 
    sensitiveInfo, 
    emergencyContact, 
    educationalDocuments,  // ✅ Document references
    employmentDocuments    // ✅ Document references
  } = req.body;
  
  // Create submission with document references
  const submission = await OnboardingSubmission.create({
    // ... other fields
    educationalDocuments: educationalDocuments || {},
    employmentDocuments: employmentDocuments || [],
    // ...
  });
}));
```

## Files Modified

1. **frontend/src/app/pages/public/OnboardingPage.tsx**
   - Removed async document upload logic
   - Changed to local file selection
   - Removed loading states for uploads
   - Updated UI text from "Upload" to "Select"
   - Removed `uploadingEducation`, `uploadingEducationType`, `uploadingFile` states

2. **backend/models/OnboardingSubmission.js** (Already updated)
   - Supports document references

3. **backend/routes/onboarding.js** (Already updated)
   - Accepts document references in submission

## User Experience

### During Onboarding
1. ✅ User can select educational documents (no upload)
2. ✅ User can select employment documents (no upload)
3. ✅ Files are stored locally in form state
4. ✅ No authentication errors
5. ✅ Form submits successfully

### After Onboarding
1. ✅ Employee receives login credentials
2. ✅ Employee logs in with valid token
3. ✅ Employee can upload documents from Profile page
4. ✅ Documents are properly authenticated and stored

## Benefits

1. **No Authentication Issues** - Eliminates "Invalid token" error
2. **Simpler Onboarding** - Faster form submission without file uploads
3. **Better UX** - Users can upload documents later from their profile
4. **Secure** - Documents are only uploaded after authentication
5. **Flexible** - Users can add/update documents anytime from profile

## Testing Checklist

- [x] Onboarding form loads without errors
- [x] Can select educational documents
- [x] Can select employment documents
- [x] Selected files show in form
- [x] Form submits successfully
- [x] No "Invalid token" error
- [x] Employee profile created
- [x] Employee can login
- [x] Employee can upload documents from profile
- [x] Documents are properly stored

## Migration Path

### For Existing Onboarding Submissions
If there are existing submissions with document references, they can be:
1. Reviewed by HR in admin panel
2. Documents can be uploaded by employee after profile creation
3. Or HR can upload documents on behalf of employee

## Future Enhancements

1. **Bulk Document Upload** - Allow uploading multiple documents at once
2. **Document Templates** - Provide templates for common documents
3. **Automatic Document Verification** - AI-based document verification
4. **Document Expiry Tracking** - Track document expiration dates
5. **Document Versioning** - Keep history of document updates

## Notes

- Document selection is optional during onboarding
- Files are not actually uploaded until employee has valid token
- Document references are stored for HR review
- Employee can upload actual documents from profile page after login
- No file size limits during selection (only during actual upload)
- All file types are allowed during selection (validation happens on upload)

## Troubleshooting

### Issue: "Invalid token" error still appears
**Solution:**
- Clear browser cache (Ctrl+Shift+Delete)
- Hard refresh page (Ctrl+Shift+R)
- Check browser console for errors
- Verify backend is running

### Issue: Selected files don't appear
**Solution:**
- Check browser console for errors
- Verify file was actually selected
- Try selecting a different file
- Refresh page and try again

### Issue: Form won't submit
**Solution:**
- Verify all required fields are filled
- Check browser console for errors
- Verify backend is running
- Check network tab for API response

## References

- Onboarding Form: `frontend/src/app/pages/public/OnboardingPage.tsx`
- Onboarding Routes: `backend/routes/onboarding.js`
- Onboarding Model: `backend/models/OnboardingSubmission.js`
- Document Upload: `backend/routes/employee-dashboard.js`
