/**
 * DocumentAcknowledgment Model
 * Tracks employee acknowledgments of company documents
 */

import mongoose from 'mongoose';

const documentAcknowledgmentSchema = new mongoose.Schema({
  documentId: {
    type: String,
    required: true,
    index: true
  },
  employeeId: {
    type: String,
    required: true,
    index: true
  },
  employeeName: {
    type: String,
    required: true
  },
  organizationId: {
    type: String,
    required: true,
    index: true
  },
  acknowledgedAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  ipAddress: {
    type: String
  },
  accepted: {
    type: Boolean,
    required: true,
    default: true
  },
  status: {
    type: String,
    enum: ['Completed', 'Pending', 'Rejected'],
    default: 'Completed'
  },
  signature: {
    type: String
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
documentAcknowledgmentSchema.index({ documentId: 1, employeeId: 1 }, { unique: true });
documentAcknowledgmentSchema.index({ organizationId: 1, employeeId: 1 });

const DocumentAcknowledgment = mongoose.model('DocumentAcknowledgment', documentAcknowledgmentSchema);

export default DocumentAcknowledgment;
