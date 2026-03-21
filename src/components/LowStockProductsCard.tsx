"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, Printer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { useSession } from '@/contexts/SessionContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Product {
  id: string;
  code: string;
  name: string;
  opening_stock: number;
  stock_in: number;
  stock_out: number;
  closing_stock: number;
  dp: number;
}

interface LowStockProductsCardProps {
  onProductAction?: () => void;
}

const LOW_STOCK_THRESHOLD = 10;

const LowStockProductsCard: React.FC<LowStockProductsCardProps> = ({ onProductAction }) => {
  const { userType } = useSession();
  const isAuthorized = userType === 'admin' || userType === 'inventory_manager';

  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);

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
      console.error('Error fetching company name:', error.message);
    }
  }, []);

  const fetchLowStockProducts = useCallback(async () => {
    if (!isAuthorized) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Fetch all products and filter in memory to ensure the formula is applied correctly
      const { data, error } = await supabase
        .from('products')
        .select('id, code, name, opening_stock, stock_in, stock_out, closing_stock, dp')
        .eq('is_active', true);

      if (error) throw error;

      const filtered = (data || []).filter(product => {
        const calculatedClosing = (product.opening_stock || 0) + (product.stock_in || 0) - (product.stock_out || 0);
        return calculatedClosing <= LOW_STOCK_THRESHOLD;
      }).sort((a, b) => {
        const calcA = (a.opening_stock || 0) + (a.stock_in || 0) - (a.stock_out || 0);
        const calcB = (b.opening_stock || 0) + (b.stock_in || 0) - (b.stock_out || 0);
        return calcA - calcB;
      });

      setLowStockProducts(filtered);
    } catch (error: any) {
      console.error('Error fetching low stock products:', error);
      setError(`Failed to load low stock products: ${error.message}`);
      showError(`Failed to load low stock products: ${error.message}`);
      setLowStockProducts([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthorized]);

  useEffect(() => {
    fetchLowStockProducts();
    fetchCompanyInfo();
  }, [fetchLowStockProducts, fetchCompanyInfo, onProductAction]);

  const handlePrint = () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;

      const companyNameText = companyName ? companyName.toUpperCase() : "COMPANY NAME";
      doc.setFontSize(18);
      doc.text(companyNameText, pageWidth / 2, 15, { align: 'center' });
      doc.setFontSize(14);
      doc.text("Low Stock Products Report", pageWidth / 2, 22, { align: 'center' });
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, pageWidth / 2, 28, { align: 'center' });

      const tableColumn = ["Code", "Product Name", "Current Stock", "DP (Rs.)"];
      const tableRows = lowStockProducts.map(product => {
        const calculatedClosing = (product.opening_stock || 0) + (product.stock_in || 0) - (product.stock_out || 0);
        return [
          product.code,
          product.name,
          calculatedClosing.toString(),
          product.dp.toFixed(2),
        ];
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 35,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [249, 115, 22], halign: 'center' }, // Orange color (orange-500)
        columnStyles: {
          0: { cellWidth: 30, halign: 'center' },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 30, halign: 'center' },
          3: { cellWidth: 30, halign: 'right' },
        }
      });

      doc.save('low_stock_report.pdf');
      showSuccess('Low stock report generated successfully!');
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      showError(`Failed to generate report: ${error.message || 'An unknown error occurred.'}`);
    }
  };

  if (!isAuthorized) {
    return null;
  }

  if (loading) {
    return (
      <Card className="bg-card text-card-foreground shadow-lg h-full">
        <CardHeader className="bg-orange-500 dark:bg-orange-700 text-white rounded-t-lg p-4">
          <CardTitle className="text-xl font-semibold">Low Stock Products</CardTitle>
          <CardDescription className="text-orange-100 dark:text-orange-200">Products running low on inventory.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading low stock products...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-card text-card-foreground shadow-lg h-full">
        <CardHeader className="bg-orange-500 dark:bg-orange-700 text-white rounded-t-lg p-4">
          <CardTitle className="text-xl font-semibold">Low Stock Products</CardTitle>
          <CardDescription className="text-orange-100 dark:text-orange-200">Products running low on inventory.</CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <p className="text-lg text-red-600 dark:text-red-400 mb-4">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card text-card-foreground shadow-lg h-full">
      <CardHeader className="bg-orange-500 dark:bg-orange-700 text-white rounded-t-lg p-4">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-xl font-semibold">Low Stock Products</CardTitle>
            <CardDescription className="text-orange-100 dark:text-orange-200">Products running low on inventory.</CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={handlePrint} 
            className="bg-white text-orange-600 hover:bg-orange-50"
            title="Print Low Stock Report"
            disabled={lowStockProducts.length === 0}
          >
            <Printer className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="overflow-x-auto">
          {lowStockProducts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No products currently low on stock. Good job!</p>
          ) : (
            <div className="max-h-[250px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow className="bg-muted hover:bg-muted/90">
                    <TableHead className="text-muted-foreground">Code</TableHead>
                    <TableHead className="text-muted-foreground">Product Name</TableHead>
                    <TableHead className="text-muted-foreground text-right">Stock</TableHead>
                    <TableHead className="text-muted-foreground text-right">DP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStockProducts.map((product) => {
                    const calculatedClosing = (product.opening_stock || 0) + (product.stock_in || 0) - (product.stock_out || 0);
                    return (
                      <TableRow key={product.id} className="hover:bg-accent/50">
                        <TableCell className="font-medium text-foreground">{product.code}</TableCell>
                        <TableCell className="font-medium text-foreground flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-orange-500" /> {product.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-right">{calculatedClosing}</TableCell>
                        <TableCell className="text-muted-foreground text-right">₹{product.dp.toFixed(2)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default LowStockProductsCard;