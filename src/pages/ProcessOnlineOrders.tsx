"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft, Check, Trash2, ShoppingCart, Package, User, Play } from 'lucide-react';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { showError, showSuccess } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface StagedOrder {
  id: string;
  platform_order_number: string;
  customer_name: string;
  shipping_address: string;
  flipkart_item_name: string;
  amount: number;
  status: string;
}

interface Platform {
  id: string;
  name: string;
}

const ProcessOnlineOrders = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useSession();
  const [stagedOrders, setStagedOrders] = useState<StagedOrder[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [selectedPlatformId, setSelectedPlatformId] = useState<string>("");
  const [bulkPaymentMethod, setBulkPaymentMethod] = useState<'COD' | 'Prepaid'>('Prepaid');

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [stagedRes, platformsRes] = await Promise.all([
        supabase.from('online_order_staging').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
        supabase.from('online_platforms').select('*').order('name')
      ]);

      if (stagedRes.error) throw stagedRes.error;
      if (platformsRes.error) throw platformsRes.error;

      setStagedOrders(stagedRes.data || []);
      setPlatforms(platformsRes.data || []);
      
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

  const handleBulkProcess = async () => {
    if (stagedOrders.length === 0) return;
    if (!selectedPlatformId) {
      showError("Please select an online platform.");
      return;
    }
    if (!user) return;

    setIsProcessingBulk(true);
    let successCount = 0;

    try {
      const { data: dealerData, error: dealerError } = await supabase
        .from('dealers')
        .select('id')
        .eq('name', 'Online Order')
        .single();
      
      if (dealerError) throw new Error("Could not find 'Online Order' dealer. Please create one first.");

      const paymentStatus = bulkPaymentMethod === 'COD' ? 'pending' : 'paid';

      for (const stagedOrder of stagedOrders) {
        // 1. Create the Order (No sales record yet)
        const { data: newOrder, error: orderError } = await supabase
          .from('orders')
          .insert({
            dealer_id: dealerData.id,
            user_id: user.id,
            total_amount: stagedOrder.amount,
            status: 'completed',
            payment_status: paymentStatus,
            order_date: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (orderError) {
          console.error(`Error creating order for ${stagedOrder.platform_order_number}:`, orderError);
          continue;
        }

        // 2. Create Online Order Details with raw item name
        const { error: onlineError } = await supabase
          .from('online_order_details')
          .insert({
            order_id: newOrder.id,
            client_name: stagedOrder.customer_name,
            platform_id: selectedPlatformId,
            platform_order_number: stagedOrder.platform_order_number,
            address: stagedOrder.shipping_address,
            raw_item_name: stagedOrder.flipkart_item_name, // Store the dummy name
          });

        if (onlineError) {
          console.error(`Error creating details for ${stagedOrder.platform_order_number}:`, onlineError);
          continue;
        }

        // 3. Mark staging as processed
        await supabase
          .from('online_order_staging')
          .update({ status: 'processed' })
          .eq('id', stagedOrder.id);

        successCount++;
      }

      showSuccess(`Successfully created ${successCount} orders. You can now map products and add bill numbers in the Dispatch section.`);
      fetchInitialData();
    } catch (error: any) {
      console.error("Bulk Processing Error:", error);
      showError(`Failed to process orders: ${error.message}`);
    } finally {
      setIsProcessingBulk(false);
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle className="text-2xl">Process Staged Online Orders</CardTitle>
                <CardDescription className="text-indigo-100">
                  Bulk create orders from extracted data. Mapping to actual products happens during dispatch.
                </CardDescription>
              </div>
              <div className="flex items-end gap-4">
                <div className="w-48">
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
                <div className="w-48">
                  <Label className="text-white mb-1 block text-xs">Payment Method</Label>
                  <Select value={bulkPaymentMethod} onValueChange={(value) => setBulkPaymentMethod(value as 'COD' | 'Prepaid')}>
                    <SelectTrigger className="bg-white/10 border-white/20 text-white">
                      <SelectValue placeholder="Select Method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Prepaid">Prepaid</SelectItem>
                      <SelectItem value="COD">COD (Cash on Delivery)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  onClick={handleBulkProcess} 
                  disabled={isProcessingBulk || stagedOrders.length === 0}
                  className="bg-green-500 hover:bg-green-600 text-white"
                >
                  {isProcessingBulk ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                  Bulk Create {stagedOrders.length} Orders
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[150px]">Order No.</TableHead>
                    <TableHead>Customer Details</TableHead>
                    <TableHead>Extracted Item Name (Dummy)</TableHead>
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
                            <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">{order.shipping_address}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            {order.flipkart_item_name}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          ₹{order.amount.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDeleteStaged(order.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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