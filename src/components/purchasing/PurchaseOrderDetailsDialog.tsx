"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { useSession } from '@/contexts/SessionContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const RECEIVE_PURCHASE_ORDER_URL = "https://hxftiocfihhdutciaisl.supabase.co/functions/v1/receive-purchase-order";

interface POItemDetail {
  id: string;
  raw_material_id: string;
  raw_material_name: string;
  quantity: number;
  quantity_received: number;
  unit_price: number;
}

interface PurchaseOrderDetail {
  id: string;
  po_number: number;
  order_date: string;
  status: string;
  supplier_name: string | null;
  supplier_invoice_no: string | null;
  supplier_invoice_date: string | null;
  items: POItemDetail[];
}

interface ReceiveItem {
  po_item_id: string;
  raw_material_id: string;
  quantity_received: number;
}

interface PurchaseOrderDetailsDialogProps {
  purchaseOrderId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onReceiptRecorded: () => void;
}

const PurchaseOrderDetailsDialog: React.FC<PurchaseOrderDetailsDialogProps> = ({ purchaseOrderId, isOpen, onOpenChange, onReceiptRecorded }) => {
  const { user } = useSession();
  const [order, setOrder] = useState<PurchaseOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiveQuantities, setReceiveQuantities] = useState<Record<string, number>>({});
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');
  const [supplierInvoiceDate, setSupplierInvoiceDate] = useState('');

  const fetchDetails = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          id, po_number, order_date, status, supplier_invoice_no, supplier_invoice_date, suppliers (name),
          purchase_order_items (id, quantity, quantity_received, unit_price, raw_material_id, raw_materials (name, code))
        `)
        .eq('id', purchaseOrderId)
        .single();
      if (error) throw error;

      setOrder({
        id: data.id,
        po_number: data.po_number,
        order_date: data.order_date,
        status: data.status,
        supplier_name: (data.suppliers as any)?.name || 'N/A',
        supplier_invoice_no: data.supplier_invoice_no,
        supplier_invoice_date: data.supplier_invoice_date,
        items: (data.purchase_order_items as any[]).map(item => ({
          id: item.id,
          raw_material_id: item.raw_material_id,
          raw_material_name: `${item.raw_materials.name} (${item.raw_materials.code})`,
          quantity: item.quantity,
          quantity_received: item.quantity_received,
          unit_price: item.unit_price,
        })),
      });
      setSupplierInvoiceNo(data.supplier_invoice_no || '');
      setSupplierInvoiceDate(data.supplier_invoice_date || '');
    } catch (error: any) {
      showError(`Failed to load PO details: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [purchaseOrderId]);

  useEffect(() => {
    if (isOpen) {
      fetchDetails();
    }
  }, [isOpen, fetchDetails]);

  const handleQuantityChange = (itemId: string, value: string) => {
    const qty = parseInt(value, 10);
    if (!isNaN(qty)) {
      setReceiveQuantities(prev => ({ ...prev, [itemId]: qty }));
    }
  };

  const handleSaveReceipt = async () => {
    if (!user || !order) return;
    const itemsToReceive = Object.entries(receiveQuantities)
      .filter(([, qty]) => qty > 0)
      .map(([itemId, qty]) => {
        const item = order.items.find(i => i.id === itemId);
        return {
          po_item_id: itemId,
          raw_material_id: item!.raw_material_id,
          quantity_received: qty,
        };
      });

    if (itemsToReceive.length === 0) {
      showError('Please enter a quantity for at least one item.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(RECEIVE_PURCHASE_ORDER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchase_order_id: order.id,
          items: itemsToReceive,
          receipt_date: new Date().toISOString().split('T')[0],
          received_by: user.id,
          supplier_invoice_no: supplierInvoiceNo,
          supplier_invoice_date: supplierInvoiceDate,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      showSuccess(data.message);
      onReceiptRecorded();
      onOpenChange(false);
    } catch (error: any) {
      showError(`Failed to record receipt: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Purchase Order Details #{order?.po_number}</DialogTitle>
          <DialogDescription>View items and record received quantities.</DialogDescription>
        </DialogHeader>
        {loading ? <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div> : order && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div><span className="font-semibold">Supplier:</span> {order.supplier_name}</div>
              <div><span className="font-semibold">Order Date:</span> {new Date(order.order_date).toLocaleDateString()}</div>
              <div><span className="font-semibold">Status:</span> {order.status}</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="supplierInvoiceNo">Supplier Invoice No.</Label>
                <Input id="supplierInvoiceNo" value={supplierInvoiceNo} onChange={e => setSupplierInvoiceNo(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="supplierInvoiceDate">Supplier Invoice Date</Label>
                <Input id="supplierInvoiceDate" type="date" value={supplierInvoiceDate} onChange={e => setSupplierInvoiceDate(e.target.value)} />
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead className="text-center">Ordered</TableHead>
                    <TableHead className="text-center">Received</TableHead>
                    <TableHead className="w-32">Receive Now</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map(item => {
                    const remaining = item.quantity - item.quantity_received;
                    return (
                      <TableRow key={item.id}>
                        <TableCell>{item.raw_material_name}</TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-center">{item.quantity_received}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            max={remaining}
                            placeholder="0"
                            onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                            disabled={remaining <= 0}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button onClick={handleSaveReceipt} disabled={isSubmitting || loading}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Received Quantities
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PurchaseOrderDetailsDialog;