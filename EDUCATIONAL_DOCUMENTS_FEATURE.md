# Educational Documents Upload Feature

## Overview
Added a comprehensive educational documents section to the employee profile where employees can upload certificates and marksheets for each education level. The section includes a real-time progress bar that updates as documents are uploaded.

## Features Implemented

### 1. Education Levels Supported
- 10th
- 12th
- Graduation
- Post Graduation
- Diploma
- Certificate
- Drop out

### 2. Document Types Per Level
Each education level has two upload slots:
- **Certificate**: Official certificate/degree document
- **Marksheet**: Academic marksheet/transcript

Total: 14 document slots (7 levels × 2 document types)

### 3. Progress Tracking
- **Real-time Progress Bar**: Updates as documents are uploaded
- **Progress Percentage**: Shows completion percentage (0-100%)
- **Document Counter**: Displays "X of 14 documents uploaded"
- **Visual Badges**: Green checkmarks show which documents are uploaded

### 4. Upload Interface
Each education level has:
- **Two Upload Areas**: Side-by-side certificate and marksheet uploads
- **Drag & Drop Support**: Click or drag files to upload
- **File Type Support**: PDF, DOC, DOCX, JPG, JPEG, PNG
- **Upload Status**: Shows loading spinner during upload
- **Success Indicator**: Green checkmark with filename after upload
- **Status Badges**: Shows "Certificate ✓" and "Marksheet ✓" when uploaded

### 5. User Experience
- **Organized Layout**: Each education level in a separate bordered card
- **Clear Labels**: Each upload area clearly labeled
- **Responsive Design**: Grid layout adapts to screen size
- **Loading States**: Visual feedback during upload
- **Error Handling**: Toast notifications for success/error
- **File Validation**: Only accepts valid document formats

## Frontend Implementation

### State Variables
```typescript
// Educational documents storage
const [educationalDocuments, setEducationalDocuments] = useState<{
  [key: string]: { certificate?: Document; marksheet?: Document };
}>({
  '10th': {},
  '12th': {},
  'Graduation': {},
  'Post Graduation': {},
  'Diploma': {},
  'Certificate': {},
  'Drop out': {}
});

// Upload tracking
const [uploadingEducation, setUploadingEducation] = useState<string | null>(null);
const [uploadingEducationType, setUploadingEducationType] = useState<'certificate' | 'marksheet' | null>(null);
```

### Key Functions

#### `calculateEducationProgress()`
- Calculates completion percentage
- Formula: `(filledSlots / totalSlots) * 100`
- Total slots: 14 (7 levels × 2 document types)
- Updates in real-time as documents are uploaded

#### `handleEducationDocumentUpload()`
- Handles file upload for each education level and document type
- Sends to `/api/employee-dashboard/documents` endpoint
- Updates state with uploaded document info
- Shows success/error toast notifications
- Manages loading states

### UI Components
- **Progress Bar**: Shows visual progress with percentage
- **Education Level Cards**: Bordered containers for each level
- **Upload Areas**: Dashed border upload zones with drag-drop support
- **Status Badges**: Green badges showing uploaded documents
- **Loading Spinner**: Animated loader during upload
- **Success Checkmark**: Green checkmark with filename after upload

## API Integration

### Endpoint
- **URL**: `http://localhost:5000/api/employee-dashboard/documents`
- **Method**: POST
- **Authentication**: Bearer token required

### Request Format
```javascript
FormData {
  document: File,
  name: string,
  type: `education_${level}_${docType}`
}
```

### Response Format
```json
{
  "success": true,
  "data": {
    "id": "document_id",
    "name": "filename.pdf",
    "size": "2.5 MB",
    "uploadedAt": "2026-05-03T...",
    "status": "uploaded",
    "filePath": "/uploads/..."
  }
}
```

## File Structure

### Modified Files
- `frontend/src/app/pages/employee/Profile.tsx`
  - Added educational documents state
  - Added progress calculation function
  - Added upload handler function
  - Added educational documents UI section

### Location in Profile
- **Position**: Just above "Upload Your Documents" section
- **Section Order**:
  1. Personal Information
  2. Official Information
  3. Currency Settings
  4. Sensitive Information
  5. **Educational Documents** ← NEW
  6. Upload Your Documents
  7. Currency Selector Modal

## Build Status
✅ Frontend builds successfully
✅ Hash changed: `CDEk2rRD` → `DTHidvY7` (code updated)
✅ No TypeScript errors
✅ No compilation warnings

## Testing Checklist

- [ ] Educational Documents section appears above "Upload Your Documents"
- [ ] All 7 education levels are displayed
- [ ] Each level has 2 upload areas (Certificate and Marksheet)
- [ ] Progress bar shows 0% initially
- [ ] Can upload certificate for 10th
- [ ] Progress bar updates to ~7% (1 of 14)
- [ ] Green checkmark appears after upload
- [ ] Can upload marksheet for 10th
- [ ] Progress bar updates to ~14% (2 of 14)
- [ ] Badge shows "Certificate ✓" and "Marksheet ✓"
- [ ] Can upload documents for all education levels
- [ ] Progress bar reaches 100% when all 14 documents uploaded
- [ ] Document counter shows correct count
- [ ] Loading spinner appears during upload
- [ ] Success toast notification appears
- [ ] Error handling works for failed uploads
- [ ] File type validation works (only PDF, DOC, DOCX, JPG, PNG)
- [ ] Responsive design works on mobile/tablet/desktop

## Future Enhancements

1. **Document Verification**: Admin approval workflow for uploaded documents
2. **Document Preview**: Preview uploaded documents before submission
3. **Document Deletion**: Allow employees to delete and re-upload documents
4. **Document Expiry**: Set expiration dates for certificates
5. **Bulk Upload**: Upload multiple documents at once
6. **Document Templates**: Provide templates for document formats
7. **Verification Status**: Show verification status for each document
8. **Download History**: Track when documents were downloaded
9. **Document Sharing**: Share documents with specific users/departments
10. **Compliance Tracking**: Track compliance with document requirements

## Notes

- All documents are stored in the backend with proper file validation
- File size limit: 10MB per file
- Supported formats: PDF, DOC, DOCX, JPG, JPEG, PNG
- Progress updates in real-time as documents are uploaded
- No page refresh needed - state updates automatically
- All uploads require authentication token
- Documents are associated with the logged-in employee
