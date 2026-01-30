-- Seed Challenges
INSERT INTO challenges (title, description, type, status, icon, is_public, start_date, end_date, target_days, created_by, rewards) 
SELECT 
  d.title, d.description, d.type, d.status, d.icon, d.is_public, d.start_date, d.end_date, d.target_days, 
  (SELECT id FROM users WHERE email = 'team@habitpulse.com'),
  d.rewards::jsonb
FROM (VALUES 
    ('Hydration Hero', 'Drink 8 glasses of water daily for better health and energy', 'individual', 'active', 'water_drop', true, NOW() - INTERVAL '7 days', NOW() + INTERVAL '14 days', 21, '{"xp": 500, "badge": "Hydration Master"}'),
    ('Morning Meditation', 'Start each day with 10 minutes of mindfulness meditation', 'group', 'active', 'self_improvement', true, NOW() - INTERVAL '3 days', NOW() + INTERVAL '27 days', 30, '{"xp": 600, "badge": "Zen Master"}'),
    ('30 Day Fitness', 'Complete a daily workout routine for 30 days straight', 'competitive', 'active', 'fitness_center', true, NOW() - INTERVAL '5 days', NOW() + INTERVAL '25 days', 30, '{"xp": 1000, "badge": "Fitness Freak"}'),
    ('Reading Challenge', 'Read for at least 20 minutes every day', 'group', 'active', 'menu_book', true, NOW() - INTERVAL '10 days', NOW() + INTERVAL '20 days', 30, '{"xp": 400, "badge": "Bookworm"}'),
    ('Digital Detox', 'Limit screen time to 2 hours outside of work', 'individual', 'active', 'phone_disabled', true, NOW() - INTERVAL '2 days', NOW() + INTERVAL '12 days', 14, '{"xp": 300, "badge": "Unplugged"}'),
    ('10K Steps Daily', 'Walk at least 10,000 steps every single day', 'competitive', 'active', 'directions_walk', true, NOW() - INTERVAL '8 days', NOW() + INTERVAL '22 days', 30, '{"xp": 750, "badge": "Marathoner"}'),
    ('Healthy Eating', 'Eat 5 servings of fruits and vegetables daily', 'group', 'active', 'restaurant', true, NOW() - INTERVAL '4 days', NOW() + INTERVAL '17 days', 21, '{"xp": 450, "badge": "Health Nut"}'),
    ('Early Bird Club', 'Wake up before 6 AM every morning', 'competitive', 'active', 'wb_sunny', true, NOW() - INTERVAL '6 days', NOW() + INTERVAL '15 days', 21, '{"xp": 500, "badge": "Early Riser"}'),
    ('Gratitude Journal', 'Write 3 things you are grateful for each day', 'individual', 'active', 'edit_note', true, NOW() - INTERVAL '1 day', NOW() + INTERVAL '29 days', 30, '{"xp": 400, "badge": "Grateful Heart"}'),
    ('No Sugar Challenge', 'Avoid added sugars for the entire challenge period', 'group', 'upcoming', 'no_food', true, NOW() + INTERVAL '3 days', NOW() + INTERVAL '24 days', 21, '{"xp": 600, "badge": "Sweet Victory"}'),
    ('Cold Shower Warriors', 'Take a cold shower every morning to boost energy', 'competitive', 'upcoming', 'shower', true, NOW() + INTERVAL '5 days', NOW() + INTERVAL '19 days', 14, '{"xp": 350, "badge": "Ice Cold"}'),
    ('Language Learning', 'Practice a new language for 15 minutes daily', 'individual', 'active', 'translate', true, NOW() - INTERVAL '12 days', NOW() + INTERVAL '48 days', 60, '{"xp": 1500, "badge": "Polyglot"}')
) as d(title, description, type, status, icon, is_public, start_date, end_date, target_days, rewards)
ON CONFLICT DO NOTHING;

-- Seed Challenge Tasks
-- Hydration Hero
INSERT INTO challenge_tasks (challenge_id, title, description, type, target_value, unit)
SELECT id, 'Daily Water Intake', 'Track your water consumption', 'numeric', 8, 'glasses'
FROM challenges WHERE title = 'Hydration Hero'
ON CONFLICT DO NOTHING;

INSERT INTO challenge_tasks (challenge_id, title, description, type, target_value, unit)
SELECT id, 'Morning Glass', 'Start your day with a glass of water', 'boolean', 1, 'glass'
FROM challenges WHERE title = 'Hydration Hero'
ON CONFLICT DO NOTHING;

-- Morning Meditation
INSERT INTO challenge_tasks (challenge_id, title, description, type, target_value, unit)
SELECT id, 'Meditation Session', 'Complete 10 minutes of meditation', 'boolean', 1, 'session'
FROM challenges WHERE title = 'Morning Meditation'
ON CONFLICT DO NOTHING;

INSERT INTO challenge_tasks (challenge_id, title, description, type, target_value, unit)
SELECT id, 'Gratitude Journal', 'Write down 3 things you are grateful for', 'boolean', 1, 'entry'
FROM challenges WHERE title = 'Morning Meditation'
ON CONFLICT DO NOTHING;

-- 30 Day Fitness
INSERT INTO challenge_tasks (challenge_id, title, description, type, target_value, unit)
SELECT id, 'Main Workout', 'Complete todays workout routine', 'boolean', 1, 'workout'
FROM challenges WHERE title = '30 Day Fitness'
ON CONFLICT DO NOTHING;

INSERT INTO challenge_tasks (challenge_id, title, description, type, target_value, unit)
SELECT id, 'Stretching', '10 minutes of stretching', 'boolean', 1, 'session'
FROM challenges WHERE title = '30 Day Fitness'
ON CONFLICT DO NOTHING;

INSERT INTO challenge_tasks (challenge_id, title, description, type, target_value, unit)
SELECT id, 'Protein Intake', 'Hit your protein goal', 'boolean', 1, 'goal'
FROM challenges WHERE title = '30 Day Fitness'
ON CONFLICT DO NOTHING;

-- Reading Challenge
INSERT INTO challenge_tasks (challenge_id, title, description, type, target_value, unit)
SELECT id, 'Reading Time', 'Read for 20 minutes', 'numeric', 20, 'minutes'
FROM challenges WHERE title = 'Reading Challenge'
ON CONFLICT DO NOTHING;

INSERT INTO challenge_tasks (challenge_id, title, description, type, target_value, unit)
SELECT id, 'Daily Summary', 'Write a short summary of what you read', 'boolean', 1, 'note'
FROM challenges WHERE title = 'Reading Challenge'
ON CONFLICT DO NOTHING;

-- 10K Steps Daily
INSERT INTO challenge_tasks (challenge_id, title, description, type, target_value, unit)
SELECT id, 'Step Count', 'Track your daily steps', 'numeric', 10000, 'steps'
FROM challenges WHERE title = '10K Steps Daily'
ON CONFLICT DO NOTHING;

-- Healthy Eating
INSERT INTO challenge_tasks (challenge_id, title, description, type, target_value, unit)
SELECT id, 'Fruit & Veg Servings', 'Eat 5 servings', 'numeric', 5, 'servings'
FROM challenges WHERE title = 'Healthy Eating'
ON CONFLICT DO NOTHING;

INSERT INTO challenge_tasks (challenge_id, title, description, type, target_value, unit)
SELECT id, 'No Sugar', 'Avoid processed sugar today', 'boolean', 1, 'day'
FROM challenges WHERE title = 'Healthy Eating'
ON CONFLICT DO NOTHING;
