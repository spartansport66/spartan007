"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Loader2, Printer, Copy, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';

interface OnlineOrderData {
  id: string;
  order_number: number;
  order_date: string | null;
  total_amount: number;
  discount_amount: number;
  bill_no: string | null;
  status: string;
  payment_status: string;
  client_name?: string | null;
  platform_name?: string;
  platform_order_number?: string | null;
  contact_no?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  raw_item_name?: string | null;
  mapped_product_name?: string | null;
  mapped_product_code?: string | null;
  dispatch_number?: number | null;
  dispatch_date?: string | null;
}

interface OnlineOrderPreviewProps {
  orderId: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatDate = (dateString: string | null) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const OnlineOrderPreview: React.FC<OnlineOrderPreviewProps> = ({
  orderId,
  isOpen,
  onOpenChange,
}) => {
  const [orderData, setOrderData] = useState<OnlineOrderData | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchOnlineOrder = useCallback(async (id: string) => {
    setLoading(true);
    try {
      // Fetch from online_orders table
      const { data: onlineOrderArray, error: onlineOrderError } = await supabase
        .from('online_orders')
        .select(`id, order_number, order_date, total_amount, bill_no, status, payment_status, dispatch_number, dispatch_date`)
        .eq('id', id)
        .limit(1);

      if (onlineOrderError) throw onlineOrderError;
      if (!onlineOrderArray || onlineOrderArray.length === 0) {
        throw new Error('Online order not found');
      }

      const order = onlineOrderArray[0];

      // Fetch online order details
      const { data: detailsArray, error: detailsError } = await supabase
        .from('online_order_details')
        .select(`
          client_name,
          platform_order_number,
          contact_no,
          city,
          state,
          address,
          raw_item_name,
          mapped_product_id,
          platform_id,
          products (name, code)
        `)
        .eq('order_id', id)
        .limit(1);

      if (detailsError) throw detailsError;

      let platformName = 'N/A';
      let details: any = null;

      if (detailsArray && detailsArray.length > 0) {
        details = detailsArray[0];
        
        // Fetch platform name if platform_id exists
        if (details.platform_id) {
          const { data: platformArray, error: platformError } = await supabase
            .from('online_platforms')
            .select('name')
            .eq('id', details.platform_id)
            .limit(1);
          
          if (platformArray && platformArray.length > 0) {
            platformName = platformArray[0].name || 'N/A';
          }
        }
      }

      const orderData: OnlineOrderData = {
        id: order.id,
        order_number: order.order_number,
        order_date: order.order_date,
        total_amount: order.total_amount,
        discount_amount: 0,
        bill_no: order.bill_no,
        status: order.status,
        payment_status: order.payment_status,
        dispatch_number: order.dispatch_number,
        dispatch_date: order.dispatch_date,
        client_name: details?.client_name || 'N/A',
        platform_name: platformName,
        platform_order_number: details?.platform_order_number || 'N/A',
        contact_no: details?.contact_no || 'N/A',
        city: details?.city || 'N/A',
        state: details?.state || 'N/A',
        address: details?.address || 'N/A',
        raw_item_name: details?.raw_item_name || 'N/A',
        mapped_product_name: (details?.products as any)?.name || 'N/A',
        mapped_product_code: (details?.products as any)?.code || 'N/A',
      };
      setOrderData(orderData);
    } catch (error: any) {
      console.error('Error fetching online order:', error);
      showError(`Failed to load online order details: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && orderId) {
      fetchOnlineOrder(orderId);
    }
  }, [isOpen, orderId, fetchOnlineOrder]);

  const handleCopyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    showSuccess(`${field} copied to clipboard`);
    setTimeout(() => setCopied(null), 2000);
  };

  const handlePrintPreview = () => {
    if (!orderData) return;
    const printWindow = window.open('', '', 'height=600,width=800');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Online Order Preview - #${orderData.order_number}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              .header { text-align: center; margin-bottom: 20px; }
              .header h1 { margin: 0; font-size: 24px; }
              .header p { margin: 5px 0; color: #666; }
              .section { margin-bottom: 20px; border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
              .section h3 { margin-top: 0; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
              .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
              .detail-row .label { font-weight: bold; color: #555; }
              .detail-row .value { color: #333; }
              .detail-row:last-child { border-bottom: none; }
              .status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; }
              .status.pending { background-color: #fff3cd; color: #856404; }
              .status.completed { background-color: #d4edda; color: #155724; }
              .total { text-align: right; font-size: 18px; font-weight: bold; padding-top: 10px; border-top: 2px solid #333; }
              @media print { body { margin: 0; } }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>ONLINE ORDER PREVIEW</h1>
              <p>Order #${orderData.order_number} | Bill #${orderData.bill_no || 'N/A'}</p>
              <p>Generated on ${new Date().toLocaleString()}</p>
            </div>

            <div class="section">
              <h3>Order Information</h3>
              <div class="detail-row">
                <span class="label">Order Number:</span>
                <span class="value">#${orderData.order_number}</span>
              </div>
              <div class="detail-row">
                <span class="label">Bill Number:</span>
                <span class="value">${orderData.bill_no || 'N/A'}</span>
              </div>
              <div class="detail-row">
                <span class="label">Order Date:</span>
                <span class="value">${formatDate(orderData.order_date)}</span>
              </div>
              <div class="detail-row">
                <span class="label">Status:</span>
                <span class="value"><span class="status ${orderData.status === 'completed' ? 'completed' : 'pending'}">${orderData.status || 'N/A'}</span></span>
              </div>
              <div class="detail-row">
                <span class="label">Payment Status:</span>
                <span class="value">${orderData.payment_status || 'N/A'}</span>
              </div>
            </div>

            <div class="section">
              <h3>Customer Details</h3>
              <div class="detail-row">
                <span class="label">Client Name:</span>
                <span class="value">${orderData.client_name || 'N/A'}</span>
              </div>
              <div class="detail-row">
                <span class="label">Contact Number:</span>
                <span class="value">${orderData.contact_no || 'N/A'}</span>
              </div>
              <div class="detail-row">
                <span class="label">Address:</span>
                <span class="value">${orderData.address || 'N/A'}</span>
              </div>
              <div class="detail-row">
                <span class="label">City:</span>
                <span class="value">${orderData.city || 'N/A'}</span>
              </div>
              <div class="detail-row">
                <span class="label">State:</span>
                <span class="value">${orderData.state || 'N/A'}</span>
              </div>
            </div>

            <div class="section">
              <h3>Platform & Item Details</h3>
              <div class="detail-row">
                <span class="label">Platform:</span>
                <span class="value">${orderData.platform_name || 'N/A'}</span>
              </div>
              <div class="detail-row">
                <span class="label">Platform Order #:</span>
                <span class="value">${orderData.platform_order_number || 'N/A'}</span>
              </div>
              <div class="detail-row">
                <span class="label">Raw Item Name:</span>
                <span class="value">${orderData.raw_item_name || 'N/A'}</span>
              </div>
              <div class="detail-row">
                <span class="label">Mapped Product:</span>
                <span class="value">${orderData.mapped_product_name || 'N/A'}</span>
              </div>
              <div class="detail-row">
                <span class="label">Product Code:</span>
                <span class="value">${orderData.mapped_product_code || 'N/A'}</span>
              </div>
            </div>

            <div class="section">
              <h3>Dispatch Details</h3>
              <div class="detail-row">
                <span class="label">Dispatch Number:</span>
                <span class="value">${orderData.dispatch_number || 'N/A'}</span>
              </div>
              <div class="detail-row">
                <span class="label">Dispatch Date:</span>
                <span class="value">${formatDate((orderData.dispatch_date ?? null) as string | null)}</span>
              </div>
            </div>

            <div class="section">
              <h3>Order Summary</h3>
              <div class="detail-row">
                <span class="label">Subtotal:</span>
                <span class="value">₹${orderData.total_amount.toFixed(2)}</span>
              </div>
              ${orderData.discount_amount > 0 ? `
              <div class="detail-row">
                <span class="label">Discount:</span>
                <span class="value">₹${orderData.discount_amount.toFixed(2)}</span>
              </div>
              ` : ''}
              <div class="total">
                <span class="label">TOTAL AMOUNT: ₹${(orderData.total_amount - orderData.discount_amount).toFixed(2)}</span>
              </div>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Online Order Preview</DialogTitle>
          <DialogDescription>View online order details only</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : orderData ? (
          <div className="space-y-4">
            {/* Order Summary Card */}
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">Order #{orderData.order_number}</CardTitle>
                    <p className="text-sm text-muted-foreground">Bill #{orderData.bill_no || 'N/A'}</p>
                  </div>
                  <div className="text-right">
                    <p className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                      orderData.status === 'completed' ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'
                    }`}>
                      {orderData.status || 'Pending'}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Order Date</p>
                    <p className="font-semibold">{formatDate(orderData.order_date)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Payment Status</p>
                    <p className={`font-semibold ${orderData.payment_status === 'paid' ? 'text-green-600' : 'text-orange-600'}`}>
                      {orderData.payment_status || 'N/A'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Customer Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Customer Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-muted-foreground">Client Name</p>
                    <p className="font-semibold">{orderData.client_name || 'N/A'}</p>
                  </div>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => handleCopyToClipboard(orderData.client_name || '', 'Client Name')}
                  >
                    {copied === 'Client Name' ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-muted-foreground">Contact Number</p>
                    <p className="font-semibold">{orderData.contact_no || 'N/A'}</p>
                  </div>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => handleCopyToClipboard(orderData.contact_no || '', 'Contact Number')}
                  >
                    {copied === 'Contact Number' ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground">Delivery Address</p>
                  <p className="font-semibold">{orderData.address || 'N/A'}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">City</p>
                    <p className="font-semibold">{orderData.city || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">State</p>
                    <p className="font-semibold">{orderData.state || 'N/A'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Platform & Item Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Platform & Item Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Platform</p>
                    <p className="font-semibold">{orderData.platform_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Platform Order #</p>
                    <p className="font-semibold">{orderData.platform_order_number || 'N/A'}</p>
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground">Raw Item Name</p>
                  <p className="font-semibold">{orderData.raw_item_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Mapped Product</p>
                  <p className="font-semibold">{orderData.mapped_product_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Product Code</p>
                  <p className="font-semibold">{orderData.mapped_product_code || 'N/A'}</p>
                </div>
              </CardContent>
            </Card>

            {/* Dispatch Details */}
            {orderData.dispatch_number && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Dispatch Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Dispatch Number</p>
                      <p className="font-semibold">{orderData.dispatch_number || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Dispatch Date</p>
                      <p className="font-semibold">{formatDate((orderData.dispatch_date ?? null) as string | null)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Amount Summary */}
            <Card className="bg-slate-100">
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Total Amount:</span>
                    <span className="font-semibold">₹{orderData.total_amount.toFixed(2)}</span>
                  </div>
                  {orderData.discount_amount > 0 && (
                    <div className="flex justify-between text-sm text-red-600">
                      <span>Discount:</span>
                      <span className="font-semibold">-₹{orderData.discount_amount.toFixed(2)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Net Amount:</span>
                    <span className="text-green-700">₹{(orderData.total_amount - orderData.discount_amount).toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No data available
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handlePrintPreview} disabled={!orderData}>
            <Printer className="h-4 w-4 mr-2" />
            Print Preview
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OnlineOrderPreview;
