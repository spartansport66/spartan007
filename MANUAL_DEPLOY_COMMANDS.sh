# 1. Log in to the Supabase CLI. This will open a browser window for you to authorize.
supabase login

# 2. After logging in, deploy the specific function.
# Make sure you are in the root directory of your project where the 'supabase' folder is located.
supabase functions deploy record-purchase --no-verify-jwt