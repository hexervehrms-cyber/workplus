import FNFSettlement from "../models/FNFSettlement.js";
import Employee from "../models/Employee.js";
import SalaryCycle from "../models/SalaryCycle.js";
import LeaveRequest from "../models/LeaveRequest.js";
import AdvanceLoan from "../models/AdvanceLoan.js";
import AssetAssigned from "../models/AssetAssigned.js";
import salaryCalculationEngine from "./salaryCalculationEngine.js";
import logger from "./logger.js";

/**
 * FNF (Full and Final Settlement) Calculation Engine
 * Handles FNF calculations as per Indian labor law
 * FNF must be calculated within 2 days of termination
 */
class FNFCalculationEngine {
  /**
   * Calculate FNF for an employee
   * @param {string} employeeId - Employee ID
   * @param {Date} terminationDate - Date of termination
   * @param {string} terminationReason - Reason for termination
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} FNF calculation details
   */
  async calculateFNF(employeeId, terminationDate, terminationReason, orgId) {
    try {
      const employee = await Employee.findById(employeeId)
        .populate("userId", "name email")
        .lean();

      if (!employee) {
        throw new Error("Employee not found");
      }

      const salaryCycle = await SalaryCycle.getActiveCycle(orgId);

      if (!salaryCycle) {
        throw new Error("Salary cycle not configured");
      }

      // Calculate years of service
      const joiningDate = new Date(employee.joiningDate);
      const yearsOfService = this.calculateYearsOfService(
        joiningDate,
        terminationDate
      );

      // Calculate earned salary till termination
      const earnedSalary = await salaryCalculationEngine.calculateSalaryTillDate(
        employeeId,
        terminationDate,
        orgId
      );

      // Calculate leave encashment
      const leaveEncashment = await this.calculateLeaveEncashment(
        employeeId,
        terminationDate,
        salaryCycle,
        orgId
      );

      // Calculate gratuity
      const gratuity = this.calculateGratuity(
        yearsOfService,
        earnedSalary.totalEarnings,
        salaryCycle
      );

      // Calculate severance pay
      const severancePay = this.calculateSeverancePay(
        yearsOfService,
        earnedSalary.totalEarnings,
        salaryCycle,
        terminationReason
      );

      // Calculate deductions
      const deductions = await this.calculateDeductions(
        employeeId,
        earnedSalary.totalEarnings,
        orgId
      );

      // Calculate net settlement
      const totalEarnings =
        earnedSalary.totalEarnings +
        leaveEncashment.totalLeaveEncashment +
        gratuity.gratuityAmount +
        severancePay.amount;

      const netSettlement = totalEarnings - deductions.totalDeductions;

      return {
        employeeId,
        userId: employee.userId._id,
        terminationDate,
        terminationReason,
        joiningDate,
        yearsOfService,
        earnings: {
          baseSalary: earnedSalary.totalEarnings,
          totalEarnings: earnedSalary.totalEarnings,
          earnedTillTermination: earnedSalary.totalEarnings,
          breakdown: earnedSalary.structureBreakdown
        },
        leaveEncashment,
        gratuity,
        severancePay,
        deductions,
        totalEarnings,
        totalDeductions: deductions.totalDeductions,
        netSettlement,
        status: "calculated",
        orgId
      };
    } catch (error) {
      logger.error("Error calculating FNF", {
        error: error.message,
        employeeId,
        terminationDate
      });
      throw error;
    }
  }

  /**
   * Calculate years of service
   * @param {Date} joiningDate - Joining date
   * @param {Date} terminationDate - Termination date
   * @returns {number} Years of service
   */
  calculateYearsOfService(joiningDate, terminationDate) {
    const joining = new Date(joiningDate);
    const termination = new Date(terminationDate);

    let years = termination.getFullYear() - joining.getFullYear();
    const monthDiff = termination.getMonth() - joining.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && termination.getDate() < joining.getDate())
    ) {
      years--;
    }

    return Math.max(0, years);
  }

  /**
   * Calculate leave encashment
   * @param {string} employeeId - Employee ID
   * @param {Date} terminationDate - Termination date
   * @param {Object} salaryCycle - Salary cycle
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} Leave encashment details
   */
  async calculateLeaveEncashment(
    employeeId,
    terminationDate,
    salaryCycle,
    orgId
  ) {
    try {
      // Get all approved leaves for the employee
      const leaves = await LeaveRequest.find({
        employeeId,
        status: "approved",
        endDate: { $lte: terminationDate },
        orgId
      }).lean();

      // Count leave balance
      const leaveBalance = {
        paidLeave: 0,
        sickLeave: 0,
        casualLeave: 0,
        total: 0
      };

      leaves.forEach((leave) => {
        const days = this.calculateLeaveDays(leave.startDate, leave.endDate);

        if (leave.type === "Sick Leave") {
          leaveBalance.sickLeave += days;
        } else if (leave.type === "Casual") {
          leaveBalance.casualLeave += days;
        } else {
          leaveBalance.paidLeave += days;
        }

        leaveBalance.total += days;
      });

      // Get current salary structure for daily wage
      const structure = await salaryCalculationEngine.getSalaryStructureForDate(
        employeeId,
        terminationDate,
        orgId
      );

      const dailyWage = salaryCalculationEngine.calculateDailyWage(
        structure,
        salaryCycle
      );

      // Calculate encashment
      const leaveEncashmentRate =
        salaryCycle.leavePolicy?.leaveEncashmentRate || 1;

      const breakdown = [
        {
          leaveType: "Paid Leave",
          balance: leaveBalance.paidLeave,
          rate: dailyWage * leaveEncashmentRate,
          amount: leaveBalance.paidLeave * dailyWage * leaveEncashmentRate
        },
        {
          leaveType: "Sick Leave",
          balance: leaveBalance.sickLeave,
          rate: dailyWage * leaveEncashmentRate,
          amount: leaveBalance.sickLeave * dailyWage * leaveEncashmentRate
        },
        {
          leaveType: "Casual Leave",
          balance: leaveBalance.casualLeave,
          rate: dailyWage * leaveEncashmentRate,
          amount: leaveBalance.casualLeave * dailyWage * leaveEncashmentRate
        }
      ];

      const totalLeaveEncashment = breakdown.reduce(
        (sum, item) => sum + item.amount,
        0
      );

      return {
        totalLeaveBalance: leaveBalance.total,
        leaveEncashmentRate,
        totalLeaveEncashment: Math.round(totalLeaveEncashment * 100) / 100,
        breakdown
      };
    } catch (error) {
      logger.error("Error calculating leave encashment", {
        error: error.message,
        employeeId
      });
      return {
        totalLeaveBalance: 0,
        leaveEncashmentRate: 0,
        totalLeaveEncashment: 0,
        breakdown: []
      };
    }
  }

  /**
   * Calculate gratuity
   * @param {number} yearsOfService - Years of service
   * @param {number} earnedSalary - Earned salary
   * @param {Object} salaryCycle - Salary cycle
   * @returns {Object} Gratuity details
   */
  calculateGratuity(yearsOfService, earnedSalary, salaryCycle) {
    const fnfPolicy = salaryCycle.fnfPolicy || {};
    const gratuityEligibilityYears = fnfPolicy.gratuityEligibilityYears || 5;
    const gratuityRate = fnfPolicy.gratuityRate || 15; // Days of salary

    const eligible = yearsOfService >= gratuityEligibilityYears;

    let gratuityAmount = 0;
    let reason = "";

    if (eligible) {
      const dailyRate = earnedSalary / 30; // Approximate daily rate
      gratuityAmount = dailyRate * gratuityRate;
      reason = `Gratuity for ${yearsOfService} years of service at ${gratuityRate} days`;
    } else {
      reason = `Not eligible for gratuity (${yearsOfService} years < ${gratuityEligibilityYears} years required)`;
    }

    return {
      eligible,
      yearsOfServiceRequired: gratuityEligibilityYears,
      gratuityRate,
      gratuityAmount: Math.round(gratuityAmount * 100) / 100,
      reason
    };
  }

  /**
   * Calculate severance pay
   * @param {number} yearsOfService - Years of service
   * @param {number} earnedSalary - Earned salary
   * @param {Object} salaryCycle - Salary cycle
   * @param {string} terminationReason - Reason for termination
   * @returns {Object} Severance pay details
   */
  calculateSeverancePay(
    yearsOfService,
    earnedSalary,
    salaryCycle,
    terminationReason
  ) {
    const fnfPolicy = salaryCycle.fnfPolicy || {};
    const severanceDays = fnfPolicy.severancePayDays || 0;

    let eligible = false;
    let reason = "";

    // Severance typically given for termination without cause
    if (
      terminationReason === "termination" &&
      severanceDays > 0
    ) {
      eligible = true;
      reason = `Severance pay for termination without cause`;
    } else {
      reason = `Not eligible for severance pay (${terminationReason})`;
    }

    const dailyRate = earnedSalary / 30; // Approximate daily rate
    const amount = eligible ? dailyRate * severanceDays : 0;

    return {
      eligible,
      days: severanceDays,
      dailyRate: Math.round(dailyRate * 100) / 100,
      amount: Math.round(amount * 100) / 100,
      reason
    };
  }

  /**
   * Calculate deductions for FNF
   * @param {string} employeeId - Employee ID
   * @param {number} earnedSalary - Earned salary
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} Deductions details
   */
  async calculateDeductions(employeeId, earnedSalary, orgId) {
    try {
      // Get pending advances and loans
      const advancesLoans = await AdvanceLoan.find({
        employeeId,
        status: "approved",
        orgId
      }).lean();

      let totalAdvance = 0;
      let totalLoan = 0;
      let totalBond = 0;
      const breakdown = [];

      advancesLoans.forEach((item) => {
        const remaining = item.amount - (item.paidAmount || 0);

        if (item.type === "advance") {
          totalAdvance += remaining;
          breakdown.push({
            type: "Advance Salary",
            amount: remaining,
            description: `Advance salary deduction`
          });
        } else if (item.type === "loan") {
          totalLoan += remaining;
          breakdown.push({
            type: "Loan",
            amount: remaining,
            description: `Loan deduction`
          });
        } else if (item.type === "bond") {
          totalBond += remaining;
          breakdown.push({
            type: "Bond",
            amount: remaining,
            description: `Bond deduction`
          });
        }
      });

      // Get assigned assets for deduction
      const assets = await AssetAssigned.find({
        'assignment.assignedTo': employeeId,
        status: { $in: ['assigned', 'in_use'] },
        isActive: true,
        orgId
      }).lean();

      let totalAssetValue = 0;
      const assetBreakdown = [];

      assets.forEach((asset) => {
        const assetValue = asset.financial?.currentValue || asset.financial?.purchasePrice || 0;
        if (assetValue > 0) {
          totalAssetValue += assetValue;
          assetBreakdown.push({
            assetName: asset.assetName,
            serialNumber: asset.specifications?.serialNumber,
            value: assetValue
          });
        }
      });

      if (totalAssetValue > 0) {
        breakdown.push({
          type: "Asset Deduction",
          amount: totalAssetValue,
          description: `Deduction for ${assets.length} assigned asset(s)`,
          assets: assetBreakdown
        });
      }

      // Calculate tax on FNF (simplified)
      const taxableAmount = earnedSalary;
      const tax = Math.round(taxableAmount * 0.1); // 10% tax (simplified)

      if (tax > 0) {
        breakdown.push({
          type: "Tax",
          amount: tax,
          description: "Income tax on FNF"
        });
      }

      const totalDeductions = totalAdvance + totalLoan + totalBond + tax + totalAssetValue;

      return {
        advanceSalary: totalAdvance,
        loans: totalLoan,
        bonds: totalBond,
        tax,
        insurance: 0,
        assetDeduction: totalAssetValue,
        otherDeductions: 0,
        totalDeductions: Math.round(totalDeductions * 100) / 100,
        breakdown
      };
    } catch (error) {
      logger.error("Error calculating deductions", {
        error: error.message,
        employeeId
      });
      return {
        advanceSalary: 0,
        loans: 0,
        bonds: 0,
        tax: 0,
        insurance: 0,
        assetDeduction: 0,
        otherDeductions: 0,
        totalDeductions: 0,
        breakdown: []
      };
    }
  }

  /**
   * Calculate leave days between two dates
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {number} Number of days
   */
  calculateLeaveDays(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end dates
    return diffDays;
  }

  /**
   * Save FNF settlement
   * @param {Object} fnfData - FNF calculation data
   * @returns {Promise<Object>} Saved FNF settlement
   */
  async saveFNFSettlement(fnfData) {
    try {
      const fnfSettlement = await FNFSettlement.create(fnfData);
      logger.info("FNF settlement saved", {
        fnfSettlementId: fnfSettlement._id,
        employeeId: fnfData.employeeId
      });
      return fnfSettlement;
    } catch (error) {
      logger.error("Error saving FNF settlement", {
        error: error.message,
        employeeId: fnfData.employeeId
      });
      throw error;
    }
  }

  /**
   * Get FNF settlement for employee
   * @param {string} employeeId - Employee ID
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} FNF settlement
   */
  async getFNFSettlement(employeeId, orgId) {
    try {
      return await FNFSettlement.findByEmployee(employeeId, orgId)
        .populate("employeeId", "employeeCode department designation")
        .populate("userId", "name email")
        .populate("approvedBy", "name email")
        .populate("paidBy", "name email");
    } catch (error) {
      logger.error("Error getting FNF settlement", {
        error: error.message,
        employeeId
      });
      throw error;
    }
  }

  /**
   * Approve FNF settlement
   * @param {string} fnfSettlementId - FNF settlement ID
   * @param {string} approvedBy - User ID approving
   * @returns {Promise<Object>} Updated FNF settlement
   */
  async approveFNFSettlement(fnfSettlementId, approvedBy) {
    try {
      const fnfSettlement = await FNFSettlement.findByIdAndUpdate(
        fnfSettlementId,
        {
          status: "approved",
          approvedBy,
          approvedDate: new Date()
        },
        { new: true }
      );

      logger.info("FNF settlement approved", {
        fnfSettlementId,
        approvedBy
      });

      return fnfSettlement;
    } catch (error) {
      logger.error("Error approving FNF settlement", {
        error: error.message,
        fnfSettlementId
      });
      throw error;
    }
  }

  /**
   * Mark FNF as paid
   * @param {string} fnfSettlementId - FNF settlement ID
   * @param {string} paidBy - User ID marking as paid
   * @returns {Promise<Object>} Updated FNF settlement
   */
  async markFNFAsPaid(fnfSettlementId, paidBy) {
    try {
      const fnfSettlement = await FNFSettlement.findByIdAndUpdate(
        fnfSettlementId,
        {
          status: "paid",
          paidBy,
          paidDate: new Date()
        },
        { new: true }
      );

      logger.info("FNF marked as paid", {
        fnfSettlementId,
        paidBy
      });

      return fnfSettlement;
    } catch (error) {
      logger.error("Error marking FNF as paid", {
        error: error.message,
        fnfSettlementId
      });
      throw error;
    }
  }
}

export default new FNFCalculationEngine();
