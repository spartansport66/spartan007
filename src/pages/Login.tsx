"use client";

import { supabase } from '@/integrations/supabase/client';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useNavigate, Link } from 'react-router-dom';
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

const loginFormSchema = z.object({
  identifier: z.string().min(1, { message: 'Email or Name is required.' }),
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
      let emailToLoginWith = values.identifier;

      if (!values.identifier.includes('@')) {
        const response = await fetch(RESOLVE_USER_IDENTIFIER_EDGE_FUNCTION_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: values.identifier }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to resolve user identifier.');
        emailToLoginWith = data.email;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailToLoginWith,
        password: values.password,
      });

      if (error) {
        await supabase.from('login_logs').insert({
          user_id: (data as any)?.user?.id || '00000000-0000-0000-0000-000000000000',
          success: false,
        });
        throw error;
      }
      
      if (data.user) {
        await supabase.from('login_logs').insert({ user_id: data.user.id, success: true });
      }

      showSuccess('Logged in successfully!');
      navigate('/');
    } catch (error: any) {
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
        <h1 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-6">Login</h1>
        <Card className="bg-card text-card-foreground shadow-lg border-none">
          <CardContent className="pt-6">
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                <FormField control={loginForm.control} name="identifier" render={({ field }) => (<FormItem><FormLabel>Email or Name</FormLabel><FormControl><Input placeholder="john.doe@example.com or John Doe" {...field} /></FormControl><FormMessage /></FormItem>)} />
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
            <div className="mt-4 text-center text-sm">
              <Link to="/forgot-password" className="font-medium text-primary hover:underline">
                Forgot your password?
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default Login;