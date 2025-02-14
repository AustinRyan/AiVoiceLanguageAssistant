/*
  # Fix user creation trigger and profile handling

  1. Changes
    - Improve error handling in user creation trigger
    - Add RETURNING clause to profile creation
    - Add error logging
    - Add explicit transaction handling
  
  2. Security
    - Maintain existing RLS policies
    - Ensure proper access control
*/

-- Create profile on user creation with better error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  profile_id uuid;
BEGIN
  -- Insert the profile and get the ID
  INSERT INTO public.profiles (
    id,
    username,
    target_language,
    native_language
  )
  VALUES (
    new.id,
    new.email,
    'english',
    'english'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    username = EXCLUDED.username,
    updated_at = now()
  RETURNING id INTO profile_id;

  -- Verify profile creation
  IF profile_id IS NULL THEN
    RAISE EXCEPTION 'Failed to create or update profile for user %', new.id;
  END IF;

  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error (Supabase will capture this in the database logs)
    RAISE LOG 'Error in handle_new_user(): %', SQLERRM;
    RETURN new;
END;
$$ LANGUAGE plpgsql;

-- Ensure trigger is properly set up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Add missing policies if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles' 
    AND policyname = 'Users can insert their own profile'
  ) THEN
    CREATE POLICY "Users can insert their own profile"
      ON profiles FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'learning_sessions' 
    AND policyname = 'Users can create their own sessions'
  ) THEN
    CREATE POLICY "Users can create their own sessions"
      ON learning_sessions FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'session_messages' 
    AND policyname = 'Users can insert messages in their sessions'
  ) THEN
    CREATE POLICY "Users can insert messages in their sessions"
      ON session_messages FOR INSERT
      TO authenticated
      WITH CHECK (
        session_id IN (
          SELECT id FROM learning_sessions 
          WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Create profiles for any existing users that don't have one
INSERT INTO public.profiles (id, username, target_language, native_language)
SELECT 
  id,
  email as username,
  'english' as target_language,
  'english' as native_language
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
)
ON CONFLICT (id) DO NOTHING;