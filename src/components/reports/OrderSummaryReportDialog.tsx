"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Printer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';

interface OrderSummaryData {
  id: string;
  order_number: number;
  order_date: string;
  dispatch_date: string | null; // New
  dispatched: boolean; // New
  total_amount: number;
  dealer_name: string;
  sales_person_name: string;
}

interface FilterOption {
  value: string;
  label: string;
}

interface OrderSummaryReportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const OrderSummaryReportDialog: React.FC<OrderSummaryReportDialogProps> = ({ isOpen, onOpenChange }) => {
  const [orders, setOrders] = useState<OrderSummaryData[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter options data
  const [allSalesPersons, setAllSalesPersons] = useState<FilterOption[]>([]);
  const [allDealers, setAllDealers] = useState<FilterOption[]>([]);

  // Filter states
  const [filterSalesPersonId, setFilterSalesPersonId] = useState<string>('');
  const [filterDealerId, setFilterDealerId] = useState<string>('');
  const [filterFromOrderDate, setFilterFromOrderDate] = useState<string>('');
  const [filterToOrderDate, setFilterToOrderDate] = useState<string>('');
  const [companyName, setCompanyName] = useState<string | null>(null);

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

  const fetchFilterOptions = useCallback(async () => {
    try {
      // Fetch sales persons
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('user_type', 'sales_person');
      if (profilesError) throw profilesError;
      setAllSalesPersons((profilesData || []).map(p => ({ value: p.id, label: `${p.first_name} ${p.last_name}` })));

      // Fetch dealers
      const { data: dealersData, error: dealersError } = await supabase
        .from('dealers')
        .select('id, name');
      if (dealersError) throw dealersError;
      setAllDealers((dealersData || []).map(d => ({ value: d.id, label: d.name })));

    } catch (error: any) {
      console.error('Error fetching filter options:', error.message);
      showError('Failed to load filter options.');
    }
  }, []);

  const fetchOrderSummaryData = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('orders')
        .select(`
          id,
          order_number,
          order_date,
          dispatch_date,
          dispatched,
          total_amount,
          dealers (name),
          profiles (first_name, last_name)
        `)
        .order('order_date', { ascending: false });

      // Apply filters
      if (filterSalesPersonId) {
        query = query.eq('user_id', filterSalesPersonId);
      }
      if (filterDealerId) {
        query = query.eq('dealer_id', filterDealerId);
      }
      if (filterFromOrderDate) {
        const startOfDay = `${filterFromOrderDate}T00:00:00.000Z`;
        query = query.gte('order_date', startOfDay);
      }
      if (filterToOrderDate) {
        const endOfDay = `${filterToOrderDate}T23:59:59.999Z`;
        query = query.lte('order_date', endOfDay);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching order summary data:', error.message);
        showError(`Failed to load order summary data: ${error.message}`);
        setOrders([]);
      } else {
        const formattedOrders: OrderSummaryData[] = (data || []).map((order: any) => ({
          id: order.id,
          order_number: order.order_number,
          order_date: order.order_date,
          dispatch_date: order.dispatch_date,
          dispatched: order.dispatched,
          total_amount: order.total_amount,
          dealer_name: order.dealers?.name || 'N/A',
          sales_person_name: `${order.profiles?.first_name || ''} ${order.profiles?.last_name || ''}`.trim() || 'N/A',
        }));
        setOrders(formattedOrders);
      }
    } catch (error: any) {
      console.error('Error in fetchOrderSummaryData:', error.message);
      showError('An unexpected error occurred while fetching order summary data.');
    } finally {
      setLoading(false);
    }
  }, [filterSalesPersonId, filterDealerId, filterFromOrderDate, filterToOrderDate]);

  useEffect(() => {
    if (isOpen) {
      fetchFilterOptions();
      fetchOrderSummaryData();
      fetchCompanyInfo();
    }
  }, [isOpen, fetchFilterOptions, fetchOrderSummaryData, fetchCompanyInfo]);

  const handleClearFilters = () => {
    setFilterSalesPersonId('');
    setFilterDealerId('');
    setFilterFromOrderDate('');
    setFilterToOrderDate('');
  };

  const handlePrint = () => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait'
      });

      const companyNameText = companyName ? companyName.toUpperCase() : "COMPANY NAME";
      doc.setFontSize(22);
      doc.text(companyNameText, doc.internal.pageSize.width / 2, 15, { align: 'center' });
      doc.setFontSize(18);
      doc.text("Order Summary Report", doc.internal.pageSize.width / 2, 25, { align: 'center' });
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, doc.internal.pageSize.width / 2, 32, { align: 'center' });

      let filterDetails = [];
      if (filterSalesPersonId) {
        const spLabel = allSalesPersons.find(sp => sp.value === filterSalesPersonId)?.label;
        if (spLabel) filterDetails.push(`Sales Person: ${spLabel}`);
      }
      if (filterDealerId) {
        const dealerLabel = allDealers.find(d => d.value === filterDealerId)?.label;
        if (dealerLabel) filterDetails.push(`Dealer: ${dealerLabel}`);
      }
      if (filterFromOrderDate) filterDetails.push(`From Date: ${new Date(filterFromOrderDate).toLocaleDateString()}`);
      if (filterToOrderDate) filterDetails.push(`To Date: ${new Date(filterToOrderDate).toLocaleDateString()}`);

      if (filterDetails.length > 0) {
        doc.setFontSize(9);
        doc.text(`Filters: ${filterDetails.join(' | ')}`, doc.internal.pageSize.width / 2, 38, { align: 'center' });
      }

      const tableColumn = [
        "Order No.", "Order Date", "Dispatch Date", "Dealer Name", "Sales Person", "Total Amount (₹)"
      ];
      const tableRows = orders.map(order => [
        `#${order.order_number}`,
        new Date(order.order_date).toLocaleDateString(),
        order.dispatched && order.dispatch_date ? new Date(order.dispatch_date).toLocaleDateString() : 'Pending',
        order.dealer_name,
        order.sales_person_name,
        order.total_amount.toFixed(2),
      ]);

      const totalSum = orders.reduce((sum, order) => sum + order.total_amount, 0);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        foot: [[{ content: 'Total Sales', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } }, `₹${totalSum.toFixed(2)}`]],
        startY: 45,
        styles: {
          fontSize: 8
        },
        headStyles: {
          fillColor: [30, 58, 138],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
        },
        bodyStyles: {
          textColor: [0, 0, 0],
        },
        footStyles: {
          fillColor: [220, 220, 220],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          fontSize: 8,
        },
        margin: { top: 10, left: 10, right: 10 },
        columnStyles: {
          0: { cellWidth: 20, halign: 'center' },
          1: { cellWidth: 25, halign: 'center' },
          2: { cellWidth: 25, halign: 'center' },
          3: { cellWidth: 35 },
          4: { cellWidth: 35 },
          5: { cellWidth: 30, halign: 'right' },
        }
      });

      doc.save('order_summary_report.pdf');
      showSuccess('Order Summary report generated successfully!');
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      showError(`Failed to generate report: ${error.message || 'An unknown error occurred.'}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary">Order Summary Report</DialogTitle>
          <DialogDescription>
            Generate a summary report of all orders placed.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-card rounded-lg">
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterSalesPerson" className="text-foreground font-medium">Sales Person</Label>
            <Select value={filterSalesPersonId || "all"} onValueChange={(value) => setFilterSalesPersonId(value === "all" ? "" : value)}>
              <SelectTrigger id="filterSalesPerson" className="w-full">
                <SelectValue placeholder="All Sales Persons" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sales Persons</SelectItem>
                {allSalesPersons.map(sp => (
                  <SelectItem key={sp.value} value={sp.value}>{sp.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterDealer" className="text-foreground font-medium">Dealer Name</Label>
            <Select value={filterDealerId || "all"} onValueChange={(value) => setFilterDealerId(value === "all" ? "" : value)}>
              <SelectTrigger id="filterDealer" className="w-full">
                <SelectValue placeholder="All Dealers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Dealers</SelectItem>
                {allDealers.map(dealer => (
                  <SelectItem key={dealer.value} value={dealer.value}>{dealer.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterFromOrderDate" className="text-foreground font-medium">From Order Date</Label>
            <Input 
              id="filterFromOrderDate" 
              type="date" 
              value={filterFromOrderDate} 
              onChange={(e) => setFilterFromOrderDate(e.target.value)} 
              className="w-full" 
            />
          </div>
          
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterToOrderDate" className="text-foreground font-medium">To Order Date</Label>
            <Input 
              id="filterToOrderDate" 
              type="date" 
              value={filterToOrderDate} 
              onChange={(e) => setFilterToOrderDate(e.target.value)} 
              className="w-full" 
            />
          </div>
          
          <Button onClick={fetchOrderSummaryData} className="flex items-center gap-2 bg-primary hover:bg-primary/90">
            <Search className="h-4 w-4" /> Apply Filters
          </Button>
          <Button variant="outline" onClick={handleClearFilters} className="flex items-center gap-2">
            Clear Filters
          </Button>
        </div>
        
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-lg text-foreground">Loading order data...</p>
            </div>
          ) : orders.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No orders found matching your criteria.</p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-muted">
                  <TableRow className="bg-muted hover:bg-muted/90">
                    <TableHead className="text-muted-foreground font-bold">Order No.</TableHead>
                    <TableHead className="text-muted-foreground font-bold">Order Date</TableHead>
                    <TableHead className="text-muted-foreground font-bold">Dispatch Date</TableHead>
                    <TableHead className="text-muted-foreground font-bold">Dealer Name</TableHead>
                    <TableHead className="text-muted-foreground font-bold">Sales Person</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-right">Total Amount (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id} className="hover:bg-accent/50">
                      <TableCell className="font-medium text-foreground">#{order.order_number}</TableCell>
                      <TableCell className="text-foreground">{new Date(order.order_date).toLocaleDateString()}</TableCell>
                      <TableCell className="text-foreground">
                        {order.dispatched && order.dispatch_date ? new Date(order.dispatch_date).toLocaleDateString() : 'Pending'}
                      </TableCell>
                      <TableCell className="text-foreground">{order.dealer_name}</TableCell>
                      <TableCell className="text-foreground">{order.sales_person_name}</TableCell>
                      <TableCell className="text-foreground text-right">₹{order.total_amount.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
        
        <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handlePrint} disabled={orders.length === 0} className="border border-input hover:bg-accent hover:text-accent-foreground">
            <Printer className="mr-2 h-4 w-4" /> Print Report
          </Button>
          <Button onClick={() => onOpenChange(false)} className="bg-primary hover:bg-primary/90">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OrderSummaryReportDialog;