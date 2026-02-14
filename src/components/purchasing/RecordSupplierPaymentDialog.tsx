"use client";
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { useSession } from '@/contexts/SessionContext';
import { Loader2 } from 'lucide-react';

interface RecordSupplierPaymentDialogProps {
  supplierId: string;
  supplierName: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onPaymentRecorded: () => void;
}

const paymentSchema = z.object({
  amount: z.preprocess((val) => Number(val || 0), z.number().min(0.01, "Amount must be greater than 0.")),
  payment_date: z.string().min(1, "Payment date is required."),
  payment_method: z.string().min(1, "Payment method is required."),
  reference_no: z.string().optional(),
});

const RecordSupplierPaymentDialog: React.FC<RecordSupplierPaymentDialogProps> = ({ supplierId, supplierName, isOpen, onOpenChange, onPaymentRecorded }) => {
  const { user } = useSession();
  const form = useForm<z.infer<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      payment_date: new Date().toISOString().split('T')[0],
    },
  });

  const handleSave = async (values: z.infer<typeof paymentSchema>) => {
    if (!user) {
      showError("You must be logged in to record a payment.");
      return;
    }
    try {
      const { error } = await supabase.from('supplier_payments').insert({
        ...values,
        supplier_id: supplierId,
        created_by: user.id,
      });
      if (error) throw error;
      showSuccess('Payment recorded successfully.');
      onPaymentRecorded();
      onOpenChange(false);
    } catch (error: any) {
      showError(`Failed to record payment: ${error.message}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Payment to {supplierName}</DialogTitle>
          <DialogDescription>Enter the details of the payment made to the supplier.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
          <div><Label>Amount</Label><Input type="number" step="0.01" {...form.register('amount')} />{form.formState.errors.amount && <p className="text-destructive text-sm">{form.formState.errors.amount.message}</p>}</div>
          <div><Label>Payment Date</Label><Input type="date" {...form.register('payment_date')} /></div>
          <div><Label>Payment Method</Label><Select onValueChange={(value) => form.setValue('payment_method', value)}><SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger><SelectContent><SelectItem value="Bank Transfer">Bank Transfer</SelectItem><SelectItem value="Cheque">Cheque</SelectItem><SelectItem value="Cash">Cash</SelectItem><SelectItem value="UPI">UPI</SelectItem></SelectContent></Select>{form.formState.errors.payment_method && <p className="text-destructive text-sm">{form.formState.errors.payment_method.message}</p>}</div>
          <div><Label>Reference No.</Label><Input {...form.register('reference_no')} placeholder="e.g., Cheque No, TXN ID" /></div>
          <DialogFooter>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Payment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RecordSupplierPaymentDialog;