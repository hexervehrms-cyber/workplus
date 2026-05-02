/**
 * Project Management Routes
 * Handles project creation, task management, team collaboration, and analytics
 */

import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { paginationMiddleware } from '../middleware/pagination.js';
import idempotencyMiddleware from '../middleware/idempotency.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Apply pagination middleware
router.use(paginationMiddleware);

/**
 * GET /api/projects
 * List projects with pagination and filtering
 */
router.get('/', asyncHandler(async (req, res) => {
  const { page, limit, skip } = req.pagination;
  const { orgId, managerId, status, priority, templateId } = req.query;

  try {
    const projectManagementSystem = global.projectManagementSystem;
    
    if (!projectManagementSystem) {
      return res.status(503).json({
        success: false,
        message: 'Project management system not available'
      });
    }

    // Get projects for organization
    let projects = projectManagementSystem.getProjectsForOrg(orgId);

    // Apply filters
    if (managerId) {
      projects = projects.filter(p => p.managerId === managerId);
    }

    if (status) {
      projects = projects.filter(p => p.status === status);
    }

    if (priority) {
      projects = projects.filter(p => p.priority === priority);
    }

    if (templateId) {
      projects = projects.filter(p => p.templateId === templateId);
    }

    // Sort by creation date (newest first)
    projects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Apply pagination
    const total = projects.length;
    const paginatedProjects = projects.slice(skip, skip + limit);

    logger.info('Projects listed', { total, page, limit, orgId });

    res.json({
      success: true,
      data: paginatedProjects,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    logger.error('Failed to list projects', {
      error: error.message,
      orgId
    });

    res.status(500).json({
      success: false,
      message: 'Failed to list projects',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}));

/**
 * GET /api/projects/user/:userId
 * Get projects for specific user (as manager or team member)
 */
router.get('/user/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;

  try {
    const projectManagementSystem = global.projectManagementSystem;
    
    if (!projectManagementSystem) {
      return res.status(503).json({
        success: false,
        message: 'Project management system not available'
      });
    }

    const projects = projectManagementSystem.getProjectsForUser(userId);

    res.json({
      success: true,
      data: projects
    });

  } catch (error) {
    logger.error('Failed to get user projects', {
      error: error.message,
      userId
    });

    res.status(500).json({
      success: false,
      message: 'Failed to get user projects',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}));

/**
 * GET /api/projects/:id
 * Get single project with full details
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const projectManagementSystem = global.projectManagementSystem;
    
    if (!projectManagementSystem) {
      return res.status(503).json({
        success: false,
        message: 'Project management system not available'
      });
    }

    const project = projectManagementSystem.getProject(id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Get collaboration room details
    const collaborationRoom = projectManagementSystem.getCollaborationRoom(id);

    res.json({
      success: true,
      data: {
        project,
        collaborationRoom
      }
    });

  } catch (error) {
    logger.error('Failed to get project', {
      error: error.message,
      projectId: id
    });

    res.status(500).json({
      success: false,
      message: 'Failed to get project',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}));

/**
 * POST /api/projects
 * Create new project
 */
router.post('/', idempotencyMiddleware, asyncHandler(async (req, res) => {
  const {
    name,
    description,
    templateId,
    managerId,
    teamMembers = [],
    startDate,
    endDate,
    budget,
    priority = 'medium',
    orgId,
    createdBy,
    customPhases
  } = req.body;

  // Validate required fields
  if (!name || !managerId || !orgId || !createdBy) {
    return res.status(400).json({
      success: false,
      message: 'name, managerId, orgId, and createdBy are required'
    });
  }

  if (!startDate) {
    return res.status(400).json({
      success: false,
      message: 'startDate is required'
    });
  }

  try {
    const projectManagementSystem = global.projectManagementSystem;
    
    if (!projectManagementSystem) {
      return res.status(503).json({
        success: false,
        message: 'Project management system not available'
      });
    }

    const result = await projectManagementSystem.createProject({
      name,
      description,
      templateId,
      managerId,
      teamMembers,
      startDate,
      endDate,
      budget,
      priority,
      orgId,
      createdBy,
      customPhases
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Failed to create project',
        error: result.error
      });
    }

    logger.info('Project created', {
      projectId: result.project.id,
      name,
      managerId,
      teamSize: teamMembers.length
    });

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: result.project
    });

  } catch (error) {
    logger.error('Failed to create project', {
      error: error.message,
      name,
      managerId
    });

    res.status(500).json({
      success: false,
      message: 'Failed to create project',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}));

/**
 * PUT /api/projects/:id
 * Update project details
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  try {
    const projectManagementSystem = global.projectManagementSystem;
    
    if (!projectManagementSystem) {
      return res.status(503).json({
        success: false,
        message: 'Project management system not available'
      });
    }

    const project = projectManagementSystem.getProject(id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Update allowed fields
    const allowedFields = ['name', 'description', 'endDate', 'budget', 'priority', 'status'];
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        project[field] = updateData[field];
      }
    });

    project.updatedAt = new Date();

    logger.info('Project updated', { projectId: id });

    res.json({
      success: true,
      message: 'Project updated successfully',
      data: project
    });

  } catch (error) {
    logger.error('Failed to update project', {
      error: error.message,
      projectId: id
    });

    res.status(500).json({
      success: false,
      message: 'Failed to update project',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}));

/**
 * POST /api/projects/:id/tasks/:taskId/assign
 * Assign task to team member
 */
router.post('/:id/tasks/:taskId/assign', asyncHandler(async (req, res) => {
  const { id: projectId, taskId } = req.params;
  const { assigneeId, assignedBy } = req.body;

  if (!assigneeId || !assignedBy) {
    return res.status(400).json({
      success: false,
      message: 'assigneeId and assignedBy are required'
    });
  }

  try {
    const projectManagementSystem = global.projectManagementSystem;
    
    if (!projectManagementSystem) {
      return res.status(503).json({
        success: false,
        message: 'Project management system not available'
      });
    }

    const result = await projectManagementSystem.assignTask(projectId, taskId, assigneeId, assignedBy);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Failed to assign task',
        error: result.error
      });
    }

    logger.info('Task assigned', { projectId, taskId, assigneeId, assignedBy });

    res.json({
      success: true,
      message: 'Task assigned successfully',
      data: result.task
    });

  } catch (error) {
    logger.error('Failed to assign task', {
      error: error.message,
      projectId,
      taskId,
      assigneeId
    });

    if (error.message === 'Project not found' || error.message === 'Task not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'Assignee is not part of the project team') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to assign task',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}));

/**
 * PATCH /api/projects/:id/tasks/:taskId/status
 * Update task status
 */
router.patch('/:id/tasks/:taskId/status', asyncHandler(async (req, res) => {
  const { id: projectId, taskId } = req.params;
  const { status, updatedBy, comments = '' } = req.body;

  if (!status || !updatedBy) {
    return res.status(400).json({
      success: false,
      message: 'status and updatedBy are required'
    });
  }

  const validStatuses = ['todo', 'assigned', 'in_progress', 'completed', 'blocked', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
    });
  }

  try {
    const projectManagementSystem = global.projectManagementSystem;
    
    if (!projectManagementSystem) {
      return res.status(503).json({
        success: false,
        message: 'Project management system not available'
      });
    }

    const result = await projectManagementSystem.updateTaskStatus(projectId, taskId, status, updatedBy, comments);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Failed to update task status',
        error: result.error
      });
    }

    logger.info('Task status updated', { projectId, taskId, status, updatedBy });

    res.json({
      success: true,
      message: 'Task status updated successfully',
      data: result.task
    });

  } catch (error) {
    logger.error('Failed to update task status', {
      error: error.message,
      projectId,
      taskId,
      status
    });

    if (error.message === 'Project not found' || error.message === 'Task not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update task status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}));

/**
 * POST /api/projects/:id/team
 * Add team member to project
 */
router.post('/:id/team', asyncHandler(async (req, res) => {
  const { id: projectId } = req.params;
  const { memberId, addedBy, role = 'member' } = req.body;

  if (!memberId || !addedBy) {
    return res.status(400).json({
      success: false,
      message: 'memberId and addedBy are required'
    });
  }

  try {
    const projectManagementSystem = global.projectManagementSystem;
    
    if (!projectManagementSystem) {
      return res.status(503).json({
        success: false,
        message: 'Project management system not available'
      });
    }

    const result = await projectManagementSystem.addTeamMember(projectId, memberId, addedBy, role);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Failed to add team member',
        error: result.error
      });
    }

    logger.info('Team member added', { projectId, memberId, addedBy, role });

    res.json({
      success: true,
      message: 'Team member added successfully',
      data: result.project
    });

  } catch (error) {
    logger.error('Failed to add team member', {
      error: error.message,
      projectId,
      memberId
    });

    if (error.message === 'Project not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'Member is already part of the project team') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to add team member',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}));

/**
 * GET /api/projects/templates
 * Get available project templates
 */
router.get('/templates', asyncHandler(async (req, res) => {
  try {
    const projectManagementSystem = global.projectManagementSystem;
    
    if (!projectManagementSystem) {
      return res.status(503).json({
        success: false,
        message: 'Project management system not available'
      });
    }

    const templates = projectManagementSystem.getProjectTemplates();

    res.json({
      success: true,
      data: templates
    });

  } catch (error) {
    logger.error('Failed to get project templates', {
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to get project templates',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}));

/**
 * GET /api/projects/analytics/:orgId
 * Get project analytics for organization
 */
router.get('/analytics/:orgId', asyncHandler(async (req, res) => {
  const { orgId } = req.params;
  const { timeframe = 30 } = req.query;

  try {
    const projectManagementSystem = global.projectManagementSystem;
    
    if (!projectManagementSystem) {
      return res.status(503).json({
        success: false,
        message: 'Project management system not available'
      });
    }

    const analytics = await projectManagementSystem.getProjectAnalytics(orgId, parseInt(timeframe));

    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    logger.error('Failed to get project analytics', {
      error: error.message,
      orgId
    });

    res.status(500).json({
      success: false,
      message: 'Failed to get project analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}));

/**
 * GET /api/projects/:id/collaboration
 * Get collaboration room for project
 */
router.get('/:id/collaboration', asyncHandler(async (req, res) => {
  const { id: projectId } = req.params;

  try {
    const projectManagementSystem = global.projectManagementSystem;
    
    if (!projectManagementSystem) {
      return res.status(503).json({
        success: false,
        message: 'Project management system not available'
      });
    }

    const collaborationRoom = projectManagementSystem.getCollaborationRoom(projectId);

    if (!collaborationRoom) {
      return res.status(404).json({
        success: false,
        message: 'Collaboration room not found'
      });
    }

    res.json({
      success: true,
      data: collaborationRoom
    });

  } catch (error) {
    logger.error('Failed to get collaboration room', {
      error: error.message,
      projectId
    });

    res.status(500).json({
      success: false,
      message: 'Failed to get collaboration room',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}));

/**
 * GET /api/projects/system/stats
 * Get project management system statistics
 */
router.get('/system/stats', asyncHandler(async (req, res) => {
  try {
    const projectManagementSystem = global.projectManagementSystem;
    
    if (!projectManagementSystem) {
      return res.json({
        success: true,
        data: {
          systemAvailable: false,
          message: 'Project management system not available'
        }
      });
    }

    const stats = projectManagementSystem.getSystemStats();

    res.json({
      success: true,
      data: {
        systemAvailable: true,
        ...stats
      }
    });

  } catch (error) {
    logger.error('Failed to get system stats', {
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to get system stats',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}));

export default router;