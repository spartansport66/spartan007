"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Trash2, Check, ChevronsUpDown, Percent, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSession } from '@/contexts/SessionContext';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';

interface Product {
  id: string;
  code: string;
  name: string;
  dp: number;
  closing_stock: number;
  gst: string;
}

interface Dealer {
  id: string;
  name: string;
}

interface SalesPerson {
  id: string;
  first_name: string;
  last_name: string;
  user_type: string;
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
  order_date: string;
  dealer_id: string;
  user_id: string;
  total_amount: number;
  discount_amount: number;
  round_off: number;
  bill_no: string | null;
  dispatch_date: string | null;
  items: OrderItem[];
  is_online: boolean;
  raw_item_name?: string | null;
  mapped_product_id?: string | null;
  client_name?: string | null;
  platform_order_number?: string | null;
}

interface EditOrderDialogProps {
  orderId: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderUpdated: () => void;
}

const formSchema = z.object({
  orderNumber: z.preprocess((val) => Number(val), z.number().int().min(1, { message: 'Order number must be at least 1.' })),
  orderDate: z.string().min(1, { message: 'Order date is required.' }),
  dealerId: z.string().uuid({ message: 'Please select a dealer.' }),
  salesPersonId: z.string().uuid({ message: 'Please select a sales person.' }),
  discountAmount: z.preprocess((val) => Number(val), z.number().min(0)),
  billNo: z.string().nullable().optional(),
  dispatchDate: z.string().nullable().optional(),
  roundOff: z.preprocess((val) => Number(val), z.number().default(0)),
  clientName: z.string().optional(),
});

// Helper function to fetch all products with pagination
const fetchAllProducts = async (): Promise<Product[]> => {
  let allProducts: Product[] = [];
  let page = 0;
  const pageSize = 1000; // A common page size for Supabase
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('products')
      .select('id, code, name, dp, closing_stock, gst')
      .order('name', { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error("Error fetching products page:", error);
      throw error;
    }

    if (data) {
      allProducts.push(...data);
    }

    if (!data || data.length < pageSize) {
      hasMore = false;
    } else {
      page++;
    }
  }
  return allProducts;
};

const EditOrderDialog: React.FC<EditOrderDialogProps> = ({ orderId, isOpen, onOpenChange, onOrderUpdated }) => {
  const { user, session } = useSession();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<SalesPerson[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [orderData, setOrderData] = useState<OrderToEdit | null>(null);

  const [isProductPopoverOpen, setIsProductPopoverOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [newItemProductId, setNewItemProductId] = useState<string>('');
  const [newItemQuantity, setNewItemQuantity] = useState<number>(1);
  const [newItemUnitPrice, setNewItemUnitPrice] = useState<number>(0);
  const [newItemDiscountPercent, setNewItemDiscountPercent] = useState<string>('0');
  const [newItemGstPercent, setNewItemGstPercent] = useState<string>('0');

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      orderNumber: 0,
      orderDate: '',
      dealerId: '',
      salesPersonId: '',
      discountAmount: 0,
      billNo: '',
      dispatchDate: '',
      roundOff: 0,
      clientName: '',
    },
  });

  const fetchInitialData = useCallback(async () => {
    try {
      const [productsData, dealersRes, usersRes] = await Promise.all([
        fetchAllProducts(),
        supabase.from('dealers').select('id, name').order('name'),
        supabase.from('profiles').select('id, first_name, last_name, user_type').in('user_type', ['sales_person', 'online_orders', 'admin']).order('first_name'),
      ]);

      if (dealersRes.error) throw dealersRes.error;
      if (usersRes.error) throw usersRes.error;

      setProducts(productsData || []);
      setDealers(dealersRes.data || []);
      setAssignableUsers(usersRes.data || []);
    } catch (error: any) {
      console.error('Error fetching initial data:', error.message);
      showError('Failed to load form data.');
    }
  }, []);

  const fetchOrderDetails = useCallback(async (id: string) => {
    setLoading(true);
    try {
      // Do NOT request the embedded `online_order_details` relation here because
      // Supabase will error if the DB schema cache has no FK between `orders` and
      // `online_order_details`. Fetch sales and dealer info only, then fetch
      // online details separately when needed.
      const { data: orderRaw, error: orderError } = await supabase
        .from('orders')
        .select(`
          id, order_number, order_date, dealer_id, user_id, total_amount, discount_amount, round_off, bill_no, dispatch_date, urgent,
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

      const isOnline = (orderRaw.dealers as any)?.name === 'Online Order';
      let onlineDetails = orderRaw.online_order_details?.[0];

      // If DB schema doesn't expose the embedded relation (missing FK in schema cache),
      // fall back to fetching online details explicitly (same pattern as OrderDetailsDialog).
      if (isOnline && !onlineDetails) {
        try {
          const { data: onlineData, error: onlineError } = await supabase
            .from('online_order_details')
            .select(`
              client_name,
              platform_order_number,
              contact_no,
              city,
              state,
              address,
              raw_item_name,
              mapped_product_id,
              products (name, code),
              online_platforms (name)
            `)
            .eq('order_id', id)
            .single();

          if (onlineData && !onlineError) {
            onlineDetails = onlineData as any;
          } else if (onlineError && onlineError.code !== 'PGRST116') {
            console.error('Error fetching online order details fallback:', onlineError);
          }
        } catch (err) {
          console.error('Fallback fetch online order details failed:', err);
        }
      }

      const orderToSet: OrderToEdit = {
        ...orderRaw,
        items: fetchedItems,
        is_online: isOnline,
        raw_item_name: onlineDetails?.raw_item_name,
        mapped_product_id: onlineDetails?.mapped_product_id,
        client_name: onlineDetails?.client_name,
        platform_order_number: onlineDetails?.platform_order_number,
      };
      setOrderData(orderToSet);
      
      setOrderItems(fetchedItems);
      
      const defaultSalesPersonId = (isOnline && user) ? user.id : orderRaw.user_id;

      form.reset({
        orderNumber: orderRaw.order_number,
        orderDate: orderRaw.order_date ? orderRaw.order_date.split('T')[0] : '',
        dealerId: orderRaw.dealer_id,
        salesPersonId: defaultSalesPersonId,
        discountAmount: orderRaw.discount_amount || 0,
        billNo: orderRaw.bill_no || '',
        dispatchDate: orderRaw.dispatch_date ? orderRaw.dispatch_date.split('T')[0] : '',
        roundOff: orderRaw.round_off || 0,
        clientName: onlineDetails?.client_name || '',
      });

    } catch (error: any) {
      console.error('Error fetching order details:', error.message);
      showError(`Failed to load order details: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [form, user]);

  useEffect(() => {
    if (isOpen && orderId) {
      fetchInitialData();
      fetchOrderDetails(orderId);
    }
  }, [isOpen, orderId, fetchInitialData, fetchOrderDetails]);

  const totalTaxableValue = useMemo(() => {
    return orderItems.reduce((total, item) => total + item.taxable_value, 0);
  }, [orderItems]);

  const totalGstAmount = useMemo(() => {
    return orderItems.reduce((total, item) => total + item.gst_amount, 0);
  }, [orderItems]);

  const preGlobalDiscountTotal = useMemo(() => {
    return orderItems.reduce((total, item) => total + item.total_price, 0);
  }, [orderItems]);

  const discountAmountValue = form.watch('discountAmount');
  const roundOffValue = form.watch('roundOff');

  useEffect(() => {
    const subtotalAfterDiscount = preGlobalDiscountTotal - (Number(discountAmountValue) || 0);
    const roundedTotal = Math.round(subtotalAfterDiscount);
    const calculatedRoundOff = roundedTotal - subtotalAfterDiscount;
    form.setValue('roundOff', parseFloat(calculatedRoundOff.toFixed(2)));
  }, [preGlobalDiscountTotal, discountAmountValue, form]);

  const finalOrderValue = useMemo(() => {
    const discount = Number(discountAmountValue) || 0;
    const roundOff = Number(roundOffValue) || 0;
    return Math.max(0, preGlobalDiscountTotal - discount + roundOff);
  }, [preGlobalDiscountTotal, discountAmountValue, roundOffValue]);

  const newItemCalculations = useMemo(() => {
    const discPercent = parseFloat(newItemDiscountPercent as any) || 0;
    const gstPercent = parseFloat(newItemGstPercent as any) || 0;
    const taxableUnitPrice = newItemUnitPrice * (1 - discPercent / 100);
    const taxableValue = taxableUnitPrice * newItemQuantity;
    const gstAmount = (taxableValue * gstPercent) / 100;
    const totalPrice = taxableValue + gstAmount;

    return { taxableValue, gstAmount, totalPrice };
  }, [newItemUnitPrice, newItemDiscountPercent, newItemQuantity, newItemGstPercent]);

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
      discount_percent: parseFloat(newItemDiscountPercent as any) || 0,
      gst_percent: parseFloat(newItemGstPercent as any) || 0,
      taxable_value: newItemCalculations.taxableValue,
      gst_amount: newItemCalculations.gstAmount,
      total_price: newItemCalculations.totalPrice,
    };
    setOrderItems(prevItems => [...prevItems, newOrderItem]);
    setNewItemProductId('');
    setNewItemQuantity(1);
    setNewItemUnitPrice(0);
    setNewItemDiscountPercent('0');
    setNewItemGstPercent('0');
  };

  const updateOrderItem = (id: string, field: keyof OrderItem, value: number) => {
    setOrderItems(prev => prev.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        const discount = (updatedItem.unit_dp * updatedItem.discount_percent) / 100;
        const discountedUnitPrice = Math.max(0, updatedItem.unit_dp - discount);
        updatedItem.taxable_value = discountedUnitPrice * updatedItem.quantity;
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

  const handleSave = async (values: z.infer<typeof formSchema>) => {
    if (!orderData) return;
    if (!orderData.is_online && orderItems.length === 0) {
      showError('Order must have at least one item.');
      return;
    }
    setIsSubmitting(true);

    try {
      const finalDiscountAmount = parseFloat(values.discountAmount.toFixed(2));
      const finalOrderAmount = parseFloat(finalOrderValue.toFixed(2));

      // 1. Update Order
      const { error: orderUpdateError } = await supabase
        .from('orders')
        .update({
          order_number: values.orderNumber,
          order_date: values.orderDate,
          dealer_id: values.dealerId,
          user_id: values.salesPersonId,
          total_amount: finalOrderAmount,
          discount_amount: finalDiscountAmount,
          round_off: values.roundOff,
          bill_no: values.billNo || null,
          dispatch_date: values.dispatchDate || null,
        })
        .eq('id', orderData.id);

      if (orderUpdateError) throw orderUpdateError;

      // 2. Update Online Details if applicable
      if (orderData.is_online) {
        const { error: onlineUpdateError } = await supabase
          .from('online_order_details')
          .update({
            client_name: values.clientName,
          })
          .eq('order_id', orderData.id);
        if (onlineUpdateError) throw onlineUpdateError;
      }

      // 3. Update Sales Items (only if not online or if already dispatched)
      // For online orders, we only insert into sales at Gate Pass time if not already there.
      // But if the user is editing an existing order with sales, we update them.
      if (orderItems.length > 0) {
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
      }

      // 4. Update Payment
      const { data: payment } = await supabase
        .from('payments')
        .select('id')
        .eq('order_id', orderData.id)
        .eq('status', 'pending_approval')
        .maybeSingle();

      if (payment) {
        await supabase
          .from('payments')
          .update({ amount: finalOrderAmount, dealer_id: values.dealerId })
          .eq('id', payment.id);
      }

      showSuccess(`Order #${values.orderNumber} updated successfully.`);
      onOrderUpdated();
      onOpenChange(false);

    } catch (error: any) {
      console.error('Error saving order changes:', error);
      showError(`Failed to save order changes: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentSalesPersonId = form.watch('salesPersonId');
  
  const userListToRender = useMemo(() => {
    if (!orderData) return [];
    
    let filteredList: SalesPerson[];
    if (orderData.is_online) {
      filteredList = assignableUsers.filter(u => u.user_type === 'online_orders' || u.user_type === 'admin');
    } else {
      filteredList = assignableUsers.filter(u => u.user_type === 'sales_person');
    }

    const isCurrentUserInList = filteredList.some(u => u.id === currentSalesPersonId);
    if (!isCurrentUserInList && currentSalesPersonId) {
      const currentUser = assignableUsers.find(u => u.id === currentSalesPersonId);
      if (currentUser) {
        return [...filteredList, currentUser];
      }
    }
    
    return filteredList;
  }, [orderData, assignableUsers, currentSalesPersonId]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] md:max-w-[800px] lg:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Order #{orderData?.order_number}</DialogTitle>
          <DialogDescription>
            Modify items, discounts, billing info, and order details.
          </DialogDescription>
        </DialogHeader>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSave)} className="space-y-6 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="orderNumber" render={({ field }) => (<FormItem><FormLabel>Order Number</FormLabel><FormControl><Input type="number" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="orderDate" render={({ field }) => (<FormItem><FormLabel>Order Date</FormLabel><FormControl><Input type="date" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="dealerId" render={({ field }) => (<FormItem><FormLabel>Dealer</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Dealer" /></SelectTrigger></FormControl><SelectContent>{dealers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="salesPersonId" render={({ field }) => (<FormItem><FormLabel>{orderData?.is_online ? 'Operator' : 'Sales Person'}</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder={orderData?.is_online ? 'Select Operator' : 'Select Sales Person'} /></SelectTrigger></FormControl><SelectContent>{userListToRender.map(op => <SelectItem key={op.id} value={op.id}>{op.first_name} {op.last_name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="billNo" render={({ field }) => (<FormItem><FormLabel>Bill Number</FormLabel><FormControl><Input placeholder="e.g., INV-001" {...field} value={field.value || ''} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="dispatchDate" render={({ field }) => (<FormItem><FormLabel>Bill Date (Dispatch Date)</FormLabel><FormControl><Input type="date" {...field} value={field.value || ''} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)} />
                {/* Urgent flag is managed by HOD only; removed from normal edit dialog */}
              </div>

              {orderData?.is_online && (
                <div className="p-4 border rounded-md bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 space-y-4">
                  <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">Online Order Details</h3>
                  <div className="space-y-2">
                    <Label>Platform Order #</Label>
                    <Input value={orderData.platform_order_number || 'N/A'} readOnly className="bg-muted" />
                  </div>
                  <FormField control={form.control} name="clientName" render={({ field }) => (<FormItem><FormLabel>Customer Name</FormLabel><FormControl><Input placeholder="Enter customer name" {...field} value={field.value || ''} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)} />
                  <p className="text-sm text-yellow-700 dark:text-yellow-300"><strong>Extracted Item:</strong> {orderData.raw_item_name}</p>
                </div>
              )}

              <Separator />

              <div className="space-y-4">
                <Label className="text-lg font-semibold">Add/Modify Items</Label>
                <div className="flex flex-col gap-4 p-4 border rounded-md bg-muted/50">
                  <div className="w-full">
                    <Label>Product</Label>
                    <Popover open={isProductPopoverOpen} onOpenChange={setIsProductPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="w-full justify-between" disabled={isSubmitting}>{currentProductDisplay}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <div className="p-2 border-b flex items-center gap-2"><Search className="h-4 w-4 text-muted-foreground" /><Input placeholder="Search product..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="h-8 border-none focus-visible:ring-0" /></div>
                        <ScrollArea className="h-[250px]"><div className="p-1">
                          {filteredProducts.map((product) => (
                            <Button
                              key={product.id}
                              variant="ghost"
                              className="w-full justify-start font-normal h-auto py-2"
                              onClick={() => {
                                const rawGst = parseFloat(product.gst) || 0;
                                const gstNormalized = rawGst > 0 && rawGst <= 1 ? rawGst * 100 : rawGst;
                                setNewItemProductId(product.id);
                                setNewItemUnitPrice(product.dp);
                                setNewItemGstPercent(String(gstNormalized));
                                setIsProductPopoverOpen(false);
                                setProductSearch('');
                              }}
                            >
                              <div className="flex flex-col items-start w-full">
                                <div className="flex items-center justify-between w-full gap-2">
                                  <div className="flex items-center min-w-0">
                                    <Check className={cn("mr-2 h-4 w-4 flex-shrink-0", newItemProductId === product.id ? "opacity-100" : "opacity-0")} />
                                    <span className="font-medium truncate">{product.name}</span>
                                  </div>
                                </div>
                                <div className="text-[10px] text-muted-foreground ml-6 flex flex-wrap gap-x-3 gap-y-1">
                                  <span className="bg-muted px-1 rounded font-mono">Code: {product.code}</span>
                                  <span className="font-semibold text-primary">DP: ₹{product.dp.toFixed(2)}</span>
                                  <span>Stock: {product.closing_stock}</span>
                                </div>
                              </div>
                            </Button>
                          ))}
                        </div></ScrollArea>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 items-end">
                    <div><Label>Quantity</Label><Input type="number" value={newItemQuantity} onChange={(e) => setNewItemQuantity(parseInt(e.target.value) || 1)} min="1" /></div>
                    <div><Label>Unit Price (DP)</Label><Input type="number" step="0.01" value={newItemUnitPrice} onChange={(e) => setNewItemUnitPrice(parseFloat(e.target.value) || 0)} min="0" /></div>
                    <div><Label>Discount (%)</Label><div className="relative"><Input type="number" step="0.1" value={newItemDiscountPercent} onChange={(e) => setNewItemDiscountPercent(e.target.value)} min="0" max="100" className="pr-8" /><Percent className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /></div></div>
                    <div><Label>GST (%)</Label><Input type="number" step="0.1" value={newItemGstPercent} onChange={(e) => setNewItemGstPercent(e.target.value)} min="0" /></div>
                    <div className="flex flex-col gap-1"><Label className="text-xs text-muted-foreground">Item Total</Label><div className="h-10 flex items-center px-3 border rounded-md bg-background font-bold text-green-600">₹{newItemCalculations.totalPrice.toFixed(2)}</div></div>
                  </div>
                  <Button type="button" onClick={addOrderItem} disabled={isSubmitting} className="w-full"><Plus className="h-4 w-4 mr-2" /> Add to Order</Button>
                </div>

                {orderItems.length > 0 && (
                  <div className="max-h-[350px] overflow-y-auto border rounded-md">
                    <Table>
                      <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="w-24">Qty</TableHead><TableHead className="w-32">DP (Rs.)</TableHead><TableHead className="w-24">Disc %</TableHead><TableHead className="w-24">GST %</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
                      <TableBody>
                        {orderItems.map(item => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.product_name} ({item.product_code})</TableCell>
                            <TableCell><Input type="number" value={item.quantity} onChange={(e) => updateOrderItem(item.id, 'quantity', parseInt(e.target.value) || 0)} className="h-8" disabled={isSubmitting} /></TableCell>
                            <TableCell><Input type="number" step="0.01" value={item.unit_dp} onChange={(e) => updateOrderItem(item.id, 'unit_dp', parseFloat(e.target.value) || 0)} className="h-8" disabled={isSubmitting} /></TableCell>
                            <TableCell><Input type="number" step="0.1" value={item.discount_percent} onChange={(e) => updateOrderItem(item.id, 'discount_percent', parseFloat(e.target.value) || 0)} className="h-8" disabled={isSubmitting} /></TableCell>
                            <TableCell><Input type="number" step="0.1" value={item.gst_percent} onChange={(e) => updateOrderItem(item.id, 'gst_percent', parseFloat(e.target.value) || 0)} className="h-8" disabled={isSubmitting} /></TableCell>
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
                <FormField control={form.control} name="discountAmount" render={({ field }) => (<FormItem className="flex justify-between items-center"><FormLabel className="text-base font-medium">Additional Global Discount (Rs.)</FormLabel><FormControl><Input type="number" step="0.01" {...field} className="w-32 text-right" min="0" max={preGlobalDiscountTotal} disabled={isSubmitting} /></FormControl></FormItem>)} />
                <FormField control={form.control} name="roundOff" render={({ field }) => (<FormItem className="flex justify-between items-center"><FormLabel className="text-base font-medium">Round Off (+/-)</FormLabel><FormControl><Input type="number" step="0.01" {...field} className="w-32 text-right" disabled={isSubmitting} /></FormControl></FormItem>)} />
                <Separator className="my-2" />
                <div className="flex justify-between text-lg font-bold"><span>Total Order Value:</span><span>₹{finalOrderValue.toFixed(2)}</span></div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EditOrderDialog;