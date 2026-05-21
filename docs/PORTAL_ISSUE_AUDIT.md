# Admin & Employee Portal — Full Issue Audit

**Audit date:** 2026-05-20  
**Scope:** All routed pages under `/admin/*` and `/employee/*` (plus shared settings)  
**Production:** https://hexerve.online · API https://workplus-backend-sg3a.onrender.com/api

Legend: **P0** crash / data loss · **P1** feature broken or silent failure · **P2** UX / consistency · **OK** no code defect found in static review

---

## Summary

| Portal | Pages routed | P0 | P1 | P2 | Fixed this pass |
|--------|--------------|----|----|-----|-----------------|
| Admin | 24 | 4 | 9 | 6 | 6 (see below) |
| Employee | 11 | 1 | 4 | 3 | 3 (see below) |

**Already fixed (local, not necessarily deployed):** Leave/Profile/Expenses/Payroll action buttons, admin expense delete guard, payroll reject, leave view dialog, `LeaveRequestService` delete/update via `apiHelper`, `normalizeSalarySlip`.

**Deploy required:** Vercel (frontend) + Render (backend) for any fix to appear on hexerve.online.

---

## Cross-cutting (both portals)

| Issue | Severity | Impact | Status |
|-------|----------|--------|--------|
| Mixed `apiClient` vs `apiHelper` | P1 | Different auth/retry/error shapes; some actions fail silently | Partial — Leave service migrated; Dashboard, Attendance, Settings still use `apiClient` |
| `Promise.allSettled` without user feedback | P1 | Dashboard KPIs stay 0 when `/dashboard/stats` fails | Open — toast on reject planned |
| Stale frontend bundle after deploy | P0 | 404 on `/api/departments`, `/api/chat/groups` | Ops — redeploy `main`, hard refresh |
| `orgId` missing on JWT | P1 | 403 `MISSING_ORG_CONTEXT`; empty lists | Re-login; verify employee org link |
| Leave workflow needs allocation first | P1 | “Submit works but KPI wrong” | HR process — admin **Leave Allocation** before employee submit |

---

## Admin portal — page by page

| Page | Route | Severity | Issue | Notes |
|------|-------|----------|-------|-------|
| Dashboard | `/admin` | P1 | Total Employees = 0 while Employees page shows 4 | `/dashboard/stats` or `/quick-stats` fails; errors swallowed |
| Dashboard | `/admin` | P2 | Leave actions use `alert()` not toast | `handleDeleteLeave`, approve/reject |
| Dashboard | `/admin` | P1 | Leave delete/edit uses `apiClient` | Should match `apiHelper` like LeaveRequests |
| Employees | `/admin/employees` | **P0** | `employee.userId.name.split` if `name` missing | **Can crash card grid** |
| Employee correspondence | `/admin/employees/:id/correspondence` | P0 | `employee.userId.name.split` without guard | Same pattern |
| Departments | `/admin/departments` | OK | Toasts on errors | — |
| Roles | `/admin/roles` | P2 | Admin-only route | — |
| Leave requests | `/admin/leaves` | OK | View/approve/reject; status guarded | Fixed locally |
| Leave allocation | `/admin/leave-allocation` | P1 | Empty until HR creates rows | Data, not routing |
| Leave settings | `/admin/leave-settings` | P1 | Fetch error only `console.error` | No toast |
| Holiday calendar | `/admin/holiday-calendar` | P2 | Needs `orgId` on create | Documented in prior fixes |
| Attendance | `/admin/attendance` | **P0** | `log.employeeName.charAt(0)` if name missing | **Can crash activity log** |
| Attendance calendar | `/admin/attendance-calendar` | **P0** | `record.employeeName.split(' ')` if missing | **Can crash calendar cells** |
| Attendance history | `/admin/attendance-history` | P2 | Uses `apiClient` patterns via `apiGet` | Verify list parsing |
| Expenses | `/admin/expenses` | P1 | Fetch catch has no toast | Blank table looks “broken” |
| Expenses | `/admin/expenses` | P2 | List uses `data.data` not `extractApiList` | May miss nested `data.data` |
| Expenses | `/admin/expenses` | OK | View/download/edit/approve/reject/delete | Fixed locally |
| Payroll | `/admin/payroll` | OK | Reject structure wired | Fixed locally |
| Payroll runs | `/admin/payroll-runs` | P2 | FNF / calculate flows complex | Test after deploy |
| Salary structure | `/admin/salary-structure` | P2 | Not re-audited in depth | — |
| Salary cycle | `/admin/salary-cycle` | P2 | Not re-audited in depth | — |
| Bulk operations | `/admin/bulk-operations` | P2 | Import/export | — |
| Assets | `/admin/assets` | P1 | `fetchAssets` / `fetchEmployees` silent on error | Empty table |
| AssetsTable.tsx | — | P2 | **Not routed**; View/Edit `onClick={() => {}}` | Dead component |
| Announcements | `/admin/announcements` | P2 | Uses `apiClient` | — |
| Chat | `/admin/chat` | P1 | Was 404 on old API deploy | Step 0 deploy |
| Company docs | `/admin/company-docs` | P2 | Large page | Spot-check view/download |
| Invites | `/admin/invites` | P2 | Uses `apiClient` | — |
| Onboarding | `/admin/employee-onboarding` | P2 | Org context for super_admin | — |
| Settings | `/admin/settings` | P2 | Uses `apiClient` | — |
| Admin management | `/admin/admin-management` | OK | — | — |
| Sales * | `/admin/sales/*` | — | Admin-only CRM | Out of HR scope |

---

## Employee portal — page by page

| Page | Route | Severity | Issue | Notes |
|------|-------|----------|-------|-------|
| Dashboard | `/employee` | P2 | Multiple parallel fetches | Generally resilient |
| Profile | `/employee/profile` | OK | Education upload → API; fetch on mount | Fixed locally |
| Leave | `/employee/leave` | OK | Submit/list/edit/delete/download | Fixed locally; needs allocation |
| Attendance | `/employee/attendance` | P2 | `status.charAt` if status null | Low risk if API always sends status |
| Attendance | `/employee/attendance` | P2 | Uses `apiClient` for some calls | — |
| Performance | `/employee/performance` | OK | Shows error banner on API fail | Good pattern |
| Payroll | `/employee/payroll` | OK | Slip normalization | Fixed locally |
| Expenses | `/employee/expenses` | P1 | `expense.status.charAt` if status missing | **Can crash row** |
| Expenses | `/employee/expenses` | OK | Receipt view/download path | Fixed locally |
| Chat | `/employee/chat` | P1 | Depends on `/api/chat/groups` deploy | — |
| Company docs | `/employee/company-docs` | P2 | — | Spot-check |
| Assets | `/employee/assets` | OK | Main `Assets.tsx` routed | — |
| AssetsTable.tsx | — | P2 | **Not routed**; View button no-op | Dead component |
| Settings | `/employee/settings` | P2 | Uses `apiClient` for employee lookup | — |
| Onboarding | `/employee/onboarding` | P2 | Public token flow separate | — |
| Calendar | `/employee/calendar` | OK | Redirects to `/employee/leave` | — |

---

## Fixes applied in this audit pass (code)

1. **Safe name/status guards** — Employees, Attendance, Attendance calendar, employee Expenses, Assets assignee, Employee correspondence  
2. **Admin Expenses** — `toast.error` on fetch failure; `extractApiList` for list  
3. **Admin Assets** — `toast.error` on fetch failure; safe assignee name + currency  
4. **Admin Dashboard** — `apiHelper` for all fetches; employee count fallback; leave actions via toast + `apiPatch`/`apiDelete`; stats error toasts  
5. **Admin Leave settings** — Toast when settings fetch fails  
6. **Admin Payroll** — Safe `otherEarnings` spread; fetch toasts; edit structure normalization  
7. **Payroll runs / Salary structure / FNF** — Safe employee names; payroll run view button wired  
8. **`safeUi.ts`** — `safeInitials`, `safeTitleCase`, `assigneeDisplayName` helpers  

---

## Recommended fix order (remaining)

1. **Deploy** `main` to Render + Vercel (Step 0 in `ADMIN_FIX_PLAN.md`)  
2. **HR:** Leave allocation for current month → employee submit → admin approve  
3. **Dashboard:** Employee count fallback from `GET /employees?limit=1` when stats fail  
4. **Migrate** Dashboard + Attendance + Settings from `apiClient` → `apiHelper`  
5. **Remove or wire** unused `AssetsTable.tsx` components  
6. **Replace** Dashboard `alert()` with `toast` for leave actions  

---

## Quick test matrix (after deploy)

### Admin
- [ ] Dashboard — employee count matches Employees page  
- [ ] Expenses — table loads; view/download/edit/approve/reject/delete  
- [ ] Leaves — view, approve, reject  
- [ ] Leave allocation — create row, employee sees balance  
- [ ] Payroll — approve/reject structure, slips  
- [ ] Attendance — today list + calendar without crash  
- [ ] Assets — list loads; assign/return/delete  
- [ ] Chat — groups load (not 404)  
- [ ] Departments — list + seed  

### Employee
- [ ] Leave — submit appears in table; edit/delete pending  
- [ ] Expenses — submit, view receipt, download  
- [ ] Payroll — view/download slip (no crash on partial slip)  
- [ ] Profile — employment + education doc view/download/delete  
- [ ] Attendance — check-in/out history  

---

## Files touched in stability work (reference)

- `frontend/src/app/utils/api.ts` — LeaveRequestService  
- `frontend/src/app/utils/salarySlip.ts` — slip normalization  
- `frontend/src/app/pages/admin/Expenses.tsx`, `LeaveRequests.tsx`, `Payroll.tsx`  
- `frontend/src/app/pages/employee/Leave.tsx`, `Expenses.tsx`, `Payroll.tsx`, `Profile.tsx`  
- `docs/ADMIN_FIX_PLAN.md` — deploy + leave workflow  
