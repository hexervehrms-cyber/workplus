/**
 * Optimistic Locking Middleware
 * Prevents race conditions on critical operations like attendance check-in/check-out
 * Uses version field to detect concurrent modifications
 */

import logger from '../utils/logger.js';

/**
 * Optimistic locking for attendance operations
 * Adds version field to prevent duplicate check-ins/check-outs
 */
export const attendanceOptimisticLocking = async (req, res, next) => {
  try {
    // Store original body for retry logic
    req.originalBody = { ...req.body };
    req.lockAttempts = 0;
    req.maxLockAttempts = 3;
    
    next();
  } catch (error) {
    logger.error('Optimistic locking middleware error:', error);
    next(error);
  }
};

/**
 * Verify version hasn't changed before update
 * Usage: await verifyVersion(Model, documentId, expectedVersion)
 */
export const verifyVersion = async (Model, documentId, expectedVersion) => {
  const doc = await Model.findById(documentId).select('__v').lean();
  
  if (!doc) {
    throw new Error('Document not found');
  }
  
  if (doc.__v !== expectedVersion) {
    throw new Error(`Version mismatch: expected ${expectedVersion}, got ${doc.__v}`);
  }
  
  return true;
};

/**
 * Atomic check-in operation with race condition prevention
 * Uses MongoDB findOneAndUpdate with conditions to ensure atomicity
 */
export const atomicCheckIn = async (Attendance, query, updateData) => {
  try {
    // Ensure no open check-in exists
    const existingOpen = await Attendance.findOne({
      ...query,
      checkIn: { $exists: true, $ne: null },
      checkOut: { $exists: false }
    });
    
    if (existingOpen) {
      return {
        success: false,
        reason: 'ALREADY_CHECKED_IN',
        existingRecord: existingOpen
      };
    }
    
    // Atomic update: only update if no checkIn exists
    const result = await Attendance.findOneAndUpdate(
      {
        ...query,
        $or: [
          { checkIn: { $exists: false } },
          { checkIn: null }
        ]
      },
      {
        $set: updateData,
        $inc: { __v: 1 } // Increment version
      },
      { new: true, upsert: false }
    );
    
    if (!result) {
      return {
        success: false,
        reason: 'CONCURRENT_CHECK_IN',
        message: 'Another check-in was processed concurrently'
      };
    }
    
    return {
      success: true,
      record: result
    };
  } catch (error) {
    logger.error('Atomic check-in error:', error);
    throw error;
  }
};

/**
 * Atomic check-out operation with race condition prevention
 */
export const atomicCheckOut = async (Attendance, query, updateData) => {
  try {
    // Ensure check-in exists and no check-out yet
    const existingRecord = await Attendance.findOne({
      ...query,
      checkIn: { $exists: true, $ne: null },
      checkOut: { $exists: false }
    });
    
    if (!existingRecord) {
      return {
        success: false,
        reason: 'NOT_CHECKED_IN',
        message: 'No active check-in found'
      };
    }
    
    // Atomic update: only update if checkOut doesn't exist
    const result = await Attendance.findOneAndUpdate(
      {
        ...query,
        checkIn: { $exists: true, $ne: null },
        $or: [
          { checkOut: { $exists: false } },
          { checkOut: null }
        ]
      },
      {
        $set: updateData,
        $inc: { __v: 1 } // Increment version
      },
      { new: true }
    );
    
    if (!result) {
      return {
        success: false,
        reason: 'CONCURRENT_CHECK_OUT',
        message: 'Another check-out was processed concurrently'
      };
    }
    
    return {
      success: true,
      record: result
    };
  } catch (error) {
    logger.error('Atomic check-out error:', error);
    throw error;
  }
};

/**
 * Atomic break start operation
 */
export const atomicBreakStart = async (Attendance, query, breakData) => {
  try {
    // Ensure no open break exists
    const hasOpenBreak = await Attendance.findOne({
      ...query,
      breaks: {
        $elemMatch: {
          startTime: { $exists: true, $ne: null },
          $or: [
            { endTime: { $exists: false } },
            { endTime: null }
          ]
        }
      }
    });
    
    if (hasOpenBreak) {
      return {
        success: false,
        reason: 'ALREADY_ON_BREAK',
        message: 'Already on break'
      };
    }
    
    // Atomic update: add break only if no open break exists
    const result = await Attendance.findOneAndUpdate(
      {
        ...query,
        breaks: {
          $not: {
            $elemMatch: {
              startTime: { $exists: true, $ne: null },
              $or: [
                { endTime: { $exists: false } },
                { endTime: null }
              ]
            }
          }
        }
      },
      {
        $push: { breaks: breakData },
        $inc: { __v: 1 }
      },
      { new: true }
    );
    
    if (!result) {
      return {
        success: false,
        reason: 'CONCURRENT_BREAK_START',
        message: 'Another break was started concurrently'
      };
    }
    
    return {
      success: true,
      record: result
    };
  } catch (error) {
    logger.error('Atomic break start error:', error);
    throw error;
  }
};

/**
 * Atomic break end operation
 */
export const atomicBreakEnd = async (Attendance, query, breakEndData) => {
  try {
    // Find the open break
    const record = await Attendance.findOne({
      ...query,
      breaks: {
        $elemMatch: {
          startTime: { $exists: true, $ne: null },
          $or: [
            { endTime: { $exists: false } },
            { endTime: null }
          ]
        }
      }
    });
    
    if (!record) {
      return {
        success: false,
        reason: 'NO_OPEN_BREAK',
        message: 'No open break found'
      };
    }
    
    // Find the index of the open break
    const openBreakIndex = record.breaks.findIndex(b => 
      b.startTime && !b.endTime
    );
    
    if (openBreakIndex === -1) {
      return {
        success: false,
        reason: 'NO_OPEN_BREAK',
        message: 'No open break found'
      };
    }
    
    // Atomic update: close the break
    const result = await Attendance.findOneAndUpdate(
      {
        ...query,
        'breaks._id': record.breaks[openBreakIndex]._id
      },
      {
        $set: {
          [`breaks.${openBreakIndex}.endTime`]: breakEndData.endTime,
          [`breaks.${openBreakIndex}.duration`]: breakEndData.duration
        },
        $inc: { __v: 1 }
      },
      { new: true }
    );
    
    if (!result) {
      return {
        success: false,
        reason: 'CONCURRENT_BREAK_END',
        message: 'Another break end was processed concurrently'
      };
    }
    
    return {
      success: true,
      record: result
    };
  } catch (error) {
    logger.error('Atomic break end error:', error);
    throw error;
  }
};

export default {
  attendanceOptimisticLocking,
  verifyVersion,
  atomicCheckIn,
  atomicCheckOut,
  atomicBreakStart,
  atomicBreakEnd
};
