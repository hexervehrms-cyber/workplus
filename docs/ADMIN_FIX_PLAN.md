# Admin portal — issue audit & step-by-step fix plan

**Last checked:** 2026-05-21 (production `https://hexerve.online`, backend `workplus-backend-sg3a.onrender.com`)  
**Branch:** `main` @ `612929d` (merged from `feature/fix-onboarding-system`)

This document is a **fix order only**. Each step is small and testable. Do not skip deploy verification (Step 0).

---

## Step 0 — Deploy & cache (do this first)

Many console errors (`Route not found` on `/api/departments`, `/api/chat/groups`) happen when **Render is still on old `main`** (before merge).

| Check | How | Expected |
|-------|-----|----------|
| Backend routes exist | `curl https://workplus-backend-sg3a.onrender.com/api/departments` (no auth) | **401** `NO_TOKEN`, not **404** |
| Render commit | Dashboard → latest deploy = `612929d` or newer | Live |
| Frontend | Vercel redeploy from `main` | New JS bundle (not `index-BBi1up1r.js` from old build) |
| Browser | Hard refresh / clear site data for hexerve.online | No stale 404s |

**If you still see 404 on departments:** backend not redeployed — fix Step 0 before any code changes.

---

## Live smoke (admin session on production)

| Page | Route | Status | Notes |
|------|-------|--------|-------|
| Dashboard | `/admin` | **Partial** | Loads; **Total Employees = 0** but **Logged In = 2**; finance KPIs ₹0 |
| Employees | `/admin/employees` | **OK** | 4 employees listed |
| Departments | `/admin/departments` | **OK** | 3 departments; seed/create buttons |
| Leave requests | `/admin/leaves` | **OK** | Empty list (no pending requests) |
| Leave allocation | `/admin/leave-allocation` | **OK UI** | “No allocations found for 2026” — **data**, not routing |
| Assets | `/admin/assets` | **OK** | Page loads (was 404 on old Vercel build) |
| Chat | `/admin/chat` | **Verify** | Was 404 on old API; retest after Step 0 |
| Payroll, Expenses, Attendance | — | **Not re-tested this pass** | See code audit below |

---

## Root causes (why it feels “nothing works”)

1. **Deploy lag** — Frontend/backend out of sync; old bundle calls APIs that did not exist on server.
2. **Silent API failures** — Dashboard uses `Promise.allSettled` with **no toast** when `/dashboard/stats` fails → KPIs stay **0**.
3. **Leave workflow not end-to-end** — Allocation empty → employee cannot use leave; KPI does not move until allocation + submit + approve (fixed in code on `main`, needs deploy + HR action).
4. **Mixed API clients** — `apiClient` vs `apiHelper` → different error shapes; some pages show empty instead of error.

---

## Step-by-step fixes (recommended order)

### Step 1 — Leave allocation → employee leave → KPI (P0 business flow)

**Symptoms:** Admin sees no allocations; employee submit does not reflect in KPI; “1 remaining, 0 used”.

**Cause:** No rows in `LeaveAllocation` for current month/year; balance sync on submit/approve (in `leaveAllocationSync.js`) only runs after deploy.

**Actions (HR, no code):**
1. Admin → **Leave Allocation** → select **current month** (not “All months” when saving).
2. **Add Allocation** → pick employee → set Casual/Sick/Earned days → Save.
3. Employee → **Leave** → submit request.
4. Admin → **Leaves** → Approve.

**Code already on `main`:** pending on submit, used on approve, admin save uses month 1–12 + employee `userId`.

**Verify:** Employee leave KPI shows pending then lower remaining after approve.

---

### Step 2 — Dashboard KPI wrong (Total Employees = 0) (P1)

**Symptoms:** Dashboard shows 0 employees while Employees page shows 4.

**Likely causes:**
- `/api/dashboard/stats` or `/api/dashboard/quick-stats` fails → `Promise.allSettled` swallows error (`Dashboard.tsx`).
- Circuit breaker fallback returns zeros (`dashboard.js`).
- Admin JWT `orgId` ≠ employee records’ `orgId` (tenant mismatch).

**Fix (small, targeted):**
- Log/toast when `statsResponse` / `quickStatsResponse` rejected.
- On failure, fallback: `GET /employees?simple=true&limit=5` count for employee KPI only.
- Confirm `assertScopedOrgId` on dashboard routes matches admin’s org.

**Files:** `frontend/src/app/pages/admin/Dashboard.tsx`, `backend/routes/dashboard.js`

---

### Step 3 — Departments / seed-defaults 404 (P0 if Step 0 not done)

**Symptoms:** `Route not found` on `/api/departments` and `/api/departments/seed-defaults`.

**Fix:** Redeploy Render from `main` (Step 0). No app code change if deploy is correct.

**Verify:** Network tab → departments → **200** with JSON list.

---

### Step 4 — Team chat `/api/chat/groups` (P1)

**Symptoms:** `API request failed for /chat/groups: Route not found`.

**Cause (historical):** Old `main` lacked `GET /chat/groups`; current `main` has it in `backend/routes/chat.js`.

**Fix:** Step 0 deploy. If 404 persists after deploy, check `server.js` mount: `app.use("/api/chat", ...authedTenant, chatRoutes)`.

**Verify:** Network → `/api/chat/groups` → **200** with `{ success, data: [] }`.

---

### Step 5 — Expenses & Assets load errors hidden (P1)

**Symptoms:** Blank tables; user thinks feature broken.

**Cause:** `fetchExpenses` / assets fetch catch without toast (`Expenses.tsx`, `Assets.tsx`).

**Fix:** Add `toast.error` on fetch failure + `loading` state on Expenses fetch.

**Files:** `frontend/src/app/pages/admin/Expenses.tsx`, `frontend/src/app/pages/admin/Assets.tsx`

---

### Step 6 — Payroll & salary paths (P2)

**Symptoms:** Slips/structures empty or actions fail silently.

**Audit:** `Payroll.tsx` — mixed `salary/...` vs `/salary/...` (helper normalizes); super_admin needs org context.

**Fix:** Only after Steps 1–5; add error banner when structure/slip list fetch fails.

---

### Step 7 — Cross-cutting quality (P2)

| Item | Files |
|------|--------|
| Standardize list parsing with `extractApiList` | Dashboard, Payroll, Assets |
| `getAllEmployees(user)` pass org for super_admin | Onboarding, LeaveAllocation |
| Replace `alert()` on dashboard leave actions with `toast` | `Dashboard.tsx` |
| Leave settings fetch errors | `LeaveSettings.tsx` |

---

## Console error cheat sheet

| Error | Meaning | First fix |
|-------|---------|-----------|
| `404 Route not found` on `/api/...` | Server has no route (old deploy) | Step 0 |
| `401 NO_TOKEN` | Not logged in / cookie expired | Re-login |
| `403 MISSING_ORG_CONTEXT` | JWT missing `orgId` | Re-login; check employee/org link |
| `API request failed for /chat/groups` | Usually 404 (old backend) or 403 org | Step 0 / 4 |
| Page works but empty | Often **no data** or **silent fetch fail** | Steps 1, 2, 5 |

---

## What not to do

- Do **not** rewrite `server.js` or merge large unrelated refactors.
- Do **not** change API paths without checking `backend/routes/*` mount in `server.js`.
- Fix **one step**, redeploy if backend changed, **retest that page**, then next step.

---

## Next step for you

Reply with which step to implement first (recommended: **Step 0 confirm deploy**, then **Step 1 leave allocation**). I will apply **only that step’s code changes** and give you a short test checklist.
