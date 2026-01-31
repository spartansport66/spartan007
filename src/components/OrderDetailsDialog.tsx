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
  discount_amount: number; // NEW: Discount amount
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
  discount_amount: number; // NEW: Discount amount
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
  const [companyName, setCompanyName] = useState<string | null>(null); // New state for company name

  const fetchCompanyInfo = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('company_info')
        .select('company_name')
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      setCompanyName(data?.company_name || null);
    } catch (error: any) {
      console.error('Error fetching company name for PDF:', error.message);
      setCompanyName(null);
    }
  }, []);

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
          discount_amount,
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
        discount_amount: orderData.discount_amount || 0, // NEW: Discount amount
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
      fetchCompanyInfo(); // Fetch company info when dialog opens
    } else if (!isOpen) {
      setOrderDetails(null); // Clear details when dialog closes
      setShowPaymentDetails(false); // Reset payment details view
      setCompanyName(null); // Clear company name
    }
  }, [isOpen, orderId, fetchOrderDetails, fetchCompanyInfo]);

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
    if (!orderDetails) {
      showError('No order details to print.');
      return;
    }

    // Define logo constants
    const LOGO_HEIGHT = 10;
    const LOGO_WIDTH = 10; 
    const LOGO_PATH_FIGHTOR = '/logos/fightor_white_logo.png';
    const LOGO_PATH_SPARTAN = '/logos/spartan_white.jpeg'; // UPDATED PATH
    
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const margin = 10;
    let yPos = margin;
    const pageWidth = doc.internal.pageSize.width;
    const companyNameDisplay = companyName ? companyName.toUpperCase() : "COMPANY NAME";
    const darkBlue = [30, 58, 138]; // Dark Blue (Indigo-800 equivalent)

    // Check if the order is dispatched and we should print a simplified Gate Pass
    if (orderDetails.dispatched) {
        // --- GATE PASS PRINT LOGIC ---
        
        // --- Company Name Strip ---
        const stripHeight = 15; // Increased height
        const stripY = margin;
        const textCenterY = stripY + stripHeight / 2 + 1; 
        const logoY = stripY + (stripHeight - LOGO_HEIGHT) / 2; 
        const logoXLeft = margin + 2;
        const logoXRight = pageWidth - margin - LOGO_WIDTH - 2;

        // Draw dark blue background strip
        doc.setFillColor(...darkBlue);
        doc.rect(0, stripY - 2, pageWidth, stripHeight, 'F'); 

        // Add Logos (Left and Right)
        doc.addImage(LOGO_PATH_FIGHTOR, 'PNG', logoXLeft, logoY, LOGO_WIDTH, LOGO_HEIGHT);
        doc.addImage(LOGO_PATH_SPARTAN, 'JPEG', logoXRight, logoY, LOGO_WIDTH, LOGO_HEIGHT); // Use JPEG type

        // Company Name Text
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255); // White text
        doc.text(companyNameDisplay, pageWidth / 2, textCenterY, { align: 'center' });
        
        yPos = stripY + stripHeight + 10; // Start next element below the strip + 10mm space
        doc.setTextColor(0); // Reset text color to black
        // --- End Company Name Strip ---

        // Gate Pass Title (Big Bold)
        doc.setFontSize(28);
        doc.text("GATE PASS", pageWidth / 2, yPos, { align: 'center' });
        yPos += 12;

        // Dispatch Number (Big Bold)
        doc.setFontSize(36);
        doc.text(`DISPATCH NO: ${orderDetails.dispatch_number || 'N/A'}`, pageWidth / 2, yPos, { align: 'center' });
        yPos += 18;

        doc.setTextColor(0); // Reset text color to black
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");

        // Dispatch/Order Info (Simplified)
        doc.setFont("helvetica", "bold");
        doc.text("Dispatch & Order Details:", margin, yPos);
        doc.setFont("helvetica", "normal");
        yPos += 5;
        doc.text(`Order Number: ${orderDetails.order_number}`, margin, yPos);
        doc.text(`Bill Number: ${orderDetails.bill_no || 'N/A'}`, pageWidth / 2 + 10, yPos);
        yPos += 5;
        doc.text(`Dispatch Date: ${formatDate(orderDetails.dispatch_date)}`, margin, yPos);
        doc.text(`Order Date: ${formatDate(orderDetails.order_date)}`, pageWidth / 2 + 10, yPos);
        yPos += 8;

        // Dealer Information
        doc.setFont("helvetica", "bold");
        doc.text("Delivery To:", margin, yPos);
        doc.setFont("helvetica", "normal");
        yPos += 5;
        doc.text(`Dealer Name: ${orderDetails.dealer_name}`, margin, yPos);
        yPos += 5;
        doc.text(`Address: ${orderDetails.dealer_address}`, margin, yPos);
        yPos += 5;
        doc.text(`${orderDetails.dealer_city}, ${orderDetails.dealer_state}, ${orderDetails.dealer_country}`, margin, yPos);
        yPos += 5;
        doc.text(`Phone: ${orderDetails.dealer_phone}`, margin, yPos);
        yPos += 8;

        // Order Items Table
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Items Included:", margin, yPos);
        yPos += 5;

        const tableColumn = [
            "Code", "Product Name", "Size", "Qty"
        ];
        const tableRows = orderDetails.items.map(item => [
            item.product_code,
            item.product_name,
            item.product_size,
            item.quantity.toString(),
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: yPos,
            styles: {
                fontSize: 10,
                cellPadding: 2,
                valign: 'middle',
                overflow: 'linebreak'
            },
            headStyles: {
                fillColor: darkBlue, // Use dark blue header
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'center',
            },
            margin: { top: 0, left: margin, right: margin },
            columnStyles: {
                0: { cellWidth: 30 }, // Code
                1: { cellWidth: 50 }, // Product Name
                2: { cellWidth: 30 }, // Size
                3: { cellWidth: 30, halign: 'right' }, // Quantity
            }
        });

        yPos = (doc as any).lastAutoTable.finalY + 15; // Increased space before signatures

        // Signature lines
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        
        // Draw lines for signatures
        doc.line(margin, yPos, margin + 50, yPos);
        doc.line(pageWidth - margin - 50, yPos, pageWidth - margin, yPos);
        
        yPos += 5;
        doc.text("Authorized By (Admin)", margin, yPos);
        doc.text("Received By (Dealer/Transporter)", pageWidth - margin, yPos, { align: 'right' });
        
        yPos += 10;
        doc.setFontSize(8);
        doc.text(`Printed: ${new Date().toLocaleString()}`, margin, yPos);
        
        doc.save(`gate_pass_${orderDetails.dispatch_number}.pdf`);
        showSuccess('Gate Pass PDF generated successfully!');
        return; // Exit the function after printing Gate Pass
    }

    // --- DETAILED ORDER RECEIPT PRINT LOGIC (Fallback for non-dispatched or if needed) ---
    
    // Adjust yPos to accommodate logos (using 15mm center line)
    yPos = margin + 5; // 15mm center line
    const logoYDetailed = yPos - LOGO_HEIGHT / 2; // 10mm
    const logoXLeft = margin + 2;
    const logoXRight = pageWidth - margin - LOGO_WIDTH - 2;

    // Company Name
    doc.setFontSize(18);
    doc.text(companyNameDisplay, doc.internal.pageSize.width / 2, yPos, { align: 'center' });
    
    // Add Logos (Left and Right)
    doc.addImage(LOGO_PATH_FIGHTOR, 'PNG', logoXLeft, logoYDetailed, LOGO_WIDTH, LOGO_HEIGHT);
    doc.addImage(LOGO_PATH_SPARTAN, 'JPEG', logoXRight, logoYDetailed, LOGO_WIDTH, LOGO_HEIGHT); // Use JPEG type

    yPos += 15; // Increased space below logo/company name

    // Report Title
    doc.setFontSize(14);
    doc.text("Order Details", doc.internal.pageSize.width / 2, yPos, { align: 'center' });
    yPos += 8;

    // Generated Date
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, doc.internal.pageSize.width / 2, yPos, { align: 'center' });
    yPos += 8;

    doc.setTextColor(0); // Reset text color to black

    // Order Information (Left Column)
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Order Information:", margin, yPos);
    doc.setFont("helvetica", "normal");
    yPos += 5;
    doc.text(`Order Number: ${orderDetails.order_number}`, margin, yPos);
    yPos += 5;
    doc.text(`Order Date: ${formatDate(orderDetails.order_date)}`, margin, yPos);
    yPos += 5;
    doc.text(`Order Status: ${orderDetails.status}`, margin, yPos);
    yPos += 5;
    doc.text(`Payment Status: ${orderDetails.payment_status.replace(/_/g, ' ').toUpperCase()}`, margin, yPos);
    yPos += 5;
    doc.text(`Payment Due Date: ${formatDate(orderDetails.payment_due_date)}`, margin, yPos);
    yPos += 5;
    doc.text(`Sales Person: ${orderDetails.sales_person_name}`, margin, yPos);
    yPos += 5;

    if (orderDetails.dispatched) {
      doc.text(`Dispatch Number: ${orderDetails.dispatch_number || 'N/A'}`, margin, yPos);
      yPos += 5;
      doc.text(`Dispatch Date: ${formatDate(orderDetails.dispatch_date)}`, margin, yPos);
      yPos += 5;
      doc.text(`Bill Number: ${orderDetails.bill_no || 'N/A'}`, margin, yPos);
      yPos += 5;
    }

    // Dealer Information (Right Column)
    const rightColX = doc.internal.pageSize.width / 2 + 10;
    let dealerYPos = yPos - (orderDetails.dispatched ? 35 : 20); // Align with order info
    if (dealerYPos < (margin + 20)) dealerYPos = margin + 20; // Ensure it doesn't go too high

    doc.setFont("helvetica", "bold");
    doc.text("Dealer Information:", rightColX, dealerYPos);
    doc.setFont("helvetica", "normal");
    dealerYPos += 5;
    doc.text(`Dealer Name: ${orderDetails.dealer_name}`, rightColX, dealerYPos);
    dealerYPos += 5;
    doc.text(`Address: ${orderDetails.dealer_address}`, rightColX, dealerYPos);
    dealerYPos += 5;
    doc.text(`${orderDetails.dealer_city}, ${orderDetails.dealer_state}, ${orderDetails.dealer_country}`, rightColX, dealerYPos);
    dealerYPos += 5;
    doc.text(`Phone: ${orderDetails.dealer_phone}`, rightColX, dealerYPos);
    dealerYPos += 5;

    yPos = Math.max(yPos, dealerYPos) + 10; // Ensure next section starts below both columns

    // Order Items Table
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Order Items:", margin, yPos);
    yPos += 5;

    const tableColumn = [
      "Code", "Product Name", "Size", "HSN", "GST (%)", "Qty", "Unit Price", "Total Price"
    ];
    const tableRows = orderDetails.items.map(item => [
      item.product_code,
      item.product_name,
      item.product_size,
      item.product_hsn,
      item.product_gst,
      item.quantity.toString(),
      `₹${item.unit_price.toFixed(2)}`,
      `₹${item.total_price.toFixed(2)}`,
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: yPos,
      styles: {
        fontSize: 7,
        cellPadding: 1,
        valign: 'middle',
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [30, 58, 138], // Dark blue
        textColor: [255, 255, 255], // White
        fontStyle: 'bold',
        halign: 'center',
      },
      bodyStyles: {
        textColor: [0, 0, 0],
      },
      margin: { top: 0, left: margin, right: margin },
      columnStyles: {
        0: { cellWidth: 18 }, // Code
        1: { cellWidth: 35 }, // Product Name
        2: { cellWidth: 18 }, // Size
        3: { cellWidth: 18 }, // HSN
        4: { cellWidth: 18, halign: 'right' }, // GST (%)
        5: { cellWidth: 12, halign: 'right' }, // Quantity
        6: { cellWidth: 20, halign: 'right' }, // Unit Price
        7: { cellWidth: 25, halign: 'right' }, // Total Price
      }
    });

    yPos = (doc as any).lastAutoTable.finalY + 5;

    // Subtotal (Pre-Discount)
    const preDiscountTotal = orderDetails.items.reduce((sum, item) => sum + item.total_price, 0);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Subtotal (Pre-Discount): ₹${preDiscountTotal.toFixed(2)}`, doc.internal.pageSize.width - margin, yPos, { align: 'right' });
    yPos += 5;

    // Discount Amount
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`Discount Applied: - ₹${orderDetails.discount_amount.toFixed(2)}`, doc.internal.pageSize.width - margin, yPos, { align: 'right' });
    yPos += 5;

    // Total Order Amount (Final)
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`Total Order Amount (Final): ₹${orderDetails.total_amount.toFixed(2)}`, doc.internal.pageSize.width - margin, yPos, { align: 'right' });
    yPos += 10;

    // Payment Details Section
    if (orderDetails.payment_status === 'paid' || orderDetails.payment_status === 'pending_approval') {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Payment Details:", margin, yPos);
      doc.setFont("helvetica", "normal");
      yPos += 5;

      const paymentDetailsLines = [
        `Payment Method: ${orderDetails.payment_method || 'N/A'}`,
        `Amount: ₹${orderDetails.payment_amount?.toFixed(2) || 'N/A'}`,
        `Payment Date: ${formatDate(orderDetails.payment_date)}`,
      ];

      if (orderDetails.payment_method === 'Cheque/DD') {
        paymentDetailsLines.push(`Cheque/DD No: ${orderDetails.cheque_dd_no || 'N/A'}`);
        paymentDetailsLines.push(`Cheque/DD Date: ${formatDate(orderDetails.cheque_dd_date)}`);
      }
      if (orderDetails.payment_method === 'Card') {
        paymentDetailsLines.push(`Card Number: ${orderDetails.card_number ? `**** **** **** ${orderDetails.card_number.slice(-4)}` : 'N/A'}`);
        paymentDetailsLines.push(`Card Holder: ${orderDetails.card_holder_name || 'N/A'}`);
        paymentDetailsLines.push(`Expiry Date: ${orderDetails.expiry_date || 'N/A'}`);
        paymentDetailsLines.push(`Transaction ID: ${orderDetails.transaction_id || 'N/A'}`);
      }
      if (orderDetails.payment_method === 'Bank Transfer') {
        paymentDetailsLines.push(`Bank Name: ${orderDetails.bank_name || 'N/A'}`);
        paymentDetailsLines.push(`Account Number: ${orderDetails.account_number ? `****${orderDetails.account_number.slice(-4)}` : 'N/A'}`);
        paymentDetailsLines.push(`IFSC Code: ${orderDetails.ifsc_code || 'N/A'}`);
        paymentDetailsLines.push(`Transaction ID: ${orderDetails.transaction_id || 'N/A'}`);
      }
      if (orderDetails.payment_method === 'UPI') {
        paymentDetailsLines.push(`UPI ID: ${orderDetails.upi_id || 'N/A'}`);
        paymentDetailsLines.push(`Transaction ID: ${orderDetails.transaction_id || 'N/A'}`);
      }
      if (orderDetails.payment_method === 'Cash') {
        paymentDetailsLines.push(`Transaction ID: ${orderDetails.transaction_id || 'N/A'}`);
      }

      paymentDetailsLines.forEach(line => {
        if (yPos + 5 > doc.internal.pageSize.height - margin) {
          doc.addPage();
          yPos = margin;
        }
        doc.text(line, margin, yPos);
        yPos += 5;
      });
    }

    doc.save(`order_${orderDetails.order_number}_details.pdf`);
    showSuccess('Order details PDF generated successfully!');
  };

  // Calculate pre-discount total for display
  const preDiscountTotal = orderDetails?.items.reduce((sum, item) => sum + item.total_price, 0) || 0;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
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
            <div className="text-right text-sm font-medium mt-4">
              Subtotal (Pre-Discount): ₹{preDiscountTotal.toFixed(2)}
            </div>
            <div className="text-right text-sm font-medium">
              Discount Applied: - ₹{orderDetails.discount_amount.toFixed(2)}
            </div>
            <div className="text-right text-lg font-bold mt-1">
              Total Order Amount (Final): ₹{orderDetails.total_amount.toFixed(2)}
            </div>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">No order selected or details could not be loaded.</p>
        )}
        <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handlePrint} disabled={!orderDetails || loading}>
            <Printer className="mr-2 h-4 w-4" /> {orderDetails?.dispatched ? 'Print Gate Pass' : 'Print Receipt'}
          </Button>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OrderDetailsDialog;