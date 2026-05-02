/**
 * Advanced Socket.IO Manager for Real-Time Features
 * Handles real-time communication, notifications, and live updates
 */

import logger from "./logger.js";

class SocketManager {
  constructor(io) {
    this.io = io;
    this.connectedUsers = new Map(); // userId -> socketId mapping
    this.userSockets = new Map(); // socketId -> user info mapping
    this.organizationRooms = new Map(); // orgId -> Set of socketIds
    this.departmentRooms = new Map(); // deptId -> Set of socketIds
    this.roleRooms = new Map(); // role -> Set of socketIds
    
    this.setupEventHandlers();
  }

  /**
   * Setup Socket.IO event handlers
   */
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      logger.info('Socket connected', { socketId: socket.id });

      // Handle user authentication
      socket.on('authenticate', (data) => {
        this.authenticateUser(socket, data);
      });

      // Handle joining specific rooms
      socket.on('join_room', (data) => {
        this.joinRoom(socket, data);
      });

      // Handle leaving rooms
      socket.on('leave_room', (data) => {
        this.leaveRoom(socket, data);
      });

      // Handle real-time messaging
      socket.on('send_message', (data) => {
        this.handleMessage(socket, data);
      });

      // Handle typing indicators
      socket.on('typing_start', (data) => {
        this.handleTypingStart(socket, data);
      });

      socket.on('typing_stop', (data) => {
        this.handleTypingStop(socket, data);
      });

      // Handle live attendance updates
      socket.on('attendance_update', (data) => {
        this.handleAttendanceUpdate(socket, data);
      });

      // Handle task updates
      socket.on('task_update', (data) => {
        this.handleTaskUpdate(socket, data);
      });

      // Handle approval requests
      socket.on('approval_request', (data) => {
        this.handleApprovalRequest(socket, data);
      });

      // Handle disconnect
      socket.on('disconnect', (reason) => {
        this.handleDisconnect(socket, reason);
      });

      // Handle errors
      socket.on('error', (error) => {
        logger.error('Socket error', { socketId: socket.id, error: error.message });
      });
    });
  }

  /**
   * Authenticate user and setup rooms
   */
  authenticateUser(socket, data) {
    try {
      const { userId, name, email, role, orgId, departmentId, token } = data;

      // Validate required fields
      if (!userId || !orgId) {
        socket.emit('auth_error', { message: 'Invalid authentication data: missing userId or orgId' });
        return;
      }

      // If token is provided, validate it
      if (token) {
        try {
          // Basic token validation - check if it's a valid JWT format
          const parts = token.split('.');
          if (parts.length !== 3) {
            socket.emit('auth_error', { message: 'Invalid token format' });
            return;
          }
          
          // Try to decode the token
          try {
            const payload = JSON.parse(atob(parts[1]));
            if (!payload.exp || Date.now() >= payload.exp * 1000) {
              socket.emit('auth_error', { message: 'Token expired' });
              return;
            }
          } catch {
            socket.emit('auth_error', { message: 'Invalid token payload' });
            return;
          }
        } catch (error) {
          socket.emit('auth_error', { message: 'Token validation failed' });
          return;
        }
      }

      // Store user information
      const userInfo = {
        userId,
        name: name || 'Unknown',
        email: email || '',
        role,
        orgId,
        departmentId: departmentId || null,
        connectedAt: new Date(),
        lastActivity: new Date()
      };

      this.userSockets.set(socket.id, userInfo);
      this.connectedUsers.set(userId, socket.id);

      // Join organization room
      socket.join(`org_${orgId}`);
      this.addToRoom(this.organizationRooms, orgId, socket.id);

      // Join department room if available
      if (departmentId) {
        socket.join(`dept_${departmentId}`);
        this.addToRoom(this.departmentRooms, departmentId, socket.id);
      }

      // Join role-based room
      socket.join(`role_${role}`);
      this.addToRoom(this.roleRooms, role, socket.id);

      // Join user-specific room
      socket.join(`user_${userId}`);

      logger.info('User authenticated', { 
        socketId: socket.id, 
        userId, 
        orgId, 
        role 
      });

      // Notify user of successful authentication
      socket.emit('authenticated', { 
        success: true, 
        userId,
        connectedUsers: this.getConnectedUsersInOrg(orgId)
      });

      // Notify organization about new user online
      socket.to(`org_${orgId}`).emit('user_online', {
        userId,
        name,
        role,
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Authentication error', { 
        socketId: socket.id, 
        error: error.message 
      });
      socket.emit('auth_error', { message: 'Authentication failed: ' + error.message });
    }
  }

  /**
   * Join a specific room
   */
  joinRoom(socket, data) {
    try {
      const { roomType, roomId } = data;
      const userInfo = this.userSockets.get(socket.id);

      if (!userInfo) {
        socket.emit('error', { message: 'User not authenticated' });
        return;
      }

      const roomName = `${roomType}_${roomId}`;
      socket.join(roomName);

      logger.info('User joined room', {
        userId: userInfo.userId,
        roomName,
        socketId: socket.id
      });

      socket.emit('room_joined', { roomType, roomId, roomName });

    } catch (error) {
      logger.error('Join room error', { 
        socketId: socket.id, 
        error: error.message 
      });
    }
  }

  /**
   * Leave a specific room
   */
  leaveRoom(socket, data) {
    try {
      const { roomType, roomId } = data;
      const roomName = `${roomType}_${roomId}`;
      
      socket.leave(roomName);
      socket.emit('room_left', { roomType, roomId, roomName });

    } catch (error) {
      logger.error('Leave room error', { 
        socketId: socket.id, 
        error: error.message 
      });
    }
  }

  /**
   * Handle real-time messaging
   */
  handleMessage(socket, data) {
    try {
      const userInfo = this.userSockets.get(socket.id);
      if (!userInfo) return;

      const { roomType, roomId, message, messageType = 'text' } = data;
      const roomName = `${roomType}_${roomId}`;

      const messageData = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        message,
        messageType,
        sender: {
          userId: userInfo.userId,
          name: userInfo.name,
          role: userInfo.role
        },
        timestamp: new Date(),
        roomType,
        roomId
      };

      // Broadcast to room
      this.io.to(roomName).emit('new_message', messageData);

      logger.info('Message sent', {
        userId: userInfo.userId,
        roomName,
        messageType
      });

    } catch (error) {
      logger.error('Message handling error', { 
        socketId: socket.id, 
        error: error.message 
      });
    }
  }

  /**
   * Handle typing indicators
   */
  handleTypingStart(socket, data) {
    const userInfo = this.userSockets.get(socket.id);
    if (!userInfo) return;

    const { roomType, roomId } = data;
    const roomName = `${roomType}_${roomId}`;

    socket.to(roomName).emit('user_typing', {
      userId: userInfo.userId,
      name: userInfo.name,
      isTyping: true
    });
  }

  handleTypingStop(socket, data) {
    const userInfo = this.userSockets.get(socket.id);
    if (!userInfo) return;

    const { roomType, roomId } = data;
    const roomName = `${roomType}_${roomId}`;

    socket.to(roomName).emit('user_typing', {
      userId: userInfo.userId,
      name: userInfo.name,
      isTyping: false
    });
  }

  /**
   * Handle live attendance updates
   */
  handleAttendanceUpdate(socket, data) {
    try {
      const userInfo = this.userSockets.get(socket.id);
      if (!userInfo) return;

      const { type, employeeId, timestamp, location } = data;

      const attendanceData = {
        type, // 'check_in', 'check_out', 'break_start', 'break_end'
        employeeId,
        timestamp: timestamp || new Date(),
        location,
        updatedBy: userInfo.userId
      };

      // Broadcast to organization
      this.io.to(`org_${userInfo.orgId}`).emit('attendance_updated', attendanceData);

      // Broadcast to managers/HR
      this.io.to('role_admin').emit('attendance_updated', attendanceData);
      this.io.to('role_hr').emit('attendance_updated', attendanceData);
      this.io.to('role_manager').emit('attendance_updated', attendanceData);

      logger.info('Attendance update broadcasted', {
        type,
        employeeId,
        orgId: userInfo.orgId
      });

    } catch (error) {
      logger.error('Attendance update error', { 
        socketId: socket.id, 
        error: error.message 
      });
    }
  }

  /**
   * Handle task updates
   */
  handleTaskUpdate(socket, data) {
    try {
      const userInfo = this.userSockets.get(socket.id);
      if (!userInfo) return;

      const { taskId, status, assigneeId, projectId } = data;

      const taskUpdateData = {
        taskId,
        status,
        assigneeId,
        projectId,
        updatedBy: userInfo.userId,
        updatedAt: new Date()
      };

      // Notify task assignee
      if (assigneeId) {
        this.io.to(`user_${assigneeId}`).emit('task_updated', taskUpdateData);
      }

      // Notify project team
      if (projectId) {
        this.io.to(`project_${projectId}`).emit('task_updated', taskUpdateData);
      }

      // Notify organization
      this.io.to(`org_${userInfo.orgId}`).emit('task_updated', taskUpdateData);

      logger.info('Task update broadcasted', {
        taskId,
        status,
        orgId: userInfo.orgId
      });

    } catch (error) {
      logger.error('Task update error', { 
        socketId: socket.id, 
        error: error.message 
      });
    }
  }

  /**
   * Handle approval requests
   */
  handleApprovalRequest(socket, data) {
    try {
      const userInfo = this.userSockets.get(socket.id);
      if (!userInfo) return;

      const { 
        requestType, 
        requestId, 
        approverId, 
        requestData,
        priority = 'normal'
      } = data;

      const approvalData = {
        requestType, // 'leave', 'expense', 'timeoff', etc.
        requestId,
        requestData,
        priority,
        requestedBy: userInfo.userId,
        requestedAt: new Date()
      };

      // Notify specific approver
      if (approverId) {
        this.io.to(`user_${approverId}`).emit('approval_request', approvalData);
      }

      // Notify all managers/admins in organization
      this.io.to(`org_${userInfo.orgId}`).to('role_manager').emit('approval_request', approvalData);
      this.io.to(`org_${userInfo.orgId}`).to('role_admin').emit('approval_request', approvalData);

      logger.info('Approval request sent', {
        requestType,
        requestId,
        approverId,
        orgId: userInfo.orgId
      });

    } catch (error) {
      logger.error('Approval request error', { 
        socketId: socket.id, 
        error: error.message 
      });
    }
  }

  /**
   * Handle user disconnect
   */
  handleDisconnect(socket, reason) {
    try {
      const userInfo = this.userSockets.get(socket.id);
      
      if (userInfo) {
        const { userId, orgId, name, role } = userInfo;

        // Remove from tracking
        this.connectedUsers.delete(userId);
        this.userSockets.delete(socket.id);

        // Remove from room tracking
        this.removeFromRoom(this.organizationRooms, orgId, socket.id);
        if (userInfo.departmentId) {
          this.removeFromRoom(this.departmentRooms, userInfo.departmentId, socket.id);
        }
        this.removeFromRoom(this.roleRooms, role, socket.id);

        // Notify organization about user offline
        socket.to(`org_${orgId}`).emit('user_offline', {
          userId,
          name,
          role,
          timestamp: new Date(),
          reason
        });

        logger.info('User disconnected', { 
          socketId: socket.id, 
          userId, 
          reason,
          connectedDuration: Date.now() - userInfo.connectedAt.getTime()
        });
      }

    } catch (error) {
      logger.error('Disconnect handling error', { 
        socketId: socket.id, 
        error: error.message 
      });
    }
  }

  /**
   * Broadcast notification to specific users
   */
  broadcastNotification(userIds, notification) {
    try {
      userIds.forEach(userId => {
        const socketId = this.connectedUsers.get(userId);
        if (socketId) {
          this.io.to(`user_${userId}`).emit('notification', {
            ...notification,
            timestamp: new Date()
          });
        }
      });

      logger.info('Notification broadcasted', {
        userCount: userIds.length,
        type: notification.type
      });

    } catch (error) {
      logger.error('Notification broadcast error', { error: error.message });
    }
  }

  /**
   * Broadcast to organization
   */
  broadcastToOrganization(orgId, event, data) {
    try {
      this.io.to(`org_${orgId}`).emit(event, {
        ...data,
        timestamp: new Date()
      });

      logger.info('Organization broadcast', { orgId, event });

    } catch (error) {
      logger.error('Organization broadcast error', { error: error.message });
    }
  }

  /**
   * Broadcast to role
   */
  broadcastToRole(role, event, data) {
    try {
      this.io.to(`role_${role}`).emit(event, {
        ...data,
        timestamp: new Date()
      });

      logger.info('Role broadcast', { role, event });

    } catch (error) {
      logger.error('Role broadcast error', { error: error.message });
    }
  }

  /**
   * Get connected users in organization
   */
  getConnectedUsersInOrg(orgId) {
    const connectedUsers = [];
    
    for (const [socketId, userInfo] of this.userSockets.entries()) {
      if (userInfo.orgId === orgId) {
        connectedUsers.push({
          userId: userInfo.userId,
          name: userInfo.name,
          role: userInfo.role,
          connectedAt: userInfo.connectedAt,
          lastActivity: userInfo.lastActivity
        });
      }
    }

    return connectedUsers;
  }

  /**
   * Get connection statistics
   */
  getConnectionStats() {
    const stats = {
      totalConnections: this.userSockets.size,
      organizationCounts: {},
      roleCounts: {},
      departmentCounts: {}
    };

    for (const [socketId, userInfo] of this.userSockets.entries()) {
      // Count by organization
      stats.organizationCounts[userInfo.orgId] = 
        (stats.organizationCounts[userInfo.orgId] || 0) + 1;

      // Count by role
      stats.roleCounts[userInfo.role] = 
        (stats.roleCounts[userInfo.role] || 0) + 1;

      // Count by department
      if (userInfo.departmentId) {
        stats.departmentCounts[userInfo.departmentId] = 
          (stats.departmentCounts[userInfo.departmentId] || 0) + 1;
      }
    }

    return stats;
  }

  /**
   * Helper methods
   */
  addToRoom(roomMap, roomId, socketId) {
    if (!roomMap.has(roomId)) {
      roomMap.set(roomId, new Set());
    }
    roomMap.get(roomId).add(socketId);
  }

  removeFromRoom(roomMap, roomId, socketId) {
    if (roomMap.has(roomId)) {
      roomMap.get(roomId).delete(socketId);
      if (roomMap.get(roomId).size === 0) {
        roomMap.delete(roomId);
      }
    }
  }

  /**
   * Update user activity
   */
  updateUserActivity(socketId) {
    const userInfo = this.userSockets.get(socketId);
    if (userInfo) {
      userInfo.lastActivity = new Date();
    }
  }

  /**
   * Check if user is online
   */
  isUserOnline(userId) {
    return this.connectedUsers.has(userId);
  }

  /**
   * Get user's socket ID
   */
  getUserSocketId(userId) {
    return this.connectedUsers.get(userId);
  }
}

export default SocketManager;