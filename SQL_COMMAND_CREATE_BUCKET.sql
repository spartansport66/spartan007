-- 1. Create the storage bucket 'visit-photos'
INSERT INTO storage.buckets (id, name, public)
VALUES ('visit-photos', 'visit-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Enable RLS on the new bucket
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policy for SELECT (anyone can view if they have the URL)
CREATE POLICY "Allow public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'visit-photos');

-- 4. Create RLS policy for INSERT (only authenticated sales persons can upload)
CREATE POLICY "Allow authenticated sales persons to upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'visit-photos' AND
  auth.role() = 'authenticated' AND
  (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'sales_person'
);