import mongoose from 'mongoose';
import Attendance from './models/Attendance.js';
import User from './models/User.js';
import Employee from './models/Employee.js';
import dotenv from 'dotenv';

dotenv.config();

async function testAPIResponse() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/workplus');
    console.log('Connected to MongoDB');

    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Find Rinky
    const rinkyUser = await User.findOne({ name: 'Rinky' });
    const rinkyEmployee = await Employee.findOne({ userId: rinkyUser?._id });

    console.log('\nRinky Employee ID:', rinkyEmployee?._id);

    // Simulate the /today endpoint logic
    const query = {
      orgId: rinkyEmployee?.orgId || 'system',
      date: { $gte: today, $lt: tomorrow },
      employeeId: rinkyEmployee?._id
    };

    console.log('\nQuery:', JSON.stringify(query, null, 2));

    // Fetch ALL attendance records for today
    const allAttendanceRecords = await Attendance.find(query)
    .sort({ _id: 1 })
    .populate('userId', 'name email avatar')
    .populate('employeeId', 'employeeCode department')
    .lean();

    console.log('\nTotal records found:', allAttendanceRecords.length);

    // Get the latest record for current status
    const attendance = allAttendanceRecords.length > 0 ? allAttendanceRecords[allAttendanceRecords.length - 1] : null;

    // Combine all breaks and meetings from all records
    let allBreaks = [];
    let allMeetings = [];
    
    if (allAttendanceRecords.length > 0) {
      allAttendanceRecords.forEach(record => {
        if (record.breaks && Array.isArray(record.breaks)) {
          allBreaks = allBreaks.concat(record.breaks);
        }
        if (record.meetings && Array.isArray(record.meetings)) {
          allMeetings = allMeetings.concat(record.meetings);
        }
      });
    }

    console.log('\nCombined breaks:', allBreaks.length);
    console.log('Combined meetings:', allMeetings.length);

    // Return the latest record but with combined breaks/meetings from all records
    const responseAttendance = attendance ? {
      ...attendance,
      breaks: allBreaks,
      meetings: allMeetings
    } : null;

    console.log('\n=== RESPONSE ATTENDANCE ===');
    console.log('Check-in:', responseAttendance?.checkIn);
    console.log('Check-out:', responseAttendance?.checkOut);
    console.log('Breaks count:', responseAttendance?.breaks?.length || 0);
    console.log('Breaks:', JSON.stringify(responseAttendance?.breaks, null, 2));
    console.log('Meetings count:', responseAttendance?.meetings?.length || 0);

    await mongoose.connection.close();
    console.log('\nConnection closed');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testAPIResponse();
