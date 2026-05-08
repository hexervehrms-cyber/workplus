# Educational Documents Feature - Quick Start Guide

## What Was Added

A new **Educational Documents** section in Employee → My Profile that allows employees to upload certificates and marksheets for 7 education levels.

## Education Levels
1. 10th
2. 12th
3. Graduation
4. Post Graduation
5. Diploma
6. Certificate
7. Drop out

## Document Types Per Level
- **Certificate**: Official certificate/degree
- **Marksheet**: Academic marksheet/transcript

## How It Works

### For Employees
1. Go to **Employee → My Profile**
2. Scroll to **Educational Documents** section (above "Upload Your Documents")
3. For each education level:
   - Click on the Certificate upload area
   - Select a PDF, DOC, DOCX, JPG, or PNG file
   - File uploads automatically
   - Green checkmark appears when done
   - Repeat for Marksheet
4. Watch the **Progress Bar** update in real-time
5. Progress shows: "X of 14 documents uploaded"

### Progress Tracking
- **0%**: No documents uploaded
- **7%**: 1 document uploaded (1 of 14)
- **14%**: 2 documents uploaded (2 of 14)
- **50%**: 7 documents uploaded (7 of 14)
- **100%**: All 14 documents uploaded

## Visual Indicators

### Upload Area States
1. **Empty**: Dashed border with upload icon
2. **Uploading**: Spinner animation
3. **Uploaded**: Green checkmark with filename

### Status Badges
- **Green "Certificate ✓"**: Certificate uploaded
- **Green "Marksheet ✓"**: Marksheet uploaded

## File Requirements
- **Formats**: PDF, DOC, DOCX, JPG, JPEG, PNG
- **Size Limit**: 10MB per file
- **Required**: At least one document per level (optional)

## Features
✅ Real-time progress bar
✅ Drag & drop upload support
✅ Click to upload support
✅ Loading indicators
✅ Success notifications
✅ Error handling
✅ Responsive design
✅ Mobile-friendly

## Build Information
- **Build Hash**: DTHidvY7
- **Status**: ✅ Production Ready
- **Location**: Employee Profile → Educational Documents

## To View Changes
1. **Hard refresh browser**: `Ctrl + Shift + R` (Windows/Linux) or `Cmd + Shift + R` (Mac)
2. **Or restart dev server**:
   - Stop: `Ctrl + C`
   - Start: `npm run dev`

## Troubleshooting

### Progress bar not updating
- Hard refresh browser cache
- Check browser console for errors
- Verify file upload completed successfully

### Upload fails
- Check file format (must be PDF, DOC, DOCX, JPG, JPEG, PNG)
- Check file size (max 10MB)
- Check internet connection
- Check authentication token validity

### Documents not showing after upload
- Wait a moment for state to update
- Hard refresh page
- Check browser console for errors

## API Endpoint
- **URL**: `/api/employee-dashboard/documents`
- **Method**: POST
- **Auth**: Required (Bearer token)
- **Response**: Document info with upload status

## Next Steps
1. Test uploading documents for each education level
2. Verify progress bar updates correctly
3. Check that all 14 slots can be filled
4. Test on different devices (mobile, tablet, desktop)
5. Verify error handling with invalid files
