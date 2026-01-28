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

interface Product {
  id: string;
  code: string; // New
  name: string;
  dp: number; // Changed from 'price' to 'dp'
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
  const { user, loading: sessionLoading } = useSession(); // Get session loading state
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedDealer, setSelectedDealer] = useState<string>('');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([{ id: Date.now().toString(), product_id: '', quantity: 1 }]);
  const [loading, setLoading] = useState(false); // Local loading state for this component's data
  const [dealerBalance, setDealerBalance] = useState<number | null>(null); // Net transaction balance (Orders - Completed Payments)
  const [dealerCreditLimit, setDealerCreditLimit] = useState<number>(0);
  const [allottedCreditDays, setAllottedCreditDays] = useState<number>(0);
  const [paymentDueDate, setPaymentDueDate] = useState<string | null>(null);
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [totalPendingAmount, setTotalPendingAmount] = useState<number>(0);
  const [dealerOpeningBalance, setDealerOpeningBalance] = useState<number>(0);

  // Payment at order time states
  const [isPaidAtOrderTime, setIsPaidAtOrderTime] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);

  // Cheque/DD fields
  const [chequeDdNo, setChequeDdNo, ] = useState<string>('');
  const [chequeDdDate, setChequeDdDate] = useState<string>('');

  // Transaction ID field (used for Card, Bank Transfer, UPI, Cash)
  const [transactionId, setTransactionId] = useState<string>('');

  // State for searchable product dropdown
  const [popoverOpenStates, setPopoverOpenStates] = useState<Record<string, boolean>>({}); // Individual open states
  const [searchValue, setSearchValue] = useState(""); // Global search for the currently active product popover
  
  // New states for searchable dealer dropdown
  const [isDealerPopoverOpen, setIsDealerPopoverOpen] = useState(false);
  const [dealerSearchValue, setDealerSearchValue] = useState("");

  // Format date as dd/mm/yyyy
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Payment methods options
  const paymentMethodsOptions = ['Cash', 'Card', 'Bank Transfer', 'UPI', 'Cheque/DD'];

  // Fetch dealers and products
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true); // Start local loading
      if (!user) {
        console.log("[MultiItemOrderForm] No user, clearing data and stopping local loading.");
        setDealers([]);
        setProducts([]);
        setLoading(false); // End local loading if no user
        return;
      }

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
          // Removed .order('dealers.name', { ascending: true }) to fix PostgREST parsing error

        if (assignedDealersError) {
          console.error('[MultiItemOrderForm] Error fetching assigned dealers:', assignedDealersError);
          showError(`Failed to load assigned dealers: ${assignedDealersError.message}`);
          setDealers([]);
        } else {
          console.log("[MultiItemOrderForm] Raw assignedDealersData:", assignedDealersData); // Log raw data
          let formattedDealers: Dealer[] = (assignedDealersData || []).map((item: any) => {
            // Corrected access: item.dealers.dealer_balances is an object or null, not an array
            const openingBalance = item.dealers.dealer_balances?.opening_balance || 0;
            return {
              ...item.dealers,
              opening_balance: openingBalance
            };
          });
          // Client-side sorting to ensure dealers are ordered by name
          formattedDealers.sort((a, b) => a.name.localeCompare(b.name));
          setDealers(formattedDealers);
          console.log("[MultiItemOrderForm] Formatted dealers (client-side sorted):", formattedDealers);
        }

        // Fetch all products
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('id, code, name, dp, stock');

        if (productsError) {
          console.error('[MultiItemOrderForm] Error fetching products:', productsError);
          showError(`Failed to load products: ${productsError.message}`);
          setProducts([]);
        } else {
          setProducts(productsData || []);
          console.log("[MultiItemOrderForm] Fetched products:", productsData);
        }
      } catch (error: any) {
        console.error('[MultiItemOrderForm] Error in fetchData:', error);
        showError(`Failed to load data: ${error.message}`);
        setDealers([]);
        setProducts([]);
      } finally {
        setLoading(false); // Always set local loading to false
        console.log("[MultiItemOrderForm] fetchData completed. Local loading set to false.");
      }
    };

    // Only call fetchData if session is NOT loading AND user is available
    if (!sessionLoading && user) {
      console.log("[MultiItemOrderForm] Session loaded and user available. Calling fetchData.");
      fetchData();
    } else if (!sessionLoading && !user) {
      // If session is loaded but no user (e.g., not logged in), ensure local state is clear and not loading
      console.log("[MultiItemOrderForm] Session loaded but no user. Clearing local data.");
      setDealers([]);
      setProducts([]);
      setLoading(false);
    } else if (sessionLoading) {
      // If session is still loading, keep local loading true to show spinner
      console.log("[MultiItemOrderForm] Session still loading. Keeping local loading true.");
      setLoading(true);
    }
  }, [user, sessionLoading]); // Depend on both user and sessionLoading

  // Check for pending payments when dealer is selected
  useEffect(() => {
    const checkPendingPayments = async () => {
      if (!selectedDealer) {
        setPendingPayments([]);
        setTotalPendingAmount(0);
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

        // Calculate payment due date based on allotted credit days
        const today = new Date();
        const dueDate = new Date(today);
        dueDate.setDate(today.getDate() + selectedDealerData.allotted_credit_days);
        setPaymentDueDate(dueDate.toISOString().split('T')[0]); // Format as YYYY-MM-DD
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

      // --- START FIX: Calculate Net Transaction Balance (Orders - Completed Payments) ---
      try {
        const { data: transactions, error: transactionsError } = await supabase
          .from('orders')
          .select(`
            total_amount,
            payments(amount, status)
          `)
          .eq('dealer_id', selectedDealer);

        if (transactionsError) {
          console.error('Error fetching dealer transactions:', transactionsError);
          showError(`Failed to calculate dealer balance: ${transactionsError.message}`);
          setDealerBalance(null);
        } else {
          let netBalance = 0;
          (transactions || []).forEach(order => {
            netBalance += order.total_amount; // Add order amount (Debit)
            (order.payments || []).forEach(payment => {
              if (payment.status === 'completed') {
                netBalance -= payment.amount; // Subtract completed payment (Credit)
              }
            });
          });
          setDealerBalance(netBalance); // This is the net balance from transactions (Orders - Completed Payments)
        }
      } catch (error: any) {
        console.error('Error fetching dealer balance:', error);
        showError(`Failed to calculate dealer balance: ${error.message}`);
        setDealerBalance(null);
      }
      // --- END FIX ---

      // Set payment amount to total order value if paid at order time
      if (isPaidAtOrderTime) {
        setPaymentAmount(parseFloat(calculateTotalOrderValue().toFixed(2)));
      }
    };

    calculateBalanceAndDueDate();
  }, [selectedDealer, dealers, isPaidAtOrderTime, orderItems, allottedCreditDays]);

  const addOrderItem = () => {
    setOrderItems([...orderItems, { id: Date.now().toString(), product_id: '', quantity: 1 }]);
    // When adding a new item, ensure its popover is closed initially
    setPopoverOpenStates(prev => ({ ...prev, [Date.now().toString()]: false }));
  };

  const removeOrderItem = (id: string) => {
    if (orderItems.length > 1) {
      setOrderItems(orderItems.filter(item => item.id !== id));
      // Also remove its popover state
      setPopoverOpenStates(prev => {
        const newState = { ...prev };
        delete newState[id];
        return newState;
      });
    }
  };

  const updateOrderItem = (id: string, field: keyof OrderItem, value: string | number) => {
    setOrderItems(orderItems.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const calculateItemTotal = (item: OrderItem) => {
    const product = products.find(p => p.id === item.product_id);
    return product ? item.quantity * product.dp : 0; // Use product.dp
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

  const isPaymentDetailsValid = useMemo(() => {
    if (!isPaidAtOrderTime) return true;

    if (!paymentMethod || paymentAmount <= 0) return false;

    if (paymentMethod === 'Cheque/DD') {
      if (!chequeDdNo || !chequeDdDate) return false;
    }

    // For Card, Bank Transfer, UPI, we require a transaction ID
    if (paymentMethod === 'Card' || paymentMethod === 'Bank Transfer' || paymentMethod === 'UPI') {
      if (!transactionId) return false;
    }
    
    // Cash allows optional transaction ID, so no strict check needed here.

    return true;
  }, [isPaidAtOrderTime, paymentMethod, paymentAmount, chequeDdNo, chequeDdDate, transactionId]);

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

    // --- CRITICAL VALIDATION CHECK: Payment at order time is mandatory ---
    const isPaidOrderValid = isPaidAtOrderTime && isPaymentDetailsValid;

    if (!isPaidOrderValid) {
        showError('Payment must be received at order time, and all required payment details must be completed.');
        return;
    }
    // --- END CRITICAL VALIDATION CHECK ---

    setLoading(true);

    try {
      const payload: any = {
        dealerId: selectedDealer,
        userId: user.id,
        orderItems: orderItems.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
        })),
        // Payment status is always pending_approval since payment is mandatory at order time
        paymentStatus: 'pending_approval', 
        paymentDueDate: paymentDueDate, // Keep due date for consistency, although it's irrelevant for paid orders
      };

      // Payment details are always included now
      if (isPaidAtOrderTime) {
        payload.paymentDetails = {
          amount: paymentAmount,
          payment_method: paymentMethod,
          cheque_dd_no: paymentMethod === 'Cheque/DD' ? chequeDdNo : null,
          cheque_dd_date: paymentMethod === 'Cheque/DD' ? chequeDdDate : null,
          transaction_id: transactionId || null, // Use transactionId for all methods
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
      setTransactionId('');
      setPaymentDueDate(null);
      setPendingPayments([]);
      setTotalPendingAmount(0);
      setPopoverOpenStates({}); // Clear all product popover states
      setSearchValue(""); // Clear global product search value
      setDealerSearchValue(""); // Clear dealer search value
    } catch (error: any) {
      console.error('Error placing order:', error);
      showError(`Failed to place order: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Filter products based on search value - improved matching
  const filteredProducts = useMemo(() => {
    if (!searchValue) {
      return products;
    }

    const lowerCaseSearchValue = searchValue.toLowerCase();
    const searchWords = lowerCaseSearchValue.split(' ').filter(word => word.length > 0);

    return products.filter(product => {
      const productName = product.name.toLowerCase();
      const productCode = product.code.toLowerCase();

      // Check if ANY of the search words are present in either product name or product code
      return searchWords.some(word => 
        productName.includes(word) || productCode.includes(word)
      );
    });
  }, [products, searchValue]);
  
  // Filter dealers based on search value
  const filteredDealers = useMemo(() => {
    if (!dealerSearchValue) {
      return dealers;
    }
    const lowerCaseSearchValue = dealerSearchValue.toLowerCase();
    return dealers.filter(dealer => 
      dealer.name.toLowerCase().includes(lowerCaseSearchValue)
    );
  }, [dealers, dealerSearchValue]);

  // Condition to disable "Add Item" button
  const disableAddItem = selectedDealer && availableCredit !== null && availableCredit <= 0;

  const currentDealerName = selectedDealer ? dealers.find(d => d.id === selectedDealer)?.name : "Select dealer...";
  
  const calculatedPaymentStatus = isPaidAtOrderTime ? 'Pending Approval' : 'Pending';

  // Determine if the submit button should be disabled based on all conditions
  const isSubmitDisabled = useMemo(() => {
    const baseChecks = loading ||
      !selectedDealer ||
      (remainingCredit !== null && remainingCredit < 0) ||
      totalPendingAmount > 0 ||
      (orderItems.some(item => !item.product_id || item.quantity <= 0));

    if (baseChecks) return true;

    // Payment Path Validation: MUST be paid at order time AND details must be valid.
    const isPaidOrderValid = isPaidAtOrderTime && isPaymentDetailsValid;

    // Submission is disabled if the paid path is NOT valid.
    return !isPaidOrderValid;
  }, [loading, selectedDealer, remainingCredit, totalPendingAmount, orderItems, isPaidAtOrderTime, isPaymentDetailsValid]);


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
                  disabled={dealers.length === 0 || loading}
                >
                  {currentDealerName}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                <Command>
                  <CommandInput
                    placeholder="Search dealer..."
                    value={dealerSearchValue}
                    onValueChange={setDealerSearchValue}
                  />
                  <CommandList className="max-h-[300px] overflow-y-auto">
                    {filteredDealers.length === 0 ? (
                      <CommandEmpty>No dealer found.</CommandEmpty>
                    ) : (
                      <CommandGroup>
                        {filteredDealers.map((dealer) => (
                          <CommandItem
                            key={dealer.id}
                            value={dealer.name}
                            onSelect={(currentValue) => {
                              const selected = dealers.find(d => d.name.toLowerCase() === currentValue.toLowerCase());
                              setSelectedDealer(selected?.id === selectedDealer ? '' : selected?.id || '');
                              setIsDealerPopoverOpen(false);
                              setDealerSearchValue("");
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedDealer === dealer.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {dealer.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            
            {/* Conditional message if no dealers are available after loading */}
            {!loading && dealers.length === 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                No dealers assigned to your account. Please contact an administrator to assign dealers.
              </p>
            )}

            {selectedDealer && totalPendingAmount > 0 && (
              <Alert variant="destructive" className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Overdue Payments</AlertTitle>
                <AlertDescription>
                  Cannot place order. Dealer has overdue payments totaling ₹{totalPendingAmount.toFixed(2)}. Please clear all overdue payments first.
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
                            <td className="text-right">₹{payment.total_amount}</td>
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
                  <span>Net Transaction Balance (Orders - Payments):</span>
                  <span className="font-medium">₹{dealerBalance !== null ? dealerBalance.toFixed(2) : '0.00'}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold">
                  <span>Total Outstanding Balance (Ledger):</span>
                  <span className={usedCredit !== null && usedCredit > dealerCreditLimit ? "text-destructive" : "text-primary"}>
                    ₹{usedCredit !== null ? usedCredit.toFixed(2) : '0.00'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Credit Limit (Current Month):</span>
                  <span className="font-medium">₹{dealerCreditLimit.toFixed(2)}</span>
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
                    <span>Calculated Payment Due Date:</span>
                    <span className="font-medium">{formatDate(paymentDueDate)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold mt-2">
                  <span>Calculated Order Payment Status:</span>
                  <span className={calculatedPaymentStatus === 'Pending Approval' ? 'text-blue-600' : 'text-yellow-600'}>
                    {calculatedPaymentStatus}
                  </span>
                </div>
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
              <Alert variant="destructive" className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Insufficient Credit</AlertTitle>
                <AlertDescription>
                  Dealer's available credit is ₹{availableCredit !== null ? availableCredit.toFixed(2) : '0.00'}. Please clear the balance or increase the credit limit to add more items.
                </AlertDescription>
              </Alert>
            )}

            {orderItems.map((item, index) => (
              <div key={item.id} className="space-y-3 p-4 border rounded-md bg-muted/50">
                {/* Row 1: Product Selection (Label + Button) + Remove Button */}
                <div className="flex items-end gap-2">
                  <div className="flex-grow">
                    <Label htmlFor={`product-${item.id}`}>Product Selection</Label>
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
                          disabled={products.length === 0 || loading}
                        >
                          {item.product_id
                            ? products.find((product) => product.id === item.product_id)?.name
                            : "Select product..."}
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
                            {/* Use filteredProducts here */}
                            {filteredProducts.length === 0 ? (
                              <CommandEmpty>No product found.</CommandEmpty>
                            ) : (
                              <CommandGroup>
                                {filteredProducts.map((product) => (
                                  <CommandItem
                                    key={product.id}
                                    // Refactored: Use product.id as the value for reliable selection
                                    value={product.id} 
                                    onSelect={(productId) => {
                                      // Update the order item with the selected product ID
                                      updateOrderItem(item.id, 'product_id', productId);
                                      
                                      // Close the popover and clear search
                                      setPopoverOpenStates(prev => ({ ...prev, [item.id]: false }));
                                      setSearchValue("");
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        item.product_id === product.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <div>
                                      <div>{product.name} ({product.code})</div>
                                      <div className="text-xs text-muted-foreground">
                                        DP: ₹{product.dp.toFixed(2)} - Stock: {product.stock}
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
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Row 2: Quantity and Item Total - Side by Side */}
                <div className="grid grid-cols-2 gap-4 items-end">
                  <div>
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
                  <div>
                    <Label>Item Total</Label>
                    <div className="font-medium text-lg">₹{calculateItemTotal(item).toFixed(2)}</div>
                  </div>
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
                    setPaymentAmount(parseFloat(totalOrderValue.toFixed(2))); // Use parseFloat for amount
                  } else {
                    setPaymentMethod('');
                    setPaymentAmount(0);
                    setChequeDdNo('');
                    setChequeDdDate('');
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
                    step="0.01" // Allow decimal input
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)} // Use parseFloat
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

                {(paymentMethod === 'Card' || paymentMethod === 'Bank Transfer' || paymentMethod === 'UPI' || paymentMethod === 'Cash') && (
                  <div>
                    <Label htmlFor="transactionId">Transaction ID {paymentMethod === 'Cash' ? '(Optional)' : ''}</Label>
                    <Input
                      id="transactionId"
                      type="text"
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      className="w-full"
                      placeholder={paymentMethod === 'Cash' ? 'Cash transaction reference' : 'e.g., TXN123456789'}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <Button
            type="submit"
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
            disabled={isSubmitDisabled}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Place Order'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default MultiItemOrderForm;