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

// ========== HELPER FUNCTIONS ==========

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
 * Safe text renderer - prevents undefined values from breaking PDF
 * @param {*} value - Value to render
 * @param {string} fallback - Fallback if value is empty
 * @returns {string} Safe string representation
 */
function safeText(value, fallback = '-') {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value).trim() || fallback;
}

/**
 * Draw a horizontal line on PDF
 * @param {PDFDocument} doc - PDF document
 * @param {number} x - Start X coordinate
 * @param {number} y - Y coordinate
 * @param {number} width - Line width in points
 * @param {string} color - Hex color code
 * @param {number} weight - Line weight in points
 */
function drawLine(doc, x, y, width, color = '#cccccc', weight = 0.5) {
  doc.strokeColor(color).lineWidth(weight);
  doc.moveTo(x, y).lineTo(x + width, y).stroke();
  doc.strokeColor('#000000').lineWidth(1);
}

/**
 * Draw page header with logo and title
 * @param {PDFDocument} doc - PDF document
 * @param {Object} organization - Organization data
 * @param {number} pageWidth - Page width
 * @param {number} leftMargin - Left margin
 * @param {number} rightMargin - Right margin
 * @returns {number} Y position after header
 */
function drawHeader(doc, organization, pageWidth, leftMargin, rightMargin) {
  const contentWidth = pageWidth - leftMargin - rightMargin;
  const logoPath = path.join(__dirname, '..', 'public', 'assets', 'Hexerve_logo.PNG');
  let headerY = doc.y;

  // Draw logo if available
  if (fs.existsSync(logoPath)) {
    try {
      doc.image(logoPath, leftMargin, headerY, { width: 90, height: 60 });
      headerY = doc.y;
    } catch (logoErr) {
      logger.warn('Failed to embed logo in PDF', { error: logoErr.message });
    }
  }

  // Set Y position for title (right-aligned)
  doc.y = headerY - 60;

  // Draw title
  doc.fontSize(24).font('Helvetica-Bold').fillColor('#003366');
  doc.text('SALARY SLIP', {
    align: 'right',
    width: contentWidth - 5,
    x: leftMargin
  });

  // Draw organization name
  doc.fontSize(11).font('Helvetica').fillColor('#555555');
  doc.text(safeText(organization?.name, 'Organization'), {
    align: 'right',
    width: contentWidth - 5,
    x: leftMargin
  });

  // Draw address if available
  if (organization?.address) {
    doc.fontSize(9).fillColor('#777777');
    doc.text(organization.address, {
      align: 'right',
      width: contentWidth - 5,
      x: leftMargin
    });
  }

  // Move to next position
  doc.y = headerY + 10;
  doc.fillColor('#000000');
  drawLine(doc, leftMargin, doc.y, contentWidth, '#003366', 2);
  doc.moveDown(0.6);

  return doc.y;
}

/**
 * Draw section title
 * @param {PDFDocument} doc - PDF document
 * @param {string} title - Section title
 * @param {number} x - X coordinate
 */
function drawSectionTitle(doc, title, x = 50) {
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#003366');
  doc.text(title, x);
  doc.fillColor('#000000');
  doc.moveDown(0.3);
}

/**
 * Draw employee information box
 * @param {PDFDocument} doc - PDF document
 * @param {Object} employee - Employee data
 * @param {Object} options - Options including x, width
 */
function drawEmployeeInfoBox(doc, employee, { x = 50, width = 495, y = null }) {
  if (y !== null) doc.y = y;

  const boxHeight = 90;
  const currentY = doc.y;

  // Draw box background
  doc.rect(x, currentY, width, boxHeight).fill('#f0f7ff');
  doc.rect(x, currentY, width, boxHeight).stroke('#003366');

  // Title
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#003366');
  doc.text('Employee Information', x + 12, currentY + 8);

  // Employee details in 2 columns
  const col1X = x + 12;
  const col2X = x + 260;
  const detailsY = currentY + 28;

  doc.fontSize(9).font('Helvetica');
  const empName = employee ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim() : 'N/A';

  // Column 1
  doc.fillColor('#666666').font('Helvetica-Bold').text('Name:', col1X, detailsY);
  doc.fillColor('#000000').font('Helvetica').text(safeText(empName), col1X + 70, detailsY - 14);

  doc.fillColor('#666666').font('Helvetica-Bold').text('Designation:', col1X, detailsY + 16);
  doc.fillColor('#000000').font('Helvetica').text(safeText(employee?.designation, 'N/A'), col1X + 70, detailsY + 16);

  // Column 2
  doc.fillColor('#666666').font('Helvetica-Bold').text('Employee ID:', col2X, detailsY);
  doc.fillColor('#000000').font('Helvetica').text(safeText(employee?.employeeCode, 'N/A'), col2X + 70, detailsY - 14);

  doc.fillColor('#666666').font('Helvetica-Bold').text('Department:', col2X, detailsY + 16);
  doc.fillColor('#000000').font('Helvetica').text(safeText(employee?.department, 'N/A'), col2X + 70, detailsY + 16);

  doc.fillColor('#000000');
  doc.y = currentY + boxHeight + 8;
}

/**
 * Draw attendance summary box
 * @param {PDFDocument} doc - PDF document
 * @param {Object} attendanceData - Attendance data
 * @param {Object} options - Options including x, width
 */
function drawAttendanceSummaryBox(doc, attendanceData, { x = 50, width = 495, y = null }) {
  if (y !== null) doc.y = y;

  if (!attendanceData) {
    doc.moveDown(0.5);
    return;
  }

  const boxHeight = 75;
  const currentY = doc.y;

  // Draw box background
  doc.rect(x, currentY, width, boxHeight).fill('#f9f5f0');
  doc.rect(x, currentY, width, boxHeight).stroke('#8b6f47');

  // Title
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#8b6f47');
  doc.text('Attendance Summary', x + 12, currentY + 8);

  // Stats in 2x2 grid
  const statWidth = (width - 24) / 2;
  const statX1 = x + 12;
  const statX2 = x + 12 + statWidth;
  const stat1Y = currentY + 28;
  const stat2Y = currentY + 50;

  doc.fontSize(9);

  // Total Working Days
  doc.fillColor('#666666').font('Helvetica-Bold').text('Total Working Days:', statX1, stat1Y);
  doc.fillColor('#003366').font('Helvetica-Bold').fontSize(12).text(String(attendanceData.totalWorkingDays || 0), statX1, stat1Y + 14);

  // Present Days
  doc.fontSize(9).fillColor('#666666').font('Helvetica-Bold').text('Present Days:', statX2, stat1Y);
  doc.fillColor('#003366').font('Helvetica-Bold').fontSize(12).text(String(attendanceData.presentDays || 0), statX2, stat1Y + 14);

  // Absent Days
  doc.fontSize(9).fillColor('#666666').font('Helvetica-Bold').text('Absent Days:', statX1, stat2Y);
  doc.fillColor('#003366').font('Helvetica-Bold').fontSize(12).text(String(attendanceData.absentDays || 0), statX1, stat2Y + 14);

  // Leaves Taken
  doc.fontSize(9).fillColor('#666666').font('Helvetica-Bold').text('Leaves Taken:', statX2, stat2Y);
  doc.fillColor('#003366').font('Helvetica-Bold').fontSize(12).text(String(attendanceData.leavesTaken || 0), statX2, stat2Y + 14);

  doc.fillColor('#000000');
  doc.y = currentY + boxHeight + 8;
}

/**
 * Draw salary table (for earnings or deductions)
 * @param {PDFDocument} doc - PDF document
 * @param {Object} options - Table configuration
 */
function drawSalaryTable(doc, options) {
  const {
    title = 'TABLE',
    rows = [],
    totalLabel = 'Total',
    totalAmount = 0,
    x = 50,
    width = 495,
    headerColor = '#003366',
    y = null
  } = options;

  if (y !== null) doc.y = y;

  const currentY = doc.y;
  const headerHeight = 24;
  const rowHeight = 22;
  const descWidth = width - 170;
  const amountWidth = 160;
  const amountX = x + descWidth;

  // Section title
  drawSectionTitle(doc, title, x);

  // Table header
  const headerY = doc.y;
  doc.rect(x, headerY, width, headerHeight).fillAndStroke(headerColor, headerColor);

  doc.fontSize(10).font('Helvetica-Bold').fillColor('#ffffff');
  doc.text('Description', x + 8, headerY + 5);
  doc.text('Amount (INR)', amountX + 8, headerY + 5, { width: amountWidth - 16, align: 'right' });

  doc.fillColor('#000000');
  doc.y = headerY + headerHeight + 2;

  // Table rows
  doc.fontSize(9).font('Helvetica');
  let rowY = doc.y;

  rows.forEach((row) => {
    const [description, amount] = row;
    const displayAmount = formatCurrency(amount);

    doc.text(description, x + 8, rowY, { width: descWidth - 16 });
    doc.text(displayAmount, amountX + 8, rowY, { width: amountWidth - 16, align: 'right' });
    rowY += rowHeight;
  });

  // Draw line before total
  drawLine(doc, x, rowY, width, '#cccccc', 0.5);
  rowY += 6;

  // Total row
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text(totalLabel, x + 8, rowY);
  doc.text(formatCurrency(totalAmount), amountX + 8, rowY, { width: amountWidth - 16, align: 'right' });

  doc.fillColor('#000000');
  doc.y = rowY + rowHeight;
}

/**
 * Draw net salary highlight box
 * @param {PDFDocument} doc - PDF document
 * @param {number} netSalary - Net salary amount
 * @param {Object} options - Options including x, width
 */
function drawNetSalaryBox(doc, netSalary, { x = 50, width = 495, y = null }) {
  if (y !== null) doc.y = y;

  const currentY = doc.y;
  const boxHeight = 55;

  // Draw background box with border
  doc.rect(x, currentY, width, boxHeight).fill('#e8f4f8');
  doc.rect(x, currentY, width, boxHeight).stroke('#003366');
  doc.lineWidth(2);

  // Label
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#003366');
  doc.text('NET SALARY PAYABLE', x + 12, currentY + 8);

  // Amount (large and prominent)
  doc.fontSize(18).font('Helvetica-Bold').fillColor('#003366');
  doc.text(formatCurrency(netSalary), x + 12, currentY + 25);

  doc.fillColor('#000000').lineWidth(1);
  doc.y = currentY + boxHeight + 8;
}

/**
 * Draw page footer
 * @param {PDFDocument} doc - PDF document
 * @param {number} x - X coordinate
 * @param {number} width - Width
 */
function drawFooter(doc, x = 50, width = 495) {
  doc.moveDown(0.5);
  drawLine(doc, x, doc.y, width, '#cccccc', 0.5);
  doc.moveDown(0.4);

  doc.fontSize(8).font('Helvetica').fillColor('#999999');
  doc.text('This is a computer-generated salary slip and does not require a signature.', {
    align: 'center',
    width: width,
    x: x
  });
  doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}`, {
    align: 'center',
    width: width,
    x: x
  });

  doc.fillColor('#000000');
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
        margin: 0,
        bufferPages: true,
        font: 'Helvetica'
      });

      const chunks = [];
      
      pdf.on('data', chunk => chunks.push(chunk));
      pdf.on('end', () => resolve(Buffer.concat(chunks)));
      pdf.on('error', err => reject(err));

      // Layout constants
      const pageWidth = 595; // A4 width in points
      const leftMargin = 45;
      const rightMargin = 50;
      const contentWidth = pageWidth - leftMargin - rightMargin; // 500

      // Initialize page margins
      pdf.y = leftMargin;

      // ========== 1. HEADER WITH LOGO ==========
      drawHeader(pdf, organization, pageWidth, leftMargin, rightMargin);
      pdf.moveDown(0.6);

      // ========== 2. SALARY PERIOD & SLIP DATE ROW ==========
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const monthName = monthNames[slip.month - 1] || slip.month;
      const period = `${monthName} ${slip.year}`;
      const slipDate = slip.createdAt ? new Date(slip.createdAt).toLocaleDateString('en-IN') : 'N/A';

      // Two-column period info
      pdf.fontSize(10).font('Helvetica-Bold').fillColor('#333333');
      pdf.text('Salary Period:', leftMargin);
      pdf.fontSize(10).font('Helvetica').text(period, leftMargin + 115, pdf.y - 14);

      pdf.fontSize(10).font('Helvetica-Bold').fillColor('#333333');
      pdf.text('Slip Date:', leftMargin);
      pdf.fontSize(10).font('Helvetica').text(slipDate, leftMargin + 115, pdf.y - 14);

      pdf.fillColor('#000000');
      pdf.moveDown(0.8);

      // ========== 3. EMPLOYEE INFORMATION BOX ==========
      drawEmployeeInfoBox(pdf, employee, { x: leftMargin, width: contentWidth });

      // ========== 4. ATTENDANCE SUMMARY BOX ==========
      if (slip.attendanceData) {
        drawAttendanceSummaryBox(pdf, slip.attendanceData, { x: leftMargin, width: contentWidth });
      }

      pdf.moveDown(0.5);

      // ========== 5. EARNINGS TABLE ==========
      const earningsRows = [];
      
      const earningsMap = [
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

      earningsMap.forEach(([label, amount]) => {
        if (amount > 0) {
          earningsRows.push([label, amount]);
        }
      });

      if (slip.earnings?.otherEarnings && Array.isArray(slip.earnings.otherEarnings)) {
        slip.earnings.otherEarnings.forEach(({ name, amount }) => {
          if (amount > 0) {
            earningsRows.push([name, amount]);
          }
        });
      }

      drawSalaryTable(pdf, {
        title: 'EARNINGS',
        rows: earningsRows,
        totalLabel: 'Gross Earnings',
        totalAmount: slip.grossEarnings || 0,
        x: leftMargin,
        width: contentWidth,
        headerColor: '#1f4e78'
      });

      pdf.moveDown(0.4);

      // ========== 6. DEDUCTIONS TABLE ==========
      const deductionsRows = [];

      const deductionsMap = [
        ['Provident Fund (PF)', slip.deductions?.providentFund || 0],
        ['Employee State Insurance (ESI)', slip.deductions?.employeeStateInsurance || 0],
        ['Professional Tax', slip.deductions?.professionalTax || 0],
        ['Income Tax', slip.deductions?.incomeTax || 0],
        ['Leave Deduction', slip.deductions?.leaveDeduction || 0]
      ];

      deductionsMap.forEach(([label, amount]) => {
        if (amount > 0) {
          deductionsRows.push([label, amount]);
        }
      });

      if (slip.deductions?.otherDeductions && Array.isArray(slip.deductions.otherDeductions)) {
        slip.deductions.otherDeductions.forEach(({ name, amount }) => {
          if (amount > 0) {
            deductionsRows.push([name, amount]);
          }
        });
      }

      drawSalaryTable(pdf, {
        title: 'DEDUCTIONS',
        rows: deductionsRows,
        totalLabel: 'Total Deductions',
        totalAmount: slip.totalDeductions || 0,
        x: leftMargin,
        width: contentWidth,
        headerColor: '#8b6f47'
      });

      pdf.moveDown(0.6);

      // ========== 7. NET SALARY BOX ==========
      const netSalary = slip.netSalary || Math.max(0, (slip.grossEarnings || 0) - (slip.totalDeductions || 0));
      drawNetSalaryBox(pdf, netSalary, { x: leftMargin, width: contentWidth });

      // ========== 8. FOOTER ==========
      drawFooter(pdf, leftMargin, contentWidth);

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
