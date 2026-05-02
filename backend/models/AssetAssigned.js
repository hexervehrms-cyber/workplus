import mongoose from "mongoose";

const assetAssignedSchema = new mongoose.Schema(
  {
    assetId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      default: () => `AST-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`
    },
    assetTag: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      index: true
    },
    assetName: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    assetType: {
      type: String,
      required: true,
      enum: [
        'laptop', 'desktop', 'monitor', 'keyboard', 'mouse', 'headset',
        'mobile_phone', 'tablet', 'printer', 'scanner', 'projector',
        'camera', 'software_license', 'access_card', 'vehicle',
        'furniture', 'equipment', 'other'
      ],
      index: true
    },
    category: {
      type: String,
      required: true,
      enum: ['IT_Equipment', 'Office_Furniture', 'Vehicle', 'Software', 'Security', 'Other'],
      index: true
    },
    // Asset Details
    specifications: {
      brand: { type: String },
      model: { type: String },
      serialNumber: { type: String, unique: true, sparse: true },
      processor: { type: String },
      memory: { type: String },
      storage: { type: String },
      operatingSystem: { type: String },
      warranty: {
        provider: { type: String },
        startDate: { type: Date },
        endDate: { type: Date },
        type: { type: String, enum: ['manufacturer', 'extended', 'third_party'] }
      },
      customFields: [{
        fieldName: { type: String },
        fieldValue: { type: String }
      }]
    },
    // Financial Information
    financial: {
      purchasePrice: { type: Number, min: 0 },
      currentValue: { type: Number, min: 0 },
      depreciationRate: { type: Number, min: 0, max: 100 },
      purchaseDate: { type: Date, index: true },
      vendor: { type: String },
      invoiceNumber: { type: String },
      leaseInfo: {
        isLeased: { type: Boolean, default: false },
        leaseProvider: { type: String },
        monthlyRate: { type: Number },
        leaseStartDate: { type: Date },
        leaseEndDate: { type: Date }
      }
    },
    // Assignment Information
    assignment: {
      assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employee",
        index: true
      },
      assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
      },
      assignmentDate: {
        type: Date,
        default: Date.now,
        index: true
      },
      expectedReturnDate: { type: Date },
      actualReturnDate: { type: Date },
      assignmentReason: {
        type: String,
        enum: ['new_hire', 'replacement', 'upgrade', 'temporary', 'project_based'],
        default: 'new_hire'
      },
      location: {
        office: { type: String },
        floor: { type: String },
        desk: { type: String },
        building: { type: String }
      }
    },
    // Asset Status
    status: {
      type: String,
      enum: ['available', 'assigned', 'in_use', 'maintenance', 'repair', 'retired', 'lost', 'stolen'],
      default: 'available',
      index: true
    },
    condition: {
      type: String,
      enum: ['excellent', 'good', 'fair', 'poor', 'damaged'],
      default: 'excellent',
      index: true
    },
    // Maintenance & Service
    maintenance: {
      lastServiceDate: { type: Date },
      nextServiceDate: { type: Date, index: true },
      serviceProvider: { type: String },
      maintenanceSchedule: {
        type: String,
        enum: ['monthly', 'quarterly', 'semi_annual', 'annual', 'as_needed']
      },
      serviceHistory: [{
        serviceDate: { type: Date },
        serviceType: {
          type: String,
          enum: ['routine', 'repair', 'upgrade', 'inspection', 'calibration']
        },
        description: { type: String },
        cost: { type: Number },
        serviceProvider: { type: String },
        performedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User"
        }
      }]
    },
    // Compliance & Security
    compliance: {
      requiresCompliance: { type: Boolean, default: false },
      complianceType: [{ type: String }], // e.g., ['GDPR', 'HIPAA', 'SOX']
      lastAuditDate: { type: Date },
      nextAuditDate: { type: Date },
      securityLevel: {
        type: String,
        enum: ['public', 'internal', 'confidential', 'restricted'],
        default: 'internal'
      },
      encryptionRequired: { type: Boolean, default: false },
      accessRestrictions: [{ type: String }]
    },
    // Assignment History
    assignmentHistory: [{
      assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employee"
      },
      assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      assignmentDate: { type: Date },
      returnDate: { type: Date },
      reason: { type: String },
      condition: {
        assigned: { type: String },
        returned: { type: String }
      },
      notes: { type: String }
    }],
    // Documents & Attachments
    documents: [{
      documentType: {
        type: String,
        enum: ['invoice', 'warranty', 'manual', 'certificate', 'photo', 'other']
      },
      fileName: { type: String },
      filePath: { type: String },
      uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      uploadedAt: { type: Date, default: Date.now }
    }],
    // Organization context
    orgId: {
      type: String,
      required: true,
      index: true
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      index: true
    },
    // Notifications & Alerts
    alerts: {
      warrantyExpiring: { type: Boolean, default: false },
      maintenanceDue: { type: Boolean, default: false },
      returnOverdue: { type: Boolean, default: false },
      complianceAuditDue: { type: Boolean, default: false }
    },
    // Custom fields for organization-specific needs
    customData: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    // Soft delete
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    retiredDate: { type: Date },
    retiredReason: { type: String }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Compound indexes for performance
assetAssignedSchema.index({ orgId: 1, status: 1 });
assetAssignedSchema.index({ 'assignment.assignedTo': 1, status: 1 });
assetAssignedSchema.index({ assetType: 1, category: 1 });
assetAssignedSchema.index({ 'financial.purchaseDate': -1 });
assetAssignedSchema.index({ 'maintenance.nextServiceDate': 1 });
assetAssignedSchema.index({ 'specifications.warranty.endDate': 1 });
assetAssignedSchema.index({ departmentId: 1, status: 1 });

// Virtual for assigned employee details
assetAssignedSchema.virtual('assignedEmployee', {
  ref: 'Employee',
  localField: 'assignment.assignedTo',
  foreignField: '_id',
  justOne: true
});

// Virtual for department details
assetAssignedSchema.virtual('department', {
  ref: 'Department',
  localField: 'departmentId',
  foreignField: '_id',
  justOne: true
});

// Virtual for current value calculation
assetAssignedSchema.virtual('calculatedCurrentValue').get(function() {
  if (!this.financial.purchasePrice || !this.financial.depreciationRate) {
    return this.financial.currentValue || this.financial.purchasePrice || 0;
  }
  
  const purchaseDate = this.financial.purchaseDate || this.createdAt;
  const yearsOld = (Date.now() - purchaseDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  const depreciation = this.financial.purchasePrice * (this.financial.depreciationRate / 100) * yearsOld;
  
  return Math.max(0, this.financial.purchasePrice - depreciation);
});

// Method to assign asset to employee
assetAssignedSchema.methods.assignTo = function(employeeId, assignedBy, reason = 'assignment') {
  // Add to history if currently assigned
  if (this.assignment.assignedTo) {
    this.assignmentHistory.push({
      assignedTo: this.assignment.assignedTo,
      assignedBy: this.assignment.assignedBy,
      assignmentDate: this.assignment.assignmentDate,
      returnDate: new Date(),
      reason: 'returned',
      condition: {
        assigned: 'good', // Would be tracked separately
        returned: this.condition
      }
    });
  }
  
  // Update current assignment
  this.assignment = {
    assignedTo: employeeId,
    assignedBy: assignedBy,
    assignmentDate: new Date(),
    assignmentReason: reason
  };
  
  this.status = 'assigned';
  return this.save();
};

// Method to return asset
assetAssignedSchema.methods.returnAsset = function(returnedBy, condition, notes) {
  if (this.assignment.assignedTo) {
    // Add to history
    this.assignmentHistory.push({
      assignedTo: this.assignment.assignedTo,
      assignedBy: this.assignment.assignedBy,
      assignmentDate: this.assignment.assignmentDate,
      returnDate: new Date(),
      reason: 'returned',
      condition: {
        assigned: 'good', // Would be tracked from assignment
        returned: condition
      },
      notes: notes
    });
    
    // Clear current assignment
    this.assignment.assignedTo = null;
    this.assignment.actualReturnDate = new Date();
  }
  
  this.condition = condition;
  this.status = 'available';
  return this.save();
};

// Method to add service record
assetAssignedSchema.methods.addServiceRecord = function(serviceData) {
  this.maintenance.serviceHistory.push({
    ...serviceData,
    serviceDate: serviceData.serviceDate || new Date()
  });
  
  this.maintenance.lastServiceDate = serviceData.serviceDate || new Date();
  
  // Calculate next service date based on schedule
  if (this.maintenance.maintenanceSchedule) {
    const scheduleMonths = {
      'monthly': 1,
      'quarterly': 3,
      'semi_annual': 6,
      'annual': 12
    };
    
    const months = scheduleMonths[this.maintenance.maintenanceSchedule] || 12;
    this.maintenance.nextServiceDate = new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000);
  }
  
  return this.save();
};

// Static method to find assets by employee
assetAssignedSchema.statics.findByEmployee = function(employeeId) {
  return this.find({
    'assignment.assignedTo': employeeId,
    status: { $in: ['assigned', 'in_use'] },
    isActive: true
  })
  .populate('assignedEmployee', 'userId designation department')
  .lean();
};

// Static method to find assets needing maintenance
assetAssignedSchema.statics.findMaintenanceDue = function(orgId, daysAhead = 30) {
  const futureDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  
  return this.find({
    orgId,
    'maintenance.nextServiceDate': { $lte: futureDate },
    status: { $ne: 'retired' },
    isActive: true
  })
  .populate('assignedEmployee', 'userId designation')
  .sort({ 'maintenance.nextServiceDate': 1 })
  .lean();
};

// Static method to find expiring warranties
assetAssignedSchema.statics.findExpiringWarranties = function(orgId, daysAhead = 60) {
  const futureDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  
  return this.find({
    orgId,
    'specifications.warranty.endDate': { $lte: futureDate, $gte: new Date() },
    status: { $ne: 'retired' },
    isActive: true
  })
  .populate('assignedEmployee', 'userId designation')
  .sort({ 'specifications.warranty.endDate': 1 })
  .lean();
};

const AssetAssigned = mongoose.model("AssetAssigned", assetAssignedSchema);

export default AssetAssigned;