"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';

interface EditOrderDialogProps {
  orderId: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderUpdated: () => void;
}

interface OrderItem {
  id?: string;
  product_id: string;
  product_name: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface FormData {
  order_number: number;
  order_date: string;
  dispatch_date: string | null;
  dispatch_number: number | null;
  bill_no: string | null;
  total_amount: number;
}

const EditOrderDialog: React.FC<EditOrderDialogProps> = ({ orderId, isOpen, onOpenChange, onOrderUpdated }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<FormData | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [dealerName, setDealerName] = useState<string>('');

  const fetchOrderData = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          dealers (name),
          order_items (
            id,
            quantity,
            rate,
            amount,
            products (id, name)
          )
        `)
        .eq('id', id)
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        setFormData({
          order_number: data.order_number,
          order_date: new Date(data.order_date).toISOString().split('T')[0],
          dispatch_date: data.dispatch_date ? new Date(data.dispatch_date).toISOString().split('T')[0] : null,
          dispatch_number: data.dispatch_number,
          bill_no: data.bill_no,
          total_amount: data.total_amount,
        });
        setDealerName(data.dealers?.name || 'N/A');
        const fetchedItems = data.order_items.map((item: any) => ({
          id: item.id,
          product_id: item.products.id,
          product_name: item.products.name,
          quantity: item.quantity,
          rate: item.rate,
          amount: item.amount,
        }));
        setItems(fetchedItems);
      }
    } catch (error: any) {
      console.error("Error fetching order data:", error);
      showError("Failed to load order data. Please try again.");
      onOpenChange(false); // Close dialog on error
    } finally {
      setLoading(false);
    }
  }, [onOpenChange]);

  useEffect(() => {
    if (isOpen && orderId) {
      fetchOrderData(orderId);
    } else {
      // Reset form when dialog is closed or no orderId is provided
      setFormData(null);
      setItems([]);
      setDealerName('');
    }
  }, [isOpen, orderId, fetchOrderData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    if (formData) {
      setFormData({ ...formData, [id]: value });
    }
  };

  const handleItemChange = (index: number, field: 'quantity' | 'rate', value: string) => {
    const newItems = [...items];
    const numericValue = parseFloat(value) || 0;
    newItems[index] = { ...newItems[index], [field]: numericValue };
    
    // Recalculate amount for the changed item
    const item = newItems[index];
    if (field === 'quantity' || field === 'rate') {
      item.amount = item.quantity * item.rate;
    }
    
    setItems(newItems);
    recalculateTotal();
  };

  const recalculateTotal = useCallback(() => {
    if (formData) {
      const total = items.reduce((sum, item) => sum + item.amount, 0);
      setFormData({ ...formData, total_amount: total });
    }
  }, [items, formData]);

  useEffect(() => {
    recalculateTotal();
  }, [items, recalculateTotal]);


  const handleSaveChanges = async () => {
    if (!orderId || !formData) return;

    setSaving(true);
    try {
      // Update the order details
      const { error: orderUpdateError } = await supabase
        .from('orders')
        .update({
          order_date: formData.order_date,
          dispatch_date: formData.dispatch_date,
          dispatch_number: formData.dispatch_number,
          bill_no: formData.bill_no,
          total_amount: formData.total_amount,
        })
        .eq('id', orderId);

      if (orderUpdateError) throw orderUpdateError;

      // Update order items
      // This is a simplified version. A real-world scenario might need to handle new/deleted items.
      const itemUpdatePromises = items.map(item =>
        supabase
          .from('order_items')
          .update({
            quantity: item.quantity,
            rate: item.rate,
            amount: item.amount,
          })
          .eq('id', item.id!)
      );

      const results = await Promise.all(itemUpdatePromises);
      const itemUpdateErrors = results.map(res => res.error).filter(Boolean);

      if (itemUpdateErrors.length > 0) {
        throw new Error(`Failed to update ${itemUpdateErrors.length} items.`);
      }

      showSuccess("Order updated successfully!");
      onOrderUpdated();
      onOpenChange(false);

    } catch (error: any) {
      console.error("Error saving order:", error);
      showError(error.message || "Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Order #{formData?.order_number}</DialogTitle>
          <DialogDescription>
            Modify the details for the order placed by <strong>{dealerName}</strong>.
          </DialogDescription>
        </DialogHeader>
        
        {loading ? (
          <div className="flex-grow flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-lg">Loading order details...</p>
          </div>
        ) : formData ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="order_date">Order Date</Label>
                <Input id="order_date" type="date" value={formData.order_date} onChange={handleInputChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dispatch_date">Dispatch Date</Label>
                <Input id="dispatch_date" type="date" value={formData.dispatch_date || ''} onChange={handleInputChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dispatch_number">Dispatch Number</Label>
                <Input id="dispatch_number" type="number" value={formData.dispatch_number || ''} onChange={handleInputChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bill_no">Bill Number</Label>
                <Input id="bill_no" value={formData.bill_no || ''} onChange={handleInputChange} />
              </div>
            </div>

            <div className="flex-grow overflow-y-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="w-[120px]">Quantity</TableHead>
                    <TableHead className="w-[120px]">Rate</TableHead>
                    <TableHead className="w-[150px] text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={item.id || index}>
                      <TableCell className="font-medium">{item.product_name}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                          className="w-full"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.rate}
                          onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                          className="w-full"
                        />
                      </TableCell>
                      <TableCell className="text-right">₹{item.amount.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-end items-center pt-4">
                <Label className="mr-4 font-bold text-lg">Total Amount:</Label>
                <span className="text-xl font-bold">₹{formData.total_amount.toFixed(2)}</span>
            </div>
          </>
        ) : (
          <div className="flex-grow flex items-center justify-center">
            <p>No order data available.</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSaveChanges} disabled={loading || saving || !formData}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditOrderDialog;