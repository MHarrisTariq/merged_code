import mongoose from "mongoose";

export async function connectDB(mongoUri = process.env.MONGO_URI) {
  if (!mongoUri) throw new Error("MONGO_URI is required");

  // Reuse connection if already connected
  if (mongoose.connection.readyState === 1) return mongoose.connection;

  await mongoose.connect(mongoUri);
  return mongoose.connection;
}

