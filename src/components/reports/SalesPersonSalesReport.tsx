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
import { useSession } from '@/contexts/SessionContext';

interface SaleReportData {
  id: string; // Sale ID
  order_number: number;
  sale_date: string;
  product_code: string;
  product_name: string;
  product_size: string;
  product_hsn: string;
  product_gst: string;
  product_dp: number;
  quantity: number;
  total_price: number;
  dealer_name: string;
}

interface FilterOption {
  value: string;
  label: string;
}

interface SalesPersonSalesReportProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const SalesPersonSalesReport: React.FC<SalesPersonSalesReportProps> = ({ isOpen, onOpenChange }) => {
  const { user } = useSession();
  const [sales, setSales] = useState<SaleReportData[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter options data
  const [allDealers, setAllDealers] = useState<FilterOption[]>([]);
  const [allProducts, setAllProducts] = useState<FilterOption[]>([]);

  // Filter states
  const [filterDealerId, setFilterDealerId] = useState<string>('');
  const [filterProductId, setFilterProductId] = useState<string>('');
  const [filterFromSaleDate, setFilterFromSaleDate] = useState<string>('');
  const [filterToSaleDate, setFilterToSaleDate] = useState<string>('');
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
      console.error('[SalesPersonSalesReport] Error fetching company name for PDF:', error.message);
      setCompanyName(null);
    }
  }, []);

  const fetchFilterOptions = useCallback(async () => {
    if (!user?.id) return;
    try {
      // Fetch dealers assigned to the current user
      const { data: dealersData, error: dealersError } = await supabase
        .from('dealer_sales_persons')
        .select('dealers(id, name)')
        .eq('sales_person_id', user.id);

      if (dealersError) throw dealersError;
      setAllDealers((dealersData || []).map((item: any) => ({ value: item.dealers.id, label: item.dealers.name })));

      // Fetch products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, code, name')
        .eq('is_active', true);
      if (productsError) throw productsError;
      setAllProducts((productsData || []).map(p => ({ value: p.id, label: `${p.name} (${p.code})` })));

    } catch (error: any) {
      console.error('[SalesPersonSalesReport] Error fetching filter options:', error.message);
      showError('Failed to load filter options.');
    }
  }, [user?.id]);

  const fetchSalesData = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let query = supabase
        .from('sales')
        .select(`
          id,
          quantity,
          total_price,
          sale_date,
          products (id, code, name, size, hsn, gst, dp),
          orders!inner (
            order_number,
            dealer_id,
            user_id,
            dealers (name)
          )
        `)
        .eq('orders.user_id', user.id) // Filter by current user's sales
        .order('sale_date', { ascending: false });

      // Apply filters
      if (filterDealerId) {
        query = query.eq('orders.dealer_id', filterDealerId);
      }
      if (filterProductId) {
        query = query.eq('product_id', filterProductId);
      }
      if (filterFromSaleDate) {
        const startOfDay = `${filterFromSaleDate}T00:00:00.000Z`;
        query = query.gte('sale_date', startOfDay);
      }
      if (filterToSaleDate) {
        const endOfDay = `${filterToSaleDate}T23:59:59.999Z`;
        query = query.lte('sale_date', endOfDay);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[SalesPersonSalesReport] Error fetching sales data:', error.message);
        showError(`Failed to load sales data: ${error.message}`);
        setSales([]);
      } else {
        const formattedSales: SaleReportData[] = (data || []).map((sale: any) => ({
          id: sale.id,
          order_number: sale.orders?.order_number || 'N/A',
          sale_date: sale.sale_date,
          product_code: sale.products?.code || 'N/A',
          product_name: sale.products?.name || 'N/A',
          product_size: sale.products?.size || 'N/A',
          product_hsn: sale.products?.hsn || 'N/A',
          product_gst: sale.products?.gst || 'N/A',
          product_dp: sale.products?.dp || 0,
          quantity: sale.quantity,
          total_price: sale.total_price,
          dealer_name: sale.orders?.dealers?.name || 'N/A',
        }));
        setSales(formattedSales);
      }
    } catch (error: any) {
      console.error('[SalesPersonSalesReport] Error in fetchSalesData:', error.message);
      showError('An unexpected error occurred while fetching sales data.');
    } finally {
      setLoading(false);
    }
  }, [user?.id, filterDealerId, filterProductId, filterFromSaleDate, filterToSaleDate]);

  useEffect(() => {
    if (isOpen) {
      fetchFilterOptions();
      fetchSalesData();
      fetchCompanyInfo();
    }
  }, [isOpen, fetchFilterOptions, fetchSalesData, fetchCompanyInfo]);

  const handleClearFilters = () => {
    setFilterDealerId('');
    setFilterProductId('');
    setFilterFromSaleDate('');
    setFilterToSaleDate('');
  };

  const handlePrint = () => {
    try {
      const doc = new jsPDF({
        orientation: 'landscape'
      });

      const companyNameText = companyName ? companyName.toUpperCase() : "COMPANY NAME";
      doc.setFontSize(22);
      doc.text(companyNameText, doc.internal.pageSize.width / 2, 15, { align: 'center' });
      doc.setFontSize(18);
      doc.text("My Sales Report", doc.internal.pageSize.width / 2, 25, { align: 'center' });
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, doc.internal.pageSize.width / 2, 32, { align: 'center' });

      let filterDetails = [];
      if (filterDealerId) {
        const dealerLabel = allDealers.find(d => d.value === filterDealerId)?.label;
        if (dealerLabel) filterDetails.push(`Dealer: ${dealerLabel}`);
      }
      if (filterProductId) {
        const productLabel = allProducts.find(p => p.value === filterProductId)?.label;
        if (productLabel) filterDetails.push(`Product: ${productLabel}`);
      }
      if (filterFromSaleDate) filterDetails.push(`From Date: ${new Date(filterFromSaleDate).toLocaleDateString()}`);
      if (filterToSaleDate) filterDetails.push(`To Date: ${new Date(filterToSaleDate).toLocaleDateString()}`);

      if (filterDetails.length > 0) {
        doc.setFontSize(9);
        doc.text(`Filters: ${filterDetails.join(' | ')}`, doc.internal.pageSize.width / 2, 38, { align: 'center' });
      }

      const tableColumn = [
        "Order No.", "Sale Date", "Code", "Product", "Size", "HSN", "GST (%)", "DP", "Qty", "Total Price", "Dealer"
      ];
      const tableRows = sales.map(sale => [
        sale.order_number,
        new Date(sale.sale_date).toLocaleDateString(),
        sale.product_code,
        sale.product_name,
        sale.product_size,
        sale.product_hsn,
        sale.product_gst,
        `₹${sale.product_dp}`,
        sale.quantity,
        `₹${sale.total_price}`,
        sale.dealer_name,
      ]);

      const totalSum = sales.reduce((sum, sale) => sum + sale.total_price, 0);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        foot: [[{ content: 'Total', colSpan: 9, styles: { halign: 'right', fontStyle: 'bold' } }, `₹${totalSum.toFixed(2)}`, '']],
        startY: 45,
        styles: {
          fontSize: 6
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
          0: { cellWidth: 15 }, // Order No.
          1: { cellWidth: 20 }, // Sale Date
          2: { cellWidth: 15 }, // Code
          3: { cellWidth: 30 }, // Product
          4: { cellWidth: 15 }, // Size
          5: { cellWidth: 15 }, // HSN
          6: { cellWidth: 15, halign: 'right' }, // GST (%)
          7: { cellWidth: 15, halign: 'right' }, // DP
          8: { cellWidth: 10, halign: 'right' }, // Quantity
          9: { cellWidth: 20, halign: 'right' }, // Total Price
          10: { cellWidth: 25 }, // Dealer
        }
      });

      doc.save('my_sales_report.pdf');
      showSuccess('My Sales report generated successfully!');
    } catch (error: any) {
      console.error('[SalesPersonSalesReport] Error generating PDF:', error);
      showError(`Failed to generate sales report: ${error.message || 'An unknown error occurred.'}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1200px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary">My Sales Report</DialogTitle>
          <DialogDescription>
            Generate a detailed report of all your sales transactions.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-card rounded-lg">
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
            <Label htmlFor="filterProduct" className="text-foreground font-medium">Product Name</Label>
            <Select value={filterProductId || "all"} onValueChange={(value) => setFilterProductId(value === "all" ? "" : value)}>
              <SelectTrigger id="filterProduct" className="w-full">
                <SelectValue placeholder="All Products" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                {allProducts.map(product => (
                  <SelectItem key={product.value} value={product.value}>{product.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterFromSaleDate" className="text-foreground font-medium">From Sale Date</Label>
            <Input 
              id="filterFromSaleDate" 
              type="date" 
              value={filterFromSaleDate} 
              onChange={(e) => setFilterFromSaleDate(e.target.value)} 
              className="w-full" 
            />
          </div>
          
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterToSaleDate" className="text-foreground font-medium">To Sale Date</Label>
            <Input 
              id="filterToSaleDate" 
              type="date" 
              value={filterToSaleDate} 
              onChange={(e) => setFilterToSaleDate(e.target.value)} 
              className="w-full" 
            />
          </div>
          
          <Button onClick={fetchSalesData} className="flex items-center gap-2 bg-primary hover:bg-primary/90">
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
              <p className="ml-2 text-lg text-foreground">Loading sales data...</p>
            </div>
          ) : sales.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No sales data found matching your criteria.</p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-muted">
                  <TableRow className="bg-muted hover:bg-muted/90">
                    <TableHead className="text-muted-foreground font-bold">Order No.</TableHead>
                    <TableHead className="text-muted-foreground font-bold">Sale Date</TableHead>
                    <TableHead className="text-muted-foreground font-bold">Code</TableHead>
                    <TableHead className="text-muted-foreground font-bold">Product</TableHead>
                    <TableHead className="text-muted-foreground font-bold">Size</TableHead>
                    <TableHead className="text-muted-foreground font-bold">HSN</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-right">GST (%)</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-right">DP</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-right">Qty</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-right">Total Price</TableHead>
                    <TableHead className="text-muted-foreground font-bold">Dealer</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((sale) => (
                    <TableRow key={sale.id} className="hover:bg-accent/50">
                      <TableCell className="font-medium text-foreground">#{sale.order_number}</TableCell>
                      <TableCell className="text-foreground">{new Date(sale.sale_date).toLocaleDateString()}</TableCell>
                      <TableCell className="text-foreground">{sale.product_code}</TableCell>
                      <TableCell className="text-foreground">{sale.product_name}</TableCell>
                      <TableCell className="text-foreground">{sale.product_size || 'N/A'}</TableCell>
                      <TableCell className="text-foreground">{sale.product_hsn || 'N/A'}</TableCell>
                      <TableCell className="text-foreground text-right">{sale.product_gst}</TableCell>
                      <TableCell className="text-foreground text-right">₹{sale.product_dp}</TableCell>
                      <TableCell className="text-foreground text-right">{sale.quantity}</TableCell>
                      <TableCell className="text-foreground text-right">₹{sale.total_price}</TableCell>
                      <TableCell className="text-foreground">{sale.dealer_name}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
        
        <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handlePrint} disabled={sales.length === 0} className="border border-input hover:bg-accent hover:text-accent-foreground">
            <Printer className="mr-2 h-4 w-4" /> Print Report
          </Button>
          <Button onClick={() => onOpenChange(false)} className="bg-primary hover:bg-primary/90">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SalesPersonSalesReport;