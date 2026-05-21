# WorkPlus — QA runbook (production: hexerve.online)

**Do not use localhost for this checklist.** Test against the live deployment.

## Production URLs

| Service | URL |
|---------|-----|
| **App (Vercel)** | https://hexerve.online |
| **Login** | https://hexerve.online/login |
| **API base** | https://workplus-backend-sg3a.onrender.com/api |
| **Health** | https://workplus-backend-sg3a.onrender.com/health |
| **Socket** | https://workplus-backend-sg3a.onrender.com |

Frontend on `hexerve.online` auto-targets the Render API when `VITE_API_URL` is unset (see `frontend/src/app/utils/apiBaseUrl.ts`).

## Env checklist (Render + Vercel)

Set these on **Render** (backend) and **Vercel** (frontend) — not only in local `.env`:

| Variable | Where | Expected value |
|----------|--------|----------------|
| `CORS_ORIGIN` | Render | `https://hexerve.online` |
| `FRONTEND_URL` | Render | `https://hexerve.online` |
| `VITE_API_URL` | Vercel (optional) | `https://workplus-backend-sg3a.onrender.com` |
| `VITE_SOCKET_URL` | Vercel (optional) | `https://workplus-backend-sg3a.onrender.com` |

Backend already whitelists `hexerve.online` / `www.hexerve.online` in `server.js`.

## Before you start

| Step | Action |
|------|--------|
| 1 | Open https://hexerve.online/login in Chrome/Edge |
| 2 | DevTools → **Network** → enable **Preserve log** |
| 3 | Confirm API calls go to `workplus-backend-sg3a.onrender.com` (not `localhost`) |
| 4 | Optional local: `npm test` → 30 unit tests (helpers only; not full E2E) |
| 5 | Use real test accounts (employee, admin, HR) — do not share passwords in chat |

**Sign-off:** Tester | Date | Pass / Fail / Blocked | Notes

---

## A. Smoke (5 min)

| # | Test | Pass criteria |
|---|------|----------------|
| A.1 | Open https://workplus-backend-sg3a.onrender.com/health | `200`, `"status":"healthy"`, DB connected |
| A.2 | Open https://hexerve.online/login | Login form loads (no white screen) |
| A.3 | Login **employee** | Lands on `/employee` (or role home) |
| A.4 | Login **admin** | Lands on `/admin` |
| A.5 | Login **HR** | Lands on `/admin` (not employee portal) |
| A.6 | Logout → login again | No redirect loop |
| A.7 | Hard refresh on dashboard | Still authenticated |

**Automated smoke (already verified):** health `200`, login page `200`.

---

## B. Employee portal — https://hexerve.online/employee/…

### B1. Leave

| # | Steps | Expected |
|---|--------|----------|
| B1.1 | **Leave** | Page loads; balance/types visible |
| B1.2 | Submit new leave | Success; listed |
| B1.3 | Reload | Request still there |
| B1.4 | Cancel pending | Cancelled |
| B1.5 | Network: `POST …/leave-requests/validate` | `200` only for own `employeeId` |

### B2. Payroll

| # | Steps | Expected |
|---|--------|----------|
| B2.1 | Download template | CSV downloads |
| B2.2 | Upload slip | `pending_approval` |
| B2.3 | Download slip | File opens |

### B3. Attendance

| # | Steps | Expected |
|---|--------|----------|
| B3.1 | Check in (Dashboard) | Checked in |
| B3.2 | Reload | Still checked in |
| B3.3 | Break start/end | No 400 “No check-in found” |
| B3.4 | Check out | Hours shown |
| B3.5 | **Attendance** page | Matches dashboard |

### B4. Assets

| # | Steps | Expected |
|---|--------|----------|
| B4.1 | **Assets** | List loads |
| B4.2 | UI | No **Add Asset** button |
| B4.3 | `POST /api/assets` as employee | `403` |

### B5. Chat

| # | Steps | Expected |
|---|--------|----------|
| B5.1 | **Chat** | Contacts load |
| B5.2 | Create group + add member | No duplicate error |
| B5.3 | Send message | Delivered |

### B6. Profile / settings

| # | Steps | Expected |
|---|--------|----------|
| B6.1 | **Settings** | No crash |
| B6.2 | **Profile** save | Saves; no 404 |
| B6.3 | Notification link | `/employee/profile` (not wrong path) |

---

## C. Admin / HR — https://hexerve.online/admin/…

### C1. Departments

| # | Steps | Expected |
|---|--------|----------|
| C1.1 | **Departments** | List loads |
| C1.2 | Create / edit | Works for org |

### C2. Leave

| # | Steps | Expected |
|---|--------|----------|
| C2.1 | **Leave requests** | No 404 |
| C2.2 | **Leave allocation** | Allocate works |
| C2.3 | **Leave settings** | Saves |
| C2.4 | Approve/reject | Employee sees update |

### C3. Payroll

| # | Steps | Expected |
|---|--------|----------|
| C3.1 | **Payroll** | List loads |
| C3.2 | `pending_approval` slip | **Approve** visible |
| C3.3 | After approve | Employee can download |

### C4. Onboarding

| # | Steps | Expected |
|---|--------|----------|
| C4.1 | HR onboarding submit | Success (`PUT /employees/:id`) |

### C5. Assets / chat

| # | Steps | Expected |
|---|--------|----------|
| C5.1 | Admin add asset | Works |
| C5.2 | Admin chat | Loads |

---

## D. Sales — https://hexerve.online/sales/…

| # | Steps | Expected |
|---|------|----------|
| D.1 | **Deals** | List/create — API `…/api/sales/deals` |
| D.2 | **Calls** | List/create — API `…/api/sales/calls` |

---

## E. Super-admin

| # | Steps | Expected |
|---|--------|----------|
| E.1 | **Analytics** | “Coming soon” banner (after deploy) |
| E.2 | **Audit** | Banner + disabled search/export |
| E.3 | Organizations / Users | Real data |

---

## F. Security (production API)

Use DevTools or Postman with **production cookies** from hexerve.online.

| # | Test | Expected |
|---|------|----------|
| F.1 | Employee `GET /api/leave-requests/:otherId` | `403` |
| F.2 | Employee validate other `employeeId` | `403` |
| F.3 | Employee `POST /api/assets` | `403` |

---

## G. Deploy note for QA

Recent fixes (leave validate, analytics banner, validation middleware) must be **deployed to Render + Vercel** before production QA reflects them. Until then, test what is already live and mark newer items **Blocked — not deployed**.

---

## Sign-off

| Area | Tester | Date | Result | Notes |
|------|--------|------|--------|-------|
| Smoke A | | | | |
| Employee B | | | | |
| Admin/HR C | | | | |
| Sales D | | | | |
| Super-admin E | | | | |
| Security F | | | | |
