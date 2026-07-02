import 'dotenv/config';
import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:30000';
const dbName = process.env.MONGODB_DB || 'momentum';

export async function connectMomentumMongo() {
  if (mongoose.connection.readyState === 1) return mongoose.connection.db;
  await mongoose.connect(uri, { dbName });
  return mongoose.connection.db;
}

export async function momentumCollection(name) {
  const db = await connectMomentumMongo();
  if (!db) throw new Error('MongoDB connection did not expose a database handle');
  return db.collection(name);
}

export async function closeMomentumMongo() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
