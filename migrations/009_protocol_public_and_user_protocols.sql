-- ============================================================================
-- Migration: Protocol Public Flag and User Protocols Table
-- Description: Adds is_public flag to protocols and ensures user_protocols table exists
-- ============================================================================

-- Add is_public column to protocols if not exists
ALTER TABLE protocols 
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;

-- Create user_protocols table for tracking which users are in which protocols
CREATE TABLE IF NOT EXISTS user_protocols (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  protocol_id INT NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, protocol_id)
);

CREATE INDEX IF NOT EXISTS idx_user_protocols_user ON user_protocols(user_id);
CREATE INDEX IF NOT EXISTS idx_user_protocols_protocol ON user_protocols(protocol_id);

-- Add is_open column to protocols (for open challenges anyone can join)
ALTER TABLE protocols 
ADD COLUMN IF NOT EXISTS is_open BOOLEAN DEFAULT false;

-- Add target_days to protocols (similar to challenges)
ALTER TABLE protocols 
ADD COLUMN IF NOT EXISTS target_days INT DEFAULT 21;

-- Add start_date and end_date to protocols
ALTER TABLE protocols 
ADD COLUMN IF NOT EXISTS start_date TIMESTAMP;

ALTER TABLE protocols 
ADD COLUMN IF NOT EXISTS end_date TIMESTAMP;

-- Add rewards to protocols
ALTER TABLE protocols 
ADD COLUMN IF NOT EXISTS rewards JSONB DEFAULT '{"xp": 100}';

-- Create index for public protocols
CREATE INDEX IF NOT EXISTS idx_protocols_is_public ON protocols(is_public);
CREATE INDEX IF NOT EXISTS idx_protocols_is_open ON protocols(is_open);

-- ============================================================================
-- Global Leaderboard View
-- ============================================================================

-- Create a view for global leaderboard across all protocols
CREATE OR REPLACE VIEW global_leaderboard AS
SELECT 
  u.id as user_id,
  u.name,
  u.avatar_url,
  u.privacy_public_leaderboard as privacy,
  COALESCE(SUM(pus.total_points), 0) as total_points,
  COALESCE(SUM(pus.total_completions), 0) as total_completions,
  MAX(pus.current_streak) as max_streak,
  COUNT(DISTINCT pus.protocol_id) as protocols_joined
FROM users u
LEFT JOIN protocol_user_stats pus ON u.id = pus.user_id
GROUP BY u.id, u.name, u.avatar_url, u.privacy_public_leaderboard;

-- ============================================================================
-- Update is_public for challenges compatibility
-- ============================================================================

-- Ensure challenges have is_public column too for consistency
-- This is already in the schema but adding just in case
ALTER TABLE challenges 
ADD COLUMN IF NOT EXISTS is_open BOOLEAN DEFAULT false;
