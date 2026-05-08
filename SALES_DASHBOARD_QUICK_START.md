# Sales Dashboard - Quick Start Guide

## 🚀 Getting Started

### Prerequisites
- Backend running on port 5000
- Frontend running on port 5173
- MongoDB connected
- Valid JWT authentication token

---

## 📱 Accessing the Sales Dashboard

### For Admin Users

1. **Login to WorkPlus**
   - Navigate to `http://localhost:5173/login`
   - Enter admin credentials
   - You'll be redirected to admin dashboard

2. **Access Sales Module**
   - Click on "Sales" in the left sidebar
   - You'll see submenu items:
     - Dashboard (Main)
     - Leads
     - Deals
     - Calls

3. **Sales Dashboard** (`/admin/sales`)
   - View real-time KPI cards
   - See sales funnel visualization
   - Check employee leaderboard
   - Monitor monthly revenue

---

## 📊 Main Features

### 1. Sales Dashboard (`/admin/sales`)

**KPI Cards**:
- Total Calls Today
- Connected Calls
- Interested Leads
- Revenue Today

**Sales Funnel**:
- Visual pipeline stages
- Lead → Contacted → Interested → Meeting → Proposal → Closed

**Performance Score**:
- Circular progress indicator
- Performance tier badge
- Score out of 100

**Top Performers**:
- Leaderboard with rankings
- Medal badges (🥇🥈🥉)
- Metrics: Calls, Leads, Deals, Revenue, Score

**Monthly Revenue**:
- Bar chart showing daily revenue
- Trend analysis

---

### 2. Leads Management (`/admin/sales/leads`)

**Create Lead**:
1. Click "Add Lead" button
2. Fill in lead details:
   - Name (required)
   - Email (required)
   - Phone (required)
   - Company (optional)
   - Source: Website, Referral, Cold Call, Email, Social, Event
   - Status: New, Contacted, Interested, Qualified, Lost
   - Value: Estimated deal value
   - Notes: Additional information

**Manage Leads**:
- Search by name or email
- Filter by status
- Edit lead details
- Delete leads
- Assign to employees

**Lead Status Flow**:
```
New → Contacted → Interested → Qualified → Lost
```

---

### 3. Calls Management (`/admin/sales/calls`)

**Log Call**:
1. Click "Log Call" button
2. Fill in call details:
   - Employee (required)
   - Lead (optional)
   - Date (required)
   - Duration in seconds (required)
   - Call Type: Inbound, Outbound
   - Status: Connected, Missed, Voicemail, Declined
   - Outcome: Hot, Warm, Cold, Not Interested, Follow-up
   - Notes: Call summary

**Track Calls**:
- View all calls with employee and lead info
- See call duration in minutes/seconds
- Filter by status
- Search by employee or lead name
- Edit or delete call records

**Call Outcomes**:
- 🔥 Hot: High interest, ready to close
- 🌡️ Warm: Interested, needs follow-up
- ❄️ Cold: Low interest
- ❌ Not Interested: Rejected
- 📞 Follow-up: Needs follow-up call

---

### 4. Deals Management (`/admin/sales/deals`)

**Create Deal**:
1. Click "Add Deal" button
2. Fill in deal details:
   - Lead (required)
   - Employee (required)
   - Deal Name (required)
   - Deal Value (required)
   - Stage: Proposal, Negotiation, Closed Won, Closed Lost
   - Probability: 0-100% (slider)
   - Expected Close Date (required)
   - Notes: Deal details

**Manage Deals**:
- View pipeline by stage
- Search by deal name or lead
- Filter by stage
- Update probability
- Close deals (Won/Lost)
- Edit or delete deals

**Deal Stages**:
```
Proposal → Negotiation → Closed Won
                      ↘ Closed Lost
```

**Probability Indicator**:
- Visual progress bar
- Percentage display
- Adjustable via slider

---

## 🔄 Workflow Examples

### Example 1: New Lead to Closed Deal

1. **Create Lead**
   - Go to Leads page
   - Click "Add Lead"
   - Enter lead information
   - Status: "New"

2. **Log Call**
   - Go to Calls page
   - Click "Log Call"
   - Select the lead
   - Set outcome: "Interested"

3. **Update Lead Status**
   - Go back to Leads
   - Edit the lead
   - Change status to "Interested"

4. **Create Deal**
   - Go to Deals page
   - Click "Add Deal"
   - Select the lead
   - Set value and close date
   - Stage: "Proposal"

5. **Progress Deal**
   - Update stage to "Negotiation"
   - Increase probability as deal progresses
   - Log follow-up calls

6. **Close Deal**
   - Update stage to "Closed Won"
   - Revenue automatically recorded
   - Performance metrics updated

---

### Example 2: Track Employee Performance

1. **View Dashboard**
   - Go to Sales Dashboard
   - Check KPI cards for today's metrics
   - View leaderboard for rankings

2. **Check Employee Metrics**
   - Click on employee in leaderboard
   - View their calls, leads, deals
   - See performance score calculation

3. **Monitor Trends**
   - Check weekly/monthly leaderboard
   - Compare performance over time
   - Identify top performers

---

## 📈 Performance Scoring

### Calculation Formula
```
Score = Calls + (Leads × 5) + (Meetings × 10) + (Closures × 25)
Normalized to 0-100 scale
```

### Performance Tiers
- **Excellent** (80-100): 🥇 Top performer
- **Good** (60-79): ✅ Above average
- **Average** (40-59): ⚠️ Needs improvement
- **Poor** (0-39): ❌ Below expectations

### Example Calculation
```
Employee A:
- Calls: 15
- Leads: 3
- Meetings: 2
- Closures: 1

Score = 15 + (3 × 5) + (2 × 10) + (1 × 25)
      = 15 + 15 + 20 + 25
      = 75 (Good)
```

---

## 🔍 Search & Filter

### Search Features
- **Leads**: Search by name or email
- **Calls**: Search by employee or lead name
- **Deals**: Search by deal name or lead name

### Filter Options
- **Leads**: Filter by status (New, Contacted, Interested, Qualified, Lost)
- **Calls**: Filter by status (Connected, Missed, Voicemail, Declined)
- **Deals**: Filter by stage (Proposal, Negotiation, Closed Won, Closed Lost)

---

## 💡 Tips & Best Practices

### For Sales Managers
1. **Daily Check-in**: Review KPI cards every morning
2. **Monitor Leaderboard**: Track team performance
3. **Follow-up Reminders**: Set next follow-up dates
4. **Deal Tracking**: Update deal stages regularly
5. **Revenue Monitoring**: Check monthly revenue vs target

### For Sales Reps
1. **Log Calls Immediately**: Record calls right after completion
2. **Update Lead Status**: Keep lead status current
3. **Set Follow-ups**: Always set next follow-up date
4. **Add Notes**: Include call outcomes and next steps
5. **Track Deals**: Update deal probability as it progresses

### Data Entry Best Practices
1. **Be Specific**: Use clear, descriptive names and notes
2. **Accurate Dates**: Set realistic close dates
3. **Consistent Status**: Use standard status values
4. **Complete Information**: Fill all required fields
5. **Regular Updates**: Keep data current

---

## 🐛 Troubleshooting

### Issue: Can't see Sales menu
**Solution**: 
- Ensure you're logged in as admin
- Refresh the page
- Check browser console for errors

### Issue: Leads/Calls/Deals not loading
**Solution**:
- Check internet connection
- Verify backend is running on port 5000
- Check browser console for API errors
- Clear browser cache and refresh

### Issue: Can't create lead/call/deal
**Solution**:
- Ensure all required fields are filled
- Check for validation errors in form
- Verify employee/lead exists before creating deal
- Check browser console for error details

### Issue: Real-time updates not working
**Solution**:
- Check Socket.IO connection in browser console
- Verify backend Socket.IO is running
- Refresh page to reconnect
- Check firewall/proxy settings

---

## 📞 API Endpoints Reference

### Leads API
```
GET    /api/sales/leads                    - List leads
POST   /api/sales/leads                    - Create lead
GET    /api/sales/leads/:id                - Get lead
PATCH  /api/sales/leads/:id                - Update lead
DELETE /api/sales/leads/:id                - Delete lead
GET    /api/sales/leads/status/:status     - Filter by status
POST   /api/sales/leads/:id/assign         - Assign to employee
```

### Calls API
```
GET    /api/sales/calls                    - List calls
POST   /api/sales/calls                    - Create call
GET    /api/sales/calls/:id                - Get call
PATCH  /api/sales/calls/:id                - Update call
DELETE /api/sales/calls/:id                - Delete call
GET    /api/sales/calls/today              - Today's calls
GET    /api/sales/calls/employee/:id       - Employee's calls
POST   /api/sales/calls/:id/outcome        - Tag outcome
```

### Deals API
```
GET    /api/sales/deals                    - List deals
POST   /api/sales/deals                    - Create deal
GET    /api/sales/deals/:id                - Get deal
PATCH  /api/sales/deals/:id                - Update deal
DELETE /api/sales/deals/:id                - Delete deal
GET    /api/sales/deals/stage/:stage       - Filter by stage
PATCH  /api/sales/deals/:id/close          - Close deal
```

### Performance API
```
GET    /api/sales/performance/today        - Today's metrics
GET    /api/sales/performance/week         - Weekly metrics
GET    /api/sales/performance/month        - Monthly metrics
GET    /api/sales/performance/leaderboard/today  - Today's leaderboard
GET    /api/sales/performance/leaderboard/week   - Weekly leaderboard
GET    /api/sales/performance/leaderboard/month  - Monthly leaderboard
GET    /api/sales/performance/score/:id    - Employee score
POST   /api/sales/performance              - Create metrics
```

### Revenue API
```
GET    /api/sales/revenue                  - List revenue
POST   /api/sales/revenue                  - Create revenue
GET    /api/sales/revenue/:id              - Get revenue
PATCH  /api/sales/revenue/:id              - Update revenue
DELETE /api/sales/revenue/:id              - Delete revenue
GET    /api/sales/revenue/today            - Today's revenue
GET    /api/sales/revenue/month            - Monthly revenue
GET    /api/sales/revenue/year             - Yearly revenue
GET    /api/sales/revenue/employee/:id     - Employee revenue
GET    /api/sales/revenue/vs-target        - Revenue vs target
```

---

## 🎓 Learning Resources

- **SALES_DASHBOARD_SPEC.md**: Complete specification
- **SALES_DASHBOARD_IMPLEMENTATION.md**: Implementation details
- **API Documentation**: In route files (backend/routes/sales/)
- **Component Documentation**: In React files (frontend/src/app/pages/sales/)

---

## 📅 Next Steps

1. **Test the Dashboard**: Create sample data and test workflows
2. **Train Team**: Show sales team how to use the system
3. **Monitor Performance**: Track adoption and usage
4. **Gather Feedback**: Collect user feedback for improvements
5. **Plan Phase 2**: Implement advanced features

---

**Last Updated**: May 4, 2026
**Status**: Ready for Production ✅
