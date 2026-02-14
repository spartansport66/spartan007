"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowDown, ArrowUp, DollarSign, Package, Users, ShoppingCart, Printer, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { getStartOfUTCDayISO, getEndOfUTCDayISO } from '@/utils/date';
import { formatCurrency } from '@/utils/formatters';
import { Separator } from '@/components/ui/separator';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';

interface DispatchedOrder {
  orderNumber: number;
  dealerName: string;
  salesmanName: string;
  amount: number;
  dispatchNumber: number | null;
}

interface DashboardData {
  ordersFromSalesmen: number;
  ordersFromOnline: number;
  totalOrdersReceived: number;
  dispatchedOrders: DispatchedOrder[];
  totalDispatchedValue: number;
}

const DailyReportCard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const startOfToday = getStartOfUTCDayISO();
      const endOfToday = getEndOfUTCDayISO();

      // Fetch Company Info for the report header
      const { data: companyInfo } = await supabase
        .from('company_info')
        .select('company_name')
        .limit(1)
        .single();
      setCompanyName(companyInfo?.company_name || null);

      // 1. Fetch Orders Received Today (based on order_date)
      const { data: ordersToday, error: ordersError } = await supabase
        .from('orders')
        .select('total_amount, dealers (name)')
        .gte('order_date', startOfToday)
        .lte('order_date', endOfToday);
      if (ordersError) throw ordersError;

      let fromSalesmen = 0;
      let fromOnline = 0;
      (ordersToday || []).forEach(order => {
        if ((order.dealers as any)?.name === 'Online Order') {
          fromOnline += order.total_amount;
        } else {
          fromSalesmen += order.total_amount;
        }
      });

      // 2. Fetch Dispatched Orders Today (based on dispatch_date)
      const { data: dispatchedToday, error: dispatchedError } = await supabase
        .from('orders')
        .select('order_number, total_amount, dispatch_number, dealers(name), profiles:user_id(first_name, last_name)')
        .gte('dispatch_date', startOfToday)
        .lte('dispatch_date', endOfToday)
        .order('dispatch_date', { ascending: false });
      
      if (dispatchedError) throw dispatchedError;

      const dispatchedOrdersList: DispatchedOrder[] = (dispatchedToday || []).map((order: any) => ({
        orderNumber: order.order_number,
        dealerName: order.dealers?.name || 'N/A',
        salesmanName: `${order.profiles?.first_name || ''} ${order.profiles?.last_name || ''}`.trim() || 'N/A',
        amount: order.total_amount,
        dispatchNumber: order.dispatch_number,
      }));

      const totalDispatched = dispatchedOrdersList.reduce((sum, order) => sum + order.amount, 0);

      setData({
        ordersFromSalesmen: fromSalesmen,
        ordersFromOnline: fromOnline,
        totalOrdersReceived: fromSalesmen + fromOnline,
        dispatchedOrders: dispatchedOrdersList,
        totalDispatchedValue: totalDispatched,
      });

    } catch (error: any) {
      showError(`Failed to load dashboard data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handlePrintSummary = () => {
    if (!data) return;

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const todayStr = new Date().toLocaleDateString('en-IN', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      });

      // Header
      const headerText = companyName ? companyName.toUpperCase() : "DAILY REPORT";
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text(headerText, pageWidth / 2, 20, { align: 'center' });
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(`Daily Briefing - Figures Only`, pageWidth / 2, 28, { align: 'center' });
      doc.text(`Date: ${todayStr}`, pageWidth / 2, 35, { align: 'center' });

      // Figures Table
      autoTable(doc, {
        startY: 45,
        head: [['Metric', 'Amount (INR)']],
        body: [
          ['Orders from Sales Team', formatCurrency(data.ordersFromSalesmen)],
          ['Orders from Online Platforms', formatCurrency(data.ordersFromOnline)],
          ['Total Orders Received Today', formatCurrency(data.totalOrdersReceived)],
          ['', ''], // Spacer
          ['Total Dispatched Material Value', formatCurrency(data.totalDispatchedValue)],
        ],
        theme: 'striped',
        headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255] },
        columnStyles: {
          0: { cellWidth: 100 },
          1: { halign: 'right', fontStyle: 'bold' }
        },
        styles: { fontSize: 11, cellPadding: 5 }
      });

      doc.save(`Daily_Report_${todayStr.replace(/\//g, '-')}.pdf`);
      showSuccess("Daily report generated successfully.");
    } catch (error: any) {
      showError(`Failed to generate PDF: ${error.message}`);
    }
  };

  const handleDownloadJPG = () => {
    if (!data) return;

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Could not create canvas context");

      // Set dimensions
      canvas.width = 800;
      canvas.height = 600;

      // Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Header Background
      ctx.fillStyle = '#1e3a8a'; // Dark blue
      ctx.fillRect(0, 0, canvas.width, 100);

      // Company Name
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 32px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(companyName?.toUpperCase() || "DAILY REPORT", canvas.width / 2, 60);

      // Subheader
      ctx.fillStyle = '#333333';
      ctx.font = '20px Arial';
      ctx.fillText(`Daily Briefing - Figures Only`, canvas.width / 2, 140);
      
      const todayStr = new Date().toLocaleDateString('en-IN', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      });
      ctx.fillText(`Date: ${todayStr}`, canvas.width / 2, 170);

      // Draw Figures
      ctx.textAlign = 'left';
      ctx.font = '22px Arial';
      let y = 240;
      const leftMargin = 100;
      const rightMargin = 700;

      const drawRow = (label: string, value: string, isBold = false) => {
        ctx.fillStyle = '#555555';
        ctx.font = isBold ? 'bold 22px Arial' : '22px Arial';
        ctx.fillText(label, leftMargin, y);
        
        ctx.textAlign = 'right';
        ctx.fillStyle = isBold ? '#000000' : '#333333';
        ctx.fillText(value, rightMargin, y);
        
        ctx.textAlign = 'left';
        y += 50;
      };

      drawRow('Orders from Sales Team:', formatCurrency(data.ordersFromSalesmen));
      drawRow('Orders from Online Platforms:', formatCurrency(data.ordersFromOnline));
      drawRow('Total Orders Received Today:', formatCurrency(data.totalOrdersReceived), true);
      
      // Separator line
      ctx.strokeStyle = '#dddddd';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(leftMargin, y - 20);
      ctx.lineTo(rightMargin, y - 20);
      ctx.stroke();

      drawRow('Total Dispatched Material Value:', formatCurrency(data.totalDispatchedValue), true);

      // Footer
      ctx.textAlign = 'center';
      ctx.fillStyle = '#888888';
      ctx.font = 'italic 14px Arial';
      ctx.fillText('Generated by Spartan ERP System', canvas.width / 2, 570);

      // Trigger Download
      const link = document.createElement('a');
      link.download = `Daily_Report_${todayStr.replace(/\//g, '-')}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.9);
      link.click();
      
      showSuccess("Daily report JPG downloaded successfully.");
    } catch (error: any) {
      showError(`Failed to generate JPG: ${error.message}`);
    }
  };

  const todayDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <Card className="bg-card text-card-foreground shadow-lg w-full border-2 border-primary/20">
      <CardHeader className="bg-muted/30 p-4 md:p-6">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl md:text-2xl font-bold text-primary">Daily Report</CardTitle>
            <CardDescription>Live summary for {todayDate}</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleDownloadJPG}
              disabled={loading || !data}
              className="flex items-center gap-2"
            >
              <ImageIcon className="h-4 w-4" /> Download JPG
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handlePrintSummary}
              disabled={loading || !data}
              className="flex items-center gap-2"
            >
              <Printer className="h-4 w-4" /> Print PDF
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 md:p-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Orders Received Section */}
            <div>
              <h3 className="text-base md:text-lg font-semibold flex items-center gap-2 mb-2">
                <ArrowDown className="h-5 w-5 text-green-500" /> Today's Orders Received
              </h3>
              <div className="space-y-2 pl-7">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2"><Users className="h-4 w-4" /> From Sales Team:</span>
                  <span className="font-bold">{formatCurrency(data?.ordersFromSalesmen || 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> From Online:</span>
                  <span className="font-bold">{formatCurrency(data?.ordersFromOnline || 0)}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex items-center justify-between font-bold text-base">
                  <span className="flex items-center gap-2"><DollarSign className="h-4 w-4" /> Total Received:</span>
                  <span>{formatCurrency(data?.totalOrdersReceived || 0)}</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Dispatched Material Section */}
            <div>
              <h3 className="text-base md:text-lg font-semibold flex items-center gap-2 mb-2">
                <ArrowUp className="h-5 w-5 text-blue-500" /> Today's Dispatched Material
              </h3>
              <div className="space-y-2 pl-7">
                <div className="flex items-center justify-between font-bold text-base">
                  <span className="flex items-center gap-2"><Package className="h-4 w-4" /> Total Dispatched:</span>
                  <span>{formatCurrency(data?.totalDispatchedValue || 0)}</span>
                </div>
              </div>
              
              {data && data.dispatchedOrders.length > 0 && (
                <div className="mt-4 max-h-64 overflow-y-auto border rounded-md">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="text-xs">Order #</TableHead>
                        <TableHead className="text-xs">Dealer</TableHead>
                        <TableHead className="text-xs hidden sm:table-cell">Sales Person</TableHead>
                        <TableHead className="text-right text-xs">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.dispatchedOrders.map((order, index) => (
                        <TableRow key={index} className="text-sm">
                          <TableCell className="font-medium">#{order.orderNumber}</TableCell>
                          <TableCell>{order.dealerName}</TableCell>
                          <TableCell className="hidden sm:table-cell">{order.salesmanName}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(order.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DailyReportCard;