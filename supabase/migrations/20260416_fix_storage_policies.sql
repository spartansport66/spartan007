-- Fix RLS policies for documents storage bucket
-- Allow public access to read documents
-- Allow authenticated users to upload with proper permissions

-- Drop existing policies
DROP POLICY IF EXISTS "Public access to documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update documents" ON storage.objects;

-- Policy 1: Allow public read access
CREATE POLICY "Public read access to documents"
ON storage.objects
FOR SELECT
USING (bucket_id = 'documents');

-- Policy 2: Allow admin/billing to insert
CREATE POLICY "Admin and billing users can upload to documents"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'documents'
  AND (auth.jwt() -> 'user_metadata' ->> 'user_type' IN ('admin', 'super_admin', 'billing') 
       OR (SELECT user_type FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'super_admin', 'billing'))
);

-- Policy 3: Allow admin/billing to update
CREATE POLICY "Admin and billing users can update documents"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'documents')
WITH CHECK (
  bucket_id = 'documents'
  AND (auth.jwt() -> 'user_metadata' ->> 'user_type' IN ('admin', 'super_admin', 'billing')
       OR (SELECT user_type FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'super_admin', 'billing'))
);

-- Policy 4: Allow admin/billing to delete
CREATE POLICY "Admin and billing users can delete documents"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'documents'
  AND (auth.jwt() -> 'user_metadata' ->> 'user_type' IN ('admin', 'super_admin', 'billing')
       OR (SELECT user_type FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'super_admin', 'billing'))
);
