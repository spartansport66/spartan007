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
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface SaleReportData {
  id: string; // Sale ID
  order_number: number;
  sale_date: string;
  product_name: string;
  quantity: number;
  unit_price: number;
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

      // Fetch dealers
      const { data: dealersData, error: dealersError } = await supabase
        .from('dealers')
        .select('id, name');
      if (dealersError) throw dealersError;
      setAllDealers((dealersData || []).map(d => ({ value: d.id, label: d.name })));

      // Fetch products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name');
      if (productsError) throw productsError;
      setAllProducts((productsData || []).map(p => ({ value: p.id, label: p.name })));

    } catch (error: any) {
      console.error('Error fetching filter options:', error.message);
      showError('Failed to load filter options.');
    }
  }, []);

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
          products (name, price),
          orders (
            order_number,
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
        showError('Failed to load sales data.');
        setSales([]);
      } else {
        const formattedSales: SaleReportData[] = (data || []).map((sale: any) => ({
          id: sale.id,
          order_number: sale.orders?.order_number || 'N/A',
          sale_date: sale.sale_date,
          product_name: sale.products?.name || 'N/A',
          quantity: sale.quantity,
          unit_price: sale.products?.price || 0,
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
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(18);
    doc.text("Sales Report", 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);

    const tableColumn = [
      "Order No.", "Sale Date", "Product", "Quantity", "Unit Price", "Total Price", "Dealer", "Sales Person"
    ];
    const tableRows = sales.map(sale => [
      sale.order_number,
      new Date(sale.sale_date).toLocaleDateString(),
      sale.product_name,
      sale.quantity,
      `₹${sale.unit_price.toFixed(2)}`,
      `₹${sale.total_price.toFixed(2)}`,
      sale.dealer_name,
      sale.sales_person_name,
    ]);

    (doc as any).autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 30,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0] },
      margin: { top: 25, left: 10, right: 10 },
      columnStyles: {
        0: { cellWidth: 20 }, // Order No.
        1: { cellWidth: 25 }, // Sale Date
        2: { cellWidth: 40 }, // Product
        3: { cellWidth: 15, halign: 'right' }, // Quantity
        4: { cellWidth: 25, halign: 'right' }, // Unit Price
        5: { cellWidth: 25, halign: 'right' }, // Total Price
        6: { cellWidth: 40 }, // Dealer
        7: { cellWidth: 40 }, // Sales Person
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
                    <TableHead className="text-muted-foreground font-bold">Product</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-right">Quantity</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-right">Unit Price</TableHead>
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
                      <TableCell className="text-foreground">{sale.product_name}</TableCell>
                      <TableCell className="text-foreground text-right">{sale.quantity}</TableCell>
                      <TableCell className="text-foreground text-right">₹{sale.unit_price.toFixed(2)}</TableCell>
                      <TableCell className="text-foreground text-right">₹{sale.total_price.toFixed(2)}</TableCell>
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