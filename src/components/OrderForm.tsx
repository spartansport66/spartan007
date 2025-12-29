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
import { Loader2 } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
}

interface Dealer {
  id: string;
  name: string;
}

interface OrderFormProps {
  products: Product[];
  dealers: Dealer[];
  onOrderPlaced?: () => void; // Callback to refresh dashboard data
}

const OrderForm: React.FC<OrderFormProps> = ({ products: availableProducts, dealers: availableDealers, onOrderPlaced }) => {
  const { user } = useSession();
  const [selectedDealer, setSelectedDealer] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showError('You must be logged in to place an order.');
      return;
    }
    if (!selectedDealer || !selectedProduct || quantity <= 0) {
      showError('Please fill in all fields and ensure quantity is positive.');
      return;
    }

    const product = availableProducts.find(p => p.id === selectedProduct);
    if (!product) {
      showError('Selected product not found.');
      return;
    }
    if (quantity > product.stock) {
      showError(`Not enough stock for ${product.name}. Available: ${product.stock}`);
      return;
    }

    setLoading(true);
    try {
      // Record the sale
      const { error: saleError } = await supabase.from('sales').insert({
        user_id: user.id,
        product_id: selectedProduct,
        dealer_id: selectedDealer,
        quantity: quantity,
        total_price: quantity * product.price,
      });

      if (saleError) {
        throw saleError;
      }

      // Update product stock
      const newStock = product.stock - quantity;
      const { error: stockError } = await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', selectedProduct);

      if (stockError) {
        throw stockError;
      }

      showSuccess('Order placed successfully!');
      // Reset form
      setSelectedDealer('');
      setSelectedProduct('');
      setQuantity(1);
      if (onOrderPlaced) {
        onOrderPlaced(); // Notify parent to refresh data
      }
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
        <CardDescription className="text-muted-foreground">Create an order for a registered dealer.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="dealer">Dealer</Label>
            <Select value={selectedDealer} onValueChange={setSelectedDealer}>
              <SelectTrigger id="dealer" className="w-full">
                <SelectValue placeholder="Select a dealer" />
              </SelectTrigger>
              <SelectContent>
                {availableDealers.length === 0 ? (
                  <SelectItem value="" disabled>No dealers available</SelectItem>
                ) : (
                  availableDealers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="product">Product</Label>
            <Select value={selectedProduct} onValueChange={setSelectedProduct}>
              <SelectTrigger id="product" className="w-full">
                <SelectValue placeholder="Select a product" />
              </SelectTrigger>
              <SelectContent>
                {availableProducts.length === 0 ? (
                  <SelectItem value="" disabled>No products available</SelectItem>
                ) : (
                  availableProducts.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} (${p.price.toFixed(2)}) - Stock: {p.stock}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              min="1"
              className="w-full"
            />
          </div>
          <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Place Order'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default OrderForm;