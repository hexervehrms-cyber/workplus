/**
 * Professional salary slip HTML (print / download / iframe preview).
 * Hexerve-branded salary slip template with official logo, address, and green accent styling.
 * 
 * Logo is embedded as base64 PNG to ensure reliable display in all contexts:
 * - iframe preview
 * - new tab viewing
 * - downloaded HTML files
 * - printed PDFs
 * - production deployments
 */

function escapeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isMongoObjectIdLike(value) {
  return typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
}

function getDisplayEmployeeCode(employee = {}, slip = {}) {
  const code = 
    employee?.employeeCode ||
    employee?.employeeId ||
    employee?.empId ||
    employee?.nipId ||
    slip?.employeeCode ||
    slip?.employeeIdCode ||
    slip?.employeeDisplayId ||
    '';
  
  // Do not display MongoDB ObjectId-like values
  if (code && isMongoObjectIdLike(String(code))) {
    return 'N/A';
  }
  
  return code || 'N/A';
}

function formatMoney(amount, currency = 'INR') {
  const n = Number(amount) || 0;
  const symbol = currency === 'IDR' ? 'Rp.' : '₹';
  return `${symbol}${n.toLocaleString('en-IN')}`;
}

function formatAddress(address) {
  if (!address || typeof address !== 'object') return '';
  const parts = [
    address.street,
    address.city,
    address.state,
    address.zipCode,
    address.country,
  ].filter(Boolean);
  return parts.join(', ');
}

function earningRows(earnings, currency) {
  if (!earnings) return '';
  const rows = [];
  const add = (label, amount) => {
    const v = Number(amount) || 0;
    if (v > 0) rows.push({ label, amount: v });
  };

  add('Basic Salary', earnings.basic);
  add('House Rent Allowance (HRA)', earnings.hra);
  add('Medical Expenses', earnings.medicalExpenses);
  add('Travel Allowance', earnings.travel);
  add('Internet Charges', earnings.internetCharges);
  add('Night Shift Allowance', earnings.nightShiftAllowance);
  add('Meal Allowances', earnings.mealAllowance);
  add('Health Benefits', earnings.healthBenefits);
  add('Incentives', earnings.incentives);
  add('Bonus / Incentive', earnings.bonus);
  add('Commission', earnings.commission);

  if (Array.isArray(earnings.otherEarnings)) {
    for (const item of earnings.otherEarnings) {
      if (item?.name && Number(item.amount) > 0) {
        rows.push({ label: item.name, amount: Number(item.amount) });
      }
    }
  }

  if (rows.length === 0) {
    return `<tr><td colspan="2" style="text-align:center;color:#666;">No earnings recorded</td></tr>`;
  }

  return rows
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.label)}</td><td class="amount">${formatMoney(r.amount, currency)}</td></tr>`
    )
    .join('');
}

/**
 * @param {object} options
 * @param {object} options.slip - SalarySlip document (plain object)
 * @param {object} [options.employee] - populated or flat employee fields
 * @param {object} [options.organization] - { name, address, logo }
 */
export function buildSalarySlipHtml({ slip, employee = {}, organization = {} }) {
  const monthName = new Date(slip.year, slip.month - 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
  const slipNumber = `S${String(slip._id).slice(-6).toUpperCase()}`;
  const currency = organization?.settings?.currency || organization?.currency || 'INR';
  
  // Use Hexerve branding by default, fallback to organization name if available
  const companyName = organization?.name || 'Hexerve';
  const companyAddress = formatAddress(organization?.address) || '1009, Tower 4, Assotech Business Cresterra, Noida';

  const empName =
    employee.fullName ||
    `${employee.firstName || ''} ${employee.lastName || ''}`.trim() ||
    slip.employeeName ||
    'Employee';
  const empCode = getDisplayEmployeeCode(employee, slip);
  const department = employee.department || slip.department || 'N/A';
  const designation = employee.designation || slip.designation || 'N/A';
  const joinDate = employee.joiningDate
    ? new Date(employee.joiningDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'N/A';

  const printDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Hexerve logo - Load PNG file and convert to base64 for universal compatibility
  // Works in: iframe preview, blob download, new tab, printed PDF, production
  // This is the exact Hexerve brand logo PNG image
  const fs = require('fs');
  const path = require('path');
  const logoPath = path.join(__dirname, '../public/assets/Hexerve_logo.PNG');
  let logoUrl;
  try {
    const logoBuffer = fs.readFileSync(logoPath);
    logoUrl = 'data:image/png;base64,' + logoBuffer.toString('base64');
  } catch (err) {
    // Fallback: use a minimal placeholder if logo file is missing
    console.warn('Hexerve logo file not found at', logoPath, '- using placeholder');
    logoUrl = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="60"%3E%3Crect fill="%23f0f0f0" width="200" height="60"/%3E%3Ctext x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="12" fill="%23999"%3EHexerve%3C/text%3E%3C/svg%3E';
  }
  const logoHtml = `<div class="logo-container"><img src="${escapeHtml(logoUrl)}" alt="Hexerve Logo" class="company-logo-img" /></div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Salary Slip - ${escapeHtml(monthName)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: A4; margin: 12mm; }
    body {
      font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
      background: #e8e8e8;
      padding: 24px;
      color: #111;
    }
    .page {
      position: relative;
      max-width: 820px;
      margin: 0 auto;
      background: #ffffff;
      background-image:
        radial-gradient(circle at 20% 30%, rgba(0,0,0,0.02) 0%, transparent 50%),
        radial-gradient(circle at 80% 70%, rgba(0,0,0,0.02) 0%, transparent 50%);
      padding: 36px 40px 0;
      box-shadow: 0 4px 24px rgba(0,0,0,0.12);
      overflow: visible;
      width: 100%;
      box-sizing: border-box;
    }
    .corner-tl, .corner-tr {
      position: absolute;
      top: 0;
      width: 120px;
      height: 120px;
      pointer-events: none;
    }
    .corner-tl { left: 0; }
    .corner-tr { right: 0; }
    .corner-tl::before, .corner-tr::before {
      content: '';
      position: absolute;
      width: 0;
      height: 0;
      border-style: solid;
    }
    .corner-tl::before {
      top: 0; left: 0;
      border-width: 80px 80px 0 0;
      border-color: #1a5f3f transparent transparent transparent;
    }
    .corner-tr::before {
      top: 0; right: 0;
      border-width: 0 80px 80px 0;
      border-color: transparent #1a5f3f transparent transparent;
    }
    .header-row {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 24px;
      padding-top: 8px;
      margin-bottom: 24px;
      min-width: 0;
    }
    .company-block {
      display: flex;
      align-items: center;
      gap: 16px;
      z-index: 1;
      min-width: 0;
    }
    .logo-container {
      width: 160px;
      height: 80px;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      flex-shrink: 0;
    }
    .company-logo-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      object-position: left center;
    }
    .company-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-height: 80px;
    }
    .company-name {
      font-size: 20px;
      font-weight: 700;
      color: #1a5f3f;
      line-height: 1.2;
    }
    .company-address {
      font-size: 12px;
      color: #555;
      margin-top: 4px;
      line-height: 1.4;
    }
    .slip-title {
      text-align: center;
      font-size: 28px;
      font-weight: 800;
      letter-spacing: 0.02em;
      color: #1a5f3f;
      z-index: 1;
      line-height: 1.2;
    }
    .slip-meta {
      text-align: right;
      font-size: 12px;
      z-index: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-height: 80px;
    }
    .slip-meta-row {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-bottom: 4px;
    }
    .slip-meta-label { font-weight: 700; min-width: 88px; text-align: right; color: #1a5f3f; }
    .divider-heavy {
      border: none;
      border-top: 3px solid #1a5f3f;
      margin: 0 0 24px;
    }
    .main-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 28px;
      margin-bottom: 28px;
    }
    .section-title {
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      border-bottom: 2px solid #1a5f3f;
      padding-bottom: 8px;
      margin-bottom: 12px;
      color: #1a5f3f;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    table.data-table td {
      border: 1px solid #ddd;
      padding: 9px 10px;
      vertical-align: middle;
    }
    table.data-table td:first-child {
      font-weight: 700;
      background: #f0f8f5;
      width: 48%;
      color: #333;
    }
    table.data-table td.amount {
      text-align: right;
      font-weight: 600;
      background: #fff;
      color: #1a5f3f;
    }
    .income-label {
      font-weight: 700;
      font-size: 12px;
      margin-bottom: 8px;
      color: #1a5f3f;
    }
    .footer-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 28px;
      align-items: start;
      margin-bottom: 20px;
    }
    .print-date {
      font-size: 11px;
      font-style: italic;
      color: #666;
      margin-top: 12px;
    }
    .net-bar-wrap {
      margin-top: 8px;
    }
    .net-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #1a5f3f;
      color: #ffffff;
      padding: 14px 18px;
      font-weight: 700;
      font-size: 14px;
      border-radius: 2px;
    }
    .net-bar-amount { font-size: 18px; font-weight: 800; }
    .signature-block {
      margin-top: 28px;
      text-align: right;
      font-size: 12px;
      color: #333;
    }
    .signature-line {
      border-top: 2px solid #1a5f3f;
      width: 180px;
      margin-left: auto;
      margin-top: 48px;
    }
    .bottom-bar {
      height: 24px;
      background: #1a5f3f;
      margin: 24px -40px 0;
      width: calc(100% + 80px);
    }
    @media print {
      body { background: #fff; padding: 0; }
      .page { box-shadow: none; max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="corner-tl"></div>
    <div class="corner-tr"></div>

    <div class="header-row">
      <div class="company-block">
        ${logoHtml}
        <div class="company-info">
          <div class="company-name">${escapeHtml(companyName)}</div>
          <div class="company-address">${escapeHtml(companyAddress)}</div>
        </div>
      </div>
      <div class="slip-title">SALARY SLIP</div>
      <div class="slip-meta">
        <div class="slip-meta-row">
          <span class="slip-meta-label">Pay Period</span>
          <span>${escapeHtml(monthName)}</span>
        </div>
        <div class="slip-meta-row">
          <span class="slip-meta-label">Slip Number</span>
          <span>${escapeHtml(slipNumber)}</span>
        </div>
      </div>
    </div>

    <hr class="divider-heavy" />

    <div class="main-grid">
      <div>
        <div class="section-title">Employee Information</div>
        <table class="data-table">
          <tr><td>Employee Name</td><td>${escapeHtml(empName)}</td></tr>
          <tr><td>Employee NIP/ID</td><td>${escapeHtml(empCode)}</td></tr>
          <tr><td>Department</td><td>${escapeHtml(department)}</td></tr>
          <tr><td>Designation</td><td>${escapeHtml(designation)}</td></tr>
          <tr><td>Join Date</td><td>${escapeHtml(joinDate)}</td></tr>
        </table>
      </div>
      <div>
        <div class="section-title">Salary Details</div>
        <div class="income-label">Income</div>
        <table class="data-table">
          ${earningRows(slip.earnings, currency)}
        </table>
      </div>
    </div>

    <div class="footer-grid">
      <div>
        <div class="section-title">Salary Summary</div>
        <table class="data-table">
          <tr><td>Total Revenue</td><td class="amount">${formatMoney(slip.grossEarnings, currency)}</td></tr>
          <tr><td>Total Deductions</td><td class="amount">${formatMoney(slip.totalDeductions, currency)}</td></tr>
          <tr><td>Net Salary Received</td><td class="amount">${formatMoney(slip.netSalary, currency)}</td></tr>
        </table>
        <p class="print-date">Slip Print Date: ${escapeHtml(printDate)}</p>
      </div>
      <div>
        <div class="net-bar-wrap">
          <div class="net-bar">
            <span>Net Salary Received</span>
            <span class="net-bar-amount">${formatMoney(slip.netSalary, currency)}</span>
          </div>
        </div>
        <div class="signature-block">
          <div>HR / Finance Signature</div>
          <div class="signature-line"></div>
        </div>
      </div>
    </div>

    <div class="bottom-bar"></div>
  </div>
</body>
</html>`;
}

export default { buildSalarySlipHtml, formatMoney, escapeHtml, isMongoObjectIdLike, getDisplayEmployeeCode };
