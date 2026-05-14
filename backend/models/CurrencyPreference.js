import mongoose from "mongoose";

const currencyPreferenceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    orgId: { type: String, index: true },
    currencyCode: { type: String, default: "INR", enum: ["INR", "USD", "EUR", "GBP", "AUD", "CAD", "SGD"] },
    currencySymbol: { type: String, default: "₹" },
    decimalPlaces: { type: Number, default: 2 },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

// Index for org-level currency queries
currencyPreferenceSchema.index({ orgId: 1 });

export default mongoose.model("CurrencyPreference", currencyPreferenceSchema);
