import mongoose from "mongoose";

const documentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    orgId: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ["general", "experience_letter", "offer_letter", "relieving_letter", "appraisal_letter", "salary_slips", "bank_statement", "education_10th_certificate", "education_10th_marksheet", "education_12th_certificate", "education_12th_marksheet", "education_graduation_certificate", "education_graduation_marksheet", "education_post_graduation_certificate", "education_post_graduation_marksheet", "education_diploma_certificate", "education_diploma_marksheet", "education_certificate_certificate", "education_certificate_marksheet", "education_drop_out_certificate", "education_drop_out_marksheet"],
      default: "general"
    },
    fileName: {
      type: String,
      required: true
    },
    filePath: {
      type: String,
      required: true
    },
    size: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ["Pending", "Verified", "Rejected", "uploaded"],
      default: "Pending"
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

export default mongoose.model("Document", documentSchema);
