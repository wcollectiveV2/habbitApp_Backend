
-- Migration: Remove unique daily constraint on habit logs to allow multiple completions per day
DROP INDEX IF EXISTS idx_habit_logs_unique_daily;

-- Create a non-unique index for performance
CREATE INDEX IF NOT EXISTS idx_habit_logs_daily ON habit_logs (habit_id, user_id, (completed_at::date));
