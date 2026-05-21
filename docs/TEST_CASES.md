# Workplus — QA test cases (team checklist)

Use after deploying backend fixes to staging/production.

**Full runbook (May 2026 fixes):** see [QA_RUNBOOK.md](./QA_RUNBOOK.md) — test on **https://hexerve.online** (API: Render `workplus-backend-sg3a`), not localhost.

**Run automated tests:** `npm test` (from repo root)

---

## 1. Attendance — orgId mismatch (critical)

| # | Steps | Expected |
|---|--------|----------|
| 1.1 | Employee checks in from Dashboard | Success toast; UI shows Checked In |
| 1.2 | Reload page (F5) | Still Checked In (not reset to Check In) |
| 1.3 | Open **Attendance** page | Same checked-in state as Dashboard |
| 1.4 | Start break (regular) | Break active; no 400 error |
| 1.5 | End break | Break ended; still checked in |
| 1.6 | Reload during break | Shows on break OR checked in (matches server) |
| 1.7 | Check out | Checked out; hours shown |
| 1.8 | Reload after checkout | Shows Check In (new day) or checked out for today |

**API checks (optional — Postman):**

| # | Request | Expected |
|---|---------|----------|
| 1.9 | `GET /api/attendance/today` (employee cookie/token) | `attendance` object + `liveStatus.status` |
| 1.10 | `POST /api/attendance/break-start` while checked in | 200, not 400 "No check-in found" |
| 1.11 | `POST /api/attendance/break-end` while on break | 200, `liveStatus.isOnBreak: false` |

---

## 2. Attendance — offline / cache resilience

| # | Steps | Expected |
|---|--------|----------|
| 2.1 | Check in, then throttle network (DevTools → Offline) briefly, reload | UI may use cache; still shows checked in until server responds |
| 2.2 | Check in, clear site data, reload | Server truth wins; if no row, shows Check In |

---

## 3. Admin dashboard — Financial KPIs (real-time)

| # | Steps | Expected |
|---|--------|----------|
| 3.1 | Open Admin Dashboard → Financial Overview | Cards load (expense, payroll, total cost, employees) |
| 3.2 | Add a new employee (another tab/window) | **Total employees** increments without manual refresh |
| 3.3 | Approve an expense | Expense / total cost updates (socket or refresh) |
| 3.4 | Generate salary slip (if enabled) | Payroll / total cost reflects change |

---

## 4. Admin chat (Teams messenger)

| # | Steps | Expected |
|---|--------|----------|
| 4.1 | Open Chat, select a contact | Selected row readable (email/text visible) |
| 4.2 | Add contact | Appears in list |
| 4.3 | Remove contact | Removed from list |
| 4.4 | Delete a message | Message removed |
| 4.5 | Upload profile avatar | Avatar shows in menu/header |

---

## 5. Leave notifications (HR email)

| # | Steps | Expected |
|---|--------|----------|
| 5.1 | Employee submits leave request | HR receives email (check SMTP / inbox) |
| 5.2 | Admin approves/rejects leave | HR notified per workflow |

---

## 6. Regression — auth must still work

| # | Steps | Expected |
|---|--------|----------|
| 6.1 | Login as employee / admin | JWT + cookies set; no redirect loop |
| 6.2 | Call protected API without token | 401 |
| 6.3 | Session refresh after idle | Still authenticated |

---

## 7. Automated unit tests (CI / local)

| Suite | File | Covers |
|-------|------|--------|
| Attendance helpers | `backend/tests/attendanceQueryHelpers.test.js` | orgId `$in` query, open break detection, live status |
| Dashboard KPI | `backend/tests/dashboardKpiHelpers.test.js` | orgId filter for payroll/expense queries |
| Payroll money | `backend/tests/payrollMoney.test.js` | Salary aggregation |

---

## Sign-off template

| Area | Tester | Date | Pass/Fail | Notes |
|------|--------|------|-----------|-------|
| Attendance | | | | |
| Admin KPIs | | | | |
| Chat | | | | |
| Leave email | | | | |
