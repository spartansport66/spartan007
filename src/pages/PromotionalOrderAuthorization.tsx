"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { MadeWithDyad } from '@/components/made-with-dyad';

interface PromotionalOrderData {
  id: string;
  order_number: number;
  order_date: string;
  promotion_type: string;
  material_out_type: string;
  total_amount: number;
  dealer_name: string;
  sales_person_name: string;
  person_name?: string;
  person_address?: string;
  person_contact_no?: string;
  status: string;
  authorization_status: string;
  items: Array<{
    id: string;
    product_id?: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
}

const PromotionalOrderAuthorization = () => {
  const { authToken } = useParams<{ authToken: string }>();
  const navigate = useNavigate();

  const [orderData, setOrderData] = useState<PromotionalOrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remarks, setRemarks] = useState('');
  const [actionTaken, setActionTaken] = useState<'authorized' | 'rejected' | null>(null);

  useEffect(() => {
    const fetchOrderData = async () => {
      setLoading(true);
      try {
        if (!authToken) {
          throw new Error('Invalid authorization link');
        }

        // Fetch order by auth token
        const { data: orderArray, error: orderError } = await supabase
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
            person_name,
            person_address,
            person_contact_no,
            dealers (name),
            sales_person:profiles!sales_person_id (first_name, last_name),
            promotional_order_items (
              id,
              product_id,
              quantity,
              unit_price,
              total_price,
              products (name)
            )
          `)
          .eq('auth_token', authToken)
          .single();

        if (orderError || !orderArray) {
          throw new Error('Order not found or already processed');
        }

        // Check if already authorized or rejected
        if (orderArray.authorization_status === 'authorized' || orderArray.authorization_status === 'rejected') {
          setError(`This order has already been ${orderArray.authorization_status}`);
          setOrderData(null);
        } else {
          const formattedOrder: PromotionalOrderData = {
            id: orderArray.id,
            order_number: orderArray.order_number,
            order_date: orderArray.order_date,
            promotion_type: orderArray.promotion_type,
            material_out_type: orderArray.material_out_type,
            total_amount: orderArray.total_amount,
            dealer_name: (orderArray.dealers as any)?.name || 'N/A',
            sales_person_name: `${(orderArray.sales_person as any)?.first_name || ''} ${(orderArray.sales_person as any)?.last_name || ''}`.trim(),
            person_name: orderArray.person_name || '',
            person_address: orderArray.person_address || '',
            person_contact_no: orderArray.person_contact_no || '',
            status: orderArray.status,
            authorization_status: orderArray.authorization_status,
            items: (orderArray.promotional_order_items as any[]).map(item => ({
              id: item.id,
              product_id: item.product_id,
              product_name: (item.products as any)?.name || 'Unknown',
              quantity: item.quantity,
              unit_price: item.unit_price,
              total_price: item.total_price,
            })),
          };
          setOrderData(formattedOrder);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load order details');
      } finally {
        setLoading(false);
      }
    };

    fetchOrderData();
  }, [authToken]);

  const handleAuthorize = async () => {
    if (!orderData) return;

    setSubmitting(true);
    try {
      // Update promotional order status
      const { error: updateError } = await supabase
        .from('promotional_orders')
        .update({
          authorization_status: 'authorized',
          status: 'approved',
          authorization_date: new Date().toISOString(),
        })
        .eq('id', orderData.id);

      if (updateError) throw updateError;

      // Deduct stock for each item
      for (const item of orderData.items) {
        if (item.product_id) {
          // Get current product stock
          const { data: productData, error: fetchError } = await supabase
            .from('products')
            .select('stock_out, opening_stock, stock_in')
            .eq('id', item.product_id)
            .single();

          if (fetchError) {
            console.warn(`Failed to fetch product ${item.product_id}:`, fetchError);
            continue;
          }

          // Update stock_out (increase it) which will automatically update closing_stock
          const newStockOut = (productData?.stock_out || 0) + item.quantity;
          
          const { error: stockError } = await supabase
            .from('products')
            .update({
              stock_out: newStockOut,
              closing_stock: (productData?.opening_stock || 0) + (productData?.stock_in || 0) - newStockOut,
            })
            .eq('id', item.product_id);

          if (stockError) {
            console.warn(`Failed to update stock for product ${item.product_id}:`, stockError);
          }
        }
      }

      // Log the authorization
      const { error: logError } = await supabase
        .from('promotional_authorization_log')
        .insert({
          promotional_order_id: orderData.id,
          action: 'authorized',
          remarks: remarks,
          ip_address: '',
        });

      if (logError) console.warn('Failed to log authorization:', logError);

      setActionTaken('authorized');
      showSuccess('Order authorized successfully and stock updated!');

      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err: any) {
      showError(`Authorization failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!orderData) return;

    if (!remarks.trim()) {
      showError('Please provide remarks for rejection');
      return;
    }

    setSubmitting(true);
    try {
      const { error: updateError } = await supabase
        .from('promotional_orders')
        .update({
          authorization_status: 'rejected',
          status: 'rejected',
          authorization_date: new Date().toISOString(),
          authorization_remarks: remarks,
        })
        .eq('id', orderData.id);

      if (updateError) throw updateError;

      // Log the rejection
      const { error: logError } = await supabase
        .from('promotional_authorization_log')
        .insert({
          promotional_order_id: orderData.id,
          action: 'rejected',
          remarks: remarks,
          ip_address: '',
        });

      if (logError) console.warn('Failed to log rejection:', logError);

      setActionTaken('rejected');
      showSuccess('Order rejected successfully!');

      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err: any) {
      showError(`Rejection failed: ${err.message}`);
    } finally {
      setSubmitting(false);
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

  if (error || !orderData) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8 flex items-center justify-center">
        <Card className="w-full max-w-xl border-red-200 bg-red-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-6 w-6 text-red-600" />
              <CardTitle>Authorization Error</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-red-700">{error || 'Invalid authorization link'}</p>
            <Button onClick={() => navigate('/')} className="w-full">
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (actionTaken) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8 flex items-center justify-center">
        <Card className={`w-full max-w-xl ${actionTaken === 'authorized' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
          <CardHeader>
            <div className="flex items-center gap-2">
              {actionTaken === 'authorized' ? (
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              ) : (
                <XCircle className="h-6 w-6 text-red-600" />
              )}
              <CardTitle>
                {actionTaken === 'authorized' ? 'Order Authorized' : 'Order Rejected'}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className={actionTaken === 'authorized' ? 'text-green-700' : 'text-red-700'}>
              The promotional order has been {actionTaken === 'authorized' ? 'authorized' : 'rejected'} successfully!
            </p>
            <p className="text-sm text-muted-foreground">Redirecting to dashboard...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-2xl">
        {/* Order Summary Card */}
        <Card className="mb-6 border-2 border-purple-300 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🔐 Promotional Order Authorization
            </CardTitle>
            <CardDescription>
              Please review the details below and authorize or reject this material distribution
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Order Header Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg border">
              <div>
                <p className="text-xs text-muted-foreground">Order Number</p>
                <p className="font-bold text-lg">P{orderData.order_number}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Promotion Type</p>
                <p className="font-semibold">{orderData.promotion_type}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Party</p>
                <p className="font-semibold">{orderData.dealer_name}</p>
              </div>
              {orderData.person_name && (
                <>
                  <div>
                    <p className="text-xs text-muted-foreground">👤 Person Name</p>
                    <p className="font-semibold">{orderData.person_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">📱 Contact Number</p>
                    <p className="font-semibold">{orderData.person_contact_no}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs text-muted-foreground">📍 Address</p>
                    <p className="font-semibold">{orderData.person_address}</p>
                  </div>
                </>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Total Amount</p>
                <p className="font-bold text-lg text-green-700">₹{orderData.total_amount.toFixed(2)}</p>
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
                    {orderData.items.map(item => (
                      <TableRow key={item.id}>
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

            {/* Remarks Section */}
            <div>
              <label className="block text-sm font-semibold mb-2">
                Remarks {orderData.authorization_status === 'rejected' && '(Required for rejection)'}
              </label>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter any remarks or observations..."
                className="min-h-24"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 justify-end pt-4">
              <Button
                onClick={handleReject}
                disabled={submitting}
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
              >
                {submitting && actionTaken === 'rejected' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Rejecting...
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4" /> Reject
                  </>
                )}
              </Button>
              <Button
                onClick={handleAuthorize}
                disabled={submitting}
                className="bg-green-600 hover:bg-green-700 flex items-center gap-2"
              >
                {submitting && actionTaken === 'authorized' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Authorizing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" /> Authorize
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default PromotionalOrderAuthorization;
