"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Loader2, Download, Printer, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface OrderItemDetail {
  product_name: string;
  quantity: number;
  unit_price: number; // This is now DP
  total_price: number;
  product_code: string;
  product_size: string;
  product_hsn: string;
  product_gst: string;
}

interface OrderDetail {
  id: string;
  order_number: number;
  order_date: string;
  total_amount: number;
  discount_amount: number;
  item_discount: number; // Added
  gst_percent: number;
  status: string;
  dealer_name: string;
  dealer_address: string;
  dealer_city: string;
  dealer_state: string;
  dealer_country: string;
  dealer_phone: string;
  sales_person_name: string;
  items: OrderItemDetail[];
  bill_no: string | null;
  dispatch_date: string | null;
  dispatch_number: number | null;
  dispatched: boolean;
  payment_status: string;
  payment_due_date: string | null;
  payment_method: string | null;
  payment_amount: number | null;
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
}

interface OrderDetailsDialogProps {
  orderId: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  shouldPrintOnLoad?: boolean;
}

interface FetchedOrderData {
  id: string;
  order_number: number;
  order_date: string;
  total_amount: number;
  discount_amount: number;
  item_discount: number; // Added
  gst_percent: number;
  status: string;
  payment_status: string;
  payment_due_date: string | null;
  dealers: {
    id: string;
    name: string;
    address: string;
    phone: string;
    city: string;
    state: string;
    country: string;
  } | null;
  user_id: string;
  bill_no: string | null;
  dispatch_date: string | null;
  dispatch_number: number | null;
  dispatched: boolean;
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
  }[] | null;
}

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
  const [companyName, setCompanyName] = useState<string | null>(null);

  const fetchCompanyInfo = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('company_info')
        .select('company_name')
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      setCompanyName(data?.company_name || null);
    } catch (error: any) {
      console.error('Error fetching company name:', error.message);
      setCompanyName(null);
    }
  }, []);

  const fetchOrderDetails = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          id, order_number, order_date, total_amount, discount_amount, item_discount, gst_percent, status, payment_status, payment_due_date, user_id, bill_no, dispatch_date, dispatch_number, dispatched,
          dealers (id, name, address, phone, city, state, country),
          payments (amount, payment_method, cheque_dd_no, cheque_dd_date, card_number, card_holder_name, expiry_date, cvv, bank_name, account_number, ifsc_code, upi_id, transaction_id, payment_date)
        `)
        .eq('id', id)
        .single() as { data: FetchedOrderData | null; error: any };

      if (orderError) throw orderError;
      if (!orderData) {
        showError('Order not found.');
        setOrderDetails(null);
        return;
      }

      let salesPersonName = 'N/A';
      if (orderData.user_id) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', orderData.user_id)
          .single();
        if (!profileError && profileData) {
          salesPersonName = `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim();
        }
      }

      const { data: salesItems, error: salesError } = await supabase
        .from('sales')
        .select(`quantity, total_price, products (name, dp, code, size, hsn, gst)`)
        .eq('order_id', id);

      if (salesError) throw salesError;

      const items: OrderItemDetail[] = (salesItems || []).map((item: any) => ({
        product_name: item.products?.name || 'N/A',
        quantity: item.quantity,
        unit_price: item.products?.dp || 0,
        total_price: item.total_price,
        product_code: item.products?.code || 'N/A',
        product_size: item.products?.size || 'N/A',
        product_hsn: item.products?.hsn || 'N/A',
        product_gst: item.products?.gst || 'N/A',
      }));

      const paymentInfo = orderData.payments && orderData.payments.length > 0 ? orderData.payments[0] : null;

      setOrderDetails({
        id: orderData.id,
        order_number: orderData.order_number,
        order_date: orderData.order_date,
        total_amount: orderData.total_amount,
        discount_amount: orderData.discount_amount || 0,
        item_discount: orderData.item_discount || 0, // Added
        gst_percent: orderData.gst_percent || 5,
        status: orderData.status,
        dealer_name: orderData.dealers?.name || 'N/A',
        dealer_address: orderData.dealers?.address || 'N/A',
        dealer_city: orderData.dealers?.city || 'N/A',
        dealer_state: orderData.dealers?.state || 'N/A',
        dealer_country: orderData.dealers?.country || 'N/A',
        dealer_phone: orderData.dealers?.phone || 'N/A',
        sales_person_name: salesPersonName,
        items: items,
        bill_no: orderData.bill_no,
        dispatch_date: orderData.dispatch_date,
        dispatch_number: orderData.dispatch_number,
        dispatched: orderData.dispatched,
        payment_status: orderData.payment_status,
        payment_due_date: orderData.payment_due_date,
        payment_method: paymentInfo?.payment_method || null,
        payment_amount: paymentInfo?.amount || null,
        cheque_dd_no: paymentInfo?.cheque_dd_no || null,
        cheque_dd_date: paymentInfo?.cheque_dd_date || null,
        card_number: paymentInfo?.card_number || null,
        card_holder_name: paymentInfo?.card_holder_name || null,
        expiry_date: paymentInfo?.expiry_date || null,
        cvv: paymentInfo?.cvv || null,
        bank_name: paymentInfo?.bank_name || null,
        account_number: paymentInfo?.account_number || null,
        ifsc_code: paymentInfo?.ifsc_code || null,
        upi_id: paymentInfo?.upi_id || null,
        transaction_id: paymentInfo?.transaction_id || null,
        payment_date: paymentInfo?.payment_date || null,
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
      fetchCompanyInfo();
    } else if (!isOpen) {
      setOrderDetails(null);
      setShowPaymentDetails(false);
      setCompanyName(null);
    }
  }, [isOpen, orderId, fetchOrderDetails, fetchCompanyInfo]);

  useEffect(() => {
    if (isOpen && orderDetails && shouldPrintOnLoad) {
      handlePrint();
      onOpenChange(false);
    }
  }, [isOpen, orderDetails, shouldPrintOnLoad, onOpenChange]);

  const renderPaymentDetails = (details: OrderDetail) => {
    if (details.payment_status !== 'paid' && details.payment_status !== 'pending_approval' || !details.payment_method) return null;
    return (
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Payment Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <p><strong>Payment Method:</strong> {details.payment_method || 'N/A'}</p>
            <p><strong>Amount:</strong> ₹{details.payment_amount?.toFixed(2) || 'N/A'}</p>
            <p><strong>Payment Date:</strong> {formatDate(details.payment_date)}</p>
          </div>
          {details.payment_method === 'Cheque/DD' && (
            <div>
              <p><strong>Cheque/DD No:</strong> {details.cheque_dd_no || 'N/A'}</p>
              <p><strong>Cheque/DD Date:</strong> {formatDate(details.cheque_dd_date)}</p>
            </div>
          )}
          {details.payment_method === 'Card' && (
            <div>
              <p><strong>Card Number:</strong> {details.card_number ? `**** **** **** ${details.card_number.slice(-4)}` : 'N/A'}</p>
              <p><strong>Card Holder:</strong> {details.card_holder_name || 'N/A'}</p>
              <p><strong>Expiry Date:</strong> {details.expiry_date || 'N/A'}</p>
              <p><strong>Transaction ID:</strong> {details.transaction_id || 'N/A'}</p>
            </div>
          )}
          {details.payment_method === 'Bank Transfer' && (
            <div>
              <p><strong>Bank Name:</strong> {details.bank_name || 'N/A'}</p>
              <p><strong>Account Number:</strong> {details.account_number ? `****${details.account_number.slice(-4)}` : 'N/A'}</p>
              <p><strong>IFSC Code:</strong> {details.ifsc_code || 'N/A'}</p>
              <p><strong>Transaction ID:</strong> {details.transaction_id || 'N/A'}</p>
            </div>
          )}
          {details.payment_method === 'UPI' && (
            <div>
              <p><strong>UPI ID:</strong> {details.upi_id || 'N/A'}</p>
              <p><strong>Transaction ID:</strong> {details.transaction_id || 'N/A'}</p>
            </div>
          )}
          {details.payment_method === 'Cash' && (
            <div>
              <p><strong>Transaction ID:</strong> {details.transaction_id || 'N/A'}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const handlePrint = () => {
    if (!orderDetails) { showError('No order details to print.'); return; }
    const LOGO_HEIGHT = 10; const LOGO_WIDTH = 10; const LOGO_PATH_FIGHTOR = '/logos/fightor_white_logo.png'; const LOGO_PATH_SPARTAN = '/logos/Spartan_white-removebg-preview.png';
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const margin = 10; let yPos = margin; const pageWidth = doc.internal.pageSize.width; const companyNameDisplay = companyName ? companyName.toUpperCase() : "COMPANY NAME"; const darkBlue: [number, number, number] = [30, 58, 138];
    const stripHeight = 15; const stripY = margin; const textCenterY = stripY + stripHeight / 2 + 1; const logoY = stripY + (stripHeight - LOGO_HEIGHT) / 2; const logoXLeft = margin + 2; const logoXRight = pageWidth - margin - LOGO_WIDTH - 2;
    doc.setFillColor(darkBlue[0], darkBlue[1], darkBlue[2]); doc.rect(0, stripY - 2, pageWidth, stripHeight, 'F');
    doc.addImage(LOGO_PATH_FIGHTOR, 'PNG', logoXLeft, logoY, LOGO_WIDTH, LOGO_HEIGHT); doc.addImage(LOGO_PATH_SPARTAN, 'PNG', logoXRight, logoY, LOGO_WIDTH, LOGO_HEIGHT);
    doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255); doc.text(companyNameDisplay, pageWidth / 2, textCenterY, { align: 'center' });
    yPos = stripY + stripHeight + 10; doc.setTextColor(0);

    if (orderDetails.dispatched) {
        doc.setFontSize(28); doc.text("GATE PASS", pageWidth / 2, yPos, { align: 'center' }); yPos += 12;
        doc.setFontSize(36); doc.text(`DISPATCH NO: ${orderDetails.dispatch_number || 'N/A'}`, pageWidth / 2, yPos, { align: 'center' }); yPos += 18;
        doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setFont("helvetica", "bold"); doc.text("Dispatch & Order Details:", margin, yPos); doc.setFont("helvetica", "normal"); yPos += 5;
        doc.text(`Order Number: ${orderDetails.order_number}`, margin, yPos); doc.text(`Bill Number: ${orderDetails.bill_no || 'N/A'}`, pageWidth / 2 + 10, yPos); yPos += 5;
        doc.text(`Dispatch Date: ${formatDate(orderDetails.dispatch_date)}`, margin, yPos); doc.text(`Order Date: ${formatDate(orderDetails.order_date)}`, pageWidth / 2 + 10, yPos); yPos += 8;
        doc.setFont("helvetica", "bold"); doc.text("Delivery To:", margin, yPos); doc.setFont("helvetica", "normal"); yPos += 5;
        doc.text(`Dealer Name: ${orderDetails.dealer_name}`, margin, yPos); yPos += 5; doc.text(`Address: ${orderDetails.dealer_address}`, margin, yPos); yPos += 5;
        doc.text(`${orderDetails.dealer_city}, ${orderDetails.dealer_state}, ${orderDetails.dealer_country}`, margin, yPos); yPos += 5; doc.text(`Phone: ${orderDetails.dealer_phone}`, margin, yPos); yPos += 8;
        doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text("Items Included:", margin, yPos); yPos += 5;
        const tableColumn = ["Code", "Product Name", "Size", "Qty"];
        const tableRows = orderDetails.items.map(item => [item.product_code, item.product_name, item.product_size, item.quantity.toString()]);
        autoTable(doc, { head: [tableColumn], body: tableRows, startY: yPos, styles: { fontSize: 10, cellPadding: 2, valign: 'middle', overflow: 'linebreak' }, headStyles: { fillColor: darkBlue, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' }, margin: { top: 0, left: margin, right: margin }, columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 100 }, 2: { cellWidth: 30 }, 3: { cellWidth: 30, halign: 'right' } } });
        yPos = (doc as any).lastAutoTable.finalY + 15; doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.line(margin, yPos, margin + 50, yPos); doc.line(pageWidth - margin - 50, yPos, pageWidth - margin, yPos);
        yPos += 5; doc.text("Authorized By (Admin)", margin, yPos); doc.text("Received By (Dealer/Transporter)", pageWidth - margin, yPos, { align: 'right' });
        yPos += 10; doc.setFontSize(8); doc.text(`Printed: ${new Date().toLocaleString()}`, margin, yPos);
        doc.save(`gate_pass_${orderDetails.dispatch_number}.pdf`); showSuccess('Gate Pass PDF generated successfully!'); return;
    }

    doc.setFontSize(14); doc.text("Order Details", pageWidth / 2, yPos, { align: 'center' }); yPos += 8;
    doc.setFontSize(8); doc.setTextColor(100); doc.text(`Generated on: ${new Date().toLocaleString()}`, pageWidth / 2, yPos, { align: 'center' }); yPos += 8;
    doc.setTextColor(0); doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text("Order Information:", margin, yPos); doc.setFont("helvetica", "normal"); yPos += 5;
    doc.text(`Order Number: ${orderDetails.order_number}`, margin, yPos); yPos += 5; doc.text(`Order Date: ${formatDate(orderDetails.order_date)}`, margin, yPos); yPos += 5;
    doc.text(`Order Status: ${orderDetails.status}`, margin, yPos); yPos += 5; doc.text(`Payment Status: ${orderDetails.payment_status.replace(/_/g, ' ').toUpperCase()}`, margin, yPos); yPos += 5;
    doc.text(`Payment Due Date: ${formatDate(orderDetails.payment_due_date)}`, margin, yPos); yPos += 5; doc.text(`Sales Person: ${orderDetails.sales_person_name}`, margin, yPos); yPos += 5;
    if (orderDetails.dispatched) { doc.text(`Dispatch Number: ${orderDetails.dispatch_number || 'N/A'}`, margin, yPos); yPos += 5; doc.text(`Dispatch Date: ${formatDate(orderDetails.dispatch_date)}`, margin, yPos); yPos += 5; doc.text(`Bill Number: ${orderDetails.bill_no || 'N/A'}`, margin, yPos); yPos += 5; }
    const rightColX = doc.internal.pageSize.width / 2 + 10; let dealerYPos = yPos - (orderDetails.dispatched ? 35 : 20); if (dealerYPos < (stripY + stripHeight + 10)) dealerYPos = stripY + stripHeight + 10;
    doc.setFont("helvetica", "bold"); doc.text("Dealer Information:", rightColX, dealerYPos); doc.setFont("helvetica", "normal"); dealerYPos += 5;
    doc.text(`Dealer Name: ${orderDetails.dealer_name}`, rightColX, dealerYPos); dealerYPos += 5; doc.text(`Address: ${orderDetails.dealer_address}`, rightColX, dealerYPos); dealerYPos += 5;
    doc.text(`${orderDetails.dealer_city}, ${orderDetails.dealer_state}, ${orderDetails.dealer_country}`, rightColX, dealerYPos); dealerYPos += 5; doc.text(`Phone: ${orderDetails.dealer_phone}`, rightColX, dealerYPos); dealerYPos += 5;
    yPos = Math.max(yPos, dealerYPos) + 10; doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text("Order Items:", margin, yPos); yPos += 5;
    const tableColumn = ["Code", "Product Name", "Size", "HSN", "GST (%)", "Qty", "Unit Price", "Total Price"];
    const tableRows = orderDetails.items.map(item => [item.product_code, item.product_name, item.product_size, item.product_hsn, item.product_gst, item.quantity.toString(), `Rs. ${item.unit_price.toFixed(2)}`, `Rs. ${item.total_price.toFixed(2)}`]);
    autoTable(doc, { head: [tableColumn], body: tableRows, startY: yPos, styles: { fontSize: 7, cellPadding: 1, valign: 'middle', overflow: 'linebreak', lineWidth: 0.1 }, headStyles: { fillColor: darkBlue, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', lineWidth: 0.1 }, bodyStyles: { textColor: [0, 0, 0] }, margin: { top: 0, left: margin, right: margin }, columnStyles: { 0: { halign: 'center' }, 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' }, 5: { halign: 'center' }, 6: { halign: 'center' }, 7: { halign: 'center' } } as any });
    yPos = (doc as any).lastAutoTable.finalY + 5;
    const preDiscountTotal = orderDetails.items.reduce((sum, item) => sum + item.total_price, 0);
    const summaryRows = [['Subtotal (Pre-Discount):', `Rs. ${preDiscountTotal.toFixed(2)}`, 10, 'normal'], ['Item Discount:', `- Rs. ${orderDetails.item_discount.toFixed(2)}`, 10, 'normal'], ['Extra Discount:', `- Rs. ${orderDetails.discount_amount.toFixed(2)}`, 10, 'bold'], ['GST Applied:', `+ ${orderDetails.gst_percent}%`, 10, 'normal'], ['Total Order Amount (Final):', `Rs. ${orderDetails.total_amount.toFixed(2)}`, 12, 'bold']];
    const summaryTableWidth = 90; const summaryTableX = pageWidth - margin - summaryTableWidth;
    autoTable(doc, { body: summaryRows.map(row => [row[0], row[1]]), startY: yPos, theme: 'plain', styles: { fontSize: 10, cellPadding: 1, valign: 'middle', overflow: 'linebreak', lineWidth: 0 }, columnStyles: { 0: { cellWidth: 40, halign: 'left', fontStyle: 'normal' }, 1: { cellWidth: 50, halign: 'right', fontStyle: 'bold' } }, margin: { top: 0, left: summaryTableX, right: margin }, didParseCell: (data) => { const rowIndex = data.row.index; if (rowIndex < summaryRows.length) { const rowData = summaryRows[rowIndex]; data.cell.styles.fontSize = rowData[2] as number; data.cell.styles.fontStyle = rowData[3] as 'normal' | 'bold' | 'italic' | 'bolditalic'; if (rowIndex === summaryRows.length - 1) { data.cell.styles.lineWidth = { top: 0.5 }; data.cell.styles.lineColor = [0, 0, 0]; } } } });
    yPos = (doc as any).lastAutoTable.finalY + 10;
    if (orderDetails.payment_status === 'paid' || orderDetails.payment_status === 'pending_approval') {
      doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text("Payment Details:", margin, yPos); doc.setFont("helvetica", "normal"); yPos += 5;
      const paymentDetailsLines = [`Payment Method: ${orderDetails.payment_method || 'N/A'}`, `Amount: Rs. ${orderDetails.payment_amount?.toFixed(2) || 'N/A'}`, `Payment Date: ${formatDate(orderDetails.payment_date)}` ];
      if (orderDetails.payment_method === 'Cheque/DD') { paymentDetailsLines.push(`Cheque/DD No: ${orderDetails.cheque_dd_no || 'N/A'}`, `Cheque/DD Date: ${formatDate(orderDetails.cheque_dd_date)}`); }
      if (orderDetails.payment_method === 'Card') { paymentDetailsLines.push(`Card Number: ${orderDetails.card_number ? `**** **** **** ${orderDetails.card_number.slice(-4)}` : 'N/A'}`, `Card Holder: ${orderDetails.card_holder_name || 'N/A'}`, `Expiry Date: ${orderDetails.expiry_date || 'N/A'}`, `Transaction ID: ${orderDetails.transaction_id || 'N/A'}`); }
      if (orderDetails.payment_method === 'Bank Transfer') { paymentDetailsLines.push(`Bank Name: ${orderDetails.bank_name || 'N/A'}`, `Account Number: ${orderDetails.account_number ? `****${orderDetails.account_number.slice(-4)}` : 'N/A'}`, `IFSC Code: ${orderDetails.ifsc_code || 'N/A'}`, `Transaction ID: ${orderDetails.transaction_id || 'N/A'}`); }
      if (orderDetails.payment_method === 'UPI') { paymentDetailsLines.push(`UPI ID: ${orderDetails.upi_id || 'N/A'}`, `Transaction ID: ${orderDetails.transaction_id || 'N/A'}`); }
      if (orderDetails.payment_method === 'Cash') { paymentDetailsLines.push(`Transaction ID: ${orderDetails.transaction_id || 'N/A'}`); }
      paymentDetailsLines.forEach(line => { if (yPos + 5 > doc.internal.pageSize.height - margin) { doc.addPage(); yPos = margin; } doc.text(line, margin, yPos); yPos += 5; });
    }
    doc.save(`order_${orderDetails.order_number}_details.pdf`); showSuccess('Order details PDF generated successfully!');
  };

  const preDiscountTotalDisplay = orderDetails?.items.reduce((sum, item) => sum + item.total_price, 0) || 0;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Order Details</DialogTitle>
          <DialogDescription>View the complete details of this order, including items and dealer credit information.</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading order details...</p></div>
        ) : orderDetails ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p><span className="font-semibold">Order Number:</span> {orderDetails.order_number}</p>
                <p><span className="font-semibold">Order Date:</span> {formatDate(orderDetails.order_date)}</p>
                <p><span className="font-semibold">Order Status:</span> {orderDetails.status}</p>
                <p><span className="font-semibold">Payment Status:</span> {orderDetails.payment_status}</p>
                <p><span className="font-semibold">Payment Due Date:</span> {formatDate(orderDetails.payment_due_date)}</p>
                <p><span className="font-semibold">Sales Person:</span> {orderDetails.sales_person_name}</p>
                {orderDetails.dispatched && (<><p><span className="font-semibold">Dispatch Number:</span> {orderDetails.dispatch_number || 'N/A'}</p><p><span className="font-semibold">Dispatch Date:</span> {formatDate(orderDetails.dispatch_date)}</p><p><span className="font-semibold">Bill Number:</span> {orderDetails.bill_no || 'N/A'}</p></>)}
              </div>
              <div>
                <p><span className="font-semibold">Dealer Name:</span> {orderDetails.dealer_name}</p>
                <p><span className="font-semibold">Address:</span> {orderDetails.dealer_address}, {orderDetails.dealer_city}, {orderDetails.dealer_state}, {orderDetails.dealer_country}</p>
                <p><span className="font-semibold">Phone:</span> {orderDetails.dealer_phone}</p>
              </div>
            </div>
            {(orderDetails.payment_status === 'paid' || orderDetails.payment_status === 'pending_approval') && orderDetails.payment_method && (
              <><Separator /><div className="flex justify-between items-center"><h3 className="text-lg font-semibold">Payment Details</h3><Button variant="outline" size="sm" onClick={() => setShowPaymentDetails(!showPaymentDetails)} className="flex items-center gap-1"><Eye className="h-4 w-4" />{showPaymentDetails ? 'Hide Details' : 'View Details'}</Button></div>{showPaymentDetails && (<div className="p-3 bg-muted rounded-md">{renderPaymentDetails(orderDetails)}</div>)}</>
            )}
            <Separator />
            <h3 className="text-lg font-semibold">Order Items</h3>
            {orderDetails.items.length === 0 ? (<p className="text-muted-foreground">No items found for this order.</p>) : (
              <div className="max-h-[200px] overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10"><TableRow><TableHead>Code</TableHead><TableHead>Product Name</TableHead><TableHead>Size</TableHead><TableHead>HSN</TableHead><TableHead className="text-right">GST (%)</TableHead><TableHead className="text-right">Quantity</TableHead><TableHead className="text-right">Unit Price</TableHead><TableHead className="text-right">Total Price</TableHead></TableRow></TableHeader>
                  <TableBody>{orderDetails.items.map((item, index) => (<TableRow key={index}><TableCell>{item.product_code}</TableCell><TableCell>{item.product_name}</TableCell><TableCell>{item.product_size}</TableCell><TableCell>{item.product_hsn}</TableCell><TableCell className="text-right">{item.product_gst}</TableCell><TableCell className="text-right">{item.quantity}</TableCell><TableCell className="text-right">₹{item.unit_price.toFixed(2)}</TableCell><TableCell className="text-right">₹{item.total_price.toFixed(2)}</TableCell></TableRow>))}</TableBody>
                </Table>
              </div>
            )}
            <div className="text-right text-sm font-medium mt-4">Subtotal (Pre-Discount): ₹{preDiscountTotalDisplay.toFixed(2)}</div>
            <div className="text-right text-sm font-medium">Item Discount: - ₹{orderDetails.item_discount.toFixed(2)}</div>
            <div className="text-right text-sm font-medium">Extra Discount: - ₹{orderDetails.discount_amount.toFixed(2)}</div>
            <div className="text-right text-sm font-medium">GST Applied: + {orderDetails.gst_percent}%</div>
            <div className="text-right text-lg font-bold mt-1">Total Order Amount (Final): ₹{orderDetails.total_amount.toFixed(2)}</div>
          </div>
        ) : (<p className="text-center text-muted-foreground py-8">No order selected or details could not be loaded.</p>)}
        <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-4"><Button variant="outline" onClick={handlePrint} disabled={!orderDetails || loading}><Printer className="mr-2 h-4 w-4" /> {orderDetails?.dispatched ? 'Print Gate Pass' : 'Print Receipt'}</Button><Button onClick={() => onOpenChange(false)}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OrderDetailsDialog;