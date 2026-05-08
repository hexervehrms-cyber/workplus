import mongoose from "mongoose";

const leaveAllocationSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    orgId: { type: String, required: true, index: true },
    year: { type: Number, required: true },
    month: { type: Number, required: true }, // 1-12
    
    // Leave allocations for this month
    allocations: {
      vacation: { type: Number, default: 0 },
      sickLeave: { type: Number, default: 0 },
      casualLeave: { type: Number, default: 0 },
      earnedLeave: { type: Number, default: 0 },
      medicalLeave: { type: Number, default: 0 },
      maternityLeave: { type: Number, default: 0 },
      paternityLeave: { type: Number, default: 0 },
      compensatoryOff: { type: Number, default: 0 },
      personal: { type: Number, default: 0 },
      emergency: { type: Number, default: 0 },
      ncns: { type: Number, default: 0 },
      sandwichLeave: { type: Number, default: 0 }
    },

    // Used leaves (deducted when leave is approved)
    used: {
      vacation: { type: Number, default: 0 },
      sickLeave: { type: Number, default: 0 },
      casualLeave: { type: Number, default: 0 },
      earnedLeave: { type: Number, default: 0 },
      medicalLeave: { type: Number, default: 0 },
      maternityLeave: { type: Number, default: 0 },
      paternityLeave: { type: Number, default: 0 },
      compensatoryOff: { type: Number, default: 0 },
      personal: { type: Number, default: 0 },
      emergency: { type: Number, default: 0 },
      ncns: { type: Number, default: 0 },
      sandwichLeave: { type: Number, default: 0 }
    },

    // Pending leaves (deducted when leave is requested)
    pending: {
      vacation: { type: Number, default: 0 },
      sickLeave: { type: Number, default: 0 },
      casualLeave: { type: Number, default: 0 },
      earnedLeave: { type: Number, default: 0 },
      medicalLeave: { type: Number, default: 0 },
      maternityLeave: { type: Number, default: 0 },
      paternityLeave: { type: Number, default: 0 },
      compensatoryOff: { type: Number, default: 0 },
      personal: { type: Number, default: 0 },
      emergency: { type: Number, default: 0 },
      ncns: { type: Number, default: 0 },
      sandwichLeave: { type: Number, default: 0 }
    },

    // Carried forward from previous month
    carriedForward: {
      vacation: { type: Number, default: 0 },
      sickLeave: { type: Number, default: 0 },
      casualLeave: { type: Number, default: 0 },
      earnedLeave: { type: Number, default: 0 },
      medicalLeave: { type: Number, default: 0 },
      maternityLeave: { type: Number, default: 0 },
      paternityLeave: { type: Number, default: 0 },
      compensatoryOff: { type: Number, default: 0 },
      personal: { type: Number, default: 0 },
      emergency: { type: Number, default: 0 },
      ncns: { type: Number, default: 0 },
      sandwichLeave: { type: Number, default: 0 }
    },

    // Yearly allocations (auto-allocated at the start of the year)
    yearlyAllocations: {
      casualLeave: { type: Number, default: 0 },
      earnedLeave: { type: Number, default: 0 },
      medicalLeave: { type: Number, default: 0 }
    },

    // Notes
    notes: { type: String },
    
    // Allocation status
    status: { 
      type: String, 
      enum: ["draft", "allocated", "locked"],
      default: "draft"
    },

    // Allocated by admin
    allocatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    allocatedDate: { type: Date }
  },
  { 
    timestamps: true,
    optimisticConcurrency: true
  }
);

// Compound indexes for common queries
leaveAllocationSchema.index({ employeeId: 1, year: 1, month: 1 }, { unique: true });
leaveAllocationSchema.index({ orgId: 1, year: 1, month: 1 });
leaveAllocationSchema.index({ userId: 1, year: 1, month: 1 });
leaveAllocationSchema.index({ orgId: 1, status: 1 });

export default mongoose.model("LeaveAllocation", leaveAllocationSchema);
