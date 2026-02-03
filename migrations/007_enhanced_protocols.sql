-- ============================================================================
-- Migration: Enhanced Protocol System
-- Description: Adds enhanced protocol elements with multiple action types,
--              points system, organization assignment, and leaderboards
-- ============================================================================

-- 1. Add points column to protocol_elements
ALTER TABLE protocol_elements 
ADD COLUMN IF NOT EXISTS points INT DEFAULT 10;

-- Add description to protocol_elements
ALTER TABLE protocol_elements 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add min_value/max_value for range type elements (e.g., 1-8 glasses)
ALTER TABLE protocol_elements 
ADD COLUMN IF NOT EXISTS min_value INT;

ALTER TABLE protocol_elements 
ADD COLUMN IF NOT EXISTS max_value INT;

-- Add order for element display ordering
ALTER TABLE protocol_elements 
ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0;

-- Add is_required flag
ALTER TABLE protocol_elements 
ADD COLUMN IF NOT EXISTS is_required BOOLEAN DEFAULT true;

-- ============================================================================
-- 2. Link protocols to organizations
-- ============================================================================

-- Add organization_id to protocols
ALTER TABLE protocols 
ADD COLUMN IF NOT EXISTS organization_id INT REFERENCES organizations(id) ON DELETE SET NULL;

-- Add status for protocol lifecycle
ALTER TABLE protocols 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';

-- Add icon for protocol
ALTER TABLE protocols 
ADD COLUMN IF NOT EXISTS icon VARCHAR(100) DEFAULT 'checklist';

CREATE INDEX IF NOT EXISTS idx_protocols_organization ON protocols(organization_id);
CREATE INDEX IF NOT EXISTS idx_protocols_status ON protocols(status);

-- ============================================================================
-- 3. Protocol Organization Assignments (for assigning to multiple orgs)
-- ============================================================================

CREATE TABLE IF NOT EXISTS protocol_organization_assignments (
  id SERIAL PRIMARY KEY,
  protocol_id INT NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
  organization_id INT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(protocol_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_protocol_org_assignments_protocol ON protocol_organization_assignments(protocol_id);
CREATE INDEX IF NOT EXISTS idx_protocol_org_assignments_org ON protocol_organization_assignments(organization_id);

-- ============================================================================
-- 4. Protocol Element Logs (tracks user completions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS protocol_element_logs (
  id SERIAL PRIMARY KEY,
  element_id INT NOT NULL REFERENCES protocol_elements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- For different element types:
  -- 'check': completed = true/false
  -- 'number': value = numeric input
  -- 'range': value = selected number from range
  -- 'timer': value = seconds/minutes
  -- 'text': text_value = user text input
  
  completed BOOLEAN DEFAULT false,
  value NUMERIC,           -- For number, range, timer types
  text_value TEXT,         -- For text type
  
  -- Points earned for this log
  points_earned INT DEFAULT 0,
  
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  logged_at TIMESTAMP DEFAULT NOW(),
  
  -- One entry per user per element per day
  UNIQUE(element_id, user_id, log_date)
);

CREATE INDEX IF NOT EXISTS idx_protocol_element_logs_element ON protocol_element_logs(element_id);
CREATE INDEX IF NOT EXISTS idx_protocol_element_logs_user ON protocol_element_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_protocol_element_logs_date ON protocol_element_logs(log_date);

-- ============================================================================
-- 5. Protocol User Stats (aggregated stats for leaderboard)
-- ============================================================================

CREATE TABLE IF NOT EXISTS protocol_user_stats (
  id SERIAL PRIMARY KEY,
  protocol_id INT NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Points
  total_points INT DEFAULT 0,
  
  -- Completion stats
  total_completions INT DEFAULT 0,  -- Total element completions
  current_streak INT DEFAULT 0,      -- Days in a row with at least one completion
  longest_streak INT DEFAULT 0,
  
  -- Date tracking
  last_activity_date DATE,
  first_activity_date DATE,
  
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(protocol_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_protocol_user_stats_protocol ON protocol_user_stats(protocol_id);
CREATE INDEX IF NOT EXISTS idx_protocol_user_stats_user ON protocol_user_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_protocol_user_stats_points ON protocol_user_stats(total_points DESC);

-- ============================================================================
-- 6. Organization User Stats (for organization leaderboard)
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_user_stats (
  id SERIAL PRIMARY KEY,
  organization_id INT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Aggregated points from all protocols in this org
  total_points INT DEFAULT 0,
  
  -- Completion stats
  total_completions INT DEFAULT 0,
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_user_stats_org ON organization_user_stats(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_user_stats_user ON organization_user_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_org_user_stats_points ON organization_user_stats(total_points DESC);

-- ============================================================================
-- 7. Enhanced User Privacy Settings
-- ============================================================================

-- Add protocol leaderboard privacy to users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS privacy_protocol_leaderboard VARCHAR(50) DEFAULT 'visible';

-- Add organization leaderboard privacy to users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS privacy_organization_leaderboard VARCHAR(50) DEFAULT 'visible';

-- ============================================================================
-- 8. Update element types enum-like check
-- ============================================================================

-- Update protocol_elements type column to support new types
COMMENT ON COLUMN protocol_elements.type IS 'Element type: check, number, range, timer, text';

-- ============================================================================
-- 9. Function to calculate and update user stats
-- ============================================================================

CREATE OR REPLACE FUNCTION update_protocol_user_stats(p_protocol_id INT, p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_total_points INT;
  v_total_completions INT;
  v_first_date DATE;
  v_last_date DATE;
BEGIN
  -- Calculate totals from logs
  SELECT 
    COALESCE(SUM(points_earned), 0),
    COUNT(*),
    MIN(log_date),
    MAX(log_date)
  INTO v_total_points, v_total_completions, v_first_date, v_last_date
  FROM protocol_element_logs pel
  JOIN protocol_elements pe ON pel.element_id = pe.id
  WHERE pe.protocol_id = p_protocol_id AND pel.user_id = p_user_id;
  
  -- Upsert stats
  INSERT INTO protocol_user_stats (protocol_id, user_id, total_points, total_completions, first_activity_date, last_activity_date, updated_at)
  VALUES (p_protocol_id, p_user_id, v_total_points, v_total_completions, v_first_date, v_last_date, NOW())
  ON CONFLICT (protocol_id, user_id) DO UPDATE SET
    total_points = EXCLUDED.total_points,
    total_completions = EXCLUDED.total_completions,
    first_activity_date = COALESCE(EXCLUDED.first_activity_date, protocol_user_stats.first_activity_date),
    last_activity_date = EXCLUDED.last_activity_date,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 10. Function to update organization user stats
-- ============================================================================

CREATE OR REPLACE FUNCTION update_organization_user_stats(p_org_id INT, p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_total_points INT;
  v_total_completions INT;
BEGIN
  -- Sum points from all protocols in this organization
  SELECT 
    COALESCE(SUM(pus.total_points), 0),
    COALESCE(SUM(pus.total_completions), 0)
  INTO v_total_points, v_total_completions
  FROM protocol_user_stats pus
  JOIN protocols p ON pus.protocol_id = p.id
  WHERE p.organization_id = p_org_id AND pus.user_id = p_user_id;
  
  -- Upsert stats
  INSERT INTO organization_user_stats (organization_id, user_id, total_points, total_completions, updated_at)
  VALUES (p_org_id, p_user_id, v_total_points, v_total_completions, NOW())
  ON CONFLICT (organization_id, user_id) DO UPDATE SET
    total_points = EXCLUDED.total_points,
    total_completions = EXCLUDED.total_completions,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 11. Trigger to auto-update stats on log insert/update
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_update_stats_on_log()
RETURNS TRIGGER AS $$
DECLARE
  v_protocol_id INT;
  v_org_id INT;
BEGIN
  -- Get protocol_id from element
  SELECT pe.protocol_id INTO v_protocol_id
  FROM protocol_elements pe
  WHERE pe.id = NEW.element_id;
  
  -- Update protocol user stats
  PERFORM update_protocol_user_stats(v_protocol_id, NEW.user_id);
  
  -- Get organization_id from protocol
  SELECT p.organization_id INTO v_org_id
  FROM protocols p
  WHERE p.id = v_protocol_id;
  
  -- Update organization user stats if protocol belongs to an org
  IF v_org_id IS NOT NULL THEN
    PERFORM update_organization_user_stats(v_org_id, NEW.user_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_stats_on_log ON protocol_element_logs;
CREATE TRIGGER trg_update_stats_on_log
AFTER INSERT OR UPDATE ON protocol_element_logs
FOR EACH ROW
EXECUTE FUNCTION trigger_update_stats_on_log();
