-- Migration: Add user blocks table for blocking users
-- Date: 2026-02-03

-- Create user_blocks table if not exists
CREATE TABLE IF NOT EXISTS user_blocks (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, blocked_user_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_blocks_user_id ON user_blocks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked_user_id ON user_blocks(blocked_user_id);

-- Add privacy columns to users table if not exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'privacy_profile_visibility') THEN
        ALTER TABLE users ADD COLUMN privacy_profile_visibility VARCHAR(20) DEFAULT 'public';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'privacy_activity_feed') THEN
        ALTER TABLE users ADD COLUMN privacy_activity_feed VARCHAR(20) DEFAULT 'public';
    END IF;
END $$;

-- Add priority and due_date columns to tasks if not exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tasks' AND column_name = 'priority') THEN
        ALTER TABLE tasks ADD COLUMN priority VARCHAR(10) DEFAULT 'medium';
    END IF;
END $$;
