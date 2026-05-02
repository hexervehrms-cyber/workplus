import mongoose from "mongoose";

const reminderSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    documentId: { type: String, required: true },
    employeeId: { type: String },
    organizationId: { type: String, required: true },
    sentAt: { type: Date, default: Date.now },
    method: { type: String, enum: ["email", "sms", "push"], default: "email" },
    status: { type: String, enum: ["sent", "delivered", "failed"], default: "sent" },
    message: { type: String }
  },
  { timestamps: true }
);

export default mongoose.model("Reminder", reminderSchema);
