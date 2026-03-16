"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Eye, CheckCircle2, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface PromotionalOrder {
  id: string;
  order_number: number;
  order_date: string;
  promotion_type: string;
  material_out_type: string;
  total_amount: number;
  dealer_name: string;
  sales_person_name: string;
  status: string;
  items: Array<{
    product_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
}

const WarehousePromotionalOrdersCard = () => {
  const [orders, setOrders] = useState<PromotionalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<PromotionalOrder | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  useEffect(() => {
    fetchApprovedOrders();
  }, []);

  const fetchApprovedOrders = async () => {
    setLoading(true);
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from('promotional_orders')
        .select(`
          id,
          order_number,
          order_date,
          promotion_type,
          material_out_type,
          total_amount,
          status,
          dealers (name),
          sales_person:profiles!sales_person_id (first_name, last_name),
          promotional_order_items (
            quantity,
            unit_price,
            total_price,
            products (name)
          )
        `)
        .eq('status', 'approved')
        .order('order_date', { ascending: false });

      if (ordersError) throw ordersError;

      const formattedOrders = (ordersData || []).map(order => ({
        id: order.id,
        order_number: order.order_number,
        order_date: order.order_date,
        promotion_type: order.promotion_type,
        material_out_type: order.material_out_type,
        total_amount: order.total_amount,
        dealer_name: (order.dealers as any)?.name || 'N/A',
        sales_person_name: `${(order.sales_person as any)?.first_name || ''} ${(order.sales_person as any)?.last_name || ''}`.trim(),
        status: order.status,
        items: (order.promotional_order_items as any[]).map(item => ({
          product_name: (item.products as any)?.name || 'Unknown',
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
        })),
      }));

      setOrders(formattedOrders);
    } catch (err: any) {
      showError(`Failed to load approved orders: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkDispatched = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('promotional_orders')
        .update({ status: 'dispatched' })
        .eq('id', orderId);

      if (error) throw error;

      setOrders(orders.filter(o => o.id !== orderId));
      setIsDetailsOpen(false);
    } catch (err: any) {
      showError(`Failed to mark as dispatched: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" /> Approved Promotional Orders
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-40">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" /> Approved Promotional Orders
          </CardTitle>
          <CardDescription>
            {orders.length} order{orders.length !== 1 ? 's' : ''} awaiting dispatch
          </CardDescription>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No approved orders to dispatch</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted">
                    <TableHead>Order #</TableHead>
                    <TableHead>Promotion Type</TableHead>
                    <TableHead>Party</TableHead>
                    <TableHead>Material Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map(order => (
                    <TableRow key={order.id}>
                      <TableCell className="font-bold">P{order.order_number}</TableCell>
                      <TableCell>{order.promotion_type}</TableCell>
                      <TableCell>{order.dealer_name}</TableCell>
                      <TableCell>
                        <Badge variant={order.material_out_type === 'returnable' ? 'secondary' : 'outline'}>
                          {order.material_out_type === 'returnable' ? '↩️ Returnable' : '✓ Non-Returnable'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">₹{order.total_amount.toFixed(2)}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedOrder(order);
                            setIsDetailsOpen(true);
                          }}
                          className="flex items-center gap-1 mx-auto"
                        >
                          <Eye className="h-4 w-4" /> View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Promotional Order #{selectedOrder?.order_number}
            </DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-6">
              {/* Order Summary */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">Party</p>
                  <p className="font-semibold">{selectedOrder.dealer_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Sales Person</p>
                  <p className="font-semibold">{selectedOrder.sales_person_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Promotion Type</p>
                  <p className="font-semibold">{selectedOrder.promotion_type}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Amount</p>
                  <p className="font-semibold text-green-600">₹{selectedOrder.total_amount.toFixed(2)}</p>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <h3 className="font-bold mb-3">Order Items:</h3>
                <div className="border rounded-md overflow-x-auto">
                  <Table className="text-sm">
                    <TableHeader>
                      <TableRow className="bg-muted">
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedOrder.items.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{item.product_name}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">₹{item.unit_price.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-semibold">₹{item.total_price.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Action Button */}
              <Button
                onClick={() => handleMarkDispatched(selectedOrder.id)}
                className="w-full bg-green-600 hover:bg-green-700 flex items-center gap-2"
              >
                <CheckCircle2 className="h-4 w-4" /> Mark as Dispatched
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default WarehousePromotionalOrdersCard;
