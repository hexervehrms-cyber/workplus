# 🔄 EXPENSE SECTION - FLOW DIAGRAM

## Complete User Journey

```
┌─────────────────────────────────────────────────────────────────┐
│                    EXPENSE MANAGEMENT FLOW                      │
└─────────────────────────────────────────────────────────────────┘

                         EXPENSE PAGE
                              │
                ┌─────────────┼─────────────┐
                │             │             │
            [CREATE]      [VIEW]        [FILTER]
                │             │             │
                ▼             ▼             ▼
            Add Expense   List View    Category/Status
                │             │             │
                │      ┌──────┴──────┐     │
                │      │             │     │
                │   [PENDING]    [APPROVED]
                │      │             │
                │   ┌──┴──┐      [READ-ONLY]
                │   │     │
                │ [EDIT] [DELETE]
                │   │     │
                ▼   ▼     ▼
            UPDATE  DELETE  CONFIRM
                │     │     │
                └─────┴─────┘
                      │
                      ▼
                REFRESH LIST
```

---

## Create Expense Flow

```
┌──────────────────┐
│  Click "Add      │
│  Expense"        │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────┐
│  Dialog Opens                │
│  Mode: CREATE                │
│  Title: "Add New Expense"    │
│  Button: "Submit Claim"      │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  User Fills Form             │
│  - Title (required)          │
│  - Category (required)       │
│  - Amount (required)         │
│  - Date (required)           │
│  - Description (optional)    │
│  - Receipt (optional)        │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  User Clicks                 │
│  "Submit Claim"              │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  POST /api/expenses          │
│  {title, category, amount,   │
│   date, description, receipt}│
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  Expense Created             │
│  Status: PENDING             │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  Toast: "Expense submitted   │
│  successfully"               │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  Dialog Closes               │
│  List Refreshes              │
│  New Expense Appears         │
└──────────────────────────────┘
```

---

## Edit Expense Flow

```
┌──────────────────────────────┐
│  User Finds Pending Expense  │
│  in List                     │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  User Clicks [Edit] Button   │
│  (Pencil Icon)               │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  Dialog Opens                │
│  Mode: EDIT                  │
│  Title: "Edit Expense"       │
│  Button: "Update Claim"      │
│  Form Pre-filled with Data   │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  User Modifies Fields        │
│  (Any field can be changed)  │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  User Clicks                 │
│  "Update Claim"              │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  PUT /api/expenses/:id       │
│  {title, category, amount,   │
│   date, description, receipt}│
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  Expense Updated             │
│  Status: Still PENDING       │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  Toast: "Expense updated     │
│  successfully"               │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  Dialog Closes               │
│  List Refreshes              │
│  Updated Expense Shows       │
└──────────────────────────────┘
```

---

## Delete Expense Flow

```
┌──────────────────────────────┐
│  User Finds Pending Expense  │
│  in List                     │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  User Clicks [Delete] Button │
│  (Trash Icon)                │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  Confirmation Dialog         │
│  "Are you sure you want to   │
│   delete this expense?"      │
│  [Cancel] [OK]               │
└────────┬─────────────────────┘
         │
    ┌────┴────┐
    │          │
   NO         YES
    │          │
    ▼          ▼
 CANCEL    ┌──────────────────────────────┐
           │  DELETE /api/expenses/:id    │
           └────────┬─────────────────────┘
                    │
                    ▼
           ┌──────────────────────────────┐
           │  Expense Deleted             │
           │  Removed from Database       │
           └────────┬─────────────────────┘
                    │
                    ▼
           ┌──────────────────────────────┐
           │  Toast: "Expense deleted     │
           │  successfully"               │
           └────────┬─────────────────────┘
                    │
                    ▼
           ┌──────────────────────────────┐
           │  List Refreshes              │
           │  Expense Removed from View   │
           └──────────────────────────────┘
```

---

## Expense Status States

```
┌─────────────────────────────────────────────────────────────┐
│                    EXPENSE LIFECYCLE                        │
└─────────────────────────────────────────────────────────────┘

                    [PENDING]
                       │
            ┌──────────┼──────────┐
            │          │          │
        [EDIT]    [DELETE]   [APPROVE]
            │          │          │
            ▼          ▼          ▼
        [PENDING]   DELETED   [APPROVED]
            │                     │
            │                  [READ-ONLY]
            │
        [REJECT]
            │
            ▼
        [REJECTED]
            │
        [READ-ONLY]

Legend:
[PENDING]    = Can Edit/Delete
[APPROVED]   = Read-Only
[REJECTED]   = Read-Only
DELETED      = Removed from List
```

---

## Button Visibility Matrix

```
┌──────────────────────────────────────────────────────────────┐
│              BUTTON VISIBILITY BY STATUS                    │
├──────────────────────────────────────────────────────────────┤
│ Status    │ Download │ Edit │ Delete │ Receipt │ Actions    │
├───────────┼──────────┼──────┼────────┼─────────┼────────────┤
│ PENDING   │    ✓     │  ✓   │   ✓    │    ✓    │ Full CRUD  │
│ APPROVED  │    ✓     │  ✗   │   ✗    │    ✓    │ Read-Only  │
│ REJECTED  │    ✓     │  ✗   │   ✗    │    ✓    │ Read-Only  │
└──────────────────────────────────────────────────────────────┘

Legend:
✓ = Visible/Available
✗ = Hidden/Disabled
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    DATA FLOW                                │
└─────────────────────────────────────────────────────────────┘

USER INPUT
    │
    ▼
┌──────────────────────┐
│  Form Component      │
│  - Title             │
│  - Category          │
│  - Amount            │
│  - Date              │
│  - Description       │
│  - Receipt           │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  Validation          │
│  - Required fields   │
│  - Data types        │
│  - File size         │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  API Request         │
│  POST/PUT/DELETE     │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  Backend Processing  │
│  - Validate          │
│  - Authorize         │
│  - Save/Update/Delete│
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  API Response        │
│  - Success/Error     │
│  - Updated Data      │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  State Update        │
│  - Update expenses   │
│  - Clear form        │
│  - Close dialog      │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  UI Update           │
│  - Refresh list      │
│  - Show toast        │
│  - Update display    │
└──────────────────────┘
```

---

## Component State Management

```
┌─────────────────────────────────────────────────────────────┐
│                    STATE VARIABLES                          │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ State Variable      │ Type    │ Purpose                      │
├─────────────────────┼─────────┼──────────────────────────────┤
│ open                │ boolean │ Dialog visibility            │
│ editingId           │ string  │ Current editing expense ID   │
│ expenses            │ array   │ List of all expenses         │
│ loading             │ boolean │ Loading state                │
│ submitting          │ boolean │ Form submission state        │
│ formData            │ object  │ Form field values            │
│ receiptFile         │ file    │ Selected receipt file        │
│ selectedCategory    │ string  │ Filter category              │
│ selectedStatus      │ string  │ Filter status                │
└──────────────────────────────────────────────────────────────┘
```

---

## Error Handling Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    ERROR HANDLING                            │
└──────────────────────────────────────────────────────────────┘

API Request
    │
    ├─ Success (200-299)
    │   └─ Update State
    │   └─ Show Success Toast
    │   └─ Refresh List
    │
    └─ Error (400+)
        ├─ Parse Error Response
        ├─ Log Error
        ├─ Show Error Toast
        └─ Keep Form Open
            (User can retry)
```

---

**Status**: ✅ COMPLETE
**Date**: May 2, 2026

