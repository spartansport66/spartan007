"use client";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { Loader2, Plus, Trash2, Check, ChevronsUpDown, Search, Percent } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatCurrency } from '@/utils/formatters';
import ProductSearchSelector from './ProductSearchSelector';

const SEND_ORDER_NOTIFICATION_URL = "https://hxftiocfihhdutciaisl.supabase.co/functions/v1/send-order-notification";

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
  credit_limit: number;
  allotted_credit_days: number;
  opening_balance: number;
}

interface Platform {
  id: string;
  name: string;
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

interface MultiItemOrderFormProps {
  onOrderPlaced: () => void;
}

const MultiItemOrderForm: React.FC<MultiItemOrderFormProps> = ({ onOrderPlaced }) => {
  const { user, session, loading: sessionLoading } = useSession();
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [selectedDealer, setSelectedDealer] = useState<string>('');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [dealerBalance, setDealerBalance] = useState<number | null>(null);
  const [dealerCreditLimit, setDealerCreditLimit] = useState<number>(0);
  const [allottedCreditDays, setAllottedCreditDays] = useState<number>(0);
  const [paymentDueDate, setPaymentDueDate] = useState<string | null>(null);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [roundOff, setRoundOff] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [chequeDdNo, setChequeDdNo] = useState<string>('');
  const [chequeDdDate, setChequeDdDate] = useState<string>('');
  const [transactionId, setTransactionId] = useState<string>('');
  
  const [isDealerPopoverOpen, setIsDealerPopoverOpen] = useState(false);
  const [dealerSearch, setDealerSearch] = useState('');
  
  const [isProductPopoverOpen, setIsProductPopoverOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [newItemProductId, setNewItemProductId] = useState<string>('');
  const [newItemQuantity, setNewItemQuantity] = useState<number>(1);
  const [newItemUnitPrice, setNewItemUnitPrice] = useState<number>(0);
  const [newItemDiscountPercent, setNewItemDiscountPercent] = useState<number>(0);
  const [newItemGstPercent, setNewItemGstPercent] = useState<number>(0);

  // State for online order fields
  const [isOnlineOrder, setIsOnlineOrder] = useState(false);
  const [clientName, setClientName] = useState('');
  const [platformId, setPlatformId] = useState('');
  const [platformOrderNumber, setPlatformOrderNumber] = useState('');
  const [contactNo, setContactNo] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

  const paymentMethodsOptions = ['Cash', 'Card', 'Bank Transfer', 'UPI', 'Cheque/DD', 'COD'];

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
    return Math.max(0, preGlobalDiscountTotal - discountAmount + roundOff);
  }, [preGlobalDiscountTotal, discountAmount, roundOff]);

  useEffect(() => {
    setPaymentAmount(parseFloat(finalOrderValue.toFixed(2)));
  }, [finalOrderValue]);

  const isPaymentDetailsValid = useMemo(() => {
    if (!paymentMethod) return false;
    if (paymentMethod === 'Cheque/DD') {
      return !!chequeDdNo && !!chequeDdDate;
    }
    if (['Card', 'Bank Transfer', 'UPI'].includes(paymentMethod)) {
      return !!transactionId;
    }
    return true;
  }, [paymentMethod, chequeDdNo, chequeDdDate, transactionId]);

  const fetchProducts = useCallback(async () => {
    try {
      const allProducts: Product[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('id, code, name, dp, closing_stock, gst')
          .order('name', { ascending: true })
          .range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (productsError) throw productsError;

        if (productsData) {
          allProducts.push(...productsData);
        }

        if (!productsData || productsData.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      }
      setProducts(allProducts);
    } catch (error: any) {
      console.error('fetchProducts Error:', error);
      showError(`Failed to load products: ${error.message}`);
    }
  }, []);

  const fetchData = useCallback(async () => {
    if (!user || !session) return;
    setLoading(true);
    try {
      const { data: assignedDealersData, error: assignedDealersError } = await supabase
        .from('dealer_sales_persons')
        .select('dealers(id, name, credit_limit, allotted_credit_days, dealer_balances(opening_balance))')
        .eq('sales_person_id', user.id);

      if (assignedDealersData) {
        const formattedDealers = assignedDealersData
          .map((item: any) => {
            if (!item.dealers) return null;
            const opening_balance = item.dealers.dealer_balances?.opening_balance || 0;
            const { dealer_balances, ...dealerData } = item.dealers;
            return { ...dealerData, opening_balance };
          })
          .filter(Boolean) as Dealer[];
        
        formattedDealers.sort((a, b) => a.name.localeCompare(b.name));
        setDealers(formattedDealers);
      }

      const { data: platformsData, error: platformsError } = await supabase.from('online_platforms').select('*');
      if (platformsError) throw platformsError;
      setPlatforms(platformsData || []);

      await fetchProducts();

    } catch (error: any) {
      console.error('fetchData Error:', error);
      showError(`Failed to load data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [user, session, fetchProducts]);

  useEffect(() => {
    if (!sessionLoading && user) fetchData();
  }, [user, session, sessionLoading, fetchData]);

  useEffect(() => {
    const calculateBalanceAndDueDate = async () => {
      if (!selectedDealer || !user) {
        setDealerBalance(null);
        setDealerCreditLimit(0);
        setAllottedCreditDays(0);
        setPaymentDueDate(null);
        setDiscountAmount(0);
        setIsOnlineOrder(false);
        return;
      }
      const selectedDealerData = dealers.find(d => d.id === selectedDealer);
      if (selectedDealerData) {
        setIsOnlineOrder(selectedDealerData.name === 'Online Order');
        setAllottedCreditDays(selectedDealerData.allotted_credit_days);
        const today = new Date();
        const dueDate = new Date(today);
        dueDate.setDate(today.getDate() + selectedDealerData.allotted_credit_days);
        setPaymentDueDate(dueDate.toISOString().split('T')[0]);
      }
      
      const currentMonthDate = new Date();
      const currentMonthYear = new Date(Date.UTC(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), 1)).toISOString().split('T')[0];
      
      try {
        const { data: monthlyLimitData } = await supabase
          .from('dealer_monthly_credit_limits')
          .select('credit_limit')
          .eq('dealer_id', selectedDealer)
          .eq('month_year', currentMonthYear)
          .single();
        
        setDealerCreditLimit(monthlyLimitData?.credit_limit || selectedDealerData?.credit_limit || 0);

        const openingBalance = selectedDealerData?.opening_balance || 0;

        const { data: orders } = await supabase
          .from('orders')
          .select('id, total_amount')
          .eq('dealer_id', selectedDealer);
        
        const totalOrderValue = (orders || []).reduce((sum, o) => sum + o.total_amount, 0);
        
        const { data: paymentsData } = await supabase
          .from('payments')
          .select('amount')
          .eq('dealer_id', selectedDealer)
          .eq('status', 'completed');
        
        const totalPaymentsValue = (paymentsData || []).reduce((sum, p) => sum + p.amount, 0);
        
        setDealerBalance(openingBalance + totalOrderValue - totalPaymentsValue);
      } catch (error: any) {
        console.error('calculateBalance Error:', error);
      }
    };
    calculateBalanceAndDueDate();
  }, [selectedDealer, dealers, user]);

  const newItemCalculations = useMemo(() => {
    const discount = (newItemUnitPrice * newItemDiscountPercent) / 100;
    const discountedUnitPrice = Math.max(0, newItemUnitPrice - discount);
    
    const taxableValue = discountedUnitPrice * newItemQuantity;
    const gstAmount = (taxableValue * newItemGstPercent) / 100;
    const totalPrice = taxableValue + gstAmount;

    return {
      taxableValue,
      gstAmount,
      totalPrice
    };
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
      discount_percent: newItemDiscountPercent,
      gst_percent: newItemGstPercent,
      taxable_value: newItemCalculations.taxableValue,
      gst_amount: newItemCalculations.gstAmount,
      total_price: newItemCalculations.totalPrice,
    };
    // Changed from [newOrderItem, ...prevItems] to [...prevItems, newOrderItem]
    setOrderItems(prevItems => [...prevItems, newOrderItem]);
    setNewItemProductId('');
    setNewItemQuantity(1);
    setNewItemUnitPrice(0);
    setNewItemDiscountPercent(0);
    setNewItemGstPercent(0);
  };

  const updateOrderItem = (id: string, field: keyof OrderItem, value: any) => {
    setOrderItems(prev => prev.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        
        // If product changed, update related fields
        if (field === 'product_id') {
          const product = products.find(p => p.id === value);
          if (product) {
            updatedItem.product_name = product.name;
            updatedItem.product_code = product.code;
            updatedItem.unit_dp = product.dp;
            updatedItem.gst_percent = parseFloat(product.gst) || 0;
          }
        }

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedDealer || orderItems.length === 0) {
      showError("Please select a dealer and add at least one item.");
      return;
    }

    if (!isPaymentDetailsValid) {
      showError("Please provide valid payment details.");
      return;
    }

    setLoading(true);
    try {
      // 1. Create the Order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          dealer_id: selectedDealer,
          user_id: user.id,
          total_amount: finalOrderValue,
          discount_amount: discountAmount,
          round_off: roundOff,
          payment_due_date: paymentDueDate,
          status: 'completed',
          payment_status: 'pending_approval',
        })
        .select('id, order_number')
        .single();

      if (orderError) throw orderError;

      // 2. Create Sales Items
      const salesToInsert = orderItems.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_dp,
        discount_percent: item.discount_percent,
        gst_percent: item.gst_percent,
        total_price: item.total_price,
      }));

      const { error: salesError } = await supabase.from('sales').insert(salesToInsert);
      if (salesError) throw salesError;

      // 3. Create Online Details if applicable
      if (isOnlineOrder) {
        const { error: onlineError } = await supabase.from('online_order_details').insert({
          order_id: order.id,
          client_name: clientName,
          platform_id: platformId,
          platform_order_number: platformOrderNumber,
          contact_no: contactNo,
          city: city,
          state: state,
        });
        if (onlineError) throw onlineError;
      }

      // 4. Create Payment Record
      const { error: paymentError } = await supabase.from('payments').insert({
        order_id: order.id,
        dealer_id: selectedDealer,
        amount: paymentAmount,
        payment_method: paymentMethod,
        payment_date: new Date().toISOString(),
        status: 'pending_approval',
        cheque_dd_no: paymentMethod === 'Cheque/DD' ? chequeDdNo : null,
        cheque_dd_date: paymentMethod === 'Cheque/DD' ? chequeDdDate : null,
        transaction_id: ['Card', 'Bank Transfer', 'UPI', 'Cash'].includes(paymentMethod) ? transactionId : null,
      });

      if (paymentError) throw paymentError;

      // 5. Trigger Notification
      fetch(SEND_ORDER_NOTIFICATION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
      }).catch(err => console.error("Notification failed:", err));

      showSuccess(`Order #${order.order_number} placed successfully!`);
      
      // Reset Form
      setSelectedDealer('');
      setOrderItems([]);
      setDiscountAmount(0);
      setRoundOff(0);
      setPaymentMethod('');
      setChequeDdNo('');
      setChequeDdDate('');
      setTransactionId('');
      setIsOnlineOrder(false);
      setClientName('');
      setPlatformId('');
      setPlatformOrderNumber('');
      setContactNo('');
      setCity('');
      setState('');
      
      onOrderPlaced();
    } catch (error: any) {
      console.error('Order Submission Error:', error);
      showError(`Failed to place order: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredDealers = useMemo(() => {
    if (!dealerSearch) return dealers;
    return dealers.filter(d => d.name.toLowerCase().includes(dealerSearch.toLowerCase()));
  }, [dealers, dealerSearch]);

  const filteredProducts = useMemo(() => {
    if (!productSearch) return products;
    const search = productSearch.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(search) || p.code.toLowerCase().includes(search));
  }, [products, productSearch]);

  const currentDealerName = selectedDealer ? dealers.find(d => d.id === selectedDealer)?.name : "Select dealer...";
  
  const currentProductDisplay = useMemo(() => {
    if (!newItemProductId) return "Select product...";
    const product = products.find(p => p.id === newItemProductId);
    return product ? `${product.name} (${product.code})` : "Select product...";
  }, [newItemProductId, products]);

  const isSubmitDisabled = loading || !selectedDealer || orderItems.length === 0 || !isPaymentDetailsValid;

  const selectedDealerData = useMemo(() => dealers.find(d => d.id === selectedDealer), [dealers, selectedDealer]);
  const openingBalance = selectedDealerData?.opening_balance || 0;
  const pendingLimit = dealerCreditLimit - (dealerBalance || 0);

  return (
    <Card className="bg-card text-card-foreground shadow-lg">
      <CardHeader className="bg-blue-500 dark:bg-blue-700 text-white rounded-t-lg p-4">
        <CardTitle className="text-xl font-semibold text-white">Place New Order</CardTitle>
        <CardDescription className="text-blue-100 dark:text-blue-200">Create an order with item-wise GST calculation.</CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="dealer">Dealer</Label>
            <Popover open={isDealerPopoverOpen} onOpenChange={setIsDealerPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between" disabled={dealers.length === 0}>{currentDealerName}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <div className="p-2 border-b flex items-center gap-2"><Search className="h-4 w-4 text-muted-foreground" /><Input placeholder="Search dealer..." value={dealerSearch} onChange={(e) => setDealerSearch(e.target.value)} className="h-8 border-none focus-visible:ring-0" /></div>
                <ScrollArea className="h-[200px]"><div className="p-1">{filteredDealers.length === 0 ? (<div className="p-2 text-sm text-center text-muted-foreground">No dealer found.</div>) : (
                      filteredDealers.map((dealer) => (<Button key={dealer.id} variant="ghost" className="w-full justify-start font-normal" onClick={() => { setSelectedDealer(dealer.id); setIsDealerPopoverOpen(false); setDealerSearch(''); }}><Check className={cn("mr-2 h-4 w-4", selectedDealer === dealer.id ? "opacity-100" : "opacity-0")} />{dealer.name}</Button>))
                    )}</div></ScrollArea>
              </PopoverContent>
            </Popover>
          </div>

          {isOnlineOrder && (
            <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
              <CardHeader><CardTitle>Online Order Details</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label>Client Name</Label><Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Enter client's full name" /></div>
                <div><Label>Platform</Label><Select value={platformId} onValueChange={setPlatformId}><SelectTrigger><SelectValue placeholder="Select platform" /></SelectTrigger><SelectContent>{platforms.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>Platform Order No.</Label><Input value={platformOrderNumber} onChange={e => setPlatformOrderNumber(e.target.value)} placeholder="e.g., AMZ-12345" /></div>
                <div><Label>Contact No.</Label><Input value={contactNo} onChange={e => setContactNo(e.target.value)} placeholder="Enter client's phone number" /></div>
                <div><Label>City</Label><Input value={city} onChange={e => setCity(e.target.value)} placeholder="Enter city" /></div>
                <div><Label>State</Label><Input value={state} onChange={e => setState(e.target.value)} placeholder="Enter state" /></div>
              </CardContent>
            </Card>
          )}

          {selectedDealer && !isOnlineOrder && dealerBalance !== null && (
            <Card className="mt-4 bg-muted/50">
              <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Opening Balance</p>
                  <p className="font-semibold">{formatCurrency(openingBalance)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Credit Limit</p>
                  <p className="font-semibold">{formatCurrency(dealerCreditLimit)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Consumed Limit</p>
                  <p className="font-semibold text-orange-600">{formatCurrency(dealerBalance)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Pending Limit</p>
                  <p className={`font-semibold ${pendingLimit < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(pendingLimit)}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            <Label>Order Items</Label>
            <div className="flex flex-col gap-4 p-4 border rounded-md bg-muted/50">
              <div className="w-full">
                <Label>Product</Label>
                <Popover open={isProductPopoverOpen} onOpenChange={setIsProductPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between" disabled={products.length === 0}>{currentProductDisplay}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <div className="p-2 border-b flex items-center gap-2"><Search className="h-4 w-4 text-muted-foreground" /><Input placeholder="Search product..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="h-8 border-none focus-visible:ring-0" /></div>
                    <ScrollArea className="h-[250px]"><div className="p-1">{filteredProducts.length === 0 ? (<div className="p-2 text-sm text-center text-muted-foreground">No product found.</div>) : (
                          filteredProducts.map((product) => (
                            <Button 
                              key={product.id} 
                              variant="ghost" 
                              className="w-full justify-start font-normal h-auto py-2" 
                              onClick={() => { setNewItemProductId(product.id); setNewItemUnitPrice(product.dp); setNewItemGstPercent(parseFloat(product.gst) || 0); setIsProductPopoverOpen(false); setProductSearch(''); }}
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
                          ))
                        )}</div></ScrollArea>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 items-end">
                <div><Label>Quantity</Label><Input type="number" value={newItemQuantity} onChange={(e) => setNewItemQuantity(parseInt(e.target.value) || 1)} min="1" /></div>
                <div><Label>Unit Price (DP)</Label><Input type="number" step="0.01" value={newItemUnitPrice} onChange={(e) => setNewItemUnitPrice(parseFloat(e.target.value) || 0)} min="0" /></div>
                <div><Label>Discount (%)</Label><div className="relative"><Input type="number" step="0.1" value={newItemDiscountPercent} onChange={(e) => setNewItemDiscountPercent(parseFloat(e.target.value) || 0)} min="0" max="100" className="pr-8" /><Percent className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /></div></div>
                <div><Label>GST (%)</Label><Input type="number" step="0.1" value={newItemGstPercent} onChange={(e) => setNewItemGstPercent(parseFloat(e.target.value) || 0)} min="0" /></div>
                <div className="flex flex-col gap-1"><Label className="text-xs text-muted-foreground">Item Total</Label><div className="h-10 flex items-center px-3 border rounded-md bg-background font-bold text-green-600">₹{newItemCalculations.totalPrice.toFixed(2)}</div></div>
              </div>
              <Button type="button" onClick={addOrderItem} disabled={loading} className="w-full"><Plus className="h-4 w-4 mr-2" /> Add to Order</Button>
            </div>

            {orderItems.length > 0 && (
              <div className="max-h-[250px] overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Qty</TableHead><TableHead>DP</TableHead><TableHead>Disc %</TableHead><TableHead>GST %</TableHead><TableHead className="text-right">Total</TableHead><TableHead></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {orderItems.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="p-1">
                          <ProductSearchSelector
                            products={products}
                            selectedProductId={item.product_id}
                            onSelect={(p) => updateOrderItem(item.id, 'product_id', p.id)}
                            disabled={loading}
                          />
                        </TableCell>
                        <TableCell><Input type="number" value={item.quantity} onChange={(e) => updateOrderItem(item.id, 'quantity', parseInt(e.target.value) || 0)} className="w-16 h-8" /></TableCell>
                        <TableCell><Input type="number" step="0.01" value={item.unit_dp} onChange={(e) => updateOrderItem(item.id, 'unit_dp', parseFloat(e.target.value) || 0)} className="w-24 h-8" /></TableCell>
                        <TableCell><Input type="number" step="0.1" value={item.discount_percent} onChange={(e) => updateOrderItem(item.id, 'discount_percent', parseFloat(e.target.value) || 0)} className="w-16 h-8" /></TableCell>
                        <TableCell><Input type="number" step="0.1" value={item.gst_percent} onChange={(e) => updateOrderItem(item.id, 'gst_percent', parseFloat(e.target.value) || 0)} className="w-16 h-8" /></TableCell>
                        <TableCell className="text-right font-medium">₹{item.total_price.toFixed(2)}</TableCell>
                        <TableCell><Button variant="ghost" size="icon" onClick={() => removeOrderItem(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {orderItems.length > 0 && (
            <div className="p-4 bg-muted rounded-md space-y-2">
              <div className="flex justify-between text-sm"><span>Taxable Value (Excl. GST):</span><span>₹{totalTaxableValue.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm"><span>Total GST:</span><span>₹{totalGstAmount.toFixed(2)}</span></div>
              <Separator className="my-1" />
              <div className="flex justify-between text-base font-medium"><span>Subtotal (Incl. GST):</span><span>₹{preGlobalDiscountTotal.toFixed(2)}</span></div>
              <div className="flex justify-between items-center"><Label htmlFor="discountAmount" className="text-base font-medium">Additional Global Discount (₹)</Label><Input id="discountAmount" type="number" step="0.01" value={discountAmount} onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)} className="w-32 text-right" min="0" max={preGlobalDiscountTotal} /></div>
              <div className="flex justify-between items-center">
                <Label htmlFor="roundOff" className="text-base font-medium">Round Off (+/-)</Label>
                <Input id="roundOff" type="number" step="0.01" value={roundOff} onChange={(e) => setRoundOff(parseFloat(e.target.value) || 0)} className="w-32 text-right" />
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between text-lg font-bold"><span>Total Order Value:</span><span>₹{finalOrderValue.toFixed(2)}</span></div>
            </div>
          )}

          <div className="space-y-4 p-4 border rounded-md">
            <div className="flex items-center space-x-2"><Check className="h-5 w-5 text-green-600" /><Label className="text-base font-medium text-green-600">Payment Received at Order Time</Label></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label htmlFor="paymentMethod">Payment Method</Label><Select value={paymentMethod} onValueChange={setPaymentMethod}><SelectTrigger id="paymentMethod"><SelectValue placeholder="Select method" /></SelectTrigger><SelectContent>{paymentMethodsOptions.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
              <div><Label htmlFor="paymentAmount">Amount Paid</Label><Input id="paymentAmount" type="number" value={paymentAmount} readOnly className="bg-muted" /></div>
              {paymentMethod === 'Cheque/DD' && (<><div><Label htmlFor="chequeDdNo">Cheque/DD No</Label><Input id="chequeDdNo" value={chequeDdNo} onChange={e => setChequeDdNo(e.target.value)} /></div><div><Label htmlFor="chequeDdDate">Cheque/DD Date</Label><Input id="chequeDdDate" type="date" value={chequeDdDate} onChange={e => setChequeDdDate(e.target.value)} /></div></>)}
              {['Card', 'Bank Transfer', 'UPI', 'Cash'].includes(paymentMethod) && (<div><Label htmlFor="transactionId">Transaction ID {paymentMethod === 'Cash' ? '(Optional)' : ''}</Label><Input id="transactionId" value={transactionId} onChange={e => setTransactionId(e.target.value)} placeholder="e.g., TXN123456" /></div>)}
            </div>
          </div>

          <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={isSubmitDisabled}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Place Order'}</Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default MultiItemOrderForm;