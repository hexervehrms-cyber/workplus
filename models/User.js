import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["super_admin", "admin", "employee"],
      default: "employee",
      required: true
    },
    isActive: { type: Boolean, default: true },
    avatar: { type: String },
    organization: { type: String },
    orgId: { type: String }
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
