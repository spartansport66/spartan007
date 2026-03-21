"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Truck, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
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
  person_name?: string;
  person_contact_no?: string;
  person_address?: string;
  items: Array<{
    product_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
}

interface GatePassPromotionalMaterialCardProps {
  onDispatchSuccess: () => void;
}

const GatePassPromotionalMaterialCard: React.FC<GatePassPromotionalMaterialCardProps> = ({ onDispatchSuccess }) => {
  const [orders, setOrders] = useState<PromotionalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDispatching, setIsDispatching] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<PromotionalOrder | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const fetchApprovedOrders = useCallback(async () => {
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
          person_name,
          person_contact_no,
          person_address,
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
        status: order.status,
        person_name: order.person_name || '',
        person_contact_no: order.person_contact_no || '',
        person_address: order.person_address || '',
        dealer_name: (order.dealers as any)?.name || 'N/A',
        sales_person_name: `${(order.sales_person as any)?.first_name || ''} ${(order.sales_person as any)?.last_name || ''}`.trim(),
        items: (order.promotional_order_items as any[]).map(item => ({
          product_name: (item.products as any)?.name || 'Unknown',
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
        })),
      }));

      setOrders(formattedOrders);
    } catch (err: any) {
      showError(`Failed to load approved promotional orders: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApprovedOrders();
  }, [fetchApprovedOrders]);

  const handleMarkOut = async (orderId: string, orderNumber: number) => {
    setIsDispatching(orderId);
    try {
      const { error } = await supabase
        .from('promotional_orders')
        .update({ status: 'dispatched' })
        .eq('id', orderId);

      if (error) throw error;

      showSuccess(`Promotional Order P${orderNumber} marked as OUT!`);
      setOrders(orders.filter(o => o.id !== orderId));
      setIsDetailsOpen(false);
      onDispatchSuccess();
    } catch (error: any) {
      showError(`Failed to mark order as out: ${error.message}`);
    } finally {
      setIsDispatching(null);
    }
  };

  const handleViewOrderDetails = (order: PromotionalOrder) => {
    setSelectedOrder(order);
    setIsDetailsOpen(true);
  };

  return (
    <>
      <Card className="bg-card text-card-foreground shadow-lg">
        <CardHeader className="bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-800 dark:to-pink-800 text-white rounded-t-lg p-4">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            📦 Approved Promotional Material
          </CardTitle>
          <CardDescription className="text-purple-100 dark:text-purple-200">
            Approved promotional material ready for physical dispatch at gate
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : orders.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No approved promotional material awaiting dispatch</p>
          ) : (
            <div className="overflow-x-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted">
                    <TableHead className="min-w-16">Order #</TableHead>
                    <TableHead className="min-w-20">Date</TableHead>
                    <TableHead className="min-w-24">Party</TableHead>
                    <TableHead className="min-w-28 flex-grow">Promotion Type</TableHead>
                    <TableHead className="min-w-20">Material Type</TableHead>
                    <TableHead className="text-right min-w-20">Amount</TableHead>
                    <TableHead className="text-center min-w-24">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id} className="hover:bg-muted/50">
                      <TableCell className="font-bold">P{order.order_number}</TableCell>
                      <TableCell>{new Date(order.order_date).toLocaleDateString()}</TableCell>
                      <TableCell>{order.dealer_name}</TableCell>
                      <TableCell className="font-medium">{order.promotion_type}</TableCell>
                      <TableCell>
                        <Badge className={order.material_out_type === 'returnable' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}>
                          {order.material_out_type === 'returnable' ? '↩️ Returnable' : '✓ Non-Returnable'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-600">₹{order.total_amount.toFixed(2)}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewOrderDetails(order)}
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 flex items-center gap-1"
                                disabled={!!isDispatching}
                              >
                                {isDispatching === order.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Truck className="h-4 w-4" />
                                )}
                                OUT
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Mark Promotional Material as OUT</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to mark Promotional Order P{order.order_number} as OUT? This will dispatch the material.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleMarkOut(order.id, order.order_number)}>
                                  Confirm OUT
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

      {/* Order Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Promotional Order P{selectedOrder?.order_number} - Details
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
                {selectedOrder.person_name && (
                  <>
                    <div>
                      <p className="text-xs text-muted-foreground">👤 Person Name</p>
                      <p className="font-semibold">{selectedOrder.person_name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">📱 Contact</p>
                      <p className="font-semibold">{selectedOrder.person_contact_no}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">📍 Address</p>
                      <p className="font-semibold">{selectedOrder.person_address}</p>
                    </div>
                  </>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Promotion Type</p>
                  <p className="font-semibold">{selectedOrder.promotion_type}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Material Type</p>
                  <p className="font-semibold">
                    {selectedOrder.material_out_type === 'returnable' ? '↩️ Returnable' : '✓ Non-Returnable'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Order Date</p>
                  <p className="font-semibold">{new Date(selectedOrder.order_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Amount</p>
                  <p className="font-semibold text-green-600">₹{selectedOrder.total_amount.toFixed(2)}</p>
                </div>
              </div>

              {/* Items List */}
              <div>
                <h3 className="font-bold mb-3 text-sm">Order Items:</h3>
                <div className="space-y-2">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="border rounded-md p-3 bg-white hover:bg-muted/50">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-muted-foreground mb-1">S.No {idx + 1}</div>
                          <p className="text-sm font-medium text-gray-900 break-words mb-2">{item.product_name}</p>
                          <div className="flex gap-4 text-xs text-gray-700">
                            <span><strong>Qty:</strong> {item.quantity}</span>
                            <span><strong>@ ₹</strong>{item.unit_price.toFixed(2)}</span>
                            <span className="font-semibold text-green-600"><strong>= ₹</strong>{item.total_price.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="border-t-2 border-muted mt-3 pt-3">
                    <div className="text-right">
                      <p className="text-sm font-bold">Total: <span className="text-lg text-green-600">₹{selectedOrder.total_amount.toFixed(2)}</span></p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="w-full bg-green-600 hover:bg-green-700 flex items-center justify-center gap-2" disabled={!!isDispatching}>
                    {isDispatching === selectedOrder.id ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Processing...
                      </>
                    ) : (
                      <>
                        <Truck className="h-4 w-4" /> Mark as OUT
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Material OUT</AlertDialogTitle>
                    <AlertDialogDescription>
                      Mark Promotional Order P{selectedOrder.order_number} as OUT? This will record the dispatch.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleMarkOut(selectedOrder.id, selectedOrder.order_number)}>
                      Confirm OUT
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default GatePassPromotionalMaterialCard;
