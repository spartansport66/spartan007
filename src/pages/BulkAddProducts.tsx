"use client";

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { ArrowLeft, Upload, Loader2 } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { useSession } from '@/contexts/SessionContext';
import * as z from 'zod';
import ExcelUpload from '@/components/ExcelUpload'; // Import the generic ExcelUpload component

// IMPORTANT: Replace with the actual URL of your deployed Edge Function
const BULK_ADD_PRODUCTS_EDGE_FUNCTION_URL = "https://hxftiocfihhdutciaisl.supabase.co/functions/v1/bulk-add-products";

// Zod schema for product validation
const productSchema = z.object({
  code: z.string().min(1, { message: 'Product Code is required.' }),
  name: z.string().min(2, { message: 'Product name must be at least 2 characters.' }),
  description: z.string().nullable().optional(),
  size: z.coerce.string().nullable().optional(), // Coerce size to string
  hsn: z.coerce.string().nullable().optional(), // Coerce HSN to string
  gst: z.coerce.number().min(0, { message: 'GST cannot be negative.' }).max(100, { message: 'GST cannot exceed 100.' }).default(0), // Default to 0
  dp: z.coerce.number().min(0.01, { message: 'Dealer Price must be a positive number.' }).default(0.01), // Default to min value
  mrp: z.coerce.number().min(0.01, { message: 'MRP must be a positive number.' }).default(0.01), // Default to min value
  stock: z.coerce.number().int().min(0, { message: 'Stock cannot be negative.' }).default(0), // Default to 0
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
  { key: 'mrp', label: 'MRP' },
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
    "GST (%)": 18,
    "Dealer Price (DP)": 1000.00,
    "MRP": 1200.00,
    "Stock": 50
  },
  {
    "Product Code": 'P002',
    "Product Name": 'Wireless Mouse',
    "Description": 'Ergonomic wireless mouse.',
    "Size": 'Small',
    "HSN": '8471',
    "GST (%)": 18,
    "Dealer Price (DP)": 15.00,
    "MRP": 20.00,
    "Stock": 200
  }
];

const BulkAddProducts = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, isAdmin } = useSession();
  const [loadingUpload, setLoadingUpload] = useState(false); // Renamed to avoid conflict with ExcelUpload's internal loading

  useEffect(() => {
    if (!sessionLoading && !user) {
      navigate('/login');
    } else if (!sessionLoading && user && !isAdmin) {
      showError('Access Denied: Only administrators can bulk add products.');
      navigate('/dashboard');
    }
  }, [sessionLoading, user, isAdmin, navigate]);

  const handleBulkUpload = async (productsToUpload: z.infer<typeof productSchema>[]) => {
    if (!user) {
      showError('User not authenticated. Please log in again.');
      return;
    }
    
    setLoadingUpload(true);
    
    try {
      const response = await fetch(BULK_ADD_PRODUCTS_EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          products: productsToUpload.map(p => ({
            name: p.name,
            description: p.description,
            price: p.mrp, // Use MRP as price for the edge function
            stock: p.stock,
            user_id: user.id,
            code: p.code,
            size: p.size,
            hsn: p.hsn,
            gst: p.gst,
            dp: p.dp,
          }))
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload products');
      }
      
      showSuccess(data.message);
      navigate('/product-management-console'); // Navigate after successful bulk upload
    } catch (error: any) {
      console.error('Error uploading products:', error);
      showError(`Failed to upload products: ${error.message}`);
    } finally {
      setLoadingUpload(false);
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

        <ExcelUpload
          onUpload={handleBulkUpload}
          sampleData={productSampleData}
          sampleFileName="sample_products.xlsx"
          uploadButtonText="Upload Products"
          displayHeaders={productDisplayHeaders}
          validationSchema={productSchema}
        />
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default BulkAddProducts;