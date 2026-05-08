# Asset Photo Upload - UI Reference Guide

## Component Overview

### 1. Asset Card (Admin View)

```
┌─────────────────────────────────────┐
│  ┌─────────────────────────────────┐ │
│  │                                 │ │
│  │     [Photo Thumbnail]           │ │  ← 40px height
│  │     or [Image Icon]             │ │
│  │                                 │ │
│  └─────────────────────────────────┘ │
│                                       │
│  Dell Laptop                          │
│  XPS 13                               │
│                                       │
│  Serial: SN123456                     │
│  Assigned to: John Doe                │
│  Current Value: ₹50,000               │
│  Assigned: 05/03/2026                 │
│                                       │
│  ┌──────────────┬──────────────────┐  │
│  │ [📷 Photos]  │ [➜ Assign]       │  │
│  │              │ [🗑️ Delete]      │  │
│  └──────────────┴──────────────────┘  │
└─────────────────────────────────────┘
```

### 2. Add Asset Modal - Photo Upload Section

```
┌──────────────────────────────────────────────────┐
│ Add New Asset                              [✕]   │
├──────────────────────────────────────────────────┤
│                                                  │
│ Asset Name *                                     │
│ [_________________________________]              │
│                                                  │
│ Type *              Category *                   │
│ [Laptop ▼]          [IT Equipment ▼]             │
│                                                  │
│ Model               Serial Number                │
│ [_____________]     [_____________]              │
│                                                  │
│ Purchase Price      Purchase Date                │
│ [_____________]     [_____________]              │
│                                                  │
├──────────────────────────────────────────────────┤
│ Asset Photos (Optional)                          │
│                                                  │
│ ┌──────────────────────────────────────────────┐ │
│ │  📤 Click to upload or drag and drop         │ │
│ │  Max 10 photos per asset                     │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ Uploaded Photos (2/10)                           │
│ ┌─────────────────────────────────────────────┐  │
│ │ [Thumb] photo1.jpg                      [✕] │  │
│ │ Description: [Front view of laptop]         │  │
│ └─────────────────────────────────────────────┘  │
│ ┌─────────────────────────────────────────────┐  │
│ │ [Thumb] photo2.jpg                      [✕] │  │
│ │ Description: [Side view]                    │  │
│ └─────────────────────────────────────────────┘  │
│                                                  │
├──────────────────────────────────────────────────┤
│ [Cancel]                    [Add Asset]          │
└──────────────────────────────────────────────────┘
```

### 3. Photo Gallery Modal - Main View

```
┌────────────────────────────────────────────────────────┐
│ Asset Photos - Dell Laptop                        [✕]  │
├────────────────────────────────────────────────────────┤
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │                                                  │  │
│  │  ◀  [        Photo Display Area        ]  ▶     │  │
│  │      (Full size image with navigation)          │  │
│  │                                                  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  Photo 1 of 5                                          │
│  Description: Front view with serial number visible   │
│  Uploaded: 05/03/2026                                  │
│                                                        │
│  [⭐ Set as Main]  [🗑️ Delete]                         │
│                                                        │
│  All Photos                                            │
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐                             │
│  │1 │ │2 │ │3 │ │4 │ │5 │                             │
│  │  │ │  │ │  │ │  │ │  │                             │
│  └──┘ └──┘ └──┘ └──┘ └──┘                             │
│   ▲ (selected)                                         │
│                                                        │
│  Add More Photos                                       │
│  ┌──────────────────────────────────────────────────┐  │
│  │  📤 Click to upload more photos                  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
├────────────────────────────────────────────────────────┤
│ [Close]                                                │
└────────────────────────────────────────────────────────┘
```

### 4. Photo Gallery Modal - With New Photos

```
┌────────────────────────────────────────────────────────┐
│ Asset Photos - Dell Laptop                        [✕]  │
├────────────────────────────────────────────────────────┤
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │                                                  │  │
│  │  ◀  [        Photo Display Area        ]  ▶     │  │
│  │      (Full size image with navigation)          │  │
│  │                                                  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  Photo 1 of 5                                          │
│  Description: Front view with serial number visible   │
│  Uploaded: 05/03/2026                                  │
│                                                        │
│  [⭐ Set as Main]  [🗑️ Delete]                         │
│                                                        │
│  All Photos                                            │
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐                             │
│  │1 │ │2 │ │3 │ │4 │ │5 │                             │
│  │  │ │  │ │  │ │  │ │  │                             │
│  └──┘ └──┘ └──┘ └──┘ └──┘                             │
│   ▲ (selected)                                         │
│                                                        │
│  Add More Photos                                       │
│  ┌──────────────────────────────────────────────────┐  │
│  │  📤 Click to upload more photos                  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  New Photos (2)                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ [Thumb] photo6.jpg                          [✕] │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │ [Thumb] photo7.jpg                          [✕] │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  [Upload 2 Photo(s)]                                   │
│                                                        │
├────────────────────────────────────────────────────────┤
│ [Close]                                                │
└────────────────────────────────────────────────────────┘
```

### 5. Employee Asset Card

```
┌─────────────────────────────────────┐
│  ┌─────────────────────────────────┐ │
│  │                                 │ │
│  │     [Photo Thumbnail]           │ │  ← 40px height
│  │     or [Image Icon]             │ │
│  │                                 │ │
│  └─────────────────────────────────┘ │
│                                       │
│  Dell Laptop                          │
│  XPS 13                               │
│                                       │
│  Serial Number: SN123456              │
│  Current Value: ₹50,000               │
│  Purchase Price: ₹75,000              │
│  Assigned: 05/03/2026                 │
│  Location: Desk 5, Floor 2            │
│  Assigned By: Admin User              │
│                                       │
│  ┌──────────────┬──────────────────┐  │
│  │ [📷 Photos]  │ [Laptop]         │  │
│  └──────────────┴──────────────────┘  │
└─────────────────────────────────────┘
```

### 6. Employee Photo Gallery (Read-Only)

```
┌────────────────────────────────────────────────────────┐
│ Asset Photos - Dell Laptop                        [✕]  │
├────────────────────────────────────────────────────────┤
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │                                                  │  │
│  │  ◀  [        Photo Display Area        ]  ▶     │  │
│  │      (Full size image with navigation)          │  │
│  │                                                  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  Photo 1 of 5                                          │
│  Description: Front view with serial number visible   │
│  Uploaded: 05/03/2026                                  │
│                                                        │
│  All Photos                                            │
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐                             │
│  │1 │ │2 │ │3 │ │4 │ │5 │                             │
│  │  │ │  │ │  │ │  │ │  │                             │
│  └──┘ └──┘ └──┘ └──┘ └──┘                             │
│   ▲ (selected)                                         │
│                                                        │
├────────────────────────────────────────────────────────┤
│ [Close]                                                │
└────────────────────────────────────────────────────────┘
```

## Icon Legend

| Icon | Meaning |
|------|---------|
| 📷 | Photos/Gallery |
| 📤 | Upload |
| ✕ | Close/Remove |
| ◀ ▶ | Navigation arrows |
| ⭐ | Set as main/favorite |
| 🗑️ | Delete |
| ▼ | Dropdown menu |
| ➜ | Action button |

## Color Scheme

| Element | Color | Usage |
|---------|-------|-------|
| Primary | Blue | Buttons, active states |
| Secondary | Gray | Secondary buttons, badges |
| Destructive | Red | Delete buttons |
| Success | Green | Success messages |
| Muted | Light Gray | Backgrounds, disabled states |
| Border | Medium Gray | Card borders, dividers |

## Responsive Breakpoints

### Mobile (< 768px)
- Single column asset grid
- Full-width modals
- Stacked buttons
- Smaller thumbnails

### Tablet (768px - 1024px)
- Two column asset grid
- Wider modals
- Side-by-side buttons
- Medium thumbnails

### Desktop (> 1024px)
- Three column asset grid
- Optimal modal width
- Horizontal button layout
- Full-size thumbnails

## Interaction States

### Button States
- **Default**: Normal appearance
- **Hover**: Slightly darker, shadow effect
- **Active**: Pressed appearance
- **Disabled**: Grayed out, no interaction

### Modal States
- **Open**: Fade in animation
- **Close**: Fade out animation
- **Loading**: Spinner animation

### Gallery States
- **Loading**: Spinner on image area
- **Loaded**: Image displayed
- **Error**: Error message displayed

## Accessibility Features

- Keyboard navigation (arrow keys)
- Alt text for images
- ARIA labels for buttons
- High contrast colors
- Focus indicators
- Screen reader support

## Animation Timings

| Animation | Duration | Easing |
|-----------|----------|--------|
| Modal fade | 200ms | ease-in-out |
| Button hover | 150ms | ease-out |
| Image transition | 300ms | ease-in-out |
| Carousel slide | 400ms | ease-in-out |

## Typography

| Element | Font Size | Weight |
|---------|-----------|--------|
| Modal Title | 20px | Bold |
| Section Header | 14px | Medium |
| Body Text | 14px | Regular |
| Small Text | 12px | Regular |
| Photo Counter | 14px | Medium |

## Spacing

| Element | Spacing |
|---------|---------|
| Modal padding | 24px |
| Section gap | 16px |
| Button gap | 8px |
| Thumbnail gap | 8px |
| Card padding | 16px |

---

**Last Updated**: May 3, 2026
**Version**: 1.0.0
