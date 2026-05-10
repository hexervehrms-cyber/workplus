/**
 * Test employee login
 */

import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb+srv://atulcse08_db_user:Jadu%40123@workplus.tcf4qho.mongodb.net/workpluspro?retryWrites=true&w=majority';

async function checkEmployees() {
  console.log('Checking employee accounts...\n');
  
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Database connected\n');
    
    const User = mongoose.connection.collection('users');
    const users = await User.find({}).toArray();
    
    console.log('All Users:');
    users.forEach((user, i) => {
      console.log(`  ${i+1}. ${user.name} (${user.email}) - Role: ${user.role}`);
    });
    
    console.log('\nEmployees:');
    const employees = await User.find({ role: 'employee' }).toArray();
    if (employees.length > 0) {
      employees.forEach((emp, i) => {
        console.log(`  ${i+1}. ${emp.name} (${emp.email})`);
      });
    } else {
      console.log('  No employees found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkEmployees();
