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
import { Loader2, Package, Check, ChevronsUpDown, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Product {
  id: string;
  code: string;
  name: string;
  closing_stock: number;
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
  
  const [isProductPopoverOpen, setIsProductPopoverOpen] = useState(false);
  const [productSearchValue, setProductSearchValue] = useState("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      productId: '',
      quantity: 1,
      remarks: '',
      receiptDate: new Date().toISOString().split('T')[0],
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
      // 1. Update stock via RPC
      const { error: stockError } = await supabase.rpc('increment_stock', {
        product_id_in: values.productId,
        quantity_in: values.quantity
      });

      if (stockError) throw stockError;

      // 2. Insert stock receipt log
      await supabase
        .from('stock_receipts')
        .insert({
          product_id: values.productId,
          quantity: values.quantity,
          receipt_date: values.receiptDate,
          received_by: user.id,
          remarks: values.remarks,
        });

      // 3. Resolve alerts if stock is now positive
      const { data: productData } = await supabase
        .from('products')
        .select('closing_stock')
        .eq('id', values.productId)
        .single();
      
      if (productData && productData.closing_stock >= 0) {
        await supabase.from('production_alerts').update({ resolved: true }).eq('product_id', values.productId).eq('resolved', false);
      }

      showSuccess(`Stock updated successfully! Added ${values.quantity} units to ${selectedProduct?.name}.`);
      form.reset({
        productId: '',
        quantity: 1,
        remarks: '',
        receiptDate: new Date().toISOString().split('T')[0],
      });
      onReceiptRecorded();
      fetchProducts();
    } catch (error: any) {
      console.error('Error recording stock receipt:', error);
      showError(`Failed to record stock receipt: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingProducts) return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <Card className="bg-card text-card-foreground shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold text-primary flex items-center gap-2">
          <Package className="h-6 w-6" /> Record Stock Receipt
        </CardTitle>
        <CardDescription className="text-muted-foreground">Log new inventory received for a product.</CardDescription>
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
                          className="w-full justify-between" 
                          disabled={isSubmitting}
                        >
                          {currentProductDisplay}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <div className="p-2 border-b flex items-center gap-2">
                        <Search className="h-4 w-4 text-muted-foreground" />
                        <Input 
                          placeholder="Search product..." 
                          value={productSearchValue} 
                          onChange={(e) => setProductSearchValue(e.target.value)} 
                          className="h-8 border-none focus-visible:ring-0" 
                        />
                      </div>
                      <ScrollArea className="h-[300px]">
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
                                  field.onChange(product.id);
                                  setIsProductPopoverOpen(false);
                                  setProductSearchValue("");
                                }}
                              >
                                <div className="flex flex-col items-start w-full">
                                  <div className="flex items-center">
                                    <Check className={cn("mr-2 h-4 w-4", field.value === product.id ? "opacity-100" : "opacity-0")} />
                                    <span className="font-medium">{product.name} ({product.code})</span>
                                  </div>
                                  <div className="text-xs text-muted-foreground ml-6">Current Stock: {product.closing_stock}</div>
                                </div>
                              </Button>
                            ))
                          )}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="quantity" render={({ field }) => (<FormItem><FormLabel>Quantity Received</FormLabel><FormControl><Input type="number" {...field} min={1} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="receiptDate" render={({ field }) => (<FormItem><FormLabel>Receipt Date</FormLabel><FormControl><Input type="date" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="remarks" render={({ field }) => (<FormItem><FormLabel>Remarks (Optional)</FormLabel><FormControl><Textarea {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)} />
            <Button type="submit" className="w-full" disabled={isSubmitting || !form.formState.isValid}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Record Stock Receipt'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default StockReceiptForm;