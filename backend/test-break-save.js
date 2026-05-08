import mongoose from 'mongoose';
import Attendance from './models/Attendance.js';
import User from './models/User.js';
import Employee from './models/Employee.js';
import dotenv from 'dotenv';

dotenv.config();

async function testBreakSave() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/workplus');
    console.log('Connected to MongoDB');

    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Find Rinky's latest attendance record
    const rinkyUser = await User.findOne({ name: 'Rinky' });
    console.log('\nRinky User ID:', rinkyUser?._id);

    const rinkyEmployee = await Employee.findOne({ userId: rinkyUser?._id });
    console.log('Rinky Employee ID:', rinkyEmployee?._id);

    // Find latest attendance record
    const latestAttendance = await Attendance.findOne({
      employeeId: rinkyEmployee?._id,
      date: { $gte: today, $lt: tomorrow }
    })
    .sort({ _id: -1 })
    .lean();

    console.log('\nLatest Attendance Record:');
    console.log('ID:', latestAttendance?._id);
    console.log('Check-in:', latestAttendance?.checkIn);
    console.log('Check-out:', latestAttendance?.checkOut);
    console.log('Current breaks:', latestAttendance?.breaks?.length || 0);

    // Simulate adding a break
    console.log('\n--- Simulating break-start ---');
    const newBreak = {
      startTime: new Date(),
      breakType: 'regular',
      notes: 'Test break',
      location: 'Office'
    };

    const result = await Attendance.findByIdAndUpdate(
      latestAttendance._id,
      {
        $push: { breaks: newBreak },
        $set: { lastBreakStart: new Date() }
      },
      { new: true }
    ).lean();

    console.log('After adding break:');
    console.log('Breaks count:', result?.breaks?.length || 0);
    console.log('Breaks:', JSON.stringify(result?.breaks, null, 2));

    // Now fetch using the /today endpoint logic
    console.log('\n--- Fetching using /today endpoint logic ---');
    const allRecords = await Attendance.find({
      employeeId: rinkyEmployee?._id,
      date: { $gte: today, $lt: tomorrow }
    })
    .sort({ _id: 1 })
    .lean();

    console.log('Total records:', allRecords.length);

    let allBreaks = [];
    allRecords.forEach((record, index) => {
      console.log(`\nRecord ${index + 1}:`);
      console.log('  ID:', record._id);
      console.log('  Check-in:', record.checkIn);
      console.log('  Check-out:', record.checkOut);
      console.log('  Breaks:', record.breaks?.length || 0);
      if (record.breaks && record.breaks.length > 0) {
        record.breaks.forEach((b, i) => {
          console.log(`    Break ${i + 1}: ${b.startTime}`);
        });
        allBreaks = allBreaks.concat(record.breaks);
      }
    });

    console.log('\n--- Combined breaks from all records ---');
    console.log('Total combined breaks:', allBreaks.length);
    allBreaks.forEach((b, i) => {
      console.log(`Break ${i + 1}: ${b.startTime}`);
    });

    await mongoose.connection.close();
    console.log('\nConnection closed');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testBreakSave();
