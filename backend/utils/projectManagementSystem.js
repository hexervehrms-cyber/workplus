/**
 * Project Management System
 * Handles project planning, collaboration, tracking, and resource management
 */

import Task from "../models/Task.js";
import User from "../models/User.js";
import Employee from "../models/Employee.js";
import logger from "./logger.js";

class ProjectManagementSystem {
  constructor(notificationManager, workflowEngine, eventSystem, socketManager) {
    this.notificationManager = notificationManager;
    this.workflowEngine = workflowEngine;
    this.eventSystem = eventSystem;
    this.socketManager = socketManager;
    
    // Project templates and configurations
    this.projectTemplates = new Map();
    this.activeProjects = new Map();
    this.resourceAllocations = new Map();
    this.collaborationRooms = new Map();
    
    // Initialize default project templates
    this.initializeDefaultTemplates();
  }

  /**
   * Initialize default project templates
   */
  initializeDefaultTemplates() {
    // Software Development Project Template
    this.registerProjectTemplate('software_development', {
      name: 'Software Development Project',
      description: 'Standard software development project with agile methodology',
      phases: [
        {
          id: 'planning',
          name: 'Project Planning',
          duration: 7, // days
          tasks: [
            { name: 'Requirements Gathering', duration: 3, dependencies: [] },
            { name: 'Technical Architecture', duration: 2, dependencies: ['Requirements Gathering'] },
            { name: 'Project Timeline', duration: 1, dependencies: ['Technical Architecture'] },
            { name: 'Resource Allocation', duration: 1, dependencies: ['Project Timeline'] }
          ]
        },
        {
          id: 'development',
          name: 'Development Phase',
          duration: 30,
          tasks: [
            { name: 'Environment Setup', duration: 2, dependencies: [] },
            { name: 'Database Design', duration: 3, dependencies: ['Environment Setup'] },
            { name: 'Backend Development', duration: 15, dependencies: ['Database Design'] },
            { name: 'Frontend Development', duration: 12, dependencies: ['Backend Development'] },
            { name: 'Integration Testing', duration: 5, dependencies: ['Frontend Development'] }
          ]
        },
        {
          id: 'testing',
          name: 'Testing & QA',
          duration: 10,
          tasks: [
            { name: 'Unit Testing', duration: 3, dependencies: [] },
            { name: 'Integration Testing', duration: 3, dependencies: ['Unit Testing'] },
            { name: 'User Acceptance Testing', duration: 4, dependencies: ['Integration Testing'] }
          ]
        },
        {
          id: 'deployment',
          name: 'Deployment',
          duration: 5,
          tasks: [
            { name: 'Production Setup', duration: 2, dependencies: [] },
            { name: 'Deployment', duration: 1, dependencies: ['Production Setup'] },
            { name: 'Post-deployment Testing', duration: 2, dependencies: ['Deployment'] }
          ]
        }
      ],
      roles: ['project_manager', 'developer', 'designer', 'tester', 'devops'],
      deliverables: ['Requirements Document', 'Technical Specification', 'Source Code', 'Test Reports', 'Deployment Guide'],
      riskFactors: ['Technical Complexity', 'Resource Availability', 'Timeline Constraints']
    });

    // Marketing Campaign Template
    this.registerProjectTemplate('marketing_campaign', {
      name: 'Marketing Campaign',
      description: 'Comprehensive marketing campaign project',
      phases: [
        {
          id: 'strategy',
          name: 'Campaign Strategy',
          duration: 10,
          tasks: [
            { name: 'Market Research', duration: 5, dependencies: [] },
            { name: 'Target Audience Analysis', duration: 3, dependencies: ['Market Research'] },
            { name: 'Campaign Strategy', duration: 2, dependencies: ['Target Audience Analysis'] }
          ]
        },
        {
          id: 'creative',
          name: 'Creative Development',
          duration: 15,
          tasks: [
            { name: 'Creative Brief', duration: 2, dependencies: [] },
            { name: 'Design Concepts', duration: 5, dependencies: ['Creative Brief'] },
            { name: 'Content Creation', duration: 8, dependencies: ['Design Concepts'] }
          ]
        },
        {
          id: 'execution',
          name: 'Campaign Execution',
          duration: 20,
          tasks: [
            { name: 'Media Planning', duration: 3, dependencies: [] },
            { name: 'Campaign Launch', duration: 1, dependencies: ['Media Planning'] },
            { name: 'Campaign Monitoring', duration: 16, dependencies: ['Campaign Launch'] }
          ]
        },
        {
          id: 'analysis',
          name: 'Performance Analysis',
          duration: 5,
          tasks: [
            { name: 'Data Collection', duration: 2, dependencies: [] },
            { name: 'Performance Analysis', duration: 2, dependencies: ['Data Collection'] },
            { name: 'Campaign Report', duration: 1, dependencies: ['Performance Analysis'] }
          ]
        }
      ],
      roles: ['marketing_manager', 'creative_director', 'copywriter', 'designer', 'analyst'],
      deliverables: ['Campaign Strategy', 'Creative Assets', 'Media Plan', 'Performance Report'],
      riskFactors: ['Budget Constraints', 'Market Competition', 'Creative Approval Delays']
    });

    // Product Launch Template
    this.registerProjectTemplate('product_launch', {
      name: 'Product Launch',
      description: 'End-to-end product launch project',
      phases: [
        {
          id: 'preparation',
          name: 'Launch Preparation',
          duration: 14,
          tasks: [
            { name: 'Product Finalization', duration: 5, dependencies: [] },
            { name: 'Marketing Materials', duration: 7, dependencies: [] },
            { name: 'Sales Training', duration: 3, dependencies: ['Product Finalization'] },
            { name: 'Distribution Setup', duration: 4, dependencies: ['Product Finalization'] }
          ]
        },
        {
          id: 'launch',
          name: 'Product Launch',
          duration: 7,
          tasks: [
            { name: 'Launch Event', duration: 1, dependencies: [] },
            { name: 'Media Outreach', duration: 3, dependencies: ['Launch Event'] },
            { name: 'Customer Communication', duration: 2, dependencies: ['Launch Event'] },
            { name: 'Sales Activation', duration: 1, dependencies: ['Launch Event'] }
          ]
        },
        {
          id: 'monitoring',
          name: 'Post-Launch Monitoring',
          duration: 30,
          tasks: [
            { name: 'Performance Tracking', duration: 30, dependencies: [] },
            { name: 'Customer Feedback', duration: 30, dependencies: [] },
            { name: 'Issue Resolution', duration: 30, dependencies: [] }
          ]
        }
      ],
      roles: ['product_manager', 'marketing_manager', 'sales_manager', 'support_manager'],
      deliverables: ['Launch Plan', 'Marketing Kit', 'Training Materials', 'Launch Report'],
      riskFactors: ['Product Quality', 'Market Readiness', 'Competitive Response']
    });

    logger.info('Default project templates initialized', {
      templateCount: this.projectTemplates.size
    });
  }

  /**
   * Register a project template
   */
  registerProjectTemplate(templateId, template) {
    this.projectTemplates.set(templateId, {
      ...template,
      id: templateId,
      createdAt: new Date()
    });

    logger.info('Project template registered', { templateId });
  }

  /**
   * Create a new project from template
   */
  async createProject(projectData) {
    try {
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
        customPhases = null
      } = projectData;

      // Validate required fields
      if (!name || !managerId || !orgId || !createdBy) {
        throw new Error('name, managerId, orgId, and createdBy are required');
      }

      // Get template if specified
      let template = null;
      if (templateId) {
        template = this.projectTemplates.get(templateId);
        if (!template) {
          throw new Error(`Project template not found: ${templateId}`);
        }
      }

      // Generate project ID
      const projectId = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create project structure
      const project = {
        id: projectId,
        name,
        description,
        templateId,
        managerId,
        teamMembers,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        budget,
        priority,
        status: 'planning',
        progress: 0,
        phases: customPhases || (template ? this.generatePhasesFromTemplate(template, startDate) : []),
        tasks: [],
        milestones: [],
        risks: template ? template.riskFactors.map(risk => ({
          id: `risk_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          description: risk,
          probability: 'medium',
          impact: 'medium',
          status: 'identified',
          mitigation: '',
          owner: null
        })) : [],
        resources: {
          allocated: [],
          budget: budget || 0,
          spent: 0
        },
        collaboration: {
          chatEnabled: true,
          documentsShared: [],
          meetings: []
        },
        orgId,
        createdBy,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Store the project
      this.activeProjects.set(projectId, project);

      // Create tasks from template phases
      if (template) {
        await this.createTasksFromTemplate(projectId, template, startDate);
      }

      // Set up collaboration room
      await this.setupCollaborationRoom(projectId, project);

      // Send notifications to team members
      if (this.notificationManager && teamMembers.length > 0) {
        await this.notificationManager.sendNotification({
          type: 'project_created',
          title: 'New Project Created',
          message: `You have been added to project: ${name}`,
          recipients: teamMembers,
          priority: 'normal',
          channels: ['in_app', 'email'],
          data: { project },
          actionUrl: `/projects/${projectId}`,
          orgId,
          createdBy
        });
      }

      // Emit business event
      if (this.eventSystem) {
        await this.eventSystem.emit('project.created', {
          project,
          teamMembers,
          createdBy,
          orgId
        });
      }

      // Real-time update
      if (this.socketManager) {
        this.socketManager.broadcastToOrganization(orgId, 'project_created', {
          projectId,
          projectName: name,
          managerId,
          teamMembers,
          createdBy
        });
      }

      logger.info('Project created', {
        projectId,
        name,
        templateId,
        managerId,
        teamSize: teamMembers.length
      });

      return {
        success: true,
        project
      };

    } catch (error) {
      logger.error('Failed to create project', {
        error: error.message,
        projectData
      });
      throw error;
    }
  }

  /**
   * Generate phases from template
   */
  generatePhasesFromTemplate(template, startDate) {
    const phases = [];
    let currentDate = new Date(startDate);

    for (const templatePhase of template.phases) {
      const phase = {
        id: templatePhase.id,
        name: templatePhase.name,
        startDate: new Date(currentDate),
        endDate: new Date(currentDate.getTime() + templatePhase.duration * 24 * 60 * 60 * 1000),
        duration: templatePhase.duration,
        status: 'not_started',
        progress: 0,
        tasks: [],
        dependencies: templatePhase.dependencies || []
      };

      phases.push(phase);
      currentDate = new Date(phase.endDate.getTime() + 24 * 60 * 60 * 1000); // Next day
    }

    return phases;
  }

  /**
   * Create tasks from template
   */
  async createTasksFromTemplate(projectId, template, startDate) {
    try {
      const project = this.activeProjects.get(projectId);
      if (!project) return;

      let taskStartDate = new Date(startDate);

      for (const phase of template.phases) {
        for (const templateTask of phase.tasks) {
          const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          const task = {
            id: taskId,
            title: templateTask.name,
            description: `Task from ${template.name} template`,
            projectId,
            phaseId: phase.id,
            assigneeId: null, // To be assigned later
            status: 'todo',
            priority: 'medium',
            startDate: new Date(taskStartDate),
            dueDate: new Date(taskStartDate.getTime() + templateTask.duration * 24 * 60 * 60 * 1000),
            estimatedHours: templateTask.duration * 8, // 8 hours per day
            actualHours: 0,
            progress: 0,
            dependencies: templateTask.dependencies || [],
            tags: [phase.id, 'template'],
            attachments: [],
            comments: [],
            createdBy: project.createdBy,
            createdAt: new Date()
          };

          project.tasks.push(task);
          taskStartDate = new Date(task.dueDate.getTime() + 24 * 60 * 60 * 1000);
        }
      }

      logger.info('Tasks created from template', {
        projectId,
        templateId: template.id,
        taskCount: project.tasks.length
      });

    } catch (error) {
      logger.error('Failed to create tasks from template', {
        error: error.message,
        projectId,
        templateId: template.id
      });
    }
  }

  /**
   * Setup collaboration room for project
   */
  async setupCollaborationRoom(projectId, project) {
    try {
      const collaborationRoom = {
        id: `collab_${projectId}`,
        projectId,
        name: `${project.name} - Collaboration`,
        members: [project.managerId, ...project.teamMembers],
        channels: [
          {
            id: 'general',
            name: 'General Discussion',
            type: 'text',
            messages: []
          },
          {
            id: 'updates',
            name: 'Project Updates',
            type: 'announcements',
            messages: []
          },
          {
            id: 'files',
            name: 'File Sharing',
            type: 'files',
            files: []
          }
        ],
        settings: {
          allowFileSharing: true,
          allowVideoChat: true,
          notificationsEnabled: true
        },
        createdAt: new Date()
      };

      this.collaborationRooms.set(projectId, collaborationRoom);

      logger.info('Collaboration room setup', {
        projectId,
        roomId: collaborationRoom.id,
        memberCount: collaborationRoom.members.length
      });

    } catch (error) {
      logger.error('Failed to setup collaboration room', {
        error: error.message,
        projectId
      });
    }
  }

  /**
   * Assign task to team member
   */
  async assignTask(projectId, taskId, assigneeId, assignedBy) {
    try {
      const project = this.activeProjects.get(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const task = project.tasks.find(t => t.id === taskId);
      if (!task) {
        throw new Error('Task not found');
      }

      // Check if assignee is part of the project team
      if (!project.teamMembers.includes(assigneeId) && project.managerId !== assigneeId) {
        throw new Error('Assignee is not part of the project team');
      }

      // Update task
      task.assigneeId = assigneeId;
      task.assignedBy = assignedBy;
      task.assignedAt = new Date();
      task.status = 'assigned';

      // Update project
      project.updatedAt = new Date();

      // Send notification to assignee
      if (this.notificationManager) {
        await this.notificationManager.sendNotification({
          type: 'task_assigned',
          title: 'Task Assigned',
          message: `You have been assigned a task: ${task.title}`,
          recipients: [assigneeId],
          priority: task.priority === 'high' ? 'high' : 'normal',
          channels: ['in_app', 'email'],
          data: { task, project },
          actionUrl: `/projects/${projectId}/tasks/${taskId}`,
          orgId: project.orgId,
          createdBy: assignedBy
        });
      }

      // Emit business event
      if (this.eventSystem) {
        await this.eventSystem.emit('task.assigned', {
          task,
          project,
          assigneeId,
          assignedBy,
          orgId: project.orgId
        });
      }

      // Real-time update
      if (this.socketManager) {
        this.socketManager.broadcastToOrganization(project.orgId, 'task_assigned', {
          projectId,
          taskId,
          assigneeId,
          taskTitle: task.title
        });
      }

      logger.info('Task assigned', {
        projectId,
        taskId,
        assigneeId,
        assignedBy
      });

      return { success: true, task };

    } catch (error) {
      logger.error('Failed to assign task', {
        error: error.message,
        projectId,
        taskId,
        assigneeId
      });
      throw error;
    }
  }

  /**
   * Update task status
   */
  async updateTaskStatus(projectId, taskId, status, updatedBy, comments = '') {
    try {
      const project = this.activeProjects.get(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const task = project.tasks.find(t => t.id === taskId);
      if (!task) {
        throw new Error('Task not found');
      }

      const oldStatus = task.status;
      task.status = status;
      task.updatedBy = updatedBy;
      task.updatedAt = new Date();

      // Add comment if provided
      if (comments) {
        task.comments.push({
          id: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          text: comments,
          author: updatedBy,
          createdAt: new Date()
        });
      }

      // Update progress based on status
      switch (status) {
        case 'in_progress':
          task.progress = Math.max(task.progress, 10);
          break;
        case 'completed':
          task.progress = 100;
          task.completedAt = new Date();
          break;
        case 'blocked':
          // Keep current progress
          break;
      }

      // Update project progress
      await this.updateProjectProgress(projectId);

      // Send notifications
      if (this.notificationManager) {
        const recipients = [];
        
        // Notify project manager
        if (project.managerId !== updatedBy) {
          recipients.push(project.managerId);
        }
        
        // Notify task assignee if different from updater
        if (task.assigneeId && task.assigneeId !== updatedBy) {
          recipients.push(task.assigneeId);
        }

        if (recipients.length > 0) {
          await this.notificationManager.sendNotification({
            type: 'task_status_updated',
            title: 'Task Status Updated',
            message: `Task "${task.title}" status changed from ${oldStatus} to ${status}`,
            recipients,
            priority: 'normal',
            channels: ['in_app'],
            data: { task, project, oldStatus, newStatus: status },
            actionUrl: `/projects/${projectId}/tasks/${taskId}`,
            orgId: project.orgId,
            createdBy: updatedBy
          });
        }
      }

      // Emit business event
      if (this.eventSystem) {
        await this.eventSystem.emit('task.status_updated', {
          task,
          project,
          oldStatus,
          newStatus: status,
          updatedBy,
          orgId: project.orgId
        });
      }

      // Real-time update
      if (this.socketManager) {
        this.socketManager.broadcastToOrganization(project.orgId, 'task_status_updated', {
          projectId,
          taskId,
          status,
          progress: task.progress,
          updatedBy
        });
      }

      logger.info('Task status updated', {
        projectId,
        taskId,
        oldStatus,
        newStatus: status,
        updatedBy
      });

      return { success: true, task };

    } catch (error) {
      logger.error('Failed to update task status', {
        error: error.message,
        projectId,
        taskId,
        status
      });
      throw error;
    }
  }

  /**
   * Update project progress
   */
  async updateProjectProgress(projectId) {
    try {
      const project = this.activeProjects.get(projectId);
      if (!project) return;

      const totalTasks = project.tasks.length;
      if (totalTasks === 0) {
        project.progress = 0;
        return;
      }

      const totalProgress = project.tasks.reduce((sum, task) => sum + task.progress, 0);
      project.progress = Math.round(totalProgress / totalTasks);

      // Update project status based on progress
      if (project.progress === 0) {
        project.status = 'planning';
      } else if (project.progress < 100) {
        project.status = 'in_progress';
      } else {
        project.status = 'completed';
        project.completedAt = new Date();
      }

      project.updatedAt = new Date();

      logger.info('Project progress updated', {
        projectId,
        progress: project.progress,
        status: project.status
      });

    } catch (error) {
      logger.error('Failed to update project progress', {
        error: error.message,
        projectId
      });
    }
  }

  /**
   * Add team member to project
   */
  async addTeamMember(projectId, memberId, addedBy, role = 'member') {
    try {
      const project = this.activeProjects.get(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      // Check if member is already in the team
      if (project.teamMembers.includes(memberId)) {
        throw new Error('Member is already part of the project team');
      }

      // Add member to team
      project.teamMembers.push(memberId);
      project.updatedAt = new Date();

      // Add to collaboration room
      const collaborationRoom = this.collaborationRooms.get(projectId);
      if (collaborationRoom) {
        collaborationRoom.members.push(memberId);
      }

      // Send notification to new member
      if (this.notificationManager) {
        await this.notificationManager.sendNotification({
          type: 'project_team_added',
          title: 'Added to Project Team',
          message: `You have been added to project: ${project.name}`,
          recipients: [memberId],
          priority: 'normal',
          channels: ['in_app', 'email'],
          data: { project, role },
          actionUrl: `/projects/${projectId}`,
          orgId: project.orgId,
          createdBy: addedBy
        });
      }

      // Emit business event
      if (this.eventSystem) {
        await this.eventSystem.emit('project.member_added', {
          project,
          memberId,
          role,
          addedBy,
          orgId: project.orgId
        });
      }

      logger.info('Team member added to project', {
        projectId,
        memberId,
        addedBy,
        role
      });

      return { success: true, project };

    } catch (error) {
      logger.error('Failed to add team member', {
        error: error.message,
        projectId,
        memberId
      });
      throw error;
    }
  }

  /**
   * Get project analytics
   */
  async getProjectAnalytics(orgId, timeframe = 30) {
    try {
      const since = new Date(Date.now() - timeframe * 24 * 60 * 60 * 1000);
      const orgProjects = Array.from(this.activeProjects.values())
        .filter(p => p.orgId === orgId && p.createdAt >= since);

      const analytics = {
        totalProjects: orgProjects.length,
        activeProjects: orgProjects.filter(p => p.status === 'in_progress').length,
        completedProjects: orgProjects.filter(p => p.status === 'completed').length,
        plannedProjects: orgProjects.filter(p => p.status === 'planning').length,
        averageProgress: orgProjects.length > 0 
          ? Math.round(orgProjects.reduce((sum, p) => sum + p.progress, 0) / orgProjects.length)
          : 0,
        totalTasks: orgProjects.reduce((sum, p) => sum + p.tasks.length, 0),
        completedTasks: orgProjects.reduce((sum, p) => 
          sum + p.tasks.filter(t => t.status === 'completed').length, 0),
        overdueTasks: orgProjects.reduce((sum, p) => 
          sum + p.tasks.filter(t => t.dueDate < new Date() && t.status !== 'completed').length, 0),
        projectsByTemplate: {},
        resourceUtilization: this.calculateResourceUtilization(orgId),
        timeframe: `${timeframe} days`,
        generatedAt: new Date()
      };

      // Count projects by template
      orgProjects.forEach(project => {
        const template = project.templateId || 'custom';
        analytics.projectsByTemplate[template] = 
          (analytics.projectsByTemplate[template] || 0) + 1;
      });

      return analytics;

    } catch (error) {
      logger.error('Failed to get project analytics', {
        error: error.message,
        orgId
      });
      throw error;
    }
  }

  /**
   * Calculate resource utilization
   */
  calculateResourceUtilization(orgId) {
    try {
      const orgProjects = Array.from(this.activeProjects.values())
        .filter(p => p.orgId === orgId && p.status === 'in_progress');

      const resourceMap = new Map();

      orgProjects.forEach(project => {
        // Count project manager
        if (project.managerId) {
          resourceMap.set(project.managerId, 
            (resourceMap.get(project.managerId) || 0) + 1);
        }

        // Count team members
        project.teamMembers.forEach(memberId => {
          resourceMap.set(memberId, 
            (resourceMap.get(memberId) || 0) + 1);
        });
      });

      const utilization = {
        totalResources: resourceMap.size,
        averageProjectsPerResource: resourceMap.size > 0 
          ? Array.from(resourceMap.values()).reduce((sum, count) => sum + count, 0) / resourceMap.size
          : 0,
        overallocatedResources: Array.from(resourceMap.values()).filter(count => count > 3).length,
        resourceDistribution: Array.from(resourceMap.entries()).map(([resourceId, projectCount]) => ({
          resourceId,
          projectCount,
          utilization: projectCount > 3 ? 'high' : projectCount > 1 ? 'medium' : 'low'
        }))
      };

      return utilization;

    } catch (error) {
      logger.error('Failed to calculate resource utilization', {
        error: error.message,
        orgId
      });
      return {
        totalResources: 0,
        averageProjectsPerResource: 0,
        overallocatedResources: 0,
        resourceDistribution: []
      };
    }
  }

  /**
   * Get project by ID
   */
  getProject(projectId) {
    return this.activeProjects.get(projectId);
  }

  /**
   * Get projects for organization
   */
  getProjectsForOrg(orgId) {
    return Array.from(this.activeProjects.values())
      .filter(p => p.orgId === orgId);
  }

  /**
   * Get projects for user
   */
  getProjectsForUser(userId) {
    return Array.from(this.activeProjects.values())
      .filter(p => p.managerId === userId || p.teamMembers.includes(userId));
  }

  /**
   * Get available project templates
   */
  getProjectTemplates() {
    return Array.from(this.projectTemplates.values());
  }

  /**
   * Get collaboration room for project
   */
  getCollaborationRoom(projectId) {
    return this.collaborationRooms.get(projectId);
  }

  /**
   * Get system statistics
   */
  getSystemStats() {
    return {
      activeProjects: this.activeProjects.size,
      projectTemplates: this.projectTemplates.size,
      collaborationRooms: this.collaborationRooms.size,
      resourceAllocations: this.resourceAllocations.size,
      timestamp: new Date()
    };
  }
}

export default ProjectManagementSystem;