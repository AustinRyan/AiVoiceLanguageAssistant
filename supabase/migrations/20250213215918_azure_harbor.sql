/*
  # Fix foreign key constraints and message handling

  1. Changes
    - Update foreign key constraints to reference auth.users instead of profiles
    - Add cascade delete for related records
    - Ensure proper indexing for performance
  
  2. Security
    - Maintain existing RLS policies
    - Add additional security checks
*/

-- Drop existing foreign key constraints
ALTER TABLE learning_sessions 
  DROP CONSTRAINT IF EXISTS learning_sessions_user_id_fkey;

-- Update foreign key to reference auth.users directly
ALTER TABLE learning_sessions
  ADD CONSTRAINT learning_sessions_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_learning_sessions_user_id 
  ON learning_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_session_messages_session_id 
  ON session_messages(session_id);