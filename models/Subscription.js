import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
  tenantId: {
    type: String,
    required: true,
    index: true
  },
  plan: {
    type: String,
    enum: ['free', 'pro', 'enterprise'],
    default: 'free'
  },
  maxUsers: {
    type: Number,
    default: 10
  },
  expiryDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled'],
    default: 'active'
  },
  features: {
    biometric: {
      type: Boolean,
      default: false
    },
    attendance: {
      type: Boolean,
      default: true
    },
    leaveManagement: {
      type: Boolean,
      default: true
    },
    expenseManagement: {
      type: Boolean,
      default: true
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

export default mongoose.model('Subscription', subscriptionSchema);
