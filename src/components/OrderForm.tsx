"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { showSuccess, showError } from '@/utils/toast';

interface OrderFormProps {
  products: { id: string; name: string; price: number; stock: number }[];
  wholesalers: { id: string; name: string }[];
}

const OrderForm: React.FC<OrderFormProps> = ({ products, wholesalers }) => {
  const [selectedWholesaler, setSelectedWholesaler] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWholesaler || !selectedProduct || quantity <= 0) {
      showError('Please fill in all fields and ensure quantity is positive.');
      return;
    }

    const product = products.find(p => p.id === selectedProduct);
    if (!product) {
      showError('Selected product not found.');
      return;
    }
    if (quantity > product.stock) {
      showError(`Not enough stock for ${product.name}. Available: ${product.stock}`);
      return;
    }

    console.log({
      wholesalerId: selectedWholesaler,
      productId: selectedProduct,
      quantity,
      totalPrice: quantity * product.price,
    });
    showSuccess('Order placed successfully!');
    // Reset form
    setSelectedWholesaler('');
    setSelectedProduct('');
    setQuantity(1);
  };

  return (
    <Card className="bg-card text-card-foreground shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-primary">Place New Order</CardTitle>
        <CardDescription className="text-muted-foreground">Create an order for a registered wholesaler.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="wholesaler">Wholesaler</Label>
            <Select value={selectedWholesaler} onValueChange={setSelectedWholesaler}>
              <SelectTrigger id="wholesaler" className="w-full">
                <SelectValue placeholder="Select a wholesaler" />
              </SelectTrigger>
              <SelectContent>
                {wholesalers.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
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
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} (${p.price.toFixed(2)})
                  </SelectItem>
                ))}
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
          <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
            Place Order
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default OrderForm;