import mongoose from "mongoose";

const generatedDocumentSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    documentType: { type: String, required: true },
    employeeId: { type: String, required: true },
    employeeName: { type: String },
    organizationId: { type: String },
    organizationName: { type: String },
    templateId: { type: String },
    content: { type: String },
    status: { type: String, enum: ["generated", "downloaded", "sent"], default: "generated" },
    fileUrl: { type: String },
    fileName: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    downloadedAt: { type: Date },
    downloadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

export default mongoose.model("GeneratedDocument", generatedDocumentSchema);
