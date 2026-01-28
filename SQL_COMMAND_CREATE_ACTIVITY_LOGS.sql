CREATE TABLE public.user_activity_logs (
    user_id uuid NOT NULL,
    last_active_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT user_activity_logs_pkey PRIMARY KEY (user_id),
    CONSTRAINT user_activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only update their own activity log
CREATE POLICY "Users can update their own activity log"
ON public.user_activity_logs
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Users can read all activity logs (for admin/reporting)
CREATE POLICY "Admins and Sales Persons can read all activity logs"
ON public.user_activity_logs
FOR SELECT
TO authenticated
USING (TRUE);