-- ============================================================================
-- E2E Test Seed Data
-- This file contains predictable test data for Playwright E2E tests
-- Run before tests: psql $DATABASE_URL -f seed-e2e-tests.sql
-- ============================================================================

-- Ensure protocols table schema matches codebase expectations
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS icon VARCHAR(50) DEFAULT 'checklist';
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'draft';

-- Fix sequences after manual ID insertions
ALTER SEQUENCE protocols_id_seq RESTART WITH 10000;

-- ============================================================================
-- CLEANUP: Remove existing test data
-- ============================================================================
DELETE FROM challenge_task_logs WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@e2etest.com');
DELETE FROM challenge_participants WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@e2etest.com');
DELETE FROM challenge_logs WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@e2etest.com');
DELETE FROM activity_feed WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@e2etest.com');
DELETE FROM user_follows WHERE follower_id IN (SELECT id FROM users WHERE email LIKE '%@e2etest.com') OR following_id IN (SELECT id FROM users WHERE email LIKE '%@e2etest.com');
DELETE FROM habit_logs WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@e2etest.com');
DELETE FROM tasks WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@e2etest.com');
DELETE FROM habits WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@e2etest.com');
DELETE FROM organization_members WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@e2etest.com');
DELETE FROM users WHERE email LIKE '%@e2etest.com';

-- Delete test organization
DELETE FROM organizations WHERE name = 'E2E Test Organization';

-- Delete test challenges
DELETE FROM challenge_tasks WHERE challenge_id IN (SELECT id FROM challenges WHERE title LIKE 'E2E Test%');
DELETE FROM challenges WHERE title LIKE 'E2E Test%';

-- ============================================================================
-- TEST USERS
-- Password for all users: "Test123!" (bcrypt hash below)
-- ============================================================================
-- Password hash for "Test123!" generated with bcrypt rounds=10
-- $2a$10$rQnM1TkL.N8xJKt7GQJH3.YH6QhK1Y8KxQZvL8VWqJOqY5FJZkZ.y

INSERT INTO users (id, email, password_hash, name, bio, current_streak, roles, created_at)
VALUES 
    -- Primary test user for most tests
    ('e2e00001-0000-0000-0000-000000000001', 'testuser@e2etest.com', '$2a$10$LC1zo.Bs58DviNEbPuYYYeLDsJ9ZV9wKlnFDNHvcjp7CQPh5qKSoG', 'E2E Test User', 'Primary test user for E2E tests', 7, ARRAY['user'], NOW() - INTERVAL '30 days'),
    
    -- Admin user for admin panel tests
    ('e2e00001-0000-0000-0000-000000000002', 'admin@e2etest.com', '$2a$10$LC1zo.Bs58DviNEbPuYYYeLDsJ9ZV9wKlnFDNHvcjp7CQPh5qKSoG', 'E2E Admin User', 'Admin user for E2E tests', 14, ARRAY['admin', 'super_admin'], NOW() - INTERVAL '60 days'),
    
    -- Manager user for organization tests
    ('e2e00001-0000-0000-0000-000000000003', 'manager@e2etest.com', '$2a$10$LC1zo.Bs58DviNEbPuYYYeLDsJ9ZV9wKlnFDNHvcjp7CQPh5qKSoG', 'E2E Manager User', 'Manager user for E2E tests', 5, ARRAY['manager'], NOW() - INTERVAL '45 days'),
    
    -- Secondary user for social tests (following, leaderboard)
    ('e2e00001-0000-0000-0000-000000000004', 'friend1@e2etest.com', '$2a$10$LC1zo.Bs58DviNEbPuYYYeLDsJ9ZV9wKlnFDNHvcjp7CQPh5qKSoG', 'Jane Smith', 'First friend for social tests', 21, ARRAY['user'], NOW() - INTERVAL '90 days'),
    
    ('e2e00001-0000-0000-0000-000000000005', 'friend2@e2etest.com', '$2a$10$LC1zo.Bs58DviNEbPuYYYeLDsJ9ZV9wKlnFDNHvcjp7CQPh5qKSoG', 'Bob Johnson', 'Second friend for social tests', 10, ARRAY['user'], NOW() - INTERVAL '60 days'),
    
    ('e2e00001-0000-0000-0000-000000000006', 'friend3@e2etest.com', '$2a$10$LC1zo.Bs58DviNEbPuYYYeLDsJ9ZV9wKlnFDNHvcjp7CQPh5qKSoG', 'Alice Williams', 'Third friend for social tests', 15, ARRAY['user'], NOW() - INTERVAL '45 days'),
    
    -- New user (no data) for onboarding tests
    ('e2e00001-0000-0000-0000-000000000007', 'newuser@e2etest.com', '$2a$10$LC1zo.Bs58DviNEbPuYYYeLDsJ9ZV9wKlnFDNHvcjp7CQPh5qKSoG', 'New User', 'Fresh user for onboarding tests', 0, ARRAY['user'], NOW())
ON CONFLICT (id) DO UPDATE SET 
    email = EXCLUDED.email,
    password_hash = EXCLUDED.password_hash,
    name = EXCLUDED.name,
    bio = EXCLUDED.bio,
    current_streak = EXCLUDED.current_streak,
    roles = EXCLUDED.roles;

-- ============================================================================
-- TEST ORGANIZATION
-- ============================================================================
INSERT INTO organizations (id, name, created_at)
VALUES ('e2e00002-0000-0000-0000-000000000001', 'E2E Test Organization', NOW() - INTERVAL '90 days')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Link manager to organization
INSERT INTO organization_members (organization_id, user_id, role, status)
VALUES ('e2e00002-0000-0000-0000-000000000001', 'e2e00001-0000-0000-0000-000000000003', 'admin', 'active')
ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'admin';

-- Link test user to organization as member
INSERT INTO organization_members (organization_id, user_id, role, status)
VALUES ('e2e00002-0000-0000-0000-000000000001', 'e2e00001-0000-0000-0000-000000000001', 'member', 'active')
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- ============================================================================
-- TEST HABITS
-- ============================================================================
INSERT INTO habits (id, user_id, name, description, frequency, target_count, category, is_active, created_at)
VALUES
    ('e2e00003-0000-0000-0000-000000000001', 'e2e00001-0000-0000-0000-000000000001', 'Drink Water', 'Stay hydrated by drinking 8 glasses of water', 'daily', 8, 'Health', true, NOW() - INTERVAL '30 days'),
    ('e2e00003-0000-0000-0000-000000000002', 'e2e00001-0000-0000-0000-000000000001', 'Morning Run', 'Run 5km every morning', 'daily', 1, 'Fitness', true, NOW() - INTERVAL '25 days'),
    ('e2e00003-0000-0000-0000-000000000003', 'e2e00001-0000-0000-0000-000000000001', 'Read Book', 'Read for 30 minutes', 'daily', 30, 'Learning', true, NOW() - INTERVAL '20 days'),
    ('e2e00003-0000-0000-0000-000000000004', 'e2e00001-0000-0000-0000-000000000001', 'Meditation', 'Practice mindfulness meditation', 'daily', 10, 'Wellness', true, NOW() - INTERVAL '15 days'),
    ('e2e00003-0000-0000-0000-000000000005', 'e2e00001-0000-0000-0000-000000000001', 'Inactive Habit', 'This habit is inactive', 'daily', 1, 'General', false, NOW() - INTERVAL '60 days')
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active;

-- ============================================================================
-- TEST TASKS (for today)
-- ============================================================================
INSERT INTO tasks (id, user_id, habit_id, title, description, status, type, goal, current_value, unit, icon, priority, due_date, created_at)
VALUES
    -- Pending tasks
    ('e2e00004-0000-0000-0000-000000000001', 'e2e00001-0000-0000-0000-000000000001', 'e2e00003-0000-0000-0000-000000000001', 'Drink Water', 'Drink 8 glasses of water today', 'pending', 'counter', 8, 3, 'glasses', 'local_drink', 'high', CURRENT_DATE + INTERVAL '1 day', NOW()),
    ('e2e00004-0000-0000-0000-000000000002', 'e2e00001-0000-0000-0000-000000000001', 'e2e00003-0000-0000-0000-000000000002', 'Morning Run', 'Complete your morning 5km run', 'pending', 'check', 1, 0, 'run', 'directions_run', 'high', CURRENT_DATE + INTERVAL '1 day', NOW()),
    ('e2e00004-0000-0000-0000-000000000003', 'e2e00001-0000-0000-0000-000000000001', 'e2e00003-0000-0000-0000-000000000003', 'Read Book', 'Read for 30 minutes', 'pending', 'counter', 30, 15, 'minutes', 'menu_book', 'medium', CURRENT_DATE + INTERVAL '1 day', NOW()),
    
    -- Completed task
    ('e2e00004-0000-0000-0000-000000000004', 'e2e00001-0000-0000-0000-000000000001', 'e2e00003-0000-0000-0000-000000000004', 'Meditation', 'Complete your 10 minute meditation', 'completed', 'check', 1, 1, 'session', 'self_improvement', 'medium', CURRENT_DATE, NOW() - INTERVAL '2 hours'),
    
    -- Overdue task
    ('e2e00004-0000-0000-0000-000000000005', 'e2e00001-0000-0000-0000-000000000001', NULL, 'Overdue Task', 'This task is overdue', 'pending', 'check', 1, 0, 'task', 'warning', 'low', CURRENT_DATE - INTERVAL '2 days', NOW() - INTERVAL '3 days')
ON CONFLICT (id) DO UPDATE SET 
    title = EXCLUDED.title,
    status = EXCLUDED.status,
    current_value = EXCLUDED.current_value,
    due_date = EXCLUDED.due_date;

-- ============================================================================
-- TEST CHALLENGES
-- ============================================================================
INSERT INTO challenges (id, title, description, type, status, icon, is_public, start_date, end_date, target_days, created_by, rewards)
VALUES
    -- Active challenge (user is participating)
    (9001, 'E2E Test Morning Yoga Challenge', 'Practice yoga every morning for 21 days', 'group', 'active', 'self_improvement', true, NOW() - INTERVAL '7 days', NOW() + INTERVAL '14 days', 21, 'e2e00001-0000-0000-0000-000000000002', '{"xp": 500, "badge": "Yoga Master"}'),
    
    -- Active challenge (user not participating)
    (9002, 'E2E Test 30 Day Fitness', 'Complete daily workouts for 30 days', 'competitive', 'active', 'fitness_center', true, NOW() - INTERVAL '5 days', NOW() + INTERVAL '25 days', 30, 'e2e00001-0000-0000-0000-000000000002', '{"xp": 1000, "badge": "Fitness Champion"}'),
    
    -- Active private challenge
    (9003, 'E2E Test No Sugar Week', 'Avoid added sugars for a week', 'individual', 'active', 'no_food', true, NOW() - INTERVAL '3 days', NOW() + INTERVAL '4 days', 7, 'e2e00001-0000-0000-0000-000000000002', '{"xp": 300, "badge": "Sugar Free"}'),
    
    -- Upcoming challenge
    (9004, 'E2E Test Hydration Hero', 'Drink 8 glasses of water daily', 'group', 'upcoming', 'water_drop', true, NOW() + INTERVAL '3 days', NOW() + INTERVAL '24 days', 21, 'e2e00001-0000-0000-0000-000000000002', '{"xp": 400, "badge": "Hydration Master"}'),
    
    -- Completed challenge
    (9005, 'E2E Test Reading Challenge', 'Read for 20 minutes daily', 'individual', 'completed', 'menu_book', true, NOW() - INTERVAL '30 days', NOW() - INTERVAL '1 day', 30, 'e2e00001-0000-0000-0000-000000000002', '{"xp": 600, "badge": "Bookworm"}')
ON CONFLICT (id) DO UPDATE SET 
    title = EXCLUDED.title,
    status = EXCLUDED.status,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date;

-- ============================================================================
-- CHALLENGE TASKS
-- ============================================================================
INSERT INTO challenge_tasks (id, challenge_id, title, description, type, target_value, unit)
VALUES
    -- Morning Yoga Challenge tasks
    (9001, 9001, 'Morning Yoga Session', 'Complete your yoga routine', 'boolean', 1, 'session'),
    (9002, 9001, 'Meditation', '5 minutes of meditation after yoga', 'boolean', 1, 'session'),
    
    -- 30 Day Fitness tasks
    (9003, 9002, 'Main Workout', 'Complete today''s workout', 'boolean', 1, 'workout'),
    (9004, 9002, 'Stretching', '10 minutes of stretching', 'boolean', 1, 'session'),
    (9005, 9002, 'Step Count', 'Walk at least 5000 steps', 'numeric', 5000, 'steps'),
    
    -- No Sugar Week tasks
    (9006, 9003, 'No Added Sugar', 'Avoid all added sugars today', 'boolean', 1, 'day'),
    
    -- Hydration Hero tasks
    (9007, 9004, 'Water Intake', 'Drink 8 glasses of water', 'numeric', 8, 'glasses'),
    
    -- Reading Challenge tasks
    (9008, 9005, 'Reading Time', 'Read for 20 minutes', 'numeric', 20, 'minutes')
ON CONFLICT (id) DO UPDATE SET 
    title = EXCLUDED.title,
    type = EXCLUDED.type,
    target_value = EXCLUDED.target_value;

-- ============================================================================
-- CHALLENGE PARTICIPANTS
-- ============================================================================
INSERT INTO challenge_participants (challenge_id, user_id, joined_at, progress)
VALUES
    -- Test user in Morning Yoga Challenge
    (9001, 'e2e00001-0000-0000-0000-000000000001', NOW() - INTERVAL '5 days', 5),
    -- Test user in No Sugar Week
    (9003, 'e2e00001-0000-0000-0000-000000000001', NOW() - INTERVAL '3 days', 3),
    -- Test user completed Reading Challenge
    (9005, 'e2e00001-0000-0000-0000-000000000001', NOW() - INTERVAL '30 days', 30),
    
    -- Friends in challenges for leaderboard
    (9001, 'e2e00001-0000-0000-0000-000000000004', NOW() - INTERVAL '7 days', 7),
    (9001, 'e2e00001-0000-0000-0000-000000000005', NOW() - INTERVAL '6 days', 4),
    (9001, 'e2e00001-0000-0000-0000-000000000006', NOW() - INTERVAL '5 days', 6),
    
    (9002, 'e2e00001-0000-0000-0000-000000000004', NOW() - INTERVAL '5 days', 5),
    (9002, 'e2e00001-0000-0000-0000-000000000005', NOW() - INTERVAL '4 days', 3)
ON CONFLICT (challenge_id, user_id) DO UPDATE SET 
    progress = EXCLUDED.progress;

-- ============================================================================
-- USER FOLLOWS (Social connections)
-- ============================================================================
INSERT INTO user_follows (follower_id, following_id, created_at)
VALUES
    -- Test user follows friends
    ('e2e00001-0000-0000-0000-000000000001', 'e2e00001-0000-0000-0000-000000000004', NOW() - INTERVAL '20 days'),
    ('e2e00001-0000-0000-0000-000000000001', 'e2e00001-0000-0000-0000-000000000005', NOW() - INTERVAL '15 days'),
    
    -- Friends follow test user back
    ('e2e00001-0000-0000-0000-000000000004', 'e2e00001-0000-0000-0000-000000000001', NOW() - INTERVAL '19 days'),
    ('e2e00001-0000-0000-0000-000000000005', 'e2e00001-0000-0000-0000-000000000001', NOW() - INTERVAL '14 days'),
    
    -- Friend6 follows test user (not mutual)
    ('e2e00001-0000-0000-0000-000000000006', 'e2e00001-0000-0000-0000-000000000001', NOW() - INTERVAL '10 days')
ON CONFLICT (follower_id, following_id) DO NOTHING;

-- ============================================================================
-- ACTIVITY FEED
-- ============================================================================
INSERT INTO activity_feed (user_id, activity_type, title, metadata, created_at)
VALUES
    ('e2e00001-0000-0000-0000-000000000004', 'challenge_joined', 'Jane Smith joined Morning Yoga Challenge', '{"challenge_id": 9001, "challenge_title": "E2E Test Morning Yoga Challenge"}', NOW() - INTERVAL '2 hours'),
    ('e2e00001-0000-0000-0000-000000000005', 'task_completed', 'Bob Johnson completed 5 tasks today', '{"tasks_count": 5}', NOW() - INTERVAL '4 hours'),
    ('e2e00001-0000-0000-0000-000000000006', 'streak_milestone', 'Alice Williams reached a 15-day streak!', '{"streak": 15}', NOW() - INTERVAL '6 hours'),
    ('e2e00001-0000-0000-0000-000000000004', 'badge_earned', 'Jane Smith earned the "Early Bird" badge', '{"badge": "Early Bird"}', NOW() - INTERVAL '1 day'),
    ('e2e00001-0000-0000-0000-000000000001', 'challenge_progress', 'E2E Test User completed day 5 of Morning Yoga Challenge', '{"challenge_id": 9001, "day": 5}', NOW() - INTERVAL '1 day')
;

-- ============================================================================
-- HABIT LOGS (for streak and history)
-- ============================================================================
INSERT INTO habit_logs (habit_id, user_id, completed_at, notes)
SELECT 
    'e2e00003-0000-0000-0000-000000000001', 
    'e2e00001-0000-0000-0000-000000000001', 
    CURRENT_DATE - (n || ' days')::interval,
    'Completed water goal'
FROM generate_series(1, 7) AS n
ON CONFLICT DO NOTHING;

INSERT INTO habit_logs (habit_id, user_id, completed_at, notes)
SELECT 
    'e2e00003-0000-0000-0000-000000000002', 
    'e2e00001-0000-0000-0000-000000000001', 
    CURRENT_DATE - (n || ' days')::interval,
    'Completed morning run'
FROM generate_series(1, 5) AS n
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ADVANCED USERS (for enterprise/admin tests)
-- ============================================================================
INSERT INTO users (id, email, password_hash, name, bio, current_streak, roles, created_at)
VALUES 
    -- Super Admin (full system access)
    ('e2e00001-0000-0000-0000-000000000010', 'superadmin@e2etest.com', '$2a$10$LC1zo.Bs58DviNEbPuYYYeLDsJ9ZV9wKlnFDNHvcjp7CQPh5qKSoG', 'Super Admin', 'System administrator', 30, ARRAY['user', 'admin', 'super_admin'], NOW() - INTERVAL '180 days'),
    
    -- Product Admin (manages product organization)
    ('e2e00001-0000-0000-0000-000000000011', 'productadmin@e2etest.com', '$2a$10$LC1zo.Bs58DviNEbPuYYYeLDsJ9ZV9wKlnFDNHvcjp7CQPh5qKSoG', 'Product Admin', 'Product administrator', 25, ARRAY['user', 'admin', 'protocol_manager'], NOW() - INTERVAL '120 days'),
    
    -- Company Owner
    ('e2e00001-0000-0000-0000-000000000012', 'companyowner@e2etest.com', '$2a$10$LC1zo.Bs58DviNEbPuYYYeLDsJ9ZV9wKlnFDNHvcjp7CQPh5qKSoG', 'Company Owner', 'Company organization owner', 20, ARRAY['user', 'admin'], NOW() - INTERVAL '100 days'),
    
    -- Company Admin
    ('e2e00001-0000-0000-0000-000000000013', 'companyadmin@e2etest.com', '$2a$10$LC1zo.Bs58DviNEbPuYYYeLDsJ9ZV9wKlnFDNHvcjp7CQPh5qKSoG', 'Company Admin', 'Company administrator', 18, ARRAY['user', 'manager'], NOW() - INTERVAL '90 days'),
    
    -- Anonymous user (for privacy tests)
    ('e2e00001-0000-0000-0000-000000000014', 'anonuser@e2etest.com', '$2a$10$LC1zo.Bs58DviNEbPuYYYeLDsJ9ZV9wKlnFDNHvcjp7CQPh5qKSoG', 'Anonymous User', 'Privacy test user - anonymous', 12, ARRAY['user'], NOW() - INTERVAL '60 days'),
    
    -- Hidden user (for privacy tests)
    ('e2e00001-0000-0000-0000-000000000015', 'hiddenuser@e2etest.com', '$2a$10$LC1zo.Bs58DviNEbPuYYYeLDsJ9ZV9wKlnFDNHvcjp7CQPh5qKSoG', 'Hidden User', 'Privacy test user - hidden', 8, ARRAY['user'], NOW() - INTERVAL '45 days')
ON CONFLICT (id) DO UPDATE SET 
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    bio = EXCLUDED.bio,
    current_streak = EXCLUDED.current_streak,
    roles = EXCLUDED.roles;

-- ============================================================================
-- ADVANCED ORGANIZATIONS (for enterprise tests)
-- ============================================================================
INSERT INTO organizations (id, name, created_at)
VALUES 
    -- Product organization
    ('e2e00002-0000-0000-0000-000000000002', 'E2E HabitPulse Product', NOW() - INTERVAL '180 days'),
    -- Company organization (parent)
    ('e2e00002-0000-0000-0000-000000000003', 'E2E Test Company Inc', NOW() - INTERVAL '150 days'),
    -- Second product organization
    ('e2e00002-0000-0000-0000-000000000004', 'E2E Wellness Pro', NOW() - INTERVAL '120 days')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- ============================================================================
-- ORGANIZATION MEMBERS (advanced)
-- ============================================================================
INSERT INTO organization_members (organization_id, user_id, role, status)
VALUES
    -- Product organization members
    ('e2e00002-0000-0000-0000-000000000002', 'e2e00001-0000-0000-0000-000000000011', 'admin', 'active'),
    ('e2e00002-0000-0000-0000-000000000002', 'e2e00001-0000-0000-0000-000000000001', 'member', 'active'),
    ('e2e00002-0000-0000-0000-000000000002', 'e2e00001-0000-0000-0000-000000000014', 'member', 'active'),
    
    -- Company organization members
    ('e2e00002-0000-0000-0000-000000000003', 'e2e00001-0000-0000-0000-000000000012', 'admin', 'active'),
    ('e2e00002-0000-0000-0000-000000000003', 'e2e00001-0000-0000-0000-000000000013', 'manager', 'active'),
    ('e2e00002-0000-0000-0000-000000000003', 'e2e00001-0000-0000-0000-000000000001', 'member', 'active'),
    
    -- Wellness Pro members
    ('e2e00002-0000-0000-0000-000000000004', 'e2e00001-0000-0000-0000-000000000011', 'admin', 'active'),
    ('e2e00002-0000-0000-0000-000000000004', 'e2e00001-0000-0000-0000-000000000015', 'member', 'active')
ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role;

-- ============================================================================
-- PROTOCOLS (Advanced challenges with organization context)
-- ============================================================================
-- Note: Using challenges table as protocols if that's how they're implemented
INSERT INTO challenges (id, title, description, type, status, icon, is_public, start_date, end_date, target_days, created_by, rewards, organization_id)
VALUES
    -- Draft protocol (Product org)
    (9010, 'E2E Draft Meditation Challenge', 'Build a daily meditation habit over 30 days', 'group', 'draft', 'self_improvement', false, NOW() + INTERVAL '7 days', NOW() + INTERVAL '37 days', 30, 'e2e00001-0000-0000-0000-000000000011', '{"xp": 500, "badge": "Meditation Master"}', 'e2e00002-0000-0000-0000-000000000002'),
    
    -- Active public protocol
    (9011, 'E2E Active Hydration Challenge', 'Drink 8 glasses of water daily', 'competitive', 'active', 'local_drink', true, NOW() - INTERVAL '7 days', NOW() + INTERVAL '14 days', 21, 'e2e00001-0000-0000-0000-000000000011', '{"xp": 300, "badge": "Hydration Hero"}', NULL),
    
    -- Archived protocol
    (9012, 'E2E Archived Fitness Challenge', 'Complete daily fitness tasks', 'group', 'completed', 'fitness_center', true, NOW() - INTERVAL '45 days', NOW() - INTERVAL '15 days', 30, 'e2e00001-0000-0000-0000-000000000011', '{"xp": 600, "badge": "Fitness Champion 2025"}', 'e2e00002-0000-0000-0000-000000000002'),
    
    -- Private company protocol
    (9013, 'E2E Company Wellness Program', 'Internal wellness tracking for employees', 'group', 'active', 'corporate_fare', false, NOW() - INTERVAL '30 days', NOW() + INTERVAL '60 days', 90, 'e2e00001-0000-0000-0000-000000000012', '{"xp": 1000}', 'e2e00002-0000-0000-0000-000000000003')
ON CONFLICT (id) DO UPDATE SET 
    title = EXCLUDED.title,
    status = EXCLUDED.status,
    is_public = EXCLUDED.is_public;


-- Protocol tasks
INSERT INTO challenge_tasks (id, challenge_id, title, description, type, target_value, unit)
VALUES
    (9010, 9010, 'Morning Meditation', 'Complete your morning meditation', 'boolean', 1, 'session'),
    (9011, 9010, 'Minutes Meditated', '15 minutes of meditation', 'numeric', 15, 'minutes'),
    (9012, 9010, 'Reflection Notes', 'Write down your thoughts', 'text', 1, 'entry'),
    (9013, 9011, 'Glasses of Water', 'Track water consumption', 'numeric', 8, 'glasses'),
    (9014, 9012, 'Workout Completed', 'Complete daily workout', 'boolean', 1, 'workout'),
    (9015, 9012, 'Minutes Exercised', '30 minutes of exercise', 'numeric', 30, 'minutes'),
    (9016, 9013, 'Daily Check-in', 'Complete your daily check-in', 'boolean', 1, 'checkin'),
    (9017, 9013, 'Steps Walked', 'Walk at least 10000 steps', 'numeric', 10000, 'steps')
ON CONFLICT (id) DO UPDATE SET 
    title = EXCLUDED.title,
    type = EXCLUDED.type,
    target_value = EXCLUDED.target_value;

-- Protocol participants
INSERT INTO challenge_participants (challenge_id, user_id, joined_at, progress)
VALUES
    -- Active Hydration Challenge participants
    (9011, 'e2e00001-0000-0000-0000-000000000001', NOW() - INTERVAL '5 days', 40),
    (9011, 'e2e00001-0000-0000-0000-000000000004', NOW() - INTERVAL '7 days', 60),
    (9011, 'e2e00001-0000-0000-0000-000000000005', NOW() - INTERVAL '6 days', 35),
    (9011, 'e2e00001-0000-0000-0000-000000000014', NOW() - INTERVAL '5 days', 45),
    
    -- Company Wellness Program participants
    (9013, 'e2e00001-0000-0000-0000-000000000012', NOW() - INTERVAL '30 days', 100),
    (9013, 'e2e00001-0000-0000-0000-000000000013', NOW() - INTERVAL '28 days', 85),
    (9013, 'e2e00001-0000-0000-0000-000000000001', NOW() - INTERVAL '25 days', 70),
    
    -- Archived challenge completed participants
    (9012, 'e2e00001-0000-0000-0000-000000000001', NOW() - INTERVAL '45 days', 100),
    (9012, 'e2e00001-0000-0000-0000-000000000004', NOW() - INTERVAL '45 days', 95)
ON CONFLICT (challenge_id, user_id) DO UPDATE SET 
    progress = EXCLUDED.progress;

-- ============================================================================
-- INVITATIONS (for invitation flow tests)
-- Note: Only add if invitations table exists
-- ============================================================================
-- This will only work if you have an invitations table
-- INSERT INTO invitations (id, token, organization_id, role, email, expires_at, max_uses, current_uses, status, created_by)
-- VALUES ...

-- ============================================================================
-- VERIFICATION QUERIES (for debugging)
-- ============================================================================
-- SELECT 'Users' as table_name, COUNT(*) as count FROM users WHERE email LIKE '%@e2etest.com'
-- UNION ALL SELECT 'Tasks', COUNT(*) FROM tasks WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@e2etest.com')
-- UNION ALL SELECT 'Habits', COUNT(*) FROM habits WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@e2etest.com')
-- UNION ALL SELECT 'Challenges', COUNT(*) FROM challenges WHERE title LIKE 'E2E Test%' OR title LIKE 'E2E %'
-- UNION ALL SELECT 'Organizations', COUNT(*) FROM organizations WHERE name LIKE 'E2E%'
-- UNION ALL SELECT 'Challenge Participants', COUNT(*) FROM challenge_participants WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@e2etest.com');
