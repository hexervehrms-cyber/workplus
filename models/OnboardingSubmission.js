import mongoose from "mongoose";

const onboardingSubmissionSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true },
    employeeName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String },
    personalInfo: {
      firstName: { type: String },
      lastName: { type: String },
      dateOfBirth: { type: Date },
      gender: { type: String },
      address: { type: String }
    },
    officialInfo: {
      employeeId: { type: String },
      joiningDate: { type: Date },
      department: { type: String },
      designation: { type: String },
      employmentType: { type: String },
      workLocation: { type: String }
    },
    sensitiveInfo: {
      aadharNumber: { type: String },
      panNumber: { type: String },
      bankAccount: { type: String },
      ifscCode: { type: String }
    },
    emergencyContact: {
      name: { type: String },
      relation: { type: String },
      phone: { type: String }
    },
    documents: [{
      name: { type: String },
      type: { type: String },
      url: { type: String }
    }],
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    submittedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ["pending", "verified", "rejected"], default: "pending" }
  },
  { timestamps: true }
);

export default mongoose.model("OnboardingSubmission", onboardingSubmissionSchema);
