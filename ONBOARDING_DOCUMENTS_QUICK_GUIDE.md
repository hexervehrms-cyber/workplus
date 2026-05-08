# Onboarding Documents - Quick Guide

## What Changed?

### Before ❌
- Documents were uploaded immediately during onboarding
- Required authentication token (which didn't exist)
- Got "Invalid token" error
- Slow form submission

### After ✅
- Documents are selected locally during onboarding
- No authentication required during selection
- Files stored in form state
- Fast form submission
- Documents uploaded after employee login

## How It Works Now

### Step 1: Onboarding Form
```
Employee fills form
    ↓
Selects educational documents (local)
    ↓
Selects employment documents (local)
    ↓
Submits form
```

### Step 2: Profile Creation
```
Backend creates employee profile
    ↓
Backend creates user account
    ↓
Employee receives login credentials
```

### Step 3: Document Upload
```
Employee logs in
    ↓
Goes to Profile > Documents
    ↓
Uploads documents with valid token
```

## Educational Documents Section

### What You Can Do
- ✅ Select certificate for each education level
- ✅ Select marksheet for each education level
- ✅ See progress percentage
- ✅ View selected files

### What You Can't Do (During Onboarding)
- ❌ Upload files (they're selected, not uploaded)
- ❌ Delete selected files (can do this after login)
- ❌ Modify files (can do this after login)

### Education Levels Available
1. 10th
2. 12th
3. Graduation
4. Post Graduation
5. Diploma
6. Certificate
7. Drop out

### File Types Allowed
- PDF
- DOC
- DOCX
- JPG
- JPEG
- PNG

## Employment Documents Section

### What You Can Do
- ✅ Select document category
- ✅ Select employment documents
- ✅ View selected files
- ✅ See file size and upload date

### Document Categories
1. Letter of Intent
2. Offer Letter
3. Appointment Letter
4. Appraisal Letter
5. Salary Slips
6. Experience Letter
7. Relieving Letter

### File Types Allowed
- PDF
- DOC
- DOCX

## Status Indicators

### During Onboarding
- **"Selected"** - File has been selected locally
- **"Pending Upload"** - File will be uploaded after login

### After Login
- **"Pending"** - File uploaded, awaiting HR review
- **"Verified"** - HR has verified the document
- **"Rejected"** - HR rejected the document

## Common Questions

### Q: Why can't I upload documents during onboarding?
**A:** The onboarding form is public and doesn't require authentication. Document uploads require a valid login token for security. You can upload documents after creating your account.

### Q: Will my selected files be lost?
**A:** No, they're stored in the form state and submitted with your onboarding data. HR can see them in the admin panel.

### Q: Can I upload documents after onboarding?
**A:** Yes! After you receive your login credentials and log in, you can upload documents from your Profile page.

### Q: What if I don't select any documents?
**A:** That's fine! Document selection is optional. You can upload them later from your profile.

### Q: Can I change selected documents?
**A:** Yes, just select a different file. The new file will replace the previous selection.

### Q: What's the file size limit?
**A:** During selection, there's no limit. When uploading from your profile, the limit is 10MB per file.

## Testing the Feature

### Test 1: Select Educational Documents
1. Go to Onboarding Form
2. Fill Personal Information
3. Fill Emergency Contact
4. Fill Banking Information
5. Go to Educational Documents step
6. Select certificate for "Graduation"
7. Select marksheet for "Graduation"
8. Verify files appear with "Selected" status
9. ✅ No errors should appear

### Test 2: Select Employment Documents
1. Continue from Test 1
2. Go to Upload Documents step
3. Select "Experience Letter" category
4. Select a document file
5. Verify file appears in list
6. ✅ No errors should appear

### Test 3: Submit Form
1. Continue from Test 2
2. Go to Review & Submit step
3. Verify all information is correct
4. Click "Submit Onboarding"
5. ✅ Should see success message
6. ✅ Should be redirected to home

### Test 4: Upload After Login
1. Receive login credentials
2. Log in to employee account
3. Go to Profile > Documents
4. Upload documents with valid token
5. ✅ Documents should upload successfully

## Troubleshooting

### Problem: "Invalid token" error
**Solution:** This should no longer appear. If it does:
- Clear browser cache
- Hard refresh (Ctrl+Shift+R)
- Try again

### Problem: Selected files don't appear
**Solution:**
- Check browser console (F12)
- Verify file was selected
- Try selecting again
- Refresh page

### Problem: Form won't submit
**Solution:**
- Verify all required fields filled
- Check browser console for errors
- Verify backend is running
- Try again

### Problem: Can't upload after login
**Solution:**
- Verify you're logged in
- Go to Profile > Documents
- Check file size (max 10MB)
- Check file type (PDF, DOC, DOCX)
- Try again

## Key Points to Remember

1. **Documents are selected, not uploaded** during onboarding
2. **No authentication needed** for selection
3. **Files stored locally** in form state
4. **Submitted with form** to backend
5. **Uploaded after login** from profile page
6. **Optional** - you can skip document selection
7. **Can be updated** anytime from profile

## Next Steps

1. ✅ Fill onboarding form
2. ✅ Select documents (optional)
3. ✅ Submit form
4. ✅ Receive login credentials
5. ✅ Log in to account
6. ✅ Upload documents from profile
7. ✅ HR reviews documents
8. ✅ Documents verified

## Support

If you encounter any issues:
1. Check browser console (F12)
2. Check network tab for API errors
3. Try clearing cache and refreshing
4. Contact HR or admin for help
