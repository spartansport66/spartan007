"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { ArrowLeft, Upload, Download, Loader2, AlertTriangle } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { useSession } from '@/contexts/SessionContext';
import * as XLSX from 'xlsx'; // Updated import
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
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Assume first sheet is the one we want
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length < 2) {
          showError('Excel file is empty or has no data rows.');
          setLoading(false);
          return;
        }
        
        // Assume first row is header
        const headers = jsonData[0] as string[];
        const requiredHeaders = ['name', 'description', 'price', 'stock'];
        
        // Check if all required headers are present
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
        if (missingHeaders.length > 0) {
          showError(`Missing required columns: ${missingHeaders.join(', ')}`);
          setLoading(false);
          return;
        }
        
        // Process data rows
        const products: ParsedProduct[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row) continue;
          
          const productData: any = {};
          headers.forEach((header, index) => {
            productData[header] = row[index];
          });
          
          try {
            // Validate with zod
            const validatedProduct = productSchema.parse({
              name: productData.name,
              description: productData.description || null,
              price: parseFloat(productData.price),
              stock: parseInt(productData.stock)
            });
            
            products.push({
              ...validatedProduct,
              user_id: user.id,
              originalRow: i + 1,
              isValid: true,
              errors: []
            });
          } catch (validationError: any) {
            const fieldErrors = validationError.errors.map((err: any) => err.message).join(', ');
            products.push({
              name: productData.name || 'N/A',
              description: productData.description || null,
              price: parseFloat(productData.price) || 0,
              stock: parseInt(productData.stock) || 0,
              user_id: user.id,
              originalRow: i + 1,
              isValid: false,
              errors: [fieldErrors]
            });
          }
        }
        
        setParsedProducts(products);
        showSuccess(`Parsed ${products.length} products from Excel file.`);
      } catch (error: any) {
        console.error('Error parsing Excel file:', error);
        showError(`Error parsing Excel file: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };
    
    reader.onerror = () => {
      showError('Error reading file. Please try again.');
      setLoading(false);
    };
    
    reader.readAsArrayBuffer(file);
  };

  const handleBulkUpload = async () => {
    if (!user?.id) {
      showError('User not authenticated. Please log in again.');
      return;
    }
    
    const validProducts = parsedProducts.filter(p => p.isValid);
    if (validProducts.length === 0) {
      showError('No valid products to upload.');
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await fetch(BULK_ADD_PRODUCTS_EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          products: validProducts.map(p => ({
            name: p.name,
            description: p.description,
            price: p.price,
            stock: p.stock,
            user_id: p.user_id
          }))
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload products');
      }
      
      showSuccess(data.message);
      setParsedProducts([]);
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      console.error('Error uploading products:', error);
      showError(`Failed to upload products: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadSample = () => {
    try {
      // Create sample data
      const sampleData = [
        ['name', 'description', 'price', 'stock'],
        ['Product A', 'Description for Product A', 29.99, 100],
        ['Product B', 'Description for Product B', 39.99, 50],
        ['Product C', 'Description for Product C', 19.99, 200]
      ];
      
      // Create workbook and worksheet
      const ws = XLSX.utils.aoa_to_sheet(sampleData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Products');
      
      // Export to file
      XLSX.writeFile(wb, 'sample_products.xlsx');
      showSuccess('Sample Excel file downloaded successfully!');
    } catch (error: any) {
      console.error('Error creating sample file:', error);
      showError(`Failed to create sample file: ${error.message}`);
    }
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
            
            {!file && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>Tip:</strong> Download the sample Excel file to see the required format for bulk uploading products.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {parsedProducts.length > 0 && (
          <Card className="bg-card text-card-foreground shadow-lg">
            <CardHeader className="bg-purple-500 dark:bg-purple-700 text-white rounded-t-lg p-4">
              <CardTitle className="text-xl font-semibold">Review Products</CardTitle>
              <CardDescription className="text-purple-100 dark:text-purple-200">
                Review the parsed data. Only valid products will be uploaded.
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
                          {product.isValid ? (
                            <span className="text-green-600">Valid</span>
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
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
                        <TableCell className="text-yellow-600 dark:text-yellow-400 text-sm">
                          {product.errors.length > 0 ? product.errors.join(', ') : 'None'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-muted-foreground">
                  {parsedProducts.filter(p => p.isValid).length} valid products, {parsedProducts.filter(p => !p.isValid).length} invalid products
                </p>
                <Button
                  onClick={handleBulkUpload}
                  disabled={loading || parsedProducts.filter(p => p.isValid).length === 0}
                  className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {loading ? 'Uploading...' : 'Upload Valid Products'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default BulkAddProducts;