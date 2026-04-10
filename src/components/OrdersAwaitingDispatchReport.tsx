"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Printer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { getStartOfUTCDayISO, getEndOfUTCDayISO } from '@/utils/date';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';

interface Order {
  id: string;
  order_number: number;
  dealer_name: string;
  sales_person_name: string;
  total_amount: number;
  order_date: string;
}

interface OrdersAwaitingDispatchReportProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const OrdersAwaitingDispatchReport: React.FC<OrdersAwaitingDispatchReportProps> = ({ isOpen, onOpenChange }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const today = new Date().toISOString().split('T')[0];
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);

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
      console.error('Error fetching company info:', error.message);
      showError('Failed to load company information.');
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    if (!fromDate || !toDate) {
      showError("Please select both a 'from' and 'to' date.");
      return;
    }
    setLoading(true);
    try {
      const startOfFromDate = getStartOfUTCDayISO(new Date(fromDate));
      const endOfToDate = getEndOfUTCDayISO(new Date(toDate));

      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          total_amount,
          order_date,
          dealers (name),
          profiles (first_name, last_name)
        `)
        .eq('dispatch_status', 'pending')
        .gte('order_date', startOfFromDate)
        .lte('order_date', endOfToDate)
        .order('order_date', { ascending: true });

      if (error) throw error;

      const formattedOrders = (data || []).map((order: any) => ({
        id: order.id,
        order_number: order.order_number,
        dealer_name: order.dealers?.name || 'N/A',
        sales_person_name: `${order.profiles?.first_name || ''} ${order.profiles?.last_name || ''}`.trim() || 'N/A',
        total_amount: order.total_amount,
        order_date: new Date(order.order_date).toLocaleDateString(),
      }));
      setOrders(formattedOrders);
    } catch (error: any) {
      showError(`Failed to fetch orders: ${error.message}`);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    if (isOpen) {
      fetchCompanyInfo();
      fetchOrders();
    }
  }, [isOpen, fetchOrders, fetchCompanyInfo]);

  const handlePrint = () => {
    if (orders.length === 0) {
      showError("No data to print.");
      return;
    }
    try {
      const doc = new jsPDF();
      const companyNameText = companyName ? companyName.toUpperCase() : "COMPANY NAME";
      doc.setFontSize(18);
      doc.text(companyNameText, doc.internal.pageSize.width / 2, 15, { align: 'center' });
      doc.setFontSize(14);
      doc.text("Orders Awaiting Dispatch Report", doc.internal.pageSize.width / 2, 22, { align: 'center' });
      doc.setFontSize(10);
      doc.setTextColor(100);
      const fromDateText = new Date(fromDate).toLocaleDateString();
      const toDateText = new Date(toDate).toLocaleDateString();
      doc.text(`Date Range: ${fromDateText} to ${toDateText}`, doc.internal.pageSize.width / 2, 28, { align: 'center' });

      const tableColumn = ["Order No.", "Dealer", "Sales Person", "Amount", "Order Date"];
      const tableRows = orders.map(o => [
        `#${o.order_number}`,
        o.dealer_name,
        o.sales_person_name,
        `Rs.${o.total_amount.toFixed(2)}`,
        o.order_date
      ]);

      const totalAmount = orders.reduce((sum, o) => sum + o.total_amount, 0);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        foot: [[{ content: 'Total', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } }, `Rs.${totalAmount.toFixed(2)}`, '']],
        startY: 35,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [22, 163, 74], textColor: [255, 255, 255], fontStyle: 'bold' },
        footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
        columnStyles: {
          3: { halign: 'right' }
        }
      });

      const safeFromDate = fromDateText.replace(/\//g, '-');
      const safeToDate = toDateText.replace(/\//g, '-');
      doc.save(`awaiting_dispatch_${safeFromDate}_to_${safeToDate}.pdf`);
      showSuccess("Report generated successfully!");
    } catch (error: any) {
      showError(`Failed to generate PDF: ${error.message}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <div className="flex justify-between items-center">
            <div>
              <DialogTitle>Orders Awaiting Dispatch</DialogTitle>
              <DialogDescription>
                Review all orders that are pending dispatch within the selected date range.
              </DialogDescription>
            </div>
            <Button onClick={handlePrint} variant="outline" size="icon" title="Print Report">
              <Printer className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="flex items-center gap-4 my-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="from-date">From</Label>
            <Input id="from-date" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="to-date">To</Label>
            <Input id="to-date" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <Button onClick={fetchOrders} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Load Report
          </Button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto border rounded-md">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2">Loading orders...</p>
            </div>
          ) : orders.length === 0 ? (
            <p className="text-center text-muted-foreground p-8">No orders awaiting dispatch in the selected date range.</p>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>Order No.</TableHead>
                  <TableHead>Dealer</TableHead>
                  <TableHead>Sales Person</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Order Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">#{order.order_number}</TableCell>
                    <TableCell>{order.dealer_name}</TableCell>
                    <TableCell>{order.sales_person_name}</TableCell>
                    <TableCell className="text-right">₹{order.total_amount.toFixed(2)}</TableCell>
                    <TableCell>{order.order_date}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        {orders.length > 0 && (
          <div className="mt-4 p-4 bg-muted rounded-md border">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">Total Order Value:</span>
              <span className="text-lg font-bold text-primary">₹{orders.reduce((sum, o) => sum + o.total_amount, 0).toFixed(2)}</span>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OrdersAwaitingDispatchReport;