import { describe, it, expect } from "vitest";
import { aggregateStructureMoney, fromPaise, toPaise } from "../utils/payrollMoney.js";

describe("payrollMoney", () => {
  it("sums earnings without floating drift", () => {
    const earnings = {
      basic: 33333.33,
      hra: 16666.67,
      medicalExpenses: 0,
      travel: 0,
      internetCharges: 0,
      nightShiftAllowance: 0,
      incentives: 0,
      bonus: 0,
      commission: 0,
      otherEarnings: []
    };
    const deductions = {
      providentFund: 4000,
      employeeStateInsurance: 0,
      professionalTax: 200,
      incomeTax: 0,
      otherDeductions: []
    };
    const { grossEarnings, totalDeductions, netSalary } = aggregateStructureMoney(earnings, deductions);
    expect(grossEarnings).toBe(50000);
    expect(totalDeductions).toBe(4200);
    expect(netSalary).toBe(45800);
  });

  it("toPaise/fromPaise round-trip", () => {
    expect(fromPaise(toPaise(123.456))).toBe(123.46);
  });
});
