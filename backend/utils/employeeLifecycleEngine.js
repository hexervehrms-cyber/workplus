/**
 * Employee Lifecycle Management Engine
 * Handles complete employee lifecycle from onboarding to offboarding
 */

import Employee from "../models/Employee.js";
import User from "../models/User.js";
import logger from "./logger.js";

class EmployeeLifecycleEngine {
  constructor(notificationManager, workflowEngine, eventSystem) {
    this.notificationManager = notificationManager;
    this.workflowEngine = workflowEngine;
    this.eventSystem = eventSystem;
    
    this.lifecycleStages = {
      PRE_BOARDING: 'pre_boarding',
      ONBOARDING: 'onboarding', 
      ACTIVE: 'active',
      PERFORMANCE_REVIEW: 'performance_review',
      DEVELOPMENT: 'development',
      PRE_OFFBOARDING: 'pre_offboarding',
      OFFBOARDING: 'offboarding',
      ALUMNI: 'alumni'
    };
    
    this.onboardingTasks = [
      {
        id: 'document_collection',
        name: 'Document Collection',
        description: 'Collect and verify all required documents',
        assigneeRole: 'hr',
        priority: 'high',
        estimatedDays: 2,
        dependencies: [],
        documents: [
          'identity_proof',
          'address_proof', 
          'educational_certificates',
          'experience_letters',
          'bank_details',
          'emergency_contacts'
        ]
      },
      {
        id: 'system_account_setup',
        name: 'System Account Setup',
        description: 'Create user accounts and system access',
        assigneeRole: 'admin',
        priority: 'high',
        estimatedDays: 1,
        dependencies: ['document_collection'],
        systems: [
          'hrms_account',
          'email_account',
          'system_access',
          'security_badges'
        ]
      },
      {
        id: 'workspace_setup',
        name: 'Workspace Setup',
        description: 'Prepare workspace and assign equipment',
        assigneeRole: 'admin',
        priority: 'medium',
        estimatedDays: 1,
        dependencies: ['system_account_setup'],
        items: [
          'desk_assignment',
          'computer_setup',
          'phone_assignment',
          'access_cards'
        ]
      },
      {
        id: 'orientation_session',
        name: 'Orientation Session',
        description: 'Conduct company orientation and introduction',
        assigneeRole: 'hr',
        priority: 'high',
        estimatedDays: 1,
        dependencies: ['workspace_setup'],
        topics: [
          'company_culture',
          'policies_procedures',
          'benefits_overview',
          'team_introductions'
        ]
      },
      {
        id: 'role_training',
        name: 'Role-Specific Training',
        description: 'Provide role-specific training and mentoring',
        assigneeRole: 'manager',
        priority: 'high',
        estimatedDays: 5,
        dependencies: ['orientation_session'],
        components: [
          'job_responsibilities',
          'tools_training',
          'process_overview',
          'mentor_assignment'
        ]
      },
      {
        id: 'probation_setup',
        name: 'Probation Period Setup',
        description: 'Set up probation period tracking and milestones',
        assigneeRole: 'hr',
        priority: 'medium',
        estimatedDays: 1,
        dependencies: ['role_training'],
        milestones: [
          '30_day_review',
          '60_day_review',
          '90_day_review',
          'confirmation_decision'
        ]
      }
    ];
    
    this.offboardingTasks = [
      {
        id: 'exit_interview',
        name: 'Exit Interview',
        description: 'Conduct comprehensive exit interview',
        assigneeRole: 'hr',
        priority: 'high',
        estimatedDays: 1,
        topics: [
          'reason_for_leaving',
          'feedback_on_role',
          'company_feedback',
          'improvement_suggestions'
        ]
      },
      {
        id: 'knowledge_transfer',
        name: 'Knowledge Transfer',
        description: 'Transfer knowledge and handover responsibilities',
        assigneeRole: 'manager',
        priority: 'high',
        estimatedDays: 3,
        components: [
          'project_handover',
          'documentation_update',
          'team_briefing',
          'client_transition'
        ]
      },
      {
        id: 'asset_return',
        name: 'Asset Return',
        description: 'Return all company assets and equipment',
        assigneeRole: 'admin',
        priority: 'high',
        estimatedDays: 1,
        assets: [
          'laptop_computer',
          'mobile_phone',
          'access_cards',
          'company_documents',
          'office_keys'
        ]
      },
      {
        id: 'access_revocation',
        name: 'Access Revocation',
        description: 'Revoke all system access and permissions',
        assigneeRole: 'admin',
        priority: 'critical',
        estimatedDays: 1,
        systems: [
          'email_access',
          'system_accounts',
          'building_access',
          'vpn_access',
          'third_party_tools'
        ]
      },
      {
        id: 'final_settlement',
        name: 'Final Settlement',
        description: 'Process final salary and settlement',
        assigneeRole: 'hr',
        priority: 'high',
        estimatedDays: 2,
        components: [
          'final_salary',
          'pending_reimbursements',
          'leave_encashment',
          'gratuity_calculation',
          'tax_documents'
        ]
      },
      {
        id: 'alumni_setup',
        name: 'Alumni Network Setup',
        description: 'Add to alumni network and maintain relationship',
        assigneeRole: 'hr',
        priority: 'low',
        estimatedDays: 1,
        components: [
          'alumni_database',
          'linkedin_connection',
          'newsletter_subscription',
          'reference_availability'
        ]
      }
    ];
  }

  /**
   * Start employee onboarding process
   */
  async startOnboarding(employeeData) {
    try {
      const {
        employeeId,
        userId,
        name,
        email,
        department,
        designation,
        joiningDate,
        managerId,
        orgId,
        createdBy
      } = employeeData;

      // Update employee lifecycle stage
      await Employee.findByIdAndUpdate(employeeId, {
        lifecycleStage: this.lifecycleStages.ONBOARDING,
        onboardingStartDate: new Date(),
        onboardingStatus: 'in_progress'
      });

      // Start onboarding workflow
      const workflowData = {
        employeeId,
        userId,
        name,
        email,
        department,
        designation,
        joiningDate: new Date(joiningDate),
        managerId,
        tasks: this.onboardingTasks,
        createdBy,
        orgId
      };

      let workflowResult = null;
      if (this.workflowEngine) {
        workflowResult = await this.workflowEngine.startWorkflow('employee_onboarding', workflowData);
      }

      // Create onboarding checklist
      const checklist = await this.createOnboardingChecklist(employeeId, this.onboardingTasks);

      // Send welcome notification
      if (this.notificationManager) {
        await this.notificationManager.sendNotification({
          type: 'onboarding_started',
          title: 'Welcome to the Team!',
          message: `Welcome ${name}! Your onboarding process has started. We're excited to have you join us.`,
          recipients: [userId],
          priority: 'high',
          channels: ['in_app', 'email'],
          data: {
            employeeId,
            workflowId: workflowResult?.instanceId,
            checklist
          },
          orgId,
          createdBy
        });

        // Notify HR team
        await this.notificationManager.sendNotification({
          type: 'onboarding_started',
          title: 'New Employee Onboarding Started',
          message: `Onboarding process started for ${name} (${designation})`,
          recipients: 'hr',
          priority: 'normal',
          channels: ['in_app'],
          data: { employeeId, name, department, designation },
          orgId,
          createdBy
        });
      }

      // Emit business event
      if (this.eventSystem) {
        await this.eventSystem.emit('employee.onboarding_started', {
          employee: { _id: employeeId, name, email, department, designation },
          workflowId: workflowResult?.instanceId,
          checklist,
          orgId
        });
      }

      logger.info('Employee onboarding started', {
        employeeId,
        name,
        workflowId: workflowResult?.instanceId
      });

      return {
        success: true,
        workflowId: workflowResult?.instanceId,
        checklist,
        estimatedCompletionDays: this.calculateOnboardingDuration()
      };

    } catch (error) {
      logger.error('Failed to start employee onboarding', {
        error: error.message,
        employeeData
      });
      throw error;
    }
  }

  /**
   * Start employee offboarding process
   */
  async startOffboarding(offboardingData) {
    try {
      const {
        employeeId,
        userId,
        name,
        reason,
        lastWorkingDay,
        initiatedBy,
        orgId
      } = offboardingData;

      // Update employee lifecycle stage
      await Employee.findByIdAndUpdate(employeeId, {
        lifecycleStage: this.lifecycleStages.OFFBOARDING,
        offboardingStartDate: new Date(),
        lastWorkingDay: new Date(lastWorkingDay),
        offboardingReason: reason,
        offboardingStatus: 'in_progress'
      });

      // Start offboarding workflow
      const workflowData = {
        employeeId,
        userId,
        name,
        reason,
        lastWorkingDay: new Date(lastWorkingDay),
        tasks: this.offboardingTasks,
        createdBy: initiatedBy,
        orgId
      };

      let workflowResult = null;
      if (this.workflowEngine) {
        workflowResult = await this.workflowEngine.startWorkflow('employee_offboarding', workflowData);
      }

      // Create offboarding checklist
      const checklist = await this.createOffboardingChecklist(employeeId, this.offboardingTasks);

      // Send notifications
      if (this.notificationManager) {
        // Notify employee
        await this.notificationManager.sendNotification({
          type: 'offboarding_started',
          title: 'Offboarding Process Started',
          message: `Your offboarding process has been initiated. Please complete all required tasks before your last working day.`,
          recipients: [userId],
          priority: 'high',
          channels: ['in_app', 'email'],
          data: {
            employeeId,
            lastWorkingDay,
            workflowId: workflowResult?.instanceId,
            checklist
          },
          orgId,
          createdBy: initiatedBy
        });

        // Notify HR and managers
        await this.notificationManager.sendNotification({
          type: 'offboarding_started',
          title: 'Employee Offboarding Started',
          message: `Offboarding process started for ${name}. Last working day: ${new Date(lastWorkingDay).toDateString()}`,
          recipients: ['hr', 'managers'],
          priority: 'high',
          channels: ['in_app'],
          data: { employeeId, name, reason, lastWorkingDay },
          orgId,
          createdBy: initiatedBy
        });
      }

      // Emit business event
      if (this.eventSystem) {
        await this.eventSystem.emit('employee.offboarding_started', {
          employee: { _id: employeeId, name, userId },
          reason,
          lastWorkingDay,
          workflowId: workflowResult?.instanceId,
          checklist,
          orgId
        });
      }

      logger.info('Employee offboarding started', {
        employeeId,
        name,
        reason,
        lastWorkingDay,
        workflowId: workflowResult?.instanceId
      });

      return {
        success: true,
        workflowId: workflowResult?.instanceId,
        checklist,
        estimatedCompletionDays: this.calculateOffboardingDuration()
      };

    } catch (error) {
      logger.error('Failed to start employee offboarding', {
        error: error.message,
        offboardingData
      });
      throw error;
    }
  }

  /**
   * Update employee lifecycle stage
   */
  async updateLifecycleStage(employeeId, stage, metadata = {}) {
    try {
      const updateData = {
        lifecycleStage: stage,
        [`${stage}Date`]: new Date(),
        ...metadata
      };

      const employee = await Employee.findByIdAndUpdate(
        employeeId,
        updateData,
        { new: true }
      ).populate('userId', 'name email');

      // Emit lifecycle event
      if (this.eventSystem) {
        await this.eventSystem.emit('employee.lifecycle_stage_changed', {
          employee,
          previousStage: employee.lifecycleStage,
          newStage: stage,
          metadata,
          orgId: employee.orgId
        });
      }

      logger.info('Employee lifecycle stage updated', {
        employeeId,
        stage,
        metadata
      });

      return employee;

    } catch (error) {
      logger.error('Failed to update employee lifecycle stage', {
        error: error.message,
        employeeId,
        stage
      });
      throw error;
    }
  }

  /**
   * Create onboarding checklist
   */
  async createOnboardingChecklist(employeeId, tasks) {
    const checklist = tasks.map(task => ({
      taskId: task.id,
      name: task.name,
      description: task.description,
      assigneeRole: task.assigneeRole,
      priority: task.priority,
      estimatedDays: task.estimatedDays,
      dependencies: task.dependencies,
      status: 'pending',
      createdAt: new Date(),
      dueDate: this.calculateTaskDueDate(task.estimatedDays),
      metadata: {
        documents: task.documents || [],
        systems: task.systems || [],
        items: task.items || [],
        topics: task.topics || [],
        components: task.components || [],
        milestones: task.milestones || []
      }
    }));

    // Store checklist in employee record
    await Employee.findByIdAndUpdate(employeeId, {
      onboardingChecklist: checklist
    });

    return checklist;
  }

  /**
   * Create offboarding checklist
   */
  async createOffboardingChecklist(employeeId, tasks) {
    const checklist = tasks.map(task => ({
      taskId: task.id,
      name: task.name,
      description: task.description,
      assigneeRole: task.assigneeRole,
      priority: task.priority,
      estimatedDays: task.estimatedDays,
      status: 'pending',
      createdAt: new Date(),
      dueDate: this.calculateTaskDueDate(task.estimatedDays),
      metadata: {
        topics: task.topics || [],
        components: task.components || [],
        assets: task.assets || [],
        systems: task.systems || []
      }
    }));

    // Store checklist in employee record
    await Employee.findByIdAndUpdate(employeeId, {
      offboardingChecklist: checklist
    });

    return checklist;
  }

  /**
   * Update checklist task status
   */
  async updateChecklistTask(employeeId, taskId, status, completedBy, notes = '') {
    try {
      const employee = await Employee.findById(employeeId);
      
      if (!employee) {
        throw new Error('Employee not found');
      }

      // Update onboarding checklist
      if (employee.onboardingChecklist) {
        const task = employee.onboardingChecklist.find(t => t.taskId === taskId);
        if (task) {
          task.status = status;
          task.completedBy = completedBy;
          task.completedAt = status === 'completed' ? new Date() : null;
          task.notes = notes;
        }
      }

      // Update offboarding checklist
      if (employee.offboardingChecklist) {
        const task = employee.offboardingChecklist.find(t => t.taskId === taskId);
        if (task) {
          task.status = status;
          task.completedBy = completedBy;
          task.completedAt = status === 'completed' ? new Date() : null;
          task.notes = notes;
        }
      }

      await employee.save();

      // Check if all tasks are completed
      const isOnboardingComplete = employee.onboardingChecklist?.every(t => t.status === 'completed');
      const isOffboardingComplete = employee.offboardingChecklist?.every(t => t.status === 'completed');

      if (isOnboardingComplete && employee.lifecycleStage === this.lifecycleStages.ONBOARDING) {
        await this.completeOnboarding(employeeId);
      }

      if (isOffboardingComplete && employee.lifecycleStage === this.lifecycleStages.OFFBOARDING) {
        await this.completeOffboarding(employeeId);
      }

      // Emit task completion event
      if (this.eventSystem) {
        await this.eventSystem.emit('employee.checklist_task_updated', {
          employeeId,
          taskId,
          status,
          completedBy,
          notes,
          orgId: employee.orgId
        });
      }

      logger.info('Checklist task updated', {
        employeeId,
        taskId,
        status,
        completedBy
      });

      return { success: true };

    } catch (error) {
      logger.error('Failed to update checklist task', {
        error: error.message,
        employeeId,
        taskId
      });
      throw error;
    }
  }

  /**
   * Complete onboarding process
   */
  async completeOnboarding(employeeId) {
    try {
      const employee = await Employee.findByIdAndUpdate(
        employeeId,
        {
          lifecycleStage: this.lifecycleStages.ACTIVE,
          onboardingStatus: 'completed',
          onboardingCompletedDate: new Date()
        },
        { new: true }
      ).populate('userId', 'name email');

      // Send completion notifications
      if (this.notificationManager) {
        await this.notificationManager.sendNotification({
          type: 'onboarding_completed',
          title: 'Onboarding Complete!',
          message: 'Congratulations! You have successfully completed the onboarding process.',
          recipients: [employee.userId._id],
          priority: 'normal',
          channels: ['in_app', 'email'],
          data: { employeeId },
          orgId: employee.orgId
        });
      }

      // Emit completion event
      if (this.eventSystem) {
        await this.eventSystem.emit('employee.onboarding_completed', {
          employee,
          completedAt: new Date(),
          orgId: employee.orgId
        });
      }

      logger.info('Employee onboarding completed', {
        employeeId,
        employeeName: employee.userId.name
      });

    } catch (error) {
      logger.error('Failed to complete onboarding', {
        error: error.message,
        employeeId
      });
      throw error;
    }
  }

  /**
   * Complete offboarding process
   */
  async completeOffboarding(employeeId) {
    try {
      const employee = await Employee.findByIdAndUpdate(
        employeeId,
        {
          lifecycleStage: this.lifecycleStages.ALUMNI,
          offboardingStatus: 'completed',
          offboardingCompletedDate: new Date(),
          status: 'inactive'
        },
        { new: true }
      ).populate('userId', 'name email');

      // Deactivate user account
      await User.findByIdAndUpdate(employee.userId._id, {
        isActive: false,
        deactivatedAt: new Date(),
        deactivationReason: 'offboarding_completed'
      });

      // Send completion notifications
      if (this.notificationManager) {
        await this.notificationManager.sendNotification({
          type: 'offboarding_completed',
          title: 'Offboarding Complete',
          message: 'Thank you for your service. Your offboarding process has been completed.',
          recipients: [employee.userId._id],
          priority: 'normal',
          channels: ['in_app', 'email'],
          data: { employeeId },
          orgId: employee.orgId
        });
      }

      // Emit completion event
      if (this.eventSystem) {
        await this.eventSystem.emit('employee.offboarding_completed', {
          employee,
          completedAt: new Date(),
          orgId: employee.orgId
        });
      }

      logger.info('Employee offboarding completed', {
        employeeId,
        employeeName: employee.userId.name
      });

    } catch (error) {
      logger.error('Failed to complete offboarding', {
        error: error.message,
        employeeId
      });
      throw error;
    }
  }

  /**
   * Get employee lifecycle analytics
   */
  async getLifecycleAnalytics(orgId, timeframe = 30) {
    try {
      const since = new Date(Date.now() - timeframe * 24 * 60 * 60 * 1000);

      const analytics = await Employee.aggregate([
        {
          $match: {
            orgId,
            createdAt: { $gte: since }
          }
        },
        {
          $group: {
            _id: "$lifecycleStage",
            count: { $sum: 1 },
            avgOnboardingDays: {
              $avg: {
                $cond: [
                  { $and: ["$onboardingCompletedDate", "$onboardingStartDate"] },
                  {
                    $divide: [
                      { $subtract: ["$onboardingCompletedDate", "$onboardingStartDate"] },
                      1000 * 60 * 60 * 24
                    ]
                  },
                  null
                ]
              }
            }
          }
        }
      ]);

      return {
        timeframe: `${timeframe} days`,
        analytics,
        generatedAt: new Date()
      };

    } catch (error) {
      logger.error('Failed to get lifecycle analytics', {
        error: error.message,
        orgId
      });
      throw error;
    }
  }

  /**
   * Helper methods
   */
  calculateTaskDueDate(estimatedDays) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + estimatedDays);
    return dueDate;
  }

  calculateOnboardingDuration() {
    return this.onboardingTasks.reduce((total, task) => total + task.estimatedDays, 0);
  }

  calculateOffboardingDuration() {
    return this.offboardingTasks.reduce((total, task) => total + task.estimatedDays, 0);
  }

  getLifecycleStages() {
    return this.lifecycleStages;
  }

  getOnboardingTasks() {
    return this.onboardingTasks;
  }

  getOffboardingTasks() {
    return this.offboardingTasks;
  }
}

export default EmployeeLifecycleEngine;