"use client";

import { supabase } from '@/integrations/supabase/client';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useSession } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { showError, showSuccess } from '@/utils/toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2 } from 'lucide-react';

// IMPORTANT: Replace with the actual URL of your deployed Edge Function
const RESOLVE_USER_IDENTIFIER_EDGE_FUNCTION_URL = "https://hxftiocfihhdutciaisl.supabase.co/functions/v1/resolve-user-identifier";

const loginFormSchema = z.object({
  identifier: z.string().min(1, { message: 'Email or Name is required.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

const Login = () => {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loginForm = useForm<z.infer<typeof loginFormSchema>>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      identifier: '',
      password: '',
    },
  });

  useEffect(() => {
    if (!loading && session) {
      // This redirect will now go to the root, which then handles role-based redirection
      navigate('/');
    }
  }, [session, loading, navigate]);

  const onLoginSubmit = async (values: z.infer<typeof loginFormSchema>) => {
    setIsSubmitting(true);
    try {
      let emailToLoginWith = values.identifier;

      // If the identifier is not an email, try to resolve it using the Edge Function
      if (!values.identifier.includes('@')) {
        const response = await fetch(RESOLVE_USER_IDENTIFIER_EDGE_FUNCTION_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ identifier: values.identifier }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to resolve user identifier.');
        }
        emailToLoginWith = data.email;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailToLoginWith,
        password: values.password,
      });

      if (error) {
        // Log login failure
        await supabase.from('login_logs').insert({
          user_id: data.user?.id || '00000000-0000-0000-0000-000000000000', // Use dummy ID if user object is null
          success: false,
        });
        throw error;
      }
      
      // --- LOG SUCCESSFUL LOGIN ---
      if (data.user) {
        await supabase.from('login_logs').insert({
          user_id: data.user.id,
          success: true,
        });
      }
      // --- END LOGGING ---

      showSuccess('Logged in successfully!');
      navigate('/'); // Redirect to index which handles role-based redirection
    } catch (error: any) {
      console.error('Error logging in:', error);
      showError(`Login failed: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
        <h1 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-6">
          Login
        </h1>
        
        <Card className="bg-card text-card-foreground shadow-lg border-none">
          <CardContent className="pt-6">
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                <FormField
                  control={loginForm.control}
                  name="identifier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email or Name</FormLabel>
                      <FormControl>
                        <Input placeholder="john.doe@example.com or John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={loginForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="********" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default Login;