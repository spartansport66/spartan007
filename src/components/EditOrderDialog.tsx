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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Product {
  id: string;
  name: string;
  stock: number;
  dp: number;
}

interface OrderItem {
  id?: string;
  product_id: string;
  product_name: string;
  quantity: number;
  price: number; // This is unit price (DP)
  amount: number; // This is total price (quantity * price)
}

interface OrderData {
  order_number: number;
  order_date: string;
  dealer_id: string;
  dealer_name: string;
  total_amount: number;
  dispatched: boolean;
  dispatch_date: string | null;
  dispatch_number: number | null;
  bill_no: string | null;
}

interface EditOrderDialogProps {
  orderId: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderUpdated: () => void;
}

const EditOrderDialog: React.FC<EditOrderDialogProps> = ({ orderId, isOpen, onOpenChange, onOrderUpdated }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [newItemQuantity, setNewItemQuantity] = useState<string>('1');

  const fetchOrderDetails = useCallback(async (id: string) => {
    setLoading(true);
    try {
      // Fetch the main order data
      const { data: orderResult, error: orderError } = await supabase
        .from('orders')
        .select(`
          order_number, order_date, total_amount, dispatched, dispatch_date, dispatch_number, bill_no,
          dealers (id, name)
        `)
        .eq('id', id)
        .single();

      if (orderError || !orderResult) {
        throw new Error(orderError?.message || 'Order not found.');
      }

      const fetchedOrderData: OrderData = {
        order_number: orderResult.order_number,
        order_date: new Date(orderResult.order_date).toISOString().split('T')[0],
        dealer_id: orderResult.dealers.id,
        dealer_name: orderResult.dealers.name,
        total_amount: orderResult.total_amount,
        dispatched: orderResult.dispatched,
        dispatch_date: orderResult.dispatch_date ? new Date(orderResult.dispatch_date).toISOString().split('T')[0] : null,
        dispatch_number: orderResult.dispatch_number,
        bill_no: orderResult.bill_no,
      };
      setOrderData(fetchedOrderData);

      // Fetch the associated sales items
      const { data: itemsResult, error: itemsError } = await supabase
        .from('sales')
        .select(`
          id, quantity, total_price,
          products (id, name, dp)
        `)
        .eq('order_id', id);

      if (itemsError) {
        throw new Error(itemsError.message);
      }

      const fetchedItems: OrderItem[] = itemsResult.map((item: any) => ({
        id: item.id,
        product_id: item.products.id,
        product_name: item.products.name,
        quantity: item.quantity,
        price: item.products.dp, // Unit price is dp from products table
        amount: item.total_price, // Total price is already calculated in sales table
      }));
      setItems(fetchedItems);

    } catch (error: any) {
      console.error('Error fetching order details:', error);
      showError(`Failed to load order data: ${error.message}`);
      setOrderData(null);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, stock, dp')
        .order('name', { ascending: true });
      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      showError('Failed to load products for selection.');
      console.error('Error fetching products:', error.message);
    }
  };

  useEffect(() => {
    if (isOpen && orderId) {
      fetchOrderDetails(orderId);
      fetchProducts();
    } else {
      // Reset state when dialog is closed or no orderId is provided
      setOrderData(null);
      setItems([]);
      setLoading(true);
    }
  }, [isOpen, orderId, fetchOrderDetails]);

  const handleItemChange = (index: number, field: 'quantity' | 'price', value: string) => {
    const newItems = [...items];
    const numValue = parseFloat(value) || 0;
    newItems[index] = {
      ...newItems[index],
      [field]: numValue,
      amount: field === 'quantity' ? numValue * newItems[index].price : newItems[index].quantity * numValue,
    };
    setItems(newItems);
    recalculateTotal(newItems);
  };

  const handleAddItem = () => {
    if (!selectedProduct || !newItemQuantity) {
      showError("Please select a product and enter a quantity.");
      return;
    }
    const product = products.find(p => p.id === selectedProduct);
    if (!product) {
      showError("Selected product not found.");
      return;
    }
    if (items.some(item => item.product_id === product.id)) {
      showError("Product is already in the order. Please update the quantity instead.");
      return;
    }

    const quantity = parseInt(newItemQuantity, 10);
    const newItem: OrderItem = {
      product_id: product.id,
      product_name: product.name,
      quantity: quantity,
      price: product.dp,
      amount: quantity * product.dp,
    };
    const newItems = [...items, newItem];
    setItems(newItems);
    recalculateTotal(newItems);
    setSelectedProduct('');
    setNewItemQuantity('1');
  };

  const handleRemoveItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
    recalculateTotal(newItems);
  };

  const recalculateTotal = (currentItems: OrderItem[]) => {
    const total = currentItems.reduce((sum, item) => sum + item.amount, 0);
    if (orderData) {
      setOrderData({ ...orderData, total_amount: total });
    }
  };

  const handleSaveChanges = async () => {
    if (!orderId || !orderData) {
      showError("No order data available to save.");
      return;
    }
    setSaving(true);
    try {
      const { error: updateError } = await supabase.rpc('update_order_and_items', {
        p_order_id: orderId,
        p_order_data: {
          order_date: orderData.order_date,
          total_amount: orderData.total_amount,
          dispatch_date: orderData.dispatch_date,
          dispatch_number: orderData.dispatch_number,
          bill_no: orderData.bill_no,
        },
        p_order_items: items.map(({ product_id, quantity, amount }) => ({
          product_id,
          quantity,
          total_price: amount,
        })),
      });

      if (updateError) {
        throw updateError;
      }

      showSuccess('Order updated successfully!');
      onOrderUpdated();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving order:', error);
      showError(`Failed to save changes: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Order #{orderData?.order_number}</DialogTitle>
          <DialogDescription>
            Modify the details of this order. Changes will affect stock levels if the order is dispatched.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center flex-grow">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        ) : !orderData ? (
          <div className="flex items-center justify-center flex-grow">
            <p className="text-red-500">Could not load order data.</p>
          </div>
        ) : (
          <div className="flex-grow overflow-y-auto pr-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <Label>Dealer</Label>
                <Input value={orderData.dealer_name} disabled />
              </div>
              <div>
                <Label htmlFor="orderDate">Order Date</Label>
                <Input
                  id="orderDate"
                  type="date"
                  value={orderData.order_date}
                  onChange={(e) => setOrderData({ ...orderData, order_date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="dispatchDate">Dispatch Date</Label>
                <Input
                  id="dispatchDate"
                  type="date"
                  value={orderData.dispatch_date || ''}
                  onChange={(e) => setOrderData({ ...orderData, dispatch_date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="dispatchNumber">Dispatch Number</Label>
                <Input
                  id="dispatchNumber"
                  type="number"
                  value={orderData.dispatch_number || ''}
                  onChange={(e) => setOrderData({ ...orderData, dispatch_number: parseInt(e.target.value) || null })}
                />
              </div>
              <div>
                <Label htmlFor="billNo">Bill Number</Label>
                <Input
                  id="billNo"
                  value={orderData.bill_no || ''}
                  onChange={(e) => setOrderData({ ...orderData, bill_no: e.target.value })}
                />
              </div>
            </div>

            <h3 className="text-lg font-semibold mb-2">Order Items</h3>
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="w-24">Quantity</TableHead>
                    <TableHead className="w-32">Price</TableHead>
                    <TableHead className="w-32 text-right">Amount</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={item.product_id}>
                      <TableCell>{item.product_name}</TableCell>
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
                          value={item.price}
                          onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                          className="w-full"
                        />
                      </TableCell>
                      <TableCell className="text-right">₹{item.amount.toFixed(2)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(index)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-end gap-4 mt-4 p-4 border rounded-md bg-muted/50">
              <div className="flex-grow">
                <Label>Add Product</Label>
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map(p => (
                      <SelectItem key={p.id} value={p.id} disabled={items.some(i => i.product_id === p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-24">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  value={newItemQuantity}
                  onChange={(e) => setNewItemQuantity(e.target.value)}
                  min="1"
                />
              </div>
              <Button onClick={handleAddItem}>Add Item</Button>
            </div>

            <div className="text-right mt-6 text-2xl font-bold">
              Total: ₹{orderData.total_amount.toFixed(2)}
            </div>
          </div>
        )}

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSaveChanges} disabled={loading || saving || !orderData}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditOrderDialog;