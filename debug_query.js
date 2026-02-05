
require('dotenv').config({ path: '.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function testQuery() {
  try {
    const habitId = 'dummy-habit-id'; 
    const userId = 'dummy-user-id';
    
    console.log('Testing query with parameters...');
    const queryText = `SELECT COUNT(*)::int as count FROM habit_logs 
       WHERE habit_id = $1 AND user_id = $2 AND completed_at::date = CURRENT_DATE`;
    
    // We expect 0 or some count, but mainly checking for syntax error
    // We'll use NULL UUIDs if possible or just random ones if we don't care about results
    // Postgres will fail if invalid UUID string is passed to UUID column usually, but here checking syntax first.
    // Actually, let's use valid UUID structure to avoid unrelated errors.
    const validUuid = '00000000-0000-0000-0000-000000000000';
    
    await pool.query(queryText, [validUuid, validUuid]);
    console.log('Query executed successfully!');
  } catch (err) {
    console.error('Query failed:', err.message);
  } finally {
    await pool.end();
  }
}

testQuery();
