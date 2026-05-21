# Workplus — Full Project Issue Audit (Frontend & Backend)

**Audit date:** 2026-05-21  
**Repository:** `hexervehrms-cyber/workplus`  
**Branch reviewed:** `main` @ `e5010d9`  
**Production:** https://hexerve.online · API https://workplus-backend-sg3a.onrender.com/api  

**Related docs:** [ADMIN_FIX_PLAN.md](./ADMIN_FIX_PLAN.md) · [PORTAL_ISSUE_AUDIT.md](./PORTAL_ISSUE_AUDIT.md)

---

## Legend

| Severity | Meaning |
|----------|---------|
| **P0** | Page crash, data loss, or security exposure |
| **P1** | Core feature broken, silent failure, or wrong data for admins |
| **P2** | UX inconsistency, tech debt, or partial feature |
| **P3** | Nice-to-have / cleanup |

| Status | Meaning |
|--------|---------|
| **Fixed** | Addressed on `main` (verify after deploy) |
| **Partial** | Some paths fixed; same pattern remains elsewhere |
| **Open** | Not fixed or not verified in production |

---

## Executive summary

| Area | P0 | P1 | P2 | P3 | Notes |
|------|----|----|----|-----|-------|
| Frontend | 3 | 18 | 22 | 10 | Lazy routes, API client split, null guards |
| Backend | 1 | 12 | 14 | 8 | Org scoping, policy engine optional paths |
| Ops / deploy | 2 | 4 | 2 | — | Stale bundles, env parity |
| **Total (tracked)** | **6** | **34** | **38** | **18** | ~96 items below |

**Recently fixed on `main` (deploy required):**

- Employee apply-leave calendar on dashboard (`b3b5f8b`)
- Shared leave submit + tenant `orgId` on leave create (`e5010d9`)
- Admin attendance activity logs + org resolution (`e5010d9`)
- Onboarding form progress crash + route `Suspense` (`e5010d9`)
- Bulk Operations `getBearerToken` import (`e5010d9`)

**Stabilization pass (local, surgical — follow production prompt):**

- Added `authUserKey()` in `safeUi.ts` for `userId` / `id` parity
- P0 guards: `Employees.tsx`, `EmployeeCorrespondence.tsx`, `super-admin/Users.tsx`, `public/Onboarding.tsx`, `employee/Attendance.tsx`
- Realtime: `realTimeSocket.ts`, admin `Dashboard`, `Departments`, employee `Dashboard`, `Leave.tsx`
- Admin dashboard leave download failure → `toast.error` (was `alert`)

**Backend tests:** 30 passing (Vitest) — attendance helpers, KPI helpers, payroll money, orgId extraction only. No frontend test suite in CI.

---

## Operations & deployment

| ID | Sev | Status | Issue | Impact |
|----|-----|--------|-------|--------|
| OPS-1 | P0 | Open | Frontend/backend deploy out of sync | Old bundle → 404 on `/api/departments`, `/api/chat/groups`, missing UI fixes |
| OPS-2 | P1 | Open | No automated E2E after deploy | Regressions only caught manually |
| OPS-3 | P1 | Open | Render cold start / timeouts | First load fails; dashboards show 0 |
| OPS-4 | P1 | Partial | Hard refresh required after Vercel deploy | Users keep stale JS |
| OPS-5 | P2 | Open | `ADMIN_FIX_PLAN.md` references older commit `612929d` | Doc drift vs `e5010d9` |
| OPS-6 | P2 | Open | Production smoke not recorded for Attendance/Payroll after latest fixes | Unknown live state |

**Verification commands:**

```bash
curl -s -o /dev/null -w "%{http_code}" https://workplus-backend-sg3a.onrender.com/api/departments
# Expect 401 NO_TOKEN, not 404
```

---

## Cross-cutting architecture

| ID | Sev | Status | Issue | Where |
|----|-----|--------|-------|--------|
| X-1 | P1 | Partial | **Dual API clients** (`apiClient` in `api.ts` vs `apiHelper`) | 17+ frontend files still use `apiClient`; Leave service migrated to `apiHelper` |
| X-2 | P1 | Open | **Inconsistent list parsing** | Some pages use `extractApiList` / `ensureArray`; others use `response.data.data` or raw arrays |
| X-3 | P1 | **Partial** | **`user.id` vs `user.userId`** | `authUserKey()` added; applied to employee/admin dashboard, Departments, realTimeSocket, Leave visibility |
| X-4 | P1 | Open | **`orgId` / `MISSING_ORG_CONTEXT`** | Many routes return 400/403; empty tables with no user message |
| X-5 | P1 | Open | **HR leave workflow** | Allocation must exist before balances/KPIs; not a code bug but blocks “leave works” |
| X-6 | P2 | Open | **`Promise.allSettled` without surfacing errors** | Admin/employee dashboards swallow failed stats |
| X-7 | P2 | Open | **`alert()` instead of toast** | Holiday calendar, onboarding forms, admin dashboard leave download, super-admin users |
| X-8 | P2 | Partial | **`safeUi` helpers underused** | `safeInitials`, `safeTitleCase` exist but most pages still inline `.split` / `.charAt` |
| X-9 | P3 | Open | Debug logging in production paths | `attendance.js` check-in `console.log`; `auth.js` login debug |

---

## Frontend — routing & loading

| ID | Sev | Status | Issue | Details |
|----|-----|--------|-------|---------|
| FE-R-1 | P2 | **Mitigated** | Lazy routes without per-route `<Suspense>` | `MainLayout` wraps `<Outlet>` in `Suspense` — global fallback applies |
| FE-R-2 | P1 | **Fixed** | Employee onboarding admin route | `HREmployeeOnboarding` now wrapped in `Suspense` |
| FE-R-3 | P2 | Open | `/employee/calendar` redirects to dashboard | Standalone `Calendar.tsx` exists but not routed |
| FE-R-4 | P2 | Open | Dead routed components | `AssetsTable.tsx` (admin + employee) not in `routes.tsx` |

**Routes missing `Suspense` (sample — fix pattern: wrap like `bulk-operations`):**

- Admin: `admin`, `employees`, `leaves`, `attendance`, `attendance-calendar`, `attendance-history`, `expenses`, `payroll`, `payroll-runs`, `holiday-calendar`, `leave-allocation`, `leave-settings`, `chat`, `announcements`, `invites`, `company-docs`, `departments`, `roles`
- Employee: `employee`, `profile`, `leave`, `attendance`, `performance`, `payroll`, `expenses`, `chat`, `settings`, `onboarding`, `company-docs`
- Super-admin: `organizations`, `users`, `departments`, `activity`, `announcements`, `analytics`, `audit`, `chat`
- Sales: all four routes

---

## Frontend — API & data layer

| ID | Sev | Status | Issue | Files / notes |
|----|-----|--------|-------|----------------|
| FE-A-1 | P1 | Partial | `LeaveRequestService` uses `apiHelper` | `bulkApprove` still `apiClient` |
| FE-A-2 | P1 | Open | Admin **Dashboard** mixed clients + `alert` on leave download | `Dashboard.tsx` |
| FE-A-3 | P1 | Partial | Admin **Attendance** still uses `apiClient` for late-today / import | Activity logs migrated to `apiGet` + `extractApiList` |
| FE-A-4 | P1 | Open | **Settings**, **Announcements**, **InviteManagement**, **AttendanceCalendar** use `apiClient` | |
| FE-A-5 | P1 | Open | **Super-admin** Dashboard/Users/Organizations use `apiClient` | |
| FE-A-6 | P1 | Open | **Employee Attendance** uses `apiClient` for activity logs | Works for self; pattern differs from admin |
| FE-A-7 | P2 | Open | `EmployeeService.getEmployeeByUserId` returns `apiClient` shape | `resolveEmployeeId` must handle `{ success, data }` — **Fixed** in `resolveEmployeeId.ts` |
| FE-A-8 | P2 | Open | `PayrollDashboard` assumes `data.data.kpiData` nesting | Breaks if API shape changes |
| FE-A-9 | P2 | Open | `test-api.tsx` in `src/` | Dev-only; should not ship to production build |

---

## Frontend — crash & null-safety risks

| ID | Sev | Status | Issue | Location |
|----|-----|--------|-------|----------|
| FE-C-1 | **P0** | **Fixed** | `employee.userId.isActive` without optional chaining | `Employees.tsx` |
| FE-C-2 | **P0** | **Fixed** | `employee.userId.email` unguarded | `Employees.tsx` |
| FE-C-3 | P1 | **Fixed** | `user.name.split(' ')` for avatars | `super-admin/Users.tsx` → `safeInitials` |
| FE-C-4 | P1 | **Fixed** | `data.data.employeeName.split(' ')` | `public/Onboarding.tsx` — guarded split |
| FE-C-5 | P1 | **Fixed** | `status.charAt(0)` without fallback | `EmployeeCorrespondence.tsx`, `employee/Attendance.tsx` → `safeTitleCase` |
| FE-C-6 | P2 | Partial | Attendance calendar `employeeName.split` | Guarded with `\|\| 'Unknown'` in places |
| FE-C-7 | **Fixed** | OnboardingForm `value.trim()` on `File` | Progress bar crash when opening HR onboarding form |
| FE-C-8 | P2 | Open | `log.status.charAt` in employee attendance | Low risk if API always sends status |

---

## Frontend — admin portal (by page)

| Page | Route | Sev | Status | Issue |
|------|-------|-----|--------|-------|
| Dashboard | `/admin` | P1 | Open | KPI 0 when `/dashboard/stats` fails; errors swallowed |
| Dashboard | `/admin` | P2 | Open | Leave actions use `alert()` for download failure |
| Dashboard | `/admin` | P2 | Partial | Leave CRUD via `apiHelper` in places; not fully aligned with LeaveRequests |
| Employees | `/admin/employees` | P0 | Open | `userId` null access (see FE-C-1, FE-C-2) |
| Employee correspondence | `/admin/employees/:id/correspondence` | P1 | Open | Unsafe `status.charAt`; name split patterns |
| Departments | `/admin/departments` | P2 | Open | `if (!user?.id) return` — may skip load |
| Leave requests | `/admin/leaves` | OK | Partial | View/approve/reject; uses `extractApiList` |
| Leave allocation | `/admin/leave-allocation` | P1 | Open | Empty until HR creates monthly rows — **process** |
| Leave settings | `/admin/leave-settings` | OK | Partial | Toasts on fetch/save (fixed in prior pass) |
| Holiday calendar | `/admin/holiday-calendar` | P2 | Open | Uses `alert()` for all feedback |
| Attendance | `/admin/attendance` | OK | **Fixed** | Activity logs + org + full history (deploy pending) |
| Attendance | `/admin/attendance` | P2 | Partial | Still mixed `apiClient` for import/late-today |
| Attendance calendar | `/admin/attendance-calendar` | P2 | Open | `apiClient`; date timezone via `toISOString` |
| Attendance history | `/admin/attendance-history` | P2 | Open | Verify `apiGet` response parsing for all tabs |
| Expenses | `/admin/expenses` | OK | Partial | Toasts + `extractApiList` (prior pass) |
| Payroll | `/admin/payroll` | OK | Partial | Slip normalization; test reject/approve live |
| Payroll runs | `/admin/payroll-runs` | P2 | Open | Complex FNF/calculate; limited test coverage |
| Salary structure / cycle | `/admin/salary-*` | P2 | Open | Not fully regression-tested |
| Bulk operations | `/admin/bulk-operations` | OK | **Fixed** | `getBearer` ReferenceError on import |
| Assets | `/admin/assets` | P1 | Open | Fetch errors often silent (toast only on some actions) |
| AssetsTable | — | P2 | Open | **Not routed**; View/Edit `onClick={() => {}}` |
| Announcements | `/admin/announcements` | P2 | Open | `apiClient`; org context handling |
| Chat | `/admin/chat` | P1 | Open | Was 404 on old API deploy |
| Company docs | `/admin/company-docs` | P2 | Open | Large component; `apiClient` in subcomponents |
| Invites | `/admin/invites` | P2 | Open | `apiClient` |
| Onboarding | `/admin/employee-onboarding` | OK | **Fixed** | Form crash + Suspense |
| Settings | `/admin/settings` | P2 | Open | `apiClient` |
| Admin management | `/admin/admin-management` | OK | — | Uses guarded name split |
| Sales module | `/admin/sales/*` | P3 | Open | Admin-only; out of core HR QA scope |

---

## Frontend — employee portal (by page)

| Page | Route | Sev | Status | Issue |
|------|-------|-----|--------|-------|
| Dashboard | `/employee` | P1 | Open | Many effects require `user?.id` only |
| Dashboard | `/employee` | OK | **Fixed** | Interactive apply-leave calendar restored |
| Profile | `/employee/profile` | OK | Partial | Education/docs; verify production |
| Leave | `/employee/leave` | OK | **Fixed** | Shared `leaveSubmit.ts` + org resolve (deploy pending) |
| Leave | `/employee/leave` | P1 | Open | Blocked when allocation balance insufficient |
| Attendance | `/employee/attendance` | OK | — | Activity logs work via `/activity-logs/me` |
| Attendance | `/employee/attendance` | P2 | Open | `user?.id` for persistence keys; `apiClient` |
| Performance | `/employee/performance` | OK | — | Error banner pattern (good) |
| Payroll | `/employee/payroll` | OK | Partial | `salarySlip.ts` normalization |
| Expenses | `/employee/expenses` | OK | Partial | Status guarded with `String(expense.status \|\| 'pending')` |
| Chat | `/employee/chat` | P1 | Open | Depends on chat API deploy |
| Company docs | `/employee/company-docs` | P2 | Open | Spot-check view/download |
| Assets | `/employee/assets` | OK | Partial | Assignee display; refresh button |
| AssetsTable | — | P2 | Open | Not routed; noop View button |
| Settings | `/employee/settings` | P2 | Open | `apiClient` for employee lookup |
| Onboarding | `/employee/onboarding` | P2 | Open | Lazy without Suspense; `alert()` feedback |
| Calendar.tsx | — | P2 | Open | Orphan page; logic duplicated in `InteractiveCalendar` |

---

## Frontend — super-admin, public, shared

| Area | Sev | Status | Issue |
|------|-----|--------|-------|
| Super-admin pages | P1 | Open | Most lazy routes lack `Suspense` |
| Super-admin Users | P1 | Open | `user.name.split` crash risk |
| Public onboarding | P1 | Open | Unsafe `employeeName.split` |
| `HolidayCalendar` / `EmployeeHolidayCalendar` | P2 | Open | `alert()` for all user feedback |
| `TeamsMessenger` | P2 | Partial | Group CRUD added; depends on deploy |
| `CompanyDocs` | P2 | Open | Mixed patterns; stub `alert` download in `EmployeeDocuments` |
| `realTimeSocket.connectFromAuth` | P2 | Open | Requires `user.id` — should accept `userId` |

---

## Backend — API, auth & multi-tenant

| ID | Sev | Status | Issue | Details |
|----|-----|--------|-------|---------|
| BE-1 | P1 | Open | **`MISSING_ORG_CONTEXT`** on many routes | leave, expenses, assets, allocation, documents, dashboard stats |
| BE-2 | P1 | **Fixed** | Leave create stored under wrong `orgId` vs admin list filter | `leave.js` prefers JWT tenant org for employees |
| BE-3 | P1 | **Fixed** | Admin activity logs empty when admin JWT lacks org | `getMergedAttendanceActivityLogs` resolves org from Employee/User |
| BE-4 | P2 | Open | `GET /employees/user/:userId` relies on route-level auth | Verify `authenticate` on router mount in `server.js` |
| BE-5 | P2 | Open | Super admin must pass `?orgId=` for scoped data | Documented in `orgScopeHelpers`; easy to miss |
| BE-6 | P2 | Open | `buildOrgIdFlexible('')` matches `orgId: ''` only | Can return zero rows instead of clear 400 |

---

## Backend — leave & attendance

| ID | Sev | Status | Issue | Details |
|----|-----|--------|-------|---------|
| BE-L-1 | P1 | Open | Insufficient balance returns 400 | Correct rule; employees need clear toast message |
| BE-L-2 | P1 | Open | `global.leavePolicyEngine` optional | Smart auto-approve only when engine initialized; employees always pending in basic path |
| BE-L-3 | P2 | Open | Duplicate `getLeaveFieldName` | `leaveBalanceHelpers.js` vs `leave-allocation.js` — drift risk |
| BE-L-4 | P2 | Open | Leave allocation sync on approve/reject | Implemented in `leaveAllocationSync.js` — verify all code paths call it |
| BE-A-1 | OK | **Fixed** | Admin vs employee activity log visibility | Merged logs + synthetic events from `Attendance` rows |
| BE-A-2 | P2 | Open | Debug `console.log` on check-in | `attendance.js` — remove or gate behind env |
| BE-A-3 | P2 | Open | Timezone: `toISOString()` date boundaries | Frontend/backend may shift “today” near midnight IST |
| BE-A-4 | P3 | Open | `attendance-old-backup.js` (~1600+ lines) | Not mounted; delete or archive |
| BE-A-5 | P3 | Open | `server.js.backup` in repo root | Should not be deployed |

---

## Backend — payroll, expenses, assets, chat

| ID | Sev | Status | Issue |
|----|-----|--------|-------|
| BE-P-1 | P2 | Open | Payroll attendance data build — complex; few integration tests |
| BE-P-2 | P2 | Open | `automatedPayrollSystem.js` TODO weekend/holiday hours |
| BE-E-1 | P2 | Open | Expense bulk approve via `apiClient` on frontend only |
| BE-AS-1 | P2 | Open | Asset assign org/employee validation — frontend had wrong list parse (fixed in Assets.tsx prior pass) |
| BE-CH-1 | P1 | Open | Chat groups 404 on stale deploy |
| BE-CH-2 | OK | Partial | Group PATCH/avatar/members/delete routes added — needs live test |

---

## Backend — notifications, workflows & TODOs

| ID | Sev | Status | Issue | Location |
|----|-----|--------|-------|----------|
| BE-N-1 | P3 | Open | Email integration TODO | `notificationManager.js` |
| BE-N-2 | P3 | Open | SMS / push TODO | `notificationManager.js` |
| BE-N-3 | P3 | Open | Password reset email TODO | `passwordReset.js` |
| BE-N-4 | P3 | Open | Calendar integration TODO | `eventSystem.js` |
| BE-N-5 | P3 | Open | Workflow historical storage TODO | `workflowEngine.js` |

---

## Backend — testing & quality

| ID | Sev | Status | Issue |
|----|-----|--------|-------|
| BE-T-1 | P2 | Open | Only **30 unit tests**; no route integration tests in CI |
| BE-T-2 | P2 | Open | No frontend tests (Jest/Vitest/Playwright) |
| BE-T-3 | P3 | Open | Many one-off scripts in `backend/scripts/` — not documented in runbook |

**Passing test files:**

- `backend/tests/attendanceQueryHelpers.test.js`
- `backend/tests/dashboardKpiHelpers.test.js`
- `backend/tests/orgId-extraction-bug-condition.test.js`
- `backend/tests/payrollMoney.test.js`

---

## Security & compliance (static review)

| ID | Sev | Status | Issue |
|----|-----|--------|-------|
| SEC-1 | P2 | Open | Onboarding routes use `upload.any()` — ensure file validator + size limits on all paths |
| SEC-2 | P2 | Open | CORS/cookie config env-dependent — verify production `credentials: include` |
| SEC-3 | P3 | Open | Login debug logging may leak auth flow details | `auth.js` |
| SEC-4 | P3 | Open | Rate limiter present — confirm enabled on auth routes in production |

---

## Recommended fix order

### Phase 1 — Stability (1–2 days)

1. **Deploy** `main` @ `e5010d9+` to Render + Vercel; hard refresh.
2. **Wrap all lazy routes in `Suspense`** (`routes.tsx`) — highest impact for “page not opening”.
3. **Fix P0 null guards** — `Employees.tsx` (`userId?.`), `super-admin/Users.tsx`, `public/Onboarding.tsx`.
4. **Standardize auth user key** — `const uid = user?.userId ?? user?.id` everywhere.

### Phase 2 — Data visibility (1–2 days)

5. **Migrate admin Dashboard, Attendance (remaining), Settings to `apiHelper`** + `extractApiList`.
6. **Surface API errors** — replace silent `Promise.allSettled` with toasts on rejected promises.
7. **HR process** — document Leave Allocation before employee submit (see `ADMIN_FIX_PLAN.md`).

### Phase 3 — Consistency (ongoing)

8. Replace remaining **`alert()`** with `portalToast`.
9. Adopt **`safeUi`** helpers across grids/calendars.
10. Remove dead code: `AssetsTable.tsx`, `attendance-old-backup.js`, `server.js.backup`.
11. Expand backend integration tests for leave submit/list and attendance activity logs.

---

## Quick verification matrix (after deploy)

### Admin

- [ ] Any admin menu item opens (no white screen) — **Suspense fix**
- [ ] Dashboard employee count matches Employees page
- [ ] Attendance → Live Activity shows check-in/out logs
- [ ] Leave requests → pending employee submissions visible
- [ ] Leave allocation → create current month
- [ ] Onboarding → select employee → form opens
- [ ] Bulk operations → page loads; import does not crash

### Employee

- [ ] Dashboard → apply leave from calendar submits
- [ ] Leave page → submit appears in history
- [ ] Attendance → activity log visible
- [ ] Expenses / Payroll / Profile actions work

---

## Files reference (fixes & hotspots)

| Path | Role |
|------|------|
| `frontend/src/app/routes.tsx` | Lazy loading / Suspense gaps |
| `frontend/src/app/utils/api.ts` | `apiClient` + services |
| `frontend/src/app/utils/apiHelper.ts` | Preferred HTTP layer |
| `frontend/src/app/utils/leaveSubmit.ts` | Shared leave POST (**new**) |
| `frontend/src/app/utils/safeUi.ts` | Null-safe UI helpers (underused) |
| `frontend/src/app/pages/admin/Dashboard.tsx` | KPI / leave / api mix |
| `frontend/src/app/pages/admin/Attendance.tsx` | Activity logs (**fixed**) |
| `frontend/src/app/pages/admin/Employees.tsx` | P0 null `userId` |
| `backend/routes/leave.js` | Leave CRUD + org scoping (**fixed**) |
| `backend/routes/attendance.js` | Check-in, activity logs (**fixed**) |
| `backend/utils/orgScopeHelpers.js` | Tenant resolution |
| `backend/server.js` | Route mounting |

---

*This audit is based on static code review, existing project docs, and 30 passing backend unit tests. It is not a substitute for production E2E testing. Re-run after major merges and update the **Status** column accordingly.*
