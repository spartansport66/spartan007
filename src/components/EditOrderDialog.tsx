"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2, Check, ChevronsUpDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

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
  quantity: number;
  total_price: number; // Price at time of order (quantity * DP)
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
          id, order_number, total_amount, discount_amount,
          dealers (name),
          sales (product_id, quantity, total_price, products (dp))
        `)
        .eq('id', id)
        .single();

      if (orderError) throw orderError;

      const fetchedItems: OrderItem[] = (orderRaw.sales || []).map((sale: any, index: number) => ({
        id: `${sale.product_id}-${index}`, // Use a unique ID for the list
        product_id: sale.product_id,
        quantity: sale.quantity,
        total_price: sale.total_price,
      }));

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
    }
  }, [isOpen, orderId, fetchOrderAndProducts]);

  const calculateItemTotal = (item: OrderItem) => {
    const product = products.find(p => p.id === item.product_id);
    return product ? item.quantity * product.dp : 0;
  };

  const calculateTotalOrderValue = (items: OrderItem[]) => {
    return items.reduce((total, item) => total + calculateItemTotal(item), 0);
  };

  const preDiscountTotalOrderValue = calculateTotalOrderValue(orderItems);
  const finalOrderValue = Math.max(0, preDiscountTotalOrderValue - discountAmount);

  const addOrderItem = () => {
    const newId = Date.now().toString();
    setOrderItems([...orderItems, { id: newId, product_id: '', quantity: 1, total_price: 0 }]);
    setPopoverOpenStates(prev => ({ ...prev, [newId]: false }));
  };

  const removeOrderItem = (id: string) => {
    if (orderItems.length > 1) {
      setOrderItems(orderItems.filter(item => item.id !== id));
      setPopoverOpenStates(prev => {
        const newState = { ...prev };
        delete newState[id];
        return newState;
      });
    }
  };

  const updateOrderItem = (id: string, field: keyof OrderItem, value: string | number) => {
    setOrderItems(prevItems => prevItems.map(item => {
      if (item.id === id) {
        let updatedItem = { ...item };
        
        if (field === 'quantity') {
          // Ensure quantity is stored as a number (integer)
          updatedItem.quantity = Math.round(typeof value === 'string' ? parseFloat(value) || 0 : value);
        } else if (field === 'product_id') {
          // Ensure product_id is stored as a string (UUID)
          updatedItem.product_id = String(value);
        } else {
          // For other fields (like total_price, which is calculated), assign directly
          updatedItem = { ...item, [field]: value };
        }

        // Recalculate total_price if quantity or product_id changed
        if (field === 'quantity' || field === 'product_id') {
          const product = products.find(p => p.id === updatedItem.product_id);
          // Use the now guaranteed number type for quantity
          updatedItem.total_price = product ? updatedItem.quantity * product.dp : 0;
        }
        return updatedItem;
      }
      return item;
    }));
  };

  const filteredProducts = useMemo(() => {
    if (!searchValue) return products;
    const lowerCaseSearchValue = searchValue.toLowerCase();
    const searchWords = lowerCaseSearchValue.split(' ').filter(word => word.length > 0);

    return products.filter(product => {
      const productName = product.name.toLowerCase();
      const productCode = product.code.toLowerCase();
      return searchWords.some(word => 
        productName.includes(word) || productCode.includes(word)
      );
    });
  }, [products, searchValue]);

  const handleSave = async () => {
    if (!orderData || orderItems.some(item => !item.product_id || item.quantity <= 0)) {
      showError('Please ensure all order items have a selected product and positive quantity.');
      return;
    }
    if (discountAmount < 0 || discountAmount > preDiscountTotalOrderValue) {
      showError('Invalid discount amount.');
      return;
    }
    if (orderItems.length === 0) {
        showError('Order must contain at least one item.');
        return;
    }

    setIsSubmitting(true);

    try {
      // 1. Calculate final amounts
      const finalDiscountAmount = parseFloat(discountAmount.toFixed(2));
      const finalOrderAmount = parseFloat(finalOrderValue.toFixed(2));

      // 2. Update the main order record
      const { error: orderUpdateError } = await supabase
        .from('orders')
        .update({
          total_amount: finalOrderAmount,
          discount_amount: finalDiscountAmount,
          // Removed updated_at: new Date().toISOString(), to avoid schema cache error
        })
        .eq('id', orderData.id);

      if (orderUpdateError) throw new Error(`Failed to update order: ${orderUpdateError.message}`);

      // 3. Manage sales items (delete existing, insert new)
      
      // A. Delete existing sales items for this order
      const { error: deleteSalesError } = await supabase
        .from('sales')
        .delete()
        .eq('order_id', orderData.id);
        
      if (deleteSalesError) throw new Error(`Failed to delete old sales items: ${deleteSalesError.message}`);

      // B. Prepare new sales items
      const salesToInsert = [];
      
      for (const item of orderItems) {
        salesToInsert.push({
          order_id: orderData.id,
          product_id: item.product_id,
          quantity: item.quantity,
          total_price: item.total_price, // Use the calculated total price
        });
      }

      // C. Insert new sales items
      const { error: salesInsertError } = await supabase
        .from('sales')
        .insert(salesToInsert);
        
      if (salesInsertError) throw new Error(`Failed to insert new sales items: ${salesInsertError.message}`);

      showSuccess(`Order #${orderData.order_number} updated successfully!`);
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

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading order details...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!orderData) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <p className="text-center text-red-500 py-8">Failed to load order data.</p>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Order #{orderData.order_number}</DialogTitle>
          <DialogDescription>
            Modify items and discount for the order placed by {orderData.dealer_name}.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Order Items Section */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label className="text-lg font-semibold">Order Items</Label>
              <Button
                type="button"
                onClick={addOrderItem}
                size="sm"
                className="flex items-center gap-1"
                disabled={isSubmitting}
              >
                <Plus className="h-4 w-4" />
                Add Item
              </Button>
            </div>

            {orderItems.map((item, index) => {
              const product = products.find(p => p.id === item.product_id);
              const itemTotal = calculateItemTotal(item);
              
              return (
                <div key={item.id} className="space-y-3 p-4 border rounded-md bg-muted/50">
                  <div className="flex items-end gap-2">
                    <div className="flex-grow">
                      <Label>Product Selection</Label>
                      <Popover 
                        open={popoverOpenStates[item.id]} 
                        onOpenChange={(openState) => {
                          setPopoverOpenStates(prev => ({ ...prev, [item.id]: openState }));
                          if (openState) {
                            setSearchValue("");
                          }
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={popoverOpenStates[item.id]}
                            className="w-full justify-between"
                            disabled={products.length === 0 || loading || isSubmitting}
                          >
                            {product?.name || "Select product..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                          <Command>
                            <CommandInput
                              placeholder="Search product..."
                              value={searchValue}
                              onValueChange={setSearchValue}
                            />
                            <CommandList className="max-h-[300px] overflow-y-auto">
                              {filteredProducts.length === 0 ? (
                                <CommandEmpty>No product found.</CommandEmpty>
                              ) : (
                                <CommandGroup>
                                  {filteredProducts.map((p) => (
                                    <CommandItem
                                      key={p.id}
                                      value={`${p.name} ${p.code}`} 
                                      onSelect={() => {
                                        updateOrderItem(item.id, 'product_id', p.id);
                                        setPopoverOpenStates(prev => ({ ...prev, [item.id]: false }));
                                        setSearchValue("");
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          item.product_id === p.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <div>
                                        <div>{p.name} ({p.code})</div>
                                        <div className="text-xs text-muted-foreground">
                                          DP: ₹{p.dp.toFixed(2)} - Stock: {p.stock}
                                        </div>
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
                    {orderItems.length > 1 && (
                      <div className="flex-shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeOrderItem(item.id)}
                          className="h-9 w-9"
                          disabled={isSubmitting}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-4 items-end">
                    <div>
                      <Label htmlFor={`quantity-${item.id}`}>Quantity</Label>
                      <Input
                        id={`quantity-${item.id}`}
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateOrderItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                        min="1"
                        className="w-full"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div>
                      <Label>Unit Price (DP)</Label>
                      <div className="font-medium text-lg">₹{product?.dp.toFixed(2) || '0.00'}</div>
                    </div>
                    <div>
                      <Label>Item Total</Label>
                      <div className="font-medium text-lg">₹{itemTotal.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary and Discount */}
          <div className="p-4 bg-muted rounded-md space-y-2">
            <div className="flex justify-between text-base font-medium">
              <span>Subtotal (Pre-Discount):</span>
              <span>₹{preDiscountTotalOrderValue.toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <Label htmlFor="discountAmount" className="text-base font-medium">Discount (₹)</Label>
              <Input
                id="discountAmount"
                type="number"
                step="0.01"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                className="w-32 text-right"
                min="0"
                max={preDiscountTotalOrderValue}
                disabled={isSubmitting}
              />
            </div>
            {discountAmount > preDiscountTotalOrderValue && (
              <p className="text-sm text-destructive">Discount cannot exceed subtotal.</p>
            )}
            
            <Separator className="my-2" />
            
            <div className="flex justify-between text-lg font-bold">
              <span>Total Order Value (Final):</span>
              <span>₹{finalOrderValue.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSave} disabled={isSubmitting || orderItems.length === 0 || discountAmount < 0 || discountAmount > preDiscountTotalOrderValue}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditOrderDialog;