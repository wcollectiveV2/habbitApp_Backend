-- Add bio and privacy settings to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_public_leaderboard VARCHAR(50) DEFAULT 'visible';
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_challenge_leaderboard VARCHAR(50) DEFAULT 'visible';

COMMENT ON COLUMN users.privacy_public_leaderboard IS 'visible, anonymous, hidden';
COMMENT ON COLUMN users.privacy_challenge_leaderboard IS 'visible, anonymous, hidden';
