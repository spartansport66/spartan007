-- Add TA field to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ta numeric DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_profiles_ta ON public.profiles (ta);
