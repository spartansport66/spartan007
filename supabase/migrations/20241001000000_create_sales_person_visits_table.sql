-- This migration file was created to support the Daily Visit Report feature.

-- Drop existing table if it exists to ensure a clean creation (only safe if no data exists yet)
-- If the table already exists, this block will likely fail if the column is missing.
-- We will rely on the platform to handle the migration/creation correctly.

-- Create the sales_person_visits table
CREATE TABLE IF NOT EXISTS sales_person_visits (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    sales_person_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    dealer_id uuid REFERENCES dealers(id) ON DELETE CASCADE NOT NULL,
    visit_time timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    photo_url text,
    visit_status text,
    remarks text,
    next_visit_date date, -- Column for next planned visit date
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE IF EXISTS sales_person_visits ENABLE ROW LEVEL SECURITY;

-- Policy for Sales Person: Can insert their own visits
CREATE POLICY IF NOT EXISTS "Sales persons can insert their own visits"
ON sales_person_visits FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = sales_person_id);

-- Policy for Sales Person: Can select their own visits
CREATE POLICY IF NOT EXISTS "Sales persons can view their own visits"
ON sales_person_visits FOR SELECT
TO authenticated
USING (auth.uid() = sales_person_id);

-- Policy for Admin: Can select all visits
CREATE POLICY IF NOT EXISTS "Admins can view all visits"
ON sales_person_visits FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE public.profiles.id = auth.uid() AND public.profiles.is_admin = TRUE
  )
);