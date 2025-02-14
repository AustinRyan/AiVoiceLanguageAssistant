/*
  # Initial Schema for Language Learning Platform

  1. New Tables
    - `profiles`
      - `id` (uuid, primary key) - References auth.users
      - `username` (text)
      - `language_level` (text)
      - `target_language` (text)
      - `native_language` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `learning_sessions`
      - `id` (uuid, primary key)
      - `user_id` (uuid) - References profiles
      - `session_type` (text)
      - `start_time` (timestamp)
      - `end_time` (timestamp)
      - `language` (text)
      - `summary` (text)
      
    - `session_messages`
      - `id` (uuid, primary key)
      - `session_id` (uuid) - References learning_sessions
      - `content` (text)
      - `role` (text)
      - `created_at` (timestamp)
      - `type` (text)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
*/

-- Create profiles table
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users,
  username text UNIQUE,
  language_level text,
  target_language text NOT NULL,
  native_language text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create learning_sessions table
CREATE TABLE learning_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) NOT NULL,
  session_type text NOT NULL,
  start_time timestamptz DEFAULT now(),
  end_time timestamptz,
  language text NOT NULL,
  summary text,
  created_at timestamptz DEFAULT now()
);

-- Create session_messages table
CREATE TABLE session_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES learning_sessions(id) NOT NULL,
  content text NOT NULL,
  role text NOT NULL,
  type text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_messages ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Learning sessions policies
CREATE POLICY "Users can view own sessions"
  ON learning_sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own sessions"
  ON learning_sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own sessions"
  ON learning_sessions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Session messages policies
CREATE POLICY "Users can view messages from own sessions"
  ON session_messages FOR SELECT
  TO authenticated
  USING (
    session_id IN (
      SELECT id FROM learning_sessions 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages in own sessions"
  ON session_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    session_id IN (
      SELECT id FROM learning_sessions 
      WHERE user_id = auth.uid()
    )
  );