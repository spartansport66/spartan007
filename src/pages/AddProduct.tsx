"use client";
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { showSuccess, showError } from '@/utils/toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { ArrowLeft, Loader2, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import ExcelUpload from '@/components/ExcelUpload'; // Updated import

// Zod schema for product validation
const productSchema = z.object({
  code: z.string().min(1, { message: 'Product Code is required.' }),
  name: z.string().min(2, { message: 'Product name must be at least 2 characters.' }),
  description: z.string().nullable().optional(),
  size: z.coerce.string().nullable().optional(), // Coerce size to string
  hsn: z.coerce.string().nullable().optional(), // Coerce HSN to string
  gst: z.coerce.string().nullable().optional(), // Changed to string for alphanumeric
  dp: z.preprocess(
    (val) => (val === "" ? undefined : val), // Convert empty string to undefined
    z.coerce.number()
      .int({ message: 'Dealer Price must be a whole number.' }) // Apply .int() first
      .min(0, { message: 'Dealer Price cannot be negative.' }) // Apply .min() next
      .transform(val => Math.round(val)) // Then transform
      .default(0) // Default to 0
  ),
  stock: z.preprocess(
    (val) => (val === "" ? undefined : val), // Convert empty string to undefined
    z.coerce.number()
      .int() // Apply .int() first
      .min(0, { message: 'Stock cannot be negative.' }) // Apply .min() next
      .transform(val => Math.round(val)) // Then transform
      .default(0) // Default to 0
  ),
});

// Define display headers for the ExcelUpload component
const productDisplayHeaders = [
  { key: 'code', label: 'Product Code' },
  { key: 'name', label: 'Product Name' },
  { key: 'description', label: 'Description' },
  { key: 'size', label: 'Size' },
  { key: 'hsn', label: 'HSN' },
  { key: 'gst', label: 'GST (%)' },
  { key: 'dp', label: 'Dealer Price (DP)' },
  { key: 'stock', label: 'Stock' },
];

// Sample data for the ExcelUpload component
const productSampleData = [
  {
    "Product Code": 'P001',
    "Product Name": 'Laptop Pro X',
    "Description": 'High-performance laptop for professionals.',
    "Size": '15 inch',
    "HSN": '8471',
    "GST (%)": "18", 
    "Dealer Price (DP)": 1000, // Changed to integer
    "Stock": 50
  },
  {
    "Product Code": 'P002',
    "Product Name": 'Wireless Mouse',
    "Description": 'Ergonomic wireless mouse.',
    "Size": 'Small',
    "HSN": '8471',
    "GST (%)": "Exempt", 
    "Dealer Price (DP)": 15, // Changed to integer
    "Stock": 200
  }
];

const AddProduct = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, isAdmin } = useSession();
  const form = useForm<z.infer<typeof productSchema>>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      code: '',
      name: '',
      description: '',
      size: '',
      hsn: '',
      gst: '', // Default to empty string
      dp: 0, // Default to 0
      stock: 0,
    },
  });

  useEffect(() => {
    if (!sessionLoading && !user) {
      navigate('/login');
    } else if (!sessionLoading && user && !isAdmin) {
      showError('Access Denied: Only administrators can add products.');
      navigate('/dashboard'); // Sales persons go to their dashboard
    }
  }, [sessionLoading, user, isAdmin, navigate]);

  const onSubmit = async (values: z.infer<typeof productSchema>) => {
    if (!user) {
      showError('You must be logged in to add a product.');
      navigate('/login');
      return;
    }

    const { data, error } = await supabase
      .from('products')
      .insert([
        {
          user_id: user.id, // Creator of the product (admin)
          code: values.code,
          name: values.name,
          description: values.description,
          size: values.size,
          hsn: values.hsn,
          gst: values.gst,
          dp: values.dp,
          stock: values.stock,
        },
      ])
      .select();

    if (error) {
      console.error('Error adding product:', error);
      showError(`Failed to add product: ${error.message}`);
    } else {
      showSuccess('Product added successfully!');
      form.reset();
      console.log('New Product Data:', data);
      navigate('/manage-products');
    }
  };

  const handleBulkUpload = async (productsToUpload: z.infer<typeof productSchema>[]) => {
    if (!user) {
      showError('You must be logged in to bulk add products.');
      return;
    }

    const itemsToInsert = productsToUpload.map(product => ({
      user_id: user.id,
      code: product.code,
      name: product.name,
      description: product.description,
      size: product.size,
      hsn: product.hsn,
      gst: product.gst,
      dp: product.dp,
      stock: product.stock,
    }));

    const { data: insertedItems, error: insertError } = await supabase
      .from('products')
      .insert(itemsToInsert)
      .select();

    if (insertError) {
      throw insertError;
    }
    showSuccess(`Successfully uploaded ${insertedItems.length} products!`);
    navigate('/manage-products'); // Navigate after successful bulk upload
  };

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading...</p>
      </div>
      );
  }

  if (!isAdmin) {
    return null; // Render nothing if not admin, as they are redirected
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl">
        <Button 
          variant="outline" 
          onClick={() => navigate('/admin-dashboard')} 
          className="mb-6 flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Admin Dashboard
        </Button>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-card text-card-foreground shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold text-primary">Add New Product</CardTitle>
              <CardDescription className="text-muted-foreground">Enter the details for a new product.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Product Code</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., P001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Product Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Laptop Pro X" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="e.g., High-performance laptop for professionals." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="size"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Size (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 15 inch" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="hsn"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>HSN (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 8471" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="gst"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>GST (%)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 18 or Exempt" {...field} /> {/* Changed type to text */}
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dealer Price (DP)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g., 1000" {...field} /> {/* Removed step="0.01" */}
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="stock"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stock Quantity</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g., 50" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                    Add Product
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
          
          <div className="space-y-6">
            <ExcelUpload
              onUpload={handleBulkUpload}
              sampleData={productSampleData}
              sampleFileName="sample_products.xlsx"
              uploadButtonText="Upload Products"
              displayHeaders={productDisplayHeaders}
              validationSchema={productSchema}
              // Exclude 'MRP' from mapping
              excludedSourceHeaders={['MRP']}
            />
            
            <Card className="bg-card text-card-foreground shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Bulk Upload Instructions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc pl-5 space-y-2 text-sm">
                  <li>Download the sample Excel file to see the required format</li>
                  <li>Required columns: Product Code, Product Name, Dealer Price (DP), Stock</li>
                  <li>Description, Size, HSN, GST are optional</li>
                  <li>Prices (DP) should be whole numbers (e.g., 1000, 15)</li>
                  <li>GST can be a number or text (e.g., 18 or Exempt)</li>
                  <li>Stock should be a whole number (e.g., 100)</li>
                  <li>Save your file as .xlsx or .xls format</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default AddProduct;