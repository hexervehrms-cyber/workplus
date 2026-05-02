/**
 * Socket.IO Event Emitter for Global Data Synchronization
 * Emits events when CRUD operations occur to update all connected dashboards
 */

/**
 * Emit dashboard update event to all connected clients
 * @param {Object} io - Socket.IO server instance
 * @param {string} eventType - Type of update (create, update, delete)
 * @param {string} entityType - Type of entity (employee, organization, leave, etc.)
 * @param {Object} data - Updated data
 * @param {string} orgId - Organization ID for filtering
 */
export const emitDashboardUpdate = (io, eventType, entityType, data, orgId = null) => {
  try {
    if (!io) {
      console.warn('Socket.IO instance not available for dashboard update');
      return;
    }

    const updatePayload = {
      type: 'stats',
      component: entityType,
      eventType,
      data,
      timestamp: new Date(),
      orgId
    };

    // Emit to all connected clients
    io.emit('dashboard_update', updatePayload);

    // Emit to specific organization if orgId provided
    if (orgId) {
      io.to(`tenant_${orgId}`).emit('dashboard_update', updatePayload);
    }

    // Emit to role-based rooms
    io.to('super_admin').emit('dashboard_update', updatePayload);
    io.to('admin').emit('dashboard_update', updatePayload);
    
    console.log(`Dashboard update emitted: ${eventType} ${entityType}`, { orgId });
  } catch (error) {
    console.error('Error emitting dashboard update:', error);
  }
};

/**
 * Emit activity update event
 * @param {Object} io - Socket.IO server instance
 * @param {Object} activity - Activity data
 * @param {string} orgId - Organization ID
 */
export const emitActivityUpdate = (io, activity, orgId = null) => {
  try {
    if (!io) {
      console.warn('Socket.IO instance not available for activity update');
      return;
    }

    const activityPayload = {
      ...activity,
      timestamp: new Date()
    };

    // Emit to all connected clients
    io.emit('activity_update', activityPayload);

    // Emit to specific organization
    if (orgId) {
      io.to(`tenant_${orgId}`).emit('activity_update', activityPayload);
    }

    // Emit to role-based rooms
    io.to('super_admin').emit('activity_update', activityPayload);
    io.to('admin').emit('activity_update', activityPayload);

    console.log('Activity update emitted:', activity.action);
  } catch (error) {
    console.error('Error emitting activity update:', error);
  }
};

/**
 * Emit employee update event
 * @param {Object} io - Socket.IO server instance
 * @param {string} eventType - create, update, delete
 * @param {Object} employee - Employee data
 * @param {string} orgId - Organization ID
 */
export const emitEmployeeUpdate = (io, eventType, employee, orgId) => {
  try {
    if (!io) return;

    const payload = {
      type: eventType,
      employee,
      timestamp: new Date()
    };

    // Emit specific employee event
    io.emit(`employee_${eventType}`, payload);
    
    // Emit to organization
    if (orgId) {
      io.to(`tenant_${orgId}`).emit(`employee_${eventType}`, payload);
    }

    // Emit dashboard update
    emitDashboardUpdate(io, eventType, 'employees', employee, orgId);

    console.log(`Employee ${eventType} emitted:`, employee.name || employee._id);
  } catch (error) {
    console.error('Error emitting employee update:', error);
  }
};

/**
 * Emit leave request update event
 * @param {Object} io - Socket.IO server instance
 * @param {string} eventType - create, update, delete
 * @param {Object} leave - Leave request data
 * @param {string} orgId - Organization ID
 */
export const emitLeaveUpdate = (io, eventType, leave, orgId) => {
  try {
    if (!io) return;

    const payload = {
      type: eventType,
      leave,
      timestamp: new Date()
    };

    // Emit specific leave event
    io.emit(`leave_${eventType}`, payload);
    
    // Emit to organization
    if (orgId) {
      io.to(`tenant_${orgId}`).emit(`leave_${eventType}`, payload);
    }

    // Emit dashboard update
    emitDashboardUpdate(io, eventType, 'leave_requests', leave, orgId);

    console.log(`Leave ${eventType} emitted:`, leave._id);
  } catch (error) {
    console.error('Error emitting leave update:', error);
  }
};

/**
 * Emit attendance update event
 * @param {Object} io - Socket.IO server instance
 * @param {Object} attendance - Attendance data
 * @param {string} orgId - Organization ID
 */
export const emitAttendanceUpdate = (io, attendance, orgId) => {
  try {
    if (!io) return;

    const payload = {
      attendance,
      timestamp: new Date()
    };

    // Emit attendance event
    io.emit('attendance:create', payload);
    
    // Emit to organization
    if (orgId) {
      io.to(`tenant_${orgId}`).emit('attendance:create', payload);
    }

    // Emit dashboard update
    emitDashboardUpdate(io, 'create', 'attendance', attendance, orgId);

    console.log('Attendance update emitted:', attendance._id);
  } catch (error) {
    console.error('Error emitting attendance update:', error);
  }
};

/**
 * Emit organization update event
 * @param {Object} io - Socket.IO server instance
 * @param {string} eventType - create, update, delete
 * @param {Object} organization - Organization data
 */
export const emitOrganizationUpdate = (io, eventType, organization) => {
  try {
    if (!io) return;

    const payload = {
      type: eventType,
      organization,
      timestamp: new Date()
    };

    // Emit to super admins only
    io.to('super_admin').emit(`organization_${eventType}`, payload);

    // Emit dashboard update to super admins
    emitDashboardUpdate(io, eventType, 'organizations', organization);

    console.log(`Organization ${eventType} emitted:`, organization.name || organization._id);
  } catch (error) {
    console.error('Error emitting organization update:', error);
  }
};

/**
 * Emit notification event
 * @param {Object} io - Socket.IO server instance
 * @param {Object} notification - Notification data
 * @param {string} targetUserId - Target user ID (optional)
 * @param {string} orgId - Organization ID (optional)
 */
export const emitNotification = (io, notification, targetUserId = null, orgId = null) => {
  try {
    if (!io) return;

    const payload = {
      ...notification,
      timestamp: new Date()
    };

    if (targetUserId) {
      // Emit to specific user
      io.to(`user_${targetUserId}`).emit('notification', payload);
    } else if (orgId) {
      // Emit to organization
      io.to(`tenant_${orgId}`).emit('notification', payload);
    } else {
      // Emit to all
      io.emit('notification', payload);
    }

    console.log('Notification emitted:', notification.title || notification.message);
  } catch (error) {
    console.error('Error emitting notification:', error);
  }
};

/**
 * Get Socket.IO instance from global
 * @returns {Object|null} Socket.IO server instance
 */
export const getSocketIO = () => {
  return global.io || null;
};

/**
 * Middleware to add socket emitters to request object
 */
export const socketEmitterMiddleware = (req, res, next) => {
  const io = getSocketIO();
  
  req.emitDashboardUpdate = (eventType, entityType, data, orgId) => 
    emitDashboardUpdate(io, eventType, entityType, data, orgId);
  
  req.emitActivityUpdate = (activity, orgId) => 
    emitActivityUpdate(io, activity, orgId);
  
  req.emitEmployeeUpdate = (eventType, employee, orgId) => 
    emitEmployeeUpdate(io, eventType, employee, orgId);
  
  req.emitLeaveUpdate = (eventType, leave, orgId) => 
    emitLeaveUpdate(io, eventType, leave, orgId);
  
  req.emitAttendanceUpdate = (attendance, orgId) => 
    emitAttendanceUpdate(io, attendance, orgId);
  
  req.emitOrganizationUpdate = (eventType, organization) => 
    emitOrganizationUpdate(io, eventType, organization);
  
  req.emitNotification = (notification, targetUserId, orgId) => 
    emitNotification(io, notification, targetUserId, orgId);
  
  next();
};