-- ============================================================================
-- HabitPulse Database Schema
-- This file is automatically run when the PostgreSQL container starts
-- ============================================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  current_streak INT DEFAULT 0,
  total_points INT DEFAULT 0,
  privacy_public_leaderboard VARCHAR(50) DEFAULT 'visible',
  privacy_challenge_leaderboard VARCHAR(50) DEFAULT 'visible',
  privacy_protocol_leaderboard VARCHAR(50) DEFAULT 'visible',
  privacy_organization_leaderboard VARCHAR(50) DEFAULT 'visible',
  roles TEXT[] DEFAULT ARRAY['user'],
  primary_organization_id UUID,
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
  notes TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_habit_logs_unique_daily ON habit_logs (habit_id, user_id, (completed_at::date));

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  habit_id UUID REFERENCES habits(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  type VARCHAR(50) DEFAULT 'check',
  goal INT DEFAULT 1,
  current_value INT DEFAULT 0,
  unit VARCHAR(50),
  step INT DEFAULT 1,
  icon VARCHAR(100),
  priority VARCHAR(50) DEFAULT 'medium',
  due_date TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  logo_url TEXT,
  description TEXT,
  type VARCHAR(50) DEFAULT 'company',
  parent_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Organization members table
CREATE TABLE IF NOT EXISTS organization_members (
  id SERIAL PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member',
  status VARCHAR(50) DEFAULT 'active',
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- Organization invitations table
CREATE TABLE IF NOT EXISTS organization_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    token VARCHAR(64) UNIQUE NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255),
    role VARCHAR(50) DEFAULT 'member',
    expires_at TIMESTAMP NOT NULL,
    max_uses INT DEFAULT 1,
    current_uses INT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active',
    redirect_url TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Challenges table
CREATE TABLE IF NOT EXISTS challenges (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  daily_action VARCHAR(255),
  type VARCHAR(50) DEFAULT 'individual',
  status VARCHAR(50) DEFAULT 'upcoming',
  icon VARCHAR(100) DEFAULT 'flag',
  is_public BOOLEAN DEFAULT true,
  rewards JSONB DEFAULT '{"xp": 100, "badge": "Challenge Completer"}',
  start_date TIMESTAMP DEFAULT NOW(),
  end_date TIMESTAMP NOT NULL,
  target_days INT DEFAULT 21,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
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
  status VARCHAR(50) DEFAULT 'active',
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(challenge_id, user_id)
);

-- Challenge logs table
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

-- Challenge tasks table
CREATE TABLE IF NOT EXISTS challenge_tasks (
  id SERIAL PRIMARY KEY,
  challenge_id INT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL DEFAULT 'boolean',
  target_value INT,
  unit VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(challenge_id, title)
);

-- Challenge task logs table
CREATE TABLE IF NOT EXISTS challenge_task_logs (
  id SERIAL PRIMARY KEY,
  task_id INT NOT NULL REFERENCES challenge_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  value INT,
  log_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- User follows table
CREATE TABLE IF NOT EXISTS user_follows (
  id SERIAL PRIMARY KEY,
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);

-- User blocks table
CREATE TABLE IF NOT EXISTS user_blocks (
  id SERIAL PRIMARY KEY,
  blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);

-- Activity feed table
CREATE TABLE IF NOT EXISTS activity_feed (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  data JSONB,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Password reset tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Protocols table
CREATE TABLE IF NOT EXISTS protocols (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  creator_id UUID REFERENCES users(id) ON DELETE SET NULL,
  is_public BOOLEAN DEFAULT false,
  status VARCHAR(50) DEFAULT 'active',
  icon VARCHAR(100) DEFAULT 'checklist',
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Protocol elements table
CREATE TABLE IF NOT EXISTS protocol_elements (
  id SERIAL PRIMARY KEY,
  protocol_id INT NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) DEFAULT 'check',
  unit VARCHAR(50),
  goal INT,
  frequency VARCHAR(50) DEFAULT 'daily',
  points INT DEFAULT 10,
  min_value INT,
  max_value INT,
  display_order INT DEFAULT 0,
  is_required BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- User protocols table
CREATE TABLE IF NOT EXISTS user_protocols (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  protocol_id INT NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT NOW(),
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(user_id, protocol_id)
);

-- Protocol organization assignments
CREATE TABLE IF NOT EXISTS protocol_organization_assignments (
  id SERIAL PRIMARY KEY,
  protocol_id INT NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(protocol_id, organization_id)
);

-- Protocol element logs
CREATE TABLE IF NOT EXISTS protocol_element_logs (
  id SERIAL PRIMARY KEY,
  element_id INT NOT NULL REFERENCES protocol_elements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT false,
  value NUMERIC,
  text_value TEXT,
  points_earned INT DEFAULT 0,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  logged_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(element_id, user_id, log_date)
);

-- Protocol user stats
CREATE TABLE IF NOT EXISTS protocol_user_stats (
  id SERIAL PRIMARY KEY,
  protocol_id INT NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_points INT DEFAULT 0,
  total_completions INT DEFAULT 0,
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  last_activity_date DATE,
  first_activity_date DATE,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(protocol_id, user_id)
);

-- Organization user stats
CREATE TABLE IF NOT EXISTS organization_user_stats (
  id SERIAL PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_points INT DEFAULT 0,
  total_completions INT DEFAULT 0,
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- Admin audit logs table
CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id UUID NOT NULL,
    previous_state JSONB,
    new_state JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- Indexes
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

CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status);
CREATE INDEX IF NOT EXISTS idx_challenges_is_public ON challenges(is_public);
CREATE INDEX IF NOT EXISTS idx_challenges_organization_id ON challenges(organization_id);

CREATE INDEX IF NOT EXISTS idx_challenge_participants_challenge ON challenge_participants(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_user ON challenge_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_tasks_challenge_id ON challenge_tasks(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_task_logs_task_id ON challenge_task_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_challenge_task_logs_user_date ON challenge_task_logs(user_id, log_date);

CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows(following_id);
CREATE INDEX IF NOT EXISTS idx_activity_feed_user ON activity_feed(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_organizations_parent_id ON organizations(parent_id);
CREATE INDEX IF NOT EXISTS idx_organizations_type ON organizations(type);

CREATE INDEX IF NOT EXISTS idx_org_invitations_token ON organization_invitations(token);
CREATE INDEX IF NOT EXISTS idx_org_invitations_org_id ON organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON organization_invitations(email);
CREATE INDEX IF NOT EXISTS idx_org_invitations_status ON organization_invitations(status);
CREATE INDEX IF NOT EXISTS idx_org_invitations_expires_at ON organization_invitations(expires_at);

CREATE INDEX IF NOT EXISTS idx_users_primary_org ON users(primary_organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON admin_audit_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON admin_audit_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_protocols_creator ON protocols(creator_id);
CREATE INDEX IF NOT EXISTS idx_protocols_organization ON protocols(organization_id);
CREATE INDEX IF NOT EXISTS idx_protocols_status ON protocols(status);
CREATE INDEX IF NOT EXISTS idx_protocol_elements_protocol ON protocol_elements(protocol_id);
CREATE INDEX IF NOT EXISTS idx_user_protocols_user ON user_protocols(user_id);
CREATE INDEX IF NOT EXISTS idx_protocol_org_assignments_protocol ON protocol_organization_assignments(protocol_id);
CREATE INDEX IF NOT EXISTS idx_protocol_org_assignments_org ON protocol_organization_assignments(organization_id);
CREATE INDEX IF NOT EXISTS idx_protocol_element_logs_element ON protocol_element_logs(element_id);
CREATE INDEX IF NOT EXISTS idx_protocol_element_logs_user ON protocol_element_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_protocol_element_logs_date ON protocol_element_logs(log_date);
CREATE INDEX IF NOT EXISTS idx_protocol_user_stats_protocol ON protocol_user_stats(protocol_id);
CREATE INDEX IF NOT EXISTS idx_protocol_user_stats_user ON protocol_user_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_protocol_user_stats_points ON protocol_user_stats(total_points DESC);
CREATE INDEX IF NOT EXISTS idx_org_user_stats_org ON organization_user_stats(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_user_stats_user ON organization_user_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_org_user_stats_points ON organization_user_stats(total_points DESC);

-- ============================================================================
-- Helper Functions
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_invitation_token() RETURNS VARCHAR(64) AS $$
DECLARE
    token VARCHAR(64);
BEGIN
    token := encode(gen_random_bytes(32), 'hex');
    RETURN token;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION expire_old_invitations() RETURNS void AS $$
BEGIN
    UPDATE organization_invitations 
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'active' 
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Stats update functions
CREATE OR REPLACE FUNCTION update_protocol_user_stats(p_protocol_id INT, p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_total_points INT;
  v_total_completions INT;
  v_first_date DATE;
  v_last_date DATE;
BEGIN
  SELECT 
    COALESCE(SUM(points_earned), 0),
    COUNT(*),
    MIN(log_date),
    MAX(log_date)
  INTO v_total_points, v_total_completions, v_first_date, v_last_date
  FROM protocol_element_logs pel
  JOIN protocol_elements pe ON pel.element_id = pe.id
  WHERE pe.protocol_id = p_protocol_id AND pel.user_id = p_user_id;
  
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

CREATE OR REPLACE FUNCTION update_organization_user_stats(p_org_id UUID, p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_total_points INT;
  v_total_completions INT;
BEGIN
  SELECT 
    COALESCE(SUM(pus.total_points), 0),
    COALESCE(SUM(pus.total_completions), 0)
  INTO v_total_points, v_total_completions
  FROM protocol_user_stats pus
  JOIN protocols p ON pus.protocol_id = p.id
  WHERE p.organization_id = p_org_id AND pus.user_id = p_user_id;
  
  INSERT INTO organization_user_stats (organization_id, user_id, total_points, total_completions, updated_at)
  VALUES (p_org_id, p_user_id, v_total_points, v_total_completions, NOW())
  ON CONFLICT (organization_id, user_id) DO UPDATE SET
    total_points = EXCLUDED.total_points,
    total_completions = EXCLUDED.total_completions,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Trigger function for auto-updating stats
CREATE OR REPLACE FUNCTION trigger_update_stats_on_log()
RETURNS TRIGGER AS $$
DECLARE
  v_protocol_id INT;
  v_org_id UUID;
BEGIN
  SELECT pe.protocol_id INTO v_protocol_id
  FROM protocol_elements pe
  WHERE pe.id = NEW.element_id;
  
  PERFORM update_protocol_user_stats(v_protocol_id, NEW.user_id);
  
  SELECT p.organization_id INTO v_org_id
  FROM protocols p
  WHERE p.id = v_protocol_id;
  
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

-- Add foreign key for primary_organization_id after organizations table exists
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_primary_organization_id_fkey;
ALTER TABLE users ADD CONSTRAINT users_primary_organization_id_fkey 
  FOREIGN KEY (primary_organization_id) REFERENCES organizations(id) ON DELETE SET NULL;
