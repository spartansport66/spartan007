"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';

interface CompanyInfo {
  id?: string; // Optional for new entry
  company_name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  email: string;
  phone: string;
}

interface CompanyInfoDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCompanyInfoUpdated: () => void; // Callback to refresh parent data
}

const formSchema = z.object({
  companyName: z.string().min(1, { message: 'Company name is required.' }),
  address: z.string().min(5, { message: 'Address must be at least 5 characters.' }),
  city: z.string().min(2, { message: 'City is required.' }),
  state: z.string().min(2, { message: 'State is required.' }),
  country: z.string().min(2, { message: 'Country is required.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  phone: z.string().min(10, { message: 'Phone number must be at least 10 digits.' }).max(15, { message: 'Phone number cannot exceed 15 digits.' }),
});

const CompanyInfoDialog: React.FC<CompanyInfoDialogProps> = ({ isOpen, onOpenChange, onCompanyInfoUpdated }) => {
  const [loading, setLoading] = useState(true);
  const [companyInfoId, setCompanyInfoId] = useState<string | null>(null); // To store the ID if company info exists

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      companyName: '',
      address: '',
      city: '',
      state: '',
      country: '',
      email: '',
      phone: '',
    },
  });

  const fetchCompanyInfo = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('company_info')
        .select('*')
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 means "no rows found"
        throw error;
      }

      if (data) {
        setCompanyInfoId(data.id);
        form.reset({
          companyName: data.company_name,
          address: data.address,
          city: data.city,
          state: data.state,
          country: data.country,
          email: data.email,
          phone: data.phone,
        });
      } else {
        setCompanyInfoId(null);
        form.reset(); // Clear form if no data found
      }
    } catch (error: any) {
      console.error('Error fetching company info:', error.message);
      showError('Failed to load company information.');
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    if (isOpen) {
      fetchCompanyInfo();
    }
  }, [isOpen, fetchCompanyInfo]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setLoading(true);
    try {
      if (companyInfoId) {
        // Update existing company info
        const { error } = await supabase
          .from('company_info')
          .update({
            company_name: values.companyName,
            address: values.address,
            city: values.city,
            state: values.state,
            country: values.country,
            email: values.email,
            phone: values.phone,
            updated_at: new Date().toISOString(),
          })
          .eq('id', companyInfoId);

        if (error) throw error;
        showSuccess('Company information updated successfully!');
      } else {
        // Insert new company info
        const { error } = await supabase
          .from('company_info')
          .insert({
            company_name: values.companyName,
            address: values.address,
            city: values.city,
            state: values.state,
            country: values.country,
            email: values.email,
            phone: values.phone,
          });

        if (error) throw error;
        showSuccess('Company information saved successfully!');
      }
      onCompanyInfoUpdated(); // Notify parent to refresh company name
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving company info:', error.message);
      showError(`Failed to save company information: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{companyInfoId ? 'Edit Company Information' : 'Add Company Information'}</DialogTitle>
          <DialogDescription>
            {companyInfoId ? 'Update your company details here.' : 'Enter your company details to get started.'}
          </DialogDescription>
        </DialogHeader>
        {loading && !companyInfoId ? ( // Show loader only on initial fetch if no ID exists
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading company info...</p>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <Label htmlFor="companyName">Company Name</Label>
                    <FormControl>
                      <Input id="companyName" placeholder="e.g., Global Sales Corp" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <Label htmlFor="address">Address</Label>
                    <FormControl>
                      <Textarea id="address" placeholder="e.g., 123 Business Park, Industrial Area" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <Label htmlFor="city">City</Label>
                      <FormControl>
                        <Input id="city" placeholder="e.g., Metropolis" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <Label htmlFor="state">State</Label>
                      <FormControl>
                        <Input id="state" placeholder="e.g., Stateville" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <Label htmlFor="country">Country</Label>
                    <FormControl>
                      <Input id="country" placeholder="e.g., Countryland" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <Label htmlFor="email">Email ID</Label>
                    <FormControl>
                      <Input id="email" type="email" placeholder="e.g., info@globalsales.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <Label htmlFor="phone">Contact Number</Label>
                    <FormControl>
                      <Input id="phone" type="tel" placeholder="e.g., +1234567890" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save Information'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CompanyInfoDialog;