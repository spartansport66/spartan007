"use client";
import React, { useEffect } from 'react';
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
import { ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';

const productSchema = z.object({
  code: z.string().min(1, { message: 'Product Code is required.' }).trim(),
  name: z.string().min(2, { message: 'Product name must be at least 2 characters.' }).trim(),
  description: z.string().nullable().optional().transform(val => val ? val.trim() : null),
  size: z.coerce.string().nullable().optional().transform(val => val ? val.trim() : null),
  hsn: z.coerce.string().nullable().optional().transform(val => val ? val.trim() : null),
  gst: z.coerce.string().nullable().optional().transform(val => val ? val.trim() : null),
  dp: z.preprocess(
    (val) => {
      if (typeof val === 'string') {
        const trimmedVal = val.trim();
        if (trimmedVal === '') return undefined;
        const num = parseFloat(trimmedVal);
        return isNaN(num) ? trimmedVal : num;
      }
      return val;
    },
    z.coerce.number()
      .min(0, { message: 'Dealer Price cannot be negative.' })
      .transform(val => Math.round(val))
      .default(0)
  ),
  opening_stock: z.preprocess(
    (val) => {
      if (typeof val === 'string') {
        const trimmedVal = val.trim();
        if (trimmedVal === '') return undefined;
        const num = parseFloat(trimmedVal);
        return isNaN(num) ? trimmedVal : num;
      }
      return val;
    },
    z.coerce.number()
      .min(0, { message: 'Opening Stock cannot be negative.' })
      .transform(val => Math.round(val))
      .default(0)
  ),
});

const AddProduct = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, userType } = useSession();
  const isAuthorized = userType === 'admin' || userType === 'inventory_manager';

  const form = useForm<z.infer<typeof productSchema>>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      code: '',
      name: '',
      description: '',
      size: '',
      hsn: '',
      gst: '',
      dp: 0,
      opening_stock: 0,
    },
  });

  useEffect(() => {
    if (!sessionLoading && !user) {
      navigate('/login');
    } else if (!sessionLoading && user && !isAuthorized) {
      showError('Access Denied: Only authorized personnel can add products.');
      navigate('/dashboard');
    }
  }, [sessionLoading, user, isAuthorized, navigate]);

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
          user_id: user.id,
          code: values.code,
          name: values.name,
          description: values.description,
          size: values.size,
          hsn: values.hsn,
          gst: values.gst,
          dp: values.dp,
          opening_stock: values.opening_stock,
          closing_stock: values.opening_stock, // Initially closing equals opening
        },
      ])
      .select();

    if (error) {
      console.error('Error adding product:', error);
      showError(`Failed to add product: ${error.message}`);
    } else {
      showSuccess('Product added successfully!');
      form.reset();
      navigate(userType === 'admin' ? '/product-management-console' : '/product-dashboard');
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

  if (!isAuthorized) return null;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl">
        <Button 
          variant="outline" 
          onClick={() => navigate(userType === 'admin' ? '/product-management-console' : '/product-dashboard')} 
          className="mb-6 flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Product Console
        </Button>
        
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                          <Input placeholder="e.g., 18" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="dp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dealer Price (DP)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g., 1000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="opening_stock"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Opening Stock</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g., 50" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                  Add Product
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default AddProduct;