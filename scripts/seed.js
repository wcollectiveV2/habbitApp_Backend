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
} else {
    console.log('.env file not found');
}

function getDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.WCLTV_POSTGRES_URL) return process.env.WCLTV_POSTGRES_URL;
  if (process.env.WCLTV_PGHOST && process.env.WCLTV_PGUSER && process.env.WCLTV_PGPASSWORD && process.env.WCLTV_PGDATABASE) {
    return `postgresql://${process.env.WCLTV_PGUSER}:${process.env.WCLTV_PGPASSWORD}@${process.env.WCLTV_PGHOST}/${process.env.WCLTV_PGDATABASE}?sslmode=require`;
  }
  if (process.env.POSTGRES_URL) return process.env.POSTGRES_URL;
  
  // Try to find any env var that looks like a postgres URL
  for (const key in process.env) {
      if (process.env[key].startsWith('postgres://') || process.env[key].startsWith('postgresql://')) {
          console.log(`Using ${key} as database URL`);
          return process.env[key];
      }
  }

  throw new Error('No database URL found. Set DATABASE_URL in .env');
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
    
    // Simple approach to split by semicolon. 
    // This assumes no semicolons in strings/comments that verify standard SQL structure.
    // We clean comments first.
    const cleanContent = content
        .replace(/--.*$/gm, '') // Remove single line comments
        .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove block comments
        
    const statements = cleanContent
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);
        
    for (const statement of statements) {
        try {
            await sql(statement);
        } catch (e) {
            console.error(`Error running statement: ${statement.substring(0, 100).replace(/\n/g, ' ')}...`);
            console.error(e);
            // throw e; // Uncomment to stop on first error
        }
    }
    
    console.log(`Successfully ran ${filePath}`);
  } catch (e) {
    console.error(`Error running ${filePath}:`, e);
  }
}

async function main() {
  let sql;
  try {
    const dbUrl = getDatabaseUrl();
    console.log('Connecting to database...');
    // Log masked URL for debugging
    // console.log('URL:', dbUrl.replace(/:([^@]+)@/, ':****@'));
    
    sql = neon(dbUrl);
    
    // 1. Run Core Schema
    await runSqlFile(sql, 'schema.sql');
    await runSqlFile(sql, 'migrations/add_rewards.sql');
    
    // 1b. Run Users Seed
    await runSqlFile(sql, 'seed-users.sql');

    // 2. Run Organizations Schema
    await runSqlFile(sql, 'schema_organizations.sql');

    // 2b. Run Organizations Seed
    await runSqlFile(sql, 'seed-organizations.sql');
    
    // 3. Run Challenges Seed
    await runSqlFile(sql, 'seed-challenges.sql');
    
    console.log('Database setup completed.');
    
  } catch (err) {
    console.error('Database setup failed:', err);
    process.exit(1);
  }
}

main();
