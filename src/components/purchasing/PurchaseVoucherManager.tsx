"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import PurchaseVoucherDetailsDialog from './PurchaseVoucherDetailsDialog';

interface PurchaseVoucher {
  id: string;
  voucher_number: number;
  receipt_date: string;
  supplier_name: string | null;
  po_number: number;
}

const PurchaseVoucherManager: React.FC = () => {
  const [vouchers, setVouchers] = useState<PurchaseVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedVoucherId, setSelectedVoucherId] = useState<string | null>(null);

  const fetchVouchers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('purchase_vouchers')
        .select(`
          id,
          voucher_number,
          receipt_date,
          suppliers (name),
          purchase_orders (po_number)
        `)
        .order('voucher_number', { ascending: false });

      if (error) throw error;

      const formattedData = data.map(v => ({
        id: v.id,
        voucher_number: v.voucher_number,
        receipt_date: v.receipt_date,
        supplier_name: (v.suppliers as any)?.name || 'N/A',
        po_number: (v.purchase_orders as any)?.po_number || 0,
      }));

      setVouchers(formattedData);
    } catch (error: any) {
      showError(`Failed to load purchase vouchers: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVouchers();
  }, [fetchVouchers]);

  const handleViewDetails = (voucherId: string) => {
    setSelectedVoucherId(voucherId);
    setIsDetailsDialogOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Purchase Vouchers</CardTitle>
          <CardDescription>History of all received goods against purchase orders.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Voucher No.</TableHead>
                    <TableHead>PO No.</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Receipt Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vouchers.map((voucher) => (
                    <TableRow key={voucher.id}>
                      <TableCell className="font-medium">#{voucher.voucher_number}</TableCell>
                      <TableCell>#{voucher.po_number}</TableCell>
                      <TableCell>{voucher.supplier_name}</TableCell>
                      <TableCell>{new Date(voucher.receipt_date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleViewDetails(voucher.id)}><Eye className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      {selectedVoucherId && (
        <PurchaseVoucherDetailsDialog
          voucherId={selectedVoucherId}
          isOpen={isDetailsDialogOpen}
          onOpenChange={setIsDetailsDialogOpen}
        />
      )}
    </>
  );
};

export default PurchaseVoucherManager;