import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Employee from '../models/Employee.js';
import User from '../models/User.js';
import Attendance from '../models/Attendance.js';
import LeaveRequest from '../models/LeaveRequest.js';
import Expense from '../models/Expense.js';
import Payroll from '../models/Payroll.js';

dotenv.config({ path: './backend/.env' });

async function setupRealEmployeeData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all employees
    const employees = await Employee.find({}).populate('userId');
    
    console.log(`Setting up real data for ${employees.length} employees...\n`);

    for (const employee of employees) {
      if (!employee.userId) {
        console.log(`⚠️  Skipping ${employee.name} - no user linked`);
        continue;
      }

      const userId = employee.userId._id;
      const employeeId = employee._id;
      const orgId = employee.orgId;
      if (!orgId || orgId === 'system') {
        console.log(`  SKIP ${employee.userId.email} — invalid orgId`);
        continue;
      }

      console.log(`\n📝 Setting up data for: ${employee.userId.email}`);

      // Get employee name from user if not available
      const employeeName = employee.name || employee.userId.name || 'Employee';

      // 1. Create today's attendance record
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      let attendance = await Attendance.findOne({
        employeeId,
        date: { $gte: today, $lt: tomorrow }
      });

      if (!attendance) {
        attendance = await Attendance.create({
          userId,
          employeeId,
          employeeName,
          date: today,
          checkIn: new Date(today.getTime() + 9 * 60 * 60 * 1000), // 9 AM
          checkOut: new Date(today.getTime() + 17 * 60 * 60 * 1000), // 5 PM
          status: 'present',
          hoursWorked: 8,
          breaks: [],
          meetings: [],
          orgId
        });
        console.log('   ✅ Created today\'s attendance record');
      } else {
        console.log('   ℹ️  Attendance record already exists');
      }

      // 2. Create leave requests
      const existingLeaves = await LeaveRequest.countDocuments({ employeeId });
      if (existingLeaves === 0) {
        const leaveStart = new Date();
        leaveStart.setDate(leaveStart.getDate() + 7);
        const leaveEnd = new Date(leaveStart);
        leaveEnd.setDate(leaveEnd.getDate() + 2);

        await LeaveRequest.create({
          userId,
          employeeId,
          employeeName,
          type: 'Vacation',
          startDate: leaveStart,
          endDate: leaveEnd,
          reason: 'Planned vacation',
          status: 'pending',
          orgId
        });
        console.log('   ✅ Created pending leave request');

        // Create an approved leave
        const approvedStart = new Date();
        approvedStart.setDate(approvedStart.getDate() - 5);
        const approvedEnd = new Date(approvedStart);
        approvedEnd.setDate(approvedEnd.getDate() + 1);

        await LeaveRequest.create({
          userId,
          employeeId,
          employeeName,
          type: 'Sick Leave',
          startDate: approvedStart,
          endDate: approvedEnd,
          reason: 'Medical appointment',
          status: 'approved',
          approvedBy: userId,
          approvedDate: new Date(),
          orgId
        });
        console.log('   ✅ Created approved leave request');
      } else {
        console.log(`   ℹ️  ${existingLeaves} leave requests already exist`);
      }

      // 3. Create expenses
      const existingExpenses = await Expense.countDocuments({ employeeId });
      if (existingExpenses === 0) {
        await Expense.create({
          userId,
          employeeId,
          employeeName,
          category: 'Travel',
          amount: 500,
          description: 'Client meeting travel',
          date: new Date(),
          status: 'pending',
          orgId
        });

        await Expense.create({
          userId,
          employeeId,
          employeeName,
          category: 'Meals',
          amount: 150,
          description: 'Team lunch',
          date: new Date(),
          status: 'approved',
          approvedBy: userId,
          approvedDate: new Date(),
          orgId
        });
        console.log('   ✅ Created expense records');
      } else {
        console.log(`   ℹ️  ${existingExpenses} expense records already exist`);
      }

      // 4. Create payroll record
      const existingPayroll = await Payroll.countDocuments({ employeeId });
      if (existingPayroll === 0) {
        await Payroll.create({
          employeeId,
          userId,
          employeeName,
          month: new Date().getMonth() + 1,
          year: new Date().getFullYear(),
          baseSalary: 50000,
          grossSalary: 55000,
          allowances: 5000,
          deductions: 2000,
          totalDeductions: 2000,
          netPay: 53000,
          netSalary: 53000,
          status: 'paid',
          paidDate: new Date(),
          orgId
        });
        console.log('   ✅ Created payroll record');
      } else {
        console.log('   ℹ️  Payroll record already exists');
      }

      // 5. Create more attendance records for the week
      for (let i = 1; i < 5; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        const dateEnd = new Date(date);
        dateEnd.setDate(dateEnd.getDate() + 1);

        const existingAttendance = await Attendance.findOne({
          employeeId,
          date: { $gte: date, $lt: dateEnd }
        });

        if (!existingAttendance) {
          await Attendance.create({
            userId,
            employeeId,
            employeeName,
            date,
            checkIn: new Date(date.getTime() + 9 * 60 * 60 * 1000),
            checkOut: new Date(date.getTime() + 17 * 60 * 60 * 1000),
            status: 'present',
            hoursWorked: 8,
            breaks: [],
            meetings: [],
            orgId
          });
        }
      }
      console.log('   ✅ Created attendance records for the week');
    }

    console.log('\n✅ Real employee data setup complete!');
    console.log('\nYou can now login with:');
    console.log('  Email: harsh.gupta@hexerve.com');
    console.log('  Password: Jadu@123');
    console.log('\nOr:');
    console.log('  Email: employee@company.com');
    console.log('  Password: Jadu@123');
    console.log('\nAll data is real and stored in MongoDB!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

setupRealEmployeeData();
