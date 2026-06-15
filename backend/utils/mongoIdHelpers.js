import mongoose from 'mongoose';

export function toObjectIdIfValid(id) {
  if (id == null || id === '') return null;
  const s = String(id);
  if (!mongoose.Types.ObjectId.isValid(s)) return null;
  return new mongoose.Types.ObjectId(s);
}

/** Match userId stored as string or ObjectId. */
export function userIdMatchFilter(userId) {
  const s = String(userId);
  const oid = toObjectIdIfValid(s);
  if (oid) {
    return { $or: [{ userId: oid }, { userId: s }] };
  }
  return { userId: s };
}

export function employeeIdMatchFilter(employeeId) {
  const s = String(employeeId);
  const oid = toObjectIdIfValid(s);
  if (oid) {
    return { $or: [{ employeeId: oid }, { employeeId: s }, { _id: oid }] };
  }
  return { $or: [{ employeeId: s }, { _id: s }] };
}

export function callerAuthUserIds(req) {
  return [
    ...new Set(
      [req.user?.userId, req.user?.id, req.user?._id]
        .filter(Boolean)
        .map((v) => String(v))
    ),
  ];
}

export function isSelfServiceUser(req, targetUserId) {
  return callerAuthUserIds(req).includes(String(targetUserId));
}
