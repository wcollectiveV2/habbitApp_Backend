INSERT INTO challenges (title, description, type, status, icon, is_public, start_date, end_date, target_days) VALUES
('Hydration Hero', 'Drink 8 glasses of water daily for better health and energy', 'individual', 'active', 'water_drop', true, NOW() - INTERVAL '7 days', NOW() + INTERVAL '14 days', 21),
('Morning Meditation', 'Start each day with 10 minutes of mindfulness meditation', 'group', 'active', 'self_improvement', true, NOW() - INTERVAL '3 days', NOW() + INTERVAL '27 days', 30),
('30 Day Fitness', 'Complete a daily workout routine for 30 days straight', 'competitive', 'active', 'fitness_center', true, NOW() - INTERVAL '5 days', NOW() + INTERVAL '25 days', 30),
('Reading Challenge', 'Read for at least 20 minutes every day', 'group', 'active', 'menu_book', true, NOW() - INTERVAL '10 days', NOW() + INTERVAL '20 days', 30),
('Digital Detox', 'Limit screen time to 2 hours outside of work', 'individual', 'active', 'phone_disabled', true, NOW() - INTERVAL '2 days', NOW() + INTERVAL '12 days', 14),
('10K Steps Daily', 'Walk at least 10,000 steps every single day', 'competitive', 'active', 'directions_walk', true, NOW() - INTERVAL '8 days', NOW() + INTERVAL '22 days', 30),
('Healthy Eating', 'Eat 5 servings of fruits and vegetables daily', 'group', 'active', 'restaurant', true, NOW() - INTERVAL '4 days', NOW() + INTERVAL '17 days', 21),
('Early Bird Club', 'Wake up before 6 AM every morning', 'competitive', 'active', 'wb_sunny', true, NOW() - INTERVAL '6 days', NOW() + INTERVAL '15 days', 21),
('Gratitude Journal', 'Write 3 things you are grateful for each day', 'individual', 'active', 'edit_note', true, NOW() - INTERVAL '1 day', NOW() + INTERVAL '29 days', 30),
('No Sugar Challenge', 'Avoid added sugars for the entire challenge period', 'group', 'upcoming', 'no_food', true, NOW() + INTERVAL '3 days', NOW() + INTERVAL '24 days', 21),
('Cold Shower Warriors', 'Take a cold shower every morning to boost energy', 'competitive', 'upcoming', 'shower', true, NOW() + INTERVAL '5 days', NOW() + INTERVAL '19 days', 14),
('Language Learning', 'Practice a new language for 15 minutes daily', 'individual', 'active', 'translate', true, NOW() - INTERVAL '12 days', NOW() + INTERVAL '48 days', 60)
ON CONFLICT DO NOTHING;
