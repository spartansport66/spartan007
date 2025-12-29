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
}

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
}

interface DealerBalance {
  total_spent: number;
}

const MultiItemOrderForm: React.FC = () => {
  const { user } = useSession();
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedDealer, setSelectedDealer] = useState<string>('');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([{ id: Date.now().toString(), product_id: '', quantity: 1 }]);
  const [loading, setLoading] = useState(false);
  const [dealerBalance, setDealerBalance] = useState<number | null>(null);
  const [dealerCreditLimit, setDealerCreditLimit] = useState<number>(0);

  // Fetch dealers and products
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      // Fetch dealers assigned to the current user
      const { data: assignedDealersData, error: assignedDealersError } = await supabase
        .from('dealer_sales_persons')
        .select('dealers(id, name, credit_limit)')
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

  // Calculate dealer balance when dealer is selected
  useEffect(() => {
    const calculateBalance = async () => {
      if (!selectedDealer) {
        setDealerBalance(null);
        return;
      }

      const selectedDealerData = dealers.find(d => d.id === selectedDealer);
      if (selectedDealerData) {
        setDealerCreditLimit(selectedDealerData.credit_limit);
      }

      // Fetch total spent by this dealer
      const { data, error } = await supabase
        .from('sales')
        .select('total_price')
        .eq('dealer_id', selectedDealer);

      if (error) {
        console.error('Error fetching dealer balance:', error);
        showError(`Failed to calculate dealer balance: ${error.message}`);
        setDealerBalance(null);
      } else {
        const totalSpent = data.reduce((sum, sale) => sum + sale.total_price, 0);
        setDealerBalance(totalSpent);
      }
    };

    calculateBalance();
  }, [selectedDealer, dealers]);

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

    // Validate dealer credit limit
    if (dealerBalance === null) {
      showError('Unable to verify dealer balance. Please try again.');
      return;
    }

    // Calculate total order value
    let totalOrderValue = 0;
    const orderDetails: { product_id: string; quantity: number; total_price: number; product: Product }[] = [];

    for (const item of orderItems) {
      const product = products.find(p => p.id === item.product_id);
      if (!product) {
        showError(`Product not found for item ${item.id}`);
        return;
      }

      if (item.quantity > product.stock) {
        showError(`Not enough stock for ${product.name}. Available: ${product.stock}`);
        return;
      }

      const itemTotal = item.quantity * product.price;
      totalOrderValue += itemTotal;
      orderDetails.push({
        product_id: item.product_id,
        quantity: item.quantity,
        total_price: itemTotal,
        product
      });
    }

    const availableCredit = dealerCreditLimit - dealerBalance;
    
    if (totalOrderValue > availableCredit) {
      showError(
        `Order exceeds dealer's credit limit. Available credit: ₹${availableCredit.toFixed(2)}. ` +
        `Please reduce your order to ₹${availableCredit.toFixed(2)} or request a credit limit increase.`
      );
      return;
    }

    setLoading(true);
    
    try {
      // Record all sales in a transaction
      const salesData = orderDetails.map(detail => ({
        user_id: user.id,
        product_id: detail.product_id,
        dealer_id: selectedDealer,
        quantity: detail.quantity,
        total_price: detail.total_price
      }));

      const { error: salesError } = await supabase.from('sales').insert(salesData);
      
      if (salesError) {
        throw salesError;
      }

      // Update product stock for each item
      for (const detail of orderDetails) {
        const newStock = detail.product.stock - detail.quantity;
        const { error: stockError } = await supabase
          .from('products')
          .update({ stock: newStock })
          .eq('id', detail.product_id);
          
        if (stockError) {
          throw stockError;
        }
      }

      showSuccess('Order placed successfully!');
      
      // Reset form
      setSelectedDealer('');
      setOrderItems([{ id: Date.now().toString(), product_id: '', quantity: 1 }]);
      setDealerBalance(null);
    } catch (error: any) {
      console.error('Error placing order:', error);
      showError(`Failed to place order: ${error.message}`);
    } finally {
      setLoading(false);
    }
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