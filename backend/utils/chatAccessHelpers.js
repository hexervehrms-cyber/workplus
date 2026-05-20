/**
 * Chat multi-tenant access checks — recipient org, message membership, conversation scope.
 */
import User from '../models/User.js';
import ChatGroup from '../models/ChatGroup.js';
import { normalizeAuthOrgId } from './orgScopeHelpers.js';

/** Resolve active user's tenant org id. */
export async function resolveUserTenantOrg(userId) {
  if (!userId) return null;
  const user = await User.findById(userId)
    .select('orgId tenantId organizationId isActive role')
    .lean();
  if (!user || user.isActive === false) return null;
  return normalizeAuthOrgId(user) || null;
}

/**
 * Ensure direct-message recipient belongs to the same tenant as the caller.
 * @returns {{ ok: true } | { ok: false, status: number, message: string }}
 */
export async function assertRecipientInOrg(recipientId, callerOrgId) {
  if (!recipientId || !callerOrgId) {
    return { ok: false, status: 400, message: 'Invalid recipient' };
  }
  const recipientOrg = await resolveUserTenantOrg(recipientId);
  if (!recipientOrg) {
    return { ok: false, status: 404, message: 'Recipient not found' };
  }
  if (String(recipientOrg) !== String(callerOrgId)) {
    return { ok: false, status: 403, message: 'Recipient is not in your organization' };
  }
  return { ok: true };
}

export function isMessageParticipant(message, userId) {
  const uid = String(userId);
  if (String(message.senderId) === uid) return true;
  if (message.recipientId && String(message.recipientId) === uid) return true;
  return (message.channelInfo?.participants || []).some((p) => String(p) === uid);
}

/** Message readable/writable by user within tenant boundary. */
export function canAccessMessage(message, { userId, orgId }) {
  if (!message || message.isDeleted) return false;
  const msgOrg = message.orgId ? String(message.orgId) : null;
  if (!msgOrg || !orgId || msgOrg !== String(orgId)) return false;
  return isMessageParticipant(message, userId);
}

/**
 * Verify user may load a conversation (DM or group) within org.
 */
export async function assertConversationAccess(conversationId, userId, orgId) {
  const conv = String(conversationId);
  if (!conv || !userId || !orgId) {
    return { ok: false, status: 400, message: 'Invalid conversation' };
  }

  if (conv.startsWith('grp_')) {
    const group = await ChatGroup.findOne({ conversationId: conv, orgId: String(orgId) }).lean();
    if (!group || !group.members.some((m) => String(m) === String(userId))) {
      return { ok: false, status: 403, message: 'Access denied to this conversation' };
    }
    return { ok: true, type: 'group' };
  }

  const parts = conv.split('_').filter(Boolean);
  if (parts.length < 2) {
    return { ok: false, status: 400, message: 'Invalid conversation id' };
  }
  const uid = String(userId);
  if (!parts.includes(uid)) {
    return { ok: false, status: 403, message: 'Access denied to this conversation' };
  }
  const otherId = parts.find((p) => p !== uid);
  if (otherId) {
    const check = await assertRecipientInOrg(otherId, orgId);
    if (!check.ok) return { ok: false, status: check.status, message: check.message };
  }
  return { ok: true, type: 'direct' };
}
