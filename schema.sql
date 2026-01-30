-- ============================================================================
-- HabitPulse Database Schema
-- Run this in your Neon database SQL Editor
-- ============================================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  current_streak INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Habits table
CREATE TABLE IF NOT EXISTS habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  frequency VARCHAR(50) DEFAULT 'daily',
  target_count INT DEFAULT 1,
  category VARCHAR(100) DEFAULT 'general',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Habit logs table (tracks completions)
CREATE TABLE IF NOT EXISTS habit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  completed_at TIMESTAMP DEFAULT NOW(),
  notes TEXT,
  UNIQUE(habit_id, user_id, (completed_at::date))
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  habit_id UUID REFERENCES habits(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  priority VARCHAR(50) DEFAULT 'medium',
  due_date TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- Indexes for better query performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_habits_user_id ON habits(user_id);
CREATE INDEX IF NOT EXISTS idx_habits_category ON habits(category);
CREATE INDEX IF NOT EXISTS idx_habits_is_active ON habits(is_active);

CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_id ON habit_logs(habit_id);
CREATE INDEX IF NOT EXISTS idx_habit_logs_user_id ON habit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_logs_completed_at ON habit_logs(completed_at);

CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_habit_id ON tasks(habit_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- ============================================================================
-- Challenges & Social Features
-- ============================================================================

-- Challenges table
CREATE TABLE IF NOT EXISTS challenges (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) DEFAULT 'individual',
  status VARCHAR(50) DEFAULT 'upcoming',
  icon VARCHAR(100) DEFAULT 'flag',
  is_public BOOLEAN DEFAULT true,
  start_date TIMESTAMP DEFAULT NOW(),
  end_date TIMESTAMP NOT NULL,
  target_days INT DEFAULT 21,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Challenge participants table
CREATE TABLE IF NOT EXISTS challenge_participants (
  id SERIAL PRIMARY KEY,
  challenge_id INT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  progress INT DEFAULT 0,
  completed_days INT DEFAULT 0,
  current_streak INT DEFAULT 0,
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(challenge_id, user_id)
);

-- Challenge logs table (daily check-ins)
CREATE TABLE IF NOT EXISTS challenge_logs (
  id SERIAL PRIMARY KEY,
  challenge_id INT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  completed BOOLEAN DEFAULT false,
  value INT DEFAULT 0,
  notes TEXT,
  logged_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(challenge_id, user_id, date)
);

-- User follows table (friendships/following system)
CREATE TABLE IF NOT EXISTS user_follows (
  id SERIAL PRIMARY KEY,
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);

-- Activity feed table
CREATE TABLE IF NOT EXISTS activity_feed (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add total_points to users if not exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_points INT DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status);
CREATE INDEX IF NOT EXISTS idx_challenges_is_public ON challenges(is_public);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_challenge ON challenge_participants(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_user ON challenge_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows(following_id);
CREATE INDEX IF NOT EXISTS idx_activity_feed_user ON activity_feed(user_id);

-- ============================================================================
-- Optional: Insert sample data for testing
-- ============================================================================

-- Uncomment below to add a test user (password: test123)
-- INSERT INTO users (email, password_hash, name) VALUES 
-- ('test@example.com', '$2b$10$rQZ8kHxVJgQjH1M7TJqV5uF8h8nqWQ9BqVN8s3mM5A0uP6YzQJ6Gy', 'Test User');

-- ============================================================================
-- Seed Challenges Data
-- Run this to populate the challenges table with sample data
-- ============================================================================

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
