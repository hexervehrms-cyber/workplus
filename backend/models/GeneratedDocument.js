import mongoose from "mongoose";

const generatedDocumentSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String },
    documentType: { type: String, required: true },
    category: { type: String },
    content: { type: String, required: true },
    employeeId: { type: String },
    employeeName: { type: String },
    organizationId: { type: String, required: true },
    organizationName: { type: String },
    templateId: { type: String },
    status: { type: String, enum: ["generated", "downloaded", "sent", "acknowledged"], default: "generated" },
    fileUrl: { type: String },
    fileName: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", sparse: true },
    assignTo: { type: String, enum: ["all", "specific"], default: "all" },
    targetUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    requiresAcknowledgment: { type: Boolean, default: true },
    downloadedAt: { type: Date },
    downloadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    acknowledgedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    acknowledgedAt: { type: Date }
  },
  { timestamps: true }
);

export default mongoose.model("GeneratedDocument", generatedDocumentSchema);
