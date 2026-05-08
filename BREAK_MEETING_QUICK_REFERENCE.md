# Break and Meeting Feature - Quick Reference Card

## 🎯 What's New

✅ Break functionality - Start/End breaks during work day
✅ Meeting functionality - Start/End meetings during work day
✅ Smart constraints - Meeting button disabled when on break
✅ Real-time updates - Status updates immediately
✅ Data persistence - All data saved to database

## 🔘 Button States

### When NOT Checked In
```
[Check In]
```

### When Checked In (Working)
```
[Check Out]
[Start Break] [Start Meeting]
```

### When On Break
```
[Check Out]
[End Break] [Start Meeting] ✗ (disabled)
Break duration: X min
```

### When In Meeting
```
[Check Out]
[Start Break] ✗ (disabled) [End Meeting]
```

## 📋 API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/attendance/break-start` | Start a break |
| POST | `/api/attendance/break-end` | End a break |
| POST | `/api/attendance/meeting-start` | Start a meeting |
| POST | `/api/attendance/meeting-end` | End a meeting |
| GET | `/api/attendance/today` | Get today's status |

## ⚙️ Request/Response Examples

### Start Break
```bash
POST /api/attendance/break-start
{
  "employeeId": "xxx",
  "orgId": "xxx",
  "breakType": "regular",
  "notes": "Lunch break"
}

Response:
{
  "success": true,
  "message": "Break started successfully",
  "data": { attendance: {...} }
}
```

### Start Meeting
```bash
POST /api/attendance/meeting-start
{
  "employeeId": "xxx",
  "orgId": "xxx",
  "meetingTitle": "Team Standup",
  "meetingType": "internal"
}

Response:
{
  "success": true,
  "message": "Meeting started successfully",
  "data": { attendance: {...} }
}
```

## 🚫 Constraints

| Constraint | Details |
|-----------|---------|
| **Meeting ✗ on Break** | Cannot start meeting while on break |
| **Break ✗ in Meeting** | Cannot start break while in meeting |
| **Buttons ✗ Not Checked In** | Buttons hidden when not checked in |
| **One Break at a Time** | Cannot start break if already on break |
| **One Meeting at a Time** | Cannot start meeting if already in meeting |

## ✅ Validation Rules

### Break Start
- ✅ Must be checked in
- ✅ Cannot already be on break
- ✅ Cannot be in meeting

### Meeting Start
- ✅ Must be checked in
- ✅ Cannot already be in meeting
- ✅ **Cannot be on break** ⭐

## 📊 Status Values

| Status | Meaning |
|--------|---------|
| `not_checked_in` | Not checked in |
| `checked_in` | Checked in, working |
| `on_break` | Currently on break |
| `in_meeting` | Currently in meeting |
| `checked_out` | Checked out |

## 🔍 Testing Quick Checks

- [ ] Break button appears after check-in
- [ ] Meeting button appears after check-in
- [ ] Can start break
- [ ] Can end break
- [ ] Can start meeting
- [ ] Can end meeting
- [ ] Meeting button disabled when on break
- [ ] Break button disabled when in meeting
- [ ] Status updates correctly
- [ ] Data persists after refresh

## 🐛 Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| Buttons not appearing | Refresh page, check check-in status |
| Meeting button not disabled | Refresh page, check browser console |
| Break duration not updating | Verify break is active in database |
| Data not persisting | Check database connection |
| Error messages not showing | Check browser console for errors |

## 📱 UI States Summary

```
NOT CHECKED IN
├─ Check In button visible
└─ Break/Meeting buttons hidden

CHECKED IN (WORKING)
├─ Check Out button visible
├─ Start Break button enabled
├─ Start Meeting button enabled
└─ Status: "Working"

ON BREAK
├─ Check Out button visible
├─ End Break button enabled
├─ Start Meeting button DISABLED
├─ Break duration displays
└─ Status: "On Break"

IN MEETING
├─ Check Out button visible
├─ Start Break button DISABLED
├─ End Meeting button enabled
└─ Status: "In Meeting"

CHECKED OUT
├─ Check In button visible
└─ Break/Meeting buttons hidden
```

## 🔐 Security

- ✅ All endpoints require authentication
- ✅ Role-based access control
- ✅ Employee can only modify own records
- ✅ All actions logged with IP address
- ✅ Input validation on all endpoints

## 📈 Performance

- Break start: < 1 second
- Break end: < 1 second
- Meeting start: < 1 second
- Meeting end: < 1 second
- Page refresh: < 3 seconds

## 📚 Documentation Files

1. `BREAK_MEETING_FEATURE_ADDED.md` - Feature overview
2. `BREAK_MEETING_TESTING_GUIDE.md` - Testing guide
3. `BREAK_MEETING_IMPLEMENTATION_SUMMARY.md` - Technical details
4. `BREAK_MEETING_VISUAL_GUIDE.md` - UI diagrams
5. `BREAK_MEETING_COMPLETE_SUMMARY.md` - Complete summary
6. `BREAK_MEETING_QUICK_REFERENCE.md` - This file

## 🎓 Key Takeaways

✅ **Mutual Exclusivity**: Meeting button disabled when on break
✅ **Visibility**: Buttons only show when checked in
✅ **Persistence**: All data saved to database
✅ **Real-time**: Status updates immediately
✅ **Logging**: All actions logged for audit trail

## 🚀 Ready to Test

The feature is complete and ready for testing. Follow the testing guide for comprehensive test scenarios.

---
**Quick Reference Date**: 2026-05-06
**Status**: ✅ Ready for Testing
