-- Create sales_person_visits table
CREATE TABLE public.sales_person_visits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_person_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    dealer_id uuid REFERENCES public.dealers(id) ON DELETE CASCADE NOT NULL,
    visit_time timestamp with time zone DEFAULT now() NOT NULL,
    photo_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.sales_person_visits ENABLE ROW LEVEL SECURITY;

-- Policy for Sales Persons: Can insert/read their own visits
CREATE POLICY "Sales persons can manage their own visits"
ON public.sales_person_visits FOR ALL
TO authenticated
USING (auth.uid() = sales_person_id)
WITH CHECK (auth.uid() = sales_person_id);

-- Policy for Admins: Can read all visits
CREATE POLICY "Admins can view all visits"
ON public.sales_person_visits FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE
    )
);

-- Create Storage Bucket for Visit Photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('visit-photos', 'visit-photos', TRUE)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for Storage Bucket
-- Allow authenticated users to upload/read/delete their own photos
CREATE POLICY "Allow authenticated users to manage their own visit photos"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'visit-photos' AND auth.uid() = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'visit-photos' AND auth.uid() = (storage.foldername(name))[1]);

-- Allow admins to read all photos (optional, but useful for reports)
CREATE POLICY "Admins can view all visit photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'visit-photos' AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE));