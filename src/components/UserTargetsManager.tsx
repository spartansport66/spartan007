"use client";

import React, { useState, useEffect } from 'react';
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

interface SalesTarget {
  id: string;
  sales_person_id: string;
  target_amount: number;
  target_month: string; // YYYY-MM-DD format for the first day of the month
  created_at: string;
  updated_at: string;
}

interface UserProfileForTargets {
  id: string;
  first_name: string | null;
  last_name: string | null;
  targets: SalesTarget[];
}

interface UserTargetsManagerProps {
  user: UserProfileForTargets;
  onTargetsUpdated: () => void; // Callback to refresh parent data
}

const addTargetFormSchema = z.object({
  month: z.string().min(1, { message: 'Month is required.' }),
  year: z.string().min(4, { message: 'Year is required.' }),
  targetAmount: z.preprocess(
    (val) => Number(val),
    z.number().min(0, { message: 'Target amount cannot be negative.' })
  ),
});

const editTargetFormSchema = z.object({
  targetAmount: z.preprocess(
    (val) => Number(val),
    z.number().min(0, { message: 'Target amount cannot be negative.' })
  ),
});

const UserTargetsManager: React.FC<UserTargetsManagerProps> = ({ user, onTargetsUpdated }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTargetId, setEditingTargetId] = useState<string | null>(null);
  const [localTargets, setLocalTargets] = useState<SalesTarget[]>(user.targets);

  const addForm = useForm<z.infer<typeof addTargetFormSchema>>({
    resolver: zodResolver(addTargetFormSchema),
    defaultValues: {
      month: (new Date().getMonth() + 1).toString(), // Current month (1-indexed)
      year: new Date().getFullYear().toString(), // Current year
      targetAmount: 0,
    },
  });

  const editForm = useForm<z.infer<typeof editTargetFormSchema>>({
    resolver: zodResolver(editTargetFormSchema),
    defaultValues: {
      targetAmount: 0,
    },
  });

  useEffect(() => {
    setLocalTargets(user.targets);
  }, [user.targets]);

  const getMonthName = (monthNum: string) => {
    const date = new Date();
    date.setMonth(parseInt(monthNum) - 1);
    return date.toLocaleString('default', { month: 'long' });
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

  // Check if a target already exists for the selected month/year for display purposes
  const targetMonthDateForCheck = new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, 1);
  const formattedTargetMonthForCheck = targetMonthDateForCheck.toISOString().split('T')[0];
  const existingTargetForSelectedMonth = localTargets.find(
    (t) => t.target_month === formattedTargetMonthForCheck
  );

  const handleAddTarget = async (values: z.infer<typeof addTargetFormSchema>) => {
    setIsSubmitting(true);
    try {
      const targetMonthDate = new Date(parseInt(values.year), parseInt(values.month) - 1, 1);
      const formattedTargetMonth = targetMonthDate.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('sales_targets')
        .upsert(
          {
            sales_person_id: user.id,
            target_amount: values.targetAmount,
            target_month: formattedTargetMonth,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'sales_person_id, target_month' } // Use unique constraint for upsert
        )
        .select();

      if (error) {
        throw error;
      }
      
      if (data && data.length > 0) {
        const upsertedTarget = data[0];
        setLocalTargets(prev => {
          const existingIndex = prev.findIndex(t => t.id === upsertedTarget.id);
          if (existingIndex > -1) {
            // Update existing target in local state
            return prev.map((t, idx) => idx === existingIndex ? upsertedTarget : t);
          } else {
            // Add new target to local state
            return [...prev, upsertedTarget];
          }
        });
      }

      showSuccess(`Target for ${getMonthName(values.month)} ${values.year} set successfully!`);
      addForm.reset({
        month: (new Date().getMonth() + 1).toString(),
        year: new Date().getFullYear().toString(),
        targetAmount: 0,
      });
      onTargetsUpdated(); // Notify parent to refresh
    } catch (error: any) {
      console.error('Error setting target:', error);
      showError(`Failed to set target: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (target: SalesTarget) => {
    setEditingTargetId(target.id);
    editForm.reset({
      targetAmount: target.target_amount,
    });
  };

  const handleUpdateTarget = async (values: z.infer<typeof editTargetFormSchema>) => {
    if (!editingTargetId) return;
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('sales_targets')
        .update({
          target_amount: values.targetAmount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingTargetId)
        .select();

      if (error) throw error;
      
      // Update local state
      if (data && data.length > 0) {
        setLocalTargets(prev => prev.map(t => 
          t.id === editingTargetId 
            ? { ...t, target_amount: values.targetAmount, updated_at: data[0].updated_at } 
            : t
        ));
      }
      
      showSuccess('Target updated successfully!');
      setEditingTargetId(null);
      onTargetsUpdated(); // Notify parent to refresh
    } catch (error: any) {
      console.error('Error updating target:', error);
      showError(`Failed to update target: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTarget = async (targetId: string) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('sales_targets')
        .delete()
        .eq('id', targetId);

      if (error) throw error;
      
      // Remove from local state
      setLocalTargets(prev => prev.filter(t => t.id !== targetId));
      
      showSuccess('Target deleted successfully!');
      onTargetsUpdated(); // Notify parent to refresh
    } catch (error: any) {
      console.error('Error deleting target:', error);
      showError(`Failed to delete target: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const sortedTargets = [...localTargets].sort((a, b) => {
    const dateA = new Date(a.target_month);
    const dateB = new Date(b.target_month);
    return dateB.getTime() - dateA.getTime(); // Newest first
  });

  const isFutureMonth = (targetMonth: string) => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0-indexed

    const targetDate = new Date(targetMonth);
    const targetYear = targetDate.getFullYear();
    const targetMonthIndex = targetDate.getMonth(); // 0-indexed

    // A target is editable if its month/year is strictly after the current month/year
    if (targetYear > currentYear) return true;
    if (targetYear === currentYear && targetMonthIndex > currentMonth) return true;
    return false;
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Add New Target</h3>
      <Form {...addForm}>
        <form onSubmit={addForm.handleSubmit(handleAddTarget)} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
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
            name="targetAmount"
            render={({ field }) => (
              <FormItem>
                <Label>Target Amount (₹)</Label>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="e.g., 50000.00" {...field} />
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
                  {existingTargetForSelectedMonth ? 'Update Target' : 'Add New Target'}
                </>
              )}
            </Button>
            {existingTargetForSelectedMonth && (
              <p className="text-sm text-muted-foreground mt-2">
                A target for {getMonthName(selectedMonth)} {selectedYear} already exists. Submitting will update it.
              </p>
            )}
          </div>
        </form>
      </Form>

      <h3 className="text-lg font-semibold mt-8">Existing Targets</h3>
      {sortedTargets.length === 0 ? (
        <p className="text-muted-foreground">No targets set for this user.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Target Amount</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTargets.map((target) => {
                const targetDate = new Date(target.target_month);
                const month = targetDate.toLocaleString('default', { month: 'long' });
                const year = targetDate.getFullYear();
                const canEdit = isFutureMonth(target.target_month);

                return (
                  <TableRow key={target.id}>
                    <TableCell>{month}</TableCell>
                    <TableCell>{year}</TableCell>
                    <TableCell>
                      {editingTargetId === target.id ? (
                        <Form {...editForm}>
                          <form onSubmit={editForm.handleSubmit(handleUpdateTarget)} className="flex items-center gap-2">
                            <FormField
                              control={editForm.control}
                              name="targetAmount"
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
                            <Button type="button" variant="outline" size="sm" onClick={() => setEditingTargetId(null)}>
                              Cancel
                            </Button>
                          </form>
                        </Form>
                      ) : (
                        `₹${target.target_amount.toFixed(2)}`
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {editingTargetId !== target.id && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleEditClick(target)} 
                            title="Edit Target"
                            disabled={!canEdit || isSubmitting}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" title="Delete Target" disabled={isSubmitting}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action will permanently delete the target for {month} {year}.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteTarget(target.id)} disabled={isSubmitting}>
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

export default UserTargetsManager;