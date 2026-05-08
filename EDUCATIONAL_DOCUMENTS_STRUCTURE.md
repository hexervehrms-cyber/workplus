# Educational Documents Section - Structure & Layout

## Visual Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Educational Documents                                        │
│ Upload your certificates and marksheets for each level      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Documents Uploaded: 0%                                      │
│ ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ 0 of 14 documents uploaded                                  │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 10th                                                    │ │
│ │                                                         │ │
│ │ ┌──────────────────┐  ┌──────────────────┐            │ │
│ │ │ Upload           │  │ Upload           │            │ │
│ │ │ Certificate      │  │ Marksheet        │            │ │
│ │ │                  │  │                  │            │ │
│ │ │ Click or drag    │  │ Click or drag    │            │ │
│ │ └──────────────────┘  └──────────────────┘            │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 12th                                                    │ │
│ │                                                         │ │
│ │ ┌──────────────────┐  ┌──────────────────┐            │ │
│ │ │ ✓ Certificate    │  │ Upload           │            │ │
│ │ │ Uploaded         │  │ Marksheet        │            │ │
│ │ │ cert_12th.pdf    │  │                  │            │ │
│ │ └──────────────────┘  └──────────────────┘            │ │
│ │ Certificate ✓                                          │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ... (Graduation, Post Graduation, Diploma, Certificate,    │
│      Drop out sections follow same pattern)                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Component Hierarchy

```
Card (Educational Documents)
├── Header
│   ├── Title: "Educational Documents"
│   └── Description: "Upload your certificates and marksheets..."
│
├── Progress Section
│   ├── Label: "Documents Uploaded"
│   ├── Percentage: "0%"
│   ├── Progress Bar: <Progress value={0} />
│   └── Counter: "0 of 14 documents uploaded"
│
└── Education Levels Grid
    ├── 10th Level Card
    │   ├── Header
    │   │   ├── Title: "10th"
    │   │   └── Status Badges (if uploaded)
    │   │       ├── Badge: "Certificate ✓"
    │   │       └── Badge: "Marksheet ✓"
    │   │
    │   └── Upload Grid (2 columns)
    │       ├── Certificate Upload Area
    │       │   ├── Input: file[type=file]
    │       │   └── Label with icon
    │       │       ├── Upload Icon (empty state)
    │       │       ├── Spinner (uploading state)
    │       │       └── Checkmark (uploaded state)
    │       │
    │       └── Marksheet Upload Area
    │           ├── Input: file[type=file]
    │           └── Label with icon
    │               ├── Upload Icon (empty state)
    │               ├── Spinner (uploading state)
    │               └── Checkmark (uploaded state)
    │
    ├── 12th Level Card (same structure)
    ├── Graduation Level Card (same structure)
    ├── Post Graduation Level Card (same structure)
    ├── Diploma Level Card (same structure)
    ├── Certificate Level Card (same structure)
    └── Drop out Level Card (same structure)
```

## State Structure

```typescript
educationalDocuments = {
  '10th': {
    certificate?: {
      _id: string,
      name: string,
      size: string,
      uploadedAt: string,
      status: string,
      filePath?: string
    },
    marksheet?: {
      _id: string,
      name: string,
      size: string,
      uploadedAt: string,
      status: string,
      filePath?: string
    }
  },
  '12th': { ... },
  'Graduation': { ... },
  'Post Graduation': { ... },
  'Diploma': { ... },
  'Certificate': { ... },
  'Drop out': { ... }
}

uploadingEducation = null | '10th' | '12th' | 'Graduation' | ...
uploadingEducationType = null | 'certificate' | 'marksheet'
```

## Upload Flow

```
User clicks upload area
    ↓
File input dialog opens
    ↓
User selects file
    ↓
handleEducationDocumentUpload() called
    ↓
setUploadingEducation(level)
setUploadingEducationType(type)
    ↓
Show spinner in upload area
    ↓
Send FormData to /api/employee-dashboard/documents
    ↓
Backend processes file
    ↓
Response received
    ↓
Update educationalDocuments state
    ↓
Show success toast
    ↓
Progress bar updates automatically
    ↓
Green checkmark appears
    ↓
Status badge shows "Certificate ✓" or "Marksheet ✓"
```

## Progress Calculation

```
Total Slots = 7 levels × 2 document types = 14 slots

Filled Slots = count of uploaded documents

Progress % = (Filled Slots / Total Slots) × 100

Examples:
- 0 documents: 0%
- 1 document: 7.14% ≈ 7%
- 2 documents: 14.28% ≈ 14%
- 7 documents: 50%
- 14 documents: 100%
```

## Responsive Breakpoints

### Mobile (< 768px)
- Single column layout for upload areas
- Full width upload boxes
- Stacked education level cards

### Tablet (768px - 1024px)
- 2 column grid for upload areas
- Side-by-side certificate and marksheet
- Responsive card layout

### Desktop (> 1024px)
- 2 column grid for upload areas
- Side-by-side certificate and marksheet
- Full width cards with proper spacing

## CSS Classes Used

```
Card: "p-6 rounded-2xl"
Header: "mb-6"
Title: "font-semibold text-lg mb-2"
Description: "text-sm text-muted-foreground"
Progress: "mb-6 space-y-2"
Progress Bar: "h-2"
Education Level Card: "border border-border rounded-xl p-4"
Level Header: "flex items-center justify-between mb-4"
Level Title: "font-semibold text-sm"
Badge: "bg-green-600" or "bg-blue-600"
Upload Grid: "grid grid-cols-1 md:grid-cols-2 gap-4"
Upload Area: "border-2 border-dashed rounded-lg p-4 text-center bg-muted/30 hover:bg-muted/50"
Upload Label: "cursor-pointer block"
Icon: "w-5 h-5"
Spinner: "animate-spin text-primary"
Checkmark: "text-green-600"
```

## File Input Attributes

```html
<input
  type="file"
  id={`cert-${level}`}
  className="hidden"
  onChange={(e) => handleEducationDocumentUpload(e, level, 'certificate')}
  disabled={uploadingEducation === level && uploadingEducationType === 'certificate'}
  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
/>
```

## Toast Notifications

### Success
```
"10th certificate uploaded successfully"
"12th marksheet uploaded successfully"
```

### Error
```
"Failed to upload document"
"[Custom error message from server]"
```

## Accessibility Features

- Proper label associations with file inputs
- Semantic HTML structure
- ARIA labels for icons
- Keyboard navigation support
- Clear visual feedback for all states
- High contrast colors for status indicators
