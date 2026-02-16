"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Loader2, Printer, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
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

interface OnlineOrderInfo {
  client_name: string;
  platform_name: string;
  platform_order_number: string | null;
  contact_no: string | null;
  city: string | null;
  state: string | null;
  address: string | null; // Added address field
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
  online_order_details?: OnlineOrderInfo | null;
}

interface OrderDetailsDialogProps {
  orderId: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onPrint?: (orderId: string) => void;
  showGatePassButton?: boolean;
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
  onPrint,
  showGatePassButton = true,
}) => {
  const [orderDetails, setOrderDetails] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
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
          id, order_number, order_date, total_amount, discount_amount, status, payment_status, user_id, bill_no, dispatch_date, dispatch_number, dispatched,
          dealers (id, name, address, phone, city, state, country)
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
        .select(`
          quantity, 
          total_price, 
          unit_price, 
          discount_percent, 
          gst_percent, 
          products (name, code, size, hsn, gst, dp)
        `)
        .eq('order_id', id);

      if (salesError) throw salesError;

      const items: OrderItemDetail[] = (salesItems || []).map((item: any) => {
        const unitPrice = item.unit_price || item.products?.dp || 0;
        const discountPercent = item.discount_percent || 0;
        
        return {
          product_name: item.products?.name || 'N/A',
          quantity: item.quantity,
          unit_price: unitPrice,
          total_price: item.total_price,
          product_code: item.products?.code || 'N/A',
          product_size: item.products?.size || 'N/A',
          product_hsn: item.products?.hsn || 'N/A',
          product_gst: item.gst_percent?.toString() || item.products?.gst || '0',
          discount_percent: discountPercent,
        };
      });

      const dealer = (orderData.dealers as any);
      
      let onlineOrderDetails: OnlineOrderInfo | null = null;
      if (dealer?.name === 'Online Order') {
        const { data: onlineData, error: onlineError } = await supabase
          .from('online_order_details')
          .select(`
            client_name,
            platform_order_number,
            contact_no,
            city,
            state,
            address,
            online_platforms (name)
          `)
          .eq('order_id', id)
          .single();
        
        if (onlineError && onlineError.code !== 'PGRST116') {
          console.error("Error fetching online order details:", onlineError);
        } else if (onlineData) {
          onlineOrderDetails = {
            client_name: onlineData.client_name,
            platform_name: (onlineData.online_platforms as any)?.name || 'N/A',
            platform_order_number: onlineData.platform_order_number,
            contact_no: onlineData.contact_no,
            city: onlineData.city,
            state: onlineData.state,
            address: onlineData.address,
          };
        }
      }

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
        online_order_details: onlineOrderDetails,
      });
    } catch (error: any) {
      console.error('Error fetching order details:', error);
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

  const handlePrintGatePass = () => {
    if (!orderDetails) return;
    const doc = new jsPDF();
    const margin = 15;
    const pageWidth = doc.internal.pageSize.width;
    const darkBlue: [number, number, number] = [30, 58, 138];

    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text(`Gate Pass: ${orderDetails.dispatch_number || 'N/A'}`, pageWidth / 2, 15, { align: 'center' });

    doc.setFillColor(darkBlue[0], darkBlue[1], darkBlue[2]);
    doc.rect(0, 22, pageWidth, 12, 'F');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text(companyName?.toUpperCase() || "DISPATCH SLIP", pageWidth / 2, 30, { align: 'center' });
    
    doc.setTextColor(0);
    doc.setFontSize(10);
    let y = 45;
    
    const isOnline = orderDetails.online_order_details;
    const partyName = isOnline ? orderDetails.online_order_details!.client_name : orderDetails.dealer_name;
    
    let partyAddress = "";
    if (isOnline) {
      partyAddress = orderDetails.online_order_details!.address || 
                     `${orderDetails.online_order_details!.city || ''}, ${orderDetails.online_order_details!.state || ''}`.trim();
    } else {
      partyAddress = `${orderDetails.dealer_address}, ${orderDetails.dealer_city}, ${orderDetails.dealer_state}`;
    }

    doc.setFont("helvetica", "bold");
    doc.text("PARTY DETAILS:", margin, y);
    doc.setFont("helvetica", "normal");
    y += 5;
    doc.text(partyName, margin, y);
    y += 5;
    const addressLines = doc.splitTextToSize(partyAddress, pageWidth / 2 - margin);
    doc.text(addressLines, margin, y);
    
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

    if (isOnline) {
      rightY += 5;
      doc.text(`Platform: ${orderDetails.online_order_details!.platform_name}`, rightColX, rightY);
      rightY += 5;
      doc.text(`Platform Order #: ${orderDetails.online_order_details!.platform_order_number || 'N/A'}`, rightColX, rightY);
    }

    y = Math.max(y + (addressLines.length * 5), rightY + 10);

    const tableColumn = ["Code", "Product Name", "Quantity"];
    const tableRows = orderDetails.items.map(item => [item.product_code, item.product_name, item.quantity.toString()]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: y,
      headStyles: { fillColor: darkBlue, halign: 'center' },
      columnStyles: { 0: { cellWidth: 40, halign: 'center' }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 30, halign: 'center' } },
      styles: { fontSize: 9, cellPadding: 3 }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`TOTAL BILL AMOUNT: Rs. ${orderDetails.total_amount.toFixed(2)}`, pageWidth / 2, finalY, { align: 'center' });

    const gatePassNo = orderDetails.dispatch_number || 'NA';
    const orderNo = orderDetails.order_number || 'NA';
    const billNo = (orderDetails.bill_no || 'NA').replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `GatePass_${gatePassNo}_Order_${orderNo}_Bill_${billNo}.pdf`;
    doc.save(fileName);
    if (onPrint) {
      onPrint(orderDetails.id);
    }
  };

  const handlePrintOrderDetails = () => {
    if (!orderDetails) return;
    const doc = new jsPDF();
    const margin = 15;
    const pageWidth = doc.internal.pageSize.width;
    const darkBlue: [number, number, number] = [30, 58, 138];

    doc.setFillColor(darkBlue[0], darkBlue[1], darkBlue[2]);
    doc.rect(0, 10, pageWidth, 15, 'F');
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text(companyName?.toUpperCase() || "ORDER INVOICE", pageWidth / 2, 20, { align: 'center' });

    doc.setTextColor(0);
    doc.setFontSize(10);
    let y = 35;
    
    const isOnline = orderDetails.online_order_details;
    const partyName = isOnline ? orderDetails.online_order_details!.client_name : orderDetails.dealer_name;
    
    let partyAddress = "";
    if (isOnline) {
      partyAddress = orderDetails.online_order_details!.address || 
                     `${orderDetails.online_order_details!.city || ''}, ${orderDetails.online_order_details!.state || ''}`.trim();
    } else {
      partyAddress = `${orderDetails.dealer_address}, ${orderDetails.dealer_city}, ${orderDetails.dealer_state}`;
    }
    
    const partyPhone = isOnline ? orderDetails.online_order_details!.contact_no : orderDetails.dealer_phone;

    doc.setFont("helvetica", "bold");
    doc.text("PARTY DETAILS:", margin, y);
    doc.setFont("helvetica", "normal");
    y += 5;
    doc.text(partyName, margin, y);
    y += 5;
    const addressLines = doc.splitTextToSize(partyAddress, pageWidth / 2 - margin);
    doc.text(addressLines, margin, y);
    
    let rightY = 35;
    const rightColX = pageWidth / 2 + 10;
    doc.setFont("helvetica", "bold");
    doc.text("ORDER SUMMARY:", rightColX, rightY);
    doc.setFont("helvetica", "normal");
    rightY += 5;
    doc.text(`Order No: #${orderDetails.order_number}`, rightColX, rightY);
    rightY += 5;
    doc.text(`Date: ${formatDate(orderDetails.order_date)}`, rightColX, rightY);
    rightY += 5;
    doc.text(`Phone: ${partyPhone || 'N/A'}`, rightColX, rightY);

    if (isOnline) {
      rightY += 5;
      doc.text(`Platform: ${orderDetails.online_order_details!.platform_name}`, rightColX, rightY);
      rightY += 5;
      doc.text(`Platform Order #: ${orderDetails.online_order_details!.platform_order_number || 'N/A'}`, rightColX, rightY);
    }

    y = Math.max(y + (addressLines.length * 5), rightY + 10);

    const tableColumn = ["Code", "Product", "Qty", "Unit Price", "Disc %", "GST %", "Total"];
    const tableRows = orderDetails.items.map(item => [
      item.product_code,
      item.product_name,
      item.quantity.toString(),
      `₹${item.unit_price.toFixed(2)}`,
      `${item.discount_percent}%`,
      `${item.product_gst}%`,
      `₹${item.total_price.toFixed(2)}`
    ]);

    autoTable(doc, { 
      head: [tableColumn], 
      body: tableRows, 
      startY: y, 
      headStyles: { fillColor: darkBlue, halign: 'center', fontSize: 8 }, 
      columnStyles: {
        0: { cellWidth: 20, halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 15, halign: 'center' },
        3: { cellWidth: 25, halign: 'right' },
        4: { cellWidth: 15, halign: 'center' },
        5: { cellWidth: 15, halign: 'center' },
        6: { cellWidth: 25, halign: 'right' }
      },
      styles: { fontSize: 8, cellPadding: 2 } 
    });
    
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    const subtotal = orderDetails.items.reduce((sum, s) => sum + s.total_price, 0);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Subtotal: ₹${subtotal.toFixed(2)}`, pageWidth / 2, finalY, { align: 'center' });
    
    let currentY = finalY;
    if (orderDetails.discount_amount > 0) {
      currentY += 5;
      doc.text(`Global Discount: -₹${orderDetails.discount_amount.toFixed(2)}`, pageWidth / 2, currentY, { align: 'center' });
    }
    
    currentY += 7;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`FINAL TOTAL: ₹${orderDetails.total_amount.toFixed(2)}`, pageWidth / 2, currentY, { align: 'center' });

    doc.save(`Order_Details_${orderDetails.order_number}.pdf`);
    if (onPrint) {
      onPrint(orderDetails.id);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Order Details #{orderDetails?.order_number}</DialogTitle>
          <DialogDescription>View full order information and items.</DialogDescription>
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
            {orderDetails.online_order_details && (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md space-y-1 text-sm">
                <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">Online Order Details</h4>
                <p><strong>Client Name:</strong> {orderDetails.online_order_details.client_name}</p>
                <p><strong>Platform:</strong> {orderDetails.online_order_details.platform_name}</p>
                <p><strong>Platform Order #:</strong> {orderDetails.online_order_details.platform_order_number || 'N/A'}</p>
                <p><strong>Contact:</strong> {orderDetails.online_order_details.contact_no || 'N/A'}</p>
                <p><strong>Address:</strong> {orderDetails.online_order_details.address || `${orderDetails.online_order_details.city || ''}, ${orderDetails.online_order_details.state || ''}`.trim() || 'N/A'}</p>
              </div>
            )}
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
        <DialogFooter className="flex flex-wrap gap-2">
          {showGatePassButton && (
            <Button variant="outline" onClick={handlePrintGatePass} disabled={!orderDetails}>
              <Printer className="mr-2 h-4 w-4" /> Print Gate Pass
            </Button>
          )}
          <Button variant="outline" onClick={handlePrintOrderDetails} disabled={!orderDetails}>
            <FileText className="mr-2 h-4 w-4" /> Print Order Details
          </Button>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OrderDetailsDialog;