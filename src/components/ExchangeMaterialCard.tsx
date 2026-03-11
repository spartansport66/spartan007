import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { useSession } from '@/contexts/SessionContext';

type SaleItem = {
  id: string;
  product_id: string;
  product_name?: string;
  quantity: number;
  unit_price?: number;
  selected?: boolean;
  exchange_quantity?: number;
};

const ExchangeMaterialCard: React.FC = () => {
  const { user } = useSession();
  const [originalOrderNo, setOriginalOrderNo] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderFound, setOrderFound] = useState<any | null>(null);
  const [items, setItems] = useState<SaleItem[]>([]);

  const searchOrder = async () => {
    if (!originalOrderNo) return showError('Please enter the original order number or bill no.');
    setOrderLoading(true);
    try {
      const isNumeric = /^\d+$/.test(originalOrderNo.trim());
      let query = supabase.from('orders').select(`id,order_number,bill_no,order_date,dealer_id,sales(id,product_id,quantity,unit_price,total_price,product:products(name,code))`).limit(1);
      if (isNumeric) {
        query = query.eq('order_number', Number(originalOrderNo.trim()));
      } else {
        query = query.eq('bill_no', originalOrderNo.trim());
      }

      const { data, error } = await query.single();
      if (error) throw error;
      if (!data) return showError('Order not found');

      // map sales items
      const mappedItems: SaleItem[] = (data.sales || []).map((s: any) => ({
        id: s.id,
        product_id: s.product_id,
        product_name: s.product?.name || s.product_id,
        quantity: s.quantity,
        unit_price: s.unit_price,
        selected: false,
        exchange_quantity: 0,
      }));

      setOrderFound(data);
      setItems(mappedItems);
    } catch (err: any) {
      console.error('searchOrder error:', err);
      showError(err.message || 'Failed to fetch order');
      setOrderFound(null);
      setItems([]);
    } finally {
      setOrderLoading(false);
    }
  };

  const toggleSelect = (index: number) => {
    setItems(prev => prev.map((it, i) => i === index ? { ...it, selected: !it.selected, exchange_quantity: !it.selected ? Math.min(1, it.quantity) : 0 } : it));
  };

  const setExchangeQty = (index: number, qty: number) => {
    setItems(prev => prev.map((it, i) => i === index ? { ...it, exchange_quantity: qty } : it));
  };

  const handleExchange = async () => {
    if (!originalOrderNo) return showError('Please enter the original order number.');
    if (!reason) return showError('Please provide a reason for exchange.');
    const selectedItems = items.filter(i => i.selected && i.exchange_quantity && i.exchange_quantity > 0);
    if (selectedItems.length === 0) return showError('Please select at least one item and quantity to exchange.');

    setLoading(true);
    try {
      const newOrderNo = `EX-${Date.now()}`;
      const payload: any = {
        original_order_no: originalOrderNo,
        new_order_no: newOrderNo,
        reason,
        created_by: user?.id || null,
        items: selectedItems.map(si => ({ product_id: si.product_id, product_name: si.product_name, quantity: si.quantity, exchange_quantity: si.exchange_quantity, unit_price: si.unit_price }))
      };

      const { error } = await supabase.from('material_exchanges').insert([payload]);
      if (error) throw error;

      showSuccess(`Exchange recorded. New Order No: ${newOrderNo}`);
      setOriginalOrderNo('');
      setReason('');
      setOrderFound(null);
      setItems([]);
    } catch (err: any) {
      console.error('ExchangeMaterialCard error:', err);
      showError(err.message || 'Failed to record exchange.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-card text-card-foreground shadow-md">
      <CardHeader className="p-4 rounded-t-lg">
        <CardTitle className="text-lg font-semibold">Exchange Material</CardTitle>
        <CardDescription className="text-muted-foreground">Search an order, select items to exchange and create a new exchange order.</CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
            <div className="sm:col-span-2">
              <label className="text-sm text-muted-foreground">Original Order No or Bill No</label>
              <Input value={originalOrderNo} onChange={e => setOriginalOrderNo(e.target.value)} placeholder="Enter original order number or bill no" />
            </div>
            <div className="text-right">
              <Button onClick={searchOrder} disabled={orderLoading}>{orderLoading ? 'Searching...' : 'Search Order'}</Button>
            </div>
          </div>

          {orderFound && (
            <div className="border rounded p-3">
              <div className="mb-2 text-sm text-muted-foreground">Order: {orderFound.order_number || orderFound.bill_no} — Date: {new Date(orderFound.order_date).toLocaleString()}</div>
              <div className="space-y-2">
                {items.length === 0 && <div className="text-sm">No items found for this order.</div>}
                {items.map((it, idx) => (
                  <div key={it.id} className="flex items-center justify-between gap-2 p-2 border rounded">
                    <div>
                      <div className="font-medium">{it.product_name}</div>
                      <div className="text-xs text-muted-foreground">Ordered: {it.quantity}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={!!it.selected} onChange={() => toggleSelect(idx)} />
                      <input type="number" min={0} max={it.quantity} value={it.exchange_quantity || 0} onChange={e => setExchangeQty(idx, Math.max(0, Math.min(it.quantity, Number(e.target.value || 0))))} className="w-20 p-1 border rounded" disabled={!it.selected} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-sm text-muted-foreground">Reason for Exchange</label>
            <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason" />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleExchange} disabled={loading || orderLoading}>{loading ? 'Processing...' : 'Create Exchange'}</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ExchangeMaterialCard;
