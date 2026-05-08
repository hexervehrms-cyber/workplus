# Onboarding Form - Quick Reference

## New Form Structure (6 Steps)

| Step | Section | Required | Fields |
|------|---------|----------|--------|
| 1 | Personal Information | ✅ | First Name, Last Name, Phone, DOB, Gender, Address |
| 2 | Emergency Contact | ✅ | Contact Name, Relationship, Phone |
| 3 | Banking Information | ✅ | Aadhar, PAN, Bank Account, IFSC Code |
| 4 | Educational Documents | ❌ | Certificate & Marksheet for 7 education levels |
| 5 | Upload Documents | ❌ | Employment documents (7 categories) |
| 6 | Review & Submit | ✅ | Review all info and submit |

## Educational Documents (Step 4)

**Education Levels:**
- 10th
- 12th
- Graduation
- Post Graduation
- Diploma
- Certificate
- Drop out

**For Each Level:**
- Upload Certificate (optional)
- Upload Marksheet (optional)

**Progress Tracking:**
- Shows percentage of documents uploaded
- Visual badges for completed uploads

## Employment Documents (Step 5)

**Document Categories:**
1. Letter of Intent
2. Offer Letter
3. Appointment Letter
4. Appraisal Letter
5. Salary Slips
6. Experience Letter
7. Relieving Letter

**Upload Process:**
- Select category
- Upload document (PDF, DOC, DOCX)
- View uploaded documents with status

## What Was Removed

❌ **Official Information Section** (Previously Step 2)
- Employee ID
- Joining Date
- Department
- Designation
- Employment Type
- Work Location

*Note: These are now set by HR after employee profile creation*

## What Was Added

✅ **Educational Documents Section** (Step 4)
- Upload certificates and marksheets
- Track education progress
- Optional section

✅ **Upload Documents Section** (Step 5)
- Upload employment documents
- Categorize documents
- Optional section

## Employee Profile Creation

When form is submitted:
1. ✅ User account created (role: employee)
2. ✅ Employee profile created with personal info
3. ✅ Sensitive info stored securely
4. ✅ Emergency contact saved
5. ✅ Documents linked to profile
6. ✅ Profile marked as "created via onboarding"

## File Changes

### Frontend
- `frontend/src/app/pages/public/OnboardingPage.tsx` - Complete restructure

### Backend
- `backend/routes/onboarding.js` - Updated submit endpoint
- `backend/models/OnboardingSubmission.js` - Added document fields

## Testing Steps

1. Go to Admin > Employees
2. Click "Generate Onboarding Link"
3. Copy the link and open in new tab
4. Fill all required fields
5. Upload optional documents
6. Review information
7. Submit form
8. Check Admin Dashboard for new employee with "Onboarding" badge

## Important Notes

- Official information (designation, department, etc.) is set by HR after onboarding
- Documents are optional but recommended
- All personal information is required
- Banking information is required and locked for 12 hours after update
- Employee profile is created immediately upon submission
