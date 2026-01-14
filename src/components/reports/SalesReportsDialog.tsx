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

interface SaleReportData {
  id: string; // Sale ID
  order_number: number;
  sale_date: string;
  product_code: string; // New
  product_name: string;
  product_size: string; // New
  product_hsn: string; // New
  product_gst: string; // Changed to string
  product_dp: number; // New
  product_mrp: number; // Renamed from unit_price
  quantity: number;
  total_price: number;
  dealer_name: string;
  sales_person_name: string;
}

interface FilterOption {
  value: string;
  label: string;
}

interface SalesReportsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const SalesReportsDialog: React.FC<SalesReportsDialogProps> = ({ isOpen, onOpenChange }) => {
  const [sales, setSales] = useState<SaleReportData[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter options data
  const [allSalesPersons, setAllSalesPersons] = useState<FilterOption[]>([]);
  const [allDealers, setAllDealers] = useState<FilterOption[]>([]);
  const [allProducts, setAllProducts] = useState<FilterOption[]>([]);

  // Filter states
  const [filterSalesPersonId, setFilterSalesPersonId] = useState<string>('');
  const [filterDealerId, setFilterDealerId] = useState<string>('');
  const [filterProductId, setFilterProductId] = useState<string>('');
  const [filterFromSaleDate, setFilterFromSaleDate] = useState<string>('');
  const [filterToSaleDate, setFilterToSaleDate] = useState<string>('');

  const fetchFilterOptions = useCallback(async () => {
    try {
      // Fetch sales persons
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('user_type', 'sales_person');
      if (profilesError) throw profilesError;
      setAllSalesPersons((profilesData || []).map(p => ({ value: p.id, label: `${p.first_name} ${p.last_name}` })));

      // Fetch dealers dynamically based on selected sales person
      let dealersData: { id: string; name: string }[] | null = null;
      let dealersError: any = null;

      if (filterSalesPersonId) {
        // If a sales person is selected, fetch only dealers assigned to them
        const { data, error } = await supabase
          .from('dealer_sales_persons')
          .select('dealers(id, name)')
          .eq('sales_person_id', filterSalesPersonId);
        dealersData = data?.map((item: any) => item.dealers) || [];
        dealersError = error;
      } else {
        // If no sales person is selected, fetch all dealers
        const { data, error } = await supabase
          .from('dealers')
          .select('id, name');
        dealersData = data;
        dealersError = error;
      }

      if (dealersError) {
        console.error('Error fetching dealers for filter:', dealersError.message);
        showError('Failed to load dealers for filter.');
        setAllDealers([]);
      } else {
        setAllDealers((dealersData || []).map(d => ({ value: d.id, label: d.name })));
      }

      // Fetch products - UPDATED to include new fields
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, code, name, size, hsn, gst, dp, mrp');
      if (productsError) throw productsError;
      setAllProducts((productsData || []).map(p => ({ value: p.id, label: `${p.name} (${p.code})` })));

    } catch (error: any) {
      console.error('Error fetching filter options:', error.message);
      showError('Failed to load filter options.');
    }
  }, [filterSalesPersonId]); // Re-run when filterSalesPersonId changes

  const fetchSalesData = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('sales')
        .select(`
          id,
          quantity,
          total_price,
          sale_date,
          products (id, code, name, size, hsn, gst, dp, mrp),
          orders!inner (
            order_number,
            dealer_id,
            user_id,
            dealers (name),
            profiles (first_name, last_name)
          )
        `)
        .order('sale_date', { ascending: false });

      // Apply filters
      if (filterSalesPersonId) {
        query = query.eq('orders.user_id', filterSalesPersonId);
      }
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
        console.error('Error fetching sales data:', error.message);
        if (error.details) console.error('Error details:', error.details);
        if (error.hint) console.error('Error hint:', error.hint);
        showError(`Failed to load sales data: ${error.message}`);
        setSales([]);
      } else {
        const formattedSales: SaleReportData[] = (data || []).map((sale: any) => ({
          id: sale.id,
          order_number: sale.orders?.order_number || 'N/A',
          sale_date: sale.sale_date,
          product_code: sale.products?.code || 'N/A', // New
          product_name: sale.products?.name || 'N/A',
          product_size: sale.products?.size || 'N/A', // New
          product_hsn: sale.products?.hsn || 'N/A', // New
          product_gst: sale.products?.gst || 'N/A', // Changed to string
          product_dp: sale.products?.dp || 0, // New
          product_mrp: sale.products?.mrp || 0, // Renamed from unit_price
          quantity: sale.quantity,
          total_price: sale.total_price,
          dealer_name: sale.orders?.dealers?.name || 'N/A',
          sales_person_name: `${sale.orders?.profiles?.first_name || ''} ${sale.orders?.profiles?.last_name || ''}`.trim() || 'N/A',
        }));
        setSales(formattedSales);
      }
    } catch (error: any) {
      console.error('Error in fetchSalesData:', error.message);
      showError('An unexpected error occurred while fetching sales data.');
    } finally {
      setLoading(false);
    }
  }, [filterSalesPersonId, filterDealerId, filterProductId, filterFromSaleDate, filterToSaleDate]);

  useEffect(() => {
    if (isOpen) {
      fetchFilterOptions();
      fetchSalesData();
    }
  }, [isOpen, fetchFilterOptions, fetchSalesData]);

  const handleClearFilters = () => {
    setFilterSalesPersonId('');
    setFilterDealerId('');
    setFilterProductId('');
    setFilterFromSaleDate('');
    setFilterToSaleDate('');
  };

  const handlePrint = () => {
    const doc = new jsPDF({
      orientation: 'landscape'
    });
    doc.setFontSize(18);
    doc.text("Sales Report", 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);

    const tableColumn = [
      "Order No.", "Sale Date", "Code", "Product", "Size", "HSN", "GST (%)", "DP", "MRP", "Qty", "Total Price", "Dealer", "Sales Person"
    ];
    const tableRows = sales.map(sale => [
      sale.order_number,
      new Date(sale.sale_date).toLocaleDateString(),
      sale.product_code,
      sale.product_name,
      sale.product_size,
      sale.product_hsn,
      sale.product_gst, // Display GST as string
      `₹${sale.product_dp}`, // Display as integer
      `₹${sale.product_mrp}`, // Display as integer
      sale.quantity,
      `₹${sale.total_price}`,
      sale.dealer_name,
      sale.sales_person_name,
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 30,
      styles: {
        fontSize: 6
      },
      headStyles: {
        fillColor: [200, 200, 200],
        textColor: [0, 0, 0]
      },
      margin: { top: 25, left: 10, right: 10 },
      columnStyles: {
        0: { cellWidth: 15 }, // Order No.
        1: { cellWidth: 20 }, // Sale Date
        2: { cellWidth: 15 }, // Code
        3: { cellWidth: 30 }, // Product
        4: { cellWidth: 15 }, // Size
        5: { cellWidth: 15 }, // HSN
        6: { cellWidth: 15, halign: 'right' }, // GST (%)
        7: { cellWidth: 15, halign: 'right' }, // DP
        8: { cellWidth: 15, halign: 'right' }, // MRP
        9: { cellWidth: 10, halign: 'right' }, // Quantity
        10: { cellWidth: 20, halign: 'right' }, // Total Price
        11: { cellWidth: 25 }, // Dealer
        12: { cellWidth: 25 }, // Sales Person
      }
    });

    doc.save('sales_report.pdf');
    showSuccess('Sales report generated successfully!');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1200px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary">Sales Report</DialogTitle>
          <DialogDescription>
            Generate a detailed report of all sales transactions.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-card rounded-lg">
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterSalesPerson" className="text-foreground font-medium">Sales Person</Label>
            <Select value={filterSalesPersonId || "all"} onValueChange={(value) => {
              setFilterSalesPersonId(value === "all" ? "" : value);
              setFilterDealerId(""); // Reset dealer filter when sales person changes
            }}>
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
                    <TableHead className="text-muted-foreground font-bold text-right">MRP</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-right">Qty</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-right">Total Price</TableHead>
                    <TableHead className="text-muted-foreground font-bold">Dealer</TableHead>
                    <TableHead className="text-muted-foreground font-bold">Sales Person</TableHead>
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
                      <TableCell className="text-foreground text-right">₹{sale.product_mrp}</TableCell>
                      <TableCell className="text-foreground text-right">{sale.quantity}</TableCell>
                      <TableCell className="text-foreground text-right">₹{sale.total_price}</TableCell>
                      <TableCell className="text-foreground">{sale.dealer_name}</TableCell>
                      <TableCell className="text-foreground">{sale.sales_person_name}</TableCell>
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

export default SalesReportsDialog;