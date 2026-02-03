"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { useSession } from '@/contexts/SessionContext';

const RECORD_PURCHASE_EDGE_FUNCTION_URL = "https://hxftiocfihhdutciaisl.supabase.co/functions/v1/record-purchase";

interface Product {
  id: string;
  name: string;
  code: string;
}

interface Supplier {
  id: string;
  name: string;
}

interface PurchaseItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
}

interface RecordPurchaseFormProps {
  onPurchaseRecorded: () => void;
}

const RecordPurchaseForm: React.FC<RecordPurchaseFormProps> = ({ onPurchaseRecorded }) => {
  const { user } = useSession();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [supplierId, setSupplierId] = useState<string | undefined>(undefined);
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<PurchaseItem[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: suppliersData, error: suppliersError } = await supabase.from('suppliers').select('id, name');
        if (suppliersError) throw suppliersError;
        setSuppliers(suppliersData || []);

        const { data: productsData, error: productsError } = await supabase.from('products').select('id, name, code');
        if (productsError) throw productsError;
        setProducts(productsData || []);
      } catch (error: any) {
        showError(`Failed to load initial data: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const addItem = () => {
    setItems([...items, { id: Date.now().toString(), product_id: '', quantity: 1, unit_price: 0 }]);
  };

  const updateItem = (id: string, field: keyof PurchaseItem, value: any) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const totalAmount = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  }, [items]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || items.length === 0 || items.some(i => !i.product_id || i.quantity <= 0 || i.unit_price < 0)) {
      showError('Please fill all item details correctly.');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch(RECORD_PURCHASE_EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: supplierId,
          purchase_date: purchaseDate,
          items: items.map(({ id, ...rest }) => rest),
          user_id: user.id,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to record purchase.');
      showSuccess('Purchase recorded successfully!');
      setItems([]);
      setSupplierId(undefined);
      onPurchaseRecorded();
    } catch (error: any) {
      showError(`Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Record New Purchase</CardTitle>
        <CardDescription>Log incoming stock from suppliers.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Supplier (Optional)</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue placeholder="Select a supplier" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Purchase Date</Label>
              <Input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Items</Label>
            <div className="border rounded-md p-2 space-y-2 max-h-60 overflow-y-auto">
              {items.map(item => (
                <div key={item.id} className="flex items-end gap-2">
                  <div className="flex-grow">
                    <Select value={item.product_id} onValueChange={val => updateItem(item.id, 'product_id', val)}>
                      <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                      <SelectContent>
                        {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.code})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input type="number" value={item.quantity} onChange={e => updateItem(item.id, 'quantity', parseInt(e.target.value))} min="1" placeholder="Qty" className="w-20" />
                  <Input type="number" value={item.unit_price} onChange={e => updateItem(item.id, 'unit_price', parseFloat(e.target.value))} min="0" step="0.01" placeholder="Unit Price" className="w-28" />
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" onClick={addItem} className="w-full"><Plus className="mr-2 h-4 w-4" /> Add Item</Button>
          </div>

          <div className="text-right font-bold text-lg">
            Total Amount: ₹{totalAmount.toFixed(2)}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting || loading}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Record Purchase
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default RecordPurchaseForm;