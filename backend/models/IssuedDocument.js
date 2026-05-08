import mongoose from "mongoose";

const issuedDocumentSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String },
    category: { type: String, required: true },
    targetEmployeeId: { type: String, required: true },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    issuedByName: { type: String },
    acknowledgmentRequired: { type: Boolean, default: false },
    acknowledgedAt: { type: Date },
    acknowledgedBy: { type: String },
    notes: { type: String },
    fileUrl: { type: String },
    fileName: { type: String },
    fileSize: { type: String },
    fileType: { type: String },
    status: { 
      type: String, 
      enum: ["pending", "acknowledged", "expired"], 
      default: "pending" 
    },
    organizationId: { type: String, required: true }
  },
  { timestamps: true }
);

// Index for efficient queries
issuedDocumentSchema.index({ targetEmployeeId: 1, createdAt: -1 });
issuedDocumentSchema.index({ issuedBy: 1, createdAt: -1 });
issuedDocumentSchema.index({ organizationId: 1, createdAt: -1 });

export default mongoose.model("IssuedDocument", issuedDocumentSchema);