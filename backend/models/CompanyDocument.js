import mongoose from "mongoose";

const companyDocumentSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    type: { type: String, required: true },
    category: { type: String },
    description: { type: String },
    fileUrl: { type: String },
    fileName: { type: String },
    fileSize: { type: String },
    fileType: { type: String },
    assignTo: { type: String, enum: ["all", "specific"], default: "all" },
    targetUsers: [{ type: String }],
    targetDepartments: [{ type: String }],
    isPublic: { type: Boolean, default: false },
    requiresAcknowledgment: { type: Boolean, default: false },
    acknowledgmentDeadline: { type: Date },
    organizationId: { type: String, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    uploadedByName: { type: String },
    status: { type: String, enum: ["active", "inactive", "archived"], default: "active" },
    version: { type: Number, default: 1 }
  },
  { timestamps: true }
);

export default mongoose.model("CompanyDocument", companyDocumentSchema);
