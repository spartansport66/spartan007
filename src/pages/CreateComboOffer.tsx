"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { showSuccess, showError } from '@/utils/toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { ArrowLeft, Loader2, Gift } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';

// Simplified form schema
const formSchema = z.object({
  offerName: z.string().min(1, { message: 'Offer name is required.' }),
  description: z.string().optional(),
});

const CreateComboOffer = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, isAdmin } = useSession();
  const [dataLoading, setDataLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      offerName: '',
      description: '',
    },
  });

  // No initial data fetching needed for products/dealers as they are removed from the form
  useEffect(() => {
    if (!sessionLoading) {
      if (!user) {
        navigate('/login');
      } else if (!isAdmin) {
        showError('Access Denied: Only administrators can create combo offers.');
        navigate('/dashboard');
      } else {
        setDataLoading(false); // Admin user, no further data to load for this page itself
      }
    }
  }, [sessionLoading, user, isAdmin, navigate]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      showError('You must be logged in to create a combo offer.');
      navigate('/login');
      return;
    }
    setIsSubmitting(true);

    try {
      // Create the combo offer with only name and description
      const { data: newOffer, error: offerError } = await supabase
        .from('combo_offers')
        .insert({
          name: values.offerName,
          description: values.description,
          // Removed discount_type, discount_value, start_date, end_date
          created_by: user.id,
        })
        .select()
        .single();

      if (offerError) throw offerError;

      // Removed product and dealer linking logic

      showSuccess('Combo offer created successfully!');
      form.reset();
      navigate('/combo-offers-dashboard'); // Redirect to dashboard after creation
    } catch (error: any) {
      console.error('Error creating combo offer:', error);
      showError(`Failed to create combo offer: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (sessionLoading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading data...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return null; // Should be redirected by useEffect
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-3xl">
        <Button variant="outline" onClick={() => navigate('/combo-offers-dashboard')} className="mb-6 flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Combo Offers Dashboard
        </Button>

        <Card className="bg-card text-card-foreground shadow-lg">
          <CardHeader className="bg-purple-600 dark:bg-purple-800 text-white rounded-t-lg p-4">
            <CardTitle className="text-2xl font-semibold flex items-center gap-2">
              <Gift className="h-6 w-6" /> Create Combo Offer
            </CardTitle>
            <CardDescription className="text-purple-100 dark:text-purple-200">
              Define a new combo offer with a name and optional description.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="offerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Offer Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Summer Sales Combo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="e.g., Special discount on selected products for summer." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    'Create Combo Offer'
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

export default CreateComboOffer;