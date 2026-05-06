-- Add persistent block flag to sales person profiles

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;
