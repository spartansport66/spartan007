"use client";
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { useSession } from '@/contexts/SessionContext';
import { Textarea } from '@/components/ui/textarea';

const RECORD_DIRECT_PURCHASE_URL = "https://hxftiocfihhdutciaisl.supabase.co/functions/v1/record-direct-purchase";

interface Supplier {
  id: string;
  name: string;
}

interface RawMaterial {
  id: string;
  name: string;
  code: string;
}

interface BillItem {
  id: string; // Temp ID
  raw_material_id: string;
  raw_material_name: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  gst_percent: number;
  total_amount: number;
}

interface CreatePurchaseBillDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onBillCreated: () => void;
}

const CreatePurchaseBillDialog: React.FC<CreatePurchaseBillDialogProps> = ({ isOpen, onOpenChange, onBillCreated }) => {
  const { user } = useSession();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [billNo, setBillNo] = useState('');
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');
  const [items, setItems] = useState<BillItem[]>([]);

  const [newItemMaterialId, setNewItemMaterialId] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [newItemPrice, setNewItemPrice] = useState(0);
  const [newItemDiscount, setNewItemDiscount] = useState(0);
  const [newItemGst, setNewItemGst] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [suppliersRes, materialsRes] = await Promise.all([
        supabase.from('suppliers').select('id, name').order('name'),
        supabase.from('raw_materials').select('id, name, code').order('name'),
      ]);
      if (suppliersRes.error) throw suppliersRes.error;
      if (materialsRes.error) throw materialsRes.error;
      setSuppliers(suppliersRes.data || []);
      setRawMaterials(materialsRes.data || []);
    } catch (error: any) {
      showError(`Failed to load data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchData();
    } else {
      // Reset form on close
      setSelectedSupplier('');
      setBillNo('');
      setBillDate(new Date().toISOString().split('T')[0]);
      setRemarks('');
      setItems([]);
    }
  }, [isOpen, fetchData]);

  const handleAddItem = () => {
    const material = rawMaterials.find(m => m.id === newItemMaterialId);
    if (!material || newItemQuantity <= 0) {
      showError('Please select a material and enter a valid quantity.');
      return;
    }
    const taxableValue = (newItemQuantity * newItemPrice) * (1 - (newItemDiscount / 100));
    const totalAmount = taxableValue * (1 + (newItemGst / 100));

    setItems(prev => [...prev, {
      id: Date.now().toString(),
      raw_material_id: material.id,
      raw_material_name: `${material.name} (${material.code})`,
      quantity: newItemQuantity,
      unit_price: newItemPrice,
      discount_percent: newItemDiscount,
      gst_percent: newItemGst,
      total_amount: totalAmount,
    }]);
    setNewItemMaterialId('');
    setNewItemQuantity(1);
    setNewItemPrice(0);
    setNewItemDiscount(0);
    setNewItemGst(0);
  };

  const handleRemoveItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const grandTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.total_amount, 0);
  }, [items]);

  const handleSubmit = async () => {
    if (!selectedSupplier || !billNo || items.length === 0 || !user) {
      showError('Please select a supplier, enter a bill number, and add at least one item.');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch(RECORD_DIRECT_PURCHASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: selectedSupplier,
          bill_no: billNo,
          bill_date: billDate,
          items: items,
          user_id: user.id,
          remarks: remarks,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      showSuccess(data.message);
      onBillCreated();
      onOpenChange(false);
    } catch (error: any) {
      showError(`Failed to record bill: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Create Purchase Bill Voucher</DialogTitle>
          <DialogDescription>Enter details from the supplier's bill to record a purchase and update stock.</DialogDescription>
        </DialogHeader>
        {loading ? <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div> : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><Label>Supplier</Label><Select value={selectedSupplier} onValueChange={setSelectedSupplier}><SelectTrigger><SelectValue placeholder="Select Supplier" /></SelectTrigger><SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Bill No.</Label><Input value={billNo} onChange={e => setBillNo(e.target.value)} /></div>
              <div><Label>Bill Date</Label><Input type="date" value={billDate} onChange={e => setBillDate(e.target.value)} /></div>
            </div>
            <div className="p-4 border rounded-md bg-muted/50">
              <h4 className="font-semibold mb-2">Add Bill Item</h4>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                <div className="col-span-2"><Label>Raw Material</Label><Select value={newItemMaterialId} onValueChange={setNewItemMaterialId}><SelectTrigger><SelectValue placeholder="Select Material" /></SelectTrigger><SelectContent>{rawMaterials.map(m => <SelectItem key={m.id} value={m.id}>{m.name} ({m.code})</SelectItem>)}</SelectContent></Select></div>
                <div><Label>Quantity</Label><Input type="number" value={newItemQuantity} onChange={e => setNewItemQuantity(Number(e.target.value))} min="1" /></div>
                <div><Label>Unit Price</Label><Input type="number" value={newItemPrice} onChange={e => setNewItemPrice(Number(e.target.value))} min="0" /></div>
                <div><Label>Discount %</Label><Input type="number" value={newItemDiscount} onChange={e => setNewItemDiscount(Number(e.target.value))} min="0" /></div>
                <div><Label>GST %</Label><Input type="number" value={newItemGst} onChange={e => setNewItemGst(Number(e.target.value))} min="0" /></div>
              </div>
              <Button onClick={handleAddItem} className="mt-4 w-full"><Plus className="mr-2 h-4 w-4" />Add Item to Bill</Button>
            </div>
            <div className="max-h-60 overflow-y-auto border rounded-md">
              <Table>
                <TableHeader><TableRow><TableHead>Material</TableHead><TableHead>Qty</TableHead><TableHead>Price</TableHead><TableHead>Disc %</TableHead><TableHead>GST %</TableHead><TableHead className="text-right">Total</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {items.map(item => (
                    <TableRow key={item.id}>
                      <TableCell>{item.raw_material_name}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>₹{item.unit_price.toFixed(2)}</TableCell>
                      <TableCell>{item.discount_percent}%</TableCell>
                      <TableCell>{item.gst_percent}%</TableCell>
                      <TableCell className="text-right">₹{item.total_amount.toFixed(2)}</TableCell>
                      <TableCell><Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>Remarks</Label><Textarea value={remarks} onChange={e => setRemarks(e.target.value)} /></div>
              <div className="text-right font-bold text-lg self-end">Grand Total: ₹{grandTotal.toFixed(2)}</div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={isSubmitting || loading}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Purchase Bill'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreatePurchaseBillDialog;