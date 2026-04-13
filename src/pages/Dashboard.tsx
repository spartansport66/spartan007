"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { DollarSign, Package, Users, Activity, LogOut, Boxes, Building, UserCog, Loader2, Search, Eye, FileText, Lock, Edit, PlusCircle, Trash2, Printer, ShoppingCart } from 'lucide-react';
import MultiItemOrderForm from '@/components/MultiItemOrderForm';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { showError, showSuccess } from '@/utils/toast';
import { formatCurrency } from '@/utils/format';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import OrderDetailsDialog from '@/components/OrderDetailsDialog';
import SalesPersonPerformanceCard from '@/components/SalesPersonPerformanceCard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import SalesPersonSalesReport from '@/components/reports/SalesPersonSalesReport';
import SalesPersonDealerReport from '@/components/reports/SalesPersonDealerReport';
import SalesPersonPaymentsReport from '@/components/reports/SalesPersonPaymentsReport';
import DailyVisitProgressCard from '@/components/DailyVisitProgressCard';
import EditOrderDialog from '@/components/EditOrderDialog';
import SalesPersonDisapprovedOrdersCard from '@/components/SalesPersonDisapprovedOrdersCard';
import PaymentReceivedCard from '@/components/PaymentReceivedCard';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Checkbox } from '@/components/ui/checkbox';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Product {
  id: string;
  name: string;
  dp: number;
  closing_stock: number;
  description: string;
}

interface Dealer {
  id: string;
  name: string;
}

interface OrderItemDisplay {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_dp: number;
  total_price: number;
}

interface OnlineOrderInfo {
  client_name: string;
  platform_name: string;
  platform_order_number: string | null;
}

interface OrderDisplay {
  id: string;
  order_number: number;
  order_date: string;
  total_amount: number;
  dealer_name: string;
  payment_status: string;
  items: OrderItemDisplay[];
  dispatched: boolean;
  online_details?: OnlineOrderInfo | null;
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, isAdmin, userType } = useSession();
  const [orders, setOrders] = useState<OrderDisplay[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [salesPersonName, setSalesPersonName] = useState<string>('');
  const [filterDealerId, setFilterDealerId] = useState<string>('');
  const [filterFromDate, setFilterFromDate] = useState<string>(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    const day = String(thirtyDaysAgo.getDate()).padStart(2, '0');
    const month = String(thirtyDaysAgo.getMonth() + 1).padStart(2, '0');
    const year = thirtyDaysAgo.getFullYear();
    return `${year}-${month}-${day}`;
  });
  const [filterToDate, setFilterToDate] = useState<string>(() => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    return `${year}-${month}-${day}`;
  });
  const [allDealers, setAllDealers] = useState<{ id: string; name: string }[]>([]);

  const [isOrderDetailsDialogOpen, setIsOrderDetailsDialogOpen] = useState(false);
  const [selectedOrderIdForDetails, setSelectedOrderIdForDetails] = useState<string | null>(null);
  
  const [isEditOrderDialogOpen, setIsEditOrderDialogOpen] = useState(false);
  const [selectedOrderIdForEdit, setSelectedOrderIdForEdit] = useState<string | null>(null);

  const [isSalesPersonSalesReportOpen, setIsSalesPersonSalesReportOpen] = useState(false);
  const [isSalesPersonDealerReportOpen, setIsSalesPersonDealerReportOpen] = useState(false);
  const [isSalesPersonPaymentsReportOpen, setIsSalesPersonPaymentsReportOpen] = useState(false);
  
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isBulkPrinting, setIsBulkPrinting] = useState(false);
  const [companyName, setCompanyName] = useState<string | null>(null);

  const deliveryLocation = null; // Define or fetch the actual value
  const transportName = null; // Define or fetch the actual value
  const bookingDestination = null; // Define or fetch the actual value
  const dispatchDate = null; // Define or fetch the actual value

  const handleRefreshData = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  const fetchInitialData = useCallback(async () => {
    if (!user) {
      setLoadingData(false);
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', user.id)
      .single();

    if (!profileError && profileData) {
      setSalesPersonName(`${profileData.first_name || ''} ${profileData.last_name || ''}`.trim());
    }

    const { data: assignedDealersData, error: assignedDealersError } = await supabase
      .from('dealer_sales_persons')
      .select('dealers(id, name)')
      .eq('sales_person_id', user.id);

    if (assignedDealersError) {
      console.error('Error fetching assigned dealers:', assignedDealersError);
      showError(`Failed to load assigned dealers: ${assignedDealersError.message}`);
      setAllDealers([]);
    } else {
      const formattedDealers: Dealer[] = (assignedDealersData || []).map((item: any) => item.dealers);
      setAllDealers(formattedDealers);
    }

    const { data: companyInfo } = await supabase.from('company_info').select('company_name').limit(1).single();
    setCompanyName(companyInfo?.company_name || null);
    
    setLoadingData(false);
  }, [user]);

  const fetchRecentOrders = useCallback(async () => {
    if (!user) {
      setLoadingOrders(false);
      return;
    }
    setLoadingOrders(true);

    let ordersQuery = supabase
      .from('orders')
      .select(`
        id,
        order_number,
        order_date,
        total_amount,
        payment_status,
        dispatched,
        dealers (name),
        sales (
          product_id,
          quantity,
          total_price,
          products (id, name, dp)
        )
      `)
      .eq('user_id', user.id)
      .order('order_date', { ascending: false });

    if (filterDealerId) {
      ordersQuery = ordersQuery.eq('dealer_id', filterDealerId);
    }

    if (filterFromDate) {
      ordersQuery = ordersQuery.gte('order_date', `${filterFromDate}T00:00:00.000Z`);
    }

    if (filterToDate) {
      ordersQuery = ordersQuery.lte('order_date', `${filterToDate}T23:59:59.999Z`);
    }

    const { data: ordersData, error: ordersError } = await ordersQuery;

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      showError(`Failed to load orders data: ${ordersError.message}`);
      setOrders([]);
    } else {
      // fetch online_order_details separately to avoid relying on DB FK in schema cache
      const orderIds = (ordersData || []).map((o: any) => o.id).filter(Boolean);
      let detailsMap: Record<string, any> = {};
      if (orderIds.length > 0) {
        try {
          const { data: detailsData } = await supabase
            .from('online_order_details')
            .select('order_id, client_name, platform_order_number, city, state, contact_no, online_platforms (name)')
            .in('order_id', orderIds);
          (detailsData || []).forEach((d: any) => { detailsMap[d.order_id] = d; });
        } catch (e) {
          console.error('Failed to fetch online order details fallback:', e);
        }
      }

      const processedOrders: OrderDisplay[] = (ordersData || []).map((order: any) => {
        const det = detailsMap[order.id];
        const onlineDetails = det ? {
          client_name: det.client_name,
          platform_name: (det.online_platforms as any)?.name || 'N/A',
          platform_order_number: det.platform_order_number,
        } : null;

        return {
          id: order.id,
          order_number: order.order_number,
          order_date: order.order_date,
          total_amount: order.total_amount,
          dealer_name: order.dealers?.name || 'N/A',
          payment_status: order.payment_status,
          dispatched: order.dispatched,
          online_details: onlineDetails,
          items: (order.sales || []).map((sale: any) => ({
            product_id: sale.product_id || '',
            product_name: sale.products?.name || 'N/A',
            quantity: sale.quantity,
            unit_dp: sale.products?.dp || 0,
            total_price: sale.total_price,
          })),
        };
      });

      setOrders(processedOrders);
    }

    setLoadingOrders(false);
  }, [user, filterDealerId, filterFromDate, filterToDate, refreshKey]);

  useEffect(() => {
    if (!sessionLoading) {
      if (!user) {
        navigate('/login');
      } else if (isAdmin) {
        navigate('/admin-dashboard');
      } else if (userType === 'accounts') {
        navigate('/accounts-dashboard');
      } else {
        fetchInitialData();
      }
    }
  }, [user, sessionLoading, isAdmin, userType, fetchInitialData, navigate]);
  
  useEffect(() => {
    if (user && !isAdmin) {
      fetchRecentOrders();
    }
  }, [user, isAdmin, fetchRecentOrders]);

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

  const handleApplyOrderFilters = () => {
    setRefreshKey(prev => prev + 1);
    setSelectedOrderIds([]);
  };

  const handleClearFilters = () => {
    setFilterDealerId('');
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const todayString = `${year}-${month}-${day}`;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    const thirtyDaysAgoDay = String(thirtyDaysAgo.getDate()).padStart(2, '0');
    const thirtyDaysAgoMonth = String(thirtyDaysAgo.getMonth() + 1).padStart(2, '0');
    const thirtyDaysAgoYear = thirtyDaysAgo.getFullYear();
    const thirtyDaysAgoString = `${thirtyDaysAgoYear}-${thirtyDaysAgoMonth}-${thirtyDaysAgoDay}`;

    setFilterFromDate(thirtyDaysAgoString);
    setFilterToDate(todayString);
    setRefreshKey(prev => prev + 1);
    setSelectedOrderIds([]);
  };

  const handleViewOrderDetails = (orderId: string) => {
    setSelectedOrderIdForDetails(orderId);
    setIsOrderDetailsDialogOpen(true);
  };
  
  const handleEditOrder = (orderId: string) => {
    setSelectedOrderIdForEdit(orderId);
    setIsEditOrderDialogOpen(true);
  };
  
  const handleOrderUpdated = () => {
    setIsEditOrderDialogOpen(false);
    handleRefreshData();
  };

  const handleDeleteOrder = async (order: OrderDisplay) => {
    setLoadingOrders(true);
    try {
      await supabase.from('payments').delete().eq('order_id', order.id);
      await supabase.from('sales').delete().eq('order_id', order.id);
      const { error: deleteError } = await supabase.from('orders').delete().eq('id', order.id);
      if (deleteError) throw deleteError;

      showSuccess(`Order #${order.order_number} deleted and stock restored.`);
      fetchRecentOrders();
      handleRefreshData();
    } catch (error: any) {
      console.error('Error deleting order:', error);
      showError(`Failed to delete order: ${error.message}`);
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    setSelectedOrderIds(prev => checked ? [...prev, orderId] : prev.filter(id => id !== orderId));
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedOrderIds(checked ? orders.map(o => o.id) : []);
  };

  const handleBulkPrintOrderDetails = async () => {
    if (selectedOrderIds.length === 0) return;
    setIsBulkPrinting(true);
    try {
      const doc = new jsPDF();
      const darkBlue: [number, number, number] = [30, 58, 138];
      const margin = 15;
      const pageWidth = doc.internal.pageSize.width;

      for (let i = 0; i < selectedOrderIds.length; i++) {
        const { data: orderData } = await supabase
          .from('orders')
          .select(`
            order_number, order_date, total_amount, discount_amount, 
            dealers (name, address, phone, city, state), 
            sales (quantity, total_price, unit_price, discount_percent, gst_percent, products (name, code))
          `)
          .eq('id', selectedOrderIds[i])
          .single();
          
        if (!orderData) continue;
        if (i > 0) doc.addPage();

        doc.setFillColor(darkBlue[0], darkBlue[1], darkBlue[2]); doc.rect(0, 10, pageWidth, 15, 'F');
        doc.setFontSize(18); doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold");
        doc.text(companyName?.toUpperCase() || "ORDER INVOICE", pageWidth / 2, 20, { align: 'center' });

        doc.setTextColor(0); doc.setFontSize(10); let y = 35;
        
        // Online Order Logic for Party Details
        // fetch online details separately (fallback) to avoid FK relationship errors
        let onlineDetails = null;
        try {
          const { data: od } = await supabase.from('online_order_details').select('client_name, platform_order_number, city, state, contact_no, online_platforms (name)').eq('order_id', selectedOrderIds[i]).single();
          if (od) onlineDetails = od;
        } catch (e) {
          // ignore fallback errors
        }
        const isOnline = (orderData.dealers as any)?.name === 'Online Order' && onlineDetails;
        
        const partyName = isOnline && onlineDetails ? onlineDetails.client_name : (orderData.dealers as any).name;
        const partyLocation = isOnline && onlineDetails
          ? `${onlineDetails.city || ''}, ${onlineDetails.state || ''}`.trim() || 'N/A'
          : 'N/A';
        const partyPhone = isOnline && onlineDetails ? onlineDetails.contact_no : (orderData.dealers as any).phone;

        doc.setFont("helvetica", "bold"); doc.text("PARTY DETAILS:", margin, y);
        doc.setFont("helvetica", "normal"); y += 5; doc.text(partyName, margin, y);
        y += 5; const addressLines = doc.splitTextToSize(partyLocation, pageWidth / 2 - margin);
        doc.text(addressLines, margin, y);
        
        let rightY = 35; const rightColX = pageWidth / 2 + 10;
        doc.setFont("helvetica", "bold"); doc.text("ORDER SUMMARY:", rightColX, rightY);
        doc.setFont("helvetica", "normal"); rightY += 5; doc.text(`Order No: #${orderData.order_number}`, rightColX, rightY);
        rightY += 5; doc.text(`Date: ${formatDate(orderData.order_date)}`, rightColX, rightY);
        rightY += 5; doc.text(`Phone: ${partyPhone || 'N/A'}`, rightColX, rightY);

        if (isOnline && onlineDetails) {
          rightY += 5;
          doc.text(`Platform: ${(onlineDetails.online_platforms as any)?.name || 'N/A'}`, rightColX, rightY);
          rightY += 5;
          doc.text(`Platform Order #: ${onlineDetails.platform_order_number || 'N/A'}`, rightColX, rightY);
        }

        y = Math.max(y + (addressLines.length * 5), rightY + 10);
        const tableRows = (orderData.sales || []).map((sale: any) => [
          sale.products?.code || 'N/A', 
          sale.products?.name || 'N/A', 
          sale.quantity.toString(), 
          `Rs.${(sale.unit_price || 0).toFixed(2)}`, 
          `${(sale.discount_percent || 0)}%`, 
          `${(sale.gst_percent || 0)}%`, 
          `Rs.${(sale.total_price || 0).toFixed(2)}`
        ]);

        autoTable(doc, { 
          head: [["Code", "Product", "Qty", "Unit Price", "Disc %", "GST %", "Total"]], 
          body: tableRows, 
          startY: y, 
          headStyles: { fillColor: darkBlue, halign: 'center', fontSize: 8 }, 
          columnStyles: {
            0: { cellWidth: 20, halign: 'center' },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 15, halign: 'center' },
            3: { cellWidth: 25, halign: 'right' },
            4: { cellWidth: 15, halign: 'center' },
            5: { cellWidth: 15, halign: 'center' },
            6: { cellWidth: 25, halign: 'right' }
          },
          styles: { fontSize: 8, cellPadding: 2 } 
        });
        
        const finalY = (doc as any).lastAutoTable.finalY + 10;
        const subtotal = (orderData.sales || []).reduce((sum: number, s: any) => sum + s.total_price, 0);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(`Subtotal: Rs.${subtotal.toFixed(2)}`, pageWidth / 2, finalY, { align: 'center' });
        
        let currentY = finalY;
        if (orderData.discount_amount > 0) {
          currentY += 5;
          doc.text(`Global Discount: -Rs.${orderData.discount_amount.toFixed(2)}`, pageWidth / 2, currentY, { align: 'center' });
        }
        
        currentY += 7;
        doc.setFont("helvetica", "bold"); doc.setFontSize(12);
        doc.text(`FINAL TOTAL: Rs.${orderData.total_amount.toFixed(2)}`, pageWidth / 2, currentY, { align: 'center' });
      }
      doc.save(`Bulk_Order_Details_${new Date().getTime()}.pdf`);
      showSuccess(`Generated ${selectedOrderIds.length} Order Detail PDFs.`);
      setSelectedOrderIds([]);
    } catch (error: any) { showError(`Failed: ${error.message}`); } finally { setIsBulkPrinting(false); }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 w-full">
        <div className="text-left flex-shrink-0">
          <h2 className="text-[4vw] sm:text-[2vw] md:text-xl lg:text-2xl font-bold text-black dark:text-black whitespace-nowrap overflow-hidden text-ellipsis max-w-[40vw] sm:max-w-none">
            Welcome, {salesPersonName || 'Sales Person'}!
          </h2>
        </div>
        <div className="flex-shrink-0 flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <FileText className="h-4 w-4" /> My Reports
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>My Reports</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setIsSalesPersonSalesReportOpen(true)}>Sales Detail Report</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsSalesPersonDealerReportOpen(true)}>My Dealer Report</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsSalesPersonPaymentsReportOpen(true)}>My Payments Report</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/add-dealer')}><PlusCircle className="h-4 w-4 mr-2" /> Add New Dealer</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/manage-dealers')}><Building className="h-4 w-4 mr-2" /> Manage Dealers</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/change-password')}><Lock className="h-4 w-4 mr-2" /> Change Password</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={handleLogout} variant="ghost" size="icon" className="text-black hover:text-black p-2">
            <LogOut className="h-5 w-5 sm:h-6 sm:w-6" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 mb-6">
        <SalesPersonPerformanceCard key={`performance-${refreshKey}`} />
      </div>
      {/* DailyVisitProgressCard hidden */}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        {/* other cards */}
      </div>

      <div className="mb-6">
        <MultiItemOrderForm onOrderPlaced={handleRefreshData} />
      </div>

      <div className="mb-6">
        <SalesPersonDisapprovedOrdersCard />
      </div>

      {/* PaymentStatusCard hidden per request */}

      <Card className="bg-card text-card-foreground shadow-lg mb-6">
        <CardHeader className="bg-teal-500 dark:bg-teal-700 text-white rounded-t-lg p-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-xl font-semibold">My Recent Orders</CardTitle>
              <CardDescription className="text-teal-100 dark:text-teal-200">A list of your recent orders.</CardDescription>
            </div>
            {selectedOrderIds.length > 0 && (
              <Button onClick={handleBulkPrintOrderDetails} disabled={isBulkPrinting} className="bg-white text-teal-600 hover:bg-teal-50">
                {isBulkPrinting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Printer className="h-4 w-4 mr-2" />}
                Bulk Print Invoices ({selectedOrderIds.length})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-muted rounded-lg">
            <div className="flex-1 min-w-[150px]">
              <Label htmlFor="filterDealer">Dealer Name</Label>
              <Select value={filterDealerId || "all"} onValueChange={(value) => setFilterDealerId(value === "all" ? "" : value)}>
                <SelectTrigger id="filterDealer"><SelectValue placeholder="Filter by dealer" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dealers</SelectItem>
                  {allDealers.map(dealer => (<SelectItem key={dealer.id} value={dealer.id}>{dealer.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[150px]">
              <Label htmlFor="filterFromDate">From Date</Label>
              <Input id="filterFromDate" type="date" value={filterFromDate} onChange={(e) => setFilterFromDate(e.target.value)} className="w-full" />
            </div>
            <div className="flex-1 min-w-[150px]">
              <Label htmlFor="filterToDate">To Date</Label>
              <Input id="filterToDate" type="date" value={filterToDate} onChange={(e) => setFilterToDate(e.target.value)} className="w-full" />
            </div>
            <Button onClick={handleApplyOrderFilters} className="flex items-center gap-2"><Search className="h-4 w-4" /> Apply Filters</Button>
            <Button variant="outline" onClick={handleClearFilters} className="flex items-center gap-2">Clear Filters</Button>
          </div>
          <div className="overflow-x-auto">
            {loadingOrders ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading orders...</p></div>
            ) : orders.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No orders recorded yet or matching your filters.</p>
            ) : (
              <div className="max-h-[400px] overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow className="bg-muted hover:bg-muted/90">
                      <TableHead className="w-10">
                        <Checkbox checked={selectedOrderIds.length === orders.length && orders.length > 0} onCheckedChange={(checked) => handleSelectAll(!!checked)} />
                      </TableHead>
                      <TableHead className="text-muted-foreground">Order No.</TableHead>
                      <TableHead className="text-muted-foreground">Dealer / Online Details</TableHead>
                      <TableHead className="text-muted-foreground">Order Date</TableHead>
                      <TableHead className="text-muted-foreground text-right">Total Amount</TableHead>
                      {/* Payment Status column hidden */}
                      <TableHead className="text-muted-foreground text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map(order => (
                      <TableRow key={order.id} className="align-top">
                        <TableCell>
                          <Checkbox checked={selectedOrderIds.includes(order.id)} onCheckedChange={(checked) => handleSelectOrder(order.id, !!checked)} />
                        </TableCell>
                        <TableCell className="font-medium text-foreground">#{order.order_number}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {order.dealer_name === 'Online Order' && order.online_details ? (
                            <div className="flex flex-col text-xs">
                                  <span className="font-bold text-blue-600 dark:text-blue-400">{order.online_details.client_name}</span>
                                  <span>{order.online_details.platform_name} | Order#: {order.online_details.platform_order_number || 'N/A'}</span>
                            </div>
                          ) : (
                            order.dealer_name
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(order.order_date)}</TableCell>
                        <TableCell className="text-muted-foreground text-right">{formatCurrency(order.total_amount)}</TableCell>
                        {/* Payment status hidden in recent orders list */}
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleViewOrderDetails(order.id)} title="View Order Details"><Eye className="h-4 w-4" /></Button>
                            {!order.dispatched && (
                              <>
                                <Button variant="ghost" size="icon" onClick={() => handleEditOrder(order.id)} title="Edit Order"><Edit className="h-4 w-4 text-orange-600" /></Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild><Button variant="ghost" size="icon" title="Delete Order"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Delete Order?</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete Order #{order.order_number}? This will restore the product stock levels.</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteOrder(order)}>Delete</AlertDialogAction></AlertDialogFooter>
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
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <PaymentReceivedCard />

      <MadeWithDyad />
      <OrderDetailsDialog orderId={selectedOrderIdForDetails} isOpen={isOrderDetailsDialogOpen} onOpenChange={setIsOrderDetailsDialogOpen} showGatePassButton={false} />
      <EditOrderDialog
        orderId={selectedOrderIdForEdit}
        isOpen={isEditOrderDialogOpen}
        onOrderUpdated={handleOrderUpdated}
        onOpenChange={setIsEditOrderDialogOpen}
        deliveryLocation={deliveryLocation}
        transportName={transportName}
        bookingDestination={bookingDestination}
        dispatchDate={dispatchDate}
      />
      <SalesPersonSalesReport isOpen={isSalesPersonSalesReportOpen} onOpenChange={setIsSalesPersonSalesReportOpen} />
      <SalesPersonDealerReport isOpen={isSalesPersonDealerReportOpen} onOpenChange={setIsSalesPersonDealerReportOpen} />
      <SalesPersonPaymentsReport isOpen={isSalesPersonPaymentsReportOpen} onOpenChange={setIsSalesPersonPaymentsReportOpen} />
    </div>
  );
};

export default Dashboard;