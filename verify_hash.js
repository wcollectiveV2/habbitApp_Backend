const bcrypt = require('bcryptjs');

const hash = '$2b$10$rQZ8kHxVJgQjH1M7TJqV5uF8h8nqWQ9BqVN8s3mM5A0uP6YzQJ6Gy';
const candidate = 'admin';

bcrypt.compare(candidate, hash).then(res => {
    console.log(`Password '${candidate}' matches: ${res}`);
});
