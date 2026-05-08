import mongoose from 'mongoose';

const payrollCalculationSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  orgId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },

  // Salary Details
  salaryType: {
    type: String,
    enum: ['salary', 'stipend', 'commission', 'bonus', 'mixed'],
    default: 'salary'
  },
  baseSalary: {
    type: Number,
    required: true
  },
  perDaySalary: {
    type: Number,
    required: true
  },

  // Date Range
  fromDate: {
    type: Date,
    required: true
  },
  toDate: {
    type: Date,
    required: true
  },

  // Working Days Calculation
  totalDays: {
    type: Number,
    default: 0
  },
  weekOffs: {
    type: Number,
    default: 0
  },
  holidays: {
    type: Number,
    default: 0
  },
  leaves: {
    type: Number,
    default: 0
  },
  sandwichLeaves: {
    type: Number,
    default: 0
  },
  workingDays: {
    type: Number,
    default: 0
  },
  presentDays: {
    type: Number,
    default: 0
  },

  // Salary Components
  components: {
    basic: { type: Number, default: 0 },
    hra: { type: Number, default: 0 },
    dearness: { type: Number, default: 0 },
    conveyance: { type: Number, default: 0 },
    medical: { type: Number, default: 0 },
    other: { type: Number, default: 0 }
  },

  // Deductions
  deductions: {
    pf: { type: Number, default: 0 },
    esi: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    advance: { type: Number, default: 0 },
    loan: { type: Number, default: 0 },
    bond: { type: Number, default: 0 },
    other: { type: Number, default: 0 }
  },

  // Earnings
  earnings: {
    grossSalary: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 },
    incentive: { type: Number, default: 0 },
    commission: { type: Number, default: 0 },
    other: { type: Number, default: 0 }
  },

  // Calculations
  totalEarnings: {
    type: Number,
    default: 0
  },
  totalDeductions: {
    type: Number,
    default: 0
  },
  netSalary: {
    type: Number,
    default: 0
  },

  // Salary Cycle
  salaryCycleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SalaryCycle'
  },
  salaryCycleName: String,
  cycleStartDate: Date,
  cycleEndDate: Date,
  paymentDate: Date,

  // Status
  status: {
    type: String,
    enum: ['draft', 'calculated', 'approved', 'paid', 'cancelled'],
    default: 'draft'
  },

  // Notes
  notes: String,
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedDate: Date,
  paidDate: Date,

  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('PayrollCalculation', payrollCalculationSchema);
