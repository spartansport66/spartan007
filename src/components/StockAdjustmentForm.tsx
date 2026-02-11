"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { Loader2, Scale, Check, ChevronsUpDown, Search } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface Product {
  id: string;
  code: string;
  name: string;
  closing_stock: number;
}

interface StockAdjustmentFormProps {
  onAdjustmentRecorded: () => void;
}

const formSchema = z.object({
  productId: z.string().uuid({ message: 'Product selection is required.' }),
  quantity: z.preprocess(
    (val) => Number(val),
    z.number().int().refine(n => n !== 0, { message: 'Quantity cannot be zero.' })
  ),
  reason: z.string().min(3, { message: 'Please provide a reason (min 3 chars).' }).max(500),
});

const StockAdjustmentForm: React.FC<StockAdjustmentFormProps> = ({ onAdjustmentRecorded }) => {
  const { user } = useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isProductPopoverOpen, setIsProductPopoverOpen] = useState(false);
  const [productSearchValue, setProductSearchValue] = useState("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      productId: '',
      quantity: 0,
      reason: '',
    },
  });

  const selectedProductId = form.watch('productId');
  const selectedProduct = products.find(p => p.id === selectedProductId);

  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, code, name, closing_stock')
        .order('name', { ascending: true });

      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      console.error('Error fetching products:', error.message);
      showError('Failed to load products.');
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const filteredProducts = useMemo(() => {
    if (!productSearchValue) return products;
    const lowerCaseSearchValue = productSearchValue.toLowerCase();
    return products.filter(product => 
      product.name.toLowerCase().includes(lowerCaseSearchValue) || 
      product.code.toLowerCase().includes(lowerCaseSearchValue)
    );
  }, [products, productSearchValue]);

  const currentProductDisplay = useMemo(() => {
    if (!selectedProduct) return "Select product...";
    return `${selectedProduct.name} (${selectedProduct.code})`;
  }, [selectedProduct]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      showError('User not authenticated.');
      return;
    }
    setIsSubmitting(true);

    try {
      // Insert adjustment record (Trigger handles the product table update)
      const { error } = await supabase
        .from('stock_adjustments')
        .insert({
          product_id: values.productId,
          quantity: values.quantity,
          reason: values.reason,
          adjusted_by: user.id,
        });

      if (error) throw error;

      const action = values.quantity > 0 ? 'Added' : 'Removed';
      showSuccess(`Stock adjusted successfully! ${action} ${Math.abs(values.quantity)} units for ${selectedProduct?.name}.`);
      
      form.reset({
        productId: '',
        quantity: 0,
        reason: '',
      });
      onAdjustmentRecorded();
      fetchProducts();
    } catch (error: any) {
      console.error('Error recording stock adjustment:', error);
      showError(`Failed to record adjustment: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingProducts) return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <Card className="bg-card text-card-foreground shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold text-primary flex items-center gap-2">
          <Scale className="h-6 w-6" /> Manual Stock Adjustment
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Manually correct stock levels. Use positive numbers to add and negative numbers to subtract.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="productId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product</FormLabel>
                  <Popover open={isProductPopoverOpen} onOpenChange={setIsProductPopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" role="combobox" className="w-full justify-between" disabled={isSubmitting}>
                          {currentProductDisplay}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                      <Command>
                        <div className="flex items-center border-b px-3">
                          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                          <Input 
                            placeholder="Search product..." 
                            value={productSearchValue} 
                            onChange={(e) => setProductSearchValue(e.target.value)}
                            className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none border-none focus-visible:ring-0"
                          />
                        </div>
                        <CommandList className="max-h-[300px] overflow-y-auto">
                          {filteredProducts.length === 0 ? (
                            <CommandEmpty>No product found.</CommandEmpty>
                          ) : (
                            <CommandGroup>
                              {filteredProducts.map((product) => (
                                <CommandItem
                                  key={product.id}
                                  value={product.name}
                                  onSelect={() => {
                                    field.onChange(product.id);
                                    setIsProductPopoverOpen(false);
                                    setProductSearchValue("");
                                  }}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", field.value === product.id ? "opacity-100" : "opacity-0")} />
                                  <div className="flex flex-col">
                                    <span>{product.name} ({product.code})</span>
                                    <span className="text-xs text-muted-foreground">Current Stock: {product.closing_stock}</span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adjustment Quantity</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="e.g. 10 or -5" 
                        {...field} 
                        disabled={isSubmitting} 
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">Use negative values (e.g., -10) to reduce stock.</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="bg-muted p-3 rounded-md flex flex-col justify-center">
                <span className="text-xs text-muted-foreground uppercase font-bold">New Estimated Stock</span>
                <span className="text-xl font-bold">
                  {selectedProduct ? (selectedProduct.closing_stock + (form.watch('quantity') || 0)) : '--'}
                </span>
              </div>
            </div>

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason for Adjustment</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="e.g., Found missing stock, Damaged during handling, Correction..." 
                      {...field} 
                      disabled={isSubmitting} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isSubmitting || !form.formState.isValid}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Apply Adjustment'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default StockAdjustmentForm;