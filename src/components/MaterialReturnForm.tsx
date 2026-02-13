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

interface Dealer {
  id: string;
  name: string;
}

interface MaterialReturnFormProps {
  onReturnRecorded: () => void;
}

const formSchema = z.object({
  dealerId: z.string().uuid({ message: 'Dealer selection is required.' }),
  productId: z.string().uuid({ message: 'Product selection is required.' }),
  quantity: z.preprocess(
    (val) => Number(val),
    z.number().int().min(1, { message: 'Quantity must be at least 1.' })
  ),
  remarks: z.string().max(500, { message: 'Remarks cannot exceed 500 characters.' }).optional(),
  receiptDate: z.string().min(1, { message: 'Return date is required.' }),
});

const MaterialReturnForm: React.FC<MaterialReturnFormProps> = ({ onReturnRecorded }) => {
  const { user } = useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isProductPopoverOpen, setIsProductPopoverOpen] = useState(false);
  const [productSearchValue, setProductSearchValue] = useState("");
  const [isDealerPopoverOpen, setIsDealerPopoverOpen] = useState(false);
  const [dealerSearchValue, setDealerSearchValue] = useState("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      dealerId: '',
      productId: '',
      quantity: 1,
      remarks: '',
      receiptDate: new Date().toISOString().split('T')[0],
    },
  });

  const selectedProductId = form.watch('productId');
  const selectedProduct = products.find(p => p.id === selectedProductId);
  const selectedDealerId = form.watch('dealerId');
  const selectedDealer = dealers.find(d => d.id === selectedDealerId);

  const fetchData = useCallback(async () => {
    setLoadingData(true);
    try {
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, code, name, closing_stock')
        .order('name', { ascending: true });
      if (productsError) throw productsError;
      setProducts(productsData || []);

      const { data: dealersData, error: dealersError } = await supabase
        .from('dealers')
        .select('id, name')
        .order('name', { ascending: true });
      if (dealersError) throw dealersError;
      setDealers(dealersData || []);
    } catch (error: any) {
      console.error('Error fetching data:', error.message);
      showError('Failed to load products or dealers.');
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredProducts = useMemo(() => {
    if (!productSearchValue) return products;
    const lowerCaseSearchValue = productSearchValue.toLowerCase();
    return products.filter(product => 
      product.name.toLowerCase().includes(lowerCaseSearchValue) || 
      product.code.toLowerCase().includes(lowerCaseSearchValue)
    );
  }, [products, productSearchValue]);

  const filteredDealers = useMemo(() => {
    if (!dealerSearchValue) return dealers;
    const lowerCaseSearchValue = dealerSearchValue.toLowerCase();
    return dealers.filter(dealer => 
      dealer.name.toLowerCase().includes(lowerCaseSearchValue)
    );
  }, [dealers, dealerSearchValue]);

  const currentProductDisplay = useMemo(() => {
    if (!selectedProduct) return "Select product...";
    return `${selectedProduct.name} (${selectedProduct.code})`;
  }, [selectedProduct]);

  const currentDealerDisplay = useMemo(() => {
    if (!selectedDealer) return "Select dealer...";
    return selectedDealer.name;
  }, [selectedDealer]);

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

      if (stockError) throw new Error(`Stock update failed: ${stockError.message}`);

      // 2. Insert stock receipt log with dealer_id
      const { error: logError } = await supabase
        .from('stock_receipts')
        .insert({
          product_id: values.productId,
          quantity: values.quantity,
          receipt_date: values.receiptDate,
          received_by: user.id,
          remarks: values.remarks,
          dealer_id: values.dealerId,
        });

      if (logError) throw new Error(`Failed to save history log: ${logError.message}`);

      showSuccess(`Material return recorded successfully! Added ${values.quantity} units of ${selectedProduct?.name}.`);
      form.reset({
        dealerId: '',
        productId: '',
        quantity: 1,
        remarks: '',
        receiptDate: new Date().toISOString().split('T')[0],
      });
      onReturnRecorded();
      fetchData();
    } catch (error: any) {
      console.error('Error recording material return:', error);
      showError(error.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingData) return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <Card className="bg-card text-card-foreground shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold text-primary flex items-center gap-2">
          <Package className="h-6 w-6" /> Material Return Voucher
        </CardTitle>
        <CardDescription className="text-muted-foreground">Record materials returned from a dealer.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="dealerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dealer</FormLabel>
                  <Popover open={isDealerPopoverOpen} onOpenChange={setIsDealerPopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" role="combobox" className="w-full justify-between" disabled={isSubmitting}>
                          {currentDealerDisplay}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <div className="p-2 border-b flex items-center gap-2">
                        <Search className="h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search dealer..." value={dealerSearchValue} onChange={(e) => setDealerSearchValue(e.target.value)} className="h-8 border-none focus-visible:ring-0" />
                      </div>
                      <ScrollArea className="h-[200px]">
                        <div className="p-1">
                          {filteredDealers.map((dealer) => (
                            <Button key={dealer.id} variant="ghost" className="w-full justify-start font-normal" onClick={() => { field.onChange(dealer.id); setIsDealerPopoverOpen(false); setDealerSearchValue(""); }}>
                              <Check className={cn("mr-2 h-4 w-4", field.value === dealer.id ? "opacity-100" : "opacity-0")} />
                              {dealer.name}
                            </Button>
                          ))}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
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
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <div className="p-2 border-b flex items-center gap-2">
                        <Search className="h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search product..." value={productSearchValue} onChange={(e) => setProductSearchValue(e.target.value)} className="h-8 border-none focus-visible:ring-0" />
                      </div>
                      <ScrollArea className="h-[300px]">
                        <div className="p-1">
                          {filteredProducts.map((product) => (
                            <Button key={product.id} variant="ghost" className="w-full justify-start font-normal h-auto py-2" onClick={() => { field.onChange(product.id); setIsProductPopoverOpen(false); setProductSearchValue(""); }}>
                              <div className="flex flex-col items-start w-full">
                                <div className="flex items-center"><Check className={cn("mr-2 h-4 w-4", field.value === product.id ? "opacity-100" : "opacity-0")} /><span className="font-medium">{product.name} ({product.code})</span></div>
                                <div className="text-xs text-muted-foreground ml-6">Current Stock: {product.closing_stock}</div>
                              </div>
                            </Button>
                          ))}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="quantity" render={({ field }) => (<FormItem><FormLabel>Quantity Returned</FormLabel><FormControl><Input type="number" {...field} min={1} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="receiptDate" render={({ field }) => (<FormItem><FormLabel>Return Date</FormLabel><FormControl><Input type="date" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="remarks" render={({ field }) => (<FormItem><FormLabel>Remarks (Optional)</FormLabel><FormControl><Textarea {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)} />
            <Button type="submit" className="w-full" disabled={isSubmitting || !form.formState.isValid}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Record Material Return'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default MaterialReturnForm;