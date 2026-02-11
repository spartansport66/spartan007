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
  unit_price: number;
  total_price: number;
  product_code: string;
  product_size: string;
  product_hsn: string;
  product_gst: string;
  discount_percent: number;
}

interface OrderDetail {
  id: string;
  order_number: number;
  order_date: string;
  total_amount: number;
  discount_amount: number;
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
      const { data, error } = await supabase.from('company_info').select('company_name').limit(1).single();
      if (error && error.code !== 'PGRST116') throw error;
      setCompanyName(data?.company_name || null);
    } catch (error: any) {
      console.error('Error fetching company name:', error.message);
    }
  }, []);

  const fetchOrderDetails = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          id, order_number, order_date, total_amount, discount_amount, status, payment_status, payment_due_date, user_id, bill_no, dispatch_date, dispatch_number, dispatched,
          dealers (id, name, address, phone, city, state, country),
          payments (amount, payment_method, cheque_dd_no, cheque_dd_date, card_number, card_holder_name, expiry_date, cvv, bank_name, account_number, ifsc_code, upi_id, transaction_id, payment_date)
        `)
        .eq('id', id)
        .single();

      if (orderError) throw orderError;

      let salesPersonName = 'N/A';
      if (orderData.user_id) {
        const { data: profileData } = await supabase.from('profiles').select('first_name, last_name').eq('id', orderData.user_id).single();
        if (profileData) salesPersonName = `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim();
      }

      const { data: salesItems, error: salesError } = await supabase
        .from('sales')
        .select(`quantity, total_price, unit_price, discount_percent, gst_percent, products (name, code, size, hsn, gst)`)
        .eq('order_id', id);

      if (salesError) throw salesError;

      const items: OrderItemDetail[] = (salesItems || []).map((item: any) => ({
        product_name: item.products?.name || 'N/A',
        quantity: item.quantity,
        unit_price: item.unit_price || 0,
        total_price: item.total_price,
        product_code: item.products?.code || 'N/A',
        product_size: item.products?.size || 'N/A',
        product_hsn: item.products?.hsn || 'N/A',
        product_gst: item.gst_percent?.toString() || item.products?.gst || '0',
        discount_percent: item.discount_percent || 0,
      }));

      const paymentInfo = orderData.payments && orderData.payments.length > 0 ? orderData.payments[0] : null;
      const dealer = (orderData.dealers as any);

      setOrderDetails({
        id: orderData.id,
        order_number: orderData.order_number,
        order_date: orderData.order_date,
        total_amount: orderData.total_amount,
        discount_amount: orderData.discount_amount || 0,
        status: orderData.status,
        dealer_name: dealer?.name || 'N/A',
        dealer_address: dealer?.address || 'N/A',
        dealer_city: dealer?.city || 'N/A',
        dealer_state: dealer?.state || 'N/A',
        dealer_country: dealer?.country || 'N/A',
        dealer_phone: dealer?.phone || 'N/A',
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
      showError(`Failed to load order details: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && orderId) {
      fetchOrderDetails(orderId);
      fetchCompanyInfo();
    }
  }, [isOpen, orderId, fetchOrderDetails, fetchCompanyInfo]);

  const handlePrint = () => {
    if (!orderDetails) return;
    const doc = new jsPDF();
    const margin = 15;
    const pageWidth = doc.internal.pageSize.width;
    const darkBlue: [number, number, number] = [30, 58, 138];

    // 1. Gate Pass Number at Top Center (Larger)
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    const dispatchText = `Gate Pass: ${orderDetails.dispatch_number || 'N/A'}`;
    doc.text(dispatchText, pageWidth / 2, 15, { align: 'center' });

    // 2. Company Header
    doc.setFillColor(darkBlue[0], darkBlue[1], darkBlue[2]);
    doc.rect(0, 22, pageWidth, 12, 'F');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text(companyName?.toUpperCase() || "DISPATCH SLIP", pageWidth / 2, 30, { align: 'center' });
    
    // 3. Party and Order Details
    doc.setTextColor(0);
    doc.setFontSize(10);
    let y = 45;
    
    // Left Column: Party Details
    doc.setFont("helvetica", "bold");
    doc.text("PARTY DETAILS:", margin, y);
    doc.setFont("helvetica", "normal");
    y += 5;
    doc.text(orderDetails.dealer_name, margin, y);
    y += 5;
    const addressLines = doc.splitTextToSize(
      `${orderDetails.dealer_address}, ${orderDetails.dealer_city}, ${orderDetails.dealer_state}`,
      pageWidth / 2 - margin
    );
    doc.text(addressLines, margin, y);
    
    // Right Column: Order Details
    let rightY = 45;
    const rightColX = pageWidth / 2 + 10;
    doc.setFont("helvetica", "bold");
    doc.text("ORDER DETAILS:", rightColX, rightY);
    doc.setFont("helvetica", "normal");
    rightY += 5;
    doc.text(`Order No: #${orderDetails.order_number}`, rightColX, rightY);
    rightY += 5;
    doc.text(`Bill No: ${orderDetails.bill_no || 'N/A'}`, rightColX, rightY);
    rightY += 5;
    doc.text(`Date: ${formatDate(orderDetails.order_date)}`, rightColX, rightY);

    y = Math.max(y + (addressLines.length * 5), rightY + 10);

    // 4. Simplified Item Table (Code, Product, Qty)
    const tableColumn = ["Code", "Product Name", "Quantity"];
    const tableRows = orderDetails.items.map(item => [
      item.product_code,
      item.product_name,
      item.quantity.toString()
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: y,
      headStyles: { fillColor: darkBlue, halign: 'center' },
      columnStyles: {
        0: { cellWidth: 40, halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 30, halign: 'center' }
      },
      styles: { fontSize: 9, cellPadding: 3 }
    });

    // 5. Footer: Total Bill Amount Only
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`TOTAL BILL AMOUNT: Rs. ${orderDetails.total_amount.toFixed(2)}`, pageWidth - margin, finalY, { align: 'right' });

    // Updated filename to use Gate Pass number
    const fileName = `Gate_Pass_${orderDetails.dispatch_number || orderDetails.order_number}.pdf`;
    doc.save(fileName);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Order Details #{orderDetails?.order_number}</DialogTitle>
          <DialogDescription>Item-wise GST calculation applied after discounts.</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : orderDetails ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p><strong>Dealer:</strong> {orderDetails.dealer_name}</p>
                <p><strong>Date:</strong> {formatDate(orderDetails.order_date)}</p>
              </div>
              <div className="text-right">
                <p><strong>Status:</strong> {orderDetails.status}</p>
                <p><strong>Payment:</strong> {orderDetails.payment_status}</p>
              </div>
            </div>
            <Separator />
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">DP</TableHead>
                    <TableHead className="text-right">Disc %</TableHead>
                    <TableHead className="text-right">GST %</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderDetails.items.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{item.product_name} ({item.product_code})</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">₹{item.unit_price.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{item.discount_percent}%</TableCell>
                      <TableCell className="text-right">{item.product_gst}%</TableCell>
                      <TableCell className="text-right font-medium">₹{item.total_price.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="text-right space-y-1">
              {orderDetails.discount_amount > 0 && (
                <p className="text-sm text-muted-foreground">Global Discount: -₹{orderDetails.discount_amount.toFixed(2)}</p>
              )}
              <p className="text-lg font-bold">Final Total: ₹{orderDetails.total_amount.toFixed(2)}</p>
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={handlePrint} disabled={!orderDetails}>
            <Printer className="mr-2 h-4 w-4" /> Print Dispatch Slip
          </Button>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OrderDetailsDialog;