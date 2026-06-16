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
 * Format currency value for PDF (using INR text instead of rupee symbol for PDF compatibility)
 * PDFKit's default font (Helvetica) doesn't support rupee symbol ₹
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency string
 */
function formatCurrency(amount) {
  const num = Number(amount || 0);
  const formatted = num.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  return `INR ${formatted}`;
}

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

      // Layout constants
      const pageWidth = 595; // A4 width in points
      const leftMargin = 40;
      const rightMargin = 40;
      const contentWidth = pageWidth - leftMargin - rightMargin; // 515
      const descColumn = leftMargin; // 40
      const amountColumn = pageWidth - rightMargin - 100; // ~455 for amount column

      // Helper: Draw a horizontal line
      const drawLine = (y, color = '#cccccc', width = 1) => {
        pdf.strokeColor(color).lineWidth(width);
        pdf.moveTo(descColumn, y).lineTo(pageWidth - rightMargin, y).stroke();
      };

      // ========== LOGO HEADER ==========
      let logoY = pdf.y;
      const logoPath = path.join(__dirname, '..', 'public', 'assets', 'Hexerve_logo.PNG');
      
      if (fs.existsSync(logoPath)) {
        try {
          // Add Hexerve logo with proper sizing for visibility
          pdf.image(logoPath, leftMargin, pdf.y, { width: 75, height: 55 });
          logoY = pdf.y + 55 + 10;
        } catch (logoErr) {
          logger.warn('Failed to embed logo in PDF', { error: logoErr.message });
          logoY = pdf.y;
        }
      }

      // ========== HEADER TEXT (right side) ==========
      pdf.y = logoY - 55;
      pdf.fontSize(16).font('Helvetica-Bold').text('SALARY SLIP', {
        align: 'center',
        width: contentWidth,
        x: descColumn
      });
      
      pdf.fontSize(9).font('Helvetica').fillColor('#555555').text(
        organization?.name || 'Organization',
        { align: 'center', width: contentWidth, x: descColumn }
      );
      
      if (organization?.address) {
        pdf.fontSize(8).text(organization.address, { align: 'center', width: contentWidth, x: descColumn });
      }

      pdf.moveDown(0.5);
      pdf.fillColor('#000000');
      drawLine(pdf.y, '#000000', 1);
      pdf.moveDown(0.6);

      // ========== PERIOD & SLIP INFO (two columns) ==========
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const monthName = monthNames[slip.month - 1] || slip.month;
      const period = `${monthName} ${slip.year}`;

      pdf.fontSize(10).font('Helvetica-Bold');
      pdf.text('Salary Period:', descColumn, pdf.y);
      pdf.fontSize(10).font('Helvetica');
      pdf.text(period, descColumn + 110, pdf.y - 14);

      if (slip.createdAt) {
        const slipDate = new Date(slip.createdAt).toLocaleDateString('en-IN');
        pdf.fontSize(10).font('Helvetica-Bold');
        pdf.text('Slip Date:', descColumn, pdf.y);
        pdf.fontSize(10).font('Helvetica');
        pdf.text(slipDate, descColumn + 110, pdf.y - 14);
      }

      pdf.moveDown(0.8);

      // ========== EMPLOYEE DETAILS (two-column layout) ==========
      pdf.fontSize(10).font('Helvetica-Bold').text('Employee Information', descColumn);
      pdf.moveDown(0.3);
      
      const empName = employee ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim() : 'N/A';
      const empCode = employee?.employeeCode || 'N/A';
      const empDesignation = employee?.designation || 'N/A';
      const empDepartment = employee?.department || 'N/A';

      pdf.fontSize(9).font('Helvetica');

      // Left column of employee info
      const col1X = descColumn;
      const col2X = descColumn + 280;
      const infoY = pdf.y;

      pdf.text(`Name: ${empName}`, col1X, infoY);
      pdf.text(`Designation: ${empDesignation}`, col1X, pdf.y + 16);

      // Right column of employee info
      pdf.text(`Employee ID: ${empCode}`, col2X, infoY);
      pdf.text(`Department: ${empDepartment}`, col2X, pdf.y + 16);

      pdf.moveDown(1.2);

      // ========== ATTENDANCE SUMMARY ==========
      if (slip.attendanceData) {
        pdf.fontSize(10).font('Helvetica-Bold').text('Attendance Summary', descColumn);
        pdf.moveDown(0.2);
        
        const attY = pdf.y;
        const attCol1X = descColumn;
        const attCol2X = descColumn + 200;

        pdf.fontSize(9).font('Helvetica');
        pdf.text(`Total Working Days: ${slip.attendanceData.totalWorkingDays || 0}`, attCol1X, attY);
        pdf.text(`Leaves Taken: ${slip.attendanceData.leavesTaken || 0}`, attCol2X, attY);
        pdf.text(`Present Days: ${slip.attendanceData.presentDays || 0}`, attCol1X, attY + 14);
        pdf.text(`Absent Days: ${slip.attendanceData.absentDays || 0}`, attCol2X, attY + 14);

        pdf.moveDown(0.8);
      }

      drawLine(pdf.y, '#cccccc', 0.5);
      pdf.moveDown(0.5);

      // ========== EARNINGS TABLE ==========
      pdf.fontSize(11).font('Helvetica-Bold').text('EARNINGS', descColumn);
      pdf.moveDown(0.3);

      // Table header with borders
      const tableHeaderY = pdf.y;
      pdf.fontSize(9).font('Helvetica-Bold').fillColor('#ffffff');
      pdf.rect(descColumn, tableHeaderY, contentWidth, 20).fillAndStroke('#003366', '#003366');
      pdf.text('Description', descColumn + 5, tableHeaderY + 4, { width: 250 });
      pdf.text('Amount (INR)', amountColumn + 5, tableHeaderY + 4, { width: 100, align: 'right' });

      pdf.moveDown(1.8);
      pdf.fillColor('#000000');

      // Earnings rows
      pdf.fontSize(9).font('Helvetica');
      let rowY = pdf.y;

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
          pdf.text(label, descColumn + 5, rowY);
          pdf.text(formatCurrency(amount), amountColumn + 5, rowY, { width: 100, align: 'right' });
          rowY += 16;
        }
      });

      // Other earnings
      if (slip.earnings?.otherEarnings && Array.isArray(slip.earnings.otherEarnings)) {
        slip.earnings.otherEarnings.forEach(({ name, amount }) => {
          if (amount > 0) {
            pdf.text(name, descColumn + 5, rowY);
            pdf.text(formatCurrency(amount), amountColumn + 5, rowY, { width: 100, align: 'right' });
            rowY += 16;
          }
        });
      }

      // Total earnings row
      pdf.moveDown(0.2);
      drawLine(pdf.y, '#cccccc', 0.5);

      pdf.fontSize(10).font('Helvetica-Bold');
      const grossEarnings = slip.grossEarnings || 0;
      pdf.text('Gross Earnings', descColumn + 5, pdf.y + 4);
      pdf.text(formatCurrency(grossEarnings), amountColumn + 5, pdf.y + 4, { width: 100, align: 'right' });
      pdf.moveDown(0.7);

      drawLine(pdf.y, '#cccccc', 0.5);
      pdf.moveDown(0.5);

      // ========== DEDUCTIONS TABLE ==========
      pdf.fontSize(11).font('Helvetica-Bold').text('DEDUCTIONS', descColumn);
      pdf.moveDown(0.3);

      // Table header
      const dedHeaderY = pdf.y;
      pdf.fontSize(9).font('Helvetica-Bold').fillColor('#ffffff');
      pdf.rect(descColumn, dedHeaderY, contentWidth, 20).fillAndStroke('#663300', '#663300');
      pdf.text('Description', descColumn + 5, dedHeaderY + 4, { width: 250 });
      pdf.text('Amount (INR)', amountColumn + 5, dedHeaderY + 4, { width: 100, align: 'right' });

      pdf.moveDown(1.8);
      pdf.fillColor('#000000');

      // Deductions rows
      pdf.fontSize(9).font('Helvetica');
      let dedRowY = pdf.y;

      const deductionsData = [
        ['Provident Fund (PF)', slip.deductions?.providentFund || 0],
        ['Employee State Insurance (ESI)', slip.deductions?.employeeStateInsurance || 0],
        ['Professional Tax', slip.deductions?.professionalTax || 0],
        ['Income Tax', slip.deductions?.incomeTax || 0],
        ['Leave Deduction', slip.deductions?.leaveDeduction || 0]
      ];

      deductionsData.forEach(([label, amount]) => {
        if (amount > 0) {
          pdf.text(label, descColumn + 5, dedRowY);
          pdf.text(formatCurrency(amount), amountColumn + 5, dedRowY, { width: 100, align: 'right' });
          dedRowY += 16;
        }
      });

      // Other deductions
      if (slip.deductions?.otherDeductions && Array.isArray(slip.deductions.otherDeductions)) {
        slip.deductions.otherDeductions.forEach(({ name, amount }) => {
          if (amount > 0) {
            pdf.text(name, descColumn + 5, dedRowY);
            pdf.text(formatCurrency(amount), amountColumn + 5, dedRowY, { width: 100, align: 'right' });
            dedRowY += 16;
          }
        });
      }

      // Total deductions row
      pdf.moveDown(0.2);
      drawLine(pdf.y, '#cccccc', 0.5);

      pdf.fontSize(10).font('Helvetica-Bold');
      const totalDeductions = slip.totalDeductions || 0;
      pdf.text('Total Deductions', descColumn + 5, pdf.y + 4);
      pdf.text(formatCurrency(totalDeductions), amountColumn + 5, pdf.y + 4, { width: 100, align: 'right' });
      pdf.moveDown(0.7);

      drawLine(pdf.y, '#000000', 1);
      pdf.moveDown(0.6);

      // ========== NET SALARY SUMMARY (highlighted box) ==========
      const netSalaryY = pdf.y;
      const netSalary = slip.netSalary || Math.max(0, grossEarnings - totalDeductions);
      
      // Draw background box
      pdf.rect(descColumn, netSalaryY, contentWidth, 50).fillAndStroke('#e8f4f8', '#003366');
      
      pdf.fontSize(12).font('Helvetica-Bold').fillColor('#003366');
      pdf.text('NET SALARY PAYABLE', descColumn + 10, netSalaryY + 8);
      
      pdf.fontSize(16).font('Helvetica-Bold').fillColor('#003366');
      pdf.text(formatCurrency(netSalary), descColumn + 10, netSalaryY + 25);
      
      pdf.moveDown(3);
      pdf.fillColor('#000000');

      // ========== FOOTER ==========
      pdf.moveDown(0.5);
      drawLine(pdf.y, '#cccccc', 0.5);
      pdf.moveDown(0.4);
      
      pdf.fontSize(7).font('Helvetica').fillColor('#666666');
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
