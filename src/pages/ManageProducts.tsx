"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { ArrowLeft, Edit, Trash2, Eye, Loader2, PlusCircle } from 'lucide-react';
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
  name: string;
  description: string;
  price: number;
  stock: number;
  user_id: string;
}

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

const ManageProducts = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, isAdmin } = useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

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
    if (selectedProduct) {
      form.reset({
        name: selectedProduct.name,
        description: selectedProduct.description || '',
        price: selectedProduct.price,
        stock: selectedProduct.stock,
      });
    }
  }, [selectedProduct, form]);

  const fetchProducts = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('products')
      .select('*');

    if (error) {
      console.error('Error fetching products:', error);
      setError(`Failed to load products: ${error.message}`);
      showError(`Failed to load products: ${error.message}`);
      setProducts([]);
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!sessionLoading && user) {
      fetchProducts();
    } else if (!sessionLoading && !user) {
      navigate('/login');
    }
  }, [sessionLoading, user, fetchProducts, navigate]);

  const handleEdit = (product: Product) => {
    setSelectedProduct(product);
    setIsEditDialogOpen(true);
  };

  const handleUpdateProduct = async (values: z.infer<typeof formSchema>) => {
    if (!selectedProduct || !user) return;

    const { error } = await supabase
      .from('products')
      .update({
        name: values.name,
        description: values.description,
        price: values.price,
        stock: values.stock,
      })
      .eq('id', selectedProduct.id);

    if (error) {
      console.error('Error updating product:', error);
      showError(`Failed to update product: ${error.message}`);
    } else {
      showSuccess('Product updated successfully!');
      setIsEditDialogOpen(false);
      fetchProducts();
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
    }
  };

  if (sessionLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading products...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
        <p className="text-lg text-red-600 dark:text-red-400 mb-4">{error}</p>
        <Button onClick={() => navigate('/dashboard')} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-full">
        <Button variant="outline" onClick={() => navigate('/dashboard')} className="mb-6 flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Button>

        <Card className="bg-card text-card-foreground shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-primary">Manage Products</CardTitle>
            <CardDescription className="text-muted-foreground">View, edit, or delete your registered products.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              {products.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No products found. Add a new product to get started!</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted hover:bg-muted/90">
                      <TableHead className="text-muted-foreground">Name</TableHead>
                      <TableHead className="text-muted-foreground">Description</TableHead>
                      <TableHead className="text-muted-foreground">Price</TableHead>
                      <TableHead className="text-muted-foreground">Stock</TableHead>
                      <TableHead className="text-muted-foreground">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => (
                      <TableRow key={product.id} className="hover:bg-accent/50">
                        <TableCell className="font-medium text-foreground">{product.name}</TableCell>
                        <TableCell className="text-muted-foreground">{product.description}</TableCell>
                        <TableCell className="text-muted-foreground">₹{product.price.toFixed(2)}</TableCell>
                        <TableCell className="text-muted-foreground">{product.stock}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {(isAdmin || user?.id === product.user_id) && (
                              <>
                                <Button variant="ghost" size="icon" onClick={() => handleEdit(product)} title="Edit Product">
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" title="Delete Product">
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
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
            <div className="mt-6 text-right">
              <Button onClick={() => navigate('/add-product')} className="bg-primary text-primary-foreground hover:bg-primary/90">
                <PlusCircle className="h-4 w-4 mr-2" /> Add New Product
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <MadeWithDyad />

      {selectedProduct && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Product</DialogTitle>
              <DialogDescription>
                Make changes to the product here. Click save when you're done.
                Note: Products with associated sales cannot be altered.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(handleUpdateProduct)} className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Input id="name" {...form.register('name')} className="col-span-3" />
                {form.formState.errors.name && <p className="col-span-4 text-right text-sm text-destructive">{form.formState.errors.name.message}</p>}
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right">
                  Description
                </Label>
                <Textarea id="description" {...form.register('description')} className="col-span-3" />
                {form.formState.errors.description && <p className="col-span-4 text-right text-sm text-destructive">{form.formState.errors.description.message}</p>}
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="price" className="text-right">
                  Price
                </Label>
                <Input id="price" type="number" step="0.01" {...form.register('price')} className="col-span-3" />
                {form.formState.errors.price && <p className="col-span-4 text-right text-sm text-destructive">{form.formState.errors.price.message}</p>}
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
    </div>
  );
};

export default ManageProducts;