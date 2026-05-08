# WorkPlus Sales Dashboard - Complete Specification

## 📋 PROJECT OVERVIEW

A premium, high-conversion Sales Control Center for business owners and sales managers to track real-time performance, revenue, and team productivity.

---

## 🏗️ DATABASE SCHEMA

### 1. Calls Table
```
calls {
  id: UUID (PK)
  employeeId: UUID (FK)
  leadId: UUID (FK)
  callDate: DateTime
  duration: Integer (seconds)
  callType: ENUM ['Inbound', 'Outbound']
  status: ENUM ['Connected', 'Missed', 'Voicemail', 'Declined']
  recordingUrl: String (optional)
  recordingDuration: Integer
  outcome: ENUM ['Hot', 'Warm', 'Cold', 'Not Interested', 'Follow-up']
  notes: Text
  nextFollowUpDate: DateTime (optional)
  createdAt: DateTime
  updatedAt: DateTime
  orgId: String (FK)
}

Indexes:
- (employeeId, callDate)
- (leadId, callDate)
- (orgId, callDate)
- (status, callDate)
```

### 2. Leads Table
```
leads {
  id: UUID (PK)
  name: String
  email: String
  phone: String
  company: String
  source: ENUM ['Website', 'Referral', 'Cold Call', 'Email', 'Social', 'Event']
  status: ENUM ['New', 'Contacted', 'Interested', 'Qualified', 'Lost']
  value: Decimal (estimated deal value)
  assignedTo: UUID (FK - Employee)
  createdAt: DateTime
  updatedAt: DateTime
  orgId: String (FK)
}

Indexes:
- (assignedTo, status)
- (orgId, createdAt)
- (status, createdAt)
```

### 3. Deals Table
```
deals {
  id: UUID (PK)
  leadId: UUID (FK)
  employeeId: UUID (FK)
  dealName: String
  value: Decimal
  stage: ENUM ['Proposal', 'Negotiation', 'Closed Won', 'Closed Lost']
  probability: Integer (0-100)
  expectedCloseDate: DateTime
  actualCloseDate: DateTime (optional)
  closedBy: UUID (FK - Employee)
  notes: Text
  createdAt: DateTime
  updatedAt: DateTime
  orgId: String (FK)
}

Indexes:
- (employeeId, stage)
- (orgId, actualCloseDate)
- (stage, expectedCloseDate)
```

### 4. Tasks Table
```
tasks {
  id: UUID (PK)
  employeeId: UUID (FK)
  leadId: UUID (FK)
  dealId: UUID (FK)
  title: String
  description: Text
  type: ENUM ['Call', 'Email', 'Meeting', 'Follow-up', 'Demo']
  dueDate: DateTime
  status: ENUM ['Pending', 'In Progress', 'Completed', 'Overdue']
  priority: ENUM ['Low', 'Medium', 'High']
  completedAt: DateTime (optional)
  createdAt: DateTime
  updatedAt: DateTime
  orgId: String (FK)
}

Indexes:
- (employeeId, dueDate)
- (status, dueDate)
- (orgId, dueDate)
```

### 5. Revenue Table
```
revenue {
  id: UUID (PK)
  dealId: UUID (FK)
  employeeId: UUID (FK)
  amount: Decimal
  date: DateTime
  type: ENUM ['Sale', 'Refund', 'Adjustment']
  notes: String
  createdAt: DateTime
  orgId: String (FK)
}

Indexes:
- (employeeId, date)
- (orgId, date)
```

### 6. Performance Metrics Table
```
performanceMetrics {
  id: UUID (PK)
  employeeId: UUID (FK)
  date: DateTime (daily snapshot)
  callsCount: Integer
  connectedCalls: Integer
  leadsGenerated: Integer
  meetingsBooked: Integer
  dealsClosedCount: Integer
  revenueGenerated: Decimal
  performanceScore: Decimal (0-100)
  createdAt: DateTime
  orgId: String (FK)
}

Indexes:
- (employeeId, date)
- (orgId, date)
```

### 7. Call Recordings Table
```
callRecordings {
  id: UUID (PK)
  callId: UUID (FK)
  employeeId: UUID (FK)
  recordingUrl: String (S3/Cloud storage)
  duration: Integer (seconds)
  fileSize: Integer (bytes)
  transcription: Text (optional - AI generated)
  uploadedAt: DateTime
  expiresAt: DateTime (retention policy)
  orgId: String (FK)
}

Indexes:
- (callId)
- (employeeId, uploadedAt)
```

---

## 🎨 FRONTEND COMPONENT STRUCTURE

```
SalesDashboard/
├── layouts/
│   ├── SalesSidebar.tsx
│   └── SalesLayout.tsx
├── pages/
│   ├── SalesDashboard.tsx (Main)
│   ├── Leads.tsx
│   ├── Deals.tsx
│   ├── Calls.tsx
│   ├── FollowUps.tsx
│   ├── Tasks.tsx
│   ├── Employees.tsx
│   ├── Performance.tsx
│   ├── Revenue.tsx
│   ├── Reports.tsx
│   └── Settings.tsx
├── components/
│   ├── KPICards/
│   │   ├── KPICard.tsx
│   │   ├── TotalCallsCard.tsx
│   │   ├── ConnectedCallsCard.tsx
│   │   ├── InterestedLeadsCard.tsx
│   │   ├── MeetingsBookedCard.tsx
│   │   ├── DealsClosedCard.tsx
│   │   ├── RevenueCard.tsx
│   │   ├── TargetProgressCard.tsx
│   │   └── ConversionRateCard.tsx
│   ├── SalesFunnel/
│   │   ├── SalesFunnelChart.tsx
│   │   └── FunnelStage.tsx
│   ├── CallTracking/
│   │   ├── LiveCallPanel.tsx
│   │   ├── CallTable.tsx
│   │   ├── CallRecordingPlayer.tsx
│   │   └── CallOutcomeModal.tsx
│   ├── PerformanceBoard/
│   │   ├── EmployeeLeaderboard.tsx
│   │   ├── LeaderboardRow.tsx
│   │   └── PerformanceScore.tsx
│   ├── RevenuePanel/
│   │   ├── RevenueChart.tsx
│   │   ├── ProfitChart.tsx
│   │   └── RevenueMetrics.tsx
│   ├── TopPerformers/
│   │   ├── TopPerformerWidget.tsx
│   │   └── PerformerCard.tsx
│   ├── ActivityFeed/
│   │   ├── ActivityFeed.tsx
│   │   └── ActivityItem.tsx
│   ├── TaskAlerts/
│   │   ├── TaskAlertPanel.tsx
│   │   ├── FollowUpAlert.tsx
│   │   └── OverdueTaskAlert.tsx
│   └── Charts/
│       ├── LineChart.tsx
│       ├── BarChart.tsx
│       ├── PieChart.tsx
│       └── FunnelChart.tsx
└── hooks/
    ├── useSalesMetrics.ts
    ├── useCallTracking.ts
    ├── usePerformanceData.ts
    └── useRevenueData.ts
```

---

## 🔌 API ENDPOINTS

### Calls API
```
GET    /api/sales/calls                    - List all calls
POST   /api/sales/calls                    - Create call record
GET    /api/sales/calls/:id                - Get call details
PATCH  /api/sales/calls/:id                - Update call
DELETE /api/sales/calls/:id                - Delete call
GET    /api/sales/calls/today              - Today's calls
GET    /api/sales/calls/employee/:id       - Employee's calls
POST   /api/sales/calls/:id/recording      - Upload recording
GET    /api/sales/calls/:id/recording      - Get recording
POST   /api/sales/calls/:id/outcome        - Tag call outcome
```

### Leads API
```
GET    /api/sales/leads                    - List leads
POST   /api/sales/leads                    - Create lead
GET    /api/sales/leads/:id                - Get lead details
PATCH  /api/sales/leads/:id                - Update lead
DELETE /api/sales/leads/:id                - Delete lead
GET    /api/sales/leads/status/:status     - Filter by status
POST   /api/sales/leads/:id/assign         - Assign to employee
```

### Deals API
```
GET    /api/sales/deals                    - List deals
POST   /api/sales/deals                    - Create deal
GET    /api/sales/deals/:id                - Get deal details
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
GET    /api/sales/performance/employee/:id - Employee metrics
GET    /api/sales/performance/leaderboard  - Leaderboard
GET    /api/sales/performance/score/:id    - Performance score
```

### Revenue API
```
GET    /api/sales/revenue/today            - Today's revenue
GET    /api/sales/revenue/month            - Monthly revenue
GET    /api/sales/revenue/year             - Yearly revenue
GET    /api/sales/revenue/employee/:id     - Employee revenue
GET    /api/sales/revenue/vs-target        - Revenue vs target
```

### Tasks API
```
GET    /api/sales/tasks                    - List tasks
POST   /api/sales/tasks                    - Create task
GET    /api/sales/tasks/:id                - Get task details
PATCH  /api/sales/tasks/:id                - Update task
DELETE /api/sales/tasks/:id                - Delete task
GET    /api/sales/tasks/overdue            - Overdue tasks
GET    /api/sales/tasks/today              - Today's tasks
PATCH  /api/sales/tasks/:id/complete       - Mark complete
```

---

## 📊 PERFORMANCE SCORE CALCULATION

```javascript
// Formula: Score = Calls + (Leads × 5) + (Meetings × 10) + (Closures × 25)

function calculatePerformanceScore(metrics) {
  const {
    callsCount = 0,
    leadsGenerated = 0,
    meetingsBooked = 0,
    dealsClosedCount = 0
  } = metrics;

  const score = 
    callsCount + 
    (leadsGenerated * 5) + 
    (meetingsBooked * 10) + 
    (dealsClosedCount * 25);

  // Normalize to 0-100 scale
  // Assuming max daily score is ~500
  return Math.min((score / 500) * 100, 100);
}

// Performance Tiers
function getPerformanceTier(score) {
  if (score >= 80) return { tier: 'Excellent', color: '#10B981' };
  if (score >= 60) return { tier: 'Good', color: '#3B82F6' };
  if (score >= 40) return { tier: 'Average', color: '#F59E0B' };
  return { tier: 'Poor', color: '#EF4444' };
}
```

---

## 🔄 REAL-TIME UPDATES (Socket.IO)

```javascript
// Events to broadcast
socket.emit('call:created', callData);
socket.emit('call:updated', callData);
socket.emit('lead:created', leadData);
socket.emit('deal:closed', dealData);
socket.emit('revenue:updated', revenueData);
socket.emit('performance:updated', metricsData);
socket.emit('task:completed', taskData);
socket.emit('recording:uploaded', recordingData);
```

---

## 🎯 KEY FEATURES IMPLEMENTATION

### 1. KPI Cards with Trends
- Real-time data updates
- Mini sparkline charts
- Percentage change indicators
- Color-coded trends (green up, red down)

### 2. Sales Funnel Visualization
- Drag-and-drop stage management
- Drop-off rate calculation
- Conversion percentage at each stage
- Lead count per stage

### 3. Live Call Tracking
- Real-time call status
- Call duration tracking
- Recording upload and playback
- Call outcome tagging
- Next follow-up scheduling

### 4. Employee Leaderboard
- Ranked by performance score
- Color-coded performance tiers
- Weekly/Monthly/Yearly views
- Top performer badges

### 5. Revenue Dashboard
- Daily/Weekly/Monthly charts
- Revenue vs Target comparison
- Profit margin calculation
- Expense tracking

### 6. Automations
- Auto-reminder for follow-ups (24 hours before)
- Inactivity alerts (no calls in 2 hours)
- Hot lead notifications
- Daily top performer notification
- Overdue task alerts

---

## 🚀 IMPLEMENTATION PRIORITY

### Phase 1 (MVP - Week 1-2)
- [ ] Database schema setup
- [ ] Basic CRUD APIs
- [ ] KPI Cards display
- [ ] Sales Funnel chart
- [ ] Employee Leaderboard

### Phase 2 (Week 3-4)
- [ ] Call tracking system
- [ ] Call recording integration
- [ ] Performance metrics calculation
- [ ] Revenue dashboard
- [ ] Real-time Socket.IO updates

### Phase 3 (Week 5-6)
- [ ] Task management
- [ ] Follow-up automation
- [ ] Advanced reporting
- [ ] Mobile responsiveness
- [ ] Performance optimization

### Phase 4 (Week 7-8)
- [ ] AI-powered insights
- [ ] Predictive analytics
- [ ] Advanced automations
- [ ] Custom reports
- [ ] Export functionality

---

## 💾 SAMPLE DATA STRUCTURE

```javascript
// Sample Call Record
{
  id: "call_001",
  employeeId: "emp_001",
  leadId: "lead_001",
  callDate: "2026-05-04T10:30:00Z",
  duration: 1200, // seconds
  callType: "Outbound",
  status: "Connected",
  outcome: "Hot",
  notes: "Interested in enterprise plan",
  nextFollowUpDate: "2026-05-06T10:00:00Z",
  recordingUrl: "s3://recordings/call_001.mp3"
}

// Sample Performance Metrics
{
  employeeId: "emp_001",
  date: "2026-05-04",
  callsCount: 15,
  connectedCalls: 12,
  leadsGenerated: 3,
  meetingsBooked: 2,
  dealsClosedCount: 1,
  revenueGenerated: 5000,
  performanceScore: 85
}
```

---

## 🎨 DESIGN TOKENS

```javascript
// Colors
const colors = {
  primary: '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#06B6D4',
  dark: '#1F2937',
  light: '#F9FAFB'
};

// Performance Tiers
const performanceTiers = {
  excellent: { color: '#10B981', label: '🥇 Excellent' },
  good: { color: '#3B82F6', label: '✅ Good' },
  average: { color: '#F59E0B', label: '⚠️ Average' },
  poor: { color: '#EF4444', label: '❌ Poor' }
};

// Call Outcomes
const callOutcomes = {
  hot: { color: '#EF4444', label: '🔥 Hot' },
  warm: { color: '#F59E0B', label: '🌡️ Warm' },
  cold: { color: '#3B82F6', label: '❄️ Cold' },
  notInterested: { color: '#6B7280', label: '❌ Not Interested' }
};
```

---

## 📱 RESPONSIVE BREAKPOINTS

```
Mobile:    < 640px
Tablet:    640px - 1024px
Desktop:   > 1024px
```

---

## ⚡ PERFORMANCE OPTIMIZATION

- Lazy load charts
- Virtualize long lists
- Cache API responses
- Debounce real-time updates
- Optimize images
- Code splitting by route
- Service worker for offline support

---

## 🔐 SECURITY CONSIDERATIONS

- Role-based access control (RBAC)
- Encrypt call recordings
- Audit logs for all actions
- Rate limiting on APIs
- Data retention policies
- GDPR compliance for recordings

---

## 📈 METRICS TO TRACK

- Page load time
- API response time
- Real-time update latency
- User engagement
- Feature adoption
- Error rates
- Conversion rates

