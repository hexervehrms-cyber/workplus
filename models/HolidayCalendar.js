import mongoose from "mongoose";

const holidayCalendarSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    year: { type: Number, required: true },
    organizationId: { type: String, required: true },
    holidays: [{
      holidayId: { type: String },
      name: { type: String },
      date: { type: Date },
      type: { type: String },
      description: { type: String }
    }],
    isPublished: { type: Boolean, default: false },
    publishedAt: { type: Date },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

export default mongoose.model("HolidayCalendar", holidayCalendarSchema);
