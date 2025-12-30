"use client";
import React, { useState, useEffect } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox'; // Import Checkbox

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
  allotted_credit_days: number; // Added
}

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
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
  const [allottedCreditDays, setAllottedCreditDays] = useState<number>(0); // Added
  const [paymentDueDate, setPaymentDueDate] = useState<string | null>(null); // Added

  // Payment at order time states
  const [isPaidAtOrderTime, setIsPaidAtOrderTime] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [chequeDdNo, setChequeDdNo] = useState<string>('');
  const [chequeDdDate, setChequeDdDate] = useState<string>('');

  const paymentMethodsOptions = ['Cash', 'Card', 'Bank Transfer', 'UPI', 'Cheque/DD'];

  // Fetch dealers and products
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      // Fetch dealers assigned to the current user
      const { data: assignedDealersData, error: assignedDealersError } = await supabase
        .from('dealer_sales_persons')
        .select('dealers(id, name, credit_limit, allotted_credit_days)') // Select allotted_credit_days
        .eq('sales_person_id', user.id);

      if (assignedDealersError) {
        console.error('Error fetching assigned dealers:', assignedDealersError);
        showError(`Failed to load assigned dealers: ${assignedDealersError.message}`);
        setDealers([]);
      } else {
        const formattedDealers: Dealer[] = (assignedDealersData || []).map((item: any) => item.dealers);
        setDealers(formattedDealers);
      }

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
    };

    fetchData();
  }, [user]);

  // Calculate dealer balance and payment due date when dealer is selected or order items change
  useEffect(() => {
    const calculateBalanceAndDueDate = async () => {
      if (!selectedDealer) {
        setDealerBalance(null);
        setDealerCreditLimit(0);
        setAllottedCreditDays(0);
        setPaymentDueDate(null);
        setPaymentAmount(0); // Reset payment amount
        return;
      }

      const selectedDealerData = dealers.find(d => d.id === selectedDealer);
      if (selectedDealerData) {
        setDealerCreditLimit(selectedDealerData.credit_limit);
        setAllottedCreditDays(selectedDealerData.allotted_credit_days);

        // Calculate payment due date
        const today = new Date();
        today.setDate(today.getDate() + selectedDealerData.allotted_credit_days);
        setPaymentDueDate(today.toISOString().split('T')[0]); // YYYY-MM-DD format
      }

      // Fetch total spent by this dealer from the 'orders' table
      const { data, error } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('dealer_id', selectedDealer);

      if (error) {
        console.error('Error fetching dealer balance:', error);
        showError(`Failed to calculate dealer balance: ${error.message}`);
        setDealerBalance(null);
      } else {
        const totalSpent = data.reduce((sum, order) => sum + order.total_amount, 0);
        setDealerBalance(totalSpent);
      }
      
      // Set payment amount to total order value if paid at order time
      if (isPaidAtOrderTime) {
        setPaymentAmount(calculateTotalOrderValue());
      }
    };

    calculateBalanceAndDueDate();
  }, [selectedDealer, dealers, isPaidAtOrderTime, orderItems]); // Added orderItems to dependencies

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

  const availableCredit = dealerBalance !== null ? dealerCreditLimit - dealerBalance : null;
  const totalOrderValue = calculateTotalOrderValue();
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
    
    if (orderItems.some(item => !item.product_id || item.quantity <= 0)) {
      showError('Please fill in all product fields and ensure quantities are positive.');
      return;
    }

    if (remainingCredit !== null && remainingCredit < 0) {
      showError('Order exceeds dealer\'s available credit limit.');
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
      if (paymentMethod === 'Cheque/DD' && (!chequeDdNo || !chequeDdDate)) {
        showError('Please enter Cheque/DD number and date.');
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
        paymentStatus: isPaidAtOrderTime ? 'paid' : 'pending', // Set payment status
        paymentDueDate: paymentDueDate, // Pass payment due date
      };

      if (isPaidAtOrderTime) {
        payload.paymentDetails = {
          amount: paymentAmount,
          payment_method: paymentMethod,
          cheque_dd_no: paymentMethod === 'Cheque/DD' ? chequeDdNo : null,
          cheque_dd_date: paymentMethod === 'Cheque/DD' ? chequeDdDate : null,
        };
      }

      const response = await fetch(CREATE_MULTI_ITEM_ORDER_EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Include Authorization header if your Edge Function requires JWT verification
          // 'Authorization': `Bearer ${user.token}` 
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
      setPaymentDueDate(null);
    } catch (error: any) {
      console.error('Error placing order:', error);
      showError(`Failed to place order: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-card text-card-foreground shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-primary">Place New Order</CardTitle>
        <CardDescription className="text-muted-foreground">
          Create an order with multiple items for a registered dealer.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="dealer">Dealer</Label>
            <Select value={selectedDealer} onValueChange={setSelectedDealer} disabled={dealers.length === 0}>
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
            
            {selectedDealer && dealerBalance !== null && (
              <div className="mt-2 p-3 bg-muted rounded-md">
                <div className="flex justify-between text-sm">
                  <span>Credit Limit:</span>
                  <span className="font-medium">₹{dealerCreditLimit.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Used Credit:</span>
                  <span className="font-medium">₹{dealerBalance.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold">
                  <span>Available Credit:</span>
                  <span className={availableCredit && availableCredit < 0 ? "text-destructive" : "text-primary"}>
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
                    <span className="font-medium">{new Date(paymentDueDate).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label>Order Items</Label>
              <Button type="button" onClick={addOrderItem} size="sm" className="flex items-center gap-1">
                <Plus className="h-4 w-4" /> Add Item
              </Button>
            </div>
            
            {orderItems.map((item, index) => (
              <div key={item.id} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5">
                  <Label htmlFor={`product-${item.id}`}>Product</Label>
                  <Select 
                    value={item.product_id} 
                    onValueChange={(value) => updateOrderItem(item.id, 'product_id', value)}
                    disabled={products.length === 0}
                  >
                    <SelectTrigger id={`product-${item.id}`} className="w-full">
                      <SelectValue placeholder={products.length === 0 ? "No products available" : "Select a product"} />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} (₹{product.price.toFixed(2)}) - Stock: {product.stock}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                    setPaymentAmount(totalOrderValue); // Default to total order value
                  } else {
                    setPaymentMethod('');
                    setPaymentAmount(0);
                    setChequeDdNo('');
                    setChequeDdDate('');
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
              </div>
            )}
          </div>

          <Button 
            type="submit" 
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
            disabled={loading || !selectedDealer || (remainingCredit !== null && remainingCredit < 0)}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Place Order'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default MultiItemOrderForm;