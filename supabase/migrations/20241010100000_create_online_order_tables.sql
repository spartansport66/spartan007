-- 1. Create table for online platforms
CREATE TABLE public.online_platforms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable RLS and set policies for platforms
ALTER TABLE public.online_platforms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view platforms" ON public.online_platforms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage platforms" ON public.online_platforms FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 3. Create table for online order details
CREATE TABLE public.online_order_details (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    platform_id UUID NOT NULL REFERENCES public.online_platforms(id),
    client_name TEXT NOT NULL,
    platform_order_number TEXT,
    contact_no TEXT,
    city TEXT,
    state TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Enable RLS and set policies for online order details
ALTER TABLE public.online_order_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own online order details" ON public.online_order_details FOR ALL TO authenticated
USING (
    (SELECT user_id FROM public.orders WHERE id = order_id) = auth.uid()
)
WITH CHECK (
    (SELECT user_id FROM public.orders WHERE id = order_id) = auth.uid()
);
CREATE POLICY "Admins can manage all online order details" ON public.online_order_details FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());