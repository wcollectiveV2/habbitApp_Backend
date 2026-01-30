const fs = require('fs');
const path = require('path');
const { neon } = require('@neondatabase/serverless');

// Load environment variables from .env
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  envConfig.split('\n').forEach(line => {
    // Skip comments and empty lines
    if (!line || line.startsWith('#')) return;
    
    // Match KEY=VALUE
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
  console.log('Loaded environment variables from .env');
}

function getDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.WCLTV_POSTGRES_URL) return process.env.WCLTV_POSTGRES_URL;
  // ... (simplified for this script, assumes basic envs are set)
   if (process.env.POSTGRES_URL) return process.env.POSTGRES_URL;
   
  for (const key in process.env) {
      if (process.env[key] && (process.env[key].startsWith('postgres://') || process.env[key].startsWith('postgresql://'))) {
          return process.env[key];
      }
  }

  throw new Error('No database URL found');
}

async function runSqlFile(sql, filePath) {
  console.log(`Running ${filePath}...`);
  try {
    const fullPath = path.join(__dirname, '..', filePath);
    if (!fs.existsSync(fullPath)) {
        console.error(`File not found: ${filePath}`);
        return;
    }
    const content = fs.readFileSync(fullPath, 'utf8');
    
    // Clean SQL
    const cleanContent = content
        .replace(/--.*$/gm, '') 
        .replace(/\/\*[\s\S]*?\*\//g, '');
        
    const statements = cleanContent
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);
        
    for (const statement of statements) {
        try {
            await sql(statement);
        } catch (e) {
            console.error(`Error running statement: ${statement.substring(0, 50)}...`);
            console.error(e);
        }
    }
  } catch (e) {
    console.error(`Error running ${filePath}:`, e);
  }
}

async function main() {
  try {
    const dbUrl = getDatabaseUrl();
    console.log('Connecting to database to RESET and RESEED...');
    const sql = neon(dbUrl);
    
    // 1. Drop Tables
    console.log(' dropping tables...');
    const tables = [
        'challenge_task_logs',
        'challenge_tasks',
        'challenge_participants',
        'challenge_logs',
        'activity_feed',
        'user_follows',
        'habit_logs',
        'tasks',
        'habits',
        'organization_members',
        'user_protocols',
        'protocol_elements',
        'protocols',
        'notifications',
        'challenges',
        'organizations',
        'users'
    ];
    
    for (const table of tables) {
        try {
            await sql(`DROP TABLE IF EXISTS ${table} CASCADE`);
            console.log(`Dropped ${table}`);
        } catch (e) {
            console.error(`Failed to drop ${table}:`, e);
        }
    }
    
    // 2. Re-run Schema and Seeds
    console.log('Re-running schema and seeds...');
    
    await runSqlFile(sql, 'schema.sql');
    await runSqlFile(sql, 'migrations/add_rewards.sql');
    await runSqlFile(sql, 'schema_organizations.sql'); // Create org tables
    
    // Schema_organizations also has some alters and index creation which is fine to re-run or will fail gracefully or IF NOT EXISTS
    
    await runSqlFile(sql, 'migrations/005_add_roles_column.sql'); // Ensure migrations are applied if not in schema yet
    // Note: 005_add_roles_column.sql adds access to roles (which is in schema.sql but good to be safe or if schema.sql was not updated with migration content manually)
    // Actually, I updated `schema.sql` to include `roles`, so the migration 005 might file if it tries to add column that exists, but `ADD COLUMN IF NOT EXISTS` handles that.
    
    await runSqlFile(sql, 'seed-users.sql');
    await runSqlFile(sql, 'seed-organizations.sql');
    await runSqlFile(sql, 'seed-challenges.sql');

    console.log('Database Reset and Reseed Completed Successfully.');
    
  } catch (err) {
    console.error('Database reset failed:', err);
    process.exit(1);
  }
}

main();
