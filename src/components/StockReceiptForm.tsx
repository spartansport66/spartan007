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
import { Loader2, Package, Check, ChevronsUpDown } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface Product {
  id: string;
  code: string;
  name: string;
  stock: number;
}

interface StockReceiptFormProps {
  onReceiptRecorded: () => void;
}

const formSchema = z.object({
  productId: z.string().uuid({ message: 'Product selection is required.' }),
  quantity: z.preprocess(
    (val) => Number(val),
    z.number().int().min(1, { message: 'Quantity must be at least 1.' })
  ),
  remarks: z.string().max(500, { message: 'Remarks cannot exceed 500 characters.' }).optional(),
  receiptDate: z.string().min(1, { message: 'Receipt date is required.' }),
});

const StockReceiptForm: React.FC<StockReceiptFormProps> = ({ onReceiptRecorded }) => {
  const { user } = useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Searchable product dropdown states
  const [isProductPopoverOpen, setIsProductPopoverOpen] = useState(false);
  const [productSearchValue, setProductSearchValue] = useState("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      productId: '',
      quantity: 1,
      remarks: '',
      receiptDate: new Date().toISOString().split('T')[0], // Default to today
    },
  });

  const selectedProductId = form.watch('productId');
  const selectedProduct = products.find(p => p.id === selectedProductId);

  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, code, name, stock')
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
    if (!productSearchValue) {
      return products;
    }
    const lowerCaseSearchValue = productSearchValue.toLowerCase();
    const searchWords = lowerCaseSearchValue.split(' ').filter(word => word.length > 0);

    return products.filter(product => {
      const productName = product.name.toLowerCase();
      const productCode = product.code.toLowerCase();

      return searchWords.some(word => 
        productName.includes(word) || productCode.includes(word)
      );
    });
  }, [products, productSearchValue]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      showError('User not authenticated.');
      return;
    }
    setIsSubmitting(true);

    try {
      // 1. Fetch current stock to calculate new stock
      const { data: currentProduct, error: fetchError } = await supabase
        .from('products')
        .select('stock')
        .eq('id', values.productId)
        .single();

      if (fetchError) throw fetchError;
      
      const newStock = (currentProduct?.stock || 0) + values.quantity;

      // 2. Update product stock
      const { error: updateError } = await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', values.productId);

      if (updateError) throw updateError;

      // 3. Insert stock receipt log (assuming table exists)
      const { error: logError } = await supabase
        .from('stock_receipts')
        .insert({
          product_id: values.productId,
          quantity: values.quantity,
          receipt_date: values.receiptDate,
          received_by: user.id,
          remarks: values.remarks,
        });

      if (logError) {
        console.warn('Failed to log stock receipt, but stock was updated:', logError.message);
        // Do not throw, as the critical stock update succeeded
      }
      
      // 4. Check and resolve production alerts if stock is now positive
      if (newStock >= 0) {
        const { error: resolveAlertsError } = await supabase
          .from('production_alerts')
          .update({ resolved: true })
          .eq('product_id', values.productId)
          .eq('resolved', false);
        
        if (resolveAlertsError) {
          console.warn('Failed to resolve production alerts:', resolveAlertsError.message);
        }
      }

      showSuccess(`Stock updated successfully! Added ${values.quantity} units to ${selectedProduct?.name || 'product'}. New stock: ${newStock}.`);
      form.reset({
        productId: '',
        quantity: 1,
        remarks: '',
        receiptDate: new Date().toISOString().split('T')[0],
      });
      onReceiptRecorded(); // Notify parent to refresh tables/alerts
      fetchProducts(); // Refresh local product list to show updated stock
    } catch (error: any) {
      console.error('Error recording stock receipt:', error);
      showError(`Failed to record stock receipt: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingProducts) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading products...</p>
      </div>
    );
  }

  return (
    <Card className="bg-card text-card-foreground shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold text-primary flex items-center gap-2">
          <Package className="h-6 w-6" /> Record Stock Receipt
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Log new inventory received for a product.
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
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={isProductPopoverOpen}
                          className="w-full justify-between"
                          disabled={products.length === 0 || isSubmitting}
                        >
                          {selectedProduct?.name || "Select product..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                      <Command>
                        <CommandInput
                          placeholder="Search product..."
                          value={productSearchValue}
                          onValueChange={setProductSearchValue}
                        />
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
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      field.value === product.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div>
                                    <div>{product.name} ({product.code})</div>
                                    <div className="text-xs text-muted-foreground">
                                      Current Stock: {product.stock}
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
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity Received</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="e.g., 100" {...field} min={1} disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="receiptDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Receipt Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Remarks (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Source, batch number, etc." {...field} disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={isSubmitting || !form.formState.isValid}>
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                'Record Stock Receipt'
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default StockReceiptForm;