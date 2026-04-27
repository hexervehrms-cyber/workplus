// Test different connection string formats
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const connectionStrings = [
  process.env.MONGODB_URI,
  "mongodb+srv://atulcse08_db_user:Jadu@123@workplus.tcf4qho.mongodb.net/workpluspro?retryWrites=true&w=majority",
  "mongodb+srv://atulcse08_db_user:Jadu%40123@workplus.tcf4qho.mongodb.net/workpluspro?retryWrites=true&w=majority"
];

const testConnection = async (uri, description) => {
  console.log(`\n🔍 Testing: ${description}`);
  console.log("📋 URI:", uri.replace(/:[^:]*@/, ':***@'));
  
  try {
    const conn = await mongoose.connect(uri);
    console.log("✅ Success! Connected to:", conn.connection.name);
    await mongoose.disconnect();
    return true;
  } catch (error) {
    console.error("❌ Failed:", error.message);
    return false;
  }
};

const runTests = async () => {
  console.log("🧪 Testing different connection string formats...");
  
  for (let i = 0; i < connectionStrings.length; i++) {
    const success = await testConnection(connectionStrings[i], `Format ${i + 1}`);
    if (success) {
      console.log(`\n🎉 Format ${i + 1} works! Update your .env with this URI.`);
      break;
    }
  }
};

runTests();
