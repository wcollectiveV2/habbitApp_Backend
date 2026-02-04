// global-setup.ts
// Playwright Global Setup - Seeds the database before running tests
// ============================================================================

import { execSync } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function globalSetup() {
  console.log('\n🌱 Setting up E2E test database...\n');
  
  const backendDir = path.resolve(__dirname, '../../../vercel-backend');
  const seedFile = path.join(backendDir, 'seed-e2e-tests.sql');
  
  try {
    // Check if DATABASE_URL is set
    if (!process.env.DATABASE_URL) {
      console.log('⚠️  DATABASE_URL not set. Attempting to load from backend .env...');
      
      // Try to load from backend .env
      const envPath = path.join(backendDir, '.env');
      const fs = require('fs');
      
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/DATABASE_URL=["']?([^"'\n]+)["']?/);
        if (match) {
          process.env.DATABASE_URL = match[1];
          console.log('✅ Loaded DATABASE_URL from backend .env');
        }
      }
    }
    
    if (!process.env.DATABASE_URL) {
      console.log('⚠️  DATABASE_URL not found. Skipping database seed.');
      console.log('   Tests will run but may fail if database is not seeded.');
      console.log('   To seed manually, run:');
      console.log(`   psql $DATABASE_URL -f ${seedFile}`);
      return;
    }
    
    // Run the seed file
    console.log('📄 Running seed-e2e-tests.sql...');
    
    execSync(`psql "${process.env.DATABASE_URL}" -f "${seedFile}"`, {
      cwd: backendDir,
      stdio: 'pipe'
    });
    
    console.log('✅ Database seeded successfully!\n');
    
  } catch (error: any) {
    // If psql is not available, try using node script
    console.log('⚠️  psql not available, trying Node.js approach...');
    
    try {
      // Use the existing seed script approach
      const { neon } = require('@neondatabase/serverless');
      const fs = require('fs');
      
      if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL not set');
      }
      
      const sql = neon(process.env.DATABASE_URL);
      const seedContent = fs.readFileSync(seedFile, 'utf8');
      
      // Clean and split SQL
      const cleanContent = seedContent
        .replace(/--.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '');
      
      const statements = cleanContent
        .split(';')
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0);
      
      for (const statement of statements) {
        try {
          await sql(statement);
        } catch (e: any) {
          // Ignore certain expected errors
          if (!e.message?.includes('already exists') && 
              !e.message?.includes('duplicate key')) {
            console.log(`Warning: ${e.message?.substring(0, 100)}`);
          }
        }
      }
      
      console.log('✅ Database seeded successfully via Node.js!\n');
      
    } catch (nodeError: any) {
      console.log('⚠️  Could not seed database:', nodeError.message);
      console.log('   Tests will run but may fail if database is not seeded.');
      console.log('   To seed manually, run:');
      console.log(`   cd vercel-backend && psql $DATABASE_URL -f seed-e2e-tests.sql`);
    }
  }
}

export default globalSetup;
