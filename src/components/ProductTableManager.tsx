"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Edit, Trash2, Loader2, Search, Info, Printer, ArrowUp, ArrowDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField } from '@/components/ui/form';

// IMPORTANT: Replace with the actual URL of your deployed Edge Function
const UPDATE_PRODUCT_EDGE_FUNCTION_URL = "https://hxftiocfihhdutciaisl.supabase.co/functions/v1/update-product";

interface Product {
  id: string;
  code: string;
  name: string;
  description: string;
  size: string;
  hsn: string;
  gst: string;
  dp: number;
  opening_stock: number;
  stock_in: number;
  stock_out: number;
  closing_stock: number;
  user_id: string;
  has_sales: boolean;
  category_id: string | null;
  categories: { id: string; name: string } | null;
}

interface Category {
  id: string;
  name: string;
}

const formSchema = z.object({
  code: z.string().min(1, { message: 'Product Code is required.' }),
  name: z.string().min(2, { message: 'Product name must be at least 2 characters.' }),
  description: z.string().optional(),
  size: z.string().optional(),
  hsn: z.string().optional(),
  gst: z.string().optional(),
  dp: z.preprocess((val) => Number(val), z.number().min(0)),
  opening_stock: z.preprocess((val) => Number(val), z.number().int().min(0)),
  category_id: z.string().uuid().nullable().optional(),
});

type SortKey = 'code' | 'name' | 'dp' | 'gst' | 'opening_stock' | 'stock_in' | 'stock_out' | 'calculated_closing';

const PAGE_SIZE = 10;

interface ProductTableManagerProps {
  onProductAction?: () => void;
  isAuthorized: boolean;
}

const ProductTableManager: React.FC<ProductTableManagerProps> = ({ onProductAction, isAuthorized }) => {
  const { user, session, loading: sessionLoading, userType } = useSession();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [appliedSearchTerm, setAppliedSearchTerm] = useState<string>('');
  const [stockFilter, setStockFilter] = useState<string>('');
  const [appliedStockFilter, setAppliedStockFilter] = useState<number | null>(null);
  const [stockFilterGreater, setStockFilterGreater] = useState<string>('');
  const [appliedStockFilterGreater, setAppliedStockFilterGreater] = useState<number | null>(null);

  // Sort states
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [companyName, setCompanyName] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { code: '', name: '', description: '', size: '', hsn: '', gst: '', dp: 0, opening_stock: 0, category_id: null },
  });

  useEffect(() => {
    if (selectedProduct) {
      form.reset({
        code: selectedProduct.code,
        name: selectedProduct.name,
        description: selectedProduct.description || '',
        size: selectedProduct.size || '',
        hsn: selectedProduct.hsn || '',
        gst: selectedProduct.gst || '',
        dp: selectedProduct.dp,
        opening_stock: selectedProduct.opening_stock,
        category_id: selectedProduct.category_id || null,
      });
    }
  }, [selectedProduct, form]);

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

  const fetchProducts = useCallback(async () => {
    if (!user || !isAuthorized) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let query = supabase
        .from('products')
        .select('id, code, name, description, size, hsn, gst, dp, opening_stock, stock_in, stock_out, closing_stock, user_id, sales(count), categories(id, name)');
      
      if (appliedSearchTerm) {
        query = query.or(`name.ilike.%${appliedSearchTerm}%,code.ilike.%${appliedSearchTerm}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      setProducts((data || []).map((p: any) => ({
        ...p,
        has_sales: (p.sales?.[0]?.count || 0) > 0,
      })));

      const { data: categoriesData, error: categoriesError } = await supabase.from('categories').select('id, name');
      if (!categoriesError) {
        setCategories(categoriesData || []);
      }

    } catch (error: any) {
      console.error('Error fetching products:', error);
      showError(`Failed to load products: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [user, appliedSearchTerm, isAuthorized]);

  useEffect(() => {
    if (!sessionLoading && user && isAuthorized) {
      fetchProducts();
      fetchCompanyInfo();
    }
  }, [sessionLoading, user, isAuthorized, fetchProducts, fetchCompanyInfo]);

  const handleApplyFilters = () => {
    setAppliedSearchTerm(searchTerm);
    setAppliedStockFilter(stockFilter ? Number(stockFilter) : null);
    setAppliedStockFilterGreater(stockFilterGreater ? Number(stockFilterGreater) : null);
    setCurrentPage(1); // Reset to first page on filter change
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setAppliedSearchTerm('');
    setStockFilter('');
    setAppliedStockFilter(null);
    setStockFilterGreater('');
    setAppliedStockFilterGreater(null);
    setCurrentPage(1); // Reset to first page on clear
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
    setCurrentPage(1); // Reset to first page on sort change
  };

  const handleEdit = (product: Product) => {
    setSelectedProduct(product);
    setIsEditDialogOpen(true);
  };

  const handleUpdateProduct = async (values: z.infer<typeof formSchema>) => {
    if (!selectedProduct || !session) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(UPDATE_PRODUCT_EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          productId: selectedProduct.id,
          ...values,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update product');
      }
      
      showSuccess('Product updated successfully!');
      setIsEditDialogOpen(false);
      fetchProducts();
      onProductAction?.();
    } catch (error: any) {
      console.error('Error updating product:', error);
      showError(`Failed to update product: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (productId: string) => {
    try {
      const { error } = await supabase.from('products').delete().eq('id', productId);
      if (error) throw error;
      
      showSuccess('Product deleted successfully!');
      fetchProducts();
      onProductAction?.();
    } catch (error: any) {
      showError(`Failed to delete product: ${error.message}`);
    }
  };

  const sortedAndFilteredProducts = useMemo(() => {
    let filtered = products.filter(product => {
      const calculatedClosing = (product.opening_stock || 0) + (product.stock_in || 0) - (product.stock_out || 0);
      
      const matchesLess = appliedStockFilter === null || calculatedClosing <= appliedStockFilter;
      const matchesGreater = appliedStockFilterGreater === null || calculatedClosing >= appliedStockFilterGreater;
      
      return matchesLess && matchesGreater;
    });

    return filtered.sort((a, b) => {
      let valA: any;
      let valB: any;

      if (sortKey === 'calculated_closing') {
        valA = (a.opening_stock || 0) + (a.stock_in || 0) - (a.stock_out || 0);
        valB = (b.opening_stock || 0) + (b.stock_in || 0) - (b.stock_out || 0);
      } else {
        valA = a[sortKey as keyof Product];
        valB = b[sortKey as keyof Product];
      }

      if (typeof valA === 'string') {
        const comparison = valA.localeCompare(valB as string);
        return sortDirection === 'asc' ? comparison : -comparison;
      } else {
        const comparison = (valA as number) - (valB as number);
        return sortDirection === 'asc' ? comparison : -comparison;
      }
    });
  }, [products, appliedStockFilter, appliedStockFilterGreater, sortKey, sortDirection]);

  // Pagination logic
  const totalPages = Math.ceil(sortedAndFilteredProducts.length / PAGE_SIZE);
  const paginatedProducts = useMemo(() => {
    return sortedAndFilteredProducts.slice(
      (currentPage - 1) * PAGE_SIZE,
      currentPage * PAGE_SIZE
    );
  }, [sortedAndFilteredProducts, currentPage]);

  const handlePrint = () => {
    try {
      const doc = new jsPDF({
        orientation: 'landscape'
      });

      const companyNameText = companyName ? companyName.toUpperCase() : "COMPANY NAME";
      doc.setFontSize(22);
      doc.text(companyNameText, doc.internal.pageSize.width / 2, 15, { align: 'center' });
      doc.setFontSize(18);
      doc.text("Product Inventory Report", doc.internal.pageSize.width / 2, 25, { align: 'center' });
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, doc.internal.pageSize.width / 2, 32, { align: 'center' });

      let filterDetails = [];
      if (appliedSearchTerm) filterDetails.push(`Search: "${appliedSearchTerm}"`);
      if (appliedStockFilter !== null) filterDetails.push(`Stock <= ${appliedStockFilter}`);
      if (appliedStockFilterGreater !== null) filterDetails.push(`Stock >= ${appliedStockFilterGreater}`);

      if (filterDetails.length > 0) {
        doc.setFontSize(9);
        doc.text(`Filters: ${filterDetails.join(' | ')}`, doc.internal.pageSize.width / 2, 38, { align: 'center' });
      }

      const tableColumn = ["Code", "Product Name", "Opening", "Stock In", "Stock Out", "Closing", "DP (₹)"];
      const tableRows = sortedAndFilteredProducts.map(product => {
        const calculatedClosing = (product.opening_stock || 0) + (product.stock_in || 0) - (product.stock_out || 0);
        return [
          product.code,
          product.name,
          product.opening_stock.toString(),
          `+${product.stock_in}`,
          `-${product.stock_out}`,
          calculatedClosing.toString(),
          product.dp.toFixed(2),
        ];
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 45,
        styles: {
          fontSize: 8,
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
        margin: { top: 10, left: 10, right: 10 },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 25, halign: 'right' },
          3: { cellWidth: 25, halign: 'right' },
          4: { cellWidth: 25, halign: 'right' },
          5: { cellWidth: 25, halign: 'right' },
          6: { cellWidth: 30, halign: 'right' },
        }
      });

      doc.save('product_inventory_report.pdf');
      showSuccess('Product report generated successfully!');
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      showError(`Failed to generate report: ${error.message || 'An unknown error occurred.'}`);
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ChevronsUpDown className="ml-1 h-3 w-3 opacity-50" />;
    return sortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />;
  };

  if (!isAuthorized) return null;
  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <Card className="bg-card text-card-foreground shadow-lg h-full">
      <CardHeader className="bg-blue-500 dark:bg-blue-700 text-white rounded-t-lg p-4">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-xl font-semibold">Manage All Products</CardTitle>
            <CardDescription className="text-blue-100 dark:text-blue-200">Inventory tracking: Opening + In - Out = Closing</CardDescription>
          </div>
          <Button variant="outline" onClick={handlePrint} className="bg-white text-blue-600 hover:bg-blue-50">
            <Printer className="h-4 w-4 mr-2" /> Print Report
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-muted rounded-lg">
          <div className="flex-1 min-w-[200px]">
            <Label htmlFor="productSearch">Search</Label>
            <Input id="productSearch" placeholder="Name or Code" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="stockFilterGreater">Closing Stock Greater Than</Label>
            <Input id="stockFilterGreater" type="number" placeholder="e.g. 10" value={stockFilterGreater} onChange={(e) => setStockFilterGreater(e.target.value)} />
          </div>
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="stockFilter">Closing Stock Less Than</Label>
            <Input id="stockFilter" type="number" placeholder="e.g. 50" value={stockFilter} onChange={(e) => setStockFilter(e.target.value)} />
          </div>
          <Button onClick={handleApplyFilters}><Search className="h-4 w-4 mr-2" /> Apply Filters</Button>
          <Button variant="outline" onClick={handleClearFilters}>Clear</Button>
        </div>
        
        <div className="overflow-x-auto border rounded-md">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow className="bg-muted">
                <TableHead className="cursor-pointer hover:bg-muted/80" onClick={() => handleSort('code')}>
                  <div className="flex items-center">Code <SortIcon column="code" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/80" onClick={() => handleSort('name')}>
                  <div className="flex items-center">Name <SortIcon column="name" /></div>
                </TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right cursor-pointer hover:bg-muted/80" onClick={() => handleSort('dp')}>
                  <div className="flex items-center justify-end">DP (₹) <SortIcon column="dp" /></div>
                </TableHead>
                <TableHead className="text-right cursor-pointer hover:bg-muted/80" onClick={() => handleSort('gst')}>
                  <div className="flex items-center justify-end">GST (%) <SortIcon column="gst" /></div>
                </TableHead>
                <TableHead className="text-right cursor-pointer hover:bg-muted/80" onClick={() => handleSort('opening_stock')}>
                  <div className="flex items-center justify-end">Opening <SortIcon column="opening_stock" /></div>
                </TableHead>
                <TableHead className="text-right cursor-pointer hover:bg-muted/80" onClick={() => handleSort('stock_in')}>
                  <div className="flex items-center justify-end">Stock In <SortIcon column="stock_in" /></div>
                </TableHead>
                <TableHead className="text-right cursor-pointer hover:bg-muted/80" onClick={() => handleSort('stock_out')}>
                  <div className="flex items-center justify-end">Stock Out <SortIcon column="stock_out" /></div>
                </TableHead>
                <TableHead className="text-right font-bold cursor-pointer hover:bg-muted/80" onClick={() => handleSort('calculated_closing')}>
                  <div className="flex items-center justify-end gap-1">
                    Closing <SortIcon column="calculated_closing" />
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 cursor-help text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Formula: Opening + In - Out</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    No products found matching your filters.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedProducts.map((product) => {
                  const calculatedClosingStock = (product.opening_stock || 0) + (product.stock_in || 0) - (product.stock_out || 0);
                  const rawGst = parseFloat(product.gst as any) || 0;
                  const gstDisplay = rawGst > 0 && rawGst <= 1 ? rawGst * 100 : rawGst;
                  
                  return (
                    <TableRow key={product.id} className="hover:bg-accent/50">
                      <TableCell className="font-medium">{product.code}</TableCell>
                      <TableCell>{product.name}</TableCell>
                      <TableCell>{product.categories?.name || 'N/A'}</TableCell>
                      <TableCell className="text-right">₹{product.dp.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{String(Number(gstDisplay))}%</TableCell>
                      <TableCell className="text-right">{product.opening_stock}</TableCell>
                      <TableCell className="text-right text-green-600">+{product.stock_in}</TableCell>
                      <TableCell className="text-right text-red-600">-{product.stock_out}</TableCell>
                      <TableCell className="text-right font-bold">{calculatedClosingStock}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(product)}><Edit className="h-4 w-4" /></Button>
                          {isAuthorized && (
                            <AlertDialog>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span tabIndex={product.has_sales ? 0 : -1}>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" disabled={product.has_sales}>
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                      </AlertDialogTrigger>
                                    </span>
                                  </TooltipTrigger>
                                  {product.has_sales && (
                                    <TooltipContent>
                                      <p>Cannot delete products with sales history.</p>
                                    </TooltipContent>
                                  )}
                                </Tooltip>
                              </TooltipProvider>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Product?</AlertDialogTitle>
                                  <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(product.id)}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 px-2">
            <p className="text-sm text-muted-foreground">
              Showing page {currentPage} of {totalPages} ({sortedAndFilteredProducts.length} total products)
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {selectedProduct && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit Product: {selectedProduct.name}</DialogTitle>
              <DialogDescription>Update product details. Stock movements (In/Out) are managed by orders and receipts.</DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh] pr-4">
              <form onSubmit={form.handleSubmit(handleUpdateProduct)} className="space-y-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="code" className="text-right">Code</Label>
                  <Input id="code" {...form.register('code')} className="col-span-3" disabled={isSubmitting} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">Name</Label>
                  <Input id="name" {...form.register('name')} className="col-span-3" disabled={isSubmitting} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="description" className="text-right">Description</Label>
                  <Textarea id="description" {...form.register('description')} className="col-span-3" disabled={isSubmitting} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Category</Label>
                  <div className="col-span-3">
                    <FormField
                      control={form.control}
                      name="category_id"
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="size" className="text-right">Size</Label>
                  <Input id="size" {...form.register('size')} className="col-span-3" disabled={isSubmitting} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="hsn" className="text-right">HSN</Label>
                  <Input id="hsn" {...form.register('hsn')} className="col-span-3" disabled={isSubmitting} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="gst" className="text-right">GST (%)</Label>
                  <Input id="gst" {...form.register('gst')} className="col-span-3" disabled={isSubmitting} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="dp" className="text-right">DP (₹)</Label>
                  <Input id="dp" type="number" step="0.01" {...form.register('dp')} className="col-span-3" disabled={isSubmitting} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="opening_stock" className="text-right">Opening Stock</Label>
                  <Input id="opening_stock" type="number" {...form.register('opening_stock')} className="col-span-3" disabled={isSubmitting} />
                </div>
                
                <Separator />
                
                <div className="bg-muted p-3 rounded-md space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Stock In (Receipts):</span>
                    <span className="font-medium text-green-600">+{selectedProduct.stock_in}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Stock Out (Sales):</span>
                    <span className="font-medium text-red-600">-{selectedProduct.stock_out}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-bold">
                    <span>Current Closing Stock:</span>
                    <span>{(form.watch('opening_stock') || 0) + selectedProduct.stock_in - selectedProduct.stock_out}</span>
                  </div>
                </div>
              </form>
            </ScrollArea>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
              <Button type="submit" onClick={form.handleSubmit(handleUpdateProduct)} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
};

export default ProductTableManager;