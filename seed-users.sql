
-- Create HabitPulse Team user if not exists
INSERT INTO users (email, password_hash, name, bio, roles)
VALUES (
    'team@habitpulse.com', 
    '$2b$10$rQZ8kHxVJgQjH1M7TJqV5uF8h8nqWQ9BqVN8s3mM5A0uP6YzQJ6Gy', -- dummy hash
    'HabitPulse Team', 
    'Official challenges from the HabitPulse team',
    ARRAY['admin', 'system']
)
ON CONFLICT (email) DO UPDATE SET name = 'HabitPulse Team';
