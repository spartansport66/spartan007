"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';

interface VoucherItem {
  raw_material_name: string;
  quantity_received: number;
  unit_price: number;
}

interface VoucherDetail {
  voucher_number: number;
  receipt_date: string;
  supplier_name: string | null;
  po_number: number;
  supplier_invoice_no: string | null;
  supplier_invoice_date: string | null;
  items: VoucherItem[];
}

interface PurchaseVoucherDetailsDialogProps {
  voucherId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const PurchaseVoucherDetailsDialog: React.FC<PurchaseVoucherDetailsDialogProps> = ({ voucherId, isOpen, onOpenChange }) => {
  const [details, setDetails] = useState<VoucherDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDetails = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('purchase_vouchers')
        .select(`
          voucher_number,
          receipt_date,
          supplier_invoice_no,
          supplier_invoice_date,
          suppliers (name),
          purchase_orders (po_number),
          purchase_voucher_items (quantity_received, unit_price, raw_materials (name))
        `)
        .eq('id', voucherId)
        .single();
      if (error) throw error;

      setDetails({
        voucher_number: data.voucher_number,
        receipt_date: data.receipt_date,
        supplier_name: (data.suppliers as any)?.name || 'N/A',
        po_number: (data.purchase_orders as any)?.po_number || 0,
        supplier_invoice_no: data.supplier_invoice_no,
        supplier_invoice_date: data.supplier_invoice_date,
        items: (data.purchase_voucher_items as any[]).map(item => ({
          raw_material_name: item.raw_materials.name,
          quantity_received: item.quantity_received,
          unit_price: item.unit_price,
        })),
      });
    } catch (error: any) {
      showError(`Failed to load voucher details: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [voucherId]);

  useEffect(() => {
    if (isOpen) {
      fetchDetails();
    }
  }, [isOpen, fetchDetails]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Purchase Voucher Details #{details?.voucher_number}</DialogTitle>
          <DialogDescription>Details of goods received against PO #{details?.po_number}.</DialogDescription>
        </DialogHeader>
        {loading ? <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div> : details && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="font-semibold">Supplier:</span> {details.supplier_name}</div>
              <div><span className="font-semibold">Receipt Date:</span> {new Date(details.receipt_date).toLocaleDateString()}</div>
              <div><span className="font-semibold">Supplier Invoice No:</span> {details.supplier_invoice_no || 'N/A'}</div>
              <div><span className="font-semibold">Invoice Date:</span> {details.supplier_invoice_date ? new Date(details.supplier_invoice_date).toLocaleDateString() : 'N/A'}</div>
            </div>
            <div className="max-h-96 overflow-y-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead className="text-right">Quantity Received</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {details.items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{item.raw_material_name}</TableCell>
                      <TableCell className="text-right">{item.quantity_received}</TableCell>
                      <TableCell className="text-right">₹{item.unit_price.toFixed(2)}</TableCell>
                      <TableCell className="text-right">₹{(item.quantity_received * item.unit_price).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PurchaseVoucherDetailsDialog;