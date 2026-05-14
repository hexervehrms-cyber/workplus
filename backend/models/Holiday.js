import mongoose from "mongoose";

const holidaySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    date: { type: Date, required: true, index: true },
    type: { 
      type: String, 
      enum: ["public", "optional", "restricted"], 
      default: "public",
      index: true
    },
    description: { type: String },
    isRecurring: { type: Boolean, default: false },
    orgId: { type: String, required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
holidaySchema.index({ orgId: 1, date: 1 });
holidaySchema.index({ orgId: 1, type: 1, date: 1 });

export default mongoose.model("Holiday", holidaySchema);
