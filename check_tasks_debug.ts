
import { extractDate } from './lib/date-utils'; // Just kidding
import { query } from './lib/db';
import * as dotenv from 'dotenv';
dotenv.config();

async function checkTasks() {
  try {
    const res = await query(`
      SELECT title, due_date, status 
      FROM tasks 
      WHERE user_id = 'e2e00001-0000-0000-0000-000000000001'
    `);
    console.log('Tasks for test user:');
    console.table(res);
    
    // Check what DB thinks is CURRENT_DATE
    const dateRes = await query('SELECT CURRENT_DATE::text as db_date, NOW() as db_now');
    console.log('DB Date info:', dateRes[0]);
    
  } catch (e) {
    console.error(e);
  }
}

checkTasks();
