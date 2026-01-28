"use client";

import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useSession } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { showSuccess, showError } from '@/utils/toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2 } from 'lucide-react';

// IMPORTANT: Replace with the actual URL of your deployed Edge Function
const CREATE_USER_EDGE_FUNCTION_URL = "https://hxftiocfihhdutciaisl.supabase.co/functions/v1/create-user";
const RESOLVE_USER_IDENTIFIER_EDGE_FUNCTION_URL = "https://hxftiocfihhdutciaisl.supabase.co/functions/v1/resolve-user-identifier"; // New Edge Function URL

// The secret key known only to the admin
const ADMIN_SECRET_KEY_VALUE = "Param@1313";

const signupFormSchema = z.object({
  firstName: z.string().min(1, { message: 'First name is required.' }),
  lastName: z.string().optional(), // Made optional
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  userType: z.enum(['sales_person', 'admin'], { message: 'Please select a user type.' }),
  secretKey: z.string().optional(), // Optional secret key for admin creation
});

const loginFormSchema = z.object({
  identifier: z.string().min(1, { message: 'Email or Name is required.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

const Login = () => {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const signupForm = useForm<z.infer<typeof signupFormSchema>>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      userType: 'sales_person',
      secretKey: '',
    },
  });

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

  const onSignupSubmit = async (values: z.infer<typeof signupFormSchema>) => {
    setIsSubmitting(true);
    try {
      let finalUserType = values.userType;
      
      if (values.secretKey === ADMIN_SECRET_KEY_VALUE) {
        finalUserType = 'admin';
      } else if (values.userType === 'admin' && values.secretKey !== ADMIN_SECRET_KEY_VALUE) {
        showError('Invalid secret key for admin user type.');
        setIsSubmitting(false);
        return;
      }

      const response = await fetch(CREATE_USER_EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: values.email,
          password: values.password,
          first_name: values.firstName,
          last_name: values.lastName || null,
          user_type: finalUserType,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      showSuccess(`User ${values.email} created successfully as ${finalUserType}! Please sign in.`);
      signupForm.reset();
      setIsSigningUp(false); // Switch back to login form
    } catch (error: any) {
      console.error('Error creating user:', error);
      showError(`Failed to create user: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

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
        // Optional: Log login failure here if the table exists, but for now, we only log success.
        throw error;
      }
      
      // --- LOG SUCCESSFUL LOGIN ---
      if (data.user) {
        // Note: IP address logging is omitted as it requires server-side context.
        // We rely on the user's session being established here.
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
          {isSigningUp ? 'Sign Up' : 'Login'}
        </h1>
        
        {isSigningUp ? (
          <Card className="bg-card text-card-foreground shadow-lg border-none">
            <CardContent className="pt-6">
              <Form {...signupForm}>
                <form onSubmit={signupForm.handleSubmit(onSignupSubmit)} className="space-y-4">
                  <FormField
                    control={signupForm.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={signupForm.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={signupForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="john.doe@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={signupForm.control}
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
                  <FormField
                    control={signupForm.control}
                    name="userType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>User Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a user type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="sales_person">Sales Person</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={signupForm.control}
                    name="secretKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Admin Secret Key (Optional)</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Enter secret key for admin access" {...field} />
                        </FormControl>
                        <FormDescription>
                          Provide the secret key to register as an Admin. Otherwise, you will be a Sales Person.
                        </FormDescription>
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
                      'Sign Up'
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        ) : (
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
        )}
        
        <Button 
          variant="link" 
          onClick={() => setIsSigningUp(!isSigningUp)} 
          className="mt-4 w-full text-sm text-muted-foreground hover:text-primary"
        >
          {isSigningUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
        </Button>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default Login;