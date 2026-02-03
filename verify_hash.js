const bcrypt = require('bcryptjs');

const hash = '$2a$10$4.KfjCxtAo0r6DC3724VbOnHJ4xqpFosqhAhGjwcJiULuo3R/0YG.';
const pass = 'Test123!';
const passAdmin = 'admin';

async function check() {
  const match = await bcrypt.compare(pass, hash);
  console.log(`Password '${pass}' matches: ${match}`);
  
  const matchAdmin = await bcrypt.compare(passAdmin, hash);
  console.log(`Password '${passAdmin}' matches: ${matchAdmin}`);
}

check();
