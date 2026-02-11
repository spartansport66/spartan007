"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Trash2, Check, ChevronsUpDown, Percent, Search } from 'lucide-react';
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
  closing_stock: number;
  gst: string;
}

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  product_name: string;
  product_code: string;
  unit_dp: number;
  discount_percent: number;
  gst_percent: number;
  taxable_value: number;
  gst_amount: number;
  total_price: number;
}

interface OrderToEdit {
  id: string;
  order_number: number;
  dealer_name: string;
  total_amount: number;
  discount_amount: number;
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
  const [orderData, setOrderData] = useState<OrderToEdit | null>(null);

  const [isProductPopoverOpen, setIsProductPopoverOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [newItemProductId, setNewItemProductId] = useState<string>('');
  const [newItemQuantity, setNewItemQuantity] = useState<number>(1);
  const [newItemUnitPrice, setNewItemUnitPrice] = useState<number>(0);
  const [newItemDiscountPercent, setNewItemDiscountPercent] = useState<number>(0);

  const fetchOrderAndProducts = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, code, name, dp, closing_stock, gst')
        .order('name', { ascending: true });

      if (productsError) throw productsError;
      setProducts(productsData || []);

      const { data: orderRaw, error: orderError } = await supabase
        .from('orders')
        .select(`
          id, order_number, total_amount, discount_amount,
          dealers (name),
          sales (product_id, quantity, total_price, unit_price, discount_percent, gst_percent, products (name, code, dp, gst))
        `)
        .eq('id', id)
        .single();

      if (orderError) throw orderError;

      const fetchedItems: OrderItem[] = (orderRaw.sales || []).map((sale: any, index: number) => {
        const unitPrice = sale.unit_price || sale.products?.dp || 0;
        const discPercent = sale.discount_percent || 0;
        const gstPercent = sale.gst_percent || parseFloat(sale.products?.gst || "0") || 0;
        
        const taxableUnitPrice = unitPrice * (1 - discPercent / 100);
        const taxableValue = taxableUnitPrice * sale.quantity;
        const gstAmount = (taxableValue * gstPercent) / 100;

        return {
          id: `${sale.product_id}-${index}`,
          product_id: sale.product_id,
          quantity: sale.quantity,
          product_name: sale.products?.name || 'N/A',
          product_code: sale.products?.code || 'N/A',
          unit_dp: unitPrice,
          discount_percent: discPercent,
          gst_percent: gstPercent,
          taxable_value: taxableValue,
          gst_amount: gstAmount,
          total_price: sale.total_price,
        };
      });

      setOrderData({
        id: orderRaw.id,
        order_number: orderRaw.order_number,
        dealer_name: (orderRaw.dealers as any)?.name || 'N/A',
        total_amount: orderRaw.total_amount,
        discount_amount: orderRaw.discount_amount || 0,
        items: fetchedItems,
      });
      setOrderItems(fetchedItems);
      setDiscountAmount(orderRaw.discount_amount || 0);

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
    }
  }, [isOpen, orderId, fetchOrderAndProducts]);

  const totalTaxableValue = useMemo(() => {
    return orderItems.reduce((total, item) => total + item.taxable_value, 0);
  }, [orderItems]);

  const totalGstAmount = useMemo(() => {
    return orderItems.reduce((total, item) => total + item.gst_amount, 0);
  }, [orderItems]);

  const preGlobalDiscountTotal = useMemo(() => {
    return orderItems.reduce((total, item) => total + item.total_price, 0);
  }, [orderItems]);

  const finalOrderValue = useMemo(() => {
    return Math.max(0, preGlobalDiscountTotal - discountAmount);
  }, [preGlobalDiscountTotal, discountAmount]);

  const newItemCalculations = useMemo(() => {
    const product = products.find(p => p.id === newItemProductId);
    const gstPercent = parseFloat(product?.gst || "0") || 0;
    const taxableUnitPrice = newItemUnitPrice * (1 - newItemDiscountPercent / 100);
    const taxableValue = taxableUnitPrice * newItemQuantity;
    const gstAmount = (taxableValue * gstPercent) / 100;
    const totalPrice = taxableValue + gstAmount;

    return { gstPercent, taxableValue, gstAmount, totalPrice };
  }, [newItemProductId, newItemUnitPrice, newItemDiscountPercent, newItemQuantity, products]);

  const addOrderItem = () => {
    if (!newItemProductId || newItemQuantity <= 0) {
      showError("Please select a product and enter a valid quantity.");
      return;
    }
    const product = products.find(p => p.id === newItemProductId);
    if (!product) return;

    const newOrderItem: OrderItem = {
      id: Date.now().toString(),
      product_id: product.id,
      quantity: newItemQuantity,
      product_name: product.name,
      product_code: product.code,
      unit_dp: newItemUnitPrice,
      discount_percent: newItemDiscountPercent,
      gst_percent: newItemCalculations.gstPercent,
      taxable_value: newItemCalculations.taxableValue,
      gst_amount: newItemCalculations.gstAmount,
      total_price: newItemCalculations.totalPrice,
    };
    setOrderItems(prevItems => [newOrderItem, ...prevItems]);
    setNewItemProductId('');
    setNewItemQuantity(1);
    setNewItemUnitPrice(0);
    setNewItemDiscountPercent(0);
  };

  const updateOrderItem = (id: string, field: keyof OrderItem, value: number) => {
    setOrderItems(prev => prev.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        const taxableUnitPrice = updatedItem.unit_dp * (1 - updatedItem.discount_percent / 100);
        updatedItem.taxable_value = taxableUnitPrice * updatedItem.quantity;
        updatedItem.gst_amount = (updatedItem.taxable_value * updatedItem.gst_percent) / 100;
        updatedItem.total_price = updatedItem.taxable_value + updatedItem.gst_amount;
        return updatedItem;
      }
      return item;
    }));
  };

  const removeOrderItem = (id: string) => {
    setOrderItems(orderItems.filter(item => item.id !== id));
  };

  const filteredProducts = useMemo(() => {
    if (!productSearch) return products;
    const search = productSearch.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(search) || p.code.toLowerCase().includes(search));
  }, [products, productSearch]);

  const currentProductDisplay = useMemo(() => {
    if (!newItemProductId) return "Select product...";
    const product = products.find(p => p.id === newItemProductId);
    return product ? `${product.name} (${product.code})` : "Select product...";
  }, [newItemProductId, products]);

  const handleSave = async () => {
    if (!orderData || orderItems.length === 0) {
      showError('Order must have at least one item.');
      return;
    }
    setIsSubmitting(true);

    try {
      const finalDiscountAmount = parseFloat(discountAmount.toFixed(2));
      const finalOrderAmount = parseFloat(finalOrderValue.toFixed(2));

      const { error: orderUpdateError } = await supabase
        .from('orders')
        .update({
          total_amount: finalOrderAmount,
          discount_amount: finalDiscountAmount,
        })
        .eq('id', orderData.id);

      if (orderUpdateError) throw orderUpdateError;

      await supabase.from('sales').delete().eq('order_id', orderData.id);
      const salesToInsert = orderItems.map(item => ({
        order_id: orderData.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_dp,
        discount_percent: item.discount_percent,
        gst_percent: item.gst_percent,
        total_price: item.total_price,
      }));
      await supabase.from('sales').insert(salesToInsert);

      const { data: payment } = await supabase
        .from('payments')
        .select('id')
        .eq('order_id', orderData.id)
        .eq('status', 'pending_approval')
        .maybeSingle();

      if (payment) {
        await supabase
          .from('payments')
          .update({ amount: finalOrderAmount })
          .eq('id', payment.id);
      }

      showSuccess(`Order #${orderData.order_number} updated successfully.`);
      onOrderUpdated();
      onOpenChange(false);

    } catch (error: any) {
      console.error('Error saving order changes:', error);
      showError(`Failed to save order changes: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!orderId || !isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Order #{orderData?.order_number}</DialogTitle>
          <DialogDescription>
            Modify items and discounts. GST is calculated per item.
          </DialogDescription>
        </DialogHeader>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <Label className="text-lg font-semibold">Add/Modify Items</Label>
              <div className="flex flex-col gap-4 p-4 border rounded-md bg-muted/50">
                <div className="w-full">
                  <Label>Product</Label>
                  <Popover open={isProductPopoverOpen} onOpenChange={setIsProductPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between" disabled={isSubmitting}>
                        {currentProductDisplay}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command>
                        <div className="p-2 border-b flex items-center gap-2">
                          <Search className="h-4 w-4 text-muted-foreground" />
                          <Input 
                            placeholder="Search product..." 
                            value={productSearch} 
                            onChange={(e) => setProductSearch(e.target.value)} 
                            className="h-8 border-none focus-visible:ring-0" 
                          />
                        </div>
                        <CommandList className="max-h-[250px] overflow-y-auto">
                          {filteredProducts.length === 0 ? (
                            <CommandEmpty>No product found.</CommandEmpty>
                          ) : (
                            <CommandGroup>
                              {filteredProducts.map((product) => (
                                <CommandItem
                                  key={product.id}
                                  value={`${product.name} ${product.code}`}
                                  onSelect={() => {
                                    setNewItemProductId(product.id);
                                    setNewItemUnitPrice(product.dp);
                                    setIsProductPopoverOpen(false);
                                    setProductSearch('');
                                  }}
                                  className="cursor-pointer"
                                >
                                  <div className="flex flex-col items-start w-full">
                                    <div className="flex items-center justify-between w-full">
                                      <div className="flex items-center">
                                        <Check className={cn("mr-2 h-4 w-4", newItemProductId === product.id ? "opacity-100" : "opacity-0")} />
                                        <span className="font-medium">{product.name} ({product.code})</span>
                                      </div>
                                      <span className="text-xs font-bold text-primary">₹{product.dp.toFixed(2)}</span>
                                    </div>
                                    <div className="text-xs text-muted-foreground ml-6">GST: {product.gst}% - Stock: {product.closing_stock}</div>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-end">
                  <div><Label>Quantity</Label><Input type="number" value={newItemQuantity} onChange={(e) => setNewItemQuantity(parseInt(e.target.value) || 1)} min="1" /></div>
                  <div><Label>Unit Price (DP)</Label><Input type="number" step="0.01" value={newItemUnitPrice} onChange={(e) => setNewItemUnitPrice(parseFloat(e.target.value) || 0)} min="0" /></div>
                  <div><Label>Discount (%)</Label><div className="relative"><Input type="number" step="0.1" value={newItemDiscountPercent} onChange={(e) => setNewItemDiscountPercent(parseFloat(e.target.value) || 0)} min="0" max="100" className="pr-8" /><Percent className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /></div></div>
                  <div className="flex flex-col gap-1"><Label className="text-xs text-muted-foreground">Item Total (Inc. Tax)</Label><div className="h-10 flex items-center px-3 border rounded-md bg-background font-bold text-green-600">₹{newItemCalculations.totalPrice.toFixed(2)}</div></div>
                </div>
                <Button type="button" onClick={addOrderItem} disabled={isSubmitting} className="w-full"><Plus className="h-4 w-4 mr-2" /> Add to Order</Button>
              </div>

              {orderItems.length > 0 && (
                <div className="max-h-[350px] overflow-y-auto border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="w-24">Qty</TableHead>
                        <TableHead className="w-32">DP (₹)</TableHead>
                        <TableHead className="w-24">Disc %</TableHead>
                        <TableHead className="w-24">GST %</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderItems.map(item => (
                        <TableRow key={item.id}>
                          <TableCell className="max-w-[150px] truncate font-medium">{item.product_name} ({item.product_code})</TableCell>
                          <TableCell><Input type="number" value={item.quantity} onChange={(e) => updateOrderItem(item.id, 'quantity', parseInt(e.target.value) || 0)} className="h-8" disabled={isSubmitting} /></TableCell>
                          <TableCell><Input type="number" step="0.01" value={item.unit_dp} onChange={(e) => updateOrderItem(item.id, 'unit_dp', parseFloat(e.target.value) || 0)} className="h-8" disabled={isSubmitting} /></TableCell>
                          <TableCell><Input type="number" step="0.1" value={item.discount_percent} onChange={(e) => updateOrderItem(item.id, 'discount_percent', parseFloat(e.target.value) || 0)} className="h-8" disabled={isSubmitting} /></TableCell>
                          <TableCell className="text-center">{item.gst_percent}%</TableCell>
                          <TableCell className="text-right font-bold text-green-600">₹{item.total_price.toFixed(2)}</TableCell>
                          <TableCell><Button variant="ghost" size="icon" onClick={() => removeOrderItem(item.id)} disabled={isSubmitting}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <div className="p-4 bg-muted rounded-md space-y-2">
              <div className="flex justify-between text-sm"><span>Taxable Value (Excl. GST):</span><span>₹{totalTaxableValue.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm"><span>Total GST:</span><span>₹{totalGstAmount.toFixed(2)}</span></div>
              <Separator className="my-1" />
              <div className="flex justify-between text-base font-medium"><span>Subtotal (Incl. GST):</span><span>₹{preGlobalDiscountTotal.toFixed(2)}</span></div>
              <div className="flex justify-between items-center">
                <Label htmlFor="discountAmount" className="text-base font-medium">Additional Global Discount (₹)</Label>
                <Input id="discountAmount" type="number" step="0.01" value={discountAmount} onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)} className="w-32 text-right" min="0" max={preGlobalDiscountTotal} disabled={isSubmitting} />
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between text-lg font-bold"><span>Total Order Value:</span><span>₹{finalOrderValue.toFixed(2)}</span></div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSubmitting || orderItems.length === 0}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditOrderDialog;