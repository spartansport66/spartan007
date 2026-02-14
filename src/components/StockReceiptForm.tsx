"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, Check, ChevronsUpDown, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { useSession } from '@/contexts/SessionContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Product {
  id: string;
  name: string;
  code: string;
}

interface StockReceiptFormProps {
  onReceiptRecorded: () => void;
}

const StockReceiptForm: React.FC<StockReceiptFormProps> = ({ onReceiptRecorded }) => {
  const { user } = useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');

  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.from('products').select('id, name, code').order('name');
        if (error) throw error;
        setProducts(data || []);
      } catch (error: any) {
        showError(`Failed to load products: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedProductId || quantity <= 0) {
      showError('Please select a product and enter a valid quantity.');
      return;
    }
    setIsSubmitting(true);
    try {
      // 1. Record the receipt in the history table
      const { error: receiptError } = await supabase
        .from('stock_receipts')
        .insert({
          product_id: selectedProductId,
          quantity: quantity,
          receipt_date: receiptDate,
          remarks: remarks,
          created_by: user.id,
        });
      if (receiptError) throw receiptError;

      // 2. Call RPC to increment stock
      const { error: rpcError } = await supabase.rpc('increment_stock', {
        product_id_in: selectedProductId,
        quantity_in: quantity,
      });
      if (rpcError) throw rpcError;

      showSuccess('Stock receipt recorded successfully!');
      setSelectedProductId('');
      setQuantity(1);
      setRemarks('');
      onReceiptRecorded();
    } catch (error: any) {
      showError(`Error recording stock: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProducts = useMemo(() => {
    if (!productSearch) return products;
    const search = productSearch.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(search) || p.code.toLowerCase().includes(search));
  }, [products, productSearch]);

  const selectedProductName = selectedProductId ? products.find(p => p.id === selectedProductId)?.name : "Select product...";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Record Stock Receipt</CardTitle>
        <CardDescription>Manually add incoming stock to your inventory.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Product</Label>
            <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between" disabled={loading}>
                  {loading ? "Loading products..." : selectedProductName}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                <div className="p-2 border-b"><Input placeholder="Search product..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="h-8" /></div>
                <ScrollArea className="h-[200px]"><div className="p-1">{filteredProducts.map((p) => (<Button key={p.id} variant="ghost" className="w-full justify-start font-normal" onClick={() => { setSelectedProductId(p.id); setIsPopoverOpen(false); }}><Check className={cn("mr-2 h-4 w-4", selectedProductId === p.id ? "opacity-100" : "opacity-0")} />{p.name} ({p.code})</Button>))}</div></ScrollArea>
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input type="number" value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 1)} min="1" required />
            </div>
            <div className="space-y-2">
              <Label>Receipt Date</Label>
              <Input type="date" value={receiptDate} onChange={e => setReceiptDate(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Remarks (Optional)</Label>
            <Textarea value={remarks} onChange={e => setRemarks(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting || loading}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Add Stock
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default StockReceiptForm;