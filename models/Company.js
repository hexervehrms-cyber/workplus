import mongoose from 'mongoose';

const companySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
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
  isActive: {
    type: Boolean,
    default: true
  },
  settings: {
    domain: {
      type: String,
      required: true
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    currency: {
      type: String,
      default: 'USD'
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

// Add tenantId field to all existing schemas
companySchema.add({ tenantId: { type: String, required: true, index: true } });

export default mongoose.model('Company', companySchema);
