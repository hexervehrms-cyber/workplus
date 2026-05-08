# Break Options Feature - Visual Guide

## UI States

### State 1: Checked In (Working)
```
┌─────────────────────────────────────────────────────┐
│ Today's Attendance                                  │
├─────────────────────────────────────────────────────┤
│ Check-in Time: 10:32 AM                             │
│ Hours Today: 2.5h                                   │
│                                                     │
│ Status: Working                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │           [Check Out Button]                    │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌──────────────┬──────────────┬──────────────────┐ │
│ │ Break ▼      │ Meeting      │ Power Nap        │ │
│ └──────────────┴──────────────┴──────────────────┘ │
│                                                     │
│ Break Dropdown (on hover):                          │
│ ┌──────────────────────────────────────────────┐   │
│ │ Regular Break                                │   │
│ │ Power Nap                                    │   │
│ │ Lunch Break                                  │   │
│ └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### State 2: On Regular Break
```
┌─────────────────────────────────────────────────────┐
│ Today's Attendance                                  │
├─────────────────────────────────────────────────────┤
│ Check-in Time: 10:32 AM                             │
│ Hours Today: 2.5h                                   │
│                                                     │
│ Status: On Break                                    │
│ ┌─────────────────────────────────────────────────┐ │
│ │           [Check Out Button]                    │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌──────────────┬──────────────┬──────────────────┐ │
│ │ End Break    │ Meeting ✗    │ Power Nap        │ │
│ │              │ (disabled)   │                  │ │
│ └──────────────┴──────────────┴──────────────────┘ │
│                                                     │
│ Break duration: 5 min                               │
└─────────────────────────────────────────────────────┘
```

### State 3: On Power Nap
```
┌─────────────────────────────────────────────────────┐
│ Today's Attendance                                  │
├─────────────────────────────────────────────────────┤
│ Check-in Time: 10:32 AM                             │
│ Hours Today: 2.5h                                   │
│                                                     │
│ Status: On Break                                    │
│ ┌─────────────────────────────────────────────────┐ │
│ │           [Check Out Button]                    │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌──────────────┬──────────────┬──────────────────┐ │
│ │ Break ✗      │ Meeting ✗    │ End Nap          │ │
│ │ (disabled)   │ (disabled)   │                  │ │
│ └──────────────┴──────────────┴──────────────────┘ │
│                                                     │
│ Power Nap duration: 5 min                           │
└─────────────────────────────────────────────────────┘
```

### State 4: On Lunch Break
```
┌─────────────────────────────────────────────────────┐
│ Today's Attendance                                  │
├─────────────────────────────────────────────────────┤
│ Check-in Time: 10:32 AM                             │
│ Hours Today: 2.5h                                   │
│                                                     │
│ Status: On Break                                    │
│ ┌─────────────────────────────────────────────────┐ │
│ │           [Check Out Button]                    │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌──────────────┬──────────────┬──────────────────┐ │
│ │ End Break    │ Meeting ✗    │ Power Nap        │ │
│ │              │ (disabled)   │                  │ │
│ └──────────────┴──────────────┴──────────────────┘ │
│                                                     │
│ Lunch Break duration: 45 min                        │
└─────────────────────────────────────────────────────┘
```

### State 5: In Meeting
```
┌─────────────────────────────────────────────────────┐
│ Today's Attendance                                  │
├─────────────────────────────────────────────────────┤
│ Check-in Time: 10:32 AM                             │
│ Hours Today: 2.5h                                   │
│                                                     │
│ Status: In Meeting                                  │
│ ┌─────────────────────────────────────────────────┐ │
│ │           [Check Out Button]                    │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌──────────────┬──────────────┬──────────────────┐ │
│ │ Break ✗      │ End Meeting  │ Power Nap ✗      │ │
│ │ (disabled)   │              │ (disabled)       │ │
│ └──────────────┴──────────────┴──────────────────┘ │
└─────────────────────────────────────────────────────┘
```

## Break Dropdown Menu

### Hover Over Break Button
```
┌──────────────────────────────────────┐
│ Break ▼                              │
├──────────────────────────────────────┤
│ ☕ Regular Break                     │
│ 😴 Power Nap                         │
│ 🍽️  Lunch Break                      │
└──────────────────────────────────────┘
```

### Click Regular Break
```
Action: Start Regular Break
Result: 
  - Button changes to "End Break"
  - Status shows "On Break"
  - Meeting button disabled
  - Duration timer starts
```

### Click Power Nap
```
Action: Start Power Nap
Result:
  - Button changes to "End Nap"
  - Status shows "On Break"
  - Meeting button disabled
  - Duration timer starts
  - Display shows "Power Nap duration: X min"
```

### Click Lunch Break
```
Action: Start Lunch Break
Result:
  - Button changes to "End Break"
  - Status shows "On Break"
  - Meeting button disabled
  - Duration timer starts
  - Display shows "Lunch Break duration: X min"
```

## User Flow Diagram

```
                    ┌─────────────────┐
                    │   Employee      │
                    │   Checks In     │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Break & Meeting │
                    │ Buttons Appear  │
                    └────────┬────────┘
                             │
                ┌────────────┼────────────┐
                │            │            │
                ▼            ▼            ▼
        ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
        │ Hover Break  │ │ Click Meeting│ │ Click Power  │
        │ Button       │ │ Button       │ │ Nap Button   │
        └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
               │                │                │
        ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐
        │ Dropdown    │  │ In Meeting  │  │ Power Nap   │
        │ Appears     │  │ (Break ✗)   │  │ Starts      │
        └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
               │                │                │
        ┌──────▼──────────────────────────────────▼──────┐
        │ Select Break Type:                             │
        │ - Regular Break                                │
        │ - Power Nap                                    │
        │ - Lunch Break                                  │
        └──────┬──────────────────────────────────────────┘
               │
        ┌──────▼──────┐
        │ Break Starts│
        │ (Meeting ✗) │
        └──────┬──────┘
               │
        ┌──────▼──────┐
        │ End Break   │
        │ Button      │
        └──────┬──────┘
               │
        ┌──────▼──────┐
        │ Back to     │
        │ Working     │
        └─────────────┘
```

## Button States Matrix

| State | Break | Meeting | Power Nap |
|-------|-------|---------|-----------|
| Not Checked In | Hidden | Hidden | Hidden |
| Working | "Break ▼" | "Meeting" | "Power Nap" |
| On Regular Break | "End Break" | Disabled ✗ | "Power Nap" |
| On Power Nap | "Break ▼" | Disabled ✗ | "End Nap" |
| On Lunch Break | "End Break" | Disabled ✗ | "Power Nap" |
| In Meeting | Disabled ✗ | "End Meeting" | Disabled ✗ |
| Checked Out | Hidden | Hidden | Hidden |

## Color Coding

```
Working State:
- Break button: Outline (gray)
- Meeting button: Outline (gray)
- Power Nap button: Outline (gray)

On Break State:
- Break button: Destructive (red) - "End Break"
- Meeting button: Disabled (gray)
- Power Nap button: Outline (gray)

On Power Nap State:
- Break button: Disabled (gray)
- Meeting button: Disabled (gray)
- Power Nap button: Destructive (red) - "End Nap"

In Meeting State:
- Break button: Disabled (gray)
- Meeting button: Destructive (red) - "End Meeting"
- Power Nap button: Disabled (gray)
```

## Status Badge Display

```
Working:
┌─────────────────┐
│ Status: Working │
└─────────────────┘

On Break:
┌─────────────────┐
│ Status: On Break│
└─────────────────┘

In Meeting:
┌──────────────────┐
│ Status: In Meeting│
└──────────────────┘
```

## Duration Display

```
Regular Break:
"Break duration: 5 min"

Power Nap:
"Power Nap duration: 5 min"

Lunch Break:
"Lunch Break duration: 45 min"
```

## Responsive Design

### Desktop (3 columns)
```
┌──────────────┬──────────────┬──────────────┐
│ Break ▼      │ Meeting      │ Power Nap    │
└──────────────┴──────────────┴──────────────┘
```

### Tablet (2 columns + 1)
```
┌──────────────┬──────────────┐
│ Break ▼      │ Meeting      │
├──────────────┴──────────────┤
│ Power Nap                    │
└──────────────────────────────┘
```

### Mobile (1 column)
```
┌──────────────────────────────┐
│ Break ▼                      │
├──────────────────────────────┤
│ Meeting                      │
├──────────────────────────────┤
│ Power Nap                    │
└──────────────────────────────┘
```

---
**Visual Guide Date**: 2026-05-06
**Status**: ✅ Complete
