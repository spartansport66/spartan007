"use server";

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';

const CreateUserSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().optional(),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
  role: z.enum(['sales_person', 'admin', 'gate_keeper', 'inventory_manager', 'super_admin', 'manager']),
});

export async function createUser(prevState: any, formData: FormData) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const validatedFields = CreateUserSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!validatedFields.success) {
    return {
      message: "Invalid form data.",
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { first_name, last_name, email, password, role } = validatedFields.data;

  // Create the user in Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirm the email
  });

  if (authError) {
    console.error("Error creating auth user:", authError.message);
    return { message: `Error creating user: ${authError.message}` };
  }

  const user = authData.user;
  if (!user) {
    return { message: "User could not be created." };
  }

  // Insert the user profile into the 'profiles' table
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      first_name,
      last_name,
      role,
    });

  if (profileError) {
    console.error("Error creating profile:", profileError.message);
    // If profile creation fails, we should probably delete the auth user
    // to avoid orphaned users. This is a critical step for data integrity.
    await supabase.auth.admin.deleteUser(user.id);
    return { message: `Error creating profile: ${profileError.message}` };
  }

  return { message: "User created successfully!" };
}