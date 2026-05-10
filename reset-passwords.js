/**
 * Reset employee passwords to a common value
 */

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const MONGODB_URI = 'mongodb+srv://atulcse08_db_user:Jadu%40123@workplus.tcf4qho.mongodb.net/workpluspro?retryWrites=true&w=majority';
const NEW_PASSWORD = 'Jadu@123';

async function resetEmployeePasswords() {
  console.log('Resetting employee passwords...\n');
  console.log(`New password: ${NEW_PASSWORD}\n`);
  
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Database connected\n');
    
    const User = mongoose.connection.collection('users');
    
    // Reset employee passwords
    const employees = await User.find({ role: 'employee' }).toArray();
    console.log(`Found ${employees.length} employees\n`);
    
    for (const employee of employees) {
      const hashedPassword = await bcrypt.hash(NEW_PASSWORD, 10);
      await User.updateOne(
        { _id: employee._id },
        { $set: { password: hashedPassword } }
      );
      console.log(`✅ Reset password for: ${employee.name} (${employee.email})`);
    }
    
    // Also reset admin passwords for consistency
    const admins = await User.find({ role: 'admin' }).toArray();
    console.log(`\nFound ${admins.length} admins\n`);
    
    for (const admin of admins) {
      const hashedPassword = await bcrypt.hash(NEW_PASSWORD, 10);
      await User.updateOne(
        { _id: admin._id },
        { $set: { password: hashedPassword } }
      );
      console.log(`✅ Reset password for: ${admin.name} (${admin.email})`);
    }
    
    console.log('\n✅ All passwords reset successfully!');
    console.log(`\nAll users can now login with password: ${NEW_PASSWORD}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

resetEmployeePasswords();
