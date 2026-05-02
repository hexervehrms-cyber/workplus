import mongoose from "mongoose";

const holidaySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    date: { type: Date, required: true },
    type: { 
      type: String, 
      enum: ["public", "optional", "restricted"], 
      default: "public" 
    },
    description: { type: String },
    isRecurring: { type: Boolean, default: false },
    organizationId: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

export default mongoose.model("Holiday", holidaySchema);
