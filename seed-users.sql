
-- Create HabitPulse Team user if not exists
INSERT INTO users (email, password_hash, name, bio, roles)
VALUES (
    'team@habitpulse.com', 
    '$2a$10$4O7icw1c1WC2tvFgABkAueuLCDzITCQWNt8ijx/W80QECyOJQEq7S', -- password: admin
    'HabitPulse Team', 
    'Official challenges from the HabitPulse team',
    ARRAY['admin', 'system']
)
ON CONFLICT (email) DO UPDATE SET name = 'HabitPulse Team';

-- Create Users with different roles for testing RBAC
-- Password: 'admin' for all users
INSERT INTO users (email, password_hash, name, bio, roles, created_at)
VALUES 
    -- Global Admin (Has access to everything)
    ('admin@wcollective.com', '$2a$10$4O7icw1c1WC2tvFgABkAueuLCDzITCQWNt8ijx/W80QECyOJQEq7S', 'Super Admin', 'Platform Administrator', ARRAY['admin'], NOW()),
    
    -- Organization Manager (Manages specific org users)
    ('manager@wcollective.com', '$2a$10$4O7icw1c1WC2tvFgABkAueuLCDzITCQWNt8ijx/W80QECyOJQEq7S', 'Wcollective Manager', 'Managing Wcollective', ARRAY['manager'], NOW()),
    
    -- Coach (Coach view)
    ('coach@nest.com', '$2a$10$4O7icw1c1WC2tvFgABkAueuLCDzITCQWNt8ijx/W80QECyOJQEq7S', 'Nest Coach', 'Wellness Coach', ARRAY['coach'], NOW()),
    
    -- Protocol Manager (Can manage protocols)
    ('protocol@wcollective.com', '$2a$10$4O7icw1c1WC2tvFgABkAueuLCDzITCQWNt8ijx/W80QECyOJQEq7S', 'Protocol Specialist', 'Managing Protocols', ARRAY['protocol_manager'], NOW()),
    
    -- Retreat Manager (Can manage retreats)
    ('retreat@wcollective.com', '$2a$10$4O7icw1c1WC2tvFgABkAueuLCDzITCQWNt8ijx/W80QECyOJQEq7S', 'Retreat Organizer', 'Managing Retreats', ARRAY['retreat_manager'], NOW()),
    
    -- Shop Manager (Can manage shop)
    ('shop@chrislo.com', '$2a$10$4O7icw1c1WC2tvFgABkAueuLCDzITCQWNt8ijx/W80QECyOJQEq7S', 'Shop Keeper', 'Managing Shop', ARRAY['shop_manager'], NOW()),
    
    -- Regular User (No admin access)
    ('user@wcollective.com', '$2a$10$4O7icw1c1WC2tvFgABkAueuLCDzITCQWNt8ijx/W80QECyOJQEq7S', 'Regular User', 'Just a user', ARRAY['user'], NOW())

ON CONFLICT (email) DO UPDATE SET 
    roles = EXCLUDED.roles,
    name = EXCLUDED.name;
