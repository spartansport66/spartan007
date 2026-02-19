"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, Truck, AlertTriangle, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import OrderDetailsDialog from '@/components/OrderDetailsDialog';

interface QueueOrder {
  id: string;
  order_number: number;
  dealer_name: string;
  bill_no: string | null;
  dispatch_number: number | null;
  platform_order_number: string | null;
}

interface GatePassQueueCardProps {
  onDispatchSuccess: () => void;
}

const GatePassQueueCard: React.FC<GatePassQueueCardProps> = ({ onDispatchSuccess }) => {
  const [queue, setQueue] = useState<QueueOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDispatching, setIsDispatching] = useState<string | null>(null);
  const [isOrderDetailsDialogOpen, setIsOrderDetailsDialogOpen] = useState(false);
  const [selectedOrderIdForDetails, setSelectedOrderIdForDetails] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          bill_no,
          dispatch_number,
          dealers (name),
          online_order_details (platform_order_number)
        `)
        .eq('dispatched', true)
        .is('gate_pass_dispatch_time', null)
        .order('dispatch_number', { ascending: true });

      if (error) throw error;

      const formattedQueue: QueueOrder[] = (data || []).map((order: any) => ({
        id: order.id,
        order_number: order.order_number,
        dealer_name: order.dealers?.name || 'N/A',
        bill_no: order.bill_no,
        dispatch_number: order.dispatch_number,
        platform_order_number: order.online_order_details?.[0]?.platform_order_number || null,
      }));

      setQueue(formattedQueue);
    } catch (error: any) {
      showError(`Failed to load dispatch queue: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const handleDispatchOrder = async (orderId: string, orderNumber: number) => {
    setIsDispatching(orderId);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ gate_pass_dispatch_time: new Date().toISOString() })
        .eq('id', orderId);

      if (error) throw error;

      showSuccess(`Order #${orderNumber} authorized for OUT!`);
      onDispatchSuccess(); // This will trigger a re-fetch in the parent
    } catch (error: any) {
      showError(`Failed to authorize dispatch: ${error.message}`);
    } finally {
      setIsDispatching(null);
    }
  };

  const handleViewOrderDetails = (orderId: string) => {
    setSelectedOrderIdForDetails(orderId);
    setIsOrderDetailsDialogOpen(true);
  };

  return (
    <>
      <Card className="bg-card text-card-foreground shadow-lg">
        <CardHeader className="bg-blue-600 dark:bg-blue-800 text-white rounded-t-lg p-4">
          <CardTitle className="text-xl font-semibold">Dispatch Queue (Awaiting Gate Pass)</CardTitle>
          <CardDescription className="text-blue-100 dark:text-blue-200">
            Orders processed by admin and ready for final dispatch.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : queue.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">The dispatch queue is empty.</p>
          ) : (
            <div className="max-h-96 overflow-y-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dispatch #</TableHead>
                    <TableHead>Order #</TableHead>
                    <TableHead>Dealer / Platform Order</TableHead>
                    <TableHead>Bill No.</TableHead>
                    <TableHead className="text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queue.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.dispatch_number}</TableCell>
                      <TableCell>#{order.order_number}</TableCell>
                      <TableCell>
                        {order.dealer_name}
                        {order.platform_order_number && (
                          <span className="block text-xs text-muted-foreground font-mono">{order.platform_order_number}</span>
                        )}
                      </TableCell>
                      <TableCell>{order.bill_no}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleViewOrderDetails(order.id)} title="View Details">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" className="bg-green-600 hover:bg-green-700" disabled={!!isDispatching}>
                                {isDispatching === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirm Final Material OUT</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Authorize final dispatch for Order #{order.order_number}? This will record the gate pass time.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDispatchOrder(order.id, order.order_number)}>
                                  Confirm Final OUT
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
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

export default GatePassQueueCard;