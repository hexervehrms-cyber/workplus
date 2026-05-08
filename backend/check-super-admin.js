const mongoose = require('mongoose');
require('dotenv').config();

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  role: String,
  password: String,
  isActive: Boolean
});

const User = mongoose.model('User', userSchema);

async function checkSuperAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const superAdmin = await User.findOne({ email: 'superadmin@company.com', role: 'super_admin' });
    
    if (superAdmin) {
      console.log('✅ Super Admin exists:');
      console.log('   Email:', superAdmin.email);
      console.log('   Name:', superAdmin.name);
      console.log('   Role:', superAdmin.role);
      console.log('   Active:', superAdmin.isActive);
    } else {
      console.log('❌ Super Admin does not exist');
      console.log('   Expected email: superadmin@company.com');
      console.log('   Expected password: Jadu@123');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkSuperAdmin();
