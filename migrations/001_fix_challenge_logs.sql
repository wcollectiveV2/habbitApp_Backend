-- Migration: Add date and completed columns to challenge_logs
-- Run this in your Neon database SQL Editor

-- Drop and recreate challenge_logs table with proper schema
DROP TABLE IF EXISTS challenge_logs;

CREATE TABLE challenge_logs (
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

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_challenge_logs_challenge_user ON challenge_logs(challenge_id, user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_logs_date ON challenge_logs(date);

-- Verify the table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'challenge_logs';
