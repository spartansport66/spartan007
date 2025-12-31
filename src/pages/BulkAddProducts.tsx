"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { ArrowLeft, Upload, Download, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { useSession } from '@/contexts/SessionContext';
import * as XLSX from '@sheetjs/sheetjs';
import * as z from 'zod';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// IMPORTANT: Replace with the actual URL of your deployed Edge Function
const BULK_ADD_PRODUCTS_EDGE_FUNCTION_URL = "https://hxftiocfihhdutciaisl.supabase.co/functions/v1/bulk-add-products";

const productSchema = z.object({
  name: z.string().min(2, { message: 'Product name must be at least 2 characters.' }),
  description: z.string().optional().nullable(),
  price: z.number().min(0.01, { message: 'Price must be a positive number.' }),
  stock: z.number().int().min(0, { message: 'Stock cannot be negative.' }),
});

interface ParsedProduct extends z.infer<typeof productSchema> {
  user_id: string; // Add user_id for the Edge Function
  originalRow: number; // For error reporting
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
      setParsedProducts([]); // Clear previous data
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

    setLoading(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet);

        const validatedProducts: ParsedProduct[] = json.map((row, index) => {
          const productData = {
            name: row['Product Name'],
            description: row['Description'],
            price: row['Price'],
            stock: row['Stock'],
          };

          const result = productSchema.safeParse(productData);
          if (result.success) {
            return {
              ...result.data,
              user_id: user.id!,
              originalRow: index + 2, // +1 for 0-index to 1-index, +1 for header row
              isValid: true,
              errors: [],
            };
          } else {
            return {
              ...productData, // Keep original data for display
              user_id: user.id!,
              originalRow: index + 2,
              isValid: false,
              errors: result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`),
            };
          }
        });
        setParsedProducts(validatedProducts);
        showSuccess('Excel file parsed. Review data before uploading.');
      } catch (error: any) {
        console.error('Error parsing Excel file:', error);
        showError(`Failed to parse Excel file: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    reader.onerror = (error) => {
      console.error('FileReader error:', error);
      showError('Error reading file.');
      setLoading(false);
    };

    reader.readAsBinaryString(file);
  };

  const handleBulkUpload = async () => {
    const validProducts = parsedProducts.filter(p => p.isValid);
    if (validProducts.length === 0) {
      showError('No valid products to upload. Please correct errors in the sheet.');
      return;
    }

    setLoading(true);
    try {
      const productsToUpload = validProducts.map(({ name, description, price, stock, user_id }) => ({
        name,
        description,
        price,
        stock,
        user_id,
      }));

      const response = await fetch(BULK_ADD_PRODUCTS_EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ products: productsToUpload }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to bulk add products');
      }

      showSuccess(`${data.products.length} products added successfully!`);
      setFile(null);
      setParsedProducts([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = ''; // Clear file input
      }
      navigate('/product-management-console'); // Go back to console
    } catch (error: any) {
      console.error('Error during bulk upload:', error);
      showError(`Failed to bulk add products: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadSample = () => {
    const ws = XLSX.utils.json_to_sheet([
      { "Product Name": "Sample Product A", "Description": "Description for product A", "Price": 19.99, "Stock": 100 },
      { "Product Name": "Sample Product B", "Description": "Description for product B", "Price": 29.50, "Stock": 50 },
      { "Product Name": "Sample Product C", "Description": null, "Price": 5.00, "Stock": 200 }, // Description can be empty/null
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products");
    XLSX.writeFile(wb, "sample_products_template.xlsx");
    showSuccess('Sample Excel template downloaded!');
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
            <p className="text-sm text-muted-foreground">
              Please ensure your Excel sheet has columns named "Product Name", "Description", "Price", and "Stock".
              "Description" is optional.
            </p>
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
                      <TableRow key={index} className={product.isValid ? 'hover:bg-accent/50' : 'bg-red-50 dark:bg-red-950 hover:bg-red-100 dark:hover:bg-red-900'}>
                        <TableCell className="font-medium text-foreground">{product.originalRow}</TableCell>
                        <TableCell>
                          {product.isValid ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" title="Valid" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive" title="Invalid" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium text-foreground">{product.name || 'N/A'}</TableCell>
                        <TableCell className="text-muted-foreground">{product.description || 'N/A'}</TableCell>
                        <TableCell className="text-muted-foreground text-right">
                          {typeof product.price === 'number' ? `₹${product.price.toFixed(2)}` : 'N/A'}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-right">
                          {typeof product.stock === 'number' ? product.stock : 'N/A'}
                        </TableCell>
                        <TableCell className="text-destructive text-sm">
                          {product.errors.length > 0 ? product.errors.join(', ') : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Button
                onClick={handleBulkUpload}
                disabled={loading || parsedProducts.filter(p => p.isValid).length === 0}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {loading ? 'Uploading...' : `Upload ${parsedProducts.filter(p => p.isValid).length} Valid Products`}
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