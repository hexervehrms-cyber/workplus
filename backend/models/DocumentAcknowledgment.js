import mongoose from "mongoose";

const documentAcknowledgmentSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    documentId: { type: String, required: true },
    documentName: { type: String },
    employeeId: { type: String, required: true },
    employeeName: { type: String },
    organizationId: { type: String, required: true },
    status: { type: String, enum: ["Pending", "Completed", "Overdue", "Forced"], default: "Pending" },
    acknowledgedAt: { type: Date },
    acknowledgmentMethod: { type: String, enum: ["digital", "manual", "forced"], default: "digital" },
    acknowledgmentDocumentId: { type: String },
    ipAddress: { type: String },
    deviceInfo: { type: String },
    forcedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    forcedReason: { type: String },
    reminderCount: { type: Number, default: 0 },
    lastRemindedAt: { type: Date }
  },
  { timestamps: true }
);

export default mongoose.model("DocumentAcknowledgment", documentAcknowledgmentSchema);
