/**
 * One-time migration: fix tenant records stuck on orgId "system".
 *
 * Usage:
 *   node backend/scripts/migrate-system-orgid.js              # dry run
 *   node backend/scripts/migrate-system-orgid.js --apply      # write changes
 *   node backend/scripts/migrate-system-orgid.js --apply --orgId=<mongoOrgId>
 *
 * Requires MONGODB_URI in backend/.env or environment.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/User.js';
import Employee from '../models/Employee.js';
import Holiday from '../models/Holiday.js';
import Organization from '../models/Organization.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

const APPLY = process.argv.includes('--apply');
const BOOTSTRAP_ORG = process.argv.includes('--bootstrap-org');
const FORCE_ORG = process.argv.find((a) => a.startsWith('--orgId='))?.split('=')[1]?.trim();

const BAD_ORG = new Set(['system', 'workplus_system', '']);

function isBadOrg(id) {
  return !id || BAD_ORG.has(String(id));
}

async function resolveOrgForUser(user, defaultOrg) {
  if (defaultOrg) return defaultOrg;
  if (FORCE_ORG) return FORCE_ORG;

  const emp = await Employee.findOne({ userId: user._id })
    .select('orgId')
    .sort({ updatedAt: -1 })
    .lean();
  if (emp?.orgId && !isBadOrg(emp.orgId)) {
    return String(emp.orgId);
  }
  return null;
}

async function bootstrapTenantOrg() {
  let org = await Organization.findOne({ code: 'HEXERVE' }).lean();
  if (!org) {
    org = await Organization.findOne({}).sort({ createdAt: 1 }).lean();
  }
  if (!org && APPLY) {
    const created = await Organization.create({
      name: 'Hexerve',
      code: 'HEXERVE',
      email: process.env.ORG_EMAIL || 'hr@hexerve.com',
      isActive: true
    });
    org = created.toObject();
    console.log(`Created organization: ${org.name} (${org._id})`);
  } else if (!org && !APPLY) {
    console.log('Would create Organization { code: HEXERVE, name: Hexerve }');
    return '__dry_run_bootstrap__';
  }
  return org ? String(org._id) : null;
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(APPLY ? '=== APPLY MODE ===' : '=== DRY RUN (pass --apply to write) ===\n');

  let targetOrg = FORCE_ORG;
  if (BOOTSTRAP_ORG) {
    const boot = await bootstrapTenantOrg();
    if (boot) {
      targetOrg = boot === '__dry_run_bootstrap__' ? null : boot;
      console.log(
        boot === '__dry_run_bootstrap__'
          ? 'Bootstrap: will create HEXERVE org on --apply\n'
          : `Bootstrap orgId: ${boot}\n`
      );
    }
  }

  const effectiveOrg = targetOrg && targetOrg !== '__dry_run_bootstrap__' ? targetOrg : null;
  const planOrg = effectiveOrg || (BOOTSTRAP_ORG && !APPLY ? '(new HEXERVE org)' : null);

  let userFixed = 0;
  let userSkipped = 0;
  const users = await User.find({
    role: { $ne: 'super_admin' },
    $or: [{ orgId: { $in: ['system', 'workplus_system'] } }, { orgId: null }, { orgId: '' }]
  }).select('email role orgId name');

  console.log(`Users to review: ${users.length}`);
  for (const user of users) {
    const target = await resolveOrgForUser(user, effectiveOrg);
    if (!target && !planOrg) {
      userSkipped += 1;
      console.log(`  SKIP user ${user.email} (${user.role}) — no employee org; use --orgId=`);
      continue;
    }
    const assignTo = target || planOrg;
    userFixed += 1;
    console.log(`  USER ${user.email} (${user.role}): ${user.orgId || '(empty)'} -> ${assignTo}`);
    if (APPLY && target) {
      await User.updateOne({ _id: user._id }, { $set: { orgId: target } });
    }
  }

  let empFixed = 0;
  let empSkipped = 0;
  const employees = await Employee.find({
    orgId: { $in: ['system', 'workplus_system', null, ''] }
  }).select('userId orgId employeeCode');

  console.log(`\nEmployees to review: ${employees.length}`);
  for (const emp of employees) {
    let target = effectiveOrg || FORCE_ORG;
    if (!target && emp.userId) {
      const u = await User.findById(emp.userId).select('orgId').lean();
      if (u?.orgId && !isBadOrg(u.orgId)) target = String(u.orgId);
    }
    if (!target && !planOrg) {
      empSkipped += 1;
      console.log(`  SKIP employee ${emp._id} — no resolved org`);
      continue;
    }
    const assignTo = target || planOrg;
    empFixed += 1;
    console.log(`  EMPLOYEE ${emp._id}: ${emp.orgId || '(empty)'} -> ${assignTo}`);
    if (APPLY && target) {
      await Employee.updateOne({ _id: emp._id }, { $set: { orgId: target } });
    }
  }

  let holidayFixed = 0;
  const holidays = await Holiday.find({
    organizationId: { $exists: true, $ne: null },
    $or: [{ orgId: { $exists: false } }, { orgId: null }, { orgId: '' }]
  }).limit(5000);

  console.log(`\nHolidays missing orgId (legacy organizationId): ${holidays.length}`);
  for (const h of holidays) {
    const legacy = h.organizationId;
    const mapped = effectiveOrg || (!isBadOrg(legacy) ? legacy : null);
    if (!mapped) continue;
    holidayFixed += 1;
    if (APPLY) {
      await Holiday.updateOne(
        { _id: h._id },
        { $set: { orgId: String(mapped), organizationId: String(mapped) } }
      );
    }
  }
  if (holidayFixed) {
    console.log(
      `  ${APPLY ? 'Updated' : 'Would update'} ${holidayFixed} holiday(s) -> orgId ${effectiveOrg || planOrg || '(from legacy)'}`
    );
  }

  if (effectiveOrg) {
    const badHolidayOrg = await Holiday.countDocuments({
      $or: [{ orgId: { $in: ['system', 'workplus_system'] } }, { organizationId: { $in: ['system', 'workplus_system'] } }]
    });
    if (badHolidayOrg > 0) {
      console.log(`\nHolidays still on system org: ${badHolidayOrg}`);
      if (APPLY) {
        const r = await Holiday.updateMany(
          {
            $or: [
              { orgId: { $in: ['system', 'workplus_system'] } },
              { organizationId: { $in: ['system', 'workplus_system'] } }
            ]
          },
          { $set: { orgId: effectiveOrg, organizationId: effectiveOrg } }
        );
        console.log(`  Remapped ${r.modifiedCount} holiday(s) to ${effectiveOrg}`);
      }
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Users: ${userFixed} fixable, ${userSkipped} need manual orgId`);
  console.log(`Employees: ${empFixed} fixable, ${empSkipped} need manual orgId`);
  console.log(`Holidays: ${holidayFixed} legacy field backfill`);
  if (!APPLY) {
    console.log('\nNo changes written. Re-run with --apply when ready.');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
