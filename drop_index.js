
const { Pool } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load env vars
const envPath = path.resolve(__dirname, '.env');
dotenv.config({ path: envPath });

async function run() {
  const connectionString = 
    process.env.DATABASE_URL || 
    process.env.POSTGRES_URL || 
    process.env.WCLTV_POSTGRES_URL;

  console.log('Connecting to DB to drop constraint...');
  
  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes('neon.tech') ? { rejectUnauthorized: false } : undefined
  });

  try {
    // Drop the unique constraint if it exists
    await pool.query(`
      DROP INDEX IF EXISTS idx_habit_logs_unique_daily;
      DROP INDEX IF EXISTS idx_habit_logs_daily_unique;
    `);
    
    console.log('Successfully dropped unique indexes on habit_logs (if they existed).');
  } catch (err) {
    console.error('Error executing query:', err);
  } finally {
    await pool.end();
  }
}

run();
