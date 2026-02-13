"use client";

import React, { useState, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { Loader2, Package, Search, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const RECORD_MATERIAL_RETURN_EDGE_FUNCTION_URL = "https://hxftiocfihhdutciaisl.supabase.co/functions/v1/record-material-return";

interface DispatchedItem {
  sale_id: string;
  product_id: string;
  product_name: string;
  product_code: string;
  dispatched_quantity: number;
}

interface LoadedOrder {
  id: string;
  dealer_name: string;
  items: DispatchedItem[];
}

interface SelectedItem {
  product_id: string;
  quantity: number;
}

interface MaterialReturnFormProps {
  onReturnRecorded: () => void;
}

const formSchema = z.object({
  remarks: z.string().max(500).optional(),
  receiptDate: z.string().min(1, "Return date is required."),
});

const MaterialReturnForm: React.FC<MaterialReturnFormProps> = ({ onReturnRecorded }) => {
  const { user } = useSession();
  const [orderNumberInput, setOrderNumberInput] = useState('');
  const [loadedOrder, setLoadedOrder] = useState<LoadedOrder | null>(null);
  const [selectedItems, setSelectedItems] = useState<Record<string, SelectedItem>>({});
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      remarks: '',
      receiptDate: new Date().toISOString().split('T')[0],
    },
  });

  const handleLoadOrder = useCallback(async () => {
    if (!orderNumberInput.trim()) {
      showError("Please enter an Order Number.");
      return;
    }
    setLoading(true);
    setLoadedOrder(null);
    setSelectedItems({});
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          dispatched,
          dealers (name),
          sales (id, quantity, products (id, name, code))
        `)
        .eq('order_number', orderNumberInput.trim())
        .single();

      if (error) throw error;

      if (!data.dispatched) {
        showError(`Order #${orderNumberInput} has not been dispatched. Returns can only be processed for dispatched orders.`);
        setLoading(false);
        return;
      }

      setLoadedOrder({
        id: data.id,
        dealer_name: (data.dealers as any)?.name || 'Unknown Dealer',
        items: (data.sales || []).map((sale: any) => ({
          sale_id: sale.id,
          product_id: sale.products.id,
          product_name: sale.products.name,
          product_code: sale.products.code,
          dispatched_quantity: sale.quantity,
        })),
      });
    } catch (error: any) {
      showError(`Failed to load order: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [orderNumberInput]);

  const handleItemSelection = (saleId: string, checked: boolean) => {
    const newSelectedItems = { ...selectedItems };
    if (checked) {
      const item = loadedOrder?.items.find(i => i.sale_id === saleId);
      if (item) {
        newSelectedItems[saleId] = {
          product_id: item.product_id,
          quantity: item.dispatched_quantity,
        };
      }
    } else {
      delete newSelectedItems[saleId];
    }
    setSelectedItems(newSelectedItems);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked && loadedOrder) {
      const allSelected = loadedOrder.items.reduce((acc, item) => {
        acc[item.sale_id] = {
          product_id: item.product_id,
          quantity: item.dispatched_quantity,
        };
        return acc;
      }, {} as Record<string, SelectedItem>);
      setSelectedItems(allSelected);
    } else {
      setSelectedItems({});
    }
  };

  const handleQuantityChange = (saleId: string, quantity: number) => {
    const item = loadedOrder?.items.find(i => i.sale_id === saleId);
    if (item && quantity > 0 && quantity <= item.dispatched_quantity) {
      setSelectedItems(prev => ({
        ...prev,
        [saleId]: { ...prev[saleId], quantity },
      }));
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user || !loadedOrder || Object.keys(selectedItems).length === 0) {
      showError('Please load an order and select items to return.');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch(RECORD_MATERIAL_RETURN_EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: loadedOrder.id,
          user_id: user.id,
          remarks: values.remarks,
          receipt_date: values.receiptDate,
          items: Object.values(selectedItems),
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to record return.');

      showSuccess(data.message);
      form.reset();
      setLoadedOrder(null);
      setSelectedItems({});
      setOrderNumberInput('');
      onReturnRecorded();
    } catch (error: any) {
      showError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const allItemsSelected = loadedOrder ? Object.keys(selectedItems).length === loadedOrder.items.length : false;

  return (
    <Card className="bg-card text-card-foreground shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold text-primary flex items-center gap-2">
          <Package className="h-6 w-6" /> Material Return Voucher
        </CardTitle>
        <CardDescription className="text-muted-foreground">Record materials returned from a specific order.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-4 mb-6">
          <div className="flex-grow">
            <Label htmlFor="orderNumber">Order Number</Label>
            <Input id="orderNumber" type="number" value={orderNumberInput} onChange={e => setOrderNumberInput(e.target.value)} placeholder="Enter order number to load items" />
          </div>
          <Button onClick={handleLoadOrder} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>

        {loadedOrder && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <p><strong>Dealer:</strong> {loadedOrder.dealer_name}</p>
              <div className="max-h-60 overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"><Checkbox checked={allItemsSelected} onCheckedChange={handleSelectAll} /></TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-center">Dispatched Qty</TableHead>
                      <TableHead className="w-32">Return Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadedOrder.items.map(item => (
                      <TableRow key={item.sale_id}>
                        <TableCell><Checkbox checked={!!selectedItems[item.sale_id]} onCheckedChange={checked => handleItemSelection(item.sale_id, !!checked)} /></TableCell>
                        <TableCell>{item.product_name} ({item.product_code})</TableCell>
                        <TableCell className="text-center">{item.dispatched_quantity}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={selectedItems[item.sale_id]?.quantity || ''}
                            onChange={e => handleQuantityChange(item.sale_id, parseInt(e.target.value))}
                            max={item.dispatched_quantity}
                            min="1"
                            disabled={!selectedItems[item.sale_id]}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="receiptDate" render={({ field }) => (<FormItem><FormLabel>Return Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="remarks" render={({ field }) => (<FormItem><FormLabel>Remarks</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting || Object.keys(selectedItems).length === 0}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Record Material Return'}
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
};

export default MaterialReturnForm;