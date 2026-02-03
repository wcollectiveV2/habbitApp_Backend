
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
      console.log('Found key:', key);

    }
  });
  console.log('Loaded environment variables from .env');
} else {
  console.log('.env file not found at', envPath);
}

function getDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.WCLTV_POSTGRES_URL) return process.env.WCLTV_POSTGRES_URL;
  if (process.env.WCLTV_DATABASE_URL) return process.env.WCLTV_DATABASE_URL;
  if (process.env.POSTGRES_URL) return process.env.POSTGRES_URL;
  
  // Try to find any env var that looks like a postgres URL
  for (const key in process.env) {
      if (key.includes('DATABASE_URL') || key.includes('POSTGRES_URL')) {
        if (process.env[key] && (process.env[key].startsWith('postgres://') || process.env[key].startsWith('postgresql://'))) {
          console.log(`Using ${key} as database URL`);
          return process.env[key];
        }
      }
  }

  throw new Error('No database URL found. Set DATABASE_URL in .env');
}

const DATABASE_URL = getDatabaseUrl();

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is missing');
  process.exit(1);
}


const sql = neon(DATABASE_URL);

async function runSqlFile(filePath) {
  console.log(`Running ${path.basename(filePath)}...`);
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Clean comments
  const cleanContent = content
      .replace(/--.*$/gm, '') // Remove single line comments
      .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove block comments
      
  const statements = cleanContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
      
  for (const statement of statements) {
      // Skip empty statements or just comments that survived
      if (!statement) continue;

      try {
        await sql(statement);
      } catch (error) {
        // Ignore "already exists" errors for create table/index
        const isAlreadyExists = error.message?.includes('already exists') || error.code === '42P07';
        // Ignore duplicate key for inserts
        const isDuplicateDetails = error.message?.includes('duplicate key') || error.code === '23505';

        if (!isAlreadyExists && !isDuplicateDetails) {
            console.error(`Error running statement: ${statement.substring(0, 50)}...`, error);
        }
      }
  }
  console.log(`Successfully ran ${path.basename(filePath)}`);
}


async function main() {
  console.log('Connecting to database...');
  
  // 1. Run Core Schema
  await runSqlFile(path.join(__dirname, '../schema.sql'));

  // 2. Run Organizations Schema
  await runSqlFile(path.join(__dirname, '../schema_organizations.sql'));

  // 3. Run Seed Data
  await runSqlFile(path.join(__dirname, '../seed-e2e-tests.sql'));

  console.log('E2E Database setup completed.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
