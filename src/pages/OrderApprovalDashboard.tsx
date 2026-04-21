"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { showError, showSuccess } from '@/utils/toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Loader2, ArrowLeft, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';

interface OrderForApproval {
  id: string;
  order_number: number;
  order_date: string;
  dealer_id: string;
  dealer_name: string;
  dealer_gst: string | null;
  total_amount: number;
  discount_amount: number;
  round_off: number;
  status: string;
  payment_status: string;
  approval_status: string;
  items_count: number;
}

const OrderApprovalDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, userType } = useSession();
  const [orders, setOrders] = useState<OrderForApproval[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<OrderForApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDealer, setSelectedDealer] = useState<string>('all');
  const [dealersList, setDealersList] = useState<Array<{ id: string; name: string }>>([]);
  const [searchOrder, setSearchOrder] = useState<string>('');
  
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderForApproval | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check authorization - only sales_hod or admin
  useEffect(() => {
    if (!sessionLoading && userType !== 'sales_hod' && userType !== 'admin') {
      showError('You do not have permission to access this page');
      navigate('/dashboard');
    }
  }, [sessionLoading, userType, navigate]);

  // Fetch dealers for filter
  const fetchDealers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('dealers')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      setDealersList(data || []);
    } catch (err) {
      console.error('Error fetching dealers:', err);
    }
  }, []);

  // Fetch pending orders for approval
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, 
          order_number, 
          order_date, 
          dealer_id,
          total_amount,
          discount_amount,
          round_off,
          status,
          payment_status,
          approval_status,
          dealers(id, name, gst_number),
          sales(id)
        `)
        .eq('approval_status', 'pending')
        .order('order_date', { ascending: false });

      if (error) throw error;

      const formattedOrders: OrderForApproval[] = (data || []).map((order: any) => ({
        id: order.id,
        order_number: order.order_number,
        order_date: order.order_date,
        dealer_id: order.dealer_id,
        dealer_name: order.dealers?.name || 'Unknown',
        dealer_gst: order.dealers?.gst_number || null,
        total_amount: order.total_amount,
        discount_amount: order.discount_amount || 0,
        round_off: order.round_off || 0,
        status: order.status,
        payment_status: order.payment_status,
        approval_status: order.approval_status,
        items_count: order.sales?.length || 0,
      }));

      setOrders(formattedOrders);
      applyFilters(formattedOrders, selectedDealer, searchOrder);
    } catch (err) {
      console.error('Error fetching orders:', err);
      showError('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [selectedDealer, searchOrder]);

  // Apply filters
  const applyFilters = (ordersToFilter: OrderForApproval[], dealerId: string, search: string) => {
    let filtered = ordersToFilter;

    if (dealerId && dealerId !== 'all') {
      filtered = filtered.filter((order) => order.dealer_id === dealerId);
    }

    if (search) {
      filtered = filtered.filter((order) =>
        order.order_number.toString().includes(search) ||
        order.dealer_name.toLowerCase().includes(search.toLowerCase())
      );
    }

    setFilteredOrders(filtered);
  };

  useEffect(() => {
    fetchDealers();
    fetchOrders();
  }, []);

  useEffect(() => {
    applyFilters(orders, selectedDealer, searchOrder);
  }, [selectedDealer, searchOrder, orders]);

  // Approve order
  const handleApproveOrder = async (orderId: string) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          approval_status: 'approved',
          approved_by: user?.id,
          approval_date: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (error) throw error;

      showSuccess('Order approved successfully!');
      setIsApproveDialogOpen(false);
      setSelectedOrder(null);
      fetchOrders();
    } catch (err) {
      console.error('Error approving order:', err);
      showError('Failed to approve order');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reject order
  const handleRejectOrder = async (orderId: string) => {
    if (!rejectionReason.trim()) {
      showError('Please provide a rejection reason');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          approval_status: 'rejected',
          approved_by: user?.id,
          approval_date: new Date().toISOString(),
          rejection_reason: rejectionReason.trim(),
        })
        .eq('id', orderId);

      if (error) throw error;

      showSuccess('Order rejected.');
      setIsRejectDialogOpen(false);
      setRejectionReason('');
      setSelectedOrder(null);
      fetchOrders();
    } catch (err) {
      console.error('Error rejecting order:', err);
      showError('Failed to reject order');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Button
              variant="ghost"
              onClick={() => navigate('/dashboard')}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-3xl font-bold">Order Approval Dashboard</h1>
            <p className="text-gray-500">Review and approve orders for billing</p>
          </div>
        </div>

        {/* Filter Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="dealer-select">Dealer</Label>
                <select
                  id="dealer-select"
                  value={selectedDealer}
                  onChange={(e) => setSelectedDealer(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="all">All Dealers</option>
                  {dealersList.map((dealer) => (
                    <option key={dealer.id} value={dealer.id}>
                      {dealer.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="order-search">Order Number</Label>
                <Input
                  id="order-search"
                  placeholder="Search order #..."
                  value={searchOrder}
                  onChange={(e) => setSearchOrder(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label>&nbsp;</Label>
                <Button onClick={fetchOrders} variant="outline">
                  Refresh
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Orders Table */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Pending Orders</CardTitle>
                <CardDescription>
                  {filteredOrders.length} order(s) awaiting approval
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin h-8 w-8" />
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No pending orders to approve</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Dealer</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>GST #</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-semibold">
                          #{order.order_number}
                        </TableCell>
                        <TableCell>{order.dealer_name}</TableCell>
                        <TableCell>
                          {format(new Date(order.order_date), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {order.dealer_gst || 'N/A'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          ₹{order.total_amount.toFixed(2)}
                        </TableCell>
                        <TableCell>{order.items_count}</TableCell>
                        <TableCell>
                          <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">
                            Pending
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="default"
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => {
                                setSelectedOrder(order);
                                setIsApproveDialogOpen(true);
                              }}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                setSelectedOrder(order);
                                setIsRejectDialogOpen(true);
                              }}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
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
      </div>

      {/* Approve Confirmation Dialog */}
      <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Order</DialogTitle>
            <DialogDescription>
              Approve Order #{selectedOrder?.order_number} from {selectedOrder?.dealer_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Order Total</Label>
              <p className="text-sm font-semibold">
                ₹{selectedOrder?.total_amount.toFixed(2)}
              </p>
            </div>
            <p className="text-sm text-gray-600">
              This order will become available for billing once approved.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsApproveDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleApproveOrder(selectedOrder?.id || '')}
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Approve Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Confirmation Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Order</DialogTitle>
            <DialogDescription>
              Reject Order #{selectedOrder?.order_number} from {selectedOrder?.dealer_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Order Total</Label>
              <p className="text-sm font-semibold">
                ₹{selectedOrder?.total_amount.toFixed(2)}
              </p>
            </div>
            <div>
              <Label htmlFor="rejection-reason">Rejection Reason *</Label>
              <Textarea
                id="rejection-reason"
                placeholder="Explain why this order is being rejected..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsRejectDialogOpen(false);
                setRejectionReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleRejectOrder(selectedOrder?.id || '')}
              disabled={isSubmitting || !rejectionReason.trim()}
              variant="destructive"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reject Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrderApprovalDashboard;
