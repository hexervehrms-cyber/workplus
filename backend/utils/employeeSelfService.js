/**
 * Resolve active Employee for self-service (attendance, profile).
 * Tolerates JWT orgId !== Employee.orgId.
 */
import Employee from '../models/Employee.js';
import logger from './logger.js';

export async function findEmployeeForSelfService(currentUserId, authOrgId, { createIfMissing = true } = {}) {
  let employee = await Employee.findOne({
    userId: currentUserId,
    orgId: authOrgId,
    status: 'active',
  })
    .select('_id firstName lastName orgId userId')
    .lean();

  if (!employee) {
    employee = await Employee.findOne({ userId: currentUserId, status: 'active' })
      .select('_id firstName lastName orgId userId')
      .sort({ updatedAt: -1 })
      .lean();
  }

  if (!employee && createIfMissing) {
    try {
      const newEmployee = await Employee.create({
        userId: currentUserId,
        orgId: authOrgId,
        status: 'active',
      });
      employee = newEmployee.toObject();
      logger.info('Created employee record for self-service', {
        employeeId: employee._id,
        userId: currentUserId,
        orgId: authOrgId,
      });
    } catch (createError) {
      logger.error('Failed to create employee record for self-service', {
        userId: currentUserId,
        orgId: authOrgId,
        error: createError.message,
      });
      return null;
    }
  }

  return employee;
}
