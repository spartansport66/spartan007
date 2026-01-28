-- Insert dummy user (if not exists)
INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', 'dummy@example.com', 'dummy_password', now(), now())
ON CONFLICT (id) DO NOTHING;

-- Insert dummy profile (if not exists)
INSERT INTO public.profiles (id, first_name, last_name, user_type, is_admin)
VALUES ('00000000-0000-0000-0000-000000000000', 'Dummy', 'User', 'admin', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Insert dummy dealer (if not exists)
INSERT INTO public.dealers (id, name, phone, address, city, state, country, credit_limit, allotted_credit_days, user_id)
VALUES ('00000000-0000-0000-0000-000000000000', 'Dummy Dealer', '0000000000', 'N/A', 'N/A', 'N/A', 'N/A', 0, 0, '00000000-0000-0000-0000-000000000000')
ON CONFLICT (id) DO NOTHING;