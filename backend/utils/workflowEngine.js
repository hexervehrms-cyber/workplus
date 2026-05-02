/**
 * Workflow Automation Engine
 * Handles automated business processes, approvals, and workflow management
 */

import logger from "./logger.js";
import User from "../models/User.js";
import Employee from "../models/Employee.js";

class WorkflowEngine {
  constructor(notificationManager, socketManager) {
    this.notificationManager = notificationManager;
    this.socketManager = socketManager;
    this.workflows = new Map();
    this.activeWorkflows = new Map();
    
    // Initialize default workflows
    this.initializeDefaultWorkflows();
  }

  /**
   * Initialize default workflow templates
   */
  initializeDefaultWorkflows() {
    // Leave Request Workflow
    this.registerWorkflow('leave_request', {
      name: 'Leave Request Approval',
      description: 'Automated leave request approval workflow',
      steps: [
        {
          id: 'submit',
          name: 'Submit Request',
          type: 'start',
          autoComplete: true
        },
        {
          id: 'manager_approval',
          name: 'Manager Approval',
          type: 'approval',
          approverRole: 'manager',
          timeout: 48, // hours
          escalation: {
            to: 'hr',
            after: 48
          }
        },
        {
          id: 'hr_approval',
          name: 'HR Approval',
          type: 'approval',
          approverRole: 'hr',
          condition: (data) => data.days > 5, // Only for leaves > 5 days
          timeout: 24
        },
        {
          id: 'complete',
          name: 'Request Processed',
          type: 'end',
          autoComplete: true
        }
      ],
      notifications: {
        submit: {
          to: ['requester', 'manager'],
          template: 'leave_request_submitted'
        },
        approved: {
          to: ['requester'],
          template: 'leave_request_approved'
        },
        rejected: {
          to: ['requester'],
          template: 'leave_request_rejected'
        }
      }
    });

    // Expense Approval Workflow
    this.registerWorkflow('expense_approval', {
      name: 'Expense Approval',
      description: 'Automated expense approval workflow',
      steps: [
        {
          id: 'submit',
          name: 'Submit Expense',
          type: 'start',
          autoComplete: true
        },
        {
          id: 'manager_approval',
          name: 'Manager Approval',
          type: 'approval',
          approverRole: 'manager',
          condition: (data) => data.amount > 100,
          timeout: 24
        },
        {
          id: 'finance_approval',
          name: 'Finance Approval',
          type: 'approval',
          approverRole: 'admin',
          condition: (data) => data.amount > 1000,
          timeout: 48
        },
        {
          id: 'complete',
          name: 'Expense Processed',
          type: 'end',
          autoComplete: true
        }
      ]
    });

    // Employee Onboarding Workflow
    this.registerWorkflow('employee_onboarding', {
      name: 'Employee Onboarding',
      description: 'Complete employee onboarding process',
      steps: [
        {
          id: 'start',
          name: 'Onboarding Started',
          type: 'start',
          autoComplete: true
        },
        {
          id: 'document_collection',
          name: 'Document Collection',
          type: 'task',
          assigneeRole: 'hr',
          timeout: 72
        },
        {
          id: 'system_setup',
          name: 'System Account Setup',
          type: 'task',
          assigneeRole: 'admin',
          timeout: 24
        },
        {
          id: 'orientation',
          name: 'Orientation Session',
          type: 'task',
          assigneeRole: 'hr',
          timeout: 48
        },
        {
          id: 'complete',
          name: 'Onboarding Complete',
          type: 'end',
          autoComplete: true
        }
      ]
    });

    // Performance Review Workflow
    this.registerWorkflow('performance_review', {
      name: 'Performance Review',
      description: 'Annual performance review process',
      steps: [
        {
          id: 'start',
          name: 'Review Period Started',
          type: 'start',
          autoComplete: true
        },
        {
          id: 'self_assessment',
          name: 'Self Assessment',
          type: 'task',
          assigneeType: 'requester',
          timeout: 168 // 1 week
        },
        {
          id: 'manager_review',
          name: 'Manager Review',
          type: 'task',
          assigneeRole: 'manager',
          timeout: 168
        },
        {
          id: 'hr_review',
          name: 'HR Review',
          type: 'approval',
          approverRole: 'hr',
          timeout: 72
        },
        {
          id: 'complete',
          name: 'Review Complete',
          type: 'end',
          autoComplete: true
        }
      ]
    });

    logger.info('Default workflows initialized', {
      workflowCount: this.workflows.size
    });
  }

  /**
   * Register a new workflow template
   */
  registerWorkflow(workflowId, workflowDefinition) {
    this.workflows.set(workflowId, {
      ...workflowDefinition,
      id: workflowId,
      createdAt: new Date()
    });

    logger.info('Workflow registered', { workflowId });
  }

  /**
   * Start a new workflow instance
   */
  async startWorkflow(workflowId, data) {
    try {
      const workflowTemplate = this.workflows.get(workflowId);
      
      if (!workflowTemplate) {
        throw new Error(`Workflow template not found: ${workflowId}`);
      }

      const instanceId = `${workflowId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const workflowInstance = {
        id: instanceId,
        workflowId,
        template: workflowTemplate,
        data,
        status: 'active',
        currentStep: 0,
        steps: workflowTemplate.steps.map(step => ({
          ...step,
          status: 'pending',
          startedAt: null,
          completedAt: null,
          assignedTo: null,
          comments: []
        })),
        startedAt: new Date(),
        completedAt: null,
        createdBy: data.createdBy,
        orgId: data.orgId
      };

      // Store the active workflow
      this.activeWorkflows.set(instanceId, workflowInstance);

      // Start the first step
      await this.processNextStep(instanceId);

      logger.info('Workflow started', {
        instanceId,
        workflowId,
        createdBy: data.createdBy
      });

      return {
        success: true,
        instanceId,
        workflowInstance
      };

    } catch (error) {
      logger.error('Failed to start workflow', {
        error: error.message,
        workflowId,
        data
      });
      throw error;
    }
  }

  /**
   * Process the next step in a workflow
   */
  async processNextStep(instanceId) {
    try {
      const workflow = this.activeWorkflows.get(instanceId);
      
      if (!workflow || workflow.status !== 'active') {
        return;
      }

      const currentStep = workflow.steps[workflow.currentStep];
      
      if (!currentStep) {
        // Workflow complete
        await this.completeWorkflow(instanceId);
        return;
      }

      // Mark step as started
      currentStep.status = 'active';
      currentStep.startedAt = new Date();

      logger.info('Processing workflow step', {
        instanceId,
        stepId: currentStep.id,
        stepType: currentStep.type
      });

      switch (currentStep.type) {
        case 'start':
          await this.processStartStep(instanceId, currentStep);
          break;

        case 'approval':
          await this.processApprovalStep(instanceId, currentStep);
          break;

        case 'task':
          await this.processTaskStep(instanceId, currentStep);
          break;

        case 'end':
          await this.processEndStep(instanceId, currentStep);
          break;

        default:
          logger.warn('Unknown step type', {
            instanceId,
            stepType: currentStep.type
          });
      }

    } catch (error) {
      logger.error('Failed to process workflow step', {
        error: error.message,
        instanceId
      });
    }
  }

  /**
   * Process start step
   */
  async processStartStep(instanceId, step) {
    const workflow = this.activeWorkflows.get(instanceId);
    
    if (step.autoComplete) {
      await this.completeStep(instanceId, step.id, {
        action: 'auto_complete',
        completedBy: 'system'
      });
    }

    // Send notifications
    await this.sendWorkflowNotifications(workflow, 'started');
  }

  /**
   * Process approval step
   */
  async processApprovalStep(instanceId, step) {
    const workflow = this.activeWorkflows.get(instanceId);

    // Check if step condition is met
    if (step.condition && !step.condition(workflow.data)) {
      // Skip this step
      await this.completeStep(instanceId, step.id, {
        action: 'skipped',
        reason: 'condition_not_met',
        completedBy: 'system'
      });
      return;
    }

    // Find approver
    const approver = await this.findApprover(workflow, step);
    
    if (!approver) {
      logger.error('No approver found for step', {
        instanceId,
        stepId: step.id,
        approverRole: step.approverRole
      });
      return;
    }

    step.assignedTo = approver._id;

    // Send approval request notification
    await this.notificationManager.sendNotification({
      type: 'approval_request',
      title: `Approval Required: ${workflow.template.name}`,
      message: `You have a pending approval request for ${workflow.template.name}`,
      recipients: [approver._id],
      priority: 'high',
      channels: ['in_app', 'email'],
      data: {
        workflowInstanceId: instanceId,
        stepId: step.id,
        workflowType: workflow.workflowId,
        requestData: workflow.data
      },
      orgId: workflow.orgId,
      createdBy: workflow.createdBy,
      actionUrl: `/approvals/${instanceId}`
    });

    // Set timeout for escalation
    if (step.timeout) {
      setTimeout(() => {
        this.handleStepTimeout(instanceId, step.id);
      }, step.timeout * 60 * 60 * 1000); // Convert hours to milliseconds
    }

    logger.info('Approval step assigned', {
      instanceId,
      stepId: step.id,
      approverId: approver._id,
      approverName: approver.name
    });
  }

  /**
   * Process task step
   */
  async processTaskStep(instanceId, step) {
    const workflow = this.activeWorkflows.get(instanceId);

    // Find assignee
    const assignee = await this.findAssignee(workflow, step);
    
    if (!assignee) {
      logger.error('No assignee found for step', {
        instanceId,
        stepId: step.id,
        assigneeRole: step.assigneeRole
      });
      return;
    }

    step.assignedTo = assignee._id;

    // Send task assignment notification
    await this.notificationManager.sendNotification({
      type: 'task_assigned',
      title: `Task Assigned: ${step.name}`,
      message: `You have been assigned a task: ${step.name}`,
      recipients: [assignee._id],
      priority: 'normal',
      channels: ['in_app', 'email'],
      data: {
        workflowInstanceId: instanceId,
        stepId: step.id,
        workflowType: workflow.workflowId,
        taskData: workflow.data
      },
      orgId: workflow.orgId,
      createdBy: workflow.createdBy,
      actionUrl: `/tasks/${instanceId}/${step.id}`
    });

    // Set timeout
    if (step.timeout) {
      setTimeout(() => {
        this.handleStepTimeout(instanceId, step.id);
      }, step.timeout * 60 * 60 * 1000);
    }

    logger.info('Task step assigned', {
      instanceId,
      stepId: step.id,
      assigneeId: assignee._id,
      assigneeName: assignee.name
    });
  }

  /**
   * Process end step
   */
  async processEndStep(instanceId, step) {
    if (step.autoComplete) {
      await this.completeStep(instanceId, step.id, {
        action: 'auto_complete',
        completedBy: 'system'
      });
    }
  }

  /**
   * Complete a workflow step
   */
  async completeStep(instanceId, stepId, completionData) {
    try {
      const workflow = this.activeWorkflows.get(instanceId);
      
      if (!workflow) {
        throw new Error('Workflow not found');
      }

      const step = workflow.steps.find(s => s.id === stepId);
      
      if (!step) {
        throw new Error('Step not found');
      }

      // Mark step as completed
      step.status = 'completed';
      step.completedAt = new Date();
      step.completionData = completionData;

      // Move to next step
      workflow.currentStep++;

      logger.info('Workflow step completed', {
        instanceId,
        stepId,
        action: completionData.action,
        completedBy: completionData.completedBy
      });

      // Send completion notifications
      await this.sendStepCompletionNotifications(workflow, step, completionData);

      // Process next step
      await this.processNextStep(instanceId);

    } catch (error) {
      logger.error('Failed to complete workflow step', {
        error: error.message,
        instanceId,
        stepId
      });
      throw error;
    }
  }

  /**
   * Handle approval action
   */
  async handleApproval(instanceId, stepId, action, userId, comments = '') {
    try {
      const workflow = this.activeWorkflows.get(instanceId);
      
      if (!workflow) {
        throw new Error('Workflow not found');
      }

      const step = workflow.steps.find(s => s.id === stepId);
      
      if (!step || step.status !== 'active') {
        throw new Error('Step not found or not active');
      }

      if (step.assignedTo.toString() !== userId.toString()) {
        throw new Error('User not authorized to approve this step');
      }

      const completionData = {
        action,
        completedBy: userId,
        comments,
        timestamp: new Date()
      };

      if (action === 'approved') {
        await this.completeStep(instanceId, stepId, completionData);
      } else if (action === 'rejected') {
        // Reject the entire workflow
        workflow.status = 'rejected';
        workflow.completedAt = new Date();
        workflow.rejectedBy = userId;
        workflow.rejectionReason = comments;

        // Send rejection notifications
        await this.sendWorkflowNotifications(workflow, 'rejected');
      }

      logger.info('Approval action processed', {
        instanceId,
        stepId,
        action,
        userId
      });

      return { success: true };

    } catch (error) {
      logger.error('Failed to process approval', {
        error: error.message,
        instanceId,
        stepId,
        action,
        userId
      });
      throw error;
    }
  }

  /**
   * Handle task completion
   */
  async handleTaskCompletion(instanceId, stepId, userId, data = {}) {
    try {
      const completionData = {
        action: 'completed',
        completedBy: userId,
        data,
        timestamp: new Date()
      };

      await this.completeStep(instanceId, stepId, completionData);

      logger.info('Task completed', {
        instanceId,
        stepId,
        userId
      });

      return { success: true };

    } catch (error) {
      logger.error('Failed to complete task', {
        error: error.message,
        instanceId,
        stepId,
        userId
      });
      throw error;
    }
  }

  /**
   * Complete entire workflow
   */
  async completeWorkflow(instanceId) {
    try {
      const workflow = this.activeWorkflows.get(instanceId);
      
      if (!workflow) {
        return;
      }

      workflow.status = 'completed';
      workflow.completedAt = new Date();

      // Send completion notifications
      await this.sendWorkflowNotifications(workflow, 'completed');

      // Archive the workflow (move to completed workflows)
      // TODO: Store in database for historical tracking

      // Remove from active workflows
      this.activeWorkflows.delete(instanceId);

      logger.info('Workflow completed', {
        instanceId,
        workflowId: workflow.workflowId,
        duration: workflow.completedAt - workflow.startedAt
      });

    } catch (error) {
      logger.error('Failed to complete workflow', {
        error: error.message,
        instanceId
      });
    }
  }

  /**
   * Handle step timeout
   */
  async handleStepTimeout(instanceId, stepId) {
    try {
      const workflow = this.activeWorkflows.get(instanceId);
      
      if (!workflow) {
        return;
      }

      const step = workflow.steps.find(s => s.id === stepId);
      
      if (!step || step.status !== 'active') {
        return;
      }

      logger.warn('Workflow step timeout', {
        instanceId,
        stepId,
        assignedTo: step.assignedTo
      });

      // Handle escalation
      if (step.escalation) {
        await this.escalateStep(instanceId, step);
      } else {
        // Send timeout notification
        await this.notificationManager.sendNotification({
          type: 'workflow_timeout',
          title: 'Workflow Step Timeout',
          message: `Step "${step.name}" has timed out`,
          recipients: [step.assignedTo],
          priority: 'urgent',
          channels: ['in_app', 'email'],
          data: {
            workflowInstanceId: instanceId,
            stepId: step.id
          },
          orgId: workflow.orgId
        });
      }

    } catch (error) {
      logger.error('Failed to handle step timeout', {
        error: error.message,
        instanceId,
        stepId
      });
    }
  }

  /**
   * Escalate a step
   */
  async escalateStep(instanceId, step) {
    try {
      const workflow = this.activeWorkflows.get(instanceId);
      
      // Find escalation target
      const escalationTarget = await this.findApprover(workflow, {
        approverRole: step.escalation.to
      });

      if (escalationTarget) {
        step.assignedTo = escalationTarget._id;
        step.escalated = true;
        step.escalatedAt = new Date();

        // Send escalation notification
        await this.notificationManager.sendNotification({
          type: 'workflow_escalated',
          title: 'Workflow Escalated',
          message: `Step "${step.name}" has been escalated to you`,
          recipients: [escalationTarget._id],
          priority: 'urgent',
          channels: ['in_app', 'email'],
          data: {
            workflowInstanceId: instanceId,
            stepId: step.id,
            originalAssignee: step.assignedTo
          },
          orgId: workflow.orgId
        });

        logger.info('Workflow step escalated', {
          instanceId,
          stepId: step.id,
          escalatedTo: escalationTarget._id
        });
      }

    } catch (error) {
      logger.error('Failed to escalate step', {
        error: error.message,
        instanceId,
        stepId: step.id
      });
    }
  }

  /**
   * Find approver for a step
   */
  async findApprover(workflow, step) {
    try {
      const query = {
        orgId: workflow.orgId,
        isActive: true
      };

      if (step.approverRole) {
        query.role = step.approverRole;
      }

      if (step.approverId) {
        query._id = step.approverId;
      }

      // For employee-related workflows, find their manager
      if (step.approverRole === 'manager' && workflow.data.employeeId) {
        const employee = await Employee.findById(workflow.data.employeeId)
          .populate('managerId');
        
        if (employee?.managerId) {
          return employee.managerId;
        }
      }

      const approvers = await User.find(query).limit(1);
      return approvers[0] || null;

    } catch (error) {
      logger.error('Failed to find approver', {
        error: error.message,
        workflowId: workflow.id,
        stepId: step.id
      });
      return null;
    }
  }

  /**
   * Find assignee for a task step
   */
  async findAssignee(workflow, step) {
    try {
      if (step.assigneeType === 'requester') {
        return await User.findById(workflow.createdBy);
      }

      if (step.assigneeId) {
        return await User.findById(step.assigneeId);
      }

      if (step.assigneeRole) {
        const assignees = await User.find({
          orgId: workflow.orgId,
          role: step.assigneeRole,
          isActive: true
        }).limit(1);
        
        return assignees[0] || null;
      }

      return null;

    } catch (error) {
      logger.error('Failed to find assignee', {
        error: error.message,
        workflowId: workflow.id,
        stepId: step.id
      });
      return null;
    }
  }

  /**
   * Send workflow notifications
   */
  async sendWorkflowNotifications(workflow, event) {
    try {
      const notifications = workflow.template.notifications?.[event];
      
      if (!notifications) {
        return;
      }

      // Determine recipients
      let recipients = [];
      
      for (const recipient of notifications.to) {
        switch (recipient) {
          case 'requester':
            recipients.push(workflow.createdBy);
            break;
          case 'manager':
            // Find manager of the requester
            const employee = await Employee.findOne({ userId: workflow.createdBy })
              .populate('managerId');
            if (employee?.managerId) {
              recipients.push(employee.managerId._id);
            }
            break;
          default:
            if (recipient.startsWith('role_')) {
              const role = recipient.replace('role_', '');
              const roleUsers = await User.find({
                orgId: workflow.orgId,
                role,
                isActive: true
              }).select('_id');
              recipients.push(...roleUsers.map(u => u._id));
            }
        }
      }

      if (recipients.length > 0) {
        await this.notificationManager.sendNotification({
          type: `workflow_${event}`,
          title: `Workflow ${event}: ${workflow.template.name}`,
          message: `Workflow ${workflow.template.name} has been ${event}`,
          recipients,
          priority: 'normal',
          channels: ['in_app'],
          data: {
            workflowInstanceId: workflow.id,
            workflowType: workflow.workflowId
          },
          orgId: workflow.orgId
        });
      }

    } catch (error) {
      logger.error('Failed to send workflow notifications', {
        error: error.message,
        workflowId: workflow.id,
        event
      });
    }
  }

  /**
   * Send step completion notifications
   */
  async sendStepCompletionNotifications(workflow, step, completionData) {
    // Implementation for step-specific notifications
    // This would send notifications based on the step type and completion result
  }

  /**
   * Get workflow status
   */
  getWorkflowStatus(instanceId) {
    return this.activeWorkflows.get(instanceId);
  }

  /**
   * Get all active workflows for an organization
   */
  getActiveWorkflowsForOrg(orgId) {
    const orgWorkflows = [];
    
    for (const [instanceId, workflow] of this.activeWorkflows.entries()) {
      if (workflow.orgId === orgId) {
        orgWorkflows.push(workflow);
      }
    }

    return orgWorkflows;
  }

  /**
   * Get workflow statistics
   */
  getWorkflowStats() {
    const stats = {
      totalActive: this.activeWorkflows.size,
      byType: {},
      byStatus: {},
      byOrg: {}
    };

    for (const [instanceId, workflow] of this.activeWorkflows.entries()) {
      // Count by type
      stats.byType[workflow.workflowId] = 
        (stats.byType[workflow.workflowId] || 0) + 1;

      // Count by status
      stats.byStatus[workflow.status] = 
        (stats.byStatus[workflow.status] || 0) + 1;

      // Count by organization
      stats.byOrg[workflow.orgId] = 
        (stats.byOrg[workflow.orgId] || 0) + 1;
    }

    return stats;
  }
}

export default WorkflowEngine;