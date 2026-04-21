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
import { Loader2, Upload, X } from 'lucide-react';
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
  logo_url: string | null;
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
  logoUrl: z.string().optional().nullable(),
});

const CompanyInfoDialog: React.FC<CompanyInfoDialogProps> = ({ isOpen, onOpenChange, onCompanyInfoUpdated }) => {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [companyInfoId, setCompanyInfoId] = useState<string | null>(null); // To store the ID if company info exists
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

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
      logoUrl: null,
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
        setLogoPreview(data.logo_url);
        form.reset({
          companyName: data.company_name,
          address: data.address,
          city: data.city,
          state: data.state,
          country: data.country,
          email: data.email,
          phone: data.phone,
          logoUrl: data.logo_url,
        });
      } else {
        setCompanyInfoId(null);
        setLogoPreview(null);
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

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      showError('Please upload a valid image file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) { // 2MB limit
      showError('Logo file size must be less than 2MB.');
      return;
    }

    setUploading(true);
    try {
      const fileName = `company_logos/${Date.now()}_${file.name}`;
      
      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from('documents') // You may need to create this bucket if it doesn't exist
        .upload(fileName, file, { upsert: false });

      if (error) throw error;

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

      const logoUrl = publicUrlData.publicUrl;
      setLogoPreview(logoUrl);
      form.setValue('logoUrl', logoUrl);
      showSuccess('Logo uploaded successfully!');
    } catch (error: any) {
      console.error('Error uploading logo:', error.message);
      showError(`Failed to upload logo: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = () => {
    setLogoPreview(null);
    form.setValue('logoUrl', null);
    showSuccess('Logo removed.');
  };

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
            logo_url: values.logoUrl || null,
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
            logo_url: values.logoUrl || null,
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
      <DialogContent className="sm:max-w-[700px] max-h-[95vh]">
        <DialogHeader className="py-2">
          <DialogTitle>{companyInfoId ? 'Edit Company Information' : 'Add Company Information'}</DialogTitle>
          <DialogDescription className="text-xs">
            {companyInfoId ? 'Update your company details here.' : 'Enter your company details to get started.'}
          </DialogDescription>
        </DialogHeader>
        {loading && !companyInfoId ? ( // Show loader only on initial fetch if no ID exists
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading company info...</p>
          </div>
        ) : (
          <div className="overflow-y-auto max-h-[calc(95vh-140px)] border rounded p-3 bg-gray-50">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3 py-2">
                <FormField
                  control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <Label htmlFor="companyName" className="text-xs">Company Name</Label>
                    <FormControl>
                      <Input id="companyName" placeholder="Spartan Sports" {...field} className="text-xs h-8" />
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
                    <Label htmlFor="address" className="text-xs">Address</Label>
                    <FormControl>
                      <Textarea id="address" placeholder="e.g., 123 Business Park" {...field} className="min-h-[60px] text-xs" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-3 gap-2">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <Label htmlFor="city" className="text-xs">City</Label>
                      <FormControl>
                        <Input id="city" placeholder="City" {...field} className="text-xs h-8" />
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
                      <Label htmlFor="state" className="text-xs">State</Label>
                      <FormControl>
                        <Input id="state" placeholder="State" {...field} className="text-xs h-8" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <Label htmlFor="country" className="text-xs">Country</Label>
                      <FormControl>
                        <Input id="country" placeholder="Country" {...field} className="text-xs h-8" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <Label htmlFor="email" className="text-xs">Email</Label>
                      <FormControl>
                        <Input id="email" type="email" placeholder="email@example.com" {...field} className="text-xs h-8" />
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
                      <Label htmlFor="phone" className="text-xs">Phone</Label>
                      <FormControl>
                        <Input id="phone" type="tel" placeholder="+91..." {...field} className="text-xs h-8" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {/* Logo Upload Section */}
              <div className="border-t pt-3 space-y-2 bg-blue-50 p-3 rounded">
                <Label className="text-sm font-semibold">📸 Company Logo</Label>
                <p className="text-xs text-gray-600">Max 2MB - PNG/JPG</p>
                
                {logoPreview ? (
                  <div className="relative w-24 h-24 border-2 border-dashed border-gray-300 rounded p-1 bg-white">
                    <img src={logoPreview} alt="Company Logo" className="w-full h-full object-contain" />
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label htmlFor="logo-upload" className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded cursor-pointer bg-white hover:bg-gray-50 transition text-xs">
                    <div className="flex flex-col items-center justify-center py-2">
                      <Upload className="h-5 w-5 text-gray-600 mb-1" />
                      <p className="font-semibold text-gray-900">Click to upload</p>
                    </div>
                    <input
                      id="logo-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={uploading}
                      className="hidden"
                    />
                  </label>
                )}
                {uploading && (
                  <div className="flex items-center gap-2 text-xs text-blue-600">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Uploading...
                  </div>
                )}
              </div>
            </form>
            </Form>
          </div>
        )}
        <DialogFooter className="pt-2 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} size="sm">
            Cancel
          </Button>
          <Button onClick={() => form.handleSubmit(onSubmit)()} disabled={loading || uploading} size="sm">
            {loading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : '💾'} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CompanyInfoDialog;