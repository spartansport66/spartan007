"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Loader2, Download, Printer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable'; // Import jspdf-autotable for autoTable functionality

interface OrderItemDetail {
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface OrderDetail {
  id: string;
  order_date: string;
  total_amount: number;
  status: string;
  dealer_name: string;
  dealer_credit_limit: number;
  dealer_consumed_credit: number;
  dealer_pending_credit: number;
  items: OrderItemDetail[];
}

interface OrderDetailsDialogProps {
  orderId: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

// Define the expected structure of the data returned by the Supabase query
interface FetchedOrderData {
  id: string;
  order_date: string;
  total_amount: number;
  status: string;
  dealers: { id: string; name: string; credit_limit: number } | null;
}

const OrderDetailsDialog: React.FC<OrderDetailsDialogProps> = ({ orderId, isOpen, onOpenChange }) => {
  const [orderDetails, setOrderDetails] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchOrderDetails = useCallback(async (id: string) => {
    setLoading(true);
    try {
      // Fetch order details and dealer info, explicitly typing the result
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          id,
          order_date,
          total_amount,
          status,
          dealers (id, name, credit_limit)
        `)
        .eq('id', id)
        .single() as { data: FetchedOrderData | null; error: any }; // Cast to our defined interface

      if (orderError) throw orderError;
      if (!orderData) {
        showError('Order not found.');
        setOrderDetails(null);
        return;
      }

      // Now orderData.dealers is correctly typed as { id: string; name: string; credit_limit: number } | null
      const dealerId = orderData.dealers?.id;
      let dealerConsumedCredit = 0;
      if (dealerId) {
        const { data: totalSpentData, error: totalSpentError } = await supabase
          .from('orders')
          .select('total_amount')
          .eq('dealer_id', dealerId);

        if (totalSpentError) throw totalSpentError;
        dealerConsumedCredit = totalSpentData.reduce((sum, order) => sum + order.total_amount, 0);
      }

      // Fetch order items
      const { data: salesItems, error: salesError } = await supabase
        .from('sales')
        .select(`
          quantity,
          total_price,
          products (name, price)
        `)
        .eq('order_id', id);

      if (salesError) throw salesError;

      const items: OrderItemDetail[] = (salesItems || []).map((item: any) => ({
        product_name: item.products?.name || 'N/A',
        quantity: item.quantity,
        unit_price: item.products?.price || 0,
        total_price: item.total_price,
      }));

      setOrderDetails({
        id: orderData.id,
        order_date: orderData.order_date,
        total_amount: orderData.total_amount,
        status: orderData.status,
        dealer_name: orderData.dealers?.name || 'N/A',
        dealer_credit_limit: orderData.dealers?.credit_limit || 0,
        dealer_consumed_credit: dealerConsumedCredit,
        dealer_pending_credit: (orderData.dealers?.credit_limit || 0) - dealerConsumedCredit,
        items: items,
      });

    } catch (error: any) {
      console.error('Error fetching order details:', error.message);
      showError(`Failed to load order details: ${error.message}`);
      setOrderDetails(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && orderId) {
      fetchOrderDetails(orderId);
    } else if (!isOpen) {
      setOrderDetails(null); // Clear details when dialog closes
    }
  }, [isOpen, orderId, fetchOrderDetails]);

  const handleDownloadPdf = () => {
    if (!orderDetails) return;

    const doc = new jsPDF();
    let yPos = 10;

    doc.setFontSize(18);
    doc.text('Order Details', 10, yPos);
    yPos += 10;

    doc.setFontSize(12);
    doc.text(`Order ID: ${orderDetails.id}`, 10, yPos);
    yPos += 7;
    doc.text(`Order Date: ${new Date(orderDetails.order_date).toLocaleDateString()}`, 10, yPos);
    yPos += 7;
    doc.text(`Dealer: ${orderDetails.dealer_name}`, 10, yPos);
    yPos += 7;
    doc.text(`Status: ${orderDetails.status}`, 10, yPos);
    yPos += 10;

    doc.setFontSize(14);
    doc.text('Order Items:', 10, yPos);
    yPos += 7;

    const headers = [['Product Name', 'Quantity', 'Unit Price', 'Total Price']];
    const data = orderDetails.items.map(item => [
      item.product_name,
      item.quantity.toString(),
      `₹${item.unit_price.toFixed(2)}`,
      `₹${item.total_price.toFixed(2)}`,
    ]);

    (doc as any).autoTable({
      startY: yPos,
      head: headers,
      body: data,
      theme: 'grid',
      headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0] },
      styles: { fontSize: 10, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 30, halign: 'right' },
        2: { cellWidth: 40, halign: 'right' },
        3: { cellWidth: 40, halign: 'right' },
      },
    });
    yPos = (doc as any).autoTable.previous.finalY + 10;

    doc.setFontSize(12);
    doc.text(`Total Order Amount: ₹${orderDetails.total_amount.toFixed(2)}`, 10, yPos);
    yPos += 10;

    doc.setFontSize(14);
    doc.text('Dealer Credit Information:', 10, yPos);
    yPos += 7;
    doc.setFontSize(12);
    doc.text(`Credit Limit: ₹${orderDetails.dealer_credit_limit.toFixed(2)}`, 10, yPos);
    yPos += 7;
    doc.text(`Consumed Credit: ₹${orderDetails.dealer_consumed_credit.toFixed(2)}`, 10, yPos);
    yPos += 7;
    doc.text(`Pending Credit: ₹${orderDetails.dealer_pending_credit.toFixed(2)}`, 10, yPos);

    doc.save(`Order_${orderDetails.id}.pdf`);
  };

  const handlePrint = () => {
    if (!orderDetails) return;

    const printContent = `
      <style>
        body { font-family: sans-serif; margin: 20px; }
        h1 { font-size: 24px; margin-bottom: 15px; }
        h2 { font-size: 18px; margin-top: 20px; margin-bottom: 10px; }
        p { margin-bottom: 5px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .text-right { text-align: right; }
        .summary { margin-top: 20px; padding-top: 10px; border-top: 1px solid #eee; }
      </style>
      <h1>Order Details</h1>
      <p><strong>Order ID:</strong> ${orderDetails.id}</p>
      <p><strong>Order Date:</strong> ${new Date(orderDetails.order_date).toLocaleDateString()}</p>
      <p><strong>Dealer:</strong> ${orderDetails.dealer_name}</p>
      <p><strong>Status:</strong> ${orderDetails.status}</p>

      <h2>Order Items</h2>
      <table>
        <thead>
          <tr>
            <th>Product Name</th>
            <th class="text-right">Quantity</th>
            <th class="text-right">Unit Price</th>
            <th class="text-right">Total Price</th>
          </tr>
        </thead>
        <tbody>
          ${orderDetails.items.map(item => `
            <tr>
              <td>${item.product_name}</td>
              <td class="text-right">${item.quantity}</td>
              <td class="text-right">₹${item.unit_price.toFixed(2)}</td>
              <td class="text-right">₹${item.total_price.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="summary">
        <p><strong>Total Order Amount:</strong> <span class="text-right">₹${orderDetails.total_amount.toFixed(2)}</span></p>
      </div>

      <h2>Dealer Credit Information</h2>
      <p><strong>Credit Limit:</strong> <span class="text-right">₹${orderDetails.dealer_credit_limit.toFixed(2)}</span></p>
      <p><strong>Consumed Credit:</strong> <span class="text-right">₹${orderDetails.dealer_consumed_credit.toFixed(2)}</span></p>
      <p><strong>Pending Credit:</strong> <span class="text-right">₹${orderDetails.dealer_pending_credit.toFixed(2)}</span></p>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    } else {
      showError('Failed to open print window. Please allow pop-ups.');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Order Details</DialogTitle>
          <DialogDescription>
            View the complete details of this order, including items and dealer credit information.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading order details...</p>
          </div>
        ) : orderDetails ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p><span className="font-semibold">Order ID:</span> {orderDetails.id}</p>
                <p><span className="font-semibold">Order Date:</span> {new Date(orderDetails.order_date).toLocaleDateString()}</p>
                <p><span className="font-semibold">Status:</span> {orderDetails.status}</p>
              </div>
              <div>
                <p><span className="font-semibold">Dealer Name:</span> {orderDetails.dealer_name}</p>
                <p><span className="font-semibold">Credit Limit:</span> ₹{orderDetails.dealer_credit_limit.toFixed(2)}</p>
                <p><span className="font-semibold">Consumed Credit:</span> ₹{orderDetails.dealer_consumed_credit.toFixed(2)}</p>
                <p><span className="font-semibold">Pending Credit:</span> ₹{orderDetails.dealer_pending_credit.toFixed(2)}</p>
              </div>
            </div>

            <Separator />

            <h3 className="text-lg font-semibold">Order Items</h3>
            {orderDetails.items.length === 0 ? (
              <p className="text-muted-foreground">No items found for this order.</p>
            ) : (
              <div className="max-h-[200px] overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead>Product Name</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderDetails.items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.product_name}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">₹{item.unit_price.toFixed(2)}</TableCell>
                        <TableCell className="text-right">₹{item.total_price.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="text-right text-lg font-bold mt-4">
              Total Order Amount: ₹{orderDetails.total_amount.toFixed(2)}
            </div>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">No order selected or details could not be loaded.</p>
        )}
        <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handleDownloadPdf} disabled={!orderDetails || loading}>
            <Download className="mr-2 h-4 w-4" /> Download PDF
          </Button>
          <Button variant="outline" onClick={handlePrint} disabled={!orderDetails || loading}>
            <Printer className="mr-2 h-4 w-4" /> Print Order
          </Button>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OrderDetailsDialog;