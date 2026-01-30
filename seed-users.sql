
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

-- Create Users with different roles for testing RBAC
-- Password hash corresponds to 'admin' (or whatever the previous dev set, reliable for dev)
INSERT INTO users (email, password_hash, name, bio, roles, created_at)
VALUES 
    -- Global Admin (Has access to everything)
    ('admin@chrislo.com', '$2b$10$rQZ8kHxVJgQjH1M7TJqV5uF8h8nqWQ9BqVN8s3mM5A0uP6YzQJ6Gy', 'Super Admin', 'Platform Administrator', ARRAY['admin'], NOW()),
    
    -- Organization Manager (Manages specific org users)
    ('manager@wcollective.com', '$2b$10$rQZ8kHxVJgQjH1M7TJqV5uF8h8nqWQ9BqVN8s3mM5A0uP6YzQJ6Gy', 'Wcollective Manager', 'Managing Wcollective', ARRAY['manager'], NOW()),
    
    -- Coach (Coach view)
    ('coach@nest.com', '$2b$10$rQZ8kHxVJgQjH1M7TJqV5uF8h8nqWQ9BqVN8s3mM5A0uP6YzQJ6Gy', 'Nest Coach', 'Wellness Coach', ARRAY['coach'], NOW()),
    
    -- Protocol Manager (Can manage protocols)
    ('protocol@chrislo.com', '$2b$10$rQZ8kHxVJgQjH1M7TJqV5uF8h8nqWQ9BqVN8s3mM5A0uP6YzQJ6Gy', 'Protocol Specialist', 'Managing Protocols', ARRAY['protocol_manager'], NOW()),
    
    -- Retreat Manager (Can manage retreats)
    ('retreat@chrislo.com', '$2b$10$rQZ8kHxVJgQjH1M7TJqV5uF8h8nqWQ9BqVN8s3mM5A0uP6YzQJ6Gy', 'Retreat Organizer', 'Managing Retreats', ARRAY['retreat_manager'], NOW()),
    
    -- Shop Manager (Can manage shop)
    ('shop@chrislo.com', '$2b$10$rQZ8kHxVJgQjH1M7TJqV5uF8h8nqWQ9BqVN8s3mM5A0uP6YzQJ6Gy', 'Shop Keeper', 'Managing Shop', ARRAY['shop_manager'], NOW()),
    
    -- Regular User (No admin access)
    ('user@wcollective.com', '$2b$10$rQZ8kHxVJgQjH1M7TJqV5uF8h8nqWQ9BqVN8s3mM5A0uP6YzQJ6Gy', 'Regular User', 'Just a user', ARRAY['user'], NOW())

ON CONFLICT (email) DO UPDATE SET 
    roles = EXCLUDED.roles,
    name = EXCLUDED.name;
