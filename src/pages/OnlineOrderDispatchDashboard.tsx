"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft, Check, Trash2, ListChecks, Package, User, Play, Printer, ChevronsUpDown, FileText, Truck, Eraser, AlertCircle, Eye, EyeOff, Copy, X, Edit, Keyboard, LogOut, Search } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Checkbox } from '@/components/ui/checkbox';
import OrderDetailsDialog from '@/components/OrderDetailsDialog';
import EditOrderDialog from '@/components/EditOrderDialog';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import InvoiceExtractor, { ExtractedInvoiceData } from '@/components/InvoiceExtractor'; // New Import

interface OnlineOrder {
  id: string;
  order_number: number;
  order_date: string;
  total_amount: number;
  client_name: string;
  raw_item_name: string;
  platform_order_number: string;
  mapped_product_id: string | null;
  bill_no: string | null;
  dispatch_date: string | null;
  dispatch_number: number | null;
  dispatched: boolean;
  gate_pass_dispatch_time?: string | null;
}

interface Product {
  id: string;
  name: string;
  code: string;
  dp: number;
  gst: string;
}

const formatDate = (dateString: string | null) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const OnlineOrderDispatchDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin, userType, loading: sessionLoading } = useSession();
  const [activeTab, setActiveTab] = useState("process");
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [createdOrders, setCreatedOrders] = useState<OnlineOrder[]>([]);
  const [gatepassCreatedOrders, setGatepassCreatedOrders] = useState<OnlineOrder[]>([]);
  const [selectedCreatedIds, setSelectedCreatedIds] = useState<string[]>([]);
  const [selectedGatepassCreatedIds, setSelectedGatepassCreatedIds] = useState<string[]>([]);
  
  const [productSearch, setProductSearch] = useState("");
  const [companyName, setCompanyName] = useState<string | null>(null);
  
  const [filterOrderNumberProcess, setFilterOrderNumberProcess] = useState("");
  const [filterOrderDate, setFilterOrderDate] = useState("");
  const [filterGatepassDate, setFilterGatepassDate] = useState<string>('');
  const [filterGatepassOrderNumber, setFilterGatepassOrderNumber] = useState<string>('');
  const [filterGatepassDispatchNumber, setFilterGatepassDispatchNumber] = useState<string>('');

  const [isOrderDetailsDialogOpen, setIsOrderDetailsDialogOpen] = useState(false);
  const [selectedOrderIdForDetails, setSelectedOrderIdForDetails] = useState<string | null>(null);
  const [isEditOrderDialogOpen, setIsEditOrderDialogOpen] = useState(false);
  const [selectedOrderIdForEdit, setSelectedOrderIdForEdit] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'invoice-process') {
      setActiveTab('invoice-process');
    } else {
      setActiveTab('process');
    }
  }, [location.search]);

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all products with pagination
      const allProducts: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('products')
          .select('id, name, code, dp, gst')
          .order('name')
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;
        if (data && data.length > 0) {
          allProducts.push(...data);
        }
        if (!data || data.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      }

      const companyRes = await supabase.from('company_info').select('company_name').limit(1).single();

      setProducts(allProducts);
      setCompanyName(companyRes.data?.company_name || null);
    } catch (error: any) {
      showError("Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCreatedOrders = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('online_orders')
        .select(`
          id, order_number, order_date, total_amount, bill_no, dispatch_date, dispatch_number, dispatched,
          dealers!inner(name),
          online_order_details!inner(client_name, raw_item_name, platform_order_number, mapped_product_id)
        `)
        .eq('dealers.name', 'Online Order')
        .eq('dispatched', false)
        .order('order_number', { ascending: false });

      if (filterOrderDate) {
        const startOfDay = `${filterOrderDate}T00:00:00.000Z`;
        const endOfDay = `${filterOrderDate}T23:59:59.999Z`;
        query = query.gte('order_date', startOfDay).lte('order_date', endOfDay);
      }

      const { data, error } = await query;
      if (error) throw error;

      const formatted: OnlineOrder[] = (data || []).map((o: any) => ({
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
  }, [filterOrderDate]);

  const fetchGatepassCreatedOrders = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('online_orders')
        .select(`
          id, order_number, order_date, total_amount, bill_no, dispatch_date, dispatch_number, dispatched,
          dealers!inner(name),
          online_order_details!inner(client_name, raw_item_name, platform_order_number, mapped_product_id, products(name, code))
        `)
        .eq('dealers.name', 'Online Order')
        .not('dispatch_number', 'is', null)
        .is('dispatch_date', null)
        .order('dispatch_date', { ascending: false });

      if (filterGatepassDate) {
        const startOfDay = `${filterGatepassDate}T00:00:00.000Z`;
        const endOfDay = `${filterGatepassDate}T23:59:59.999Z`;
        query = query.gte('dispatch_date', startOfDay).lte('dispatch_date', endOfDay);
      }

      if (filterGatepassOrderNumber) {
        query = query.eq('order_number', parseInt(filterGatepassOrderNumber));
      }

      if (filterGatepassDispatchNumber) {
        query = query.eq('dispatch_number', parseInt(filterGatepassDispatchNumber));
      }

      const { data, error } = await query;
      if (error) throw error;

      const formatted: OnlineOrder[] = (data || []).map((o: any) => ({
        id: o.id,
        order_number: o.order_number,
        order_date: o.order_date,
        total_amount: o.total_amount,
        client_name: o.online_order_details[0].client_name,
        raw_item_name: o.online_order_details[0].raw_item_name,
        platform_order_number: o.online_order_details[0].platform_order_number,
        mapped_product_id: o.online_order_details[0].mapped_product_id,
        bill_no: o.bill_no || '',
        dispatch_date: o.dispatch_date ? o.dispatch_date.split('T')[0] : '',
        dispatch_number: o.dispatch_number,
        dispatched: o.dispatched,
        gate_pass_dispatch_time: o.gate_pass_dispatch_time,
      }));
      setGatepassCreatedOrders(formatted);
    } catch (error: any) {
      showError("Failed to load gatepass created orders.");
    } finally {
      setLoading(false);
    }
  }, [filterGatepassDate, filterGatepassOrderNumber, filterGatepassDispatchNumber]);

  useEffect(() => {
    if (!sessionLoading) {
      if (!user) {
        navigate('/login');
      } else if (userType !== 'online_orders' && !isAdmin) {
        showError('Access Denied.');
        navigate('/dashboard');
      } else {
        fetchInitialData();
      }
    }
  }, [sessionLoading, user, userType, isAdmin, navigate, fetchInitialData]);

  useEffect(() => {
    if (user) {
      fetchCreatedOrders();
      fetchGatepassCreatedOrders();
    }
  }, [user, fetchCreatedOrders, fetchGatepassCreatedOrders]);

  const handleDataExtracted = (data: ExtractedInvoiceData) => {
    const matchedOrder = createdOrders.find(o => o.order_number.toString() === data.orderNo);
    if (!matchedOrder) {
      showError(`No pending online order found with Order Number #${data.orderNo}.`);
      return;
    }

    const extractedItemName = data.items[0]?.name.toLowerCase() || '';
    const matchedProduct = products.find(p => 
      p.name.toLowerCase().includes(extractedItemName) || 
      extractedItemName.includes(p.name.toLowerCase())
    );

    setCreatedOrders(prev => prev.map(o => {
      if (o.id === matchedOrder.id) {
        return {
          ...o,
          bill_no: data.billNo,
          dispatch_date: data.billDate,
        };
      }
      return o;
    }));

    setActiveTab("process");
    showSuccess(`Matched Order #${data.orderNo}. Details have been pre-filled in the Dispatch tab.`);
    // Optional: scroll to the element
    setTimeout(() => {
      const element = document.getElementById(`order-row-${matchedOrder.id}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element?.classList.add('animate-pulse', 'bg-green-100');
      setTimeout(() => element?.classList.remove('animate-pulse', 'bg-green-100'), 3000);
    }, 100);
  };

  const handleUpdateOrderField = (orderId: string, field: keyof OnlineOrder, value: any) => {
    setCreatedOrders(prev => prev.map(o => o.id === orderId ? { ...o, [field]: value } : o));
  };

  const handleBulkCreateGatepass = async () => {
    const ordersToProcess = createdOrders.filter(o => selectedCreatedIds.includes(o.id) && o.bill_no);
    if (ordersToProcess.length === 0) {
      showError("Enter bill numbers for the selected orders first.");
      return;
    }

    setIsProcessing(true);
    try {
      for (const order of ordersToProcess) {
        const product = products.find(p => p.id === order.mapped_product_id);
        let gstPercent = 0;
        if (product) {
          gstPercent = parseFloat(product.gst) || 0;
          if (gstPercent > 0 && gstPercent <= 1) gstPercent = gstPercent * 100;
        }

        await supabase.from('orders').update({
          bill_no: order.bill_no,
          dispatch_date: order.dispatch_date,
          dispatched: true
        }).eq('id', order.id);

        await supabase.from('online_order_details').update({
          client_name: order.client_name
        }).eq('order_id', order.id);

        await supabase.from('sales').insert({
          order_id: order.id,
          product_id: product?.id || null,
          quantity: 1,
          unit_price: gstPercent > 0 ? order.total_amount / (1 + gstPercent / 100) : order.total_amount,
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

  const handleSelectGatepassCreated = (id: string, checked: boolean) => {
    setSelectedGatepassCreatedIds(prev => checked ? [...prev, id] : prev.filter(i => i !== id));
  };

  const handleSelectAllGatepassCreated = (checked: boolean) => {
    setSelectedGatepassCreatedIds(checked ? gatepassCreatedOrders.map(o => o.id) : []);
  };

  const handleViewOrder = (id: string) => {
    setSelectedOrderIdForDetails(id);
    setIsOrderDetailsDialogOpen(true);
  };

  const handleEditOrder = (id: string) => {
    setSelectedOrderIdForEdit(id);
    setIsEditOrderDialogOpen(true);
  };

  const handleDeleteOrder = async (order: OnlineOrder) => {
    setIsProcessing(true);
    try {
      // Delete associated records first
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

  const handleBulkDeleteOrders = async () => {
    if (selectedCreatedIds.length === 0) return;
    setIsProcessing(true);
    try {
      // Delete dependent records first to satisfy FK constraints
      let res;

      res = await supabase.from('payments').delete().in('order_id', selectedCreatedIds);
      if (res.error) throw res.error;

      res = await supabase.from('sales').delete().in('order_id', selectedCreatedIds);
      if (res.error) throw res.error;

      res = await supabase.from('online_order_details').delete().in('order_id', selectedCreatedIds);
      if (res.error) throw res.error;

      res = await supabase.from('orders').delete().in('id', selectedCreatedIds);
      if (res.error) throw res.error;

      showSuccess(`${selectedCreatedIds.length} order(s) deleted successfully.`);
      setSelectedCreatedIds([]);
      fetchCreatedOrders();
    } catch (error: any) {
      showError(`Failed to delete orders: ${error.message}`);
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

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-7xl">
        <div className="flex justify-between items-center mb-6">
          <Button variant="outline" onClick={() => navigate(isAdmin ? '/admin-dashboard' : '/')} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold text-primary">Online Order Dispatch</h1>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => navigate('/manual-order-entry')} className="flex items-center gap-2">
              <Keyboard className="h-4 w-4" /> Manual Entry
            </Button>
            <Button onClick={handleLogout} variant="outline" className="flex items-center gap-2">
              <LogOut className="h-4 w-4" /> Logout
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="process" className="text-lg py-3"><ListChecks className="mr-2 h-5 w-5" /> 1. Dispatch</TabsTrigger>
            <TabsTrigger value="invoice-process" className="text-lg py-3"><FileText className="mr-2 h-5 w-5" /> 2. Process from Invoice</TabsTrigger>
          </TabsList>

          <TabsContent value="invoice-process">
            <InvoiceExtractor onDataExtracted={handleDataExtracted} />
          </TabsContent>

          <TabsContent value="process" className="space-y-6">
            <Card>
              <CardHeader className="bg-indigo-600 text-white rounded-t-lg">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <CardTitle>Dispatch Orders</CardTitle>
                    <CardDescription className="text-indigo-100">Enter bill details and generate gatepasses for online orders.</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={isProcessing || selectedCreatedIds.length === 0}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Selected ({selectedCreatedIds.length})
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete the {selectedCreatedIds.length} selected order(s) and all associated data. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleBulkDeleteOrders} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <Button onClick={handleBulkCreateGatepass} disabled={isProcessing || selectedCreatedIds.length === 0} className="bg-green-500 hover:bg-green-600">
                      {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                      Generate Gatepasses for Selected
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-end gap-4">
                  <div className="relative flex-grow max-w-xs">
                    <Label>Search Order # or Platform ID</Label>
                    <Search className="absolute left-2 top-8 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search..." value={filterOrderNumberProcess} onChange={(e) => setFilterOrderNumberProcess(e.target.value)} className="pl-8" />
                  </div>
                  <div className="flex-grow max-w-xs">
                    <Label>Filter by Order Date</Label>
                    <Input type="date" value={filterOrderDate} onChange={(e) => setFilterOrderDate(e.target.value)} />
                  </div>
                </div>

                <ScrollArea className="h-[400px] border rounded-md">
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
                        <TableHead>Platform Order #</TableHead>
                        <TableHead className="w-[200px]">Customer Name</TableHead>
                        <TableHead>Online Item (Raw)</TableHead>
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
                          <TableRow key={o.id} id={`order-row-${o.id}`} className={o.dispatched ? "opacity-50" : ""}>
                            <TableCell>
                              <Checkbox 
                                checked={selectedCreatedIds.includes(o.id)}
                                onCheckedChange={(checked) => handleSelectCreatedOrder(o.id, !!checked)}
                                disabled={o.dispatched}
                              />
                            </TableCell>
                            <TableCell className="font-bold">#{o.order_number}</TableCell>
                            <TableCell className="font-mono text-xs">{o.platform_order_number}</TableCell>
                            <TableCell><Input className="h-8 text-xs font-medium" value={o.client_name} onChange={(e) => handleUpdateOrderField(o.id, 'client_name', e.target.value)} disabled={o.dispatched} placeholder="Customer Name" /></TableCell>
                            <TableCell><span className="text-[10px] text-muted-foreground italic">{o.raw_item_name}</span></TableCell>
                            <TableCell><Input size={1} className="h-8 text-xs" value={o.bill_no || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpdateOrderField(o.id, 'bill_no', e.target.value)} disabled={o.dispatched} placeholder="Bill #" /></TableCell>
                            <TableCell><Input type="date" className="h-8 text-xs" value={o.dispatch_date || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpdateOrderField(o.id, 'dispatch_date', e.target.value)} disabled={o.dispatched} /></TableCell>
                            <TableCell className="text-right font-bold text-xs">₹{o.total_amount.toFixed(2)}</TableCell>
                            <TableCell className="text-center">
                              <div className="flex justify-center gap-1">
                                <Button variant="ghost" size="icon" onClick={() => handleViewOrder(o.id)} title="View Details"><Eye className="h-4 w-4 text-blue-500" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => handleEditOrder(o.id)} title="Edit Order"><Edit className="h-4 w-4 text-orange-500" /></Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild><Button variant="ghost" size="icon" title="Delete Order"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Delete Order #{o.order_number}?</AlertDialogTitle><AlertDialogDescription>This will permanently remove the order and its details. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteOrder(o)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
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