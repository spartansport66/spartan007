"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Loader2, Printer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';

interface DealerItemSalesData {
  order_number: number;
  sale_id: string;
  dealer_id: string;
  dealer_name: string;
  salesman_name: string;
  quantity: number;
  total_price: number;
  sale_date: string;
}

interface DealerSalesSummary {
  dealer_id: string;
  dealer_name: string;
  total_quantity: number;
  total_sales_amount: number;
  sales_count: number;
  individual_sales: DealerItemSalesData[];
}

interface ProductOption {
  value: string;
  label: string;
  code: string;
}

interface ItemWiseDealerSalesReportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const ItemWiseDealerSalesReportDialog: React.FC<ItemWiseDealerSalesReportDialogProps> = ({ isOpen, onOpenChange }) => {
  const [dealerSalesData, setDealerSalesData] = useState<DealerSalesSummary[]>([]);
  const [allIndividualSales, setAllIndividualSales] = useState<DealerItemSalesData[]>([]);
  const [loading, setLoading] = useState(false);
  const [allProducts, setAllProducts] = useState<ProductOption[]>([]);
  
  // Filter states
  const [filterProductId, setFilterProductId] = useState<string>('');
  const [filterFromDate, setFilterFromDate] = useState<string>('');
  const [filterToDate, setFilterToDate] = useState<string>('');
  const [selectedProductName, setSelectedProductName] = useState<string>('');
  const [selectedProductCode, setSelectedProductCode] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  
  // Search state
  const [productSearchInput, setProductSearchInput] = useState<string>('');
  const [filteredProducts, setFilteredProducts] = useState<ProductOption[]>([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, code, name')
        .order('name', { ascending: true });
      
      if (error) throw error;
      
      setAllProducts((data || []).map(p => ({ 
        value: p.id, 
        label: `${p.name} (${p.code})`,
        code: p.code
      })));
    } catch (error: any) {
      console.error('Error fetching products:', error.message);
      showError('Failed to load products.');
    }
  }, []);

  const fetchCompanyInfo = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('company_info')
        .select('company_name')
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      setCompanyName(data?.company_name || 'Company');
    } catch (error: any) {
      console.error('Error fetching company name:', error.message);
      setCompanyName('Company');
    }
  }, []);

  const fetchDealerSalesData = useCallback(async () => {
    if (!filterProductId) {
      showError('Please select a product');
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
          products (id, name, code),
          orders!inner (
            order_number,
            dealer_id,
            user_id,
            dealers (id, name),
            profiles (first_name, last_name)
          )
        `)
        .eq('product_id', filterProductId);

      // Apply date filters
      if (filterFromDate) {
        const startOfDay = `${filterFromDate}T00:00:00.000Z`;
        query = query.gte('sale_date', startOfDay);
      }
      if (filterToDate) {
        const endOfDay = `${filterToDate}T23:59:59.999Z`;
        query = query.lte('sale_date', endOfDay);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching dealer sales data:', error.message);
        showError(`Failed to load sales data: ${error.message}`);
        setDealerSalesData([]);
        return;
      }

      // Group data by dealer
      const dealerMap = new Map<string, DealerSalesSummary>();
      const individualSalesList: DealerItemSalesData[] = [];

      (data || []).forEach((sale: any) => {
        const dealerId = sale.orders?.dealer_id || 'unknown';
        const dealerName = sale.orders?.dealers?.name || 'Unknown Dealer';
        const orderNumber = sale.orders?.order_number || 'N/A';
        const salesmanFirstName = sale.orders?.profiles?.first_name || '';
        const salesmanLastName = sale.orders?.profiles?.last_name || '';
        const salesmanName = `${salesmanFirstName} ${salesmanLastName}`.trim() || 'N/A';
        
        // Create individual sale record
        const individualSale: DealerItemSalesData = {
          order_number: orderNumber,
          sale_id: sale.id,
          dealer_id: dealerId,
          dealer_name: dealerName,
          salesman_name: salesmanName,
          quantity: sale.quantity || 0,
          total_price: sale.total_price || 0,
          sale_date: sale.sale_date,
        };
        
        individualSalesList.push(individualSale);
        
        // Create/update dealer summary
        if (!dealerMap.has(dealerId)) {
          dealerMap.set(dealerId, {
            dealer_id: dealerId,
            dealer_name: dealerName,
            total_quantity: 0,
            total_sales_amount: 0,
            sales_count: 0,
            individual_sales: [],
          });
        }

        const dealerData = dealerMap.get(dealerId)!;
        dealerData.total_quantity += sale.quantity || 0;
        dealerData.total_sales_amount += sale.total_price || 0;
        dealerData.sales_count += 1;
        dealerData.individual_sales.push(individualSale);
      });

      // Convert map to array and sort by total sales amount (descending)
      const dataArray = Array.from(dealerMap.values()).sort((a, b) => b.total_sales_amount - a.total_sales_amount);
      setDealerSalesData(dataArray);
      setAllIndividualSales(individualSalesList.sort((a, b) => new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime()));

      if (dataArray.length === 0) {
        showError('No sales data found for selected filters.');
      } else {
        showSuccess(`Found ${dataArray.length} dealers who purchased this item (${individualSalesList.length} total transactions).`);
      }
    } catch (error: any) {
      console.error('Error in fetchDealerSalesData:', error.message);
      showError('An unexpected error occurred while fetching data.');
    } finally {
      setLoading(false);
    }
  }, [filterProductId, filterFromDate, filterToDate]);

  useEffect(() => {
    if (isOpen) {
      fetchProducts();
      fetchCompanyInfo();
      setDealerSalesData([]);
      setAllIndividualSales([]);
      setFilterProductId('');
      setFilterFromDate('');
      setFilterToDate('');
      setSelectedProductName('');
      setSelectedProductCode('');
      setProductSearchInput('');
      setFilteredProducts([]);
      setShowProductDropdown(false);
    }
  }, [isOpen, fetchProducts, fetchCompanyInfo]);

  const handleProductSearchChange = (searchValue: string) => {
    setProductSearchInput(searchValue);
    
    if (!searchValue.trim()) {
      setFilteredProducts([]);
      setShowProductDropdown(false);
      return;
    }

    const searchLower = searchValue.toLowerCase();
    const filtered = allProducts.filter(product =>
      product.label.toLowerCase().includes(searchLower) ||
      product.code.toLowerCase().includes(searchLower)
    );

    setFilteredProducts(filtered);
    setShowProductDropdown(filtered.length > 0);
  };

  const handleProductSelect = (product: ProductOption) => {
    setFilterProductId(product.value);
    setSelectedProductName(product.label);
    setSelectedProductCode(product.code);
    setProductSearchInput(product.label);
    setShowProductDropdown(false);
  };

  const handleClearFilters = () => {
    setFilterProductId('');
    setFilterFromDate('');
    setFilterToDate('');
    setSelectedProductName('');
    setSelectedProductCode('');
    setProductSearchInput('');
    setFilteredProducts([]);
    setShowProductDropdown(false);
    setDealerSalesData([]);
    setAllIndividualSales([]);
  };

  const handlePrint = () => {
    if (allIndividualSales.length === 0) {
      showError('No data to print');
      return;
    }

    try {
      const doc = new jsPDF({
        orientation: 'portrait'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;

      // Title
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.text('Item-wise Dealer Sales Report', pageWidth / 2, 15, { align: 'center' });

      // Company name
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text(companyName, pageWidth / 2, 22, { align: 'center' });

      // Product info
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text(`Product: ${selectedProductName}`, margin, 32);
      doc.text(`Code: ${selectedProductCode}`, margin, 38);

      // Date range if filtered
      if (filterFromDate || filterToDate) {
        const dateRange = `Date Range: ${filterFromDate || 'All'} to ${filterToDate || 'All'}`;
        doc.text(dateRange, margin, 44);
      }

      // Generated date
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, margin, pageHeight - 10);

      // Reset text color for table
      doc.setTextColor(0);

      const tableColumn = ["Order No.", "Dealer Name", "Salesman Name", "Quantity", "Amount (₹)"];
      const tableRows = allIndividualSales.map(sale => [
        sale.order_number.toString(),
        sale.dealer_name,
        sale.salesman_name,
        sale.quantity.toString(),
        sale.total_price.toFixed(2),
      ]);

      // Calculate totals
      const totalQuantity = allIndividualSales.reduce((sum, s) => sum + s.quantity, 0);
      const totalSalesAmount = allIndividualSales.reduce((sum, s) => sum + s.total_price, 0);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: filterFromDate || filterToDate ? 50 : 46,
        styles: {
          fontSize: 9,
          cellPadding: 2,
          valign: 'middle',
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
        alternateRowStyles: {
          fillColor: [240, 240, 240],
        },
        margin: { top: 10, left: margin, right: margin },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 40 },
          2: { cellWidth: 35 },
          3: { cellWidth: 20, halign: 'right' },
          4: { cellWidth: 30, halign: 'right' },
        },
        didDrawPage: (data) => {
          // Add footer with totals
          const bottomY = data.cursor?.y || doc.internal.pageSize.getHeight() - 30;
          doc.setFontSize(10);
          doc.setFont(undefined, 'bold');
          doc.text(`TOTALS:`, margin, bottomY + 5);
          doc.text(`${totalQuantity}`, margin + 60, bottomY + 5);
          doc.text(`${totalSalesAmount.toFixed(2)}`, margin + 100, bottomY + 5);
        }
      });

      doc.save(`item_wise_dealer_sales_${selectedProductCode}.pdf`);
      showSuccess('Report generated successfully!');
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      showError(`Failed to generate report: ${error.message || 'Unknown error'}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary">Item-wise Dealer Sales Report</DialogTitle>
          <DialogDescription>
            Select a product to view which dealers have purchased it and the sales details.
          </DialogDescription>
        </DialogHeader>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-card rounded-lg border">
          <div className="flex-1 min-w-[200px] relative">
            <Label htmlFor="filterProduct" className="text-foreground font-medium">Select Product (Search by Name or Code) *</Label>
            <Input
              id="filterProduct"
              type="text"
              placeholder="Type product name or code..."
              value={productSearchInput}
              onChange={(e) => handleProductSearchChange(e.target.value)}
              onFocus={() => {
                if (productSearchInput && filteredProducts.length > 0) {
                  setShowProductDropdown(true);
                }
              }}
              className="w-full"
            />
            
            {/* Dropdown list */}
            {showProductDropdown && filteredProducts.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md shadow-lg z-50 max-h-64 overflow-y-auto">
                {filteredProducts.map((product, index) => (
                  <div
                    key={product.value}
                    onClick={() => handleProductSelect(product)}
                    className="px-4 py-2 hover:bg-blue-100 dark:hover:bg-blue-900 cursor-pointer border-b last:border-b-0"
                  >
                    <div className="font-medium">{product.label}</div>
                    <div className="text-xs text-gray-500">Code: {product.code}</div>
                  </div>
                ))}
              </div>
            )}
            
            {productSearchInput && filteredProducts.length === 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md shadow-lg z-50 p-3 text-center text-gray-500">
                No products found
              </div>
            )}

            {/* Selected product display */}
            {filterProductId && (
              <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950 rounded-md text-sm">
                <span className="text-green-700 dark:text-green-400 font-semibold">✓ Selected: {selectedProductName}</span>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterFromDate" className="text-foreground font-medium">From Date</Label>
            <Input
              id="filterFromDate"
              type="date"
              value={filterFromDate}
              onChange={(e) => setFilterFromDate(e.target.value)}
            />
          </div>

          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterToDate" className="text-foreground font-medium">To Date</Label>
            <Input
              id="filterToDate"
              type="date"
              value={filterToDate}
              onChange={(e) => setFilterToDate(e.target.value)}
            />
          </div>

          <Button 
            onClick={fetchDealerSalesData}
            disabled={!filterProductId || loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Search
          </Button>

          <Button 
            onClick={handleClearFilters}
            variant="outline"
          >
            Clear
          </Button>

          <Button 
            onClick={handlePrint}
            disabled={allIndividualSales.length === 0 || loading}
            className="bg-green-600 hover:bg-green-700"
          >
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-lg">Loading data...</span>
          </div>
        )}

        {/* Results Table */}
        {!loading && allIndividualSales.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-md">
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                Total Dealers: {dealerSalesData.length} | Total Transactions: {allIndividualSales.length}
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-blue-50 dark:bg-blue-950">
                  <TableRow>
                    <TableHead className="font-bold">Order No.</TableHead>
                    <TableHead className="font-bold">Dealer Name</TableHead>
                    <TableHead className="font-bold">Salesman Name</TableHead>
                    <TableHead className="text-right font-bold">Quantity</TableHead>
                    <TableHead className="text-right font-bold">Amount (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allIndividualSales.map((sale, index) => (
                    <TableRow key={sale.sale_id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <TableCell className="font-medium">{sale.order_number}</TableCell>
                      <TableCell>{sale.dealer_name}</TableCell>
                      <TableCell>{sale.salesman_name}</TableCell>
                      <TableCell className="text-right">{sale.quantity}</TableCell>
                      <TableCell className="text-right">₹{sale.total_price.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                  {/* Totals Row */}
                  <TableRow className="bg-blue-100 dark:bg-blue-900 font-bold">
                    <TableCell colSpan={3}>TOTALS</TableCell>
                    <TableCell className="text-right">
                      {allIndividualSales.reduce((sum, s) => sum + s.quantity, 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      ₹{allIndividualSales.reduce((sum, s) => sum + s.total_price, 0).toFixed(2)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && allIndividualSales.length === 0 && filterProductId && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No sales data found for the selected filters.</p>
          </div>
        )}

        {!loading && dealerSalesData.length === 0 && !filterProductId && (
          <div className="text-center py-8 text-muted-foreground">
            <p>Select a product and click "Search" to view dealer sales data.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ItemWiseDealerSalesReportDialog;
