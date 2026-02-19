"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import OrderDetailsDialog from '@/components/OrderDetailsDialog';

interface DispatchedOrder {
  id: string;
  order_number: number;
  bill_no: string;
  dispatch_number: number;
  gate_pass_dispatch_time: string;
  dealer_name: string;
  platform_order_number: string | null;
  client_name: string | null;
}

const GatePassDispatchedOrdersCard: React.FC = () => {
  const [orders, setOrders] = useState<DispatchedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOrderDetailsDialogOpen, setIsOrderDetailsDialogOpen] = useState(false);
  const [selectedOrderIdForDetails, setSelectedOrderIdForDetails] = useState<string | null>(null);

  const fetchDispatchedOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          bill_no,
          dispatch_number,
          gate_pass_dispatch_time,
          dealers (name)
        `)
        .not('gate_pass_dispatch_time', 'is', null)
        .order('gate_pass_dispatch_time', { ascending: false })
        .limit(20); // Show recent 20

      if (ordersError) throw ordersError;

      const onlineOrderIds = (ordersData || []).filter(o => (o.dealers as any)?.name === 'Online Order').map(o => o.id);
      let onlineDetailsMap = new Map();

      if (onlineOrderIds.length > 0) {
        const { data: onlineDetails, error: functionError } = await supabase.functions.invoke('get-online-order-details', {
          body: { orderIds: onlineOrderIds },
        });

        if (functionError) throw functionError;

        (onlineDetails || []).forEach((d: any) => onlineDetailsMap.set(d.order_id, d));
      }

      const formattedOrders: DispatchedOrder[] = (ordersData || []).map((order: any) => {
        const details = onlineDetailsMap.get(order.id);
        return {
          id: order.id,
          order_number: order.order_number,
          bill_no: order.bill_no || 'N/A',
          dispatch_number: order.dispatch_number,
          gate_pass_dispatch_time: order.gate_pass_dispatch_time,
          dealer_name: (order.dealers as any)?.name || 'N/A',
          platform_order_number: details?.platform_order_number || null,
          client_name: details?.client_name || null,
        };
      });
      setOrders(formattedOrders);
    } catch (error: any) {
      showError(`Failed to load dispatched orders: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDispatchedOrders();
  }, [fetchDispatchedOrders]);

  const handleViewOrderDetails = (orderId: string) => {
    setSelectedOrderIdForDetails(orderId);
    setIsOrderDetailsDialogOpen(true);
  };

  return (
    <>
      <Card className="bg-card text-card-foreground shadow-lg">
        <CardHeader className="bg-gray-700 dark:bg-gray-900 text-white rounded-t-lg p-4">
          <CardTitle className="text-xl font-semibold">Recently Dispatched (Gate Pass OUT)</CardTitle>
          <CardDescription className="text-gray-300 dark:text-gray-400">
            List of the 20 most recent orders authorized for physical dispatch.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : orders.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No orders have been dispatched through the gate pass system yet.</p>
            ) : (
              <div className="max-h-[300px] overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow className="bg-muted hover:bg-muted/90">
                      <TableHead>Dispatch #</TableHead>
                      <TableHead>Order #</TableHead>
                      <TableHead>Dealer / Customer</TableHead>
                      <TableHead>Gate Pass Time</TableHead>
                      <TableHead className="text-center">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id} className="hover:bg-accent/50">
                        <TableCell className="font-medium">{order.dispatch_number}</TableCell>
                        <TableCell>#{order.order_number}</TableCell>
                        <TableCell>
                          {order.dealer_name === 'Online Order' && order.client_name ? (
                            <>
                              <span className="font-medium">{order.client_name}</span>
                              {order.platform_order_number && (
                                <span className="block text-xs text-muted-foreground font-mono">{order.platform_order_number}</span>
                              )}
                            </>
                          ) : (
                            order.dealer_name
                          )}
                        </TableCell>
                        <TableCell>{new Date(order.gate_pass_dispatch_time).toLocaleString()}</TableCell>
                        <TableCell className="text-center">
                          <Button variant="ghost" size="icon" onClick={() => handleViewOrderDetails(order.id)} title="View Details">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      <OrderDetailsDialog
        orderId={selectedOrderIdForDetails}
        isOpen={isOrderDetailsDialogOpen}
        onOpenChange={setIsOrderDetailsDialogOpen}
      />
    </>
  );
};

export default GatePassDispatchedOrdersCard;