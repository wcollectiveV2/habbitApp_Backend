const { neon } = require('@neondatabase/serverless');
const path = require('path');
const fs = require('fs');

// Load env
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  envConfig.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
  });
}

const sql = neon(process.env.DATABASE_URL || process.env.WCLTV_POSTGRES_URL);

async function checkUser() {
    try {
        const result = await sql`SELECT email, roles FROM users WHERE email = 'admin@chrislo.com'`;
        console.log('User found:', JSON.stringify(result, null, 2));
    } catch (e) {
        console.error(e);
    }
}

checkUser();
