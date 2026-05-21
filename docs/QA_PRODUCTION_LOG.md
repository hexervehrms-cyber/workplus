# QA log — hexerve.online (production)

**Date:** 2026-05-21  
**Account tested:** rinky@hexerve.com (role: **employee** — Rinky Verma)

## Environment smoke

| Check | Result |
|-------|--------|
| Site | **PASS** |
| API health | **PASS** |
| Login | **PASS** → redirects to `/employee` |

## Employee portal (rinky@hexerve.com)

| Page / feature | Result | Notes |
|----------------|--------|-------|
| Dashboard | **PASS** | Check-in available; leave balance 12 days; calendar |
| Leave | **PASS** | Balances (Sick/Casual/Earned/Comp-off); Request Leave button |
| Payroll | **PASS** | May 2026 slip ₹19,400 net; View/Download; history |
| Payroll template/upload | **NOT ON PROD** | Buttons not in deployed UI (in repo only) |
| Attendance | **PASS** | History rows; activity section |
| Expenses | **PASS** | 1 claim; filters; Export/Template |
| Chat | **PASS** | Contacts (Admin, Ajay, Harsh, Abhishek); Group/Add |
| Profile | **PASS** | Personal/official/docs sections load |
| **My Assets** `/employee/assets` | **FAIL** | **404 Not Found** — route missing on Vercel build |
| Settings | _not opened_ | |
| Performance | _not opened_ | |
| Company Docs | _not opened_ | |

## API (session login)

| Endpoint | Status |
|----------|--------|
| `POST /api/auth/login` | **200** |
| `GET /api/auth/me` | **200** (employee) |
| `GET /api/leave-requests` | **200** |
| `GET /api/attendance/today` | **200** |
| `GET /api/salary/slips/me` | **500** (wrong path; UI uses other routes) |
| `GET /api/salary/template` | **404** |
| `GET /api/assets` | **404** (may need employee-scoped path) |

## Fixes applied (2026-05-21 — post-QA)

| Fix | Files |
|-----|--------|
| Assets API: `employee/*` routes before `/:id`, org scoping, admin-only list | `backend/routes/assets.js` |
| Auth `/me`: reliable employee profile via `findEmployeeForSelfService` | `backend/routes/auth.js` |
| Employee Assets: no add form, better fetch + errors | `frontend/.../employee/Assets.tsx` |
| Admin employees list: robust API parsing | `frontend/.../api.ts` |
| Validation middleware for employee-dashboard boot | `backend/middleware/validation.js` |

## Action items

1. **Redeploy Vercel** — required for `/employee/assets` and `/admin/assets` (404 on old build).
2. **Redeploy Render** — assets API route order, auth/me, leave validate, payroll upload.
3. Rotate passwords shared in chat (security).

## Admin portal (atul.kumar@hexerve.com — **admin**)

| Page / feature | Result | Notes |
|----------------|--------|-------|
| Login | **PASS** | Redirects to `/admin` |
| Dashboard | **PASS** | 4 employees; KPIs; charts sections |
| Departments | **PASS** | Live data UI; Create / seed defaults |
| Leave requests `/admin/leaves` | **PASS** | Route works; “No leave requests found” |
| Leave allocation | **PASS** | Yearly / Add allocation |
| Leave settings | **PASS** | Save Settings |
| Payroll | **PASS** | Structures / slips tabs |
| Attendance | **PASS** | Export, import, live activity |
| Employee onboarding | **PASS** | Search + select employee |
| Employees | **PARTIAL** | Route loads; list slow/empty in snapshot |
| Team chat | **PASS** | (verify contacts after load) |
| **Assets** `/admin/assets` | **FAIL** | **404** — not in deployed Vercel build |
| Settings | _not opened_ | |

### Admin API (session)

| Endpoint | Status |
|----------|--------|
| `POST /api/auth/login` | **200** |
| `GET /api/leave-requests` | **200** |
| `GET /api/salary/slips/all` | **200** |
| `GET /api/employees?limit=5` | **200** |
| `GET /api/departments` | **404** on direct test — UI may use alternate path; verify in Network tab |

## Admin / HR / super-admin (other)

| Area | Result | Notes |
|------|--------|-------|
| Super-admin Analytics banner | **NOT TESTED** | Needs super_admin login + deploy |

---

_Next: test with admin credentials or deploy fixes then retest Assets + payroll upload._
