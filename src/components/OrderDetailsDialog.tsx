"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Loader2, Download, Printer, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast'; // Added showSuccess
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable'; // Explicitly imported autoTable

interface OrderItemDetail {
  product_name: string;
  quantity: number;
  unit_price: number; // This is now DP
  total_price: number;
  product_code: string; // New
  product_size: string; // New
  product_hsn: string; // New
  product_gst: string; // New
}

interface OrderDetail {
  id: string; // UUID
  order_number: number; // New auto-incrementing ID
  order_date: string;
  total_amount: number;
  status: string;
  dealer_name: string;
  dealer_address: string;
  dealer_city: string; // Added
  dealer_state: string; // Added
  dealer_country: string; // Added
  dealer_phone: string;
  sales_person_name: string;
  items: OrderItemDetail[];
  bill_no: string | null; // New
  dispatch_date: string | null; // New
  dispatch_number: number | null; // New
  dispatched: boolean; // New
  payment_status: string; // New
  payment_due_date: string | null; // New
  payment_method: string | null; // New (from payments table if paid at order time)
  payment_amount: number | null; // New (from payments table if paid at order time)
  cheque_dd_no: string | null; // New
  cheque_dd_date: string | null; // New
  // New payment detail fields
  card_number: string | null;
  card_holder_name: string | null;
  expiry_date: string | null;
  cvv: string | null;
  bank_name: string | null;
  account_number: string | null;
  ifsc_code: string | null;
  upi_id: string | null;
  transaction_id: string | null;
  payment_date: string | null; // New
}

interface OrderDetailsDialogProps {
  orderId: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  shouldPrintOnLoad?: boolean; // New prop
}

// Define the expected structure of the data returned by the Supabase query
interface FetchedOrderData {
  id: string;
  order_number: number; // Added
  order_date: string;
  total_amount: number;
  status: string;
  payment_status: string; // New
  payment_due_date: string | null; // New
  dealers: {
    id: string;
    name: string;
    address: string;
    phone: string;
    city: string;
    state: string;
    country: string;
  } | null; // Added city, state, country
  user_id: string;
  bill_no: string | null; // New
  dispatch_date: string | null; // New
  dispatch_number: number | null; // New
  dispatched: boolean; // New
  payments: {
    amount: number;
    payment_method: string;
    cheque_dd_no: string | null;
    cheque_dd_date: string | null;
    card_number: string | null;
    card_holder_name: string | null;
    expiry_date: string | null;
    cvv: string | null;
    bank_name: string | null;
    account_number: string | null;
    ifsc_code: string | null;
    upi_id: string | null;
    transaction_id: string | null;
    payment_date: string | null;
  }[] | null; // New
}

// Format date as dd/mm/yyyy
const formatDate = (dateString: string | null) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const OrderDetailsDialog: React.FC<OrderDetailsDialogProps> = ({
  orderId,
  isOpen,
  onOpenChange,
  shouldPrintOnLoad = false
}) => {
  const [orderDetails, setOrderDetails] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);

  const fetchOrderDetails = useCallback(async (id: string) => {
    setLoading(true);
    try {
      // Fetch order details, dealer info, and user_id for sales person
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          order_date,
          total_amount,
          status,
          payment_status,
          payment_due_date,
          user_id,
          bill_no,
          dispatch_date,
          dispatch_number,
          dispatched,
          dealers (
            id,
            name,
            address,
            phone,
            city,
            state,
            country
          ),
          payments (
            amount,
            payment_method,
            cheque_dd_no,
            cheque_dd_date,
            card_number,
            card_holder_name,
            expiry_date,
            cvv,
            bank_name,
            account_number,
            ifsc_code,
            upi_id,
            transaction_id,
            payment_date
          )
        `)
        .eq('id', id)
        .single() as { data: FetchedOrderData | null; error: any }; // Explicitly type data

      if (orderError) throw orderError;

      if (!orderData) {
        showError('Order not found.');
        setOrderDetails(null);
        return;
      }

      // Fetch sales person name
      let salesPersonName = 'N/A';
      if (orderData.user_id) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', orderData.user_id)
          .single();

        if (profileError) {
          console.error('Error fetching sales person profile:', profileError.message);
        } else if (profileData) {
          salesPersonName = `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim();
        }
      }

      // Fetch order items, including new product details
      const { data: salesItems, error: salesError } = await supabase
        .from('sales')
        .select(`
          quantity,
          total_price,
          products (name, dp, code, size, hsn, gst)
        `)
        .eq('order_id', id);

      if (salesError) throw salesError;

      const items: OrderItemDetail[] = (salesItems || []).map((item: any) => ({
        product_name: item.products?.name || 'N/A',
        quantity: item.quantity,
        unit_price: item.products?.dp || 0, // Use product.dp for unit price
        total_price: item.total_price,
        product_code: item.products?.code || 'N/A', // New
        product_size: item.products?.size || 'N/A', // New
        product_hsn: item.products?.hsn || 'N/A', // New
        product_gst: item.products?.gst || 'N/A', // New
      }));

      const paymentInfo = orderData.payments && orderData.payments.length > 0 ? orderData.payments[0] : null;

      setOrderDetails({
        id: orderData.id,
        order_number: orderData.order_number,
        order_date: orderData.order_date,
        total_amount: orderData.total_amount,
        status: orderData.status,
        dealer_name: orderData.dealers?.name || 'N/A',
        dealer_address: orderData.dealers?.address || 'N/A',
        dealer_city: orderData.dealers?.city || 'N/A', // Added
        dealer_state: orderData.dealers?.state || 'N/A', // Added
        dealer_country: orderData.dealers?.country || 'N/A', // Added
        dealer_phone: orderData.dealers?.phone || 'N/A',
        sales_person_name: salesPersonName,
        items: items,
        bill_no: orderData.bill_no, // New
        dispatch_date: orderData.dispatch_date, // New
        dispatch_number: orderData.dispatch_number, // New
        dispatched: orderData.dispatched, // New
        payment_status: orderData.payment_status, // New
        payment_due_date: orderData.payment_due_date, // New
        payment_method: paymentInfo?.payment_method || null, // New
        payment_amount: paymentInfo?.amount || null, // New
        cheque_dd_no: paymentInfo?.cheque_dd_no || null, // New
        cheque_dd_date: paymentInfo?.cheque_dd_date || null, // New
        card_number: paymentInfo?.card_number || null,
        card_holder_name: paymentInfo?.card_holder_name || null,
        expiry_date: paymentInfo?.expiry_date || null,
        cvv: paymentInfo?.cvv || null,
        bank_name: paymentInfo?.bank_name || null,
        account_number: paymentInfo?.account_number || null,
        ifsc_code: paymentInfo?.ifsc_code || null,
        upi_id: paymentInfo?.upi_id || null,
        transaction_id: paymentInfo?.transaction_id || null,
        payment_date: paymentInfo?.payment_date || null, // New
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
      setShowPaymentDetails(false); // Reset payment details view
    }
  }, [isOpen, orderId, fetchOrderDetails]);

  useEffect(() => {
    if (isOpen && orderDetails && shouldPrintOnLoad) {
      handlePrint();
      onOpenChange(false); // Close dialog after printing
    }
  }, [isOpen, orderDetails, shouldPrintOnLoad, onOpenChange]);

  const renderPaymentDetails = (details: OrderDetail) => {
    if (details.payment_status !== 'paid' && details.payment_status !== 'pending_approval' || !details.payment_method) return null;

    return (
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Payment Details</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <p><strong>Payment Method:</strong> {details.payment_method || 'N/A'}</p>
          <p><strong>Amount:</strong> ₹{details.payment_amount?.toFixed(2) || 'N/A'}</p>
          <p><strong>Payment Date:</strong> {formatDate(details.payment_date)}</p>
          {details.payment_method === 'Cheque/DD' && (
            <>
              <p><strong>Cheque/DD No:</strong> {details.cheque_dd_no || 'N/A'}</p>
              <p><strong>Cheque/DD Date:</strong> {formatDate(details.cheque_dd_date)}</p>
            </>
          )}
          {details.payment_method === 'Card' && (
            <>
              <p><strong>Card Number:</strong> {details.card_number ? `**** **** **** ${details.card_number.slice(-4)}` : 'N/A'}</p>
              <p><strong>Card Holder:</strong> {details.card_holder_name || 'N/A'}</p>
              <p><strong>Expiry Date:</strong> {details.expiry_date || 'N/A'}</p>
              <p><strong>Transaction ID:</strong> {details.transaction_id || 'N/A'}</p>
            </>
          )}
          {details.payment_method === 'Bank Transfer' && (
            <>
              <p><strong>Bank Name:</strong> {details.bank_name || 'N/A'}</p>
              <p><strong>Account Number:</strong> {details.account_number ? `****${details.account_number.slice(-4)}` : 'N/A'}</p>
              <p><strong>IFSC Code:</strong> {details.ifsc_code || 'N/A'}</p>
              <p><strong>Transaction ID:</strong> {details.transaction_id || 'N/A'}</p>
            </>
          )}
          {details.payment_method === 'UPI' && (
            <>
              <p><strong>UPI ID:</strong> {details.upi_id || 'N/A'}</p>
              <p><strong>Transaction ID:</strong> {details.transaction_id || 'N/A'}</p>
            </>
          )}
          {details.payment_method === 'Cash' && (
            <p><strong>Transaction ID:</strong> {details.transaction_id || 'N/A'}</p>
          )}
        </div>
      </div>
    );
  };

  const handlePrint = () => {
    if (!orderDetails) return;

    let paymentDetailsHtml = '';
    if (orderDetails.payment_status === 'paid' || orderDetails.payment_status === 'pending_approval') {
      paymentDetailsHtml = `
        <h2>Payment Details</h2>
        <p><strong>Payment Method:</strong> ${orderDetails.payment_method || 'N/A'}</p>
        <p><strong>Amount:</strong> ₹${orderDetails.payment_amount?.toFixed(2) || 'N/A'}</p>
        <p><strong>Payment Date:</strong> ${formatDate(orderDetails.payment_date)}</p>
        ${orderDetails.payment_method === 'Cheque/DD' ? `
          <p><strong>Cheque/DD No:</strong> ${orderDetails.cheque_dd_no || 'N/A'}</p>
          <p><strong>Cheque/DD Date:</strong> ${formatDate(orderDetails.cheque_dd_date)}</p>
        ` : ''}
        ${(orderDetails.payment_method === 'Card' || orderDetails.payment_method === 'Bank Transfer' || orderDetails.payment_method === 'UPI') ? `
          <p><strong>Transaction ID:</strong> ${orderDetails.transaction_id || 'N/A'}</p>
        ` : ''}
      `;
    }

    const doc = new jsPDF({
      orientation: 'landscape'
    });
    doc.setFontSize(18);
    doc.text("Order Details", 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);

    const tableColumn = [
      "Code", "Product Name", "Size", "HSN", "GST (%)", "Quantity", "Unit Price", "Total Price"
    ];
    const tableRows = orderDetails.items.map(item => [
      item.product_code,
      item.product_name,
      item.product_size,
      item.product_hsn,
      item.product_gst,
      item.quantity,
      `₹${item.unit_price.toFixed(2)}`,
      `₹${item.total_price.toFixed(2)}`,
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 100, // Adjust startY to accommodate header info
      styles: {
        fontSize: 7
      },
      headStyles: {
        fillColor: [200, 200, 200],
        textColor: [0, 0, 0]
      },
      margin: { top: 25, left: 10, right: 10 },
      columnStyles: {
        0: { cellWidth: 20 }, // Code
        1: { cellWidth: 30 }, // Product Name
        2: { cellWidth: 20 }, // Size
        3: { cellWidth: 20 }, // HSN
        4: { cellWidth: 20, halign: 'right' }, // GST (%)
        5: { cellWidth: 15, halign: 'right' }, // Quantity
        6: { cellWidth: 20, halign: 'right' }, // Unit Price
        7: { cellWidth: 25, halign: 'right' }, // Total Price
      }
    });

    let finalY = (doc as any).lastAutoTable.finalY;

    doc.setFontSize(10);
    doc.text(`Order Number: ${orderDetails.order_number}`, 14, 35);
    doc.text(`Order Date: ${formatDate(orderDetails.order_date)}`, 14, 40);
    doc.text(`Order Status: ${orderDetails.status}`, 14, 45);
    doc.text(`Payment Status: ${orderDetails.payment_status}`, 14, 50);
    doc.text(`Payment Due Date: ${formatDate(orderDetails.payment_due_date)}`, 14, 55);
    doc.text(`Sales Person: ${orderDetails.sales_person_name}`, 14, 60);

    if (orderDetails.dispatched) {
      doc.text(`Dispatch Number: ${orderDetails.dispatch_number || 'N/A'}`, 14, 65);
      doc.text(`Dispatch Date: ${formatDate(orderDetails.dispatch_date)}`, 14, 70);
      doc.text(`Bill Number: ${orderDetails.bill_no || 'N/A'}`, 14, 75);
    }

    doc.text(`Dealer Name: ${orderDetails.dealer_name}`, 150, 35);
    doc.text(`Address: ${orderDetails.dealer_address}, ${orderDetails.dealer_city}, ${orderDetails.dealer_state}, ${orderDetails.dealer_country}`, 150, 40);
    doc.text(`Phone: ${orderDetails.dealer_phone}`, 150, 45);

    doc.setFontSize(12);
    doc.text(`Total Order Amount: ₹${orderDetails.total_amount.toFixed(2)}`, 270, finalY + 10, { align: 'right' });

    if (orderDetails.payment_status === 'paid' || orderDetails.payment_status === 'pending_approval') {
      doc.setFontSize(10);
      doc.text("Payment Details:", 14, finalY + 20);
      doc.text(`Payment Method: ${orderDetails.payment_method || 'N/A'}`, 14, finalY + 25);
      doc.text(`Amount: ₹${orderDetails.payment_amount?.toFixed(2) || 'N/A'}`, 14, finalY + 30);
      doc.text(`Payment Date: ${formatDate(orderDetails.payment_date)}`, 14, finalY + 35);
      if (orderDetails.payment_method === 'Cheque/DD') {
        doc.text(`Cheque/DD No: ${orderDetails.cheque_dd_no || 'N/A'}`, 14, finalY + 40);
        doc.text(`Cheque/DD Date: ${formatDate(orderDetails.cheque_dd_date)}`, 14, finalY + 45);
      }
      if (orderDetails.payment_method === 'Card' || orderDetails.payment_method === 'Bank Transfer' || orderDetails.payment_method === 'UPI') {
        doc.text(`Transaction ID: ${orderDetails.transaction_id || 'N/A'}`, 14, finalY + 40);
      }
    }

    doc.save(`order_${orderDetails.order_number}_details.pdf`);
    showSuccess('Order details PDF generated successfully!');
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
                <p><span className="font-semibold">Order Number:</span> {orderDetails.order_number}</p>
                <p><span className="font-semibold">Order Date:</span> {formatDate(orderDetails.order_date)}</p>
                <p><span className="font-semibold">Order Status:</span> {orderDetails.status}</p>
                <p><span className="font-semibold">Payment Status:</span> {orderDetails.payment_status}</p>
                <p><span className="font-semibold">Payment Due Date:</span> {formatDate(orderDetails.payment_due_date)}</p>
                <p><span className="font-semibold">Sales Person:</span> {orderDetails.sales_person_name}</p>
                {orderDetails.dispatched && (
                  <>
                    <p><span className="font-semibold">Dispatch Number:</span> {orderDetails.dispatch_number || 'N/A'}</p>
                    <p><span className="font-semibold">Dispatch Date:</span> {formatDate(orderDetails.dispatch_date)}</p>
                    <p><span className="font-semibold">Bill Number:</span> {orderDetails.bill_no || 'N/A'}</p>
                  </>
                )}
              </div>
              <div>
                <p><span className="font-semibold">Dealer Name:</span> {orderDetails.dealer_name}</p>
                <p><span className="font-semibold">Address:</span> {orderDetails.dealer_address}, {orderDetails.dealer_city}, {orderDetails.dealer_state}, {orderDetails.dealer_country}</p>
                <p><span className="font-semibold">Phone:</span> {orderDetails.dealer_phone}</p>
              </div>
            </div>
            {(orderDetails.payment_status === 'paid' || orderDetails.payment_status === 'pending_approval') && orderDetails.payment_method && (
              <>
                <Separator />
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Payment Details</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPaymentDetails(!showPaymentDetails)}
                    className="flex items-center gap-1"
                  >
                    <Eye className="h-4 w-4" />
                    {showPaymentDetails ? 'Hide Details' : 'View Details'}
                  </Button>
                </div>
                {showPaymentDetails && (
                  <div className="p-3 bg-muted rounded-md">
                    {renderPaymentDetails(orderDetails)}
                  </div>
                )}
              </>
            )}
            <Separator />
            <h3 className="text-lg font-semibold">Order Items</h3>
            {orderDetails.items.length === 0 ? (
              <p className="text-muted-foreground">No items found for this order.</p>
            ) : (
              <div className="max-h-[200px] overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Product Name</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>HSN</TableHead>
                      <TableHead className="text-right">GST (%)</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderDetails.items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.product_code}</TableCell>
                        <TableCell>{item.product_name}</TableCell>
                        <TableCell>{item.product_size}</TableCell>
                        <TableCell>{item.product_hsn}</TableCell>
                        <TableCell className="text-right">{item.product_gst}</TableCell>
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
          <Button variant="outline" onClick={handlePrint} disabled={!orderDetails || loading}>
            <Printer className="mr-2 h-4 w-4" /> Print Receipt
          </Button>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OrderDetailsDialog;