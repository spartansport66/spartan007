"use client";

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2, Lock } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { MadeWithDyad } from '@/components/made-with-dyad';

// IMPORTANT: Replace with the actual URL of your deployed Edge Function
const UPDATE_USER_EDGE_FUNCTION_URL = "https://hxftiocfihhdutciaisl.supabase.co/functions/v1/update-user";

const formSchema = z.object({
  newPassword: z.string().min(6, { message: 'New password must be at least 6 characters.' }),
  confirmPassword: z.string().min(6, { message: 'Confirm password must be at least 6 characters.' }),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match.",
  path: ["confirmPassword"],
});

const ForcePasswordReset: React.FC = () => {
  const navigate = useNavigate();
  const { user, session, loading: sessionLoading, mustResetPassword } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user || !session) {
      showError('You must be logged in to change your password.');
      navigate('/login');
      return;
    }

    setIsSubmitting(true);
    try {
      // Use the Edge Function to update the password and clear the must_reset_password flag
      const response = await fetch(UPDATE_USER_EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`, // Authenticate with the user's session
        },
        body: JSON.stringify({
          userId: user.id,
          password: values.newPassword,
          must_reset_password: false, // Clear the flag after successful password change
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update password');
      }

      showSuccess('Password updated successfully! You can now proceed to your dashboard.');
      navigate('/dashboard'); // Redirect to dashboard after password change
    } catch (error: any) {
      console.error('Error updating password:', error);
      showError(`Failed to update password: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading...</p>
      </div>
    );
  }

  // If user is not logged in, or doesn't need to reset password, redirect
  if (!user || !mustResetPassword) {
    navigate('/'); // Go to index which will handle further redirection
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md">
        <Card className="bg-card text-card-foreground shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-primary flex items-center gap-2">
              <Lock className="h-6 w-6" /> Set New Password
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              For security, please set a new password to continue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Enter your new password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Confirm your new password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    'Set Password'
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

export default ForcePasswordReset;