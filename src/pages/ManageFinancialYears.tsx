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
import { Loader2, Plus, Edit, Trash2, ArrowLeft, Check, X } from 'lucide-react';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';

interface Company {
  id: string;
  name: string;
}

interface FinancialYear {
  id: string;
  company_id: string;
  year_name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
}

interface FinancialYearWithCompany extends FinancialYear {
  companies: Company;
}

const financialYearSchema = z.object({
  companyId: z.string().min(1, { message: 'Please select a company.' }),
  yearName: z.string().min(2, { message: 'Year name must be at least 2 characters.' }),
  startDate: z.string().min(1, { message: 'Start date is required.' }),
  endDate: z.string().min(1, { message: 'End date is required.' }),
  isActive: z.boolean().default(true),
}).refine((data) => new Date(data.startDate) < new Date(data.endDate), {
  message: 'End date must be after start date.',
  path: ['endDate'],
});

const ManageFinancialYears = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, isAdmin } = useSession();
  const [financialYears, setFinancialYears] = useState<FinancialYearWithCompany[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedFY, setSelectedFY] = useState<FinancialYear | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof financialYearSchema>>({
    resolver: zodResolver(financialYearSchema),
    defaultValues: {
      companyId: '',
      yearName: '',
      startDate: '',
      endDate: '',
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

  // Fetch companies and financial years
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      const [companiesRes, financialYearsRes] = await Promise.all([
        supabase.from('companies').select('id, name').eq('is_active', true).order('name'),
        supabase.from('financial_years').select('*, companies(id, name)').order('created_at', { ascending: false }),
      ]);

      if (companiesRes.error) throw companiesRes.error;
      if (financialYearsRes.error) throw financialYearsRes.error;

      setCompanies(companiesRes.data || []);
      setFinancialYears(financialYearsRes.data || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      showError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddNew = () => {
    setSelectedFY(null);
    form.reset();
    setIsDialogOpen(true);
  };

  const handleEdit = (fy: FinancialYearWithCompany) => {
    setSelectedFY(fy);
    form.reset({
      companyId: fy.company_id,
      yearName: fy.year_name,
      startDate: fy.start_date,
      endDate: fy.end_date,
      isActive: fy.is_active,
    });
    setIsDialogOpen(true);
  };

  const onSubmit = async (values: z.infer<typeof financialYearSchema>) => {
    setIsSubmitting(true);
    try {
      const payload = {
        company_id: values.companyId,
        year_name: values.yearName,
        start_date: values.startDate,
        end_date: values.endDate,
        is_active: values.isActive,
      };

      if (selectedFY) {
        const { error } = await supabase
          .from('financial_years')
          .update(payload)
          .eq('id', selectedFY.id);
        
        if (error) throw error;
        showSuccess('Financial year updated successfully');
      } else {
        const { error } = await supabase
          .from('financial_years')
          .insert([payload]);
        
        if (error) throw error;
        showSuccess('Financial year added successfully');
      }

      setIsDialogOpen(false);
      fetchData();
    } catch (err: any) {
      console.error('Error saving financial year:', err);
      showError(err.message || 'Failed to save financial year');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('financial_years')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      showSuccess('Financial year deleted successfully');
      fetchData();
    } catch (err: any) {
      console.error('Error deleting financial year:', err);
      showError('Failed to delete financial year');
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
            <h1 className="text-3xl font-bold">Financial Years</h1>
            <p className="text-gray-500">Manage accounting financial years for each company</p>
          </div>
          <Button onClick={handleAddNew} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Financial Year
          </Button>
        </div>

        {/* Financial Years Table */}
        <Card>
          <CardHeader>
            <CardTitle>Financial Years ({financialYears.length})</CardTitle>
            <CardDescription>List of all financial years configured</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin h-8 w-8" />
              </div>
            ) : financialYears.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No financial years found. Create your first financial year.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Year</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {financialYears.map((fy) => (
                      <TableRow key={fy.id}>
                        <TableCell className="font-semibold">{fy.companies.name}</TableCell>
                        <TableCell>{fy.year_name}</TableCell>
                        <TableCell>{format(new Date(fy.start_date), 'dd MMM yyyy')}</TableCell>
                        <TableCell>{format(new Date(fy.end_date), 'dd MMM yyyy')}</TableCell>
                        <TableCell>
                          {fy.is_active ? (
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
                              onClick={() => handleEdit(fy)}
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
                                  <AlertDialogTitle>Delete Financial Year</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{fy.year_name}"? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(fy.id)}>
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
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{selectedFY ? 'Edit Financial Year' : 'Add Financial Year'}</DialogTitle>
              <DialogDescription>
                {selectedFY ? 'Update financial year details' : 'Create a new financial year for a company'}
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="companyId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting || !!selectedFY}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select company" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {companies.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="yearName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Financial Year Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 2024-2025 or FY2024" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="startDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="endDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

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

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {selectedFY ? 'Update' : 'Add'} Year
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

export default ManageFinancialYears;
