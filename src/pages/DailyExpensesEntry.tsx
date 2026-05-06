"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { showError, showSuccess } from '@/utils/toast';
import { Camera, Edit, Loader2, Trash2, Upload, ArrowLeft } from 'lucide-react';
import { formatCurrency } from '@/utils/format';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';

const EXPENSE_TYPES = ['Travel', 'Food', 'Fuel', 'Accommodation', 'Miscellaneous'];

interface ExpenseEntry {
  id: string;
  expense_type: string;
  amount: number;
  remarks: string | null;
  receipt_url: string | null;
  created_at: string;
}

const compressImage = async (file: File, maxWidth = 800, quality = 0.7): Promise<File> => {
  const imageBitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, maxWidth / imageBitmap.width);
  canvas.width = Math.round(imageBitmap.width * scale);
  canvas.height = Math.round(imageBitmap.height * scale);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to compress image.');
  }

  ctx.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Image compression failed.'));
          return;
        }
        resolve(new File([blob], file.name, { type: file.type }));
      },
      file.type || 'image/jpeg',
      quality,
    );
  });
};

const DailyExpensesEntry: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading } = useSession();
  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedType, setSelectedType] = useState('');
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingReceiptUrl, setEditingReceiptUrl] = useState<string | null>(null);

  const todayDateString = new Date().toISOString().slice(0, 10);

  const fetchEntries = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sales_person_daily_expenses')
        .select('id, expense_type, amount, remarks, receipt_url, created_at')
        .eq('sales_person_id', user.id)
        .eq('expense_date', todayDateString)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEntries((data || []) as ExpenseEntry[]);
    } catch (error: any) {
      console.error('Error fetching daily expenses entries:', error?.message || error);
      showError('Unable to load daily expenses.');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [user, todayDateString]);

  useEffect(() => {
    if (user && !sessionLoading) {
      fetchEntries();
    }
  }, [user, sessionLoading, fetchEntries]);

  const resetForm = () => {
    setSelectedType('');
    setAmount('');
    setRemarks('');
    setReceiptFile(null);
    setEditingEntryId(null);
    setEditingReceiptUrl(null);
  };

  const handleCameraCapture = async () => {
    try {
      const photo = await CapacitorCamera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
      });

      if (!photo.webPath) return;
      const response = await fetch(photo.webPath);
      const blob = await response.blob();
      const timestamp = Date.now();
      const fileName = `expense_${timestamp}.jpg`;
      const file = new File([blob], fileName, { type: 'image/jpeg' });
      setReceiptFile(file);
      showSuccess('Receipt photo captured.');
    } catch (error: any) {
      console.error('Camera capture failed:', error);
      showError('Photo capture failed. Please try again.');
    }
  };

  const handleEditEntry = (entry: ExpenseEntry) => {
    setEditingEntryId(entry.id);
    setSelectedType(entry.expense_type);
    setAmount(entry.amount.toString());
    setRemarks(entry.remarks || '');
    setEditingReceiptUrl(entry.receipt_url);
  };

  const handleSubmit = async () => {
    if (!user) {
      showError('User not authenticated.');
      return;
    }

    if (!selectedType) {
      showError('Please select an expense type.');
      return;
    }

    const amountValue = Number(amount);
    if (!amount || Number.isNaN(amountValue) || amountValue <= 0) {
      showError('Enter a valid expense amount.');
      return;
    }

    if (!editingEntryId && !receiptFile) {
      showError('Capture a receipt photo.');
      return;
    }

    setIsSubmitting(true);
    try {
      let receiptUrl = editingReceiptUrl;
      if (receiptFile) {
        const compressedFile = await compressImage(receiptFile, 1024, 0.75);
        const fileExt = compressedFile.name.split('.').pop() || 'jpg';
        const filePath = `expenses/${user.id}/${Date.now()}_${selectedType.replace(/\s+/g, '_')}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('visit-photos')
          .upload(filePath, compressedFile, {
            cacheControl: '3600',
            upsert: false,
            contentType: compressedFile.type,
          });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from('visit-photos').getPublicUrl(filePath);
        receiptUrl = publicUrlData?.publicUrl || null;
      }

      if (editingEntryId) {
        const { error: updateError } = await supabase
          .from('sales_person_daily_expenses')
          .update({
            expense_type: selectedType,
            amount: amountValue,
            remarks: remarks.trim() || null,
            receipt_url: receiptUrl,
          })
          .eq('id', editingEntryId);

        if (updateError) throw updateError;
        showSuccess('Expense updated successfully.');
      } else {
        const { error: insertError } = await supabase
          .from('sales_person_daily_expenses')
          .insert({
            sales_person_id: user.id,
            expense_date: todayDateString,
            expense_type: selectedType,
            amount: amountValue,
            remarks: remarks.trim() || null,
            receipt_url: receiptUrl,
          });

        if (insertError) throw insertError;
        showSuccess('Expense added successfully.');
      }

      resetForm();
      fetchEntries();
    } catch (error: any) {
      console.error('Error saving expense entry:', error?.message || error);
      showError(`Could not save expense entry: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    const confirmed = window.confirm('Delete this expense entry?');
    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('sales_person_daily_expenses')
        .delete()
        .eq('id', entryId);

      if (error) throw error;
      showSuccess('Expense deleted successfully.');
      if (editingEntryId === entryId) resetForm();
      fetchEntries();
    } catch (error: any) {
      console.error('Error deleting expense entry:', error?.message || error);
      showError(`Could not delete expense entry: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalAmount = entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Daily Expenses</h1>
          <p className="text-sm text-muted-foreground">Add expenses and review today’s entries in a scrollable list.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="bg-card text-card-foreground shadow-lg">
          <CardHeader className="bg-amber-500 dark:bg-amber-700 text-white rounded-t-lg p-4">
            <CardTitle className="text-lg">Add Expense</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label htmlFor="expenseType" className="text-xs uppercase tracking-widest text-muted-foreground">Type</Label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger id="expenseType" className="text-xs h-10">
                    <SelectValue placeholder="Select expense type" />
                  </SelectTrigger>
                  <SelectContent className="text-xs">
                    {EXPENSE_TYPES.map((type) => (
                      <SelectItem key={type} value={type} className="text-xs">{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="expenseAmount" className="text-xs uppercase tracking-widest text-muted-foreground">Amount</Label>
                <Input id="expenseAmount" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-xs h-10" placeholder="0.00" />
              </div>
              <div>
                <Label htmlFor="expenseRemarks" className="text-xs uppercase tracking-widest text-muted-foreground">Remarks</Label>
                <Textarea id="expenseRemarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} className="text-xs min-h-[100px]" placeholder="Notes (optional)" />
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <Button variant="secondary" onClick={handleCameraCapture} className="h-10 text-xs gap-1">
                  <Camera className="h-4 w-4" /> Capture Receipt
                </Button>
                {receiptFile && <span className="text-xs text-muted-foreground truncate max-w-[220px]">{receiptFile.name}</span>}
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button onClick={handleSubmit} disabled={isSubmitting} className="h-10 text-xs flex-1">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="h-4 w-4" /> {editingEntryId ? 'Update Expense' : 'Save Expense'}</>}
                </Button>
                {editingEntryId && (
                  <Button variant="outline" onClick={resetForm} disabled={isSubmitting} className="h-10 text-xs flex-1">
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card text-card-foreground shadow-lg">
          <CardHeader className="bg-slate-700 text-white rounded-t-lg p-4">
            <CardTitle className="text-lg">Today&apos;s Expenses</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{entries.length} entries today</span>
              <span className="font-semibold">Total: {formatCurrency(totalAmount)}</span>
            </div>
            <div className="overflow-y-auto max-h-[360px] rounded border border-border bg-background">
              {loading ? (
                <div className="p-4 text-xs flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading expenses...</div>
              ) : entries.length === 0 ? (
                <div className="p-4 text-xs text-muted-foreground">No expense entries added yet.</div>
              ) : (
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="p-2">Type</TableHead>
                      <TableHead className="p-2 text-right">Amount</TableHead>
                      <TableHead className="p-2">Remarks</TableHead>
                      <TableHead className="p-2 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="p-2 whitespace-nowrap">{entry.expense_type}</TableCell>
                        <TableCell className="p-2 text-right whitespace-nowrap">{formatCurrency(entry.amount)}</TableCell>
                        <TableCell className="p-2 truncate max-w-[220px]">{entry.remarks || '-'}</TableCell>
                        <TableCell className="p-2 text-right whitespace-nowrap">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEditEntry(entry)} className="h-8 w-8 p-0">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteEntry(entry.id)} className="h-8 w-8 p-0 text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DailyExpensesEntry;
