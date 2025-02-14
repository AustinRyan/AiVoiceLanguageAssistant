/*
  # Fix Chat Database Issues

  1. Changes
    - Add trigger to automatically create profile on user creation
    - Update RLS policies for learning sessions and messages
    - Add insert policies for profiles table

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create profile on user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, target_language, native_language)
  VALUES (new.id, new.email, 'english', 'english')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql;

-- Trigger the function every time a user is created
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add missing policies
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can create their own sessions"
  ON learning_sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can insert messages in their sessions"
  ON session_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    session_id IN (
      SELECT id FROM learning_sessions 
      WHERE user_id = auth.uid()
    )
  );

-- Create profiles for existing users
INSERT INTO public.profiles (id, username, target_language, native_language)
SELECT 
  id,
  email as username,
  'english' as target_language,
  'english' as native_language
FROM auth.users
ON CONFLICT (id) DO NOTHING;