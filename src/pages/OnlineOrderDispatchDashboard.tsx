"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft, Check, Trash2, ListChecks, Package, User, Play, Printer, ChevronsUpDown, FileText, Truck, Eraser, AlertCircle, Eye, EyeOff, Copy, X, Edit, Search, LogOut } from 'lucide-react';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { showError, showSuccess } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Checkbox } from '@/components/ui/checkbox';
import OrderDetailsDialog from '@/components/OrderDetailsDialog';
import EditOrderDialog from '@/components/EditOrderDialog';

// Interfaces
interface CreatedOrder {
  id: string;
  order_number: number;
  order_date: string;
  total_amount: number;
  client_name: string;
  raw_item_name: string;
  platform_order_number: string;
  mapped_product_id: string | null;
  bill_no: string;
  dispatch_date: string;
  dispatch_number: number | null;
  dispatched: boolean;
}

interface Product {
  id: string;
  name: string;
  code: string;
  dp: number;
  gst: string;
}

const OnlineOrderDispatchDashboard = () => {
  const navigate = useNavigate();
  const { user, isAdmin, userType, loading: sessionLoading } = useSession();
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [createdOrders, setCreatedOrders] = useState<CreatedOrder[]>([]);
  const [selectedCreatedIds, setSelectedCreatedIds] = useState<string[]>([]);
  
  const [productSearch, setProductSearch] = useState("");
  const [filterOrderNumberProcess, setFilterOrderNumberProcess] = useState("");

  const [isOrderDetailsDialogOpen, setIsOrderDetailsDialogOpen] = useState(false);
  const [selectedOrderIdForDetails, setSelectedOrderIdForDetails] = useState<string | null>(null);
  const [isEditOrderDialogOpen, setIsEditOrderDialogOpen] = useState(false);
  const [selectedOrderIdForEdit, setSelectedOrderIdForEdit] = useState<string | null>(null);

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('products').select('id, name, code, dp, gst').order('name');
      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      showError("Failed to load product data.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCreatedOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, order_number, order_date, total_amount, bill_no, dispatch_date, dispatch_number, dispatched,
          dealers!inner(name),
          online_order_details!inner(client_name, raw_item_name, platform_order_number, mapped_product_id)
        `)
        .eq('dealers.name', 'Online Order')
        .eq('dispatched', false)
        .order('order_number', { ascending: false });

      if (error) throw error;

      const formatted: CreatedOrder[] = (data || []).map((o: any) => ({
        id: o.id,
        order_number: o.order_number,
        order_date: o.order_date,
        total_amount: o.total_amount,
        client_name: o.online_order_details[0].client_name,
        raw_item_name: o.online_order_details[0].raw_item_name,
        platform_order_number: o.online_order_details[0].platform_order_number,
        mapped_product_id: o.online_order_details[0].mapped_product_id,
        bill_no: o.bill_no || '',
        dispatch_date: o.dispatch_date ? o.dispatch_date.split('T')[0] : new Date().toISOString().split('T')[0],
        dispatch_number: o.dispatch_number,
        dispatched: o.dispatched
      }));
      setCreatedOrders(formatted);
    } catch (error: any) {
      showError("Failed to load created orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading) {
      if (!user) {
        navigate('/login');
      } else if (userType !== 'online_orders' && !isAdmin) {
        showError('Access Denied.');
        navigate('/dashboard');
      } else {
        fetchInitialData();
        fetchCreatedOrders();
      }
    }
  }, [sessionLoading, user, userType, isAdmin, navigate, fetchInitialData, fetchCreatedOrders]);

  const handleUpdateOrderField = (orderId: string, field: keyof CreatedOrder, value: any) => {
    setCreatedOrders(prev => prev.map(o => o.id === orderId ? { ...o, [field]: value } : o));
  };

  const handleBulkCreateGatepass = async () => {
    const ordersToProcess = createdOrders.filter(o => selectedCreatedIds.includes(o.id) && o.mapped_product_id && o.bill_no);
    if (ordersToProcess.length === 0) {
      showError("Select products and enter bill numbers for the selected orders first.");
      return;
    }

    setIsProcessing(true);
    try {
      for (const order of ordersToProcess) {
        const product = products.find(p => p.id === order.mapped_product_id)!;
        const gstPercent = parseFloat(product.gst) || 0;

        await supabase.from('orders').update({
          bill_no: order.bill_no,
          dispatch_date: order.dispatch_date,
          dispatched: true
        }).eq('id', order.id);

        await supabase.from('online_order_details').update({
          mapped_product_id: order.mapped_product_id,
          client_name: order.client_name
        }).eq('order_id', order.id);

        await supabase.from('sales').insert({
          order_id: order.id,
          product_id: order.mapped_product_id,
          quantity: 1,
          unit_price: order.total_amount / (1 + gstPercent / 100),
          gst_percent: gstPercent,
          total_price: order.total_amount,
        });
      }
      showSuccess("Gatepasses generated and stock updated for selected orders.");
      setSelectedCreatedIds([]);
      fetchCreatedOrders();
    } catch (error: any) {
      showError(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectCreatedOrder = (id: string, checked: boolean) => {
    setSelectedCreatedIds(prev => checked ? [...prev, id] : prev.filter(i => i !== id));
  };

  const handleSelectAllCreated = (checked: boolean) => {
    const filteredIds = filteredCreatedOrders.map(o => o.id);
    setSelectedCreatedIds(checked ? filteredIds : []);
  };

  const handleViewOrder = (id: string) => {
    setSelectedOrderIdForDetails(id);
    setIsOrderDetailsDialogOpen(true);
  };

  const handleEditOrder = (id: string) => {
    setSelectedOrderIdForEdit(id);
    setIsEditOrderDialogOpen(true);
  };

  const handleDeleteOrder = async (order: CreatedOrder) => {
    setIsProcessing(true);
    try {
      await supabase.from('payments').delete().eq('order_id', order.id);
      await supabase.from('sales').delete().eq('order_id', order.id);
      await supabase.from('online_order_details').delete().eq('order_id', order.id);
      
      const { error } = await supabase.from('orders').delete().eq('id', order.id);
      if (error) throw error;

      showSuccess(`Order #${order.order_number} deleted.`);
      fetchCreatedOrders();
    } catch (error: any) {
      showError(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error && error.message !== 'Auth session missing!') {
        showError(`Logout failed: ${error.message}.`);
      } else {
        showSuccess('Logged out successfully!');
      }
    } catch (error: any) {
      showError(`An unexpected error occurred during logout: ${error.message}.`);
    } finally {
      navigate('/');
    }
  };

  const filteredProducts = useMemo(() => {
    if (!productSearch) return products;
    const search = productSearch.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(search) || p.code.toLowerCase().includes(search));
  }, [products, productSearch]);

  const filteredCreatedOrders = useMemo(() => {
    if (!filterOrderNumberProcess) return createdOrders;
    return createdOrders.filter(o => o.order_number.toString().includes(filterOrderNumberProcess) || o.platform_order_number.toLowerCase().includes(filterOrderNumberProcess.toLowerCase()));
  }, [createdOrders, filterOrderNumberProcess]);

  if (sessionLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-7xl">
        <div className="flex justify-between items-center mb-6">
          <Button variant="outline" onClick={() => navigate(isAdmin ? '/admin-dashboard' : '/')} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold text-primary">Online Order Dispatch</h1>
          <Button onClick={handleLogout} variant="outline" className="flex items-center gap-2">
            <LogOut className="h-4 w-4" /> Logout
          </Button>
        </div>

        <Card>
          <CardHeader className="bg-indigo-600 text-white rounded-t-lg">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle>Map & Dispatch Orders</CardTitle>
                <CardDescription className="text-indigo-100">Link online items to actual products and generate gatepasses.</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleBulkCreateGatepass} disabled={isProcessing || selectedCreatedIds.length === 0} className="bg-green-500 hover:bg-green-600">
                  {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                  Generate Gatepasses for Selected
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-4 max-w-sm">
              <div className="relative flex-grow">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search Order # or Platform ID..." 
                  value={filterOrderNumberProcess} 
                  onChange={(e) => setFilterOrderNumberProcess(e.target.value)} 
                  className="pl-8"
                />
              </div>
              {filterOrderNumberProcess && (
                <Button variant="ghost" size="icon" onClick={() => setFilterOrderNumberProcess("")}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="overflow-x-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-12">
                      <Checkbox 
                        checked={selectedCreatedIds.length === filteredCreatedOrders.length && filteredCreatedOrders.length > 0}
                        onCheckedChange={(checked) => handleSelectAllCreated(!!checked)}
                      />
                    </TableHead>
                    <TableHead>Order #</TableHead>
                    <TableHead className="w-[200px]">Customer Name</TableHead>
                    <TableHead>Online Item (Raw)</TableHead>
                    <TableHead className="w-[250px]">Map to Product</TableHead>
                    <TableHead className="w-[150px]">Bill No.</TableHead>
                    <TableHead className="w-[150px]">Bill Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCreatedOrders.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">No pending online orders found matching your search.</TableCell></TableRow>
                  ) : (
                    filteredCreatedOrders.map((o) => (
                      <TableRow key={o.id} className={o.dispatched ? "opacity-50" : ""}>
                        <TableCell>
                          <Checkbox 
                            checked={selectedCreatedIds.includes(o.id)}
                            onCheckedChange={(checked) => handleSelectCreatedOrder(o.id, !!checked)}
                            disabled={o.dispatched}
                          />
                        </TableCell>
                        <TableCell className="font-bold">#{o.order_number}</TableCell>
                        <TableCell>
                          <Input 
                            className="h-8 text-xs font-medium" 
                            value={o.client_name} 
                            onChange={(e) => handleUpdateOrderField(o.id, 'client_name', e.target.value)}
                            disabled={o.dispatched}
                            placeholder="Customer Name"
                          />
                        </TableCell>
                        <TableCell>
                          <span className="text-[10px] text-muted-foreground italic">{o.raw_item_name}</span>
                        </TableCell>
                        <TableCell>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" size="sm" className="w-full justify-between text-left font-normal h-auto py-1" disabled={o.dispatched}>
                                {o.mapped_product_id ? (
                                  <span className="text-[10px] truncate">{products.find(p => p.id === o.mapped_product_id)?.name}</span>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground">Select Product...</span>
                                )}
                                <ChevronsUpDown className="ml-1 h-3 w-3 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[250px] p-0">
                              <div className="p-2 border-b"><Input placeholder="Search..." value={productSearch} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProductSearch(e.target.value)} className="h-7 text-xs" /></div>
                              <ScrollArea className="h-[150px]">
                                {filteredProducts.map(p => (
                                  <Button key={p.id} variant="ghost" className="w-full justify-start text-[10px] h-auto py-1" onClick={() => { handleUpdateOrderField(o.id, 'mapped_product_id', p.id); setProductSearch(''); }}>
                                    {p.name} ({p.code})
                                  </Button>
                                ))}
                              </ScrollArea>
                            </PopoverContent>
                          </Popover>
                        </TableCell>
                        <TableCell><Input size={1} className="h-8 text-xs" value={o.bill_no} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpdateOrderField(o.id, 'bill_no', e.target.value)} disabled={o.dispatched} placeholder="Bill #" /></TableCell>
                        <TableCell><Input type="date" className="h-8 text-xs" value={o.dispatch_date} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpdateOrderField(o.id, 'dispatch_date', e.target.value)} disabled={o.dispatched} /></TableCell>
                        <TableCell className="text-right font-bold text-xs">₹{o.total_amount.toFixed(2)}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleViewOrder(o.id)} title="View Details">
                              <Eye className="h-4 w-4 text-blue-500" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleEditOrder(o.id)} title="Edit Order">
                              <Edit className="h-4 w-4 text-orange-500" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" title="Delete Order">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Order #{o.order_number}?</AlertDialogTitle>
                                  <AlertDialogDescription>This will permanently remove the order and its details. This action cannot be undone.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteOrder(o)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
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
      
      <OrderDetailsDialog 
        orderId={selectedOrderIdForDetails} 
        isOpen={isOrderDetailsDialogOpen} 
        onOpenChange={setIsOrderDetailsDialogOpen} 
        showGatePassButton={false}
      />
      
      <EditOrderDialog 
        orderId={selectedOrderIdForEdit} 
        isOpen={isEditOrderDialogOpen} 
        onOpenChange={setIsEditOrderDialogOpen} 
        onOrderUpdated={fetchCreatedOrders}
      />
    </div>
  );
};

export default OnlineOrderDispatchDashboard;