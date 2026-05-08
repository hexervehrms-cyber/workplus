import mongoose from "mongoose";

const leaveTypeSettingsSchema = new mongoose.Schema(
  {
    orgId: { type: String, required: true, unique: true, index: true },
    enabledLeaveTypes: {
      vacation: { type: Boolean, default: true },
      sickLeave: { type: Boolean, default: true },
      casualLeave: { type: Boolean, default: true },
      earnedLeave: { type: Boolean, default: true },
      medicalLeave: { type: Boolean, default: true },
      maternityLeave: { type: Boolean, default: false },
      paternityLeave: { type: Boolean, default: false },
      compensatoryOff: { type: Boolean, default: true },
      personal: { type: Boolean, default: false },
      emergency: { type: Boolean, default: false },
      ncns: { type: Boolean, default: false },
      sandwichLeave: { type: Boolean, default: false }
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedAt: { type: Date, default: Date.now }
  },
  { 
    timestamps: true
  }
);

export default mongoose.model("LeaveTypeSettings", leaveTypeSettingsSchema);
