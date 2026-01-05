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
import ExcelUpload from '@/components/ExcelUpload';

const formSchema = z.object({
  name: z.string().min(2, { message: 'Product name must be at least 2 characters.' }),
  description: z.string().optional(),
  price: z.preprocess(
    (val) => Number(val),
    z.number().min(0.01, { message: 'Price must be a positive number.' })
  ),
  stock: z.preprocess(
    (val) => Number(val),
    z.number().int().min(0, { message: 'Stock cannot be negative.' })
  ),
});

const AddProduct = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, isAdmin } = useSession();
  const [isUploading, setIsUploading] = useState(false);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      price: 0.01,
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

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
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
          name: values.name,
          description: values.description,
          price: values.price,
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

  const handleBulkUpload = async (data: any[]) => {
    if (!user) {
      showError('You must be logged in to add products.');
      navigate('/login');
      return;
    }

    setIsUploading(true);
    try {
      // Transform data to match product schema
      const productsToInsert = data.map((row: any) => ({
        user_id: user.id,
        name: row.name || row.Name || row['Product Name'] || '',
        description: row.description || row.Description || row['Product Description'] || '',
        price: parseFloat(row.price || row.Price || row['Unit Price'] || '0'),
        stock: parseInt(row.stock || row.Stock || row['Quantity'] || '0'),
      }));

      const { data: insertedData, error } = await supabase
        .from('products')
        .insert(productsToInsert)
        .select();

      if (error) {
        throw error;
      }

      showSuccess(`Successfully uploaded ${insertedData?.length || 0} products!`);
      navigate('/manage-products');
    } catch (error: any) {
      console.error('Error uploading products:', error);
      showError(`Failed to upload products: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
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

  const sampleProductData = [
    {
      name: 'Product A',
      description: 'Description for Product A',
      price: 29.99,
      stock: 100
    },
    {
      name: 'Product B',
      description: 'Description for Product B',
      price: 39.99,
      stock: 50
    },
    {
      name: 'Product C',
      description: 'Description for Product C',
      price: 19.99,
      stock: 200
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl">
        <Button variant="outline" onClick={() => navigate('/admin-dashboard')} className="mb-6 flex items-center gap-2">
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
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea placeholder="e.g., High-performance laptop for professionals." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="e.g., 1200.00" {...field} />
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
              sampleData={sampleProductData}
              sampleFileName="sample_products.xlsx"
              uploadButtonText="Upload Products"
              tableHeaders={['Name', 'Description', 'Price', 'Stock']}
              requiredHeaders={['name', 'price', 'stock']}
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
                  <li>Required columns: Name, Price, Stock</li>
                  <li>Description is optional</li>
                  <li>Price should be a number (e.g., 29.99)</li>
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