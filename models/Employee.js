import mongoose from "mongoose";

const employeeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    employeeCode: { type: String, unique: true },
    designation: { type: String },
    department: { type: String },
    baseSalary: { type: Number, default: 0 },
    hra: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 },
    incentives: { type: Number, default: 0 },
    allowances: { type: Number, default: 0 },
    providentFund: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    insurance: { type: Number, default: 0 },
    otherDeductions: { type: Number, default: 0 },
    joiningDate: { type: Date },
    phone: { type: String },
    address: { type: String },
    status: { type: String, enum: ["active", "inactive", "terminated"], default: "active" }
  },
  { timestamps: true }
);

export default mongoose.model("Employee", employeeSchema);
