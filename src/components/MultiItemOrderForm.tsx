"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { Loader2, Plus, Trash2, Check, ChevronsUpDown } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Product {
  id: string;
  code: string;
  name: string;
  dp: number;
  stock: number;
}

interface Dealer {
  id: string;
  name: string;
  credit_limit: number;
  allotted_credit_days: number;
  opening_balance: number;
}

interface OrderItem {
  id: string; // Unique ID for React list key
  product_id: string;
  quantity: number;
  product_name: string;
  product_code: string;
  unit_dp: number;
  total_price: number;
}

interface PendingPayment {
  order_number: number;
  total_amount: number;
  payment_status: string;
  payment_due_date: string | null;
}

interface MultiItemOrderFormProps {
  onOrderPlaced: () => void;
}

const MultiItemOrderForm: React.FC<MultiItemOrderFormProps> = ({ onOrderPlaced }) => {
  const { user, session, loading: sessionLoading } = useSession();
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedDealer, setSelectedDealer] = useState<string>('');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [dealerBalance, setDealerBalance] = useState<number | null>(null);
  const [dealerCreditLimit, setDealerCreditLimit] = useState<number>(0);
  const [allottedCreditDays, setAllottedCreditDays] = useState<number>(0);
  const [paymentDueDate, setPaymentDueDate] = useState<string | null>(null);
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [totalPendingAmount, setTotalPendingAmount] = useState<number>(0);
  const [dealerOpeningBalance, setDealerOpeningBalance] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const isPaidAtOrderTime = true;
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [chequeDdNo, setChequeDdNo] = useState<string>('');
  const [chequeDdDate, setChequeDdDate] = useState<string>('');
  const [transactionId, setTransactionId] = useState<string>('');
  const [isDealerPopoverOpen, setIsDealerPopoverOpen] = useState(false);
  const [dealerSearchValue, setDealerSearchValue] = useState("");

  // New state for the single item entry form
  const [newItemProductId, setNewItemProductId] = useState<string>('');
  const [newItemQuantity, setNewItemQuantity] = useState<number>(1);
  const [isProductPopoverOpen, setIsProductPopoverOpen] = useState(false);
  const [productSearchValue, setProductSearchValue] = useState("");

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const paymentMethodsOptions = ['Cash', 'Card', 'Bank Transfer', 'UPI', 'Cheque/DD'];

  const preDiscountTotalOrderValue = useMemo(() => {
    return orderItems.reduce((total, item) => total + item.total_price, 0);
  }, [orderItems]);

  const finalOrderValue = useMemo(() => {
    return Math.max(0, preDiscountTotalOrderValue - discountAmount);
  }, [preDiscountTotalOrderValue, discountAmount]);

  useEffect(() => {
    if (isPaidAtOrderTime) {
      setPaymentAmount(parseFloat(finalOrderValue.toFixed(2)));
    }
  }, [finalOrderValue, isPaidAtOrderTime]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      if (!user || !session) {
        setDealers([]);
        setProducts([]);
        setLoading(false);
        return;
      }
      try {
        const { data: assignedDealersData, error: assignedDealersError } = await supabase
          .from('dealer_sales_persons')
          .select('dealers(id, name, credit_limit, allotted_credit_days, dealer_balances(opening_balance))')
          .eq('sales_person_id', user.id);

        if (assignedDealersError) throw assignedDealersError;

        const formattedDealers = (assignedDealersData || [])
          .map((item: any) => {
            if (!item.dealers) return null;
            const opening_balance = item.dealers.dealer_balances?.opening_balance || 0;
            const { dealer_balances, ...dealerData } = item.dealers;
            return { ...dealerData, opening_balance };
          })
          .filter(Boolean) as Dealer[];
        
        formattedDealers.sort((a, b) => a.name.localeCompare(b.name));
        setDealers(formattedDealers);

        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('id, code, name, dp, stock');
        if (productsError) throw productsError;
        setProducts(productsData || []);

      } catch (error: any) {
        console.error('[MultiItemOrderForm] fetchData Error:', error);
        showError(`Failed to load data: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };
    if (!sessionLoading && user) {
      fetchData();
    }
  }, [user, session, sessionLoading]);

  useEffect(() => {
    const checkPendingPayments = async () => {
      if (!selectedDealer || !user) {
        setPendingPayments([]);
        setTotalPendingAmount(0);
        return;
      }
      try {
        const todayISOString = new Date().toISOString();
        const { data, error } = await supabase
          .from('orders')
          .select('order_number, total_amount, payment_status, payment_due_date')
          .eq('dealer_id', selectedDealer)
          .eq('user_id', user.id)
          .eq('payment_status', 'pending')
          .lte('payment_due_date', todayISOString);
        if (error) throw error;
        const pendingData = data || [];
        setPendingPayments(pendingData);
        setTotalPendingAmount(pendingData.reduce((sum, order) => sum + order.total_amount, 0));
      } catch (error: any) {
        console.error('[MultiItemOrderForm] checkPendingPayments Error:', error);
      }
    };
    checkPendingPayments();
  }, [selectedDealer, user]);

  useEffect(() => {
    const calculateBalanceAndDueDate = async () => {
      if (!selectedDealer || !user) {
        setDealerBalance(null);
        setDealerCreditLimit(0);
        setAllottedCreditDays(0);
        setPaymentDueDate(null);
        setDealerOpeningBalance(0);
        setDiscountAmount(0);
        return;
      }
      const selectedDealerData = dealers.find(d => d.id === selectedDealer);
      if (selectedDealerData) {
        setAllottedCreditDays(selectedDealerData.allotted_credit_days);
        setDealerOpeningBalance(selectedDealerData.opening_balance || 0);
        const today = new Date();
        const dueDate = new Date(today);
        dueDate.setDate(today.getDate() + selectedDealerData.allotted_credit_days);
        setPaymentDueDate(dueDate.toISOString().split('T')[0]);
      }
      const currentMonthDate = new Date();
      const currentMonthYear = new Date(Date.UTC(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), 1)).toISOString().split('T')[0];
      try {
        const { data: monthlyLimitData, error: monthlyLimitError } = await supabase
          .from('dealer_monthly_credit_limits')
          .select('credit_limit')
          .eq('dealer_id', selectedDealer)
          .eq('month_year', currentMonthYear)
          .single();
        
        if (monthlyLimitData) {
          setDealerCreditLimit(monthlyLimitData.credit_limit);
        } else {
          setDealerCreditLimit(selectedDealerData?.credit_limit || 0);
        }

        const { data: orders, error: ordersError } = await supabase
          .from('orders')
          .select('id, total_amount')
          .eq('dealer_id', selectedDealer)
          .eq('user_id', user.id);
        if (ordersError) throw ordersError;
        const totalOrderValue = (orders || []).reduce((sum, o) => sum + o.total_amount, 0);

        const orderIds = (orders || []).map(o => o.id);
        let totalPaymentsValue = 0;
        if (orderIds.length > 0) {
          const { data: paymentsData, error: paymentsError } = await supabase
            .from('payments')
            .select('amount')
            .in('order_id', orderIds)
            .eq('status', 'completed');
          if (paymentsError) throw paymentsError;
          totalPaymentsValue = (paymentsData || []).reduce((sum, p) => sum + p.amount, 0);
        }
        
        setDealerBalance(totalOrderValue - totalPaymentsValue);
      } catch (error: any) {
        console.error('[MultiItemOrderForm] calculateBalance Error:', error);
      }
    };
    calculateBalanceAndDueDate();
  }, [selectedDealer, dealers, user]);

  const usedCredit = dealerBalance !== null ? dealerBalance + dealerOpeningBalance : null;
  const availableCredit = dealerBalance !== null ? dealerCreditLimit - (dealerBalance + dealerOpeningBalance) : null;
  const remainingCredit = availableCredit !== null ? availableCredit - finalOrderValue : null;

  const addOrderItem = () => {
    if (!newItemProductId || newItemQuantity <= 0) {
      showError("Please select a product and enter a valid quantity.");
      return;
    }
    const product = products.find(p => p.id === newItemProductId);
    if (!product) {
      showError("Selected product not found.");
      return;
    }
    const newOrderItem: OrderItem = {
      id: Date.now().toString(),
      product_id: product.id,
      quantity: newItemQuantity,
      product_name: product.name,
      product_code: product.code,
      unit_dp: product.dp,
      total_price: newItemQuantity * product.dp,
    };
    setOrderItems(prevItems => [newOrderItem, ...prevItems]);
    setNewItemProductId('');
    setNewItemQuantity(1);
  };

  const removeOrderItem = (id: string) => {
    setOrderItems(orderItems.filter(item => item.id !== id));
  };

  const isPaymentDetailsValid = useMemo(() => {
    if (!isPaidAtOrderTime) return true;
    if (!paymentMethod || paymentAmount <= 0) return false;
    if (paymentMethod === 'Cheque/DD' && (!chequeDdNo || !chequeDdDate)) return false;
    if (['Card', 'Bank Transfer', 'UPI'].includes(paymentMethod) && !transactionId) return false;
    return true;
  }, [isPaidAtOrderTime, paymentMethod, paymentAmount, chequeDdNo, chequeDdDate, transactionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedDealer || orderItems.length === 0 || discountAmount < 0 || discountAmount > preDiscountTotalOrderValue || !isPaymentDetailsValid) {
      showError('Please correct all errors before submitting.');
      return;
    }
    setLoading(true);
    try {
      const finalDiscountAmount = parseFloat(discountAmount.toFixed(2));
      const finalOrderAmount = parseFloat(finalOrderValue.toFixed(2));
      const salesToInsert = orderItems.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        total_price: item.total_price,
      }));
      const stockUpdates = orderItems.map(item => ({
        id: item.product_id,
        quantitySold: item.quantity,
      }));

      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert({
          dealer_id: selectedDealer,
          user_id: user.id,
          total_amount: finalOrderAmount,
          discount_amount: finalDiscountAmount,
          status: 'completed',
          payment_status: 'pending_approval',
          payment_due_date: paymentDueDate,
        })
        .select('id, order_number, order_date')
        .single();
      if (orderError) throw new Error(`Failed to create order: ${orderError.message}`);
      if (!newOrder) throw new Error('Order creation failed.');

      await supabase.from('dealers').update({ last_billing_date: newOrder.order_date }).eq('id', selectedDealer);
      const salesWithOrderId = salesToInsert.map(sale => ({ ...sale, order_id: newOrder.id }));
      const { error: salesInsertError } = await supabase.from('sales').insert(salesWithOrderId);
      if (salesInsertError) throw new Error(`Failed to insert sales items: ${salesInsertError.message}`);

      let transactionIdValue = null;
      if (['Card', 'Bank Transfer', 'UPI', 'Cash'].includes(paymentMethod)) transactionIdValue = transactionId;
      const paymentData = {
        order_id: newOrder.id,
        dealer_id: selectedDealer,
        amount: finalOrderAmount,
        payment_method: paymentMethod,
        payment_date: paymentMethod === 'Cheque/DD' ? chequeDdDate : new Date().toISOString().split('T')[0],
        status: 'pending_approval',
        cheque_dd_no: paymentMethod === 'Cheque/DD' ? chequeDdNo : null,
        cheque_dd_date: paymentMethod === 'Cheque/DD' ? chequeDdDate : null,
        transaction_id: transactionIdValue,
      };
      const { error: paymentInsertError } = await supabase.from('payments').insert(paymentData);
      if (paymentInsertError) throw new Error(`Failed to record payment details: ${paymentInsertError.message}`);

      for (const update of stockUpdates) {
        const product = products.find(p => p.id === update.id);
        if (!product) continue;
        const newStockLevel = product.stock - update.quantitySold;
        const { data: updatedProduct, error: stockUpdateError } = await supabase
          .from('products').update({ stock: newStockLevel }).eq('id', update.id).select('id, stock').single();
        if (stockUpdateError) console.error(`Failed to update stock for product ${update.id}: ${stockUpdateError.message}`);
        if (updatedProduct && updatedProduct.stock < 0) {
          const newRequiredQuantity = Math.abs(updatedProduct.stock);
          const { data: existingAlert } = await supabase.from('production_alerts').select('id').eq('product_id', update.id).eq('resolved', false).single();
          const alertData = { product_id: update.id, required_quantity: newRequiredQuantity, created_by: user.id, dealer_id: selectedDealer, resolved: false, created_at: new Date().toISOString() };
          if (existingAlert) {
            await supabase.from('production_alerts').update(alertData).eq('id', existingAlert.id);
          } else {
            await supabase.from('production_alerts').insert(alertData);
          }
        } else if (product.stock < 0 && updatedProduct && updatedProduct.stock >= 0) {
          await supabase.from('production_alerts').update({ resolved: true }).eq('product_id', update.id).eq('resolved', false);
        }
      }

      const { count: orderCount } = await supabase.from('orders').select('count', { count: 'exact' }).eq('dealer_id', selectedDealer);
      if (orderCount === 1 && dealerOpeningBalance > 0) {
        await supabase.from('dealer_balances').update({ opening_balance: 0 }).eq('dealer_id', selectedDealer);
      }

      showSuccess('Order placed successfully!');
      setSelectedDealer('');
      setOrderItems([]);
      setDiscountAmount(0);
      setPaymentMethod('');
      setPaymentAmount(0);
      setChequeDdNo('');
      setChequeDdDate('');
      setTransactionId('');
      onOrderPlaced();
    } catch (error: any) {
      console.error('[MultiItemOrderForm] Submit Error:', error);
      showError(`Failed to place order: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    const lowerCaseSearchValue = productSearchValue.toLowerCase();
    const searchWords = lowerCaseSearchValue.split(' ').filter(word => word.length > 0);
    
    const filtered = products.filter(product => {
      if (searchWords.length === 0) return true;
      const productName = product.name.toLowerCase();
      const productCode = product.code.toLowerCase();
      return searchWords.some(word => productName.includes(word) || productCode.includes(word));
    });

    if (searchWords.length === 0) {
      return filtered.slice(0, 100);
    }
    return filtered;
  }, [products, productSearchValue]);

  const filteredDealers = useMemo(() => {
    if (!dealerSearchValue) return dealers;
    const lowerCaseSearchValue = dealerSearchValue.toLowerCase();
    return dealers.filter(dealer => dealer.name.toLowerCase().includes(lowerCaseSearchValue));
  }, [dealers, dealerSearchValue]);

  const currentDealerName = selectedDealer ? dealers.find(d => d.id === selectedDealer)?.name : "Select dealer...";
  const calculatedPaymentStatus = isPaidAtOrderTime ? 'Pending Approval' : 'Pending';
  
  const isSubmitDisabled = useMemo(() => {
    const baseChecks = loading || !selectedDealer || orderItems.length === 0 || (orderItems.some(item => !item.product_id || item.quantity <= 0)) || discountAmount < 0 || discountAmount > preDiscountTotalOrderValue;
    if (baseChecks) return true;
    return !(isPaidAtOrderTime && isPaymentDetailsValid);
  }, [loading, selectedDealer, orderItems, discountAmount, preDiscountTotalOrderValue, isPaidAtOrderTime, isPaymentDetailsValid]);

  return (
    <Card className="bg-card text-card-foreground shadow-lg">
      <CardHeader className="bg-blue-500 dark:bg-blue-700 text-white rounded-t-lg p-4">
        <CardTitle className="text-xl font-semibold text-white">Place New Order</CardTitle>
        <CardDescription className="text-blue-100 dark:text-blue-200">
          Create an order with multiple items for a registered dealer.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="dealer">Dealer</Label>
            <Popover open={isDealerPopoverOpen} onOpenChange={setIsDealerPopoverOpen}>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  role="combobox" 
                  aria-expanded={isDealerPopoverOpen} 
                  className="w-full justify-between" 
                  disabled={dealers.length === 0} // Removed loading/sessionLoading checks
                >
                  {currentDealerName}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                <Command>
                  <CommandInput placeholder="Search dealer..." value={dealerSearchValue} onValueChange={setDealerSearchValue} />
                  <CommandList className="max-h-[300px] overflow-y-auto">
                    {filteredDealers.length === 0 ? <CommandEmpty>No dealer found.</CommandEmpty> : (
                      <CommandGroup>
                        {filteredDealers.map((dealer) => (
                          <CommandItem key={dealer.id} value={dealer.name} onSelect={(currentValue) => {
                            const selected = dealers.find(d => d.name.toLowerCase() === currentValue.toLowerCase());
                            setSelectedDealer(selected?.id === selectedDealer ? '' : selected?.id || '');
                            setIsDealerPopoverOpen(false);
                            setDealerSearchValue("");
                          }}>
                            <Check className={cn("mr-2 h-4 w-4", selectedDealer === dealer.id ? "opacity-100" : "opacity-0")} />
                            {dealer.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {selectedDealer && <div className="mt-2 p-3 bg-muted rounded-md"><div className="flex justify-between text-sm"><span>Opening Balance:</span><span className="font-medium">₹{dealerOpeningBalance.toFixed(2)}</span></div><div className="flex justify-between text-sm"><span>Net Transaction Balance (Orders - Payments):</span><span className="font-medium">₹{dealerBalance !== null ? dealerBalance.toFixed(2) : '0.00'}</span></div><div className="flex justify-between text-sm font-semibold"><span>Total Outstanding Balance (Ledger):</span><span className={usedCredit !== null && usedCredit > dealerCreditLimit ? "text-destructive" : "text-primary"}>₹{usedCredit !== null ? usedCredit.toFixed(2) : '0.00'}</span></div><div className="flex justify-between text-sm"><span>Credit Limit (Current Month):</span><span className="font-medium">₹{dealerCreditLimit.toFixed(2)}</span></div><div className="flex justify-between text-sm"><span>Available Credit:</span><span className={availableCredit !== null && availableCredit < 0 ? "text-destructive font-semibold" : "font-medium"}>₹{availableCredit !== null ? availableCredit.toFixed(2) : '0.00'}</span></div><div className="flex justify-between text-sm"><span>Allotted Credit Days:</span><span className="font-medium">{allottedCreditDays} days</span></div>{paymentDueDate && <div className="flex justify-between text-sm"><span>Calculated Payment Due Date:</span><span className="font-medium">{formatDate(paymentDueDate)}</span></div>}<div className="flex justify-between text-sm font-bold mt-2"><span>Calculated Order Payment Status:</span><span className={calculatedPaymentStatus === 'Pending Approval' ? 'text-blue-600' : 'text-yellow-600'}>{calculatedPaymentStatus}</span></div></div>}
          </div>

          <div className="space-y-4">
            <Label>Order Items</Label>
            <div className="flex items-end gap-2 p-4 border rounded-md bg-muted/50">
              <div className="flex-grow">
                <Label>Product</Label>
                <Popover open={isProductPopoverOpen} onOpenChange={setIsProductPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      role="combobox" 
                      className="w-full justify-between" 
                      disabled={products.length === 0} // Removed loading/sessionLoading checks
                    >
                      {newItemProductId ? products.find(p => p.id === newItemProductId)?.name : "Select product..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                    <Command>
                      <CommandInput placeholder="Search product..." value={productSearchValue} onValueChange={setProductSearchValue} />
                      <CommandList className="max-h-[300px] overflow-y-auto">
                        {filteredProducts.length === 0 ? <CommandEmpty>No product found.</CommandEmpty> : (
                          <CommandGroup>
                            {filteredProducts.map((product) => (
                              <CommandItem key={product.id} value={`${product.name} ${product.code}`} onSelect={() => {
                                setNewItemProductId(product.id);
                                setIsProductPopoverOpen(false);
                                setProductSearchValue("");
                              }}>
                                <Check className={cn("mr-2 h-4 w-4", newItemProductId === product.id ? "opacity-100" : "opacity-0")} />
                                <div><div>{product.name} ({product.code})</div><div className="text-xs text-muted-foreground">DP: ₹{product.dp.toFixed(2)} - Stock: {product.stock}</div></div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="w-24">
                <Label>Quantity</Label>
                <Input type="number" value={newItemQuantity} onChange={(e) => setNewItemQuantity(parseInt(e.target.value) || 1)} min="1" />
              </div>
              <Button type="button" onClick={addOrderItem} disabled={loading}><Plus className="h-4 w-4" /></Button>
            </div>

            {orderItems.length > 0 && (
              <div className="max-h-[250px] overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Qty</TableHead><TableHead>Unit DP</TableHead><TableHead className="text-right">Total</TableHead><TableHead></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {orderItems.map(item => (
                      <TableRow key={item.id}>
                        <TableCell>{item.product_name} ({item.product_code})</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>₹{item.unit_dp.toFixed(2)}</TableCell>
                        <TableCell className="text-right">₹{item.total_price.toFixed(2)}</TableCell>
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
              <div className="flex justify-between text-base font-medium"><span>Subtotal (Pre-Discount):</span><span>₹{preDiscountTotalOrderValue.toFixed(2)}</span></div>
              <div className="flex justify-between items-center"><Label htmlFor="discountAmount" className="text-base font-medium">Discount (₹)</Label><Input id="discountAmount" type="number" step="0.01" value={discountAmount} onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)} className="w-32 text-right" min="0" max={preDiscountTotalOrderValue} /></div>
              {discountAmount > preDiscountTotalOrderValue && <p className="text-sm text-destructive">Discount cannot exceed subtotal.</p>}
              <Separator className="my-2" />
              <div className="flex justify-between text-lg font-bold"><span>Total Order Value (Final):</span><span>₹{finalOrderValue.toFixed(2)}</span></div>
              {selectedDealer && dealerBalance !== null && (<><Separator className="my-2" /><div className="flex justify-between text-sm"><span>Remaining Credit After Order:</span><span className={remainingCredit !== null && remainingCredit < 0 ? "text-destructive font-semibold" : "font-medium"}>₹{remainingCredit !== null ? remainingCredit.toFixed(2) : '0.00'}</span></div></>)}
            </div>
          )}

          <div className="space-y-4 p-4 border rounded-md">
            <div className="flex items-center space-x-2"><Check className="h-5 w-5 text-green-600" /><Label className="text-base font-medium text-green-600">Payment Received at Order Time (Mandatory)</Label></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label htmlFor="paymentMethod">Payment Method</Label><Select value={paymentMethod} onValueChange={setPaymentMethod}><SelectTrigger id="paymentMethod" className="w-full"><SelectValue placeholder="Select payment method" /></SelectTrigger><SelectContent>{paymentMethodsOptions.map((method) => (<SelectItem key={method} value={method}>{method}</SelectItem>))}</SelectContent></Select></div>
              <div><Label htmlFor="paymentAmount">Amount Paid</Label><Input id="paymentAmount" type="number" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)} className="w-full bg-muted" readOnly /></div>
              {paymentMethod === 'Cheque/DD' && (<><div><Label htmlFor="chequeDdNo">Cheque/DD Number</Label><Input id="chequeDdNo" type="text" value={chequeDdNo} onChange={(e) => setChequeDdNo(e.target.value)} className="w-full" /></div><div><Label htmlFor="chequeDdDate">Cheque/DD Date</Label><Input id="chequeDdDate" type="date" value={chequeDdDate} onChange={(e) => setChequeDdDate(e.target.value)} className="w-full" /></div></>)}
              {(['Card', 'Bank Transfer', 'UPI', 'Cash'].includes(paymentMethod)) && (<div><Label htmlFor="transactionId">Transaction ID {paymentMethod === 'Cash' ? '(Optional)' : ''}</Label><Input id="transactionId" type="text" value={transactionId} onChange={(e) => setTransactionId(e.target.value)} className="w-full" placeholder={paymentMethod === 'Cash' ? 'Cash transaction reference' : 'e.g., TXN123456789'} /></div>)}
            </div>
          </div>

          <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={isSubmitDisabled}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Place Order'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default MultiItemOrderForm;