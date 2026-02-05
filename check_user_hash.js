
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const client = new Client({
  connectionString: 'postgresql://habitpulse:habitpulse_dev@localhost:5432/habitpulse'
});

async function run() {
  try {
    await client.connect();
    
    console.log('Updating password hash...');
    const newHash = '$2a$10$LC1zo.Bs58DviNEbPuYYYeLDsJ9ZV9wKlnFDNHvcjp7CQPh5qKSoG';
    await client.query('UPDATE users SET password_hash = $1 WHERE email = $2', [newHash, 'testuser@e2etest.com']);
    
    const res = await client.query('SELECT email, password_hash FROM users WHERE email = $1', ['testuser@e2etest.com']);
    console.log('User found:', res.rows.length > 0);
    if (res.rows.length > 0) {
      console.log('Stored Hash:', res.rows[0].password_hash);
      const match = bcrypt.compareSync('Test123!', res.rows[0].password_hash);
      console.log('Password match for "Test123!":', match);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
