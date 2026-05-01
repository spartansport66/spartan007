"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { showError, showSuccess } from '@/utils/toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Loader2, Plus, Edit, Trash2, ArrowLeft, Check, X, Upload } from 'lucide-react';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';

interface Company {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postal_code: string | null;
  gst_number: string | null;
  eway_api_key: string | null;
  contact_number: string;
  email: string;
  website: string | null;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
}

const companySchema = z.object({
  name: z.string().min(2, { message: 'Company name must be at least 2 characters.' }),
  address: z.string().min(5, { message: 'Address must be at least 5 characters.' }),
  city: z.string().min(2, { message: 'City must be at least 2 characters.' }),
  state: z.string().min(2, { message: 'State must be at least 2 characters.' }),
  country: z.string().min(2, { message: 'Country must be at least 2 characters.' }),
  postalCode: z.string().optional().nullable(),
  gstNumber: z.string().refine(
    (val) => !val || /^[A-Z0-9]{15}$/.test(val),
    { message: 'GST number must be exactly 15 alphanumeric characters' }
  ).optional().nullable(),
  contactNumber: z.string().min(10, { message: 'Contact number must be at least 10 digits.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  website: z.string().optional().nullable(),
  ewayApiKey: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

const ManageCompanies = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, isAdmin } = useSession();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const form = useForm<z.infer<typeof companySchema>>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: '',
      address: '',
      city: '',
      state: '',
      country: 'India',
      postalCode: '',
      gstNumber: '',
      contactNumber: '',
      email: '',
      website: '',
      ewayApiKey: '',
      logoUrl: null,
      isActive: true,
    },
  });

  // Check authorization
  useEffect(() => {
    if (!sessionLoading && !isAdmin) {
      showError('You do not have permission to access this page');
      navigate('/dashboard');
    }
  }, [sessionLoading, isAdmin, navigate]);

  // Fetch companies
  const fetchCompanies = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setCompanies(data || []);
    } catch (err) {
      console.error('Error fetching companies:', err);
      showError('Failed to load companies');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  // Handle add/edit
  const handleAddNew = () => {
    setSelectedCompany(null);
    setLogoPreview(null);
    form.reset();
    setIsDialogOpen(true);
  };

  const handleEdit = (company: Company) => {
    setSelectedCompany(company);
    setLogoPreview(company.logo_url);
    form.reset({
      name: company.name,
      address: company.address,
      city: company.city,
      state: company.state,
      country: company.country,
      postalCode: company.postal_code,
      gstNumber: company.gst_number,
      contactNumber: company.contact_number,
      email: company.email,
      website: company.website,
      ewayApiKey: company.eway_api_key || '',
      logoUrl: company.logo_url,
      isActive: company.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showError('Please upload a valid image file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showError('Logo file size must be less than 2MB.');
      return;
    }

    setUploading(true);
    try {
      const fileName = `company_logos/${Date.now()}_${file.name}`;
      
      const { data, error } = await supabase.storage
        .from('documents')
        .upload(fileName, file, { upsert: false });

      if (error) throw error;

      const { data: publicUrlData } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

      const logoUrl = publicUrlData.publicUrl;
      setLogoPreview(logoUrl);
      form.setValue('logoUrl', logoUrl);
      showSuccess('Logo uploaded successfully!');
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      showError(`Failed to upload logo: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (values: z.infer<typeof companySchema>) => {
    setIsSubmitting(true);
    try {
      const payload = {
        name: values.name,
        address: values.address,
        city: values.city,
        state: values.state,
        country: values.country,
        postal_code: values.postalCode || null,
        gst_number: values.gstNumber ? values.gstNumber.toUpperCase() : null,
        eway_api_key: values.ewayApiKey || null,
        contact_number: values.contactNumber,
        email: values.email,
        website: values.website || null,
        logo_url: values.logoUrl || null,
        is_active: values.isActive,
      };

      const savePayload = async (payloadToSave: any) => {
        if (selectedCompany) {
          return supabase.from('companies').update(payloadToSave).eq('id', selectedCompany.id);
        }
        return supabase.from('companies').insert([payloadToSave]);
      };

      let result = await savePayload(payload);
      if (result.error && result.error.message?.includes('eway_api_key')) {
        const { error: fallbackError } = await savePayload({ ...payload, eway_api_key: undefined });
        if (fallbackError) throw fallbackError;
        result = { error: null, data: null } as any;
      }

      if (result.error) {
        throw result.error;
      }

      showSuccess(selectedCompany ? 'Company updated successfully' : 'Company added successfully');
      setIsDialogOpen(false);
      fetchCompanies();
    } catch (err: any) {
      console.error('Error saving company:', err);
      showError(err.message || 'Failed to save company');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      showSuccess('Company deleted successfully');
      fetchCompanies();
    } catch (err: any) {
      console.error('Error deleting company:', err);
      showError('Failed to delete company');
    }
  };

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Button
              variant="ghost"
              onClick={() => navigate('/admin-dashboard')}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-3xl font-bold">Company Information</h1>
            <p className="text-gray-500">Manage multiple companies for billing and accounting</p>
          </div>
          <Button onClick={handleAddNew} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Company
          </Button>
        </div>

        {/* Companies Table */}
        <Card>
          <CardHeader>
            <CardTitle>Companies ({companies.length})</CardTitle>
            <CardDescription>List of all registered companies</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin h-8 w-8" />
              </div>
            ) : companies.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No companies found. Create your first company.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>GST Number</TableHead>
                      <TableHead>API Key</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companies.map((company) => (
                      <TableRow key={company.id}>
                        <TableCell className="font-semibold">{company.name}</TableCell>
                        <TableCell>{company.contact_number}</TableCell>
                        <TableCell>{company.email}</TableCell>
                        <TableCell>{company.gst_number || '-'}</TableCell>
                        <TableCell className="font-mono text-xs">{company.eway_api_key || '-'}</TableCell>
                        <TableCell>{company.city}</TableCell>
                        <TableCell>
                          {company.is_active ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <X className="h-4 w-4 text-red-600" />
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(company)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Company</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{company.name}"? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(company.id)}>
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedCompany ? 'Edit Company' : 'Add New Company'}</DialogTitle>
              <DialogDescription>
                {selectedCompany ? 'Update company details' : 'Enter company information for billing and accounting'}
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="ABC Company Ltd." {...field} disabled={isSubmitting} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email *</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="company@example.com" {...field} disabled={isSubmitting} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Address *</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Complete address" {...field} disabled={isSubmitting} rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid grid-cols-3 gap-4">
                  <FormField control={form.control} name="city" render={({ field }) => (
                    <FormItem>
                      <FormLabel>City *</FormLabel>
                      <FormControl>
                        <Input placeholder="City" {...field} disabled={isSubmitting} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="state" render={({ field }) => (
                    <FormItem>
                      <FormLabel>State *</FormLabel>
                      <FormControl>
                        <Input placeholder="State" {...field} disabled={isSubmitting} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="country" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country *</FormLabel>
                      <FormControl>
                        <Input placeholder="Country" {...field} disabled={isSubmitting} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="contactNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Number *</FormLabel>
                      <FormControl>
                        <Input placeholder="+91-9999999999" {...field} disabled={isSubmitting} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="gstNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel>GST Number (15 characters)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="27AAFCU5055K1ZO"
                          maxLength={15}
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value)}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="postalCode" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postal Code</FormLabel>
                      <FormControl>
                        <Input placeholder="123456" {...field} value={field.value ?? ''} disabled={isSubmitting} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="website" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <FormControl>
                        <Input placeholder="www.example.com" {...field} value={field.value ?? ''} disabled={isSubmitting} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="ewayApiKey" render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-way API Key</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter E-way API key" {...field} value={field.value ?? ''} disabled={isSubmitting} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="isActive" render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                      disabled={isSubmitting}
                      className="h-4 w-4"
                    />
                    <FormLabel className="mb-0">Active</FormLabel>
                  </FormItem>
                )} />

                {/* Logo Upload Section */}
                <div className="border-t pt-4">
                  <div className="bg-blue-50 p-3 rounded space-y-2">
                    <Label className="text-sm font-semibold">📸 Company Logo</Label>
                    <p className="text-xs text-gray-600">Max 2MB - PNG/JPG</p>
                    
                    {logoPreview ? (
                      <div className="relative w-20 h-20 border-2 border-dashed border-gray-300 rounded p-1 bg-white">
                        <img src={logoPreview} alt="Company Logo" className="w-full h-full object-contain" />
                        <button
                          type="button"
                          onClick={() => { setLogoPreview(null); form.setValue('logoUrl', null); }}
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
                          disabled={uploading || isSubmitting}
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
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {selectedCompany ? 'Update' : 'Add'} Company
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <MadeWithDyad />
      </div>
    </div>
  );
};

export default ManageCompanies;
