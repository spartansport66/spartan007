-- Create the new ENUM type with all required roles
CREATE TYPE "public"."user_role" AS ENUM ('admin', 'sales_person', 'dealer', 'sales_head');

-- Alter the 'users' table to use the new ENUM type
-- It's temporarily cast to text to allow for the type change
ALTER TABLE "public"."users"
ALTER COLUMN "role" TYPE "public"."user_role"
USING "role"::text::"public"."user_role";

-- Alter the 'invites' table to use the new ENUM type
ALTER TABLE "public"."invites"
ALTER COLUMN "role" TYPE "public"."user_role"
USING "role"::text::"public"."user_role";