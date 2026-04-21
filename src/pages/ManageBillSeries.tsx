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

interface Company {
  id: string;
  name: string;
}

interface FinancialYear {
  id: string;
  year_name: string;
}

interface BillSeries {
  id: string;
  company_id: string;
  financial_year_id: string;
  series_prefix: string;
  series_separator: string | null;
  current_sequence_number: number;
  increment_by: number;
  is_active: boolean;
  created_at: string;
}

interface BillSeriesWithRelations extends BillSeries {
  companies: Company;
  financial_years: FinancialYear;
}

const billSeriesSchema = z.object({
  companyId: z.string().min(1, { message: 'Please select a company.' }),
  financialYearId: z.string().min(1, { message: 'Please select a financial year.' }),
  seriesPrefix: z.string().min(1, { message: 'Series prefix is required (e.g., INV-2024-).' }),
  seriesSeparator: z.string().optional().nullable(),
  currentSequenceNumber: z.preprocess(
    (val) => Number(val),
    z.number().min(1, { message: 'Starting number must be at least 1.' })
  ),
  incrementBy: z.preprocess(
    (val) => Number(val),
    z.number().min(1, { message: 'Increment value must be at least 1.' })
  ),
  isActive: z.boolean().default(true),
});

const ManageBillSeries = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, isAdmin } = useSession();
  const [billSeries, setBillSeries] = useState<BillSeriesWithRelations[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedBS, setSelectedBS] = useState<BillSeriesWithRelations | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof billSeriesSchema>>({
    resolver: zodResolver(billSeriesSchema),
    defaultValues: {
      companyId: '',
      financialYearId: '',
      seriesPrefix: '',
      seriesSeparator: '-',
      currentSequenceNumber: 1000,
      incrementBy: 1,
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
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const { data, error } = await supabase
          .from('companies')
          .select('id, name')
          .eq('is_active', true)
          .order('name');
        
        if (error) throw error;
        setCompanies(data || []);
      } catch (err) {
        console.error('Error fetching companies:', err);
        showError('Failed to load companies');
      }
    };

    fetchCompanies();
  }, []);

  // Fetch financial years for selected company
  useEffect(() => {
    if (!selectedCompanyId) return;

    const fetchFYs = async () => {
      try {
        const { data, error } = await supabase
          .from('financial_years')
          .select('id, year_name')
          .eq('company_id', selectedCompanyId)
          .eq('is_active', true)
          .order('start_date', { ascending: false });
        
        if (error) throw error;
        setFinancialYears(data || []);
      } catch (err) {
        console.error('Error fetching financial years:', err);
      }
    };

    fetchFYs();
  }, [selectedCompanyId]);

  // Fetch bill series
  const fetchBillSeries = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('bill_series')
        .select('*, companies(id, name), financial_years(id, year_name)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setBillSeries(data || []);
    } catch (err) {
      console.error('Error fetching bill series:', err);
      showError('Failed to load bill series');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBillSeries();
  }, [fetchBillSeries]);

  const handleAddNew = () => {
    setSelectedBS(null);
    form.reset();
    setSelectedCompanyId('');
    setIsDialogOpen(true);
  };

  const handleEdit = (bs: BillSeriesWithRelations) => {
    setSelectedBS(bs);
    setSelectedCompanyId(bs.company_id);
    form.reset({
      companyId: bs.company_id,
      financialYearId: bs.financial_year_id,
      seriesPrefix: bs.series_prefix,
      seriesSeparator: bs.series_separator,
      currentSequenceNumber: bs.current_sequence_number,
      incrementBy: bs.increment_by,
      isActive: bs.is_active,
    });
    setIsDialogOpen(true);
  };

  const onSubmit = async (values: z.infer<typeof billSeriesSchema>) => {
    setIsSubmitting(true);
    try {
      const payload = {
        company_id: values.companyId,
        financial_year_id: values.financialYearId,
        series_prefix: values.seriesPrefix,
        series_separator: values.seriesSeparator || null,
        current_sequence_number: values.currentSequenceNumber,
        increment_by: values.incrementBy,
        is_active: values.isActive,
      };

      if (selectedBS) {
        const { error } = await supabase
          .from('bill_series')
          .update(payload)
          .eq('id', selectedBS.id);
        
        if (error) throw error;
        showSuccess('Bill series updated successfully');
      } else {
        const { error } = await supabase
          .from('bill_series')
          .insert([payload]);
        
        if (error) throw error;
        showSuccess('Bill series created successfully');
      }

      setIsDialogOpen(false);
      fetchBillSeries();
    } catch (err: any) {
      console.error('Error saving bill series:', err);
      showError(err.message || 'Failed to save bill series');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('bill_series')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      showSuccess('Bill series deleted successfully');
      fetchBillSeries();
    } catch (err: any) {
      console.error('Error deleting bill series:', err);
      showError('Failed to delete bill series');
    }
  };

  const generatePreview = (prefix: string, separator: string | null, startNum: number) => {
    const sep = separator || '';
    return `${prefix}${sep}${startNum}`;
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
            <h1 className="text-3xl font-bold">Bill Number Series</h1>
            <p className="text-gray-500">Configure bill numbering with auto-increment for each company & financial year</p>
          </div>
          <Button onClick={handleAddNew} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Series
          </Button>
        </div>

        {/* Bill Series Table */}
        <Card>
          <CardHeader>
            <CardTitle>Bill Number Series ({billSeries.length})</CardTitle>
            <CardDescription>Format: Prefix + Separator + Sequential Number</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin h-8 w-8" />
              </div>
            ) : billSeries.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No bill series configured. Create your first series.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Financial Year</TableHead>
                      <TableHead>Prefix/Format</TableHead>
                      <TableHead>Next Bill No.</TableHead>
                      <TableHead>Increment</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {billSeries.map((bs) => (
                      <TableRow key={bs.id}>
                        <TableCell className="font-semibold">{bs.companies.name}</TableCell>
                        <TableCell>{bs.financial_years.year_name}</TableCell>
                        <TableCell>
                          <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                            {bs.series_prefix}{bs.series_separator}
                          </code>
                        </TableCell>
                        <TableCell>
                          <code className="bg-blue-100 px-2 py-1 rounded text-xs text-blue-700">
                            {generatePreview(bs.series_prefix, bs.series_separator, bs.current_sequence_number)}
                          </code>
                        </TableCell>
                        <TableCell>{bs.increment_by}</TableCell>
                        <TableCell>
                          {bs.is_active ? (
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
                              onClick={() => handleEdit(bs)}
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
                                  <AlertDialogTitle>Delete Bill Series</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this bill series? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(bs.id)}>
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
              <DialogTitle>{selectedBS ? 'Edit Bill Series' : 'Create Bill Series'}</DialogTitle>
              <DialogDescription>
                {selectedBS ? 'Update bill numbering configuration' : 'Setup bill numbering format with auto-increment'}
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="companyId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company *</FormLabel>
                      <Select 
                        value={field.value} 
                        onValueChange={(val) => {
                          field.onChange(val);
                          setSelectedCompanyId(val);
                          form.setValue('financialYearId', '');
                        }}
                        disabled={isSubmitting || !!selectedBS}
                      >
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

                  <FormField control={form.control} name="financialYearId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Financial Year *</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting || !selectedCompanyId}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select financial year" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {financialYears.map((fy) => (
                            <SelectItem key={fy.id} value={fy.id}>
                              {fy.year_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="seriesPrefix" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bill Prefix (e.g., INV-2024-) *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="INV-2024-" 
                        {...field} 
                        disabled={isSubmitting}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <p className="text-xs text-gray-500">Alphanumeric with special characters allowed</p>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid grid-cols-3 gap-4">
                  <FormField control={form.control} name="seriesSeparator" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Separator (Optional)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="-" 
                          maxLength={3}
                          {...field} 
                          value={field.value ?? ''}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <p className="text-xs text-gray-500">e.g., "-" or ""</p>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="currentSequenceNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start From *</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="1000" 
                          {...field}
                          value={field.value ?? ''}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="incrementBy" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Increment By *</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="1" 
                          {...field}
                          value={field.value ?? ''}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                {/* Preview */}
                <div className="bg-blue-50 p-3 rounded border border-blue-200">
                  <p className="text-xs text-gray-600 mb-1">Preview of first bill number:</p>
                  <code className="text-sm font-mono text-blue-700">
                    {generatePreview(
                      form.watch('seriesPrefix'),
                      form.watch('seriesSeparator'),
                      form.watch('currentSequenceNumber')
                    )}
                  </code>
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

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {selectedBS ? 'Update' : 'Create'} Series
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

export default ManageBillSeries;
