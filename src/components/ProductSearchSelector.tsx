"use client";

import React, { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface Product {
  id: string;
  code: string;
  name: string;
  dp: number;
  closing_stock: number;
  gst: string;
}

interface ProductSearchSelectorProps {
  products: Product[];
  selectedProductId: string;
  onSelect: (product: Product) => void;
  disabled?: boolean;
  className?: string;
}

const ProductSearchSelector: React.FC<ProductSearchSelectorProps> = ({
  products,
  selectedProductId,
  onSelect,
  disabled = false,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredProducts = useMemo(() => {
    if (!search) return products;
    const s = search.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(s) || p.code.toLowerCase().includes(s));
  }, [products, search]);

  const selectedProduct = useMemo(() => 
    products.find(p => p.id === selectedProductId), 
    [products, selectedProductId]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between text-left font-normal h-auto py-1 px-2 hover:bg-accent/50", className)}
          disabled={disabled}
        >
          <div className="flex flex-col items-start overflow-hidden">
            <span className="truncate w-full font-medium">
              {selectedProduct ? selectedProduct.name : "Select product..."}
            </span>
            {selectedProduct && (
              <span className="text-[10px] text-muted-foreground truncate">
                Code: {selectedProduct.code}
              </span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0" align="start">
        <div className="p-2 border-b flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 border-none focus-visible:ring-0"
          />
        </div>
        <ScrollArea className="h-[250px]">
          <div className="p-1">
            {filteredProducts.length === 0 ? (
              <div className="p-2 text-sm text-center text-muted-foreground">No product found.</div>
            ) : (
              filteredProducts.map((product) => (
                <Button
                  key={product.id}
                  variant="ghost"
                  className="w-full justify-start font-normal h-auto py-2"
                  onClick={() => {
                    onSelect(product);
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  <div className="flex flex-col items-start w-full">
                    <div className="flex items-center justify-between w-full gap-2">
                      <div className="flex items-center min-w-0">
                        <Check className={cn("mr-2 h-4 w-4 flex-shrink-0", selectedProductId === product.id ? "opacity-100" : "opacity-0")} />
                        <span className="font-medium truncate">{product.name}</span>
                      </div>
                      <span className="text-xs font-bold text-primary flex-shrink-0">₹{product.dp.toFixed(2)}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground ml-6 flex gap-2">
                      <span className="bg-muted px-1 rounded">Code: {product.code}</span>
                      <span>Stock: {product.closing_stock}</span>
                    </div>
                  </div>
                </Button>
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default ProductSearchSelector;