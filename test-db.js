import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const testConnection = async () => {
  console.log("🔍 Testing MongoDB connection...");
  console.log("📋 Connection URI:", process.env.MONGODB_URI?.replace(/:[^:]*@/, ':***@'));
  
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB Connected Successfully!");
    console.log("📊 Database name:", conn.connection.name);
    console.log("🌐 Host:", conn.connection.host);
    
    // Test a simple operation
    const collections = await conn.connection.db.listCollections().toArray();
    console.log("📁 Collections found:", collections.length);
    
    await mongoose.disconnect();
    console.log("🔌 Disconnected successfully");
  } catch (error) {
    console.error("❌ Connection failed:");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    
    if (error.message.includes("bad auth")) {
      console.log("💡 Possible causes:");
      console.log("  - Incorrect username or password");
      console.log("  - User doesn't exist in the database");
      console.log("  - User doesn't have permission to access this database");
    } else if (error.message.includes("ENOTFOUND")) {
      console.log("💡 Possible causes:");
      console.log("  - Cluster name is incorrect");
      console.log("  - Network connectivity issues");
    }
  }
};

testConnection();
