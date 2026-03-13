"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Loader2, Printer, Image as ImageIcon } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { Button } from '@/components/ui/button';

interface SalesPersonOrderWiseReportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

interface OrderRow {
  id: string;
  order_number: string;
  order_date: string;
  total_amount: number;
  bill_no: string | null;
  dealers?: { name?: string }[] | null;
}

const SalesPersonOrderWiseReportDialog: React.FC<SalesPersonOrderWiseReportDialogProps> = ({ isOpen, onOpenChange }) => {
  const today = new Date().toISOString().split('T')[0];
  const [fromDate, setFromDate] = useState<string>(today);
  const [toDate, setToDate] = useState<string>(today);
  const [salesPersonId, setSalesPersonId] = useState<string>('');
  const [salesPersons, setSalesPersons] = useState<Array<{ value: string; label: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<OrderRow[]>([]);

  const fetchSalesPersons = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('id, first_name, last_name').eq('user_type', 'sales_person');
      if (error) throw error;
      setSalesPersons((data || []).map((p: any) => ({ value: p.id, label: `${p.first_name} ${p.last_name || ''}`.trim() })));
    } catch (err: any) {
      console.error(err);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('orders')
        .select('id, order_number, order_date, total_amount, bill_no, dealers(name)')
        .gte('order_date', `${fromDate}T00:00:00.000Z`)
        .lte('order_date', `${toDate}T23:59:59.999Z`)
        .order('order_date', { ascending: true });

      if (salesPersonId) query = query.eq('user_id', salesPersonId);

      const { data, error } = await query;
      if (error) throw error;
      setRows((data || []) as OrderRow[]);
    } catch (err: any) {
      showError(`Failed to load orders: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, salesPersonId]);

  useEffect(() => {
    if (isOpen) {
      fetchSalesPersons();
      fetchOrders();
    }
  }, [isOpen, fetchSalesPersons, fetchOrders]);

  const billedRows = useMemo(() => rows.filter(r => r.bill_no && String(r.bill_no).trim() !== ''), [rows]);
  const pendingRows = useMemo(() => rows.filter(r => !r.bill_no || String(r.bill_no).trim() === ''), [rows]);

  const billedTotal = useMemo(() => billedRows.reduce((s, r) => s + (r.total_amount || 0), 0), [billedRows]);
  const pendingTotal = useMemo(() => pendingRows.reduce((s, r) => s + (r.total_amount || 0), 0), [pendingRows]);

  const selectedSalesPersonLabel = useMemo(() => {
    if (!salesPersonId) return 'All Sales Persons';
    return salesPersons.find(sp => sp.value === salesPersonId)?.label || 'Selected Sales Person';
  }, [salesPersonId, salesPersons]);

  const dateRangeString = useMemo(() => {
    if (fromDate === toDate) return fromDate;
    return `${fromDate} - ${toDate}`;
  }, [fromDate, toDate]);

  const handlePrintPdf = (dataToPrint: OrderRow[]) => {
    if (!dataToPrint || dataToPrint.length === 0) {
      showError('No orders to print.');
      return;
    }
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.setFont(undefined, 'bold');
      doc.setFontSize(16);
      doc.text(`Sales Person — Order-wise Report`, pageWidth/2, 18, { align: 'center' });
      doc.setFontSize(12);
      doc.text(`${selectedSalesPersonLabel} | ${dateRangeString}`, pageWidth/2, 26, { align: 'center' });
      // single-line summary centered
      doc.setFontSize(11);
      const summaryY = 36;
      doc.text(`Billed Orders: ${billedRows.length} ₹${billedTotal.toFixed(2)}   Pending Orders: ${pendingRows.length} ₹${pendingTotal.toFixed(2)}   All Orders: ${rows.length} ₹${(billedTotal + pendingTotal).toFixed(2)}`, pageWidth/2, summaryY, { align: 'center', fontStyle: 'bold' });
      autoTable(doc, {
        head: [['Order #', 'Date', 'Amount', 'Status', 'Bill No']],
        body: dataToPrint.map(r => [r.order_number, new Date(r.order_date).toLocaleString(), `₹${(r.total_amount || 0).toFixed(2)}`, r.bill_no && String(r.bill_no).trim() !== '' ? 'Billed' : 'Pending', r.bill_no || '-']),
        startY: summaryYStart + 20,
      });
      const safeName = selectedSalesPersonLabel.replace(/[^a-z0-9]+/gi, '_');
      doc.save(`sales_person_order_wise_report_${safeName}_${fromDate}_to_${toDate}.pdf`);
    } catch (err: any) {
      showError(`Failed to generate PDF: ${err.message}`);
    }
  };

  const handleDownloadJpg = (dataToPrint: OrderRow[]) => {
    if (!dataToPrint || dataToPrint.length === 0) {
      showError('No orders to print.');
      return;
    }
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not create canvas context');

      const width = 1200;
      const rowHeight = 40;
      const headerHeight = 120;
      const footerHeight = 60;
      const height = headerHeight + (dataToPrint.length * rowHeight) + footerHeight;
      canvas.width = width;
      canvas.height = height;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = '#1e3a8a';
      ctx.fillRect(0, 0, width, 80);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Sales Person — Order-wise Report', width / 2, 44);
      ctx.font = 'bold 16px Arial';
      ctx.fillText(`${selectedSalesPersonLabel} | ${dateRangeString}`, width / 2, 70);

      // single-line summary under header
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#111827';
      ctx.fillText(`Billed Orders: ${billedRows.length} ₹${billedTotal.toFixed(2)}    Pending Orders: ${pendingRows.length} ₹${pendingTotal.toFixed(2)}    All Orders: ${rows.length} ₹${(billedTotal + pendingTotal).toFixed(2)}`, width/2, 96);

      // start table start below summaries
      ctx.fillStyle = '#333333';
      ctx.font = '16px Arial';
      let y = 160;
      const cols = [50, 300, 700, 900, 1050];
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'left';
      ctx.fillText('Order #', cols[0], y);
      ctx.fillText('Date', cols[1], y);
      ctx.textAlign = 'right';
      ctx.fillText('Amount', cols[2], y);
      ctx.textAlign = 'left';
      ctx.fillText('Status', cols[3], y);
      ctx.fillText('Bill No', cols[4], y);
      y += 20;

      ctx.font = '14px Arial';
      dataToPrint.forEach(item => {
        ctx.fillStyle = '#333333';
        ctx.textAlign = 'left';
        ctx.fillText(item.order_number, cols[0], y);
        ctx.fillText(new Date(item.order_date).toLocaleString(), cols[1], y);
        ctx.textAlign = 'right';
        ctx.fillText(`₹${(item.total_amount || 0).toFixed(2)}`, cols[2], y);
        ctx.textAlign = 'left';
        ctx.fillText(item.bill_no && String(item.bill_no).trim() !== '' ? 'Billed' : 'Pending', cols[3], y);
        ctx.fillText(item.bill_no || '-', cols[4], y);
        y += rowHeight;
      });

      const link = document.createElement('a');
      const safeName = selectedSalesPersonLabel.replace(/[^a-z0-9]+/gi, '_');
      link.download = `sales_person_order_wise_report_${safeName}_${fromDate}_to_${toDate}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.9);
      link.click();
    } catch (err: any) {
      showError(`Failed to generate JPG: ${err.message}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1000px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sales Person — Order-wise Report</DialogTitle>
          <DialogDescription>Filter by sales person and date range. Shows billed vs pending orders and totals.</DialogDescription>
        </DialogHeader>

          <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-3 bg-card rounded">
              <div className="text-sm text-muted-foreground">Billed Orders</div>
              <div className="text-2xl font-bold">{billedRows.length}</div>
              <div className="text-sm">Total: ₹{billedTotal.toFixed(2)}</div>
            </div>
            <div className="p-3 bg-card rounded">
              <div className="text-sm text-muted-foreground">Pending Orders</div>
              <div className="text-2xl font-bold">{pendingRows.length}</div>
              <div className="text-sm">Total: ₹{pendingTotal.toFixed(2)}</div>
            </div>
            <div className="p-3 bg-card rounded">
              <div className="text-sm text-muted-foreground">All Orders</div>
              <div className="text-2xl font-bold">{rows.length}</div>
              <div className="text-sm">Total: ₹{(billedTotal + pendingTotal).toFixed(2)}</div>
            </div>
          </div>

        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div className="min-w-[150px]"><Label>From</Label><Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></div>
          <div className="min-w-[150px]"><Label>To</Label><Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /></div>
          <div className="min-w-[220px]"><Label>Sales Person</Label>
            <Select value={salesPersonId || 'all'} onValueChange={(v) => setSalesPersonId(v === 'all' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="All Sales Persons" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sales Persons</SelectItem>
                {salesPersons.map(sp => <SelectItem key={sp.value} value={sp.value}>{sp.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={fetchOrders}>Apply</Button>
          <Button variant="outline" onClick={() => { setFromDate(today); setToDate(today); setSalesPersonId(''); }}>Clear</Button>
          <Button onClick={() => handlePrintPdf(rows)} className="ml-auto"><Printer className="h-4 w-4 mr-2" /> Print PDF</Button>
          <Button variant="outline" onClick={() => handleDownloadJpg(rows)}><ImageIcon className="h-4 w-4 mr-2" /> Download JPG</Button>
        </div>
        

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : rows.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No orders found for the selected filters.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Bill No</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>{r.order_number}</TableCell>
                    <TableCell>{new Date(r.order_date).toLocaleString()}</TableCell>
                    
                    <TableCell className="text-right">₹{(r.total_amount || 0).toFixed(2)}</TableCell>
                    <TableCell>{r.bill_no && String(r.bill_no).trim() !== '' ? 'Billed' : 'Pending'}</TableCell>
                    <TableCell>{r.bill_no || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SalesPersonOrderWiseReportDialog;
