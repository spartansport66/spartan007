"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionContext';

interface Product {
  id: string;
  code: string;
  name: string;
  closing_stock: number;
  dp: number;
}

interface LowStockProductsCardProps {
  onProductAction?: () => void;
}

const LOW_STOCK_THRESHOLD = 10;

const LowStockProductsCard: React.FC<LowStockProductsCardProps> = ({ onProductAction }) => {
  const navigate = useNavigate();
  const { userType } = useSession();
  const isAuthorized = userType === 'admin' || userType === 'inventory_manager';

  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLowStockProducts = useCallback(async () => {
    if (!isAuthorized) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Explicitly using 'closing_stock' for selection, filtering, and ordering
      const { data, error } = await supabase
        .from('products')
        .select('id, code, name, closing_stock, dp')
        .lte('closing_stock', LOW_STOCK_THRESHOLD)
        .order('closing_stock', { ascending: true });

      if (error) throw error;
      setLowStockProducts(data || []);
    } catch (error: any) {
      console.error('Error fetching low stock products:', error);
      setError(`Failed to load low stock products: ${error.message}`);
      showError(`Failed to load low stock products: ${error.message}`);
      setLowStockProducts([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthorized]);

  useEffect(() => {
    fetchLowStockProducts();
  }, [fetchLowStockProducts, onProductAction]);

  if (!isAuthorized) {
    return null;
  }

  if (loading) {
    return (
      <Card className="bg-card text-card-foreground shadow-lg h-full">
        <CardHeader className="bg-orange-500 dark:bg-orange-700 text-white rounded-t-lg p-4">
          <CardTitle className="text-xl font-semibold">Low Stock Products</CardTitle>
          <CardDescription className="text-orange-100 dark:text-orange-200">Products running low on inventory.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading low stock products...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-card text-card-foreground shadow-lg h-full">
        <CardHeader className="bg-orange-500 dark:bg-orange-700 text-white rounded-t-lg p-4">
          <CardTitle className="text-xl font-semibold">Low Stock Products</CardTitle>
          <CardDescription className="text-orange-100 dark:text-orange-200">Products running low on inventory.</CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <p className="text-lg text-red-600 dark:text-red-400 mb-4">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card text-card-foreground shadow-lg h-full">
      <CardHeader className="bg-orange-500 dark:bg-orange-700 text-white rounded-t-lg p-4">
        <CardTitle className="text-xl font-semibold">Low Stock Products</CardTitle>
        <CardDescription className="text-orange-100 dark:text-orange-200">Products running low on inventory.</CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        <div className="overflow-x-auto">
          {lowStockProducts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No products currently low on stock. Good job!</p>
          ) : (
            <div className="max-h-[250px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow className="bg-muted hover:bg-muted/90">
                    <TableHead className="text-muted-foreground">Code</TableHead>
                    <TableHead className="text-muted-foreground">Product Name</TableHead>
                    <TableHead className="text-muted-foreground text-right">Stock</TableHead>
                    <TableHead className="text-muted-foreground text-right">DP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStockProducts.map((product) => (
                    <TableRow key={product.id} className="hover:bg-accent/50">
                      <TableCell className="font-medium text-foreground">{product.code}</TableCell>
                      <TableCell className="font-medium text-foreground flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-500" /> {product.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-right">{product.closing_stock}</TableCell>
                      <TableCell className="text-muted-foreground text-right">₹{product.dp}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
        <div className="mt-6 text-right">
          <Button onClick={() => navigate('/manage-products')} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Eye className="h-4 w-4 mr-2" /> View All Products
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default LowStockProductsCard;