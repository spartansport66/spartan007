"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, PlusCircle, Edit, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';

interface MonthlyCreditLimit {
  id: string;
  dealer_id: string;
  month_year: string; // YYYY-MM-DD format for the first day of the month
  credit_limit: number;
  created_at: string;
  updated_at: string;
}

interface DealerForCreditManager {
  id: string;
  name: string;
}

interface DealerMonthlyCreditManagerProps {
  dealer: DealerForCreditManager;
  onCreditLimitsUpdated: () => void; // Callback to refresh parent data
}

const addCreditLimitFormSchema = z.object({
  month: z.string().min(1, { message: 'Month is required.' }),
  year: z.string().min(4, { message: 'Year is required.' }),
  creditLimit: z.preprocess(
    (val) => Number(val),
    z.number().min(0, { message: 'Credit limit cannot be negative.' })
  ),
});

const editCreditLimitFormSchema = z.object({
  creditLimit: z.preprocess(
    (val) => Number(val),
    z.number().min(0, { message: 'Credit limit cannot be negative.' })
  ),
});

const DealerMonthlyCreditManager: React.FC<DealerMonthlyCreditManagerProps> = ({ dealer, onCreditLimitsUpdated }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingLimitId, setEditingLimitId] = useState<string | null>(null);
  const [localMonthlyLimits, setLocalMonthlyLimits] = useState<MonthlyCreditLimit[]>([]);
  const [loadingLimits, setLoadingLimits] = useState(true);

  const addForm = useForm<z.infer<typeof addCreditLimitFormSchema>>({
    resolver: zodResolver(addCreditLimitFormSchema),
    defaultValues: {
      month: (new Date().getMonth() + 1).toString(), // Current month (1-indexed)
      year: new Date().getFullYear().toString(), // Current year
      creditLimit: 0,
    },
  });

  const editForm = useForm<z.infer<typeof editCreditLimitFormSchema>>({
    resolver: zodResolver(editCreditLimitFormSchema),
    defaultValues: {
      creditLimit: 0,
    },
  });

  const fetchMonthlyLimits = useCallback(async () => {
    setLoadingLimits(true);
    try {
      const { data, error } = await supabase
        .from('dealer_monthly_credit_limits')
        .select('*')
        .eq('dealer_id', dealer.id)
        .order('month_year', { ascending: false });

      if (error) throw error;
      setLocalMonthlyLimits(data || []);
    } catch (error: any) {
      console.error('Error fetching monthly credit limits:', error.message);
      showError(`Failed to load monthly credit limits: ${error.message}`);
    } finally {
      setLoadingLimits(false);
    }
  }, [dealer.id]);

  useEffect(() => {
    fetchMonthlyLimits();
  }, [fetchMonthlyLimits]);

  const getMonthName = (monthNum: string) => {
    if (monthNum === "all") return "All Months";
    const date = new Date(Date.UTC(2000, parseInt(monthNum) - 1, 1));
    return date.toLocaleString('default', { month: 'long', timeZone: 'UTC' });
  };

  const generateYears = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear - 5; i <= currentYear + 5; i++) {
      years.push(i.toString());
    }
    return years;
  };

  const selectedMonth = addForm.watch('month');
  const selectedYear = addForm.watch('year');

  let existingLimitForSelectedMonth = null;
  if (selectedMonth !== "all") {
    const limitMonthDateForCheck = new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, 1);
    const formattedLimitMonthForCheck = limitMonthDateForCheck.toISOString().split('T')[0];
    existingLimitForSelectedMonth = localMonthlyLimits.find(
      (l) => l.month_year === formattedLimitMonthForCheck
    );
  }

  const handleAddCreditLimit = async (values: z.infer<typeof addCreditLimitFormSchema>) => {
    setIsSubmitting(true);
    try {
      let upsertedLimits: MonthlyCreditLimit[] = [];

      if (values.month === "all") {
        const limitsToUpsert = [];
        for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
          const limitMonthDate = new Date(Date.UTC(parseInt(values.year), monthIndex, 1));
          const formattedLimitMonth = limitMonthDate.toISOString().split('T')[0];
          limitsToUpsert.push({
            dealer_id: dealer.id,
            credit_limit: values.creditLimit,
            month_year: formattedLimitMonth,
            updated_at: new Date().toISOString(),
          });
        }

        const { data, error } = await supabase
          .from('dealer_monthly_credit_limits')
          .upsert(limitsToUpsert, { onConflict: 'dealer_id, month_year' })
          .select();

        if (error) throw error;
        upsertedLimits = data || [];
        showSuccess(`Credit limits for all months of ${values.year} set successfully!`);

      } else {
        const limitMonthDate = new Date(Date.UTC(parseInt(values.year), parseInt(values.month) - 1, 1));
        const formattedLimitMonth = limitMonthDate.toISOString().split('T')[0];

        const { data, error } = await supabase
          .from('dealer_monthly_credit_limits')
          .upsert(
            {
              dealer_id: dealer.id,
              credit_limit: values.creditLimit,
              month_year: formattedLimitMonth,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'dealer_id, month_year' }
          )
          .select();

        if (error) throw error;
        upsertedLimits = data || [];
        showSuccess(`Credit limit for ${getMonthName(values.month)} ${values.year} set successfully!`);
      }
      
      setLocalMonthlyLimits(prev => {
        const newLimitsMap = new Map(prev.map(l => [`${l.dealer_id}-${l.month_year}`, l]));
        upsertedLimits.forEach(ul => {
          newLimitsMap.set(`${ul.dealer_id}-${ul.month_year}`, ul);
        });
        return Array.from(newLimitsMap.values());
      });

      addForm.reset({
        month: (new Date().getMonth() + 1).toString(),
        year: new Date().getFullYear().toString(),
        creditLimit: 0,
      });
      onCreditLimitsUpdated();
    } catch (error: any) {
      console.error('Error setting credit limit:', error);
      showError(`Failed to set credit limit: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (limit: MonthlyCreditLimit) => {
    setEditingLimitId(limit.id);
    editForm.reset({
      creditLimit: limit.credit_limit,
    });
  };

  const handleUpdateCreditLimit = async (values: z.infer<typeof editCreditLimitFormSchema>) => {
    if (!editingLimitId) return;
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('dealer_monthly_credit_limits')
        .update({
          credit_limit: values.creditLimit,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingLimitId)
        .select();

      if (error) throw error;
      
      if (data && data.length > 0) {
        setLocalMonthlyLimits(prev => prev.map(l => 
          l.id === editingLimitId 
            ? { ...l, credit_limit: values.creditLimit, updated_at: data[0].updated_at } 
            : l
        ));
      }
      
      showSuccess('Credit limit updated successfully!');
      setEditingLimitId(null);
      onCreditLimitsUpdated();
    } catch (error: any) {
      console.error('Error updating credit limit:', error);
      showError(`Failed to update credit limit: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCreditLimit = async (limitId: string) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('dealer_monthly_credit_limits')
        .delete()
        .eq('id', limitId);

      if (error) throw error;
      
      setLocalMonthlyLimits(prev => prev.filter(l => l.id !== limitId));
      
      showSuccess('Credit limit deleted successfully!');
      onCreditLimitsUpdated();
    } catch (error: any) {
      console.error('Error deleting credit limit:', error);
      showError(`Failed to delete credit limit: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const sortedLimits = [...localMonthlyLimits].sort((a, b) => {
    return b.month_year.localeCompare(a.month_year); // Newest first
  });

  if (loadingLimits) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading monthly credit limits...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Add New Monthly Credit Limit</h3>
      <Form {...addForm}>
        <form onSubmit={addForm.handleSubmit(handleAddCreditLimit)} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <FormField
            control={addForm.control}
            name="month"
            render={({ field }) => (
              <FormItem>
                <Label>Month</Label>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="all">All Months</SelectItem>
                    {Array.from({ length: 12 }, (_, i) => (i + 1).toString()).map((monthNum) => (
                      <SelectItem key={monthNum} value={monthNum}>
                        {getMonthName(monthNum)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={addForm.control}
            name="year"
            render={({ field }) => (
              <FormItem>
                <Label>Year</Label>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {generateYears().map((year) => (
                      <SelectItem key={year} value={year}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={addForm.control}
            name="creditLimit"
            render={({ field }) => (
              <FormItem>
                <Label>Credit Limit (₹)</Label>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="e.g., 100000.00" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="sm:col-span-1">
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <>
                  <PlusCircle className="h-4 w-4 mr-2" />
                  {selectedMonth === "all" ? 'Set All Monthly Limits' : (existingLimitForSelectedMonth ? 'Update Limit' : 'Add New Limit')}
                </>
              )}
            </Button>
            {selectedMonth !== "all" && existingLimitForSelectedMonth && (
              <p className="text-sm text-muted-foreground mt-2">
                A limit for {getMonthName(selectedMonth)} {selectedYear} already exists. Submitting will update it.
              </p>
            )}
          </div>
        </form>
      </Form>

      <h3 className="text-lg font-semibold mt-8">Existing Monthly Credit Limits</h3>
      {sortedLimits.length === 0 ? (
        <p className="text-muted-foreground">No monthly credit limits set for this dealer.</p>
      ) : (
        <div className="overflow-x-auto max-h-96 overflow-y-auto rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Credit Limit</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedLimits.map((limit) => {
                const [limitYearStr, limitMonthStr] = limit.month_year.split('-');
                const month = getMonthName(limitMonthStr);
                const year = parseInt(limitYearStr);

                return (
                  <TableRow key={limit.id}>
                    <TableCell>{month}</TableCell>
                    <TableCell>{year}</TableCell>
                    <TableCell>
                      {editingLimitId === limit.id ? (
                        <Form {...editForm}>
                          <form onSubmit={editForm.handleSubmit(handleUpdateCreditLimit)} className="flex items-center gap-2">
                            <FormField
                              control={editForm.control}
                              name="creditLimit"
                              render={({ field }) => (
                                <FormItem className="mb-0">
                                  <FormControl>
                                    <Input type="number" step="0.01" {...field} className="w-32" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <Button type="submit" size="sm" disabled={isSubmitting}>
                              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => setEditingLimitId(null)}>
                              Cancel
                            </Button>
                          </form>
                        </Form>
                      ) : (
                        `₹${limit.credit_limit.toFixed(2)}`
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {editingLimitId !== limit.id && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleEditClick(limit)} 
                            title="Edit Limit"
                            disabled={isSubmitting}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" title="Delete Limit" disabled={isSubmitting}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action will permanently delete the credit limit for {month} {year}.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteCreditLimit(limit.id)} disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Delete'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default DealerMonthlyCreditManager;