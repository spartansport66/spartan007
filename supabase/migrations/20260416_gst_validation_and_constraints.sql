-- Add constraint to ensure GST number is exactly 15 alphanumeric characters if provided
ALTER TABLE public.dealers
ADD CONSTRAINT gst_number_length_check 
CHECK (gst_number IS NULL OR (LENGTH(gst_number) = 15 AND gst_number ~ '^[A-Z0-9]{15}$'));

-- Update existing dealers with GST number to be registered
UPDATE public.dealers
SET gst_registration_type = 'registered'
WHERE gst_number IS NOT NULL AND gst_number != '';

-- Update all GST numbers to uppercase (in case any exist)
UPDATE public.dealers
SET gst_number = UPPER(gst_number)
WHERE gst_number IS NOT NULL;

-- Add comment about GST validation
COMMENT ON CONSTRAINT gst_number_length_check ON public.dealers 
IS 'Validates that GST number is exactly 15 alphanumeric characters (letters and digits) in combination';
