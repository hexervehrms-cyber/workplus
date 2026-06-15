/**
 * HTML to PDF Converter Utility - Professional Layout with Hexerve Logo
 * Converts salary slip to professional PDF using PDFKit
 * Pure Node.js solution - no external dependencies
 */

import PDFDocument from 'pdfkit';
import logger from './logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Generate professional salary slip PDF with Hexerve logo and complete layout
 * Includes: logo header, employee details, attendance, earnings table, deductions table, totals, footer
 * 
 * @param {Object} slip - SalarySlip document
 * @param {Object} employee - Employee document
 * @param {Object} organization - Organization document
 * @returns {Promise<Buffer>} PDF buffer
 */
export async function generateSalarySlipPdf(slip, employee, organization) {
  return new Promise((resolve, reject) => {
    try {
      const pdf = new PDFDocument({
        size: 'A4',
        margin: 40,
        bufferPages: true,
        font: 'Helvetica'
      });

      const chunks = [];
      
      pdf.on('data', chunk => chunks.push(chunk));
      pdf.on('end', () => resolve(Buffer.concat(chunks)));
      pdf.on('error', err => reject(err));

      // Helper: Draw a horizontal line
      const drawLine = () => {
        pdf.strokeColor('#cccccc').lineWidth(0.5);
        pdf.moveTo(40, pdf.y).lineTo(555, pdf.y).stroke();
      };

      // ========== LOGO HEADER ==========
      const logoPath = path.join(__dirname, '..', 'public', 'assets', 'Hexerve_logo.PNG');
      
      if (fs.existsSync(logoPath)) {
        try {
          // Add Hexerve logo with proper sizing for visibility
          pdf.image(logoPath, 45, 30, { width: 80, height: 60 });
          pdf.moveDown(1.2);
        } catch (logoErr) {
          logger.warn('Failed to embed logo in PDF', { error: logoErr.message });
          pdf.moveDown(0.5);
        }
      } else {
        logger.warn('Hexerve logo file not found', { logoPath });
        pdf.moveDown(0.5);
      }

      // ========== HEADER ==========
      pdf.fontSize(16).font('Helvetica-Bold').text('SALARY SLIP', { align: 'center' });
      pdf.fontSize(9).font('Helvetica').text(organization?.name || 'Organization', { align: 'center' });
      pdf.fontSize(8).text(organization?.address || '', { align: 'center' });
      pdf.moveDown(0.3);
      drawLine();
      pdf.moveDown(0.5);

      // ========== PERIOD & SLIP INFO ==========
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const monthName = monthNames[slip.month - 1] || slip.month;
      const period = `${monthName} ${slip.year}`;

      pdf.fontSize(10).font('Helvetica-Bold').text('Salary Period:', 40);
      pdf.fontSize(10).font('Helvetica').text(period, 130);

      if (slip.createdAt) {
        const slipDate = new Date(slip.createdAt).toLocaleDateString('en-IN');
        pdf.fontSize(10).font('Helvetica-Bold').text('Slip Date:', 40, pdf.y - 14);
        pdf.fontSize(10).font('Helvetica').text(slipDate, 130);
      }

      pdf.moveDown(0.8);

      // ========== EMPLOYEE DETAILS ==========
      pdf.fontSize(10).font('Helvetica-Bold').text('Employee Information', 40);
      pdf.moveDown(0.2);
      
      const empName = employee ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim() : 'N/A';
      const empCode = employee?.employeeCode || 'N/A';
      const empDesignation = employee?.designation || 'N/A';
      const empDepartment = employee?.department || 'N/A';

      pdf.fontSize(9).font('Helvetica').text(`Name: ${empName}`, 40);
      pdf.text(`Employee ID: ${empCode}`, 40);
      pdf.text(`Designation: ${empDesignation}`, 40);
      pdf.text(`Department: ${empDepartment}`, 40);
      pdf.moveDown(0.5);

      // ========== ATTENDANCE SUMMARY ==========
      if (slip.attendanceData) {
        pdf.fontSize(10).font('Helvetica-Bold').text('Attendance Summary', 40);
        pdf.moveDown(0.2);
        pdf.fontSize(9).font('Helvetica');
        pdf.text(`Total Working Days: ${slip.attendanceData.totalWorkingDays || 0}`, 40);
        pdf.text(`Present Days: ${slip.attendanceData.presentDays || 0}`, 40);
        pdf.text(`Absent Days: ${slip.attendanceData.absentDays || 0}`, 40);
        pdf.text(`Leaves Taken: ${slip.attendanceData.leavesTaken || 0}`, 40);
        pdf.moveDown(0.5);
      }

      drawLine();
      pdf.moveDown(0.5);

      // ========== EARNINGS TABLE ==========
      pdf.fontSize(10).font('Helvetica-Bold').text('EARNINGS', 40);
      pdf.moveDown(0.3);

      // Table header
      pdf.fontSize(9).font('Helvetica-Bold');
      pdf.text('Description', 40, pdf.y, { width: 300 });
      pdf.text('Amount (₹)', 350, pdf.y - 14, { width: 100, align: 'right' });
      pdf.moveDown(0.4);

      pdf.strokeColor('#cccccc').lineWidth(0.5);
      pdf.moveTo(40, pdf.y).lineTo(555, pdf.y).stroke();
      pdf.moveDown(0.2);

      // Earnings rows
      pdf.fontSize(9).font('Helvetica');

      const earningsData = [
        ['Basic Salary', slip.earnings?.basic || 0],
        ['HRA', slip.earnings?.hra || 0],
        ['Medical Allowance', slip.earnings?.medicalExpenses || 0],
        ['Travel Allowance', slip.earnings?.travel || 0],
        ['Internet Charges', slip.earnings?.internetCharges || 0],
        ['Night Shift Allowance', slip.earnings?.nightShiftAllowance || 0],
        ['Incentives', slip.earnings?.incentives || 0],
        ['Bonus', slip.earnings?.bonus || 0],
        ['Commission', slip.earnings?.commission || 0]
      ];

      earningsData.forEach(([label, amount]) => {
        if (amount > 0) {
          pdf.text(label, 40, pdf.y, { width: 300 });
          pdf.text(`₹ ${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, 350, pdf.y - 14, { width: 100, align: 'right' });
          pdf.moveDown(0.25);
        }
      });

      // Other earnings
      if (slip.earnings?.otherEarnings && Array.isArray(slip.earnings.otherEarnings)) {
        slip.earnings.otherEarnings.forEach(({ name, amount }) => {
          if (amount > 0) {
            pdf.text(name, 40, pdf.y, { width: 300 });
            pdf.text(`₹ ${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, 350, pdf.y - 14, { width: 100, align: 'right' });
            pdf.moveDown(0.25);
          }
        });
      }

      pdf.moveDown(0.2);
      pdf.strokeColor('#000000').lineWidth(1);
      pdf.moveTo(40, pdf.y).lineTo(555, pdf.y).stroke();
      pdf.moveDown(0.2);

      // Gross earnings
      pdf.fontSize(10).font('Helvetica-Bold');
      pdf.text('Gross Earnings', 40, pdf.y, { width: 300 });
      const grossEarnings = slip.grossEarnings || 0;
      pdf.text(`₹ ${grossEarnings.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, 350, pdf.y - 14, { width: 100, align: 'right' });
      pdf.moveDown(0.5);

      drawLine();
      pdf.moveDown(0.5);

      // ========== DEDUCTIONS TABLE ==========
      pdf.fontSize(10).font('Helvetica-Bold').text('DEDUCTIONS', 40);
      pdf.moveDown(0.3);

      // Table header
      pdf.fontSize(9).font('Helvetica-Bold');
      pdf.text('Description', 40, pdf.y, { width: 300 });
      pdf.text('Amount (₹)', 350, pdf.y - 14, { width: 100, align: 'right' });
      pdf.moveDown(0.4);

      pdf.strokeColor('#cccccc').lineWidth(0.5);
      pdf.moveTo(40, pdf.y).lineTo(555, pdf.y).stroke();
      pdf.moveDown(0.2);

      // Deductions rows
      pdf.fontSize(9).font('Helvetica');

      const deductionsData = [
        ['Provident Fund (PF)', slip.deductions?.providentFund || 0],
        ['Employee State Insurance (ESI)', slip.deductions?.employeeStateInsurance || 0],
        ['Professional Tax', slip.deductions?.professionalTax || 0],
        ['Income Tax', slip.deductions?.incomeTax || 0],
        ['Leave Deduction', slip.deductions?.leaveDeduction || 0]
      ];

      deductionsData.forEach(([label, amount]) => {
        if (amount > 0) {
          pdf.text(label, 40, pdf.y, { width: 300 });
          pdf.text(`₹ ${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, 350, pdf.y - 14, { width: 100, align: 'right' });
          pdf.moveDown(0.25);
        }
      });

      // Other deductions
      if (slip.deductions?.otherDeductions && Array.isArray(slip.deductions.otherDeductions)) {
        slip.deductions.otherDeductions.forEach(({ name, amount }) => {
          if (amount > 0) {
            pdf.text(name, 40, pdf.y, { width: 300 });
            pdf.text(`₹ ${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, 350, pdf.y - 14, { width: 100, align: 'right' });
            pdf.moveDown(0.25);
          }
        });
      }

      pdf.moveDown(0.2);
      pdf.strokeColor('#000000').lineWidth(1);
      pdf.moveTo(40, pdf.y).lineTo(555, pdf.y).stroke();
      pdf.moveDown(0.2);

      // Total deductions
      pdf.fontSize(10).font('Helvetica-Bold');
      pdf.text('Total Deductions', 40, pdf.y, { width: 300 });
      const totalDeductions = slip.totalDeductions || 0;
      pdf.text(`₹ ${totalDeductions.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, 350, pdf.y - 14, { width: 100, align: 'right' });
      pdf.moveDown(0.6);

      drawLine();
      pdf.moveDown(0.5);

      // ========== NET SALARY SUMMARY ==========
      pdf.fontSize(14).font('Helvetica-Bold').fillColor('#1a1a1a');
      pdf.rect(40, pdf.y, 515, 40).fillAndStroke('#f0f0f0', '#cccccc');
      pdf.fillColor('#1a1a1a');
      
      const netSalary = slip.netSalary || (grossEarnings - totalDeductions);
      pdf.text('NET SALARY PAYABLE', 50, pdf.y + 5, { width: 300 });
      pdf.text(`₹ ${netSalary.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, 360, pdf.y + 5, { width: 100, align: 'right' });
      pdf.moveDown(2);

      pdf.moveDown(0.8);

      // ========== FOOTER ==========
      drawLine();
      pdf.moveDown(0.3);
      pdf.fontSize(8).font('Helvetica').fillColor('#666666');
      pdf.text('This is a computer-generated salary slip and does not require a signature.', { align: 'center' });
      pdf.text(`Generated on: ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}`, { align: 'center' });

      pdf.end();
    } catch (error) {
      logger.error('PDF generation failed', {
        error: error.message,
        stack: error.stack
      });
      reject(new Error(`Failed to generate salary slip PDF: ${error.message}`));
    }
  });
}

export default {
  generateSalarySlipPdf
};
