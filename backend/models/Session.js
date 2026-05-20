import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    orgId: { type: String, required: true, index: true },
    socketId: { type: String, default: null },
    /** All live Socket.IO connection ids for this user (multi-tab). */
    socketIds: { type: [String], default: [] },
    userAgent: { type: String },
    ipAddress: { type: String },
    role: { type: String },
    loginTime: { type: Date, default: Date.now, index: true },
    lastActivityTime: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true, index: true }
  },
  { 
    timestamps: true
  }
);

// Index for finding active sessions
sessionSchema.index({ orgId: 1, isActive: 1, loginTime: -1 });
sessionSchema.index({ userId: 1, isActive: 1 });

// TTL index to auto-delete sessions after 24 hours of inactivity
sessionSchema.index({ lastActivityTime: 1 }, { expireAfterSeconds: 86400 });

export default mongoose.model("Session", sessionSchema);
