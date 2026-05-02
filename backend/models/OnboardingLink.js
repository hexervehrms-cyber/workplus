import mongoose from "mongoose";

const onboardingLinkSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true },
    employeeEmail: { type: String, required: true },
    employeeName: { type: String, required: true },
    department: { type: String, default: "General" },
    organizationName: { type: String, default: "Default Organization" },
    organizationId: { type: String, default: "ORG-DEFAULT" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    expiresAt: { type: Date },
    isUsed: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export default mongoose.model("OnboardingLink", onboardingLinkSchema);
