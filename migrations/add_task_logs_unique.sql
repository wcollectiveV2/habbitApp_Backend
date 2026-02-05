-- Add unique constraint for challenge_task_logs if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'challenge_task_logs_task_id_user_id_log_date_key'
    ) THEN
        ALTER TABLE challenge_task_logs 
        ADD CONSTRAINT challenge_task_logs_task_id_user_id_log_date_key 
        UNIQUE (task_id, user_id, log_date);
    END IF;
END $$;
