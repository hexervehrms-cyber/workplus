/**
 * Multi-tab socket presence — one session row per user+org, many socket ids.
 */
import Session from '../models/Session.js';

/**
 * Register a connected socket for a user (supports multiple tabs).
 */
export async function attachSocketToSession({
  userId,
  orgId,
  role,
  socketId,
  userAgent,
  ipAddress,
}) {
  const tenantOrg = orgId ? String(orgId) : 'system';
  return Session.findOneAndUpdate(
    { userId, orgId: tenantOrg, isActive: true },
    {
      $set: {
        role,
        socketId,
        lastActivityTime: new Date(),
        ...(userAgent ? { userAgent } : {}),
        ...(ipAddress ? { ipAddress } : {}),
      },
      $addToSet: { socketIds: socketId },
      $setOnInsert: {
        userId,
        orgId: tenantOrg,
        loginTime: new Date(),
        isActive: true,
      },
    },
    { upsert: true, new: true }
  );
}

/**
 * Remove one socket; deactivate session only when no sockets remain.
 */
export async function detachSocketFromSession(sessionId, socketId) {
  if (!sessionId || !socketId) return null;

  await Session.findByIdAndUpdate(sessionId, {
    $pull: { socketIds: socketId },
    $set: { lastActivityTime: new Date() },
  });

  const session = await Session.findById(sessionId).lean();
  const hasSockets = Array.isArray(session?.socketIds) && session.socketIds.length > 0;

  if (!hasSockets) {
    await Session.findByIdAndUpdate(sessionId, {
      $set: { isActive: false, socketId: null, socketIds: [] },
    });
    return { ...session, isActive: false, socketIds: [] };
  }

  const latestSocket = session.socketIds[session.socketIds.length - 1];
  await Session.findByIdAndUpdate(sessionId, { $set: { socketId: latestSocket } });
  return session;
}

/** Count users with at least one live socket in a tenant. */
export async function countActiveSocketUsers(orgId, { role } = {}) {
  if (!orgId) return 0;
  const filter = {
    orgId: String(orgId),
    isActive: true,
    'socketIds.0': { $exists: true },
  };
  if (role) filter.role = role;
  return Session.countDocuments(filter);
}

/**
 * Upsert login session row (HTTP login before socket connects).
 */
export async function upsertLoginSession({ userId, orgId, role, ipAddress, userAgent }) {
  const tenantOrg = orgId ? String(orgId) : 'system';
  return Session.findOneAndUpdate(
    { userId, orgId: tenantOrg, isActive: true },
    {
      $set: {
        role,
        lastActivityTime: new Date(),
        ...(ipAddress ? { ipAddress } : {}),
        ...(userAgent ? { userAgent } : {}),
      },
      $setOnInsert: {
        userId,
        orgId: tenantOrg,
        loginTime: new Date(),
        isActive: true,
        socketIds: [],
        socketId: null,
      },
    },
    { upsert: true, new: true }
  );
}
