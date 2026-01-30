-- Migration: Add daily_action column to challenges table
-- Run this in your Neon database SQL Editor

-- Add daily_action column
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS daily_action VARCHAR(255);

-- Update existing challenges with daily actions
UPDATE challenges SET daily_action = 'Drink 8 glasses of water' WHERE id = 1;
UPDATE challenges SET daily_action = 'Meditate for 10 minutes' WHERE id = 2;
UPDATE challenges SET daily_action = 'Read for 30 minutes' WHERE id = 3;
UPDATE challenges SET daily_action = 'Exercise for 30 minutes' WHERE id = 4;

-- Verify the update
SELECT id, title, daily_action FROM challenges;
