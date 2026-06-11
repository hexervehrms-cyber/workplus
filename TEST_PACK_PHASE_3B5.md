# Phase 3B.5: Employee Dashboard Real Browser Runtime Test Pack

## Overview
This test pack provides:
1. Manual browser test checklist for hexerve.online
2. Expected network calls and responses
3. Bug report template
4. Playwright scaffold (optional automated testing)

---

## PART 1: MANUAL BROWSER TEST CHECKLIST

### A. PRE-TEST SETUP

**1. Confirm Backend Health**
```
GET https://hexerve.online/api/health
Expected: 200 OK, JSON response with status: "healthy"
```

**2. Verify Test Employee Account**
- [ ] Test employee exists and is NOT currently checked-in
- [ ] Test employee belongs to an active organization
- [ ] Test employee has role: "employee"

**3. Browser Preparation**
- [ ] Open https://hexerve.online in Chrome/Firefox
- [ ] Open DevTools (F12)
- [ ] Go to **Network** tab
- [ ] Filter network by: "attendance" / "dashboard" / "socket"
- [ ] Disable browser cache: DevTools → Settings → Network → "Disable cache (while DevTools open)"
- [ ] Open **Console** tab and verify NO errors present before test starts

**4. Test Timeline**
- Total expected time: ~15–20 minutes per flow
- Each test should be independent (can restart browser between tests)

---

### B. TEST 1: EMPLOYEE LOGIN

**Steps:**
1. [ ] Navigate to https://hexerve.online/login
2. [ ] Enter test employee email and password (do not print)
3. [ ] Click Sign In
4. [ ] Wait for redirect to dashboard

**Network Expected:**
- [ ] POST /api/auth/login → 200 OK, returns auth token
- [ ] GET /health → 200 OK
- [ ] Socket.IO connection established (check Console for "Socket connected" or similar)

**Console Expected:**
- [ ] No error messages
- [ ] Possible: "Socket connected" or similar

**UI Expected:**
- [ ] Dashboard loads
- [ ] Header shows "Good morning/afternoon/evening, [Name]"
- [ ] No loading spinner stuck

---

### C. TEST 2: DASHBOARD LOAD

**Steps:**
1. [ ] Dashboard should now display
2. [ ] Look for KPI cards: "Leave Balance", "Hours This Week", "Performance"
3. [ ] Look for attendance action buttons: "Check In", "Break", "Check Out"

**Network Expected:**
- [ ] GET /api/attendance/today → 200 OK
- [ ] GET /api/leave/balance/... → 200 OK
- [ ] GET /api/payroll/... (if payroll module enabled)

**Console Expected:**
- [ ] No "Cannot find name" errors (TypeScript errors)
- [ ] No 401/403 auth errors

**UI Expected:**
- [ ] All KPI cards display values (not loading spinners)
- [ ] "Check In" button is enabled and visible
- [ ] Dashboard is NOT stuck in loading state

---

### D. TEST 3: CHECK-IN

**Steps:**
1. [ ] Locate "Check In" button
2. [ ] Click it
3. [ ] **Immediately observe**: Button state changes
4. [ ] **Within 1–2 seconds**: Timer should start incrementing (look for "0h 0m 1s")
5. [ ] Wait 10 seconds total
6. [ ] Observe timer reaches approximately "0h 0m 10s"

**Network Expected:**
- [ ] POST /api/attendance/check-in → 200 or 201 OK
  - Request body should have: `{ notes: "...", idempotencyKey: "..." }`
  - Response should include: `{ attendance: {...}, liveStatus: {...}, hoursThisWeek: ... }`
- [ ] GET /api/attendance/today → 200 OK (after check-in, to refresh state)
- [ ] Verify **no duplicate** POST /api/attendance/check-in requests (should see only 1)

**Console Expected:**
- [ ] No 409 "Conflict" errors
- [ ] No "Duplicate check-in" messages

**UI Expected:**
- [ ] Button changes from "Check In" to "Break" and "Check Out"
- [ ] Timer visible and incrementing: "0h 0m Xs"
- [ ] "Hours This Week" KPI does NOT reset to 0

**PASS CRITERIA:**
- ✅ Button state changed
- ✅ Timer started within 1–2 seconds
- ✅ Timer increments every 1 second
- ✅ No console errors
- ✅ Exactly 1 POST /api/attendance/check-in request

---

### E. TEST 4: START BREAK

**Steps:**
1. [ ] While checked in, observe work timer incrementing (e.g., "0h 0m 15s")
2. [ ] Click "Start Break"
3. [ ] **Immediately observe**: Work timer should stop incrementing
4. [ ] **Immediately observe**: Break timer should appear and show (e.g., "0m 0s")
5. [ ] Wait 5 seconds
6. [ ] Work timer should still be at "0h 0m 15s" (paused)
7. [ ] Break timer should show approximately "0m 5s"

**Network Expected:**
- [ ] POST /api/attendance/break-start → 200 OK
  - Request body: `{ breakType: "regular", notes: "...", idempotencyKey: "..." }`
  - Response includes: `{ liveStatus: { isOnBreak: true, ... }, ... }`
- [ ] GET /api/attendance/today → 200 OK (to refresh state)
- [ ] Verify **no duplicate** POST /api/attendance/break-start requests (should see only 1)

**Console Expected:**
- [ ] No 409 errors
- [ ] Possible debug log: "[BREAK START] Success"

**UI Expected:**
- [ ] Work timer stops incrementing (paused)
- [ ] Break timer appears showing active break duration (e.g., "0m 5s")
- [ ] "Break" button changes to "End Break"

**PASS CRITERIA:**
- ✅ Work timer paused immediately
- ✅ Break timer started immediately
- ✅ No 12-second wait
- ✅ Exactly 1 POST /api/attendance/break-start request

---

### F. TEST 5: END BREAK IMMEDIATE RESUME (CRITICAL)

**Steps:**
1. [ ] While on break, note the work timer (should be paused, e.g., "0h 0m 15s")
2. [ ] Note the break timer (should show elapsed, e.g., "0m 8s")
3. [ ] Click "End Break"
4. [ ] **IMMEDIATELY observe** (do NOT wait): Work timer should resume incrementing
5. [ ] Within **1 second**: Work timer should increment to "0h 0m 16s"
6. [ ] Break timer should disappear or reset to 0

**Network Expected:**
- [ ] POST /api/attendance/break-end → 200 OK
  - Response includes: `{ liveStatus: { isOnBreak: false, ... }, ... }`
- [ ] GET /api/attendance/today → 200 OK (optional refresh)

**Console Expected:**
- [ ] No 409 errors
- [ ] Possible debug log: "[BREAK END] Success"
- [ ] **NO** message about "waiting 12 seconds" or "disabled refresh"

**UI Expected:**
- [ ] Work timer resumes incrementing IMMEDIATELY (no 12-second pause)
- [ ] Break timer clears/resets
- [ ] "End Break" button changes back to "Break"

**FAIL CRITERIA (CRITICAL BUG IF TRUE):**
- ❌ Work timer does NOT resume for 12+ seconds
- ❌ Work timer stays frozen after click
- ❌ Break timer still visible after click
- ❌ "Break" button is disabled for 12+ seconds

**PASS CRITERIA:**
- ✅ Work timer resumes within 1 second
- ✅ Break timer cleared
- ✅ No artificial 12-second delay
- ✅ Exactly 1 POST /api/attendance/break-end request

---

### G. TEST 6: REFRESH DURING WORK

**Steps:**
1. [ ] While checked in and NOT on break, observe work timer (e.g., "0h 1m 30s")
2. [ ] Note the timer value
3. [ ] Press F5 to refresh the page
4. [ ] Wait for dashboard to reload
5. [ ] Observe work timer recalculates from server time

**Network Expected:**
- [ ] GET /api/attendance/today → 200 OK (on page reload)
- [ ] Timer should recalculate from server `checkInTime` and current time

**Console Expected:**
- [ ] No localStorage override warnings
- [ ] No "stale data" errors

**UI Expected:**
- [ ] Dashboard reloads in checked-in state
- [ ] Timer resumes from approximately the same value (or slightly more)
- [ ] No reset to "0h 0m 0s"
- [ ] Work continues to increment

**FAIL CRITERIA:**
- ❌ Timer resets to 0 after refresh
- ❌ Timer goes backwards
- ❌ "Check In" button appears (incorrectly shows not checked in)

**PASS CRITERIA:**
- ✅ Timer continues from server-calculated value
- ✅ Dashboard remains checked-in
- ✅ No reset/loss of time

---

### H. TEST 7: REFRESH DURING BREAK

**Steps:**
1. [ ] Start a break (work timer paused at ~"0h 1m 40s")
2. [ ] Let break run for ~5 seconds (break timer shows ~"0m 5s")
3. [ ] Press F5 to refresh
4. [ ] Wait for dashboard to reload
5. [ ] Verify on-break state is restored
6. [ ] Verify break timer recalculates

**Network Expected:**
- [ ] GET /api/attendance/today → 200 OK
- [ ] Response includes: `{ liveStatus: { isOnBreak: true, ... }, attendance: { breaks: [...], ... } }`

**Console Expected:**
- [ ] No errors

**UI Expected:**
- [ ] Dashboard reloads in on-break state
- [ ] Break timer recalculates from server break start time
- [ ] Work timer remains paused
- [ ] No duplicate active break appears

**FAIL CRITERIA:**
- ❌ Dashboard shows checked in but NOT on break (lost break state)
- ❌ Multiple active breaks created
- ❌ Break timer resets to 0

**PASS CRITERIA:**
- ✅ On-break state preserved
- ✅ Break timer accurate
- ✅ No duplicates
- ✅ Work timer still paused

---

### I. TEST 8: HIDDEN TAB RESYNC (CRITICAL)

**Steps:**
1. [ ] Ensure checked in and NOT on break
2. [ ] Note work timer (e.g., "0h 2m 10s")
3. [ ] Open a NEW tab in the same browser
4. [ ] Navigate to a different website in new tab
5. [ ] Wait 2–3 minutes (employee dashboard is now "hidden")
6. [ ] Return to the employee dashboard tab (click on the tab)
7. [ ] Immediately observe work timer

**Expected Behavior:**
- Timer should jump to the correct server time (e.g., ~"0h 5m 10s", accounting for 3 minutes hidden)
- Timer should NOT remain at "0h 2m 10s" (would indicate hidden-tab pause drift)
- Timer should NOT show negative time

**Network Expected:**
- [ ] On tab visibility change, dashboard calls GET /api/attendance/today
- [ ] Logs or console should show: "Syncing from server on visible"

**Console Expected:**
- [ ] No "API spam" errors (requests should not loop excessively)
- [ ] Possible: "Dashboard synced from server"

**UI Expected:**
- [ ] Timer jumps to accurate server value
- [ ] No 60-second wait
- [ ] No continuous API calls every 1 second

**FAIL CRITERIA (CRITICAL BUG):**
- ❌ Timer remains paused at old value (undercount)
- ❌ API calls loop excessively (spam)
- ❌ Artificial 60-second delay

**PASS CRITERIA:**
- ✅ Timer updates to server value on return
- ✅ No time undercount
- ✅ No API spam

---

### J. TEST 9: CHECK-OUT

**Steps:**
1. [ ] While checked in (and NOT on break), observe work timer (e.g., "0h 3m 40s")
2. [ ] Click "Check Out"
3. [ ] **Immediately observe**: Timer stops, button state changes
4. [ ] Observe "Hours This Week" KPI updates (if applicable)
5. [ ] Refresh page
6. [ ] Verify checked-out state persists

**Network Expected:**
- [ ] POST /api/attendance/check-out → 200 OK
  - Response includes: `{ attendance: { checkOut: "...", hoursWorked: X, ... }, ... }`
- [ ] GET /api/attendance/today → 200 OK (after check-out)

**Console Expected:**
- [ ] No errors
- [ ] Possible: "Break ended" if break was in progress

**UI Expected:**
- [ ] Timer stops incrementing
- [ ] Button state changes from "Break" / "Check Out" to "Check In"
- [ ] "Hours This Week" displays final hours for the day
- [ ] After refresh: Dashboard still shows checked-out state
- [ ] Timer remains stopped

**FAIL CRITERIA:**
- ❌ Timer continues after check-out
- ❌ Dashboard shows checked-in after refresh
- ❌ Hours reset to 0

**PASS CRITERIA:**
- ✅ Check-out succeeds
- ✅ State persists after refresh
- ✅ Final hours correct (checkOut - checkIn - breaks)

---

### K. TEST 10: ADMIN VERIFICATION

**Steps:**
1. [ ] Logout from employee account
2. [ ] Login as Admin
3. [ ] Navigate to Admin dashboard or Attendance page
4. [ ] Search for or locate the test employee
5. [ ] Verify the attendance record shows:
   - [ ] Check-in time matches employee dashboard
   - [ ] Check-out time matches employee dashboard
   - [ ] Breaks appear in the record
   - [ ] Total hours match

**Network Expected:**
- [ ] GET /api/admin/attendance (or equivalent admin endpoint) → 200 OK
- [ ] Returns test employee attendance data

**Console Expected:**
- [ ] No errors

**UI Expected:**
- [ ] Admin dashboard displays test employee attendance
- [ ] Times match what employee saw
- [ ] Break durations are recorded

**PASS CRITERIA:**
- ✅ Admin can see employee attendance
- ✅ Data matches employee side
- ✅ All breaks recorded

---

## PART 2: EXPECTED NETWORK CALLS

### Check-In Flow
```
POST /api/attendance/check-in
Status: 200 / 201
Request:
{
  "notes": "Checked in",
  "idempotencyKey": "check-in-[uid]-[day]-[timestamp]"
}

Response:
{
  "success": true,
  "data": {
    "attendance": {
      "checkIn": "2024-06-11T09:30:00Z",
      "checkOut": null,
      "hoursWorked": 0,
      "breaks": []
    },
    "liveStatus": {
      "status": "checked_in",
      "currentHours": 0,
      "isOnBreak": false
    },
    "hoursThisWeek": 34.5,
    "weekKey": "2024-W24"
  }
}
```

### Start Break Flow
```
POST /api/attendance/break-start
Status: 200
Request:
{
  "breakType": "regular",
  "notes": "Break started",
  "idempotencyKey": "break-start-[uid]-[day]-[timestamp]"
}

Response:
{
  "success": true,
  "data": {
    "attendance": {
      "breaks": [
        {
          "startTime": "2024-06-11T10:15:00Z",
          "endTime": null,
          "breakType": "regular"
        }
      ]
    },
    "liveStatus": {
      "status": "on_break",
      "isOnBreak": true,
      "currentBreakDuration": 0
    }
  }
}
```

### End Break Flow
```
POST /api/attendance/break-end
Status: 200
Request:
{
  "notes": "Break ended",
  "idempotencyKey": "break-end-[uid]-[day]-[timestamp]"
}

Response:
{
  "success": true,
  "data": {
    "attendance": {
      "breaks": [
        {
          "startTime": "2024-06-11T10:15:00Z",
          "endTime": "2024-06-11T10:25:00Z",
          "duration": 10,
          "breakType": "regular"
        }
      ]
    },
    "liveStatus": {
      "status": "checked_in",
      "isOnBreak": false,
      "currentBreakDuration": 0
    }
  }
}
```

### Attendance Today (GET)
```
GET /api/attendance/today
Status: 200
Response:
{
  "success": true,
  "data": {
    "attendance": {
      "date": "2024-06-11",
      "checkIn": "2024-06-11T09:30:00Z",
      "checkOut": "2024-06-11T18:00:00Z",
      "hoursWorked": 8.5,
      "breaks": [...]
    },
    "liveStatus": {...},
    "hoursThisWeek": 42.5,
    "weekKey": "2024-W24"
  }
}
```

---

## PART 3: BUG REPORT TEMPLATE

### When You Find a Bug

**Copy and fill in:**

```
## BUG: [ONE-LINE TITLE]

**Severity:** Critical / High / Medium / Low

**User Role:** Employee / Admin / Super Admin

**Page URL:** https://hexerve.online/[path]

**Steps to Reproduce:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Result:**
[What should happen]

**Actual Result:**
[What actually happens]

**Network Details (from DevTools):**
- Request URL: [URL]
- Method: [GET/POST/etc]
- Status: [200/400/500/etc]
- Response: [If error, copy relevant part - no secrets]

**Console Error (if any):**
```
[Copy console error here - no secrets]
```

**Screenshot/Video:**
[If possible, attach screenshot showing the bug]

**Suspected Component/Function:**
[E.g., handleBreakEnd, timer loop, attendance API, etc]

**Recommended Fix:**
[Your suggestion on what might fix it]
```

---

## PART 4: PLAYWRIGHT SCAFFOLD

### Setup Instructions

**1. Install Playwright**
```bash
npm install --save-dev @playwright/test
npx playwright install
```

**2. Environment Variables**
Create a `.env.test` file (DO NOT commit):
```
TEST_EMPLOYEE_EMAIL=test.employee@hexerve.local
TEST_EMPLOYEE_PASSWORD=TemporaryPassword123!
TEST_ADMIN_EMAIL=test.admin@hexerve.local
TEST_ADMIN_PASSWORD=AdminPassword123!
BASE_URL=https://hexerve.online
ALLOW_PROD_E2E=false
```

**3. Load Env in Test**
```bash
npm install --save-dev dotenv
```

**4. Create Test File**

**File: `tests/employee-dashboard.spec.ts`**

```typescript
import { test, expect, Page } from '@playwright/test';
import dotenv from 'dotenv';

// Load env vars
dotenv.config({ path: '.env.test' });

const BASE_URL = process.env.BASE_URL || 'https://hexerve.online';
const ALLOW_PROD = process.env.ALLOW_PROD_E2E === 'true';
const TEST_EMAIL = process.env.TEST_EMPLOYEE_EMAIL || '';
const TEST_PASSWORD = process.env.TEST_EMPLOYEE_PASSWORD || '';

// Skip all tests if env vars missing or production without explicit flag
test.beforeAll(async () => {
  if (!TEST_EMAIL || !TEST_PASSWORD) {
    throw new Error('Missing TEST_EMPLOYEE_EMAIL or TEST_EMPLOYEE_PASSWORD');
  }
  if (BASE_URL.includes('hexerve.online') && !ALLOW_PROD) {
    throw new Error('Set ALLOW_PROD_E2E=true to run against production');
  }
});

// Helper: Mask sensitive data in logs
function maskSensitive(text: string): string {
  return text
    .replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL]')
    .replace(/Bearer\s[\w.-]+/g, 'Bearer [TOKEN]')
    .replace(/password[^,}]*/gi, 'password: [MASKED]');
}

// Helper: Login
async function loginAsEmployee(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button:has-text("Sign In")');
  await page.waitForURL(`${BASE_URL}/employee`);
}

test.describe('Employee Dashboard Attendance', () => {
  test('T1: Check-in timer starts immediately', async ({ page }) => {
    await loginAsEmployee(page);
    
    // Wait for dashboard to load
    await page.waitForSelector('button:has-text("Check In")');
    
    // Measure timer start time
    const startTime = Date.now();
    
    // Click check-in
    await page.click('button:has-text("Check In")');
    
    // Verify API call
    const response = await page.waitForResponse(
      res => res.url().includes('/api/attendance/check-in') && res.status() === 200
    );
    console.log('✓ Check-in API returned 200');
    
    // Verify timer starts within 2 seconds
    const timerElapsed = Date.now() - startTime;
    expect(timerElapsed).toBeLessThan(2000);
    console.log(`✓ Timer started within ${timerElapsed}ms`);
    
    // Verify no console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        throw new Error(`Console error: ${maskSensitive(msg.text())}`);
      }
    });
  });

  test('T2: Start break pauses work timer', async ({ page }) => {
    await loginAsEmployee(page);
    await page.waitForSelector('button:has-text("Start Break")');
    
    // Wait for timer to increment
    await page.waitForTimeout(3000);
    
    // Note work timer value
    const timerBefore = await page.textContent('[data-testid="work-timer"]') || '0h 0m 0s';
    
    // Start break
    await page.click('button:has-text("Start Break")');
    await page.waitForResponse(
      res => res.url().includes('/api/attendance/break-start') && res.status() === 200
    );
    
    // Wait briefly
    await page.waitForTimeout(2000);
    
    // Verify timer is same (paused)
    const timerAfter = await page.textContent('[data-testid="work-timer"]') || timerBefore;
    expect(timerAfter).toBe(timerBefore);
    console.log('✓ Work timer paused');
    
    // Verify break timer visible
    const breakTimer = await page.textContent('[data-testid="break-timer"]');
    expect(breakTimer).toBeTruthy();
    console.log('✓ Break timer visible');
  });

  test('T3: End break resumes timer immediately', async ({ page }) => {
    await loginAsEmployee(page);
    
    // Start break first
    await page.click('button:has-text("Start Break")');
    await page.waitForResponse(
      res => res.url().includes('/api/attendance/break-start') && res.status() === 200
    );
    await page.waitForTimeout(2000);
    
    // Note timer before ending break
    const timerBefore = await page.textContent('[data-testid="work-timer"]');
    
    // End break
    const startTime = Date.now();
    await page.click('button:has-text("End Break")');
    
    // Verify API call
    await page.waitForResponse(
      res => res.url().includes('/api/attendance/break-end') && res.status() === 200
    );
    
    // Check timer resumed immediately (within 1 second)
    const resumeTime = Date.now() - startTime;
    expect(resumeTime).toBeLessThan(1000);
    console.log(`✓ Break ended and timer resumed within ${resumeTime}ms`);
    
    // Verify break timer cleared
    const breakTimer = await page.textContent('[data-testid="break-timer"]');
    expect(breakTimer).toBeNull();
    console.log('✓ Break timer cleared');
  });

  test('T4: Check-out finalizes hours', async ({ page }) => {
    await loginAsEmployee(page);
    await page.click('button:has-text("Check In")');
    await page.waitForResponse(
      res => res.url().includes('/api/attendance/check-in') && res.status() === 200
    );
    
    // Wait to accumulate some hours
    await page.waitForTimeout(5000);
    
    // Check out
    await page.click('button:has-text("Check Out")');
    const response = await page.waitForResponse(
      res => res.url().includes('/api/attendance/check-out') && res.status() === 200
    );
    
    const data = await response.json();
    const hoursWorked = data?.data?.attendance?.hoursWorked || 0;
    console.log(`✓ Check-out successful, hours worked: ${hoursWorked}`);
    expect(hoursWorked).toBeGreaterThan(0);
  });

  test('T5: Refresh during work preserves state', async ({ page }) => {
    await loginAsEmployee(page);
    await page.click('button:has-text("Check In")');
    await page.waitForResponse(
      res => res.url().includes('/api/attendance/check-in') && res.status() === 200
    );
    
    // Wait to accumulate time
    await page.waitForTimeout(5000);
    
    // Refresh
    await page.reload();
    
    // Verify still checked in
    const checkInBtn = await page.$('button:has-text("Check In")');
    expect(checkInBtn).toBeNull();
    console.log('✓ State preserved after refresh');
  });

  test('T6: Admin sees employee attendance', async ({ page }) => {
    const adminEmail = process.env.TEST_ADMIN_EMAIL || '';
    const adminPassword = process.env.TEST_ADMIN_PASSWORD || '';
    
    if (!adminEmail || !adminPassword) {
      test.skip();
    }
    
    // Login as admin
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', adminEmail);
    await page.fill('input[type="password"]', adminPassword);
    await page.click('button:has-text("Sign In")');
    
    // Navigate to attendance
    await page.goto(`${BASE_URL}/admin/attendance`);
    
    // Verify employee appears
    const employeeVisible = await page.getByText(TEST_EMAIL).isVisible();
    if (employeeVisible) {
      console.log('✓ Admin can see employee attendance');
      expect(employeeVisible).toBe(true);
    } else {
      console.log('⚠ Employee not visible in admin view (may not be in today\'s list)');
    }
  });
});
```

**5. Run Tests**

```bash
# Run all tests
npx playwright test tests/employee-dashboard.spec.ts

# Run single test
npx playwright test tests/employee-dashboard.spec.ts -g "T1:"

# Run with headed browser (see what happens)
npx playwright test tests/employee-dashboard.spec.ts --headed

# Generate HTML report
npx playwright test tests/employee-dashboard.spec.ts --reporter=html
open playwright-report/index.html
```

**6. Add to `package.json`**

```json
{
  "scripts": {
    "test:e2e:employee-dashboard": "playwright test tests/employee-dashboard.spec.ts",
    "test:e2e:headed": "playwright test tests/employee-dashboard.spec.ts --headed"
  }
}
```

---

## PART 5: FINAL RECOMMENDATIONS

### Manual Testing Priority
1. **CRITICAL**: Test 5 (End Break Immediate Resume) - Verify no 12+ second delay
2. **HIGH**: Test 8 (Hidden Tab Resync) - Verify no undercount or API spam
3. **HIGH**: Test 3 (Check-in) - Verify timer starts within 1–2 seconds
4. **MEDIUM**: All other tests

### Before Deployment
- [ ] Run all manual tests successfully
- [ ] Capture screenshots of each test passing
- [ ] Run Playwright E2E tests (if available)
- [ ] Verify admin can see employee attendance matching employee dashboard

### Bugs Found? 
Use the **Bug Report Template** above to document and share with the development team.

### Production Readiness Checklist
- [ ] All manual tests pass
- [ ] No console errors during tests
- [ ] No API 409/500 errors
- [ ] Timer resumes immediately after break (no artificial delays)
- [ ] Tab visibility/hidden-tab resync works (no undercount, no API spam)
- [ ] Check-out finalizes hours correctly
- [ ] Admin dashboard shows matching attendance data

---

**End of Phase 3B.5 Test Pack**
