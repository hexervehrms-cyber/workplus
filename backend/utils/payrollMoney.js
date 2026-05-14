/**
 * Centralized payroll money math: sum in integer paise, round once to rupees.
 * Avoids floating-point drift (e.g. gross showing ₹1 high after chained divisions).
 */

const toPaise = (amount) => {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.max(0, n) * 100);
};

const fromPaise = (paise) => Math.round(paise) / 100;

/**
 * Sum numeric fields and { amount }[] arrays from a salary component object into paise.
 */
export function sumMoneyObjectPaise(obj) {
  if (!obj || typeof obj !== "object") return 0;
  let paise = 0;
  for (const val of Object.values(obj)) {
    if (typeof val === "number") paise += toPaise(val);
    else if (Array.isArray(val)) {
      for (const row of val) {
        if (row && typeof row.amount === "number") paise += toPaise(row.amount);
      }
    }
  }
  return paise;
}

/**
 * Gross earnings, total deductions, net salary from structure payloads.
 */
export function aggregateStructureMoney(earnings, deductions) {
  const grossPaise = sumMoneyObjectPaise(earnings || {});
  const dedPaise = sumMoneyObjectPaise(deductions || {});
  const netPaise = grossPaise - dedPaise;
  return {
    grossEarnings: fromPaise(grossPaise),
    totalDeductions: fromPaise(dedPaise),
    netSalary: fromPaise(netPaise)
  };
}

export { toPaise, fromPaise };
