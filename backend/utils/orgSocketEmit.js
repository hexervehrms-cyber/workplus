/**
 * Emit Socket.IO events to all rooms admins and employees may listen on.
 * Handles orgId string vs ObjectId mismatches between JWT and Employee records.
 */
export function emitOrgRealtime(io, orgIds, event, payload) {
  if (!io) return;
  const rooms = new Set(['management', 'role_admin']);
  const ids = [...new Set((Array.isArray(orgIds) ? orgIds : [orgIds]).map(String).filter(Boolean))];
  for (const id of ids) {
    rooms.add(`tenant_${id}`);
    rooms.add(`role_admin_${id}`);
  }
  for (const room of rooms) {
    io.to(room).emit(event, payload);
  }
}
