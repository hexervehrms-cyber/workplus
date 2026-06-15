/** Normalize API salary slip payloads so UI never crashes on missing nested fields. */
export function normalizeSalarySlip<T extends Record<string, unknown>>(raw: T): T & {
  grossEarnings: number;
  totalDeductions: number;
  netSalary: number;
  attendanceData: {
    totalWorkingDays: number;
    presentDays: number;
    absentDays: number;
    leavesTaken: number;
  };
  earnings: {
    basic: number;
    hra: number;
    medicalExpenses: number;
    travel: number;
    internetCharges: number;
    nightShiftAllowance: number;
    incentives: number;
    bonus: number;
    commission: number;
    otherEarnings: Array<{ name: string; amount: number }>;
  };
  deductions: {
    providentFund: number;
    employeeStateInsurance: number;
    professionalTax: number;
    incomeTax: number;
    leaveDeduction: number;
    otherDeductions: Array<{ name: string; amount: number }>;
  };
} {
  const att = (raw.attendanceData as Record<string, unknown>) || {};
  const earn = (raw.earnings as Record<string, unknown>) || {};
  const ded = (raw.deductions as Record<string, unknown>) || {};
  const num = (v: unknown) => (typeof v === 'number' && !Number.isNaN(v) ? v : Number(v) || 0);

  return {
    ...raw,
    grossEarnings: num(raw.grossEarnings),
    totalDeductions: num(raw.totalDeductions),
    netSalary: num(raw.netSalary),
    attendanceData: {
      totalWorkingDays: num(att.totalWorkingDays),
      presentDays: num(att.presentDays),
      absentDays: num(att.absentDays),
      leavesTaken: num(att.leavesTaken),
    },
    earnings: {
      basic: num(earn.basic),
      hra: num(earn.hra),
      medicalExpenses: num(earn.medicalExpenses),
      travel: num(earn.travel),
      internetCharges: num(earn.internetCharges),
      nightShiftAllowance: num(earn.nightShiftAllowance),
      incentives: num(earn.incentives),
      bonus: num(earn.bonus),
      commission: num(earn.commission),
      otherEarnings: Array.isArray(earn.otherEarnings)
        ? (earn.otherEarnings as Array<{ name: string; amount: number }>)
        : [],
    },
    deductions: {
      providentFund: num(ded.providentFund),
      employeeStateInsurance: num(ded.employeeStateInsurance),
      professionalTax: num(ded.professionalTax),
      incomeTax: num(ded.incomeTax),
      leaveDeduction: num(ded.leaveDeduction),
      otherDeductions: Array.isArray(ded.otherDeductions)
        ? (ded.otherDeductions as Array<{ name: string; amount: number }>)
        : [],
    },
  };
}
