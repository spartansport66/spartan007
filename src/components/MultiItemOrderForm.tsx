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
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  price: number;
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
  id: string;
  product_id: string;
  quantity: number;
}

interface PendingPayment {
  order_number: number;
  total_amount: number;
  payment_status: string;
  payment_due_date: string | null;
}

// IMPORTANT: Replace with the actual URL of your deployed Edge Function
const CREATE_MULTI_ITEM_ORDER_EDGE_FUNCTION_URL = "https://hxftiocfihhdutciaisl.supabase.co/functions/v1/create-multi-item-order";

const MultiItemOrderForm: React.FC = () => {
  const { user } = useSession();
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedDealer, setSelectedDealer] = useState<string>('');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([{ id: Date.now().toString(), product_id: '', quantity: 1 }]);
  const [loading, setLoading] = useState(false);
  const [dealerBalance, setDealerBalance] = useState<number | null>(null);
  const [dealerCreditLimit, setDealerCreditLimit] = useState<number>(0);
  const [allottedCreditDays, setAllottedCreditDays] = useState<number>(0);
  const [paymentDueDate, setPaymentDueDate] = useState<string | null>(null);
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [totalPendingAmount, setTotalPendingAmount] = useState<number>(0);
  const [dealerOpeningBalance, setDealerOpeningBalance] = useState<number>(0);
  const [dealerHasPositiveOpeningBalance, setDealerHasPositiveOpeningBalance] = useState<boolean>(false);
  const [openingBalanceSettled, setOpeningBalanceSettled] = useState<boolean>(false);

  // Payment at order time states
  const [isPaidAtOrderTime, setIsPaidAtOrderTime] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);

  // Cheque/DD fields
  const [chequeDdNo, setChequeDdNo] = useState<string>('');
  const [chequeDdDate, setChequeDdDate] = useState<string>('');

  // Card fields (only transaction ID)
  const [cardNumber, setCardNumber] = useState<string>('');
  const [cardHolderName, setCardHolderName] = useState<string>('');
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [cvv, setCvv] = useState<string>('');

  // Bank Transfer fields
  const [bankName, setBankName] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [ifscCode, setIfscCode] = useState<string>('');

  // UPI fields
  const [upiId, setUpiId] = useState<string>('');
  const [transactionId, setTransactionId] = useState<string>('');

  const paymentMethodsOptions = ['Cash', 'Card', 'Bank Transfer', 'UPI', 'Cheque/DD'];

  // Format date as dd/mm/yyyy
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Fetch dealers and products
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // Fetch dealers assigned to the current user
        const { data: assignedDealersData, error: assignedDealersError } = await supabase
          .from('dealer_sales_persons')
          .select(`
            dealers(
              id,
              name,
              credit_limit,
              allotted_credit_days,
              dealer_balances(opening_balance)
            )
          `)
          .eq('sales_person_id', user.id);

        if (assignedDealersError) {
          console.error('Error fetching assigned dealers:', assignedDealersError);
          showError(`Failed to load assigned dealers: ${assignedDealersError.message}`);
          setDealers([]);
          return;
        }

        // Format dealers with their opening balances
        const formattedDealers: Dealer[] = (assignedDealersData || []).map((item: any) => {
          const openingBalance = item.dealers.dealer_balances?.[0]?.opening_balance || 0;
          return {
            ...item.dealers,
            opening_balance: openingBalance
          };
        });

        setDealers(formattedDealers);

        // Fetch all products
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('id, name, price, stock');

        if (productsError) {
          console.error('Error fetching products:', productsError);
          showError(`Failed to load products: ${productsError.message}`);
        } else {
          setProducts(productsData || []);
        }
      } catch (error: any) {
        console.error('Error in fetchData:', error);
        showError(`Failed to load data: ${error.message}`);
      }
    };

    fetchData();
  }, [user]);

  // Check for pending payments when dealer is selected
  useEffect(() => {
    const checkPendingPayments = async () => {
      if (!selectedDealer) {
        setPendingPayments([]);
        setTotalPendingAmount(0);
        setDealerHasPositiveOpeningBalance(false);
        setOpeningBalanceSettled(false);
        return;
      }

      try {
        const todayISOString = new Date().toISOString();

        // Fetch pending payments for the selected dealer (only pending, not pending_approval)
        const { data, error } = await supabase
          .from('orders')
          .select('order_number, total_amount, payment_status, payment_due_date')
          .eq('dealer_id', selectedDealer)
          .eq('payment_status', 'pending')
          .lte('payment_due_date', todayISOString);

        if (error) {
          console.error('Error fetching pending payments:', error);
          showError(`Failed to check pending payments: ${error.message}`);
          setPendingPayments([]);
          setTotalPendingAmount(0);
          return;
        }

        const pendingData = data || [];
        setPendingPayments(pendingData);
        const total = pendingData.reduce((sum, order) => sum + order.total_amount, 0);
        setTotalPendingAmount(total);

        // Check if dealer has positive opening balance
        const selectedDealerData = dealers.find(d => d.id === selectedDealer);
        if (selectedDealerData) {
          const hasPositiveBalance = selectedDealerData.opening_balance > 0;
          setDealerHasPositiveOpeningBalance(hasPositiveBalance);

          // If no positive balance, consider it settled by default
          if (!hasPositiveBalance) {
            setOpeningBalanceSettled(true);
          }
        }
      } catch (error: any) {
        console.error('Error checking pending payments:', error);
        showError(`Failed to check pending payments: ${error.message}`);
        setPendingPayments([]);
        setTotalPendingAmount(0);
      }
    };

    checkPendingPayments();
  }, [selectedDealer, dealers]);

  // Calculate dealer balance and payment due date
  useEffect(() => {
    const calculateBalanceAndDueDate = async () => {
      if (!selectedDealer) {
        setDealerBalance(null);
        setDealerCreditLimit(0);
        setAllottedCreditDays(0);
        setPaymentDueDate(null);
        setPaymentAmount(0);
        setDealerOpeningBalance(0);
        return;
      }

      const selectedDealerData = dealers.find(d => d.id === selectedDealer);
      if (selectedDealerData) {
        setAllottedCreditDays(selectedDealerData.allotted_credit_days);
        setDealerOpeningBalance(selectedDealerData.opening_balance || 0);
      }

      // Determine the effective credit limit for the current month
      const currentMonthDate = new Date();
      const currentMonthYear = new Date(Date.UTC(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), 1)).toISOString().split('T')[0];

      try {
        const { data: monthlyLimitData, error: monthlyLimitError } = await supabase
          .from('dealer_monthly_credit_limits')
          .select('credit_limit')
          .eq('dealer_id', selectedDealer)
          .eq('month_year', currentMonthYear)
          .single();

        if (monthlyLimitError && monthlyLimitError.code !== 'PGRST116') { // PGRST116 means "no rows found"
          console.error('Error fetching monthly credit limit in Edge Function:', monthlyLimitError.message);
          // Fallback to general limit if there's an error fetching monthly limit
        } else if (monthlyLimitData) {
          setDealerCreditLimit(monthlyLimitData.credit_limit);
        } else {
          setDealerCreditLimit(selectedDealerData?.credit_limit || 0);
        }
      } catch (error) {
        console.error('Error fetching monthly credit limit:', error);
        setDealerCreditLimit(selectedDealerData?.credit_limit || 0);
      }

      // Fetch total spent by this dealer from BOTH 'pending' AND 'pending_approval' orders
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('total_amount')
          .eq('dealer_id', selectedDealer)
          .in('payment_status', ['pending', 'pending_approval']);

        if (error) {
          console.error('Error fetching dealer balance:', error);
          showError(`Failed to calculate dealer balance: ${error.message}`);
          setDealerBalance(null);
        } else {
          const totalSpent = data.reduce((sum, order) => sum + order.total_amount, 0);
          setDealerBalance(totalSpent);
        }
      } catch (error: any) {
        console.error('Error fetching dealer balance:', error);
        showError(`Failed to calculate dealer balance: ${error.message}`);
        setDealerBalance(null);
      }

      // Set payment amount to total order value if paid at order time
      if (isPaidAtOrderTime) {
        setPaymentAmount(calculateTotalOrderValue());
      }
    };

    calculateBalanceAndDueDate();
  }, [selectedDealer, dealers, isPaidAtOrderTime, orderItems]);

  const addOrderItem = () => {
    setOrderItems([...orderItems, { id: Date.now().toString(), product_id: '', quantity: 1 }]);
  };

  const removeOrderItem = (id: string) => {
    if (orderItems.length > 1) {
      setOrderItems(orderItems.filter(item => item.id !== id));
    }
  };

  const updateOrderItem = (id: string, field: keyof OrderItem, value: string | number) => {
    setOrderItems(orderItems.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const calculateItemTotal = (item: OrderItem) => {
    const product = products.find(p => p.id === item.product_id);
    return product ? item.quantity * product.price : 0;
  };

  const calculateTotalOrderValue = () => {
    return orderItems.reduce((total, item) => total + calculateItemTotal(item), 0);
  };

  // Calculate used credit including opening balance
  const usedCredit = dealerBalance !== null ? dealerBalance + dealerOpeningBalance : null;

  // Calculate available credit (credit limit - used credit)
  const availableCredit = dealerBalance !== null ? dealerCreditLimit - (dealerBalance + dealerOpeningBalance) : null;

  const totalOrderValue = calculateTotalOrderValue();

  // Calculate remaining credit after this order
  const remainingCredit = availableCredit !== null ? availableCredit - totalOrderValue : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      showError('You must be logged in to place an order.');
      return;
    }

    if (!selectedDealer) {
      showError('Please select a dealer.');
      return;
    }

    // Check if dealer has opening balance of 0
    const selectedDealerData = dealers.find(d => d.id === selectedDealer);
    if (selectedDealerData && selectedDealerData.opening_balance === 0) {
      showError('Cannot place order. Dealer has an opening balance of 0. Please add a positive opening balance first.');
      return;
    }

    // Check if dealer has positive opening balance and it's not settled
    if (dealerHasPositiveOpeningBalance && !openingBalanceSettled) {
      showError('Cannot place order. Dealer has an outstanding opening balance that must be settled first.');
      return;
    }

    // Check if dealer has any overdue pending payments
    if (totalPendingAmount > 0) {
      showError(`Cannot place order. Dealer has overdue payments of ₹${totalPendingAmount.toFixed(2)}. Please clear all overdue payments first.`);
      return;
    }

    if (orderItems.some(item => !item.product_id || item.quantity <= 0)) {
      showError('Please fill in all product fields and ensure quantities are positive.');
      return;
    }

    if (remainingCredit !== null && remainingCredit < 0) {
      showError('Order exceeds dealer\'s available credit limit.');
      return;
    }

    // Require payment option - either paid at order time or credit
    if (!isPaidAtOrderTime) {
      showError('Please select a payment option. Either pay at order time or use credit.');
      return;
    }

    if (isPaidAtOrderTime) {
      if (!paymentMethod) {
        showError('Please select a payment method.');
        return;
      }

      if (paymentAmount <= 0) {
        showError('Payment amount must be positive.');
        return;
      }

      // Conditional validation for specific payment methods
      if (paymentMethod === 'Cheque/DD' && (!chequeDdNo || !chequeDdDate)) {
        showError('Please enter Cheque/DD number and date.');
        return;
      }

      if (paymentMethod === 'Card' && (!cardNumber || !cardHolderName || !expiryDate || !cvv)) {
        showError('Please fill in all card details.');
        return;
      }

      if (paymentMethod === 'Bank Transfer' && (!bankName || !accountNumber || !ifscCode || !transactionId)) {
        showError('Please fill in all bank transfer details.');
        return;
      }

      if (paymentMethod === 'UPI' && (!upiId || !transactionId)) {
        showError('Please fill in all UPI details.');
        return;
      }
    }

    setLoading(true);

    try {
      const payload: any = {
        dealerId: selectedDealer,
        userId: user.id,
        orderItems: orderItems.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
        })),
        paymentStatus: isPaidAtOrderTime ? 'pending_approval' : 'pending',
        paymentDueDate: paymentDueDate,
      };

      if (isPaidAtOrderTime) {
        payload.paymentDetails = {
          amount: paymentAmount,
          payment_method: paymentMethod,
          cheque_dd_no: paymentMethod === 'Cheque/DD' ? chequeDdNo : null,
          cheque_dd_date: paymentMethod === 'Cheque/DD' ? chequeDdDate : null,
          card_number: paymentMethod === 'Card' ? cardNumber : null,
          card_holder_name: paymentMethod === 'Card' ? cardHolderName : null,
          expiry_date: paymentMethod === 'Card' ? expiryDate : null,
          cvv: paymentMethod === 'Card' ? cvv : null,
          bank_name: paymentMethod === 'Bank Transfer' ? bankName : null,
          account_number: paymentMethod === 'Bank Transfer' ? accountNumber : null,
          ifsc_code: paymentMethod === 'Bank Transfer' ? ifscCode : null,
          upi_id: paymentMethod === 'UPI' ? upiId : null,
          transaction_id: (paymentMethod === 'Bank Transfer' || paymentMethod === 'UPI') ? transactionId : null,
        };
      }

      const response = await fetch(CREATE_MULTI_ITEM_ORDER_EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to place order');
      }

      showSuccess('Order placed successfully!');

      // Reset form
      setSelectedDealer('');
      setOrderItems([{ id: Date.now().toString(), product_id: '', quantity: 1 }]);
      setDealerBalance(null);
      setIsPaidAtOrderTime(false);
      setPaymentMethod('');
      setPaymentAmount(0);
      setChequeDdNo('');
      setChequeDdDate('');
      setCardNumber('');
      setCardHolderName('');
      setExpiryDate('');
      setCvv('');
      setBankName('');
      setAccountNumber('');
      setIfscCode('');
      setUpiId('');
      setTransactionId('');
      setPaymentDueDate(null);
      setPendingPayments([]);
      setTotalPendingAmount(0);
      setOpeningBalanceSettled(false);
    } catch (error: any) {
      console.error('Error placing order:', error);
      showError(`Failed to place order: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // State for searchable product dropdown
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  // Filter products based on search value - improved matching
  const filteredProducts = useMemo(() => {
    if (!searchValue) return products;

    const searchTerms = searchValue.toLowerCase().split(' ').filter(term => term.length > 0);
    return products.filter(product => {
      const productName = product.name.toLowerCase();
      return searchTerms.every(term => productName.includes(term));
    });
  }, [products, searchValue]);

  // Condition to disable "Add Item" button
  const disableAddItem = selectedDealer && availableCredit !== null && availableCredit <= 0;

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
            <Select
              value={selectedDealer}
              onValueChange={setSelectedDealer}
              disabled={dealers.length === 0}
            >
              <SelectTrigger id="dealer" className="w-full">
                <SelectValue placeholder={dealers.length === 0 ? "No dealers available" : "Select a dealer"} />
              </SelectTrigger>
              <SelectContent>
                {dealers.map((dealer) => (
                  <SelectItem key={dealer.id} value={dealer.id}>
                    {dealer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedDealer && dealerHasPositiveOpeningBalance && !openingBalanceSettled && (
              <Alert variant="destructive" className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Opening Balance Outstanding</AlertTitle>
                <AlertDescription>
                  This dealer has an opening balance of ₹{dealerOpeningBalance.toFixed(2)} that must be settled before placing a new order.
                  <div className="mt-2 flex items-center">
                    <Checkbox
                      id="openingBalanceSettled"
                      checked={openingBalanceSettled}
                      onCheckedChange={(checked) => setOpeningBalanceSettled(!!checked)}
                      className="mr-2"
                    />
                    <Label htmlFor="openingBalanceSettled">
                      I confirm the opening balance has been settled
                    </Label>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {selectedDealer && totalPendingAmount > 0 && (
              <Alert variant="destructive" className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Overdue Payments</AlertTitle>
                <AlertDescription>
                  This dealer has overdue payments totaling ₹{totalPendingAmount.toFixed(2)}. Please clear all overdue payments before placing a new order.
                  <div className="mt-2 max-h-32 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left">Order #</th>
                          <th className="text-left">Due Date</th>
                          <th className="text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingPayments.map((payment, index) => (
                          <tr key={index} className="border-b">
                            <td>#{payment.order_number}</td>
                            <td>{payment.payment_due_date ? formatDate(payment.payment_due_date) : 'N/A'}</td>
                            <td className="text-right">₹{payment.total_amount.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {selectedDealer && (
              <div className="mt-2 p-3 bg-muted rounded-md">
                <div className="flex justify-between text-sm">
                  <span>Opening Balance:</span>
                  <span className="font-medium">₹{dealerOpeningBalance.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Credit Limit (Current Month):</span>
                  <span className="font-medium">₹{dealerCreditLimit.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Used Credit (Pending Orders):</span>
                  <span className="font-medium">₹{dealerBalance !== null ? dealerBalance.toFixed(2) : '0.00'}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold">
                  <span>Total Used Credit (Opening + Pending):</span>
                  <span className={usedCredit !== null && usedCredit > dealerCreditLimit ? "text-destructive" : "text-primary"}>
                    ₹{usedCredit !== null ? usedCredit.toFixed(2) : '0.00'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Available Credit:</span>
                  <span className={availableCredit !== null && availableCredit < 0 ? "text-destructive font-semibold" : "font-medium"}>
                    ₹{availableCredit !== null ? availableCredit.toFixed(2) : '0.00'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Allotted Credit Days:</span>
                  <span className="font-medium">{allottedCreditDays} days</span>
                </div>
                {paymentDueDate && (
                  <div className="flex justify-between text-sm">
                    <span>Payment Due Date:</span>
                    <span className="font-medium">{formatDate(paymentDueDate)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label>Order Items</Label>
              <Button
                type="button"
                onClick={addOrderItem}
                size="sm"
                className="flex items-center gap-1"
                disabled={disableAddItem}
              >
                <Plus className="h-4 w-4" />
                Add Item
              </Button>
            </div>

            {disableAddItem && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Insufficient Credit</AlertTitle>
                <AlertDescription>
                  Dealer's available credit is ₹{availableCredit !== null ? availableCredit.toFixed(2) : '0.00'}. Please clear the balance or increase the credit limit to add more items.
                </AlertDescription>
              </Alert>
            )}

            {orderItems.map((item, index) => (
              <div key={item.id} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5">
                  <Label htmlFor={`product-${item.id}`}>Product</Label>
                  <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between"
                      >
                        {item.product_id
                          ? products.find((product) => product.id === item.product_id)?.name
                          : "Select product..."}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                      <Command>
                        <CommandInput
                          placeholder="Search product (e.g. 'VOLLEY' or 'CD 334')..."
                          value={searchValue}
                          onValueChange={setSearchValue}
                        />
                        <CommandList>
                          <CommandEmpty>No product found.</CommandEmpty>
                          <CommandGroup>
                            {filteredProducts.map((product) => (
                              <CommandItem
                                key={product.id}
                                value={product.id}
                                onSelect={(currentValue) => {
                                  updateOrderItem(item.id, 'product_id', currentValue === item.product_id ? '' : currentValue);
                                  setOpen(false);
                                  setSearchValue("");
                                }}
                              >
                                <div>
                                  <div>{product.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    ₹{product.price.toFixed(2)} - Stock: {product.stock}
                                  </div>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="col-span-3">
                  <Label htmlFor={`quantity-${item.id}`}>Quantity</Label>
                  <Input
                    id={`quantity-${item.id}`}
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateOrderItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                    min="1"
                    className="w-full"
                  />
                </div>
                <div className="col-span-3">
                  <Label>Item Total</Label>
                  <div className="font-medium">₹{calculateItemTotal(item).toFixed(2)}</div>
                </div>
                <div className="col-span-1">
                  {orderItems.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeOrderItem(item.id)}
                      className="h-9 w-9"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {orderItems.length > 0 && (
            <div className="p-4 bg-muted rounded-md">
              <div className="flex justify-between text-lg font-semibold">
                <span>Total Order Value:</span>
                <span>₹{totalOrderValue.toFixed(2)}</span>
              </div>
              {selectedDealer && dealerBalance !== null && (
                <>
                  <Separator className="my-2" />
                  <div className="flex justify-between text-sm">
                    <span>Remaining Credit After Order:</span>
                    <span className={remainingCredit !== null && remainingCredit < 0 ? "text-destructive font-semibold" : "font-medium"}>
                      ₹{remainingCredit !== null ? remainingCredit.toFixed(2) : '0.00'}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Payment at Order Time Section */}
          <div className="space-y-4 p-4 border rounded-md">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="paidAtOrderTime"
                checked={isPaidAtOrderTime}
                onCheckedChange={(checked) => {
                  setIsPaidAtOrderTime(!!checked);
                  if (!!checked) {
                    setPaymentAmount(totalOrderValue);
                  } else {
                    setPaymentMethod('');
                    setPaymentAmount(0);
                    setChequeDdNo('');
                    setChequeDdDate('');
                    setCardNumber('');
                    setCardHolderName('');
                    setExpiryDate('');
                    setCvv('');
                    setBankName('');
                    setAccountNumber('');
                    setIfscCode('');
                    setUpiId('');
                    setTransactionId('');
                  }
                }}
              />
              <Label htmlFor="paidAtOrderTime" className="text-base font-medium">
                Payment Received at Order Time
              </Label>
            </div>

            {isPaidAtOrderTime && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="paymentMethod">Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger id="paymentMethod" className="w-full">
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethodsOptions.map((method) => (
                        <SelectItem key={method} value={method}>
                          {method}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="paymentAmount">Amount Paid</Label>
                  <Input
                    id="paymentAmount"
                    type="number"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                    className="w-full"
                  />
                </div>

                {paymentMethod === 'Cheque/DD' && (
                  <>
                    <div>
                      <Label htmlFor="chequeDdNo">Cheque/DD Number</Label>
                      <Input
                        id="chequeDdNo"
                        type="text"
                        value={chequeDdNo}
                        onChange={(e) => setChequeDdNo(e.target.value)}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <Label htmlFor="chequeDdDate">Cheque/DD Date</Label>
                      <Input
                        id="chequeDdDate"
                        type="date"
                        value={chequeDdDate}
                        onChange={(e) => setChequeDdDate(e.target.value)}
                        className="w-full"
                      />
                    </div>
                  </>
                )}

                {paymentMethod === 'Card' && (
                  <>
                    <div>
                      <Label htmlFor="cardNumber">Card Number</Label>
                      <Input
                        id="cardNumber"
                        type="text"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        className="w-full"
                        placeholder="XXXX XXXX XXXX 1234"
                      />
                    </div>
                    <div>
                      <Label htmlFor="cardHolderName">Card Holder Name</Label>
                      <Input
                        id="cardHolderName"
                        type="text"
                        value={cardHolderName}
                        onChange={(e) => setCardHolderName(e.target.value)}
                        className="w-full"
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <Label htmlFor="expiryDate">Expiry Date (MM/YY)</Label>
                      <Input
                        id="expiryDate"
                        type="text"
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(e.target.value)}
                        className="w-full"
                        placeholder="MM/YY"
                      />
                    </div>
                    <div>
                      <Label htmlFor="cvv">CVV</Label>
                      <Input
                        id="cvv"
                        type="text"
                        value={cvv}
                        onChange={(e) => setCvv(e.target.value)}
                        className="w-full"
                        placeholder="XXX"
                      />
                    </div>
                  </>
                )}

                {paymentMethod === 'Bank Transfer' && (
                  <>
                    <div>
                      <Label htmlFor="bankName">Bank Name</Label>
                      <Input
                        id="bankName"
                        type="text"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="w-full"
                        placeholder="State Bank of India"
                      />
                    </div>
                    <div>
                      <Label htmlFor="accountNumber">Account Number</Label>
                      <Input
                        id="accountNumber"
                        type="text"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        className="w-full"
                        placeholder="123456789012"
                      />
                    </div>
                    <div>
                      <Label htmlFor="ifscCode">IFSC Code</Label>
                      <Input
                        id="ifscCode"
                        type="text"
                        value={ifscCode}
                        onChange={(e) => setIfscCode(e.target.value)}
                        className="w-full"
                        placeholder="SBIN0000001"
                      />
                    </div>
                    <div>
                      <Label htmlFor="transactionId">Transaction ID</Label>
                      <Input
                        id="transactionId"
                        type="text"
                        value={transactionId}
                        onChange={(e) => setTransactionId(e.target.value)}
                        className="w-full"
                        placeholder="TXN123456789"
                      />
                    </div>
                  </>
                )}

                {paymentMethod === 'UPI' && (
                  <>
                    <div>
                      <Label htmlFor="upiId">UPI ID</Label>
                      <Input
                        id="upiId"
                        type="text"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        className="w-full"
                        placeholder="user@bank"
                      />
                    </div>
                    <div>
                      <Label htmlFor="transactionId">Transaction ID</Label>
                      <Input
                        id="transactionId"
                        type="text"
                        value={transactionId}
                        onChange={(e) => setTransactionId(e.target.value)}
                        className="w-full"
                        placeholder="UPI123456789"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <Button
            type="submit"
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
            disabled={
              loading ||
              !selectedDealer ||
              (remainingCredit !== null && remainingCredit < 0) ||
              totalPendingAmount > 0 ||
              (dealerHasPositiveOpeningBalance && !openingBalanceSettled) ||
              (selectedDealer && dealers.find(d => d.id === selectedDealer)?.opening_balance === 0)
            }
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Place Order'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default MultiItemOrderForm;