// db.js
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = 'ai_compiler_db';

let mongob = null;

async function connectDB() {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    mongob = client.db(DB_NAME);
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
  }
}

// Function to get the current DB connection
function getDB() {
  if (!mongob) throw new Error('MongoDB not connected');
  return mongob;
}

module.exports = { connectDB, getDB };
