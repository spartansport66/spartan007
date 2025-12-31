"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { ArrowLeft, Upload, Download, Loader2, AlertTriangle } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { useSession } from '@/contexts/SessionContext';
// import * as XLSX from '@sheetjs/sheetjs'; // Temporarily commented out due to import error
import * as z from 'zod';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';

// IMPORTANT: Replace with the actual URL of your deployed Edge Function
const BULK_ADD_PRODUCTS_EDGE_FUNCTION_URL = "https://hxftiocfihhdutciaisl.supabase.co/functions/v1/bulk-add-products";

const productSchema = z.object({
  name: z.string().min(2, { message: 'Product name must be at least 2 characters.' }),
  description: z.string().optional().nullable(),
  price: z.number().min(0.01, { message: 'Price must be a positive number.' }),
  stock: z.number().int().min(0, { message: 'Stock cannot be negative.' }),
});

interface ParsedProduct extends z.infer<typeof productSchema> {
  user_id: string;
  originalRow: number;
  isValid: boolean;
  errors: string[];
}

const BulkAddProducts = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, isAdmin } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [parsedProducts, setParsedProducts] = useState<ParsedProduct[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!sessionLoading && !user) {
      navigate('/login');
    } else if (!sessionLoading && user && !isAdmin) {
      showError('Access Denied: Only administrators can bulk add products.');
      navigate('/dashboard');
    }
  }, [sessionLoading, user, isAdmin, navigate]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setParsedProducts([]);
      showError('Excel parsing is currently disabled due to a dependency issue. Please add products individually or fix the @sheetjs/sheetjs installation.');
    } else {
      setFile(null);
    }
  };

  const handleParseExcel = () => {
    if (!file) {
      showError('Please select an Excel file to upload.');
      return;
    }
    if (!user?.id) {
      showError('User not authenticated. Please log in again.');
      return;
    }

    showError('Excel parsing functionality is currently disabled. Please add products individually or fix the @sheetjs/sheetjs installation.');
    // setLoading(true);
    // // XLSX parsing logic would go here
    // setLoading(false);
  };

  const handleBulkUpload = async () => {
    showError('Bulk upload functionality is currently disabled. Please add products individually or fix the @sheetjs/sheetjs installation.');
    // // Upload logic would go here
  };

  const handleDownloadSample = () => {
    showError('Sample download functionality is currently disabled. Please add products individually or fix the @sheetjs/sheetjs installation.');
    // // Sample download logic would go here
  };

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading bulk add products page...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl">
        <Button variant="outline" onClick={() => navigate('/product-management-console')} className="mb-6 flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Product Console
        </Button>

        <Card className="bg-card text-card-foreground shadow-lg mb-6">
          <CardHeader className="bg-indigo-500 dark:bg-indigo-700 text-white rounded-t-lg p-4">
            <CardTitle className="text-xl font-semibold">Bulk Add Products from Excel</CardTitle>
            <CardDescription className="text-indigo-100 dark:text-indigo-200">
              Upload an Excel sheet to add multiple products to your inventory.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                ref={fileInputRef}
                className="flex-grow"
                disabled={loading}
              />
              <Button onClick={handleParseExcel} disabled={!file || loading} className="w-full sm:w-auto flex items-center gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {loading ? 'Parsing...' : 'Parse Excel'}
              </Button>
              <Button variant="outline" onClick={handleDownloadSample} disabled={loading} className="w-full sm:w-auto flex items-center gap-2">
                <Download className="h-4 w-4" /> Download Sample
              </Button>
            </div>
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
              <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                <span className="font-medium">Feature Temporarily Disabled</span>
              </div>
              <p className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                Excel parsing functionality is currently disabled due to a dependency installation issue. 
                Please add products individually or fix the <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">@sheetjs/sheetjs</code> installation.
              </p>
            </div>
          </CardContent>
        </Card>

        {parsedProducts.length > 0 && (
          <Card className="bg-card text-card-foreground shadow-lg">
            <CardHeader className="bg-purple-500 dark:bg-purple-700 text-white rounded-t-lg p-4">
              <CardTitle className="text-xl font-semibold">Review Products</CardTitle>
              <CardDescription className="text-purple-100 dark:text-purple-200">
                Review the parsed data. Products with errors will not be uploaded.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <div className="max-h-[500px] overflow-y-auto border rounded-md mb-4">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow className="bg-muted hover:bg-muted/90">
                      <TableHead className="text-muted-foreground">Row</TableHead>
                      <TableHead className="text-muted-foreground">Status</TableHead>
                      <TableHead className="text-muted-foreground">Product Name</TableHead>
                      <TableHead className="text-muted-foreground">Description</TableHead>
                      <TableHead className="text-muted-foreground text-right">Price</TableHead>
                      <TableHead className="text-muted-foreground text-right">Stock</TableHead>
                      <TableHead className="text-muted-foreground">Errors</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedProducts.map((product, index) => (
                      <TableRow key={index} className="hover:bg-accent/50">
                        <TableCell className="font-medium text-foreground">{product.originalRow}</TableCell>
                        <TableCell>
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        </TableCell>
                        <TableCell className="font-medium text-foreground">{product.name || 'N/A'}</TableCell>
                        <TableCell className="text-muted-foreground">{product.description || 'N/A'}</TableCell>
                        <TableCell className="text-muted-foreground text-right">
                          {typeof product.price === 'number' ? `₹${product.price.toFixed(2)}` : 'N/A'}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-right">
                          {typeof product.stock === 'number' ? product.stock : 'N/A'}
                        </TableCell>
                        <TableCell className="text-yellow-600 dark:text-yellow-400 text-sm">
                          Feature disabled - dependency issue
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Button
                onClick={handleBulkUpload}
                disabled={true}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2"
              >
                <Upload className="h-4 w-4" /> Upload Disabled
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default BulkAddProducts;