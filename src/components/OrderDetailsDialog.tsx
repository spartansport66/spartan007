"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Loader2, Printer, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { useSession } from '@/contexts/SessionContext';
import { formatCurrency } from '@/utils/format';
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
  address: string | null;
  raw_item_name: string | null;
  mapped_product_id?: string | null;
  mapped_product_name?: string | null;
  mapped_product_code?: string | null;
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
  delivery_location: string | null;
  transport_name: string | null;
  booking_destination: string | null;
  date_of_dispatch: string | null;
}

interface OrderDetailsDialogProps {
  orderId: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onPrint?: (orderId: string) => void;
  showGatePassButton?: boolean;
  autoPrintGatepass?: boolean;
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
  autoPrintGatepass = false,
}) => {
  const { userType } = useSession();
  const isGateKeeper = userType === 'gate_keeper';
  const [orderDetails, setOrderDetails] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [deliveryLocation, setDeliveryLocation] = useState<string | null>(null);
  const [transportName, setTransportName] = useState<string | null>(null);
  const [bookingDestination, setBookingDestination] = useState<string | null>(null);
  const [dateOfDispatch, setDateOfDispatch] = useState<string | null>(null);
  const [hasAutoPrintedGatepass, setHasAutoPrintedGatepass] = useState(false);

  const fetchCompanyInfo = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('company_info').select('company_name').limit(1);
      if (error) throw error;
      setCompanyName(data && data.length > 0 ? data[0].company_name : null);
    } catch (error: any) {
      console.error('Error fetching company name:', error.message);
    }
  }, []);

  const fetchOrderDetails = useCallback(async (id: string) => {
    setLoading(true);
    try {
      // Try to fetch from online_orders first (for online orders)
      const { data: onlineOrderArray, error: onlineOrderError } = await supabase
        .from('online_orders')
        .select(`id, order_number, order_date, total_amount, discount_amount, status, payment_status, bill_no`)
        .eq('id', id)
        .limit(1);

      // If found in online_orders, use that
      if (!onlineOrderError && onlineOrderArray && onlineOrderArray.length > 0) {
        const orderData = onlineOrderArray[0];
        
        // Fetch online order details
        const { data: onlineDataArray, error: onlineError } = await supabase
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

        let onlineOrderDetails: OnlineOrderInfo | null = null;
        if (!onlineError && onlineDataArray && onlineDataArray.length > 0) {
          const onlineData = onlineDataArray[0];
          let platformName = 'N/A';
          
          if (onlineData.platform_id) {
            const { data: platformDataArray } = await supabase
              .from('online_platforms')
              .select('name')
              .eq('id', onlineData.platform_id)
              .limit(1);
            if (platformDataArray && platformDataArray.length > 0) {
              platformName = platformDataArray[0].name || 'N/A';
            }
          }
          
          onlineOrderDetails = {
            client_name: onlineData.client_name,
            platform_name: platformName,
            platform_order_number: onlineData.platform_order_number,
            contact_no: onlineData.contact_no,
            city: onlineData.city,
            state: onlineData.state,
            address: onlineData.address,
            raw_item_name: onlineData.raw_item_name,
            mapped_product_id: onlineData.mapped_product_id,
            mapped_product_name: (onlineData.products as any)?.name || null,
            mapped_product_code: (onlineData.products as any)?.code || null,
          };
        }

        setOrderDetails({
          id: orderData.id,
          order_number: orderData.order_number,
          order_date: orderData.order_date,
          total_amount: orderData.total_amount,
          discount_amount: orderData.discount_amount || 0,
          status: orderData.status,
          dealer_name: 'Online Order',
          dealer_address: onlineOrderDetails?.address || 'N/A',
          dealer_city: onlineOrderDetails?.city || 'N/A',
          dealer_state: onlineOrderDetails?.state || 'N/A',
          dealer_country: 'N/A',
          dealer_phone: onlineOrderDetails?.contact_no || 'N/A',
          sales_person_name: 'N/A',
          items: [],
          bill_no: orderData.bill_no,
          dispatch_date: null,
          dispatch_number: null,
          dispatched: false,
          payment_status: orderData.payment_status,
          online_order_details: onlineOrderDetails,
          delivery_location: onlineOrderDetails?.address || null,
          transport_name: null,
          booking_destination: null,
          date_of_dispatch: null,
        });
        setDeliveryLocation(onlineOrderDetails?.address || null);
        setTransportName(null);
        setBookingDestination(null);
        setDateOfDispatch(null);
        setLoading(false);
        return;
      }

      // Try regular orders table
      const { data: orderDataArray, error: orderError } = await supabase
        .from('orders')
        .select(`
          id, order_number, order_date, total_amount, discount_amount, status, payment_status, user_id, bill_no, dispatch_date, dispatch_number, dispatched,
          delivery_location, transport_name, booking_destination, date_of_dispatch,
          dealers (id, name, address, phone, city, state, country)
        `)
        .eq('id', id)
        .limit(1);

      if (orderError) throw orderError;
      
      let orderData: any = null;
      if (orderDataArray && orderDataArray.length > 0) {
        orderData = orderDataArray[0];
      } else {
        // If the passed ID is actually a bill ID from spartan/fightor, resolve it to the linked order
        const spartanBill = await supabase
          .from('spartan')
          .select('order_id')
          .eq('id', id)
          .maybeSingle();

        let billData = spartanBill;
        if (!billData.data) {
          billData = await supabase
            .from('fightor')
            .select('order_id')
            .eq('id', id)
            .maybeSingle();
        }

        if (!billData.data) {
          throw new Error('Order not found in both online, regular orders, or invoice tables');
        }

        if (!billData.data.order_id) {
          throw new Error('Bill found but no linked order exists to display full order details');
        }

        const { data: linkedOrderArray, error: linkedOrderError } = await supabase
          .from('orders')
          .select(`
            id, order_number, order_date, total_amount, discount_amount, status, payment_status, user_id, bill_no, dispatch_date, dispatch_number, dispatched,
            delivery_location, transport_name, booking_destination, date_of_dispatch,
            dealers (id, name, address, phone, city, state, country)
          `)
          .eq('id', billData.data.order_id)
          .limit(1);

        if (linkedOrderError) throw linkedOrderError;
        if (!linkedOrderArray || linkedOrderArray.length === 0) {
          throw new Error('Linked order not found for this bill');
        }

        orderData = linkedOrderArray[0];
      }

      if (!orderData) {
        throw new Error('Order not found in both online and regular orders');
      }

      let salesPersonName = 'N/A';
      if (orderData.user_id) {
        const { data: profileDataArray } = await supabase.from('profiles').select('first_name, last_name').eq('id', orderData.user_id).limit(1);
        if (profileDataArray && profileDataArray.length > 0) salesPersonName = `${profileDataArray[0].first_name || ''} ${profileDataArray[0].last_name || ''}`.trim();
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
        // Use only the stored unit_price from the sales table (snapshot at order creation time)
        // Never fall back to current product price - preserve original order price
        const unitPrice = item.unit_price ?? 0;
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
        try {
          const { data: onlineDataArray, error: onlineError } = await supabase
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
          
          if (onlineError) {
            console.warn("Warning fetching online order details:", onlineError.message);
          } else if (onlineDataArray && onlineDataArray.length > 0) {
            const onlineData = onlineDataArray[0];
            let platformName = 'N/A';
            
            // Fetch platform name separately if platform_id exists
            if (onlineData.platform_id) {
              const { data: platformDataArray } = await supabase
                .from('online_platforms')
                .select('name')
                .eq('id', onlineData.platform_id)
                .limit(1);
              if (platformDataArray && platformDataArray.length > 0) {
                platformName = platformDataArray[0].name || 'N/A';
              }
            }
            
            onlineOrderDetails = {
              client_name: onlineData.client_name,
              platform_name: platformName,
              platform_order_number: onlineData.platform_order_number,
              contact_no: onlineData.contact_no,
              city: onlineData.city,
              state: onlineData.state,
              address: onlineData.address,
              raw_item_name: onlineData.raw_item_name,
              mapped_product_id: onlineData.mapped_product_id,
              mapped_product_name: (onlineData.products as any)?.name || null,
              mapped_product_code: (onlineData.products as any)?.code || null,
            };
          }
        } catch (fallbackError) {
          console.warn("Failed to fetch online order details (fallback):", fallbackError);
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
        delivery_location: orderData.delivery_location,
        transport_name: orderData.transport_name,
        booking_destination: orderData.booking_destination,
        date_of_dispatch: orderData.date_of_dispatch,
      });
      setDeliveryLocation(orderData.delivery_location);
      setTransportName(orderData.transport_name);
      setBookingDestination(orderData.booking_destination);
      setDateOfDispatch(orderData.date_of_dispatch);
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

  useEffect(() => {
    if (!isOpen) {
      setHasAutoPrintedGatepass(false);
      return;
    }

    if (isOpen && autoPrintGatepass && orderDetails && !hasAutoPrintedGatepass) {
      handlePrintGatePass();
      setHasAutoPrintedGatepass(true);
    }
  }, [isOpen, autoPrintGatepass, orderDetails, hasAutoPrintedGatepass]);

  const hasActualItems = orderDetails ? orderDetails.items.some(i => {
    if (i.product_name && i.product_name !== 'Pending Mapping' && i.product_name !== 'N/A') return true;
    // some sales rows might include product_id even if product_name is placeholder
    if ((i as any).product_id) return true;
    return false;
  }) : false;

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

    const hasActualItems = orderDetails.items.some(i => {
      // consider product_name meaningful if it's not the placeholder text
      if (i.product_name && i.product_name !== 'Pending Mapping' && i.product_name !== 'N/A') return true;
      return false;
    });

    const tableColumn = ["Code", "Product Name", "Quantity"];
    const tableRows = hasActualItems
      ? orderDetails.items.map(item => [item.product_code, item.product_name, item.quantity.toString()])
      : orderDetails.online_order_details?.mapped_product_name ?
        [[
          orderDetails.online_order_details.mapped_product_code || 'N/A',
          orderDetails.online_order_details.mapped_product_name,
          "1"
        ]]
      : [[ "N/A", orderDetails.online_order_details?.raw_item_name || "Pending Mapping", "1" ]];

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

    const hasActualItems2 = orderDetails.items.some(i => {
      if (i.product_name && i.product_name !== 'Pending Mapping' && i.product_name !== 'N/A') return true;
      return false;
    });

    const tableColumn = ["Code", "Product", "Qty", "Unit Price", "Disc %", "GST %", "Total"];
    const tableRows = hasActualItems2
      ? orderDetails.items.map(item => [
          item.product_code,
          item.product_name,
          item.quantity.toString(),
          `Rs.${item.unit_price.toFixed(2)}`,
          `${item.discount_percent}%`,
          `${item.product_gst}%`,
          `Rs.${item.total_price.toFixed(2)}`
        ])
      : orderDetails.online_order_details?.mapped_product_name ?
        [[
          orderDetails.online_order_details.mapped_product_code || 'N/A',
          orderDetails.online_order_details.mapped_product_name,
          "1",
          `Rs.${orderDetails.total_amount.toFixed(2)}`,
          "0%",
          "0%",
          `Rs.${orderDetails.total_amount.toFixed(2)}`
        ]]
      : [[ "N/A", orderDetails.online_order_details?.raw_item_name || "Pending Mapping", "1" ]];

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

  return (
    <div>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
            <DialogDescription>View and print order information</DialogDescription>
          </DialogHeader>
          <div>
            {orderDetails && (
              <div className="space-y-6 p-4 bg-white rounded-lg">
                {/* Header */}
                <div className="border-b pb-4 text-center">
                  <h2 className="text-2xl font-bold">ORDER INVOICE</h2>
                  <p className="text-sm text-muted-foreground">Order #{orderDetails.order_number}</p>
                </div>

                {/* Order & Party Details */}
                <div className="grid grid-cols-2 gap-6">
                  {/* Left: Party Details */}
                  <div className="border p-4 rounded">
                    <h3 className="font-bold text-sm mb-3">BILL TO:</h3>
                    <p className="font-semibold">{orderDetails.dealer_name}</p>
                    <p className="text-sm text-muted-foreground">{orderDetails.dealer_address}</p>
                    <p className="text-sm text-muted-foreground">{orderDetails.dealer_city}, {orderDetails.dealer_state}, {orderDetails.dealer_country}</p>
                    <p className="text-sm mt-2"><strong>Phone:</strong> {orderDetails.dealer_phone}</p>
                  </div>

                  {/* Right: Order Details */}
                  <div className="border p-4 rounded">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="font-semibold">Order Date:</span><span>{formatDate(orderDetails.order_date)}</span></div>
                      <div className="flex justify-between"><span className="font-semibold">Bill No:</span><span>{orderDetails.bill_no || 'N/A'}</span></div>
                      <div className="flex justify-between"><span className="font-semibold">Dispatch No:</span><span>{orderDetails.dispatch_number || 'N/A'}</span></div>
                      <div className="flex justify-between"><span className="font-semibold">Dispatch Date:</span><span>{formatDate(orderDetails.dispatch_date)}</span></div>
                      <div className="flex justify-between"><span className="font-semibold">Sales Person:</span><span>{orderDetails.sales_person_name}</span></div>
                      <div className="flex justify-between"><span className="font-semibold">Payment Status:</span><span className="text-blue-600 font-semibold">{orderDetails.payment_status}</span></div>
                    </div>
                  </div>
                </div>

                {/* Delivery Details */}
                <div className="border p-3 rounded bg-blue-50">
                  <h3 className="font-bold text-sm mb-2">DELIVERY & TRANSPORT DETAILS:</h3>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div>
                      <p className="font-semibold text-blue-700">1. Delivery Location</p>
                      <p className="text-muted-foreground">{orderDetails.delivery_location || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-blue-700">2. Transport Name</p>
                      <p className="text-muted-foreground">{orderDetails.transport_name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-blue-700">3. Booking Destination</p>
                      <p className="text-muted-foreground">{orderDetails.booking_destination || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-blue-700">4. Date of Dispatch</p>
                      <p className="text-muted-foreground">{formatDate(orderDetails.date_of_dispatch)}</p>
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <div>
                  <h3 className="font-bold text-sm mb-3">ORDER ITEMS:</h3>
                  <div className="border rounded overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted">
                        <TableRow>
                          <TableHead className="text-xs font-bold">Code</TableHead>
                          <TableHead className="text-xs font-bold">Product</TableHead>
                          <TableHead className="text-xs font-bold text-right">Qty</TableHead>
                          <TableHead className="text-xs font-bold text-right">Unit Price</TableHead>
                          <TableHead className="text-xs font-bold text-right">Discount %</TableHead>
                          <TableHead className="text-xs font-bold text-right">Taxable Value</TableHead>
                          <TableHead className="text-xs font-bold text-right">GST %</TableHead>
                          <TableHead className="text-xs font-bold text-right">GST Amt</TableHead>
                          <TableHead className="text-xs font-bold text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orderDetails.items.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-xs">{item.product_code}</TableCell>
                            <TableCell className="text-xs">{item.product_name}</TableCell>
                            <TableCell className="text-xs text-right">{item.quantity}</TableCell>
                            <TableCell className="text-xs text-right">₹{item.unit_price.toFixed(2)}</TableCell>
                            <TableCell className="text-xs text-right">{item.discount_percent}%</TableCell>
                            <TableCell className="text-xs text-right">₹{((item.unit_price * (1 - item.discount_percent / 100)) * item.quantity).toFixed(2)}</TableCell>
                            <TableCell className="text-xs text-right">{item.product_gst}%</TableCell>
                            <TableCell className="text-xs text-right">₹{(((item.unit_price * (1 - item.discount_percent / 100)) * item.quantity * parseFloat(item.product_gst)) / 100).toFixed(2)}</TableCell>
                            <TableCell className="text-xs text-right font-semibold">₹{item.total_price.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Totals Section */}
                <div className="flex justify-end">
                  <div className="w-80 border rounded p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal:</span>
                      <span>₹{orderDetails.items.reduce((sum, item) => sum + item.total_price, 0).toFixed(2)}</span>
                    </div>
                    {orderDetails.discount_amount > 0 && (
                      <div className="flex justify-between text-sm text-red-600">
                        <span>Discount:</span>
                        <span>-₹{orderDetails.discount_amount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm border-t pt-2">
                      <span>Total GST:</span>
                      <span>₹{orderDetails.items.reduce((sum, item) => {
                        const taxableValue = (item.unit_price * (1 - item.discount_percent / 100)) * item.quantity;
                        const gstAmount = (taxableValue * parseFloat(item.product_gst)) / 100;
                        return sum + gstAmount;
                      }, 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg border-t border-b py-2">
                      <span>GRAND TOTAL:</span>
                      <span>₹{orderDetails.total_amount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {!orderDetails && <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}
          </div>
          <DialogFooter>
            <Button onClick={handlePrintGatePass} disabled={!orderDetails}>
              Print Gate Pass
            </Button>
            <Button onClick={handlePrintOrderDetails} disabled={!orderDetails}>
              Print Order Details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrderDetailsDialog;