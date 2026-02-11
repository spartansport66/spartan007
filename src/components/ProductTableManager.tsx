"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Edit, Trash2, Loader2, Search } from 'lucide-react';
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
});

const ProductTableManager: React.FC<{ onProductAction?: () => void }> = ({ onProductAction }) => {
  const { user, session, loading: sessionLoading, userType } = useSession();
  const isAuthorized = userType === 'admin' || userType === 'inventory_manager';

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [appliedSearchTerm, setAppliedSearchTerm] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { code: '', name: '', description: '', size: '', hsn: '', gst: '', dp: 0, opening_stock: 0 },
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
      });
    }
  }, [selectedProduct, form]);

  const fetchProducts = useCallback(async () => {
    if (!user || !isAuthorized) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let query = supabase
        .from('products')
        .select('id, code, name, description, size, hsn, gst, dp, opening_stock, stock_in, stock_out, closing_stock, user_id, sales(count)');
      
      if (appliedSearchTerm) {
        query = query.or(`name.ilike.%${appliedSearchTerm}%,code.ilike.%${appliedSearchTerm}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      setProducts((data || []).map((p: any) => ({
        ...p,
        has_sales: (p.sales?.[0]?.count || 0) > 0,
      })));
    } catch (error: any) {
      console.error('Error fetching products:', error);
      showError(`Failed to load products: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [user, appliedSearchTerm, isAuthorized]);

  useEffect(() => {
    if (!sessionLoading && user && isAuthorized) fetchProducts();
  }, [sessionLoading, user, isAuthorized, fetchProducts]);

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

  if (!isAuthorized) return null;
  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <Card className="bg-card text-card-foreground shadow-lg h-full">
      <CardHeader className="bg-blue-500 dark:bg-blue-700 text-white rounded-t-lg p-4">
        <CardTitle className="text-xl font-semibold">Manage All Products</CardTitle>
        <CardDescription className="text-blue-100 dark:text-blue-200">Inventory tracking: Opening + In - Out = Closing</CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-muted rounded-lg">
          <div className="flex-1 min-w-[200px]">
            <Label htmlFor="productSearch">Search</Label>
            <Input id="productSearch" placeholder="Name or Code" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <Button onClick={() => setAppliedSearchTerm(searchTerm)}><Search className="h-4 w-4 mr-2" /> Filter</Button>
          <Button variant="outline" onClick={() => { setSearchTerm(''); setAppliedSearchTerm(''); }}>Clear</Button>
        </div>
        
        <div className="overflow-x-auto border rounded-md">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow className="bg-muted">
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Opening</TableHead>
                <TableHead className="text-right">Stock In</TableHead>
                <TableHead className="text-right">Stock Out</TableHead>
                <TableHead className="text-right font-bold">Closing</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id} className="hover:bg-accent/50">
                  <TableCell className="font-medium">{product.code}</TableCell>
                  <TableCell>{product.name}</TableCell>
                  <TableCell className="text-right">{product.opening_stock}</TableCell>
                  <TableCell className="text-right text-green-600">+{product.stock_in}</TableCell>
                  <TableCell className="text-right text-red-600">-{product.stock_out}</TableCell>
                  <TableCell className="text-right font-bold">{product.closing_stock}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(product)}><Edit className="h-4 w-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button variant="ghost" size="icon" disabled={product.has_sales}><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Delete Product?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(product.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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
                  <Input id="name" {...form.register('name')} className="col-span-3" disabled={selectedProduct.has_sales || isSubmitting} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="description" className="text-right">Description</Label>
                  <Textarea id="description" {...form.register('description')} className="col-span-3" disabled={selectedProduct.has_sales || isSubmitting} />
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
                    <span>{selectedProduct.closing_stock}</span>
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