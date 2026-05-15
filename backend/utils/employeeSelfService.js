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
    .select('_id firstName lastName orgId userId status')
    .lean();

  if (!employee) {
    employee = await Employee.findOne({ userId: currentUserId, status: 'active' })
      .select('_id firstName lastName orgId userId status')
      .sort({ updatedAt: -1 })
      .lean();
  }

  // Inactive row blocks create (unique userId) — reactivate for self-service attendance
  if (!employee) {
    const inactive = await Employee.findOne({ userId: currentUserId })
      .select('_id firstName lastName orgId userId status')
      .sort({ updatedAt: -1 })
      .lean();

    if (inactive) {
      try {
        await Employee.updateOne(
          { _id: inactive._id },
          {
            $set: {
              status: 'active',
              ...(authOrgId && !inactive.orgId ? { orgId: authOrgId } : {}),
            },
          }
        );
        employee = { ...inactive, status: 'active', orgId: inactive.orgId || authOrgId };
        logger.info('Reactivated employee for self-service attendance', {
          employeeId: employee._id,
          userId: currentUserId,
        });
      } catch (reactivateError) {
        logger.error('Failed to reactivate employee for self-service', {
          userId: currentUserId,
          error: reactivateError.message,
        });
      }
    }
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
      if (createError.code === 11000) {
        employee = await Employee.findOne({ userId: currentUserId })
          .select('_id firstName lastName orgId userId status')
          .lean();
        if (employee && employee.status !== 'active') {
          await Employee.updateOne({ _id: employee._id }, { $set: { status: 'active' } });
          employee = { ...employee, status: 'active' };
        }
      }
      if (!employee) {
        logger.error('Failed to create employee record for self-service', {
          userId: currentUserId,
          orgId: authOrgId,
          error: createError.message,
        });
        return null;
      }
    }
  }

  return employee?.status === 'active' ? employee : null;
}
