# Task 15 - Next Phases Implementation Guide

## Phase 2: Approval Workflow

### Step 1: Update OnboardingSubmission Model

**File**: `backend/models/OnboardingSubmission.js`

Add these fields to the schema:

```javascript
status: { 
  type: String, 
  enum: ['pending', 'approved', 'rejected'], 
  default: 'pending',
  index: true
},
approvedBy: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User',
  default: null
},
approvalDate: {
  type: Date,
  default: null
},
rejectionReason: {
  type: String,
  default: null
}
```

### Step 2: Create Approval Endpoints

**File**: `backend/routes/onboarding.js`

Add these endpoints:

```javascript
/**
 * PUT /api/onboarding/submissions/:id/approve
 * Approve an onboarding submission
 */
router.put('/submissions/:id/approve',
  authenticate,
  authorize('super_admin', 'admin', 'hr'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const approvedBy = req.user.userId;

    try {
      const submission = await OnboardingSubmission.findByIdAndUpdate(
        id,
        {
          status: 'approved',
          approvedBy,
          approvalDate: new Date()
        },
        { new: true }
      );

      if (!submission) {
        return res.status(404).json({
          success: false,
          message: 'Submission not found'
        });
      }

      logger.info('Onboarding submission approved', {
        submissionId: id,
        approvedBy
      });

      res.json({
        success: true,
        message: 'Submission approved successfully',
        data: submission
      });
    } catch (error) {
      logger.error('Approve submission error', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to approve submission'
      });
    }
  })
);

/**
 * PUT /api/onboarding/submissions/:id/reject
 * Reject an onboarding submission
 */
router.put('/submissions/:id/reject',
  authenticate,
  authorize('super_admin', 'admin', 'hr'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    try {
      const submission = await OnboardingSubmission.findByIdAndUpdate(
        id,
        {
          status: 'rejected',
          rejectionReason: reason
        },
        { new: true }
      );

      if (!submission) {
        return res.status(404).json({
          success: false,
          message: 'Submission not found'
        });
      }

      logger.info('Onboarding submission rejected', {
        submissionId: id,
        reason
      });

      res.json({
        success: true,
        message: 'Submission rejected',
        data: submission
      });
    } catch (error) {
      logger.error('Reject submission error', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to reject submission'
      });
    }
  })
);
```

### Step 3: Update Login Endpoint

**File**: `backend/routes/auth.js`

Modify the login endpoint to check approval status:

```javascript
// After password validation, add:
const user = await User.findOne({ 
  email: email.toLowerCase().trim(),
  isActive: true
}).select('+password');

// Check if user account is approved
if (user.status === 'pending') {
  return res.status(403).json({
    success: false,
    message: 'Your account is pending approval. Please wait for admin approval.'
  });
}

if (user.status === 'rejected') {
  return res.status(403).json({
    success: false,
    message: 'Your account has been rejected. Please contact HR.'
  });
}
```

### Step 4: Create Admin Approval UI

**File**: `frontend/src/app/pages/admin/OnboardingSubmissions.tsx` (NEW FILE)

Create a new page to show pending submissions with approve/reject buttons.

---

## Phase 3: Admin Password Reset

### Step 1: Create Password Reset Endpoints

**File**: `backend/routes/auth.js`

Add these endpoints:

```javascript
/**
 * POST /api/admin/employees/:employeeId/reset-password
 * Generate temporary password for employee
 */
router.post('/admin/employees/:employeeId/reset-password',
  authenticate,
  authorize('super_admin', 'admin', 'hr'),
  asyncHandler(async (req, res) => {
    const { employeeId } = req.params;
    const adminId = req.user.userId;

    try {
      const employee = await Employee.findById(employeeId).populate('userId');
      
      if (!employee || !employee.userId) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }

      // Generate temporary password
      const tempPassword = crypto.randomBytes(8).toString('hex').toUpperCase();
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      // Update user password
      await User.findByIdAndUpdate(
        employee.userId._id,
        {
          password: hashedPassword,
          'security.passwordLastChanged': new Date(),
          'security.mustChangePassword': true
        }
      );

      logger.info('Password reset by admin', {
        employeeId,
        adminId
      });

      res.json({
        success: true,
        message: 'Password reset successfully',
        data: {
          temporaryPassword: tempPassword,
          employeeEmail: employee.userId.email,
          note: 'Share this temporary password with the employee. They must change it on first login.'
        }
      });
    } catch (error) {
      logger.error('Password reset error', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to reset password'
      });
    }
  })
);

/**
 * POST /api/admin/employees/:employeeId/set-password
 * Admin sets new password for employee
 */
router.post('/admin/employees/:employeeId/set-password',
  authenticate,
  authorize('super_admin', 'admin', 'hr'),
  asyncHandler(async (req, res) => {
    const { employeeId } = req.params;
    const { newPassword } = req.body;
    const adminId = req.user.userId;

    try {
      const employee = await Employee.findById(employeeId).populate('userId');
      
      if (!employee || !employee.userId) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }

      // Validate password
      if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 8 characters'
        });
      }

      // Hash and update password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await User.findByIdAndUpdate(
        employee.userId._id,
        {
          password: hashedPassword,
          'security.passwordLastChanged': new Date(),
          'security.mustChangePassword': false
        }
      );

      logger.info('Password set by admin', {
        employeeId,
        adminId
      });

      res.json({
        success: true,
        message: 'Password set successfully'
      });
    } catch (error) {
      logger.error('Set password error', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to set password'
      });
    }
  })
);
```

### Step 2: Add Password Reset UI to Admin Employees Page

**File**: `frontend/src/app/pages/admin/Employees.tsx`

Add a "Reset Password" button/action for each employee:

```typescript
// Add to employee row actions
<Button
  variant="outline"
  size="sm"
  onClick={() => openPasswordResetModal(employee)}
>
  <Lock className="w-4 h-4 mr-2" />
  Reset Password
</Button>

// Add modal component
<PasswordResetModal
  isOpen={showPasswordResetModal}
  employee={selectedEmployee}
  onClose={() => setShowPasswordResetModal(false)}
  onReset={handlePasswordReset}
/>
```

### Step 3: Create Password Reset Modal Component

**File**: `frontend/src/app/components/PasswordResetModal.tsx` (NEW FILE)

Create a modal that:
- Shows employee name and email
- Has option to generate temporary password or set new password
- Displays temporary password with copy button
- Shows confirmation message

---

## Testing Checklist for Phase 2 & 3

### Phase 2 Testing
- [ ] Onboarding submission shows in admin panel
- [ ] Admin can approve submission
- [ ] Admin can reject submission with reason
- [ ] Approved employee can login
- [ ] Pending employee cannot login
- [ ] Rejected employee cannot login
- [ ] Approval status persists in database

### Phase 3 Testing
- [ ] Admin can reset employee password
- [ ] Temporary password works for login
- [ ] Employee must change password on first login
- [ ] Admin can set new password directly
- [ ] Password reset history is logged
- [ ] Multiple password resets work correctly

---

## Database Considerations

### OnboardingSubmission Model Changes
- Add 4 new fields (status, approvedBy, approvalDate, rejectionReason)
- Add index on status field for faster queries
- No data migration needed (defaults will be applied)

### User Model Changes
- Already has `status` field (can be used for approval)
- Already has `security.mustChangePassword` field
- No changes needed

---

## API Endpoints Summary

### Phase 2 Endpoints
- `PUT /api/onboarding/submissions/:id/approve` - Approve submission
- `PUT /api/onboarding/submissions/:id/reject` - Reject submission

### Phase 3 Endpoints
- `POST /api/admin/employees/:employeeId/reset-password` - Generate temp password
- `POST /api/admin/employees/:employeeId/set-password` - Set new password

---

## Security Notes

- Temporary passwords should be strong and random
- Passwords should never be logged in plain text
- Password reset should be logged for audit trail
- Only admins should be able to reset passwords
- Consider adding email notification when password is reset
- Consider adding 2FA for sensitive operations

---

## Estimated Implementation Time

- Phase 2: 2-3 hours
- Phase 3: 2-3 hours
- Testing: 1-2 hours
- **Total**: 5-8 hours

---

**Last Updated**: May 3, 2026
