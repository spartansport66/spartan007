"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ProductCardProps {
  product: {
    id: string;
    code: string; // New
    name: string;
    description: string;
    size: string; // New
    hsn: string; // New
    gst: number; // New
    dp: number; // New
    mrp: number; // Renamed from price
    stock: number;
  };
  onAddToCart?: (productId: string) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart }) => {
  return (
    <Card className="flex flex-col h-full bg-card text-card-foreground shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-primary">{product.name} ({product.code})</CardTitle>
        <CardDescription className="text-muted-foreground">{product.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        <p className="text-lg text-muted-foreground">Size: {product.size || 'N/A'}</p>
        <p className="text-lg text-muted-foreground">HSN: {product.hsn || 'N/A'}</p>
        <p className="text-lg text-muted-foreground">GST: {product.gst.toFixed(2)}%</p>
        <p className="text-2xl font-bold text-accent-foreground mb-2">DP: ₹{product.dp.toFixed(2)}</p>
        <p className="text-lg text-muted-foreground line-through">MRP: ₹{product.mrp.toFixed(2)}</p>
        <p className="text-sm text-muted-foreground">In Stock: {product.stock}</p>
      </CardContent>
      {onAddToCart && (
        <CardFooter>
          <Button onClick={() => onAddToCart(product.id)} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
            Add to Cart
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};

export default ProductCard;