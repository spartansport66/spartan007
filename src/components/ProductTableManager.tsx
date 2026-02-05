"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { ArrowLeft, Edit, Trash2, Eye, Loader2, PlusCircle, Search } from 'lucide-react';
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

interface Product {
  id: string;
  code: string; // New
  name: string;
  description: string;
  size: string; // New
  hsn: string; // New
  gst: string; // Changed to string
  dp: number; // New
  stock: number;
  user_id: string;
  has_sales: boolean;
}

interface ProductTableManagerProps {
  onProductAction?: () => void; // Callback for parent to refresh data if needed
}

const formSchema = z.object({
  code: z.string().min(1, { message: 'Product Code is required.' }),
  name: z.string().min(2, { message: 'Product name must be at least 2 characters.' }),
  description: z.string().optional(),
  size: z.string().optional(),
  hsn: z.string().optional(),
  gst: z.string().optional(), // Changed to string
  dp: z.preprocess(
    (val) => Number(val), // Convert input to number
    z.number()
      .min(0, { message: 'Dealer Price cannot be negative.' })
  ),
  stock: z.preprocess(
    (val) => Number(val),
    z.number().int().min(0, { message: 'Stock cannot be negative.' })
  ),
});

// IMPORTANT: Replace with the actual URL of your deployed Edge Function
const UPDATE_PRODUCT_EDGE_FUNCTION_URL = "https://hxftiocfihhdutciaisl.supabase.co/functions/v1/update-product";

const ProductTableManager: React.FC<ProductTableManagerProps> = ({ onProductAction }) => {
  const { user, loading: sessionLoading, userType } = useSession();
  const isAuthorized = userType === 'admin' || userType === 'inventory_manager';

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  // New state for search filter
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [appliedSearchTerm, setAppliedSearchTerm] = useState<string>('');

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: '',
      name: '',
      description: '',
      size: '',
      hsn: '',
      gst: '', // Default to empty string
      dp: 0,
      stock: 0,
    },
  });

  useEffect(() => {
    if (selectedProduct) {
      form.reset({
        code: selectedProduct.code,
        name: selectedProduct.name,
        description: selectedProduct.description || '',
        size: selectedProduct.size || '',
        hsn: selectedProduct.hsn || '',
        gst: selectedProduct.gst || '', // Handle as string
        dp: selectedProduct.dp,
        stock: selectedProduct.stock,
      });
    }
  }, [selectedProduct, form]);

  const fetchProducts = useCallback(async () => {
    if (!user || !isAuthorized) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    let query = supabase
      .from('products')
      .select(`
        id,
        code,
        name,
        description,
        size,
        hsn,
        gst,
        dp,
        stock,
        user_id,
        sales(count)
      `);
      
    // Apply search filter if present
    if (appliedSearchTerm) {
      const search = `%${appliedSearchTerm}%`;
      // Filter by name OR code
      query = query.or(`name.ilike.${search},code.ilike.${search}`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching products:', error);
      setError(`Failed to load products: ${error.message}`);
      showError(`Failed to load products: ${error.message}`);
      setProducts([]);
    } else {
      const productsWithSalesStatus: Product[] = (data || []).map((p: any) => ({
        ...p,
        has_sales: (p.sales?.[0]?.count || 0) > 0, // Determine has_sales based on count
      }));
      setProducts(productsWithSalesStatus);
    }
    setLoading(false);
  }, [user, appliedSearchTerm, isAuthorized]);

  useEffect(() => {
    if (!sessionLoading && user && isAuthorized) {
      fetchProducts();
    }
  }, [sessionLoading, user, isAuthorized, fetchProducts]);

  const handleApplySearch = () => {
    setAppliedSearchTerm(searchTerm);
  };
  
  const handleClearSearch = () => {
    setSearchTerm('');
    setAppliedSearchTerm('');
  };

  const handleEdit = (product: Product) => {
    setSelectedProduct(product);
    setIsEditDialogOpen(true);
  };

  const handleUpdateProduct = async (values: z.infer<typeof formSchema>) => {
    if (!selectedProduct || !user) return;

    try {
      const payload = {
        productId: selectedProduct.id,
        code: values.code,
        name: values.name,
        description: values.description,
        size: values.size,
        hsn: values.hsn,
        gst: values.gst,
        dp: values.dp,
        stock: values.stock,
        userId: user.id, // Pass user ID for potential admin check in Edge Function
      };

      const response = await fetch(UPDATE_PRODUCT_EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // No Authorization header needed here as Edge Function uses service_role_key
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update product');
      }

      showSuccess('Product updated successfully!');
      setIsEditDialogOpen(false);
      fetchProducts();
      onProductAction?.(); // Notify parent
    } catch (error: any) {
      console.error('Error updating product:', error);
      showError(`Failed to update product: ${error.message}`);
    }
  };

  const handleDelete = async (productId: string) => {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId);

    if (error) {
      console.error('Error deleting product:', error);
      showError(`Failed to delete product: ${error.message}. A product with sales cannot be deleted.`);
    } else {
      showSuccess('Product deleted successfully!');
      fetchProducts();
      onProductAction?.(); // Notify parent
    }
  };

  if (!isAuthorized) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading products...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-4">
        <p className="text-lg text-red-600 dark:text-red-400 mb-4">{error}</p>
      </div>
    );
  }

  return (
    <Card className="bg-card text-card-foreground shadow-lg h-full">
      <CardHeader className="bg-blue-500 dark:bg-blue-700 text-white rounded-t-lg p-4">
        <CardTitle className="text-xl font-semibold">Manage All Products</CardTitle>
        <CardDescription className="text-blue-100 dark:text-blue-200">View, edit, or delete your registered products.</CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        {/* Search Filter Section */}
        <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-muted rounded-lg">
          <div className="flex-1 min-w-[200px]">
            <Label htmlFor="productSearch">Search by Name or Code</Label>
            <Input
              id="productSearch"
              placeholder="Enter product name or code"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
          <Button onClick={handleApplySearch} className="flex items-center gap-2">
            <Search className="h-4 w-4" /> Apply Filter
          </Button>
          <Button variant="outline" onClick={handleClearSearch} className="flex items-center gap-2">
            Clear Filter
          </Button>
        </div>
        
        <div className="overflow-x-auto">
          {products.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {appliedSearchTerm ? `No products found matching "${appliedSearchTerm}".` : 'No products found. Add a new product to get started!'}
            </p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow className="bg-muted hover:bg-muted/90">
                    <TableHead className="text-muted-foreground">Code</TableHead>
                    <TableHead className="text-muted-foreground">Name</TableHead>
                    <TableHead className="text-muted-foreground">Size</TableHead>
                    <TableHead className="text-muted-foreground">HSN</TableHead>
                    <TableHead className="text-muted-foreground">GST (%)</TableHead>
                    <TableHead className="text-muted-foreground">DP</TableHead>
                    <TableHead className="text-muted-foreground">Stock</TableHead>
                    <TableHead className="text-muted-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id} className="hover:bg-accent/50">
                      <TableCell className="font-medium text-foreground">{product.code}</TableCell>
                      <TableCell className="font-medium text-foreground">{product.name}</TableCell>
                      <TableCell className="text-muted-foreground">{product.size || 'N/A'}</TableCell>
                      <TableCell className="text-muted-foreground">{product.hsn || 'N/A'}</TableCell>
                      <TableCell className="text-muted-foreground">{product.gst || 'N/A'}</TableCell>
                      <TableCell className="text-muted-foreground">₹{product.dp.toFixed(2)}</TableCell>
                      <TableCell className="text-muted-foreground">{product.stock}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(product)} title="Edit Product">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" title="Delete Product" disabled={product.has_sales}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone. This will permanently delete the product.
                                  Note: Products with associated sales cannot be deleted.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(product.id)}>Continue</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>

      {selectedProduct && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Product</DialogTitle>
              <DialogDescription>
                Make changes to the product here. Click save when you're done.
                {selectedProduct.has_sales && (
                  <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-2">
                    Note: This product has associated sales. Only 'Stock', 'Code', 'Size', 'HSN', 'GST', and 'Dealer Price (DP)' can be updated.
                  </p>
                )}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(handleUpdateProduct)} className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="code" className="text-right">
                  Code
                </Label>
                <Input id="code" {...form.register('code')} className="col-span-3" />
                {form.formState.errors.code && <p className="col-span-4 text-right text-sm text-destructive">{form.formState.errors.code.message}</p>}
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Input id="name" {...form.register('name')} className="col-span-3" disabled={selectedProduct.has_sales} />
                {form.formState.errors.name && <p className="col-span-4 text-right text-sm text-destructive">{form.formState.errors.name.message}</p>}
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right">
                  Description
                </Label>
                <Textarea id="description" {...form.register('description')} className="col-span-3" disabled={selectedProduct.has_sales} />
                {form.formState.errors.description && <p className="col-span-4 text-right text-sm text-destructive">{form.formState.errors.description.message}</p>}
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="size" className="text-right">
                  Size
                </Label>
                <Input id="size" {...form.register('size')} className="col-span-3" />
                {form.formState.errors.size && <p className="col-span-4 text-right text-sm text-destructive">{form.formState.errors.size.message}</p>}
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="hsn" className="text-right">
                  HSN
                </Label>
                <Input id="hsn" {...form.register('hsn')} className="col-span-3" />
                {form.formState.errors.hsn && <p className="col-span-4 text-right text-sm text-destructive">{form.formState.errors.hsn.message}</p>}
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="gst" className="text-right">
                  GST (%)
                </Label>
                <Input id="gst" {...form.register('gst')} className="col-span-3" />
                {form.formState.errors.gst && <p className="col-span-4 text-right text-sm text-destructive">{form.formState.errors.gst.message}</p>}
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="dp" className="text-right">
                  Dealer Price (DP)
                </Label>
                <Input id="dp" type="number" step="0.01" {...form.register('dp')} className="col-span-3" />
                {form.formState.errors.dp && <p className="col-span-4 text-right text-sm text-destructive">{form.formState.errors.dp.message}</p>}
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="stock" className="text-right">
                  Stock
                </Label>
                <Input id="stock" type="number" {...form.register('stock')} className="col-span-3" />
                {form.formState.errors.stock && <p className="col-span-4 text-right text-sm text-destructive">{form.formState.errors.stock.message}</p>}
              </div>
              <DialogFooter>
                <Button type="submit">Save changes</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
};

export default ProductTableManager;