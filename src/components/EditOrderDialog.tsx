"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Trash2, Check, ChevronsUpDown, Percent } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Product {
  id: string;
  code: string;
  name: string;
  dp: number;
  stock: number;
}

interface OrderItem {
  id: string; // Unique ID for React list key
  product_id: string;
  product_name: string;
  product_code: string;
  quantity: number;
  unit_dp: number;
  discount_percent: number;
  total_price: number;
}

interface OrderToEdit {
  id: string;
  order_number: number;
  dealer_name: string;
  total_amount: number;
  discount_amount: number;
  gst_percent: number;
  items: OrderItem[];
}

interface EditOrderDialogProps {
  orderId: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderUpdated: () => void;
}

const EditOrderDialog: React.FC<EditOrderDialogProps> = ({ orderId, isOpen, onOpenChange, onOrderUpdated }) => {
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [gstPercent, setGstPercent] = useState<number>(5);
  const [orderData, setOrderData] = useState<OrderToEdit | null>(null);

  // Searchable product dropdown states
  const [popoverOpenStates, setPopoverOpenStates] = useState<Record<string, boolean>>({});
  const [searchValue, setSearchValue] = useState("");

  const fetchOrderAndProducts = useCallback(async (id: string) => {
    setLoading(true);
    try {
      // 1. Fetch Order Details
      const { data: orderRaw, error: orderError } = await supabase
        .from('orders')
        .select(`
          id, order_number, total_amount, discount_amount, gst_percent,
          dealers (name),
          sales (product_id, quantity, total_price, unit_price, discount_percent, products (name, code, dp))
        `)
        .eq('id', id)
        .single();

      if (orderError) throw orderError;

      const fetchedItems: OrderItem[] = (orderRaw.sales || []).map((sale: any, index: number) => ({
        id: `${sale.product_id}-${index}`,
        product_id: sale.product_id,
        product_name: sale.products?.name || 'Unknown',
        product_code: sale.products?.code || 'N/A',
        quantity: sale.quantity,
        unit_dp: sale.unit_price || sale.products?.dp || 0,
        discount_percent: sale.discount_percent || 0,
        total_price: sale.total_price,
      }));

      setOrderData({
        id: orderRaw.id,
        order_number: orderRaw.order_number,
        dealer_name: (orderRaw.dealers as any)?.name || 'N/A',
        total_amount: orderRaw.total_amount,
        discount_amount: orderRaw.discount_amount || 0,
        gst_percent: orderRaw.gst_percent || 5,
        items: fetchedItems,
      });
      setOrderItems(fetchedItems);
      setDiscountAmount(orderRaw.discount_amount || 0);
      setGstPercent(orderRaw.gst_percent || 5);

      // 2. Fetch all products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, code, name, dp, stock')
        .order('name', { ascending: true });

      if (productsError) throw productsError;
      setProducts(productsData || []);

    } catch (error: any) {
      console.error('Error fetching order details for edit:', error.message);
      showError(`Failed to load order details: ${error.message}`);
      setOrderData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && orderId) {
      fetchOrderAndProducts(orderId);
    } else if (!isOpen) {
      setOrderData(null);
      setOrderItems([]);
      setDiscountAmount(0);
      setGstPercent(5);
    }
  }, [isOpen, orderId, fetchOrderAndProducts]);

  const preDiscountTotalOrderValue = useMemo(() => {
    return orderItems.reduce((total, item) => total + item.total_price, 0);
  }, [orderItems]);

  const taxableValue = useMemo(() => {
    return Math.max(0, preDiscountTotalOrderValue - discountAmount);
  }, [preDiscountTotalOrderValue, discountAmount]);

  const gstAmount = useMemo(() => {
    return (taxableValue * gstPercent) / 100;
  }, [taxableValue, gstPercent]);

  const finalOrderValue = useMemo(() => {
    return taxableValue + gstAmount;
  }, [taxableValue, gstAmount]);

  const addOrderItem = () => {
    const newId = Date.now().toString();
    setOrderItems([...orderItems, { 
      id: newId, 
      product_id: '', 
      product_name: '', 
      product_code: '', 
      quantity: 1, 
      unit_dp: 0, 
      discount_percent: 0, 
      total_price: 0 
    }]);
    setPopoverOpenStates(prev => ({ ...prev, [newId]: false }));
  };

  const removeOrderItem = (id: string) => {
    if (orderItems.length > 1) {
      setOrderItems(orderItems.filter(item => item.id !== id));
    }
  };

  const updateOrderItem = (id: string, field: keyof OrderItem, value: any) => {
    setOrderItems(prevItems => prevItems.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        
        if (field === 'product_id') {
          const product = products.find(p => p.id === value);
          if (product) {
            updatedItem.product_name = product.name;
            updatedItem.product_code = product.code;
            updatedItem.unit_dp = product.dp;
          }
        }

        // Recalculate item total
        const discount = (updatedItem.unit_dp * updatedItem.discount_percent) / 100;
        const finalUnitPrice = Math.max(0, updatedItem.unit_dp - discount);
        updatedItem.total_price = updatedItem.quantity * finalUnitPrice;
        
        return updatedItem;
      }
      return item;
    }));
  };

  const filteredProducts = useMemo(() => {
    if (!searchValue) return products;
    const search = searchValue.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(search) || p.code.toLowerCase().includes(search));
  }, [products, searchValue]);

  const handleSave = async () => {
    if (!orderData || orderItems.some(item => !item.product_id || item.quantity <= 0)) {
      showError('Please ensure all items have a product and valid quantity.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Update Order
      const { error: orderUpdateError } = await supabase
        .from('orders')
        .update({
          total_amount: parseFloat(finalOrderValue.toFixed(2)),
          discount_amount: parseFloat(discountAmount.toFixed(2)),
          gst_percent: gstPercent,
        })
        .eq('id', orderData.id);

      if (orderUpdateError) throw orderUpdateError;

      // 2. Refresh Sales Items
      await supabase.from('sales').delete().eq('order_id', orderData.id);
      
      const salesToInsert = orderItems.map(item => ({
        order_id: orderData.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_dp,
        discount_percent: item.discount_percent,
        total_price: item.total_price,
      }));

      const { error: salesInsertError } = await supabase.from('sales').insert(salesToInsert);
      if (salesInsertError) throw salesInsertError;

      showSuccess(`Order #${orderData.order_number} updated successfully!`);
      onOrderUpdated();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving order:', error);
      showError(`Failed to save changes: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Order #{orderData?.order_number}</DialogTitle>
          <DialogDescription>Modify items, prices, and discounts for this order.</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label className="text-lg font-semibold">Order Items</Label>
              <Button type="button" onClick={addOrderItem} size="sm" disabled={isSubmitting}>
                <Plus className="h-4 w-4 mr-1" /> Add Item
              </Button>
            </div>

            {orderItems.map((item) => (
              <div className="p-4 border rounded-md bg-muted/30 space-y-4" key={item.id}>
                <div className="flex items-end gap-2">
                  <div className="flex-grow">
                    <Label>Product</Label>
                    <Popover 
                      open={popoverOpenStates[item.id]} 
                      onOpenChange={(open) => setPopoverOpenStates(prev => ({ ...prev, [item.id]: open }))}
                    >
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between" disabled={isSubmitting}>
                          {item.product_name || "Select product..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0">
                        <Command>
                          <CommandInput placeholder="Search product..." onValueChange={setSearchValue} />
                          <CommandList>
                            <CommandEmpty>No product found.</CommandEmpty>
                            <CommandGroup>
                              {filteredProducts.map((p) => (
                                <CommandItem
                                  key={p.id}
                                  onSelect={() => {
                                    updateOrderItem(item.id, 'product_id', p.id);
                                    setPopoverOpenStates(prev => ({ ...prev, [item.id]: false }));
                                  }}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", item.product_id === p.id ? "opacity-100" : "opacity-0")} />
                                  {p.name} ({p.code}) - DP: ₹{p.dp}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeOrderItem(item.id)} disabled={orderItems.length <= 1 || isSubmitting}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <Label>Quantity</Label>
                    <Input type="number" value={item.quantity} onChange={(e) => updateOrderItem(item.id, 'quantity', parseInt(e.target.value) || 0)} min="1" disabled={isSubmitting} />
                  </div>
                  <div>
                    <Label>Unit Price (DP)</Label>
                    <Input type="number" value={item.unit_dp} onChange={(e) => updateOrderItem(item.id, 'unit_dp', parseFloat(e.target.value) || 0)} min="0" disabled={isSubmitting} />
                  </div>
                  <div>
                    <Label>Discount (%)</Label>
                    <div className="relative">
                      <Input type="number" value={item.discount_percent} onChange={(e) => updateOrderItem(item.id, 'discount_percent', parseFloat(e.target.value) || 0)} min="0" max="100" className="pr-8" disabled={isSubmitting} />
                      <Percent className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div>
                    <Label>Total</Label>
                    <div className="h-10 flex items-center px-3 border rounded-md bg-background font-semibold">₹{item.total_price.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-muted rounded-md space-y-3">
            <div className="flex justify-between text-sm"><span>Subtotal:</span><span>₹{preDiscountTotalOrderValue.toFixed(2)}</span></div>
            <div className="flex justify-between items-center">
              <Label>Additional Discount (₹)</Label>
              <Input type="number" value={discountAmount} onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)} className="w-32 text-right" min="0" disabled={isSubmitting} />
            </div>
            <div className="flex justify-between text-sm font-medium"><span>Taxable Value:</span><span>₹{taxableValue.toFixed(2)}</span></div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Label>GST (%)</Label>
                <Input type="number" value={gstPercent} onChange={(e) => setGstPercent(parseFloat(e.target.value) || 0)} className="w-20 text-right" min="0" disabled={isSubmitting} />
              </div>
              <span className="text-sm text-muted-foreground">₹{gstAmount.toFixed(2)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-lg font-bold"><span>Final Total:</span><span>₹{finalOrderValue.toFixed(2)}</span></div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditOrderDialog;