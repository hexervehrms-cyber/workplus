import mongoose from "mongoose";

const currencyPreferenceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    currencyCode: { type: String, default: "USD" },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export default mongoose.model("CurrencyPreference", currencyPreferenceSchema);
