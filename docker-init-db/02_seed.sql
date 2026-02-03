-- ============================================================================
-- HabitPulse Seed Data for E2E Tests
-- This file is automatically run when the PostgreSQL container starts
-- ============================================================================

-- ============================================================================
-- TEST USERS
-- Password for all users: "Test123!" (bcrypt hash)
-- ============================================================================

INSERT INTO users (id, email, password_hash, name, bio, current_streak, total_points, roles, created_at)
VALUES 
    -- Primary test user for most tests
    ('e2e00001-0000-0000-0000-000000000001', 'testuser@e2etest.com', '$2a$10$oTpBq6ogtM3AU3fLHS3nS.qOEpVCIwmdlCye2TxzAijToDUtGyfsK', 'E2E Test User', 'Primary test user for E2E tests', 7, 250, ARRAY['user'], NOW() - INTERVAL '30 days'),
    
    -- Admin user for admin panel tests
    ('e2e00001-0000-0000-0000-000000000002', 'admin@e2etest.com', '$2a$10$oTpBq6ogtM3AU3fLHS3nS.qOEpVCIwmdlCye2TxzAijToDUtGyfsK', 'E2E Admin User', 'Admin user for E2E tests', 14, 500, ARRAY['admin'], NOW() - INTERVAL '60 days'),
    
    -- Manager user for organization tests
    ('e2e00001-0000-0000-0000-000000000003', 'manager@e2etest.com', '$2a$10$oTpBq6ogtM3AU3fLHS3nS.qOEpVCIwmdlCye2TxzAijToDUtGyfsK', 'E2E Manager User', 'Manager user for E2E tests', 5, 350, ARRAY['manager'], NOW() - INTERVAL '45 days'),
    
    -- Secondary user for social tests (following, leaderboard)
    ('e2e00001-0000-0000-0000-000000000004', 'friend1@e2etest.com', '$2a$10$oTpBq6ogtM3AU3fLHS3nS.qOEpVCIwmdlCye2TxzAijToDUtGyfsK', 'Jane Smith', 'First friend for social tests', 21, 800, ARRAY['user'], NOW() - INTERVAL '90 days'),
    
    ('e2e00001-0000-0000-0000-000000000005', 'friend2@e2etest.com', '$2a$10$oTpBq6ogtM3AU3fLHS3nS.qOEpVCIwmdlCye2TxzAijToDUtGyfsK', 'Bob Johnson', 'Second friend for social tests', 10, 450, ARRAY['user'], NOW() - INTERVAL '60 days'),
    
    ('e2e00001-0000-0000-0000-000000000006', 'friend3@e2etest.com', '$2a$10$oTpBq6ogtM3AU3fLHS3nS.qOEpVCIwmdlCye2TxzAijToDUtGyfsK', 'Alice Williams', 'Third friend for social tests', 15, 600, ARRAY['user'], NOW() - INTERVAL '45 days'),
    
    -- New user (no data) for onboarding tests
    ('e2e00001-0000-0000-0000-000000000007', 'newuser@e2etest.com', '$2a$10$oTpBq6ogtM3AU3fLHS3nS.qOEpVCIwmdlCye2TxzAijToDUtGyfsK', 'New User', 'Fresh user for onboarding tests', 0, 0, ARRAY['user'], NOW()),
    
    -- Super Admin (full system access)
    ('e2e00001-0000-0000-0000-000000000010', 'superadmin@e2etest.com', '$2a$10$oTpBq6ogtM3AU3fLHS3nS.qOEpVCIwmdlCye2TxzAijToDUtGyfsK', 'Super Admin', 'System administrator', 30, 1500, ARRAY['user', 'admin', 'super_admin'], NOW() - INTERVAL '180 days'),
    
    -- Product Admin (manages product organization)
    ('e2e00001-0000-0000-0000-000000000011', 'productadmin@e2etest.com', '$2a$10$oTpBq6ogtM3AU3fLHS3nS.qOEpVCIwmdlCye2TxzAijToDUtGyfsK', 'Product Admin', 'Product administrator', 25, 1200, ARRAY['user', 'admin', 'protocol_manager'], NOW() - INTERVAL '120 days'),
    
    -- Company Owner
    ('e2e00001-0000-0000-0000-000000000012', 'companyowner@e2etest.com', '$2a$10$oTpBq6ogtM3AU3fLHS3nS.qOEpVCIwmdlCye2TxzAijToDUtGyfsK', 'Company Owner', 'Company organization owner', 20, 900, ARRAY['user', 'admin'], NOW() - INTERVAL '100 days'),
    
    -- Company Admin
    ('e2e00001-0000-0000-0000-000000000013', 'companyadmin@e2etest.com', '$2a$10$oTpBq6ogtM3AU3fLHS3nS.qOEpVCIwmdlCye2TxzAijToDUtGyfsK', 'Company Admin', 'Company administrator', 18, 750, ARRAY['user', 'manager'], NOW() - INTERVAL '90 days'),
    
    -- Anonymous user (for privacy tests)
    ('e2e00001-0000-0000-0000-000000000014', 'anonuser@e2etest.com', '$2a$10$oTpBq6ogtM3AU3fLHS3nS.qOEpVCIwmdlCye2TxzAijToDUtGyfsK', 'Anonymous User', 'Privacy test user - anonymous', 12, 400, ARRAY['user'], NOW() - INTERVAL '60 days'),
    
    -- Hidden user (for privacy tests)
    ('e2e00001-0000-0000-0000-000000000015', 'hiddenuser@e2etest.com', '$2a$10$oTpBq6ogtM3AU3fLHS3nS.qOEpVCIwmdlCye2TxzAijToDUtGyfsK', 'Hidden User', 'Privacy test user - hidden', 8, 300, ARRAY['user'], NOW() - INTERVAL '45 days'),
    
    -- HabitPulse Team user
    ('e2e00001-0000-0000-0000-000000000099', 'team@habitpulse.com', '$2a$10$oTpBq6ogtM3AU3fLHS3nS.qOEpVCIwmdlCye2TxzAijToDUtGyfsK', 'HabitPulse Team', 'Official challenges from the HabitPulse team', 0, 0, ARRAY['admin', 'system'], NOW() - INTERVAL '365 days')
ON CONFLICT (id) DO UPDATE SET 
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    bio = EXCLUDED.bio,
    current_streak = EXCLUDED.current_streak,
    total_points = EXCLUDED.total_points,
    roles = EXCLUDED.roles;

-- ============================================================================
-- ORGANIZATIONS
-- ============================================================================
INSERT INTO organizations (id, name, description, type, created_at)
VALUES 
    -- Basic test organization
    ('e2e00002-0000-0000-0000-000000000001', 'E2E Test Organization', 'Test organization for E2E tests', 'company', NOW() - INTERVAL '90 days'),
    -- Product organization
    ('e2e00002-0000-0000-0000-000000000002', 'E2E HabitPulse Product', 'Product organization for E2E tests', 'product', NOW() - INTERVAL '180 days'),
    -- Company organization (parent)
    ('e2e00002-0000-0000-0000-000000000003', 'E2E Test Company Inc', 'Company organization for E2E tests', 'company', NOW() - INTERVAL '150 days'),
    -- Second product organization
    ('e2e00002-0000-0000-0000-000000000004', 'E2E Wellness Pro', 'Wellness product for E2E tests', 'product', NOW() - INTERVAL '120 days')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- ============================================================================
-- ORGANIZATION MEMBERS
-- ============================================================================
INSERT INTO organization_members (organization_id, user_id, role, status)
VALUES
    -- Test Organization members
    ('e2e00002-0000-0000-0000-000000000001', 'e2e00001-0000-0000-0000-000000000003', 'admin', 'active'),
    ('e2e00002-0000-0000-0000-000000000001', 'e2e00001-0000-0000-0000-000000000001', 'member', 'active'),
    
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
-- ORGANIZATION INVITATIONS
-- ============================================================================
INSERT INTO organization_invitations (id, organization_id, token, created_by, email, role, expires_at, max_uses, current_uses, status)
VALUES
    -- Active invitation for E2E Test Organization (unlimited uses)
    ('e2e00003-0000-0000-0000-000000000001', 'e2e00002-0000-0000-0000-000000000001', 'e2e-test-invite-token-001', 'e2e00001-0000-0000-0000-000000000003', NULL, 'member', NOW() + INTERVAL '30 days', 100, 0, 'active'),
    
    -- Active invitation with specific email
    ('e2e00003-0000-0000-0000-000000000002', 'e2e00002-0000-0000-0000-000000000001', 'e2e-test-invite-token-002', 'e2e00001-0000-0000-0000-000000000003', 'invited@e2etest.com', 'member', NOW() + INTERVAL '7 days', 1, 0, 'active'),
    
    -- Expired invitation
    ('e2e00003-0000-0000-0000-000000000003', 'e2e00002-0000-0000-0000-000000000001', 'e2e-test-invite-token-003', 'e2e00001-0000-0000-0000-000000000003', NULL, 'member', NOW() - INTERVAL '1 day', 1, 0, 'expired'),
    
    -- Product organization invitation
    ('e2e00003-0000-0000-0000-000000000004', 'e2e00002-0000-0000-0000-000000000002', 'e2e-product-invite-token', 'e2e00001-0000-0000-0000-000000000011', NULL, 'member', NOW() + INTERVAL '14 days', 50, 5, 'active'),
    
    -- Company organization admin invite
    ('e2e00003-0000-0000-0000-000000000005', 'e2e00002-0000-0000-0000-000000000003', 'e2e-company-admin-invite', 'e2e00001-0000-0000-0000-000000000012', NULL, 'admin', NOW() + INTERVAL '7 days', 3, 0, 'active')
ON CONFLICT (id) DO NOTHING;

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
    (9005, 'E2E Test Reading Challenge', 'Read for 20 minutes daily', 'individual', 'completed', 'menu_book', true, NOW() - INTERVAL '30 days', NOW() - INTERVAL '1 day', 30, 'e2e00001-0000-0000-0000-000000000002', '{"xp": 600, "badge": "Bookworm"}'),
    
    -- Public hydration challenge
    (9006, 'Hydration Hero', 'Drink 8 glasses of water daily for better health and energy', 'individual', 'active', 'water_drop', true, NOW() - INTERVAL '7 days', NOW() + INTERVAL '14 days', 21, 'e2e00001-0000-0000-0000-000000000099', '{"xp": 500, "badge": "Hydration Master"}'),
    
    -- Public meditation challenge
    (9007, 'Morning Meditation', 'Start each day with 10 minutes of mindfulness meditation', 'group', 'active', 'self_improvement', true, NOW() - INTERVAL '3 days', NOW() + INTERVAL '27 days', 30, 'e2e00001-0000-0000-0000-000000000099', '{"xp": 600, "badge": "Zen Master"}'),
    
    -- Public fitness challenge
    (9008, '30 Day Fitness', 'Complete a daily workout routine for 30 days straight', 'competitive', 'active', 'fitness_center', true, NOW() - INTERVAL '5 days', NOW() + INTERVAL '25 days', 30, 'e2e00001-0000-0000-0000-000000000099', '{"xp": 1000, "badge": "Fitness Freak"}'),
    
    -- Draft protocol (Product org)
    (9010, 'E2E Draft Meditation Challenge', 'Build a daily meditation habit over 30 days', 'group', 'draft', 'self_improvement', false, NOW() + INTERVAL '7 days', NOW() + INTERVAL '37 days', 30, 'e2e00001-0000-0000-0000-000000000011', '{"xp": 500, "badge": "Meditation Master"}'),
    
    -- Active public protocol
    (9011, 'E2E Active Hydration Challenge', 'Drink 8 glasses of water daily', 'competitive', 'active', 'local_drink', true, NOW() - INTERVAL '7 days', NOW() + INTERVAL '14 days', 21, 'e2e00001-0000-0000-0000-000000000011', '{"xp": 300, "badge": "Hydration Hero"}'),
    
    -- Archived protocol
    (9012, 'E2E Archived Fitness Challenge', 'Complete daily fitness tasks', 'group', 'completed', 'fitness_center', true, NOW() - INTERVAL '45 days', NOW() - INTERVAL '15 days', 30, 'e2e00001-0000-0000-0000-000000000011', '{"xp": 600, "badge": "Fitness Champion 2025"}'),
    
    -- Private company protocol
    (9013, 'E2E Company Wellness Program', 'Internal wellness tracking for employees', 'group', 'active', 'corporate_fare', false, NOW() - INTERVAL '30 days', NOW() + INTERVAL '60 days', 90, 'e2e00001-0000-0000-0000-000000000012', '{"xp": 1000}')
ON CONFLICT (id) DO UPDATE SET 
    title = EXCLUDED.title,
    status = EXCLUDED.status,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date;

-- Update organization_id for company-specific challenges
UPDATE challenges SET organization_id = 'e2e00002-0000-0000-0000-000000000002' WHERE id = 9010;
UPDATE challenges SET organization_id = 'e2e00002-0000-0000-0000-000000000002' WHERE id = 9012;
UPDATE challenges SET organization_id = 'e2e00002-0000-0000-0000-000000000003' WHERE id = 9013;

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
    (9008, 9005, 'Reading Time', 'Read for 20 minutes', 'numeric', 20, 'minutes'),
    
    -- Protocol tasks
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

-- ============================================================================
-- CHALLENGE PARTICIPANTS
-- ============================================================================
INSERT INTO challenge_participants (challenge_id, user_id, joined_at, progress, status)
VALUES
    -- Test user in Morning Yoga Challenge
    (9001, 'e2e00001-0000-0000-0000-000000000001', NOW() - INTERVAL '5 days', 5, 'active'),
    -- Test user in No Sugar Week
    (9003, 'e2e00001-0000-0000-0000-000000000001', NOW() - INTERVAL '3 days', 3, 'active'),
    -- Test user completed Reading Challenge
    (9005, 'e2e00001-0000-0000-0000-000000000001', NOW() - INTERVAL '30 days', 30, 'completed'),
    
    -- Friends in challenges for leaderboard
    (9001, 'e2e00001-0000-0000-0000-000000000004', NOW() - INTERVAL '7 days', 7, 'active'),
    (9001, 'e2e00001-0000-0000-0000-000000000005', NOW() - INTERVAL '6 days', 4, 'active'),
    (9001, 'e2e00001-0000-0000-0000-000000000006', NOW() - INTERVAL '5 days', 6, 'active'),
    
    (9002, 'e2e00001-0000-0000-0000-000000000004', NOW() - INTERVAL '5 days', 5, 'active'),
    (9002, 'e2e00001-0000-0000-0000-000000000005', NOW() - INTERVAL '4 days', 3, 'active'),
    
    -- Active Hydration Challenge participants
    (9011, 'e2e00001-0000-0000-0000-000000000001', NOW() - INTERVAL '5 days', 40, 'active'),
    (9011, 'e2e00001-0000-0000-0000-000000000004', NOW() - INTERVAL '7 days', 60, 'active'),
    (9011, 'e2e00001-0000-0000-0000-000000000005', NOW() - INTERVAL '6 days', 35, 'active'),
    (9011, 'e2e00001-0000-0000-0000-000000000014', NOW() - INTERVAL '5 days', 45, 'active'),
    
    -- Company Wellness Program participants
    (9013, 'e2e00001-0000-0000-0000-000000000012', NOW() - INTERVAL '30 days', 100, 'active'),
    (9013, 'e2e00001-0000-0000-0000-000000000013', NOW() - INTERVAL '28 days', 85, 'active'),
    (9013, 'e2e00001-0000-0000-0000-000000000001', NOW() - INTERVAL '25 days', 70, 'active'),
    
    -- Archived challenge completed participants
    (9012, 'e2e00001-0000-0000-0000-000000000001', NOW() - INTERVAL '45 days', 100, 'completed'),
    (9012, 'e2e00001-0000-0000-0000-000000000004', NOW() - INTERVAL '45 days', 95, 'completed')
ON CONFLICT (challenge_id, user_id) DO UPDATE SET 
    progress = EXCLUDED.progress,
    status = EXCLUDED.status;

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
INSERT INTO activity_feed (id, user_id, type, content, metadata, created_at)
VALUES
    (1, 'e2e00001-0000-0000-0000-000000000004', 'challenge_joined', 'Jane Smith joined Morning Yoga Challenge', '{"challenge_id": 9001, "challenge_title": "E2E Test Morning Yoga Challenge"}', NOW() - INTERVAL '2 hours'),
    (2, 'e2e00001-0000-0000-0000-000000000005', 'task_completed', 'Bob Johnson completed 5 tasks today', '{"tasks_count": 5}', NOW() - INTERVAL '4 hours'),
    (3, 'e2e00001-0000-0000-0000-000000000006', 'streak_milestone', 'Alice Williams reached a 15-day streak!', '{"streak": 15}', NOW() - INTERVAL '6 hours'),
    (4, 'e2e00001-0000-0000-0000-000000000004', 'badge_earned', 'Jane Smith earned the "Early Bird" badge', '{"badge": "Early Bird"}', NOW() - INTERVAL '1 day'),
    (5, 'e2e00001-0000-0000-0000-000000000001', 'challenge_progress', 'E2E Test User completed day 5 of Morning Yoga Challenge', '{"challenge_id": 9001, "day": 5}', NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO UPDATE SET 
    content = EXCLUDED.content,
    metadata = EXCLUDED.metadata;

-- ============================================================================
-- PROTOCOLS
-- ============================================================================
INSERT INTO protocols (id, name, description, creator_id, is_public, status, icon, organization_id)
VALUES
    (1, 'Morning Wellness Routine', 'A comprehensive morning wellness protocol', 'e2e00001-0000-0000-0000-000000000011', true, 'active', 'wb_sunny', NULL),
    (2, 'Hydration Tracker', 'Track your daily water intake', 'e2e00001-0000-0000-0000-000000000011', true, 'active', 'local_drink', NULL),
    (3, 'Company Fitness Program', 'Internal fitness program for employees', 'e2e00001-0000-0000-0000-000000000012', false, 'active', 'fitness_center', 'e2e00002-0000-0000-0000-000000000003'),
    (4, 'Draft Protocol', 'A protocol still in draft', 'e2e00001-0000-0000-0000-000000000011', false, 'draft', 'edit', 'e2e00002-0000-0000-0000-000000000002'),
    (5, 'Archived Protocol', 'An old archived protocol', 'e2e00001-0000-0000-0000-000000000011', true, 'archived', 'archive', NULL)
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    status = EXCLUDED.status;

-- ============================================================================
-- PROTOCOL ELEMENTS
-- ============================================================================
INSERT INTO protocol_elements (id, protocol_id, title, description, type, unit, goal, frequency, points, display_order, is_required)
VALUES
    (1, 1, 'Morning Meditation', 'Start with 10 minutes of meditation', 'check', 'session', 1, 'daily', 20, 1, true),
    (2, 1, 'Stretching Routine', 'Complete morning stretches', 'check', 'session', 1, 'daily', 15, 2, true),
    (3, 1, 'Gratitude Journal', 'Write 3 things you are grateful for', 'number', 'items', 3, 'daily', 10, 3, false),
    
    (4, 2, 'Glasses of Water', 'Track water consumption', 'number', 'glasses', 8, 'daily', 5, 1, true),
    (5, 2, 'Hydration Reminder', 'Set hourly reminders', 'check', 'task', 1, 'daily', 5, 2, false),
    
    (6, 3, 'Daily Workout', 'Complete assigned workout', 'check', 'workout', 1, 'daily', 30, 1, true),
    (7, 3, 'Step Count', 'Track daily steps', 'number', 'steps', 10000, 'daily', 20, 2, true),
    (8, 3, 'Healthy Meal', 'Log a healthy meal', 'check', 'meal', 1, 'daily', 10, 3, false)
ON CONFLICT (id) DO UPDATE SET 
    title = EXCLUDED.title,
    points = EXCLUDED.points;

-- ============================================================================
-- USER PROTOCOLS
-- ============================================================================
INSERT INTO user_protocols (user_id, protocol_id, assigned_at, assigned_by)
VALUES
    ('e2e00001-0000-0000-0000-000000000001', 1, NOW() - INTERVAL '10 days', 'e2e00001-0000-0000-0000-000000000011'),
    ('e2e00001-0000-0000-0000-000000000001', 2, NOW() - INTERVAL '5 days', 'e2e00001-0000-0000-0000-000000000011'),
    ('e2e00001-0000-0000-0000-000000000004', 1, NOW() - INTERVAL '15 days', 'e2e00001-0000-0000-0000-000000000011'),
    ('e2e00001-0000-0000-0000-000000000012', 3, NOW() - INTERVAL '30 days', 'e2e00001-0000-0000-0000-000000000012'),
    ('e2e00001-0000-0000-0000-000000000013', 3, NOW() - INTERVAL '28 days', 'e2e00001-0000-0000-0000-000000000012'),
    ('e2e00001-0000-0000-0000-000000000001', 3, NOW() - INTERVAL '25 days', 'e2e00001-0000-0000-0000-000000000012')
ON CONFLICT (user_id, protocol_id) DO NOTHING;

-- ============================================================================
-- PROTOCOL ELEMENT LOGS (for leaderboard data)
-- ============================================================================
INSERT INTO protocol_element_logs (element_id, user_id, completed, value, points_earned, log_date)
VALUES
    -- Test user logs
    (1, 'e2e00001-0000-0000-0000-000000000001', true, 1, 20, CURRENT_DATE - INTERVAL '1 day'),
    (2, 'e2e00001-0000-0000-0000-000000000001', true, 1, 15, CURRENT_DATE - INTERVAL '1 day'),
    (4, 'e2e00001-0000-0000-0000-000000000001', true, 8, 40, CURRENT_DATE - INTERVAL '1 day'),
    
    -- Jane Smith logs (higher scores for leaderboard)
    (1, 'e2e00001-0000-0000-0000-000000000004', true, 1, 20, CURRENT_DATE - INTERVAL '1 day'),
    (2, 'e2e00001-0000-0000-0000-000000000004', true, 1, 15, CURRENT_DATE - INTERVAL '1 day'),
    (3, 'e2e00001-0000-0000-0000-000000000004', true, 3, 10, CURRENT_DATE - INTERVAL '1 day'),
    (1, 'e2e00001-0000-0000-0000-000000000004', true, 1, 20, CURRENT_DATE - INTERVAL '2 days'),
    (2, 'e2e00001-0000-0000-0000-000000000004', true, 1, 15, CURRENT_DATE - INTERVAL '2 days')
ON CONFLICT (element_id, user_id, log_date) DO UPDATE SET 
    completed = EXCLUDED.completed,
    points_earned = EXCLUDED.points_earned;

-- ============================================================================
-- PROTOCOL USER STATS
-- ============================================================================
INSERT INTO protocol_user_stats (protocol_id, user_id, total_points, total_completions, current_streak, longest_streak, last_activity_date, first_activity_date)
VALUES
    (1, 'e2e00001-0000-0000-0000-000000000001', 75, 3, 2, 5, CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE - INTERVAL '10 days'),
    (2, 'e2e00001-0000-0000-0000-000000000001', 40, 1, 1, 3, CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE - INTERVAL '5 days'),
    (1, 'e2e00001-0000-0000-0000-000000000004', 170, 8, 7, 10, CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE - INTERVAL '15 days'),
    (3, 'e2e00001-0000-0000-0000-000000000012', 500, 25, 20, 25, CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE - INTERVAL '30 days'),
    (3, 'e2e00001-0000-0000-0000-000000000013', 400, 20, 15, 20, CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE - INTERVAL '28 days'),
    (3, 'e2e00001-0000-0000-0000-000000000001', 300, 15, 10, 15, CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE - INTERVAL '25 days')
ON CONFLICT (protocol_id, user_id) DO UPDATE SET 
    total_points = EXCLUDED.total_points,
    total_completions = EXCLUDED.total_completions;

-- ============================================================================
-- ORGANIZATION USER STATS
-- ============================================================================
INSERT INTO organization_user_stats (organization_id, user_id, total_points, total_completions, current_streak, longest_streak)
VALUES
    ('e2e00002-0000-0000-0000-000000000003', 'e2e00001-0000-0000-0000-000000000012', 500, 25, 20, 25),
    ('e2e00002-0000-0000-0000-000000000003', 'e2e00001-0000-0000-0000-000000000013', 400, 20, 15, 20),
    ('e2e00002-0000-0000-0000-000000000003', 'e2e00001-0000-0000-0000-000000000001', 300, 15, 10, 15)
ON CONFLICT (organization_id, user_id) DO UPDATE SET 
    total_points = EXCLUDED.total_points,
    total_completions = EXCLUDED.total_completions;

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
-- VERIFICATION
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE 'E2E Test Data Seeded Successfully!';
    RAISE NOTICE 'Test Users: %', (SELECT COUNT(*) FROM users WHERE email LIKE '%@e2etest.com' OR email = 'team@habitpulse.com');
    RAISE NOTICE 'Organizations: %', (SELECT COUNT(*) FROM organizations WHERE name LIKE 'E2E%');
    RAISE NOTICE 'Challenges: %', (SELECT COUNT(*) FROM challenges WHERE title LIKE 'E2E%' OR id >= 9001);
    RAISE NOTICE 'Protocols: %', (SELECT COUNT(*) FROM protocols);
END $$;
