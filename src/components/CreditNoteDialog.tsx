"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { Loader2, Trash2, Plus } from 'lucide-react';
import { CreditNote, CreditNoteItem } from '@/types/creditNote';

interface CreditNoteDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  creditNote?: CreditNote | null;
  dealerId?: string;
}

interface Dealer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

interface Invoice {
  id: string;
  bill_number: string;
  grand_total: number;
  bill_date: string;
}

export default function CreditNoteDialog({
  isOpen,
  onOpenChange,
  onSuccess,
  creditNote,
  dealerId,
}: CreditNoteDialogProps) {
  const [loading, setLoading] = useState(false);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedDealerId, setSelectedDealerId] = useState(dealerId || '');
  const [creditNoteDate, setCreditNoteDate] = useState('');
  const [creditAmount, setCreditAmount] = useState('');
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [referencedInvoiceId, setReferencedInvoiceId] = useState('');
  const [referencedBillNumber, setReferencedBillNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [gstPercentage, setGstPercentage] = useState('0');
  const [items, setItems] = useState<Partial<CreditNoteItem>[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadDealers();
      if (creditNote) {
        setSelectedDealerId(creditNote.dealer_id);
        setCreditNoteDate(creditNote.credit_note_date ? creditNote.credit_note_date.split('T')[0] : '');
        setCreditAmount(creditNote.credit_amount.toString());
        setReason(creditNote.reason);
        setDescription(creditNote.description || '');
        setReferencedInvoiceId(creditNote.referenced_invoice_id || '');
        setReferencedBillNumber(creditNote.referenced_bill_number || '');
        setExpiryDate(creditNote.expiry_date ? creditNote.expiry_date.split('T')[0] : '');
        setGstPercentage((creditNote.gst_percentage || 0).toString());
      } else {
        resetForm();
      }
    }
  }, [isOpen, creditNote]);

  useEffect(() => {
    if (selectedDealerId) {
      loadInvoices(selectedDealerId);
    }
  }, [selectedDealerId]);

  const loadDealers = async () => {
    try {
      const { data, error } = await supabase
        .from('dealers')
        .select('id, name, email, phone')
        .order('name');

      if (error) throw error;
      setDealers(data || []);
    } catch (err) {
      console.error('Error loading dealers:', err);
      showError('Failed to load dealers');
    }
  };

  const loadInvoices = async (dealerId: string) => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, bill_number, grand_total, bill_date')
        .eq('dealer_id', dealerId)
        .order('bill_date', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (err) {
      console.error('Error loading invoices:', err);
      showError('Failed to load invoices');
    }
  };

  const resetForm = () => {
    setSelectedDealerId(dealerId || '');
    setCreditNoteDate('');
    setCreditAmount('');
    setReason('');
    setDescription('');
    setReferencedInvoiceId('');
    setReferencedBillNumber('');
    setExpiryDate('');
    setGstPercentage('0');
    setItems([]);
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        description: '',
        quantity_returned: 0,
        unit_price: 0,
        item_amount: 0,
        reason_for_return: '',
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (
    index: number,
    field: keyof CreditNoteItem,
    value: any
  ) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    // Calculate item amount
    if (field === 'quantity_returned' || field === 'unit_price') {
      const quantity = newItems[index].quantity_returned || 0;
      const price = newItems[index].unit_price || 0;
      newItems[index].item_amount = quantity * price;
    }

    setItems(newItems);
  };

  const calculateGST = (amount: number) => {
    const gst = parseFloat(gstPercentage) || 0;
    return (amount * gst) / 100;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedDealerId || !creditAmount || !reason || !creditNoteDate) {
      showError('Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      const creditAmountNum = parseFloat(creditAmount);
      const gstAmount = calculateGST(creditAmountNum);

      if (creditNote) {
        // Update existing credit note
        const { error } = await supabase
          .from('credit_notes')
          .update({
            credit_note_date: new Date(creditNoteDate).toISOString(),
            credit_amount: creditAmountNum,
            reason,
            description,
            referenced_invoice_id: referencedInvoiceId || null,
            referenced_bill_number: referencedBillNumber || null,
            expiry_date: expiryDate ? new Date(expiryDate).toISOString() : null,
            gst_percentage: parseFloat(gstPercentage),
            gst_amount: gstAmount,
            credit_remaining: creditAmountNum - (creditNote.credit_used || 0),
            updated_at: new Date().toISOString(),
          })
          .eq('id', creditNote.id);

        if (error) throw error;
        showSuccess('Credit note updated successfully');
      } else {
        // Create new credit note
        const creditNoteNumber = `CN-${Date.now()}`;

        const { data: newCreditNote, error: insertError } = await supabase
          .from('credit_notes')
          .insert({
            dealer_id: selectedDealerId,
            credit_note_number: creditNoteNumber,
            credit_note_date: new Date(creditNoteDate).toISOString(),
            reason,
            description,
            credit_amount: creditAmountNum,
            credit_remaining: creditAmountNum,
            referenced_invoice_id: referencedInvoiceId || null,
            referenced_bill_number: referencedBillNumber || null,
            expiry_date: expiryDate ? new Date(expiryDate).toISOString() : null,
            gst_percentage: parseFloat(gstPercentage),
            gst_amount: gstAmount,
            status: 'issued',
            approval_status: 'approved',
          })
          .select();

        if (insertError) throw insertError;

        // Add items if any
        if (items.length > 0 && newCreditNote) {
          const itemsToInsert = items
            .filter((item) => item.description)
            .map((item) => ({
              credit_note_id: newCreditNote[0].id,
              description: item.description,
              quantity_returned: item.quantity_returned || 0,
              unit_price: item.unit_price || 0,
              item_amount: item.item_amount || 0,
              reason_for_return: item.reason_for_return || null,
            }));

          if (itemsToInsert.length > 0) {
            const { error: itemsError } = await supabase
              .from('credit_note_items')
              .insert(itemsToInsert);

            if (itemsError) throw itemsError;
          }
        }

        showSuccess('Credit note created successfully');
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      console.error('Error saving credit note:', err);
      showError('Failed to save credit note');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {creditNote ? 'Edit Credit Note' : 'Create Credit Note'}
          </DialogTitle>
          <DialogDescription>
            {creditNote
              ? 'Update the credit note details'
              : 'Issue a new credit note to a dealer'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dealer Selection */}
          <div className="space-y-2">
            <Label htmlFor="dealer">Dealer *</Label>
            <Select value={selectedDealerId} onValueChange={setSelectedDealerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select dealer" />
              </SelectTrigger>
              <SelectContent>
                {dealers.map((dealer) => (
                  <SelectItem key={dealer.id} value={dealer.id}>
                    {dealer.name} ({dealer.email || 'No email'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Credit Amount and Reason */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Credit Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason *</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="product_return">Product Return</SelectItem>
                  <SelectItem value="quality_issue">Quality Issue</SelectItem>
                  <SelectItem value="billing_error">Billing Error</SelectItem>
                  <SelectItem value="promotion">Promotional Credit</SelectItem>
                  <SelectItem value="damaged_goods">Damaged Goods</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="credit-note-date">Credit Note Date *</Label>
              <Input
                id="credit-note-date"
                type="date"
                value={creditNoteDate}
                onChange={(e) => setCreditNoteDate(e.target.value)}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional details about the credit note..."
              rows={3}
            />
          </div>

          {/* Referenced Invoice */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invoice">Referenced Invoice</Label>
              <Select
                value={referencedInvoiceId}
                onValueChange={(value) => {
                  setReferencedInvoiceId(value);
                  const invoice = invoices.find((inv) => inv.id === value);
                  if (invoice) {
                    setReferencedBillNumber(invoice.bill_number);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select invoice" />
                </SelectTrigger>
                <SelectContent>
                  {invoices.map((invoice) => (
                    <SelectItem key={invoice.id} value={invoice.id}>
                      {invoice.bill_number} - ₹
                      {invoice.grand_total.toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiry">Expiry Date</Label>
              <Input
                id="expiry"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </div>
          </div>

          {/* GST Percentage */}
          <div className="space-y-2">
            <Label htmlFor="gst">GST Percentage (%)</Label>
            <Input
              id="gst"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={gstPercentage}
              onChange={(e) => setGstPercentage(e.target.value)}
              placeholder="0"
            />
          </div>

          {/* Items Section */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base">Credit Note Items</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddItem}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No items added. Click "Add Item" to include product details.
                </p>
              ) : (
                items.map((item, index) => (
                  <Card key={index} className="p-3">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <h4 className="font-semibold text-sm">Item {index + 1}</h4>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveItem(index)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Description</Label>
                          <Input
                            value={item.description || ''}
                            onChange={(e) =>
                              handleItemChange(index, 'description', e.target.value)
                            }
                            placeholder="Item description"
                            className="text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Qty</Label>
                          <Input
                            type="number"
                            value={item.quantity_returned || 0}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                'quantity_returned',
                                parseInt(e.target.value) || 0
                              )
                            }
                            placeholder="0"
                            className="text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Unit Price</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.unit_price || 0}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                'unit_price',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            placeholder="0.00"
                            className="text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Total</Label>
                          <Input
                            type="number"
                            disabled
                            value={item.item_amount || 0}
                            placeholder="0.00"
                            className="text-sm bg-muted"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Reason for Return</Label>
                        <Input
                          value={item.reason_for_return || ''}
                          onChange={(e) =>
                            handleItemChange(
                              index,
                              'reason_for_return',
                              e.target.value
                            )
                          }
                          placeholder="Why was this item returned?"
                          className="text-sm"
                        />
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>

          {/* Summary */}
          {creditAmount && (
            <Card className="bg-muted p-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Credit Amount:</span>
                  <span className="font-semibold">
                    ₹{parseFloat(creditAmount).toFixed(2)}
                  </span>
                </div>
                {gstPercentage && (
                  <>
                    <div className="flex justify-between">
                      <span>GST ({gstPercentage}%):</span>
                      <span className="font-semibold">
                        ₹{calculateGST(parseFloat(creditAmount)).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2 font-bold">
                      <span>Total:</span>
                      <span>
                        ₹
                        {(
                          parseFloat(creditAmount) +
                          calculateGST(parseFloat(creditAmount))
                        ).toFixed(2)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </Card>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {creditNote ? 'Update' : 'Create'} Credit Note
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
