import mongoose from "mongoose";

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

export const connectDB = async (retryCount = 0): Promise<void> => {
  try {
    const connStr = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/salary_system_db";
    const conn = await mongoose.connect(connStr, { serverSelectionTimeoutMS: 10000 });
    console.log(`[MongoDB] Connected successfully to host: ${conn.connection.host}`);
  } catch (error: any) {
    console.error(`[MongoDB] Connection error (attempt ${retryCount + 1}/${MAX_RETRIES}):`, error.message);
    if (retryCount < MAX_RETRIES - 1) {
      console.log(`[MongoDB] Retrying in ${RETRY_DELAY_MS / 1000}s...`);
      setTimeout(() => connectDB(retryCount + 1), RETRY_DELAY_MS);
    } else {
      console.error("[MongoDB] Max retries reached. Check your MONGODB_URI and network.");
    }
  }
};
