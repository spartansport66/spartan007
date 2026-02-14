"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, PlusCircle, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import CreatePurchaseOrderDialog from './CreatePurchaseOrderDialog';

interface PurchaseOrder {
  id: string;
  po_number: number;
  order_date: string;
  status: string;
  supplier_name: string | null;
  total_value: number;
}

const PurchaseOrderManager: React.FC = () => {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const fetchPurchaseOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          id,
          po_number,
          order_date,
          status,
          suppliers (name),
          purchase_order_items (total_price)
        `)
        .order('po_number', { ascending: false });

      if (error) throw error;

      const formattedData = data.map(po => ({
        id: po.id,
        po_number: po.po_number,
        order_date: po.order_date,
        status: po.status,
        supplier_name: (po.suppliers as any)?.name || 'N/A',
        total_value: (po.purchase_order_items as any[]).reduce((sum, item) => sum + (item.total_price || 0), 0),
      }));

      setPurchaseOrders(formattedData);
    } catch (error: any) {
      showError(`Failed to load purchase orders: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPurchaseOrders();
  }, [fetchPurchaseOrders]);

  const handleOrderCreated = () => {
    fetchPurchaseOrders();
    setIsCreateDialogOpen(false);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Manage Purchase Orders</CardTitle>
              <CardDescription>Create and track purchase orders for raw materials.</CardDescription>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" /> Create PO
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Order Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total Value</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseOrders.map((po) => (
                    <TableRow key={po.id}>
                      <TableCell className="font-medium">#{po.po_number}</TableCell>
                      <TableCell>{po.supplier_name}</TableCell>
                      <TableCell>{new Date(po.order_date).toLocaleDateString()}</TableCell>
                      <TableCell>{po.status}</TableCell>
                      <TableCell className="text-right">₹{po.total_value.toFixed(2)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      <CreatePurchaseOrderDialog
        isOpen={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onOrderCreated={handleOrderCreated}
      />
    </>
  );
};

export default PurchaseOrderManager;