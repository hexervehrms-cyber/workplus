
import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb+srv://atulcse08_db_user:Jadu%40123@workplus.tcf4qho.mongodb.net/workpluspro?retryWrites=true&w=majority';

async function listUsersVerbose() {
  try {
    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db;
    const users = await db.collection('users').find({}).toArray();
    
    console.log('\n👥 ALL USERS IN DB:');
    console.log('='.repeat(100));
    console.log(`${'Email'.padEnd(30)} | ${'Role'.padEnd(15)} | ${'Active'.padEnd(8)} | ${'OrgId'}`);
    console.log('-'.repeat(100));
    
    users.forEach(u => {
      console.log(`${(u.email || 'N/A').padEnd(30)} | ${(u.role || 'N/A').padEnd(15)} | ${(u.isActive ? 'YES' : 'NO').padEnd(8)} | ${u.orgId}`);
    });
    
    await mongoose.disconnect();
  } catch (error) {
    console.error(error);
  }
}

listUsersVerbose();
