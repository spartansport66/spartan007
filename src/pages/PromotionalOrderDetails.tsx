"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, CheckCircle2, Clock, XCircle, Send, MessageCircle, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { MadeWithDyad } from '@/components/made-with-dyad';

interface OrderDetail {
  id: string;
  order_number: number;
  order_date: string;
  promotion_type: string;
  material_out_type: string;
  total_amount: number;
  status: string;
  authorization_status?: string;
  auth_token?: string;
  dealer_name: string;
  sales_person_name: string;
  person_name?: string;
  person_address?: string;
  person_contact_no?: string;
  items: Array<{
    product_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
}

const PromotionalOrderDetails = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  const fetchOrderDetails = async () => {
    setLoading(true);
    try {
      const { data: orderData, error: orderError } = await supabase
        .from('promotional_orders')
        .select(`
          id,
          order_number,
          order_date,
          promotion_type,
          material_out_type,
          total_amount,
          status,
          authorization_status,
          auth_token,
          person_name,
          person_address,
          person_contact_no,
          dealers (name),
          sales_person:profiles!sales_person_id (first_name, last_name),
          promotional_order_items (
            quantity,
            unit_price,
            total_price,
            products (name)
          )
        `)
        .eq('id', orderId)
        .single();

      if (orderError || !orderData) {
        throw new Error('Order not found');
      }

      const formattedOrder: OrderDetail = {
        id: orderData.id,
        order_number: orderData.order_number,
        order_date: orderData.order_date,
        promotion_type: orderData.promotion_type,
        material_out_type: orderData.material_out_type,
        total_amount: orderData.total_amount,
        status: orderData.status,
        authorization_status: orderData.authorization_status,
        auth_token: orderData.auth_token,
        dealer_name: (orderData.dealers as any)?.name || 'N/A',
        sales_person_name: `${(orderData.sales_person as any)?.first_name || ''} ${(orderData.sales_person as any)?.last_name || ''}`.trim(),
        person_name: orderData.person_name || '',
        person_address: orderData.person_address || '',
        person_contact_no: orderData.person_contact_no || '',
        items: (orderData.promotional_order_items as any[]).map(item => ({
          product_name: (item.products as any)?.name || 'Unknown',
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
        })),
      };

      setOrder(formattedOrder);
    } catch (err: any) {
      showError(`Failed to load order: ${err.message}`);
      setTimeout(() => navigate('/promotional-orders'), 2000);
    } finally {
      setLoading(false);
    }
  };

  const handleSendForApproval = async () => {
    if (!order || !order.auth_token) {
      showError('No authorization token found for this order');
      return;
    }

    setSending(true);
    try {
      const baseUrl = window.location.origin;
      const authLink = `${baseUrl}/authorize-promotional/${order.auth_token}`;

      // Simple, clean message with clickable link
      const whatsappMessage = `📋 *ORDER P${order.order_number}*

Date: ${new Date(order.order_date).toLocaleDateString()}
Party: ${order.dealer_name}
Amount: ₹${order.total_amount.toFixed(2)}

🔗 *AUTHORIZE LINK:*
${authLink}`;

      // WhatsApp Web URL - directly send message with pre-filled content
      const phoneNumber = '61408949488';
      const encoded = encodeURIComponent(whatsappMessage);
      const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encoded}`;

      showSuccess('✅ Opening WhatsApp with message...');
      window.open(whatsappUrl, '_blank');
    } catch (err: any) {
      showError(`Failed to send via WhatsApp: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleDeleteOrder = async () => {
    if (!order) return;

    if (!window.confirm(`Are you sure you want to delete promotional order P${order.order_number}? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('promotional_orders')
        .delete()
        .eq('id', order.id);

      if (error) throw error;

      showSuccess(`Promotional order P${order.order_number} deleted successfully!`);
      setTimeout(() => navigate('/promotional-orders'), 1500);
    } catch (err: any) {
      showError(`Failed to delete order: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
          <p className="text-lg text-muted-foreground">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Order Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/promotional-orders')} className="w-full">
              Return to Orders
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'dispatched':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getAuthStatusIcon = (status?: string) => {
    switch (status) {
      case 'authorized':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-600" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-2 sm:p-4 lg:p-6">
      <div className="w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => navigate('/promotional-orders')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">P{order.order_number}</h1>
              <p className="text-muted-foreground">Promotional Order Details</p>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-2">
            {order.authorization_status === 'pending' && (
              <Button
                onClick={handleSendForApproval}
                disabled={sending}
                className="bg-green-600 hover:bg-green-700 flex items-center gap-2"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Preparing...
                  </>
                ) : (
                  <>
                    <MessageCircle className="h-4 w-4" /> Send via WhatsApp
                  </>
                )}
              </Button>
            )}
            {order.status === 'pending' && (
              <Button
                onClick={handleDeleteOrder}
                variant="destructive"
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            )}
          </div>
        </div>

        {/* Order Summary */}
        <Card className="mb-6">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="mb-2">{order.promotion_type}</CardTitle>
                <CardDescription>Created on {new Date(order.order_date).toLocaleDateString()}</CardDescription>
              </div>
              <div className="text-right">
                <Badge className={`mb-2 ${getStatusColor(order.status)}`}>
                  {order.status.toUpperCase()}
                </Badge>
                {order.authorization_status && (
                  <div className="flex items-center gap-2 justify-end text-sm">
                    {getAuthStatusIcon(order.authorization_status)}
                    <span className="capitalize">{order.authorization_status}</span>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-muted-foreground">Party (Dealer)</p>
                <p className="text-lg font-semibold">{order.dealer_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sales Person</p>
                <p className="text-lg font-semibold">{order.sales_person_name}</p>
              </div>
              {order.person_name && (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground">👤 Person Name</p>
                    <p className="text-lg font-semibold">{order.person_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">📱 Contact Number</p>
                    <p className="text-lg font-semibold">{order.person_contact_no}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-sm text-muted-foreground">📍 Address</p>
                    <p className="text-lg font-semibold">{order.person_address}</p>
                  </div>
                </>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Material Type</p>
                <p className="text-lg font-semibold">
                  {order.material_out_type === 'returnable' ? '↩️ Returnable' : '✓ Non-Returnable'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="text-2xl font-bold text-green-600">₹{order.total_amount.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order Items */}
        <Card>
          <CardHeader>
            <CardTitle>Order Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted">
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{item.product_name}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">₹{item.unit_price.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-semibold">₹{item.total_price.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold bg-muted">
                    <TableCell colSpan={3} className="text-right">
                      Grand Total:
                    </TableCell>
                    <TableCell className="text-right text-lg text-green-600">
                      ₹{order.total_amount.toFixed(2)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Footer Action */}
        <div className="mt-6">
          <Button
            onClick={() => navigate('/promotional-orders')}
            variant="outline"
            className="w-full"
          >
            Back to Orders
          </Button>
        </div>
      </div>

      <MadeWithDyad />
    </div>
  );
};

export default PromotionalOrderDetails;
