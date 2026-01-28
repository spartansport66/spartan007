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
import { Loader2, ArrowLeft, Lock } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { MadeWithDyad } from '@/components/made-with-dyad';

const formSchema = z.object({
  oldPassword: z.string().min(6, { message: 'Old password must be at least 6 characters.' }),
  newPassword: z.string().min(6, { message: 'New password must be at least 6 characters.' }),
  confirmPassword: z.string().min(6, { message: 'Confirm password must be at least 6 characters.' }),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "New passwords don't match.",
  path: ["confirmPassword"],
});

const ChangePassword: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, isAdmin } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      oldPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      showError('You must be logged in to change your password.');
      navigate('/login');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Re-authenticate the user with the old password
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user.email!, // User email is guaranteed to exist if logged in
        password: values.oldPassword,
      });

      if (reauthError) {
        // If re-authentication fails, the old password is wrong
        throw new Error('Incorrect old password provided.');
      }

      // 2. Update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: values.newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      showSuccess('Password updated successfully!');
      form.reset();
      navigate(isAdmin ? '/admin-dashboard' : '/dashboard');
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

  if (!user) {
    navigate('/login');
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md">
        <Button 
          variant="outline" 
          onClick={() => navigate(isAdmin ? '/admin-dashboard' : '/dashboard')} 
          className="mb-6 flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
        <Card className="bg-card text-card-foreground shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-primary flex items-center gap-2">
              <Lock className="h-6 w-6" /> Change Password
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Update your password by confirming your current one.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="oldPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Old Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Enter your old password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                    'Update Password'
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

export default ChangePassword;