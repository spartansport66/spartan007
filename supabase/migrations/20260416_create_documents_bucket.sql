-- Create documents storage bucket for company logos and other files
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for documents bucket
CREATE POLICY "Public access to documents"
ON storage.objects
FOR SELECT
USING (bucket_id = 'documents');

CREATE POLICY "Authenticated users can upload documents"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'documents' 
  AND (SELECT user_type FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'super_admin', 'billing')
);

CREATE POLICY "Authenticated users can update documents"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'documents')
WITH CHECK (
  bucket_id = 'documents'
  AND (SELECT user_type FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'super_admin', 'billing')
);
