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
import { Loader2, Eye, EyeOff } from 'lucide-react';

const RESOLVE_USER_IDENTIFIER_EDGE_FUNCTION_URL = "https://hxftiocfihhdutciaisl.supabase.co/functions/v1/resolve-user-identifier";
const DEFAULT_EMAIL_DOMAIN = '@ss.com';

const loginFormSchema = z.object({
  identifier: z.string().min(1, { message: 'User ID is required.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

const Login = () => {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const loginForm = useForm<z.infer<typeof loginFormSchema>>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      identifier: '',
      password: '',
    },
  });

  useEffect(() => {
    if (!loading && session) {
      navigate('/');
    }
  }, [session, loading, navigate]);

  const onLoginSubmit = async (values: z.infer<typeof loginFormSchema>) => {
    setIsSubmitting(true);
    try {
      console.log('Login form values:', values);

      if (!values.identifier) throw new Error('Identifier is required.');

      // If the identifier contains an '@', treat it as an email; otherwise append default domain.
      const rawId = values.identifier.trim();
      let emailToLoginWith = '';
      if (rawId.includes('@')) {
        emailToLoginWith = rawId.toLowerCase();
      } else {
        emailToLoginWith = `${rawId.toLowerCase()}${DEFAULT_EMAIL_DOMAIN}`;
      }

      console.log('Attempting login with computed email:', { email: emailToLoginWith });

      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailToLoginWith,
        password: values.password,
      });

      if (error) {
        console.error('Login error:', error, { authData: data });
        if (error.message && error.message.toLowerCase().includes('invalid')) {
          showError('Invalid user id or password.');
        } else {
          showError('Login failed. Try again later.');
        }

        // Only insert into `login_logs` if we have a valid user_id (table requires it).
        try {
          const userId = (data as any)?.user?.id;
          if (userId) {
            const payload: any = { user_id: userId, success: false };
            const { data: logData, error: logError } = await supabase.from('login_logs').insert(payload);
            if (logError) console.error('Failed to insert login_logs (error path):', logError, { payload, logData });
          } else {
            console.warn('Skipping login_logs insert: no user_id available for failed login attempt.');
          }
        } catch (e) {
          console.error('Exception while inserting login_logs (error path):', e);
        }

        return;
      }

      if (data.user) {
        try {
          const { data: logData, error: logError } = await supabase.from('login_logs').insert({ user_id: data.user.id, success: true });
          if (logError) console.error('Failed to insert login_logs (success path):', logError, { userId: data.user.id, logData });
        } catch (e) {
          console.error('Exception while inserting login_logs (success path):', e);
        }
      }

      showSuccess('Logged in successfully!');
      navigate('/');
    } catch (err: any) {
      console.error('onLoginSubmit error:', err);
      showError(err?.message || 'Login error');
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
        <h1 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-6">Login</h1>
        <Card className="bg-card text-card-foreground shadow-lg border-none">
          <CardContent className="pt-6">
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                <FormField control={loginForm.control} name="identifier" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username or Email</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter username (e.g., kunal) — '@ss.com' will be appended" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={loginForm.control} name="password" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input type={showPassword ? "text" : "password"} placeholder="********" {...field} />
                        <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)}>
                          {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Sign In'}</Button>
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