import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Session from './models/Session.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

async function testSession() {
  try {
    console.log('🔍 MONGODB_URI:', process.env.MONGODB_URI ? 'Set' : 'Not set');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Count active sessions
    const activeCount = await Session.countDocuments({ isActive: true });
    console.log(`📊 Active sessions: ${activeCount}`);

    // List all active sessions
    const activeSessions = await Session.find({ isActive: true }).lean();
    console.log('📋 Active sessions:', activeSessions);

    // Count by organization
    const byOrg = await Session.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$orgId', count: { $sum: 1 } } }
    ]);
    console.log('🏢 Sessions by organization:', byOrg);

    // Count by role
    const byRole = await Session.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);
    console.log('👥 Sessions by role:', byRole);

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testSession();
