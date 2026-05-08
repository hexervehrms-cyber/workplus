# Submit Buttons - Visual Guide

## Educational Documents Section

### Before Upload
```
┌─────────────────────────────────────────────────────────────┐
│ Educational Documents                                        │
│ Upload your certificates and marksheets for each level      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Documents Uploaded: 0%                                      │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ 0 of 14 documents uploaded                                  │
│                                                              │
│ [Education Level Cards...]                                  │
│                                                              │
│                                    [Submit Button - DISABLED]│
│                                    (grayed out)              │
└─────────────────────────────────────────────────────────────┘
```

### After Upload
```
┌─────────────────────────────────────────────────────────────┐
│ Educational Documents                                        │
│ Upload your certificates and marksheets for each level      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Documents Uploaded: 50%                                     │
│ ████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ 7 of 14 documents uploaded                                  │
│                                                              │
│ [Education Level Cards with checkmarks...]                  │
│                                                              │
│                                    [✓ Submit Educational    │
│                                     Documents - ENABLED]     │
└─────────────────────────────────────────────────────────────┘
```

### During Submission
```
┌─────────────────────────────────────────────────────────────┐
│ Educational Documents                                        │
│ Upload your certificates and marksheets for each level      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Documents Uploaded: 50%                                     │
│ ████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ 7 of 14 documents uploaded                                  │
│                                                              │
│ [Education Level Cards...]                                  │
│                                                              │
│                                    [⟳ Submitting... - LOADING]
│                                    (spinner animation)       │
└─────────────────────────────────────────────────────────────┘
```

## Upload Your Documents Section

### Before Upload
```
┌─────────────────────────────────────────────────────────────┐
│ Upload Your Documents                                        │
│ Upload employment documents from your earlier organization  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ [Document Categories...]                                    │
│ [Upload Area...]                                            │
│                                                              │
│                                    [Submit Button - DISABLED]│
│                                    (grayed out)              │
└─────────────────────────────────────────────────────────────┘
```

### After Upload
```
┌─────────────────────────────────────────────────────────────┐
│ Upload Your Documents                                        │
│ Upload employment documents from your earlier organization  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ [Document Categories...]                                    │
│ [Upload Area...]                                            │
│                                                              │
│ Uploaded Documents                                          │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📄 offer_letter.pdf                                     │ │
│ │    2.5 MB • 05/03/2026                    [Pending] [↓] │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│                                    [✓ Submit Employment     │
│                                     Documents - ENABLED]     │
└─────────────────────────────────────────────────────────────┘
```

### During Submission
```
┌─────────────────────────────────────────────────────────────┐
│ Upload Your Documents                                        │
│ Upload employment documents from your earlier organization  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ [Document Categories...]                                    │
│ [Upload Area...]                                            │
│                                                              │
│ Uploaded Documents                                          │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📄 offer_letter.pdf                                     │ │
│ │    2.5 MB • 05/03/2026                    [Pending] [↓] │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│                                    [⟳ Submitting... - LOADING]
│                                    (spinner animation)       │
└─────────────────────────────────────────────────────────────┘
```

## Button States

### Disabled State
```
┌──────────────────────────────────────┐
│ ✓ Submit Educational Documents       │
└──────────────────────────────────────┘
(Grayed out, not clickable)
```

### Enabled State
```
┌──────────────────────────────────────┐
│ ✓ Submit Educational Documents       │
└──────────────────────────────────────┘
(Blue background, clickable)
```

### Loading State
```
┌──────────────────────────────────────┐
│ ⟳ Submitting...                      │
└──────────────────────────────────────┘
(Spinner animation, not clickable)
```

## Button Placement

### Educational Documents
```
┌─────────────────────────────────────────────────────────────┐
│ Educational Documents                                        │
│ ...                                                          │
│ [Education Level Cards...]                                  │
│                                                              │
│                                    ┌──────────────────────┐ │
│                                    │ ✓ Submit Educational │ │
│                                    │   Documents          │ │
│                                    └──────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Upload Your Documents
```
┌─────────────────────────────────────────────────────────────┐
│ Upload Your Documents                                        │
│ ...                                                          │
│ [Uploaded Documents List...]                                │
│                                                              │
│                                    ┌──────────────────────┐ │
│                                    │ ✓ Submit Employment  │ │
│                                    │   Documents          │ │
│                                    └──────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Interaction Flow

### Educational Documents Submission
```
User uploads documents
        ↓
Progress bar updates
        ↓
Submit button becomes enabled
        ↓
User clicks "Submit Educational Documents"
        ↓
Button shows loading state
        ↓
Spinner animation plays
        ↓
Backend processes submission
        ↓
Success toast appears
        ↓
Button returns to enabled state
```

### Employment Documents Submission
```
User uploads documents
        ↓
Submit button becomes enabled
        ↓
User clicks "Submit Employment Documents"
        ↓
Button shows loading state
        ↓
Spinner animation plays
        ↓
Backend processes submission
        ↓
Success toast appears
        ↓
Button returns to enabled state
```

## Responsive Design

### Mobile (< 768px)
```
┌──────────────────────────────────────┐
│ Educational Documents                │
│ ...                                  │
│ [Cards...]                           │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ ✓ Submit Educational Documents   │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
(Full width button)
```

### Tablet/Desktop (> 768px)
```
┌─────────────────────────────────────────────────────────────┐
│ Educational Documents                                        │
│ ...                                                          │
│ [Cards...]                                                  │
│                                                              │
│                                    ┌──────────────────────┐ │
│                                    │ ✓ Submit Educational │ │
│                                    │   Documents          │ │
│                                    └──────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
(Right-aligned button)
```

## Color Scheme

### Button Colors
- **Enabled**: Primary Blue (#4F46E5)
- **Disabled**: Muted Gray
- **Hover**: Darker Blue
- **Loading**: Primary Blue with spinner

### Icon Colors
- **Check Mark**: White (on blue background)
- **Spinner**: White (on blue background)

## Accessibility

- ✅ Proper button semantics
- ✅ Clear disabled state
- ✅ Loading state indication
- ✅ Keyboard navigation support
- ✅ Screen reader friendly
- ✅ High contrast colors
- ✅ Clear visual feedback
