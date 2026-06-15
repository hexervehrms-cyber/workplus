/**
 * Remove obvious test/fake tenant accounts (keeps @hexerve.com and super_admin).
 *
 *   node backend/scripts/remove-test-accounts.js           # dry run
 *   node backend/scripts/remove-test-accounts.js --apply
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/User.js';
import Employee from '../models/Employee.js';
import Attendance from '../models/Attendance.js';
import LeaveRequest from '../models/LeaveRequest.js';
import Expense from '../models/Expense.js';
import Document from '../models/Document.js';
import Session from '../models/Session.js';
import AuthToken from '../models/AuthToken.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const APPLY = process.argv.includes('--apply');

/** Emails to remove (test / junk signups). */
const TEST_EMAILS = [
  'asdsad@sdgsgd.ad'
].map((e) => e.toLowerCase());

function isTestEmail(email) {
  const e = String(email || '').toLowerCase().trim();
  if (TEST_EMAILS.includes(e)) return true;
  if (/@sdgsgd\.ad$|@example\.com$|@test\.com$|@mailinator\./i.test(e)) return true;
  return false;
}

async function purgeUser(user) {
  const userId = user._id;
  const emp = await Employee.findOne({ userId }).lean();

  const counts = {
    attendance: await Attendance.countDocuments({ userId }),
    leaves: await LeaveRequest.countDocuments({ userId }),
    expenses: await Expense.countDocuments({ userId }),
    documents: await Document.countDocuments({ userId }),
    sessions: await Session.countDocuments({ userId }),
    tokens: await AuthToken.countDocuments({ userId })
  };

  console.log(`  ${user.email} (${user.role})`, counts, emp ? `employee ${emp._id}` : 'no employee');

  if (!APPLY) return;

  if (emp) {
    await Attendance.deleteMany({ $or: [{ userId }, { employeeId: emp._id }] });
    await LeaveRequest.deleteMany({ $or: [{ userId }, { employeeId: emp._id }] });
    await Expense.deleteMany({ $or: [{ userId }, { employeeId: emp._id }] });
    await Employee.deleteOne({ _id: emp._id });
  } else {
    await Attendance.deleteMany({ userId });
    await LeaveRequest.deleteMany({ userId });
    await Expense.deleteMany({ userId });
  }

  await Document.deleteMany({ userId });
  await Session.deleteMany({ userId });
  await AuthToken.deleteMany({ userId });
  await User.deleteOne({ _id: userId });
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(APPLY ? '=== APPLY — deleting test accounts ===' : '=== DRY RUN ===\n');

  const tenants = await User.find({ role: { $ne: 'super_admin' } })
    .select('email role name orgId')
    .lean();

  const toRemove = tenants.filter((u) => isTestEmail(u.email));
  const keep = tenants.filter((u) => !isTestEmail(u.email));

  console.log('Will remove:', toRemove.length);
  for (const u of toRemove) {
    await purgeUser(u);
  }

  console.log('\nKeeping:', keep.length);
  keep.forEach((u) => console.log(`  ${u.email} (${u.role})`));

  if (!APPLY && toRemove.length) {
    console.log('\nRe-run with --apply to delete.');
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
