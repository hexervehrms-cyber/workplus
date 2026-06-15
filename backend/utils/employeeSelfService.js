/**
 * Resolve active Employee for self-service (attendance, profile).
 * Cross-org fallback is opt-in (attendance JWT/org mismatch only).
 */
import Employee from '../models/Employee.js';
import logger from './logger.js';

function isValidAuthOrgId(authOrgId) {
  return Boolean(authOrgId && String(authOrgId) !== 'system');
}

/**
 * @param {string|import('mongoose').Types.ObjectId} currentUserId
 * @param {string} authOrgId
 * @param {{ createIfMissing?: boolean, allowCrossOrgFallback?: boolean }} [options]
 */
export async function findEmployeeForSelfService(
  currentUserId,
  authOrgId,
  { createIfMissing = false, allowCrossOrgFallback = false } = {}
) {
  const uid = String(currentUserId);
  const orgFilter = isValidAuthOrgId(authOrgId) ? { orgId: String(authOrgId) } : {};

  let employee = await Employee.findOne({
    userId: currentUserId,
    ...orgFilter,
    status: 'active'
  })
    .select('_id firstName lastName orgId userId status')
    .lean();

  if (!employee && allowCrossOrgFallback) {
    employee = await Employee.findOne({ userId: currentUserId, status: 'active' })
      .select('_id firstName lastName orgId userId status')
      .sort({ updatedAt: -1 })
      .lean();

    if (
      employee &&
      isValidAuthOrgId(authOrgId) &&
      String(employee.orgId) !== String(authOrgId)
    ) {
      logger.warn('Self-service employee resolved across org boundary', {
        userId: uid,
        authOrgId: String(authOrgId),
        employeeOrgId: String(employee.orgId),
        employeeId: employee._id
      });
    }
  }

  if (!employee) {
    const inactive = await Employee.findOne({ userId: currentUserId })
      .select('_id firstName lastName orgId userId status')
      .sort({ updatedAt: -1 })
      .lean();

    if (inactive) {
      try {
        const reactivateOrg =
          isValidAuthOrgId(authOrgId) && !inactive.orgId
            ? { orgId: String(authOrgId) }
            : {};
        await Employee.updateOne(
          { _id: inactive._id },
          {
            $set: {
              status: 'active',
              ...reactivateOrg
            }
          }
        );
        employee = {
          ...inactive,
          status: 'active',
          orgId: inactive.orgId || (isValidAuthOrgId(authOrgId) ? authOrgId : inactive.orgId)
        };
        logger.info('Reactivated employee for self-service attendance', {
          employeeId: employee._id,
          userId: uid
        });
      } catch (reactivateError) {
        logger.error('Failed to reactivate employee for self-service', {
          userId: uid,
          error: reactivateError.message
        });
      }
    }
  }

  if (!employee && createIfMissing && isValidAuthOrgId(authOrgId)) {
    try {
      const newEmployee = await Employee.create({
        userId: currentUserId,
        orgId: String(authOrgId),
        status: 'active'
      });
      employee = newEmployee.toObject();
      logger.info('Created employee record for self-service', {
        employeeId: employee._id,
        userId: uid,
        orgId: authOrgId
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
          userId: uid,
          orgId: authOrgId,
          error: createError.message
        });
        return null;
      }
    }
  }

  return employee?.status === 'active' ? employee : null;
}
