import express from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { authenticate, authorize, auditLog } from "../middleware/auth.js";
import logger from "../utils/logger.js";

const router = express.Router();

/**
 * GET /api/workflows/templates
 * Get available workflow templates
 */
router.get("/templates",
  authenticate,
  authorize('admin', 'super_admin', 'hr', 'manager'),
  asyncHandler(async (req, res) => {
    try {
      if (!global.workflowEngine) {
        return res.status(503).json({
          success: false,
          message: "Workflow engine not available"
        });
      }

      const templates = Array.from(global.workflowEngine.workflows.values());

      res.json({
        success: true,
        data: templates
      });

    } catch (error) {
      logger.error('Get workflow templates error', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: "Failed to get workflow templates"
      });
    }
  })
);

/**
 * POST /api/workflows/start
 * Start a new workflow instance
 */
router.post("/start",
  authenticate,
  auditLog('start_workflow', 'workflows'),
  asyncHandler(async (req, res) => {
    const { workflowId, data } = req.body;
    const createdBy = req.user.userId;
    const orgId = req.user.orgId;

    try {
      if (!workflowId || !data) {
        return res.status(400).json({
          success: false,
          message: "Workflow ID and data are required"
        });
      }

      if (!global.workflowEngine) {
        return res.status(503).json({
          success: false,
          message: "Workflow engine not available"
        });
      }

      const workflowData = {
        ...data,
        createdBy,
        orgId
      };

      const result = await global.workflowEngine.startWorkflow(workflowId, workflowData);

      res.status(201).json({
        success: true,
        message: "Workflow started successfully",
        data: result
      });

    } catch (error) {
      logger.error('Start workflow error', {
        error: error.message,
        workflowId,
        createdBy
      });

      res.status(500).json({
        success: false,
        message: "Failed to start workflow"
      });
    }
  })
);

/**
 * GET /api/workflows/active
 * Get active workflows for organization
 */
router.get("/active",
  authenticate,
  authorize('admin', 'super_admin', 'hr', 'manager'),
  asyncHandler(async (req, res) => {
    const orgId = req.user.orgId;
    const isSystemAdmin = req.user.role === 'super_admin';

    try {
      if (!global.workflowEngine) {
        return res.status(503).json({
          success: false,
          message: "Workflow engine not available"
        });
      }

      let workflows;
      if (isSystemAdmin) {
        // System admin can see all workflows
        workflows = Array.from(global.workflowEngine.activeWorkflows.values());
      } else {
        workflows = global.workflowEngine.getActiveWorkflowsForOrg(orgId);
      }

      res.json({
        success: true,
        data: workflows
      });

    } catch (error) {
      logger.error('Get active workflows error', {
        error: error.message,
        orgId
      });

      res.status(500).json({
        success: false,
        message: "Failed to get active workflows"
      });
    }
  })
);

/**
 * GET /api/workflows/:instanceId
 * Get workflow instance details
 */
router.get("/:instanceId",
  authenticate,
  asyncHandler(async (req, res) => {
    const { instanceId } = req.params;
    const userId = req.user.userId;
    const orgId = req.user.orgId;
    const userRole = req.user.role;

    try {
      if (!global.workflowEngine) {
        return res.status(503).json({
          success: false,
          message: "Workflow engine not available"
        });
      }

      const workflow = global.workflowEngine.getWorkflowStatus(instanceId);

      if (!workflow) {
        return res.status(404).json({
          success: false,
          message: "Workflow not found"
        });
      }

      // Check access permissions
      const canAccess = 
        userRole === 'super_admin' ||
        workflow.orgId === orgId ||
        workflow.createdBy === userId ||
        workflow.steps.some(step => step.assignedTo === userId);

      if (!canAccess) {
        return res.status(403).json({
          success: false,
          message: "Access denied"
        });
      }

      res.json({
        success: true,
        data: workflow
      });

    } catch (error) {
      logger.error('Get workflow instance error', {
        error: error.message,
        instanceId,
        userId
      });

      res.status(500).json({
        success: false,
        message: "Failed to get workflow instance"
      });
    }
  })
);

/**
 * POST /api/workflows/:instanceId/approve
 * Approve a workflow step
 */
router.post("/:instanceId/approve",
  authenticate,
  auditLog('approve_workflow_step', 'workflows'),
  asyncHandler(async (req, res) => {
    const { instanceId } = req.params;
    const { stepId, action, comments = '' } = req.body;
    const userId = req.user.userId;

    try {
      if (!stepId || !action) {
        return res.status(400).json({
          success: false,
          message: "Step ID and action are required"
        });
      }

      if (!['approved', 'rejected'].includes(action)) {
        return res.status(400).json({
          success: false,
          message: "Action must be 'approved' or 'rejected'"
        });
      }

      if (!global.workflowEngine) {
        return res.status(503).json({
          success: false,
          message: "Workflow engine not available"
        });
      }

      const result = await global.workflowEngine.handleApproval(
        instanceId,
        stepId,
        action,
        userId,
        comments
      );

      res.json({
        success: true,
        message: `Step ${action} successfully`,
        data: result
      });

    } catch (error) {
      logger.error('Approve workflow step error', {
        error: error.message,
        instanceId,
        stepId,
        action,
        userId
      });

      res.status(500).json({
        success: false,
        message: error.message || "Failed to process approval"
      });
    }
  })
);

/**
 * POST /api/workflows/:instanceId/complete-task
 * Complete a workflow task
 */
router.post("/:instanceId/complete-task",
  authenticate,
  auditLog('complete_workflow_task', 'workflows'),
  asyncHandler(async (req, res) => {
    const { instanceId } = req.params;
    const { stepId, data = {} } = req.body;
    const userId = req.user.userId;

    try {
      if (!stepId) {
        return res.status(400).json({
          success: false,
          message: "Step ID is required"
        });
      }

      if (!global.workflowEngine) {
        return res.status(503).json({
          success: false,
          message: "Workflow engine not available"
        });
      }

      const result = await global.workflowEngine.handleTaskCompletion(
        instanceId,
        stepId,
        userId,
        data
      );

      res.json({
        success: true,
        message: "Task completed successfully",
        data: result
      });

    } catch (error) {
      logger.error('Complete workflow task error', {
        error: error.message,
        instanceId,
        stepId,
        userId
      });

      res.status(500).json({
        success: false,
        message: error.message || "Failed to complete task"
      });
    }
  })
);

/**
 * GET /api/workflows/my-tasks
 * Get tasks assigned to current user
 */
router.get("/my-tasks",
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { status = 'active' } = req.query;

    try {
      if (!global.workflowEngine) {
        return res.status(503).json({
          success: false,
          message: "Workflow engine not available"
        });
      }

      const allWorkflows = Array.from(global.workflowEngine.activeWorkflows.values());
      
      const myTasks = [];

      for (const workflow of allWorkflows) {
        for (const step of workflow.steps) {
          if (step.assignedTo === userId && 
              (status === 'all' || step.status === status)) {
            myTasks.push({
              workflowInstanceId: workflow.id,
              workflowName: workflow.template.name,
              workflowType: workflow.workflowId,
              stepId: step.id,
              stepName: step.name,
              stepType: step.type,
              status: step.status,
              startedAt: step.startedAt,
              timeout: step.timeout,
              escalated: step.escalated,
              workflowData: workflow.data,
              createdBy: workflow.createdBy,
              orgId: workflow.orgId
            });
          }
        }
      }

      // Sort by creation date (newest first)
      myTasks.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));

      res.json({
        success: true,
        data: myTasks
      });

    } catch (error) {
      logger.error('Get my tasks error', {
        error: error.message,
        userId
      });

      res.status(500).json({
        success: false,
        message: "Failed to get tasks"
      });
    }
  })
);

/**
 * GET /api/workflows/stats
 * Get workflow statistics
 */
router.get("/stats",
  authenticate,
  authorize('admin', 'super_admin', 'hr'),
  asyncHandler(async (req, res) => {
    const orgId = req.user.orgId;
    const isSystemAdmin = req.user.role === 'super_admin';

    try {
      if (!global.workflowEngine) {
        return res.status(503).json({
          success: false,
          message: "Workflow engine not available"
        });
      }

      const stats = global.workflowEngine.getWorkflowStats();

      // Filter by organization if not system admin
      if (!isSystemAdmin) {
        // Filter stats to only include current organization
        const orgStats = {
          totalActive: stats.byOrg[orgId] || 0,
          byType: {},
          byStatus: {}
        };

        // Get workflows for this org and calculate filtered stats
        const orgWorkflows = global.workflowEngine.getActiveWorkflowsForOrg(orgId);
        
        for (const workflow of orgWorkflows) {
          orgStats.byType[workflow.workflowId] = 
            (orgStats.byType[workflow.workflowId] || 0) + 1;
          orgStats.byStatus[workflow.status] = 
            (orgStats.byStatus[workflow.status] || 0) + 1;
        }

        res.json({
          success: true,
          data: orgStats
        });
      } else {
        res.json({
          success: true,
          data: stats
        });
      }

    } catch (error) {
      logger.error('Get workflow stats error', {
        error: error.message,
        orgId
      });

      res.status(500).json({
        success: false,
        message: "Failed to get workflow statistics"
      });
    }
  })
);

/**
 * POST /api/workflows/register-template
 * Register a new workflow template (Super Admin only)
 */
router.post("/register-template",
  authenticate,
  authorize('super_admin'),
  auditLog('register_workflow_template', 'workflows'),
  asyncHandler(async (req, res) => {
    const { workflowId, workflowDefinition } = req.body;

    try {
      if (!workflowId || !workflowDefinition) {
        return res.status(400).json({
          success: false,
          message: "Workflow ID and definition are required"
        });
      }

      if (!global.workflowEngine) {
        return res.status(503).json({
          success: false,
          message: "Workflow engine not available"
        });
      }

      global.workflowEngine.registerWorkflow(workflowId, workflowDefinition);

      res.status(201).json({
        success: true,
        message: "Workflow template registered successfully"
      });

    } catch (error) {
      logger.error('Register workflow template error', {
        error: error.message,
        workflowId
      });

      res.status(500).json({
        success: false,
        message: "Failed to register workflow template"
      });
    }
  })
);

/**
 * GET /api/workflows/system/health
 * Get workflow system health
 */
router.get("/system/health",
  authenticate,
  authorize('admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    try {
      const health = {
        workflowEngine: !!global.workflowEngine,
        notificationManager: !!global.notificationManager,
        eventSystem: !!global.eventSystem,
        socketManager: !!global.socketManager
      };

      let stats = null;
      if (global.workflowEngine) {
        stats = global.workflowEngine.getWorkflowStats();
      }

      res.json({
        success: true,
        data: {
          health,
          stats,
          timestamp: new Date()
        }
      });

    } catch (error) {
      logger.error('Get workflow system health error', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: "Failed to get system health"
      });
    }
  })
);

export default router;