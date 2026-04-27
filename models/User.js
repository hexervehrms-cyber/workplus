import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: { 
      type: String, 
      unique: true, 
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email']
    },
    password: { 
      type: String, 
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false // Don't include password in queries by default
    },
    role: {
      type: String,
      enum: ["super_admin", "admin", "employee"],
      default: "employee",
      required: true
    },
    isActive: { 
      type: Boolean, 
      default: true 
    },
    avatar: { 
      type: String,
      default: null
    },
    organization: { 
      type: String,
      default: 'WorkPlus Inc.'
    },
    orgId: { 
      type: String,
      index: true // Index for tenant queries
    },
    lastLogin: {
      type: Date,
      default: null
    },
    loginAttempts: {
      type: Number,
      default: 0
    },
    lockUntil: {
      type: Date,
      default: null
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Compound indexes for common queries
userSchema.index({ email: 1, isActive: 1 });
userSchema.index({ orgId: 1, role: 1 });
userSchema.index({ createdAt: -1 });

// Virtual for employee profile
userSchema.virtual('employeeProfile', {
  ref: 'Employee',
  localField: '_id',
  foreignField: 'userId',
  justOne: true
});

// Method to check if account is locked
userSchema.methods.isLocked = function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Static method to find by credentials
userSchema.statics.findByCredentials = async function(email, password) {
  const user = await this.findOne({ email: email.toLowerCase() }).select('+password');
  
  if (!user) {
    return null;
  }
  
  const isMatch = await bcrypt.compare(password, user.password);
  
  if (!isMatch) {
    return null;
  }
  
  return user;
};

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  // Password will be hashed in the controller
  next();
});

const User = mongoose.model("User", userSchema);

export default User;
