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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { showSuccess, showError } from '@/utils/toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { Label } from '@/components/ui/label';

const formSchema = z.object({
  platform_order_number: z.string().min(1, "Order Number is required."),
  customer_name: z.string().min(1, "Customer Name is required."),
  shipping_address: z.string().optional(),
  item_name: z.string().min(1, "Item Name is required."),
  amount: z.preprocess(
    (val) => Number(String(val).replace(/[^0-9.-]+/g, "")),
    z.number().min(0, "Amount cannot be negative.")
  ),
});

interface Platform {
  id: string;
  name: string;
}

const ManualOrderEntry = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading: sessionLoading } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [selectedPlatformId, setSelectedPlatformId] = useState<string>("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      platform_order_number: '',
      customer_name: '',
      shipping_address: '',
      item_name: '',
      amount: 0,
    },
  });

  useEffect(() => {
    if (!sessionLoading && !isAdmin) {
      showError("Access Denied.");
      navigate('/dashboard');
    }
  }, [sessionLoading, isAdmin, navigate]);

  const fetchPlatforms = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('online_platforms').select('*').order('name');
      if (error) throw error;
      setPlatforms(data || []);
    } catch (error: any) {
      showError(`Failed to load platforms: ${error.message}`);
    }
  }, []);

  useEffect(() => {
    fetchPlatforms();
  }, [fetchPlatforms]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      showError("You must be logged in.");
      return;
    }
    if (!selectedPlatformId) {
      showError("Please select a platform.");
      return;
    }

    setIsSubmitting(true);
    try {
      const stagingData = {
        platform_order_number: values.platform_order_number,
        customer_name: values.customer_name,
        shipping_address: values.shipping_address,
        flipkart_item_name: values.item_name, // Using the existing column
        amount: values.amount,
        created_by: user.id,
        status: 'pending'
      };

      const { error } = await supabase
        .from('online_order_staging')
        .upsert(stagingData, { onConflict: 'platform_order_number' });

      if (error) throw error;

      showSuccess(`Order #${values.platform_order_number} saved to staging area.`);
      form.reset();
      // Don't navigate away, allow for multiple entries.
    } catch (error: any) {
      showError(`Failed to save to staging: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-2xl">
        <Button variant="outline" onClick={() => navigate('/online-order-dispatch-dashboard')} className="mb-6 flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Online Order Dashboard
        </Button>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Manual Online Order Entry</CardTitle>
            <CardDescription>
              Manually enter order details from a PDF or other source to add it to the staging area for processing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-2">
                  <Label>Platform</Label>
                  <Select value={selectedPlatformId} onValueChange={setSelectedPlatformId}>
                    <SelectTrigger><SelectValue placeholder="Select Platform" /></SelectTrigger>
                    <SelectContent>
                      {platforms.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <FormField control={form.control} name="platform_order_number" render={({ field }) => (<FormItem><FormLabel>Platform Order Number</FormLabel><FormControl><Input placeholder="e.g., OD123456789" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="customer_name" render={({ field }) => (<FormItem><FormLabel>Customer Name</FormLabel><FormControl><Input placeholder="John Doe" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="shipping_address" render={({ field }) => (<FormItem><FormLabel>Shipping Address (Optional)</FormLabel><FormControl><Textarea placeholder="123 Main St, Anytown, USA" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="item_name" render={({ field }) => (<FormItem><FormLabel>Item Name / Description</FormLabel><FormControl><Input placeholder="Product Name from Invoice" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="amount" render={({ field }) => (<FormItem><FormLabel>Total Amount (₹)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="199.99" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save to Staging
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

export default ManualOrderEntry;