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

interface Supplier {
  id: string;
  name: string;
}

interface RawMaterial {
  id: string;
  name: string;
  code: string;
}

interface POItem {
  id: string; // Temp ID for UI
  raw_material_id: string;
  raw_material_name: string;
  quantity: number;
  unit_price: number;
}

interface CreatePurchaseOrderDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderCreated: () => void;
}

const CreatePurchaseOrderDialog: React.FC<CreatePurchaseOrderDialogProps> = ({ isOpen, onOpenChange, onOrderCreated }) => {
  const { user } = useSession();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedDate, setExpectedDate] = useState('');
  const [items, setItems] = useState<POItem[]>([]);

  // New item form state
  const [newItemMaterialId, setNewItemMaterialId] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [newItemPrice, setNewItemPrice] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all raw materials with pagination
      const allMaterials: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('raw_materials')
          .select('id, name, code')
          .order('name')
          .range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) throw error;
        if (data && data.length > 0) {
          allMaterials.push(...data);
        }
        if (!data || data.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      }

      const suppliersRes = await supabase.from('suppliers').select('id, name').order('name');

      if (suppliersRes.error) throw suppliersRes.error;
      setSuppliers(suppliersRes.data || []);
      setRawMaterials(allMaterials);
    } catch (error: any) {
      showError(`Failed to load data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, fetchData]);

  const handleAddItem = () => {
    const material = rawMaterials.find(m => m.id === newItemMaterialId);
    if (!material || newItemQuantity <= 0) {
      showError('Please select a material and enter a valid quantity.');
      return;
    }
    setItems(prev => [...prev, {
      id: Date.now().toString(),
      raw_material_id: material.id,
      raw_material_name: `${material.name} (${material.code})`,
      quantity: newItemQuantity,
      unit_price: newItemPrice,
    }]);
    // Reset form
    setNewItemMaterialId('');
    setNewItemQuantity(1);
    setNewItemPrice(0);
  };

  const handleRemoveItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const totalValue = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  }, [items]);

  const handleSubmit = async () => {
    if (!selectedSupplier || items.length === 0 || !user) {
      showError('Please select a supplier and add at least one item.');
      return;
    }
    setIsSubmitting(true);
    try {
      // 1. Create Purchase Order
      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
          supplier_id: selectedSupplier,
          order_date: orderDate,
          expected_delivery_date: expectedDate || null,
          created_by: user.id,
        })
        .select('id')
        .single();
      if (poError) throw poError;

      // 2. Create Purchase Order Items
      const itemsToInsert = items.map(item => ({
        purchase_order_id: po.id,
        raw_material_id: item.raw_material_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
      }));
      const { error: itemsError } = await supabase.from('purchase_order_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      showSuccess('Purchase Order created successfully!');
      onOrderCreated();
    } catch (error: any) {
      showError(`Failed to create PO: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Create New Purchase Order</DialogTitle>
          <DialogDescription>Select a supplier and add the raw materials you want to order.</DialogDescription>
        </DialogHeader>
        {loading ? <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div> : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Supplier</Label><Select value={selectedSupplier} onValueChange={setSelectedSupplier}><SelectTrigger><SelectValue placeholder="Select Supplier" /></SelectTrigger><SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Order Date</Label><Input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} /></div>
              <div><Label>Expected Delivery</Label><Input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} /></div>
            </div>
            <div className="p-4 border rounded-md bg-muted/50">
              <h4 className="font-semibold mb-2">Add Item</h4>
              <div className="grid grid-cols-4 gap-4 items-end">
                <div className="col-span-2"><Label>Raw Material</Label><Select value={newItemMaterialId} onValueChange={setNewItemMaterialId}><SelectTrigger><SelectValue placeholder="Select Material" /></SelectTrigger><SelectContent>{rawMaterials.map(m => <SelectItem key={m.id} value={m.id}>{m.name} ({m.code})</SelectItem>)}</SelectContent></Select></div>
                <div><Label>Quantity</Label><Input type="number" value={newItemQuantity} onChange={e => setNewItemQuantity(Number(e.target.value))} min="1" /></div>
                <div><Label>Unit Price</Label><Input type="number" value={newItemPrice} onChange={e => setNewItemPrice(Number(e.target.value))} min="0" /></div>
              </div>
              <Button onClick={handleAddItem} className="mt-4 w-full"><Plus className="mr-2 h-4 w-4" />Add Item to PO</Button>
            </div>
            <div className="max-h-60 overflow-y-auto border rounded-md">
              <Table>
                <TableHeader><TableRow><TableHead>Material</TableHead><TableHead>Qty</TableHead><TableHead>Unit Price</TableHead><TableHead className="text-right">Total</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {items.map(item => (
                    <TableRow key={item.id}>
                      <TableCell>{item.raw_material_name}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>₹{item.unit_price.toFixed(2)}</TableCell>
                      <TableCell className="text-right">₹{(item.quantity * item.unit_price).toFixed(2)}</TableCell>
                      <TableCell><Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="text-right font-bold text-lg">Total PO Value: ₹{totalValue.toFixed(2)}</div>
          </div>
        )}
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={isSubmitting || loading}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Purchase Order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreatePurchaseOrderDialog;