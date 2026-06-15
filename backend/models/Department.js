import mongoose from "mongoose";

const departmentSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: [true, 'Department name is required'],
      trim: true,
      maxlength: [100, 'Department name cannot exceed 100 characters']
    },
    code: { 
      type: String, 
      required: true,
      uppercase: true,
      trim: true
    },
    description: { 
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters']
    },
    managerId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Employee",
      index: true
    },
    orgId: { 
      type: String,
      required: true,
      index: true
    },
    /** Display name of department head (optional) */
    headName: {
      type: String,
      trim: true,
      default: '',
    },
    budget: {
      annual: { type: Number, default: 0 },
      currency: { type: String, default: "INR" }
    },
    location: {
      building: String,
      floor: String,
      office: String
    },
    isActive: { 
      type: Boolean, 
      default: true 
    },
    createdBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User",
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Compound indexes for performance
departmentSchema.index({ orgId: 1, isActive: 1 });
departmentSchema.index({ orgId: 1, code: 1 }, { unique: true });
departmentSchema.index({ managerId: 1 });
departmentSchema.index({ createdAt: -1 });

// Virtual for employee count
departmentSchema.virtual('employeeCount', {
  ref: 'Employee',
  localField: '_id',
  foreignField: 'departmentId',
  count: true,
  match: { status: 'active' }
});

// Virtual for manager details
departmentSchema.virtual('manager', {
  ref: 'Employee',
  localField: 'managerId',
  foreignField: '_id',
  justOne: true
});

// Static method to find by organization
departmentSchema.statics.findByOrganization = function(orgId) {
  return this.find({ orgId, isActive: true })
    .populate('manager', 'userId employeeCode')
    .populate({
      path: 'manager.userId',
      select: 'name email'
    })
    .lean();
};

// Method to get department statistics
departmentSchema.methods.getStats = async function() {
  const Employee = mongoose.model('Employee');
  const stats = await Employee.aggregate([
    { $match: { departmentId: this._id, status: 'active' } },
    {
      $group: {
        _id: null,
        totalEmployees: { $sum: 1 },
        avgSalary: { $avg: '$baseSalary' },
        totalSalaryBudget: { $sum: '$baseSalary' }
      }
    }
  ]);
  
  return stats[0] || {
    totalEmployees: 0,
    avgSalary: 0,
    totalSalaryBudget: 0
  };
};

const Department = mongoose.model("Department", departmentSchema);

export default Department;