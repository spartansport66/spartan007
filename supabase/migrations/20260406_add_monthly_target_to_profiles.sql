-- Add monthly_target column to profiles table
-- This column stores each sales person's monthly sales target

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS monthly_target NUMERIC DEFAULT 0;

-- Create an index for better query performance when filtering by monthly_target
CREATE INDEX IF NOT EXISTS idx_profiles_monthly_target ON public.profiles(monthly_target);
