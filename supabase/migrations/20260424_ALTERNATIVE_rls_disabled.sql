-- ALTERNATIVE: Credit Notes Migration WITH RLS DISABLED (for testing)
-- Use this if you encounter RLS permission issues
-- Run INSTEAD of the main migration if needed

-- ============================================================================
-- DISABLE RLS FOR TESTING (TEMPORARY)
-- ============================================================================
ALTER TABLE public.credit_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_note_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_note_applications DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- IF YOU WANT TO RE-ENABLE RLS, RUN THESE LATER
-- ============================================================================
-- ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.credit_note_items ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.credit_note_applications ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SIMPLE RLS POLICIES (if re-enabling later)
-- ============================================================================

-- Credit Notes - Allow authenticated users with admin role
-- CREATE POLICY "credit_notes_all_policy" ON public.credit_notes
--   FOR ALL USING (
--     (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'superadmin', 'billing_manager')
--   );

-- Credit Note Items - Allow authenticated users with admin role
-- CREATE POLICY "credit_note_items_all_policy" ON public.credit_note_items
--   FOR ALL USING (
--     (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'superadmin', 'billing_manager')
--   );

-- Credit Note Applications - Allow authenticated users with admin role
-- CREATE POLICY "credit_note_applications_all_policy" ON public.credit_note_applications
--   FOR ALL USING (
--     (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'superadmin', 'billing_manager')
--   );
