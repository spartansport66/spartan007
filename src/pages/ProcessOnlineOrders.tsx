"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft, Check, Trash2, ShoppingCart, Search, Package, User, ChevronsUpDown } from 'lucide-react';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { showError, showSuccess } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface StagedOrder {
  id: string;
  platform_order_number: string;
  customer_name: string;
  shipping_address: string;
  flipkart_item_name: string;
  amount: number;
  status: string;
}

interface Product {
  id: string;
  name: string;
  code: string;
  dp: number;
  gst: string;
}

interface Platform {
  id: string;
  name: string;
}

const ProcessOnlineOrders = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useSession();
  const [stagedOrders, setStagedOrders] = useState<StagedOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  
  // Mapping state: stagedOrderId -> productId
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [productSearch, setProductSearch] = useState("");
  const [selectedPlatformId, setSelectedPlatformId] = useState<string>("");

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [stagedRes, productsRes, platformsRes] = await Promise.all([
        supabase.from('online_order_staging').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
        supabase.from('products').select('id, name, code, dp, gst').order('name'),
        supabase.from('online_platforms').select('*').order('name')
      ]);

      if (stagedRes.error) throw stagedRes.error;
      if (productsRes.error) throw productsRes.error;
      if (platformsRes.error) throw platformsRes.error;

      setStagedOrders(stagedRes.data || []);
      setProducts(productsRes.data || []);
      setPlatforms(platformsRes.data || []);
      
      // Try to find Flipkart platform by default
      const flipkart = platformsRes.data?.find(p => p.name.toLowerCase().includes('flipkart'));
      if (flipkart) setSelectedPlatformId(flipkart.id);

    } catch (error: any) {
      showError(`Failed to load data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      navigate('/dashboard');
      return;
    }
    fetchInitialData();
  }, [isAdmin, navigate, fetchInitialData]);

  const filteredProducts = useMemo(() => {
    if (!productSearch) return products;
    const search = productSearch.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(search) || p.code.toLowerCase().includes(search));
  }, [products, productSearch]);

  const handleProcessOrder = async (stagedOrder: StagedOrder) => {
    const productId = mappings[stagedOrder.id];
    if (!productId) {
      showError("Please map this order to a product first.");
      return;
    }
    if (!selectedPlatformId) {
      showError("Please select an online platform.");
      return;
    }
    if (!user) return;

    setIsProcessing(stagedOrder.id);
    try {
      const product = products.find(p => p.id === productId)!;
      const gstPercent = parseFloat(product.gst) || 0;

      // 1. Find the "Online Order" dealer
      const { data: dealerData, error: dealerError } = await supabase
        .from('dealers')
        .select('id')
        .eq('name', 'Online Order')
        .single();
      
      if (dealerError) throw new Error("Could not find 'Online Order' dealer. Please create one first.");

      // 2. Create the real Order
      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert({
          dealer_id: dealerData.id,
          user_id: user.id,
          total_amount: stagedOrder.amount,
          status: 'completed',
          payment_status: 'paid', // Online orders are usually pre-paid
          order_date: new Date().toISOString(),
        })
        .select('id, order_number')
        .single();

      if (orderError) throw orderError;

      // 3. Create Online Order Details
      const { error: onlineError } = await supabase
        .from('online_order_details')
        .insert({
          order_id: newOrder.id,
          client_name: stagedOrder.customer_name,
          platform_id: selectedPlatformId,
          platform_order_number: stagedOrder.platform_order_number,
          address: stagedOrder.shipping_address, // This column must be added via SQL
        });
      if (onlineError) throw onlineError;

      // 4. Create Sales Item (triggers stock deduction)
      const { error: salesError } = await supabase
        .from('sales')
        .insert({
          order_id: newOrder.id,
          product_id: productId,
          quantity: 1,
          unit_price: stagedOrder.amount / (1 + gstPercent / 100), // Back-calculate taxable value
          gst_percent: gstPercent,
          total_price: stagedOrder.amount,
        });
      if (salesError) throw salesError;

      // 5. Mark staging as processed
      const { error: updateError } = await supabase
        .from('online_order_staging')
        .update({ status: 'processed' })
        .eq('id', stagedOrder.id);
      if (updateError) throw updateError;

      showSuccess(`Order #${newOrder.order_number} created and stock updated!`);
      setStagedOrders(prev => prev.filter(o => o.id !== stagedOrder.id));
    } catch (error: any) {
      console.error("Processing Error:", error);
      showError(`Failed to process order: ${error.message}`);
    } finally {
      setIsProcessing(null);
    }
  };

  const handleDeleteStaged = async (id: string) => {
    try {
      const { error } = await supabase.from('online_order_staging').delete().eq('id', id);
      if (error) throw error;
      setStagedOrders(prev => prev.filter(o => o.id !== id));
      showSuccess("Staged order removed.");
    } catch (error: any) {
      showError(error.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-6xl">
        <Button variant="outline" onClick={() => navigate('/flipkart-extractor')} className="mb-6 flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Extractor
        </Button>

        <Card className="mb-6">
          <CardHeader className="bg-indigo-600 text-white rounded-t-lg">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-2xl">Process Staged Online Orders</CardTitle>
                <CardDescription className="text-indigo-100">
                  Map Flipkart items to your database products to finalize orders and update stock.
                </CardDescription>
              </div>
              <div className="w-64">
                <Label className="text-white mb-1 block text-xs">Target Platform</Label>
                <Select value={selectedPlatformId} onValueChange={setSelectedPlatformId}>
                  <SelectTrigger className="bg-white/10 border-white/20 text-white">
                    <SelectValue placeholder="Select Platform" />
                  </SelectTrigger>
                  <SelectContent>
                    {platforms.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[150px]">Order No.</TableHead>
                    <TableHead>Customer & Item</TableHead>
                    <TableHead className="w-[300px]">Map to Database Product</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stagedOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                        No pending staged orders found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    stagedOrders.map((order) => (
                      <TableRow key={order.id} className="hover:bg-muted/30">
                        <TableCell className="font-mono text-xs font-semibold text-blue-600">
                          {order.platform_order_number}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium flex items-center gap-1"><User className="h-3 w-3" /> {order.customer_name}</span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <Package className="h-3 w-3" /> {order.flipkart_item_name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full justify-between text-left font-normal h-auto py-2">
                                {mappings[order.id] ? (
                                  <div className="flex flex-col">
                                    <span className="text-sm font-medium">{products.find(p => p.id === mappings[order.id])?.name}</span>
                                    <span className="text-[10px] text-muted-foreground">{products.find(p => p.id === mappings[order.id])?.code}</span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">Select Product...</span>
                                )}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0" align="start">
                              <div className="p-2 border-b flex items-center gap-2">
                                <Search className="h-4 w-4 text-muted-foreground" />
                                <Input 
                                  placeholder="Search product..." 
                                  value={productSearch} 
                                  onChange={(e) => setProductSearch(e.target.value)} 
                                  className="h-8 border-none focus-visible:ring-0" 
                                />
                              </div>
                              <ScrollArea className="h-[200px]">
                                <div className="p-1">
                                  {filteredProducts.map((product) => (
                                    <Button
                                      key={product.id}
                                      variant="ghost"
                                      className="w-full justify-start font-normal h-auto py-2"
                                      onClick={() => {
                                        setMappings(prev => ({ ...prev, [order.id]: product.id }));
                                        setProductSearch('');
                                      }}
                                    >
                                      <div className="flex flex-col items-start">
                                        <span className="text-sm font-medium">{product.name}</span>
                                        <span className="text-xs text-muted-foreground">{product.code}</span>
                                      </div>
                                    </Button>
                                  ))}
                                </div>
                              </ScrollArea>
                            </PopoverContent>
                          </Popover>
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          ₹{order.amount.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-2">
                            <Button 
                              size="sm" 
                              onClick={() => handleProcessOrder(order)}
                              disabled={isProcessing === order.id || !mappings[order.id]}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              {isProcessing === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4 mr-1" />}
                              Process
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleDeleteStaged(order.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default ProcessOnlineOrders;