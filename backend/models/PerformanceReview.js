import mongoose from "mongoose";

const performanceReviewSchema = new mongoose.Schema(
  {
    reviewId: {
      type: String,
      required: true,
      unique: true,
      default: () => `PR-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true
    },
    reviewerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    reviewPeriod: {
      startDate: {
        type: Date,
        required: true,
        index: true
      },
      endDate: {
        type: Date,
        required: true,
        index: true
      },
      quarter: {
        type: String,
        enum: ['Q1', 'Q2', 'Q3', 'Q4'],
        index: true
      },
      year: {
        type: Number,
        required: true,
        index: true
      }
    },
    reviewType: {
      type: String,
      enum: ['annual', 'quarterly', 'probation', 'promotion', 'mid_year', 'project_based'],
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['draft', 'in_progress', 'employee_review', 'manager_review', 'hr_review', 'completed', 'cancelled'],
      default: 'draft',
      index: true
    },
    // Performance Metrics
    ratings: {
      overall: {
        score: { type: Number, min: 1, max: 5 },
        comments: { type: String }
      },
      categories: [{
        category: {
          type: String,
          required: true,
          enum: [
            'job_knowledge', 'quality_of_work', 'productivity', 'communication',
            'teamwork', 'leadership', 'problem_solving', 'initiative',
            'reliability', 'adaptability', 'customer_service', 'innovation'
          ]
        },
        score: { type: Number, min: 1, max: 5, required: true },
        weight: { type: Number, min: 0, max: 100, default: 10 },
        comments: { type: String },
        examples: [{ type: String }]
      }],
      // Calculated weighted average
      weightedScore: { type: Number, min: 1, max: 5 }
    },
    // Goals & Objectives
    goals: {
      previous: [{
        goalId: { type: String },
        description: { type: String },
        targetDate: { type: Date },
        status: {
          type: String,
          enum: ['achieved', 'partially_achieved', 'not_achieved', 'ongoing']
        },
        achievement: { type: Number, min: 0, max: 100 },
        comments: { type: String }
      }],
      upcoming: [{
        description: { type: String, required: true },
        targetDate: { type: Date, required: true },
        priority: {
          type: String,
          enum: ['low', 'medium', 'high', 'critical'],
          default: 'medium'
        },
        measurableOutcome: { type: String },
        resources: [{ type: String }]
      }]
    },
    // Feedback Sections
    feedback: {
      strengths: [{ type: String }],
      areasForImprovement: [{ type: String }],
      achievements: [{ type: String }],
      challenges: [{ type: String }],
      managerComments: { type: String },
      employeeComments: { type: String },
      hrComments: { type: String }
    },
    // Development Plan
    developmentPlan: {
      trainingNeeds: [{
        skill: { type: String },
        priority: {
          type: String,
          enum: ['low', 'medium', 'high', 'critical']
        },
        timeline: { type: String },
        method: {
          type: String,
          enum: ['internal_training', 'external_course', 'mentoring', 'self_study', 'certification']
        }
      }],
      careerPath: {
        currentLevel: { type: String },
        nextLevel: { type: String },
        timeline: { type: String },
        requirements: [{ type: String }]
      },
      mentoring: {
        needsMentor: { type: Boolean, default: false },
        mentorId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User"
        },
        mentorshipGoals: [{ type: String }]
      }
    },
    // Compensation Review
    compensation: {
      currentSalary: { type: Number },
      recommendedIncrease: {
        percentage: { type: Number, min: 0, max: 100 },
        amount: { type: Number, min: 0 },
        effectiveDate: { type: Date },
        justification: { type: String }
      },
      bonus: {
        recommended: { type: Boolean, default: false },
        amount: { type: Number, min: 0 },
        type: {
          type: String,
          enum: ['performance', 'retention', 'project', 'annual']
        },
        justification: { type: String }
      },
      promotion: {
        recommended: { type: Boolean, default: false },
        newTitle: { type: String },
        newLevel: { type: String },
        effectiveDate: { type: Date },
        justification: { type: String }
      }
    },
    // Review Process
    reviewProcess: {
      selfAssessmentCompleted: { type: Boolean, default: false },
      selfAssessmentDate: { type: Date },
      managerReviewCompleted: { type: Boolean, default: false },
      managerReviewDate: { type: Date },
      hrReviewCompleted: { type: Boolean, default: false },
      hrReviewDate: { type: Date },
      employeeMeetingDate: { type: Date },
      finalApprovalDate: { type: Date },
      nextReviewDate: { type: Date }
    },
    // Attachments & Documents
    attachments: [{
      fileName: { type: String },
      filePath: { type: String },
      fileType: { type: String },
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
    // Audit trail
    auditLog: [{
      action: { type: String },
      performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      timestamp: { type: Date, default: Date.now },
      changes: { type: mongoose.Schema.Types.Mixed },
      comments: { type: String }
    }]
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Compound indexes for performance
performanceReviewSchema.index({ employeeId: 1, 'reviewPeriod.year': -1 });
performanceReviewSchema.index({ orgId: 1, status: 1 });
performanceReviewSchema.index({ reviewerId: 1, status: 1 });
performanceReviewSchema.index({ reviewType: 1, 'reviewPeriod.year': -1 });
performanceReviewSchema.index({ 'reviewPeriod.startDate': 1, 'reviewPeriod.endDate': 1 });
performanceReviewSchema.index({ departmentId: 1, 'reviewPeriod.year': -1 });

// Virtual for employee details
performanceReviewSchema.virtual('employee', {
  ref: 'Employee',
  localField: 'employeeId',
  foreignField: '_id',
  justOne: true
});

// Virtual for reviewer details
performanceReviewSchema.virtual('reviewer', {
  ref: 'User',
  localField: 'reviewerId',
  foreignField: '_id',
  justOne: true
});

// Virtual for department details
performanceReviewSchema.virtual('department', {
  ref: 'Department',
  localField: 'departmentId',
  foreignField: '_id',
  justOne: true
});

// Method to calculate weighted score
performanceReviewSchema.methods.calculateWeightedScore = function() {
  if (!this.ratings.categories || this.ratings.categories.length === 0) {
    return 0;
  }

  let totalScore = 0;
  let totalWeight = 0;

  this.ratings.categories.forEach(category => {
    totalScore += category.score * category.weight;
    totalWeight += category.weight;
  });

  this.ratings.weightedScore = totalWeight > 0 ? totalScore / totalWeight : 0;
  return this.ratings.weightedScore;
};

// Method to add audit log entry
performanceReviewSchema.methods.addAuditLog = function(action, performedBy, changes, comments) {
  this.auditLog.push({
    action,
    performedBy,
    changes,
    comments,
    timestamp: new Date()
  });
  return this.save();
};

// Method to advance review status
performanceReviewSchema.methods.advanceStatus = function(newStatus, performedBy) {
  const oldStatus = this.status;
  this.status = newStatus;
  
  // Update process flags
  switch (newStatus) {
    case 'employee_review':
      this.reviewProcess.selfAssessmentCompleted = true;
      this.reviewProcess.selfAssessmentDate = new Date();
      break;
    case 'manager_review':
      this.reviewProcess.managerReviewCompleted = true;
      this.reviewProcess.managerReviewDate = new Date();
      break;
    case 'hr_review':
      this.reviewProcess.hrReviewCompleted = true;
      this.reviewProcess.hrReviewDate = new Date();
      break;
    case 'completed':
      this.reviewProcess.finalApprovalDate = new Date();
      // Set next review date (typically 1 year later)
      this.reviewProcess.nextReviewDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      break;
  }

  return this.addAuditLog(
    `Status changed from ${oldStatus} to ${newStatus}`,
    performedBy,
    { oldStatus, newStatus },
    `Review status updated`
  );
};

// Static method to find reviews by employee
performanceReviewSchema.statics.findByEmployee = function(employeeId, year) {
  const query = { employeeId };
  if (year) {
    query['reviewPeriod.year'] = year;
  }
  return this.find(query)
    .populate('reviewer', 'name email')
    .populate('employee', 'userId designation department')
    .sort({ 'reviewPeriod.startDate': -1 })
    .lean();
};

// Static method to find pending reviews
performanceReviewSchema.statics.findPendingReviews = function(orgId, reviewerId) {
  const query = {
    orgId,
    status: { $in: ['in_progress', 'employee_review', 'manager_review', 'hr_review'] }
  };
  
  if (reviewerId) {
    query.reviewerId = reviewerId;
  }
  
  return this.find(query)
    .populate('employee', 'userId designation department')
    .populate('reviewer', 'name email')
    .sort({ 'reviewPeriod.endDate': 1 })
    .lean();
};

const PerformanceReview = mongoose.model("PerformanceReview", performanceReviewSchema);

export default PerformanceReview;