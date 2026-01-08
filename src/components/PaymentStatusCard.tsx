"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, CalendarDays, DollarSign, Clock, CheckCircle, AlertCircle, PlusCircle, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { useSession } from '@/contexts/SessionContext';
import { Label } from '@/components/ui/label';
import UpdatePaymentDialog from '@/components/UpdatePaymentDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface Order {
  id: string;
  order_number: number;
  order_date: string;
  total_amount: number;
  dealer_name: string;
  dealer_phone: string;
  payment_due_date: string | null;
  payment_status: string;
  // Payment details
  payment_method: string | null;
  payment_amount: number | null;
  payment_date: string | null;
  cheque_dd_no: string | null;
  cheque_dd_date: string | null;
  card_number: string | null;
  card_holder_name: string | null;
  expiry_date: string | null;
  bank_name: string | null;
  account_number: string | null;
  ifsc_code: string | null;
  upi_id: string | null;
  transaction_id: string | null;
}

interface DealerOption {
  value: string;
  label: string;
}

interface DealerBalance {
  id: string;
  name: string;
  opening_balance: number;
  overdue_amount: number;
  total_overdue: number;
}

// Format date as dd/mm/yyyy
const formatDate = (dateString: string | null) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const PaymentStatusCard: React.FC = () => {
  const { user } = useSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [dealerBalances, setDealerBalances] = useState<DealerBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [allDealers, setAllDealers] = useState<DealerOption[]>([]);
  // Filter states - Set default to 'todays_due' for today's pending payments
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'paid' | 'overdue' | 'upcoming' | 'pending_approval' | 'todays_due'>('todays_due');
  const [filterDealerId, setFilterDealerId] = useState<string>('');
  const [filterFromDate, setFilterFromDate] = useState<string>('');
  const [filterToDate, setFilterToDate] = useState<string>('');
  // Dialog states
  const [isUpdatePaymentDialogOpen, setIsUpdatePaymentDialogOpen] = useState(false);
  const [selectedOrderForPaymentUpdate, setSelectedOrderForPaymentUpdate] = useState<Order | null>(null);
  const [isPaymentDetailsDialogOpen, setIsPaymentDetailsDialogOpen] = useState(false);
  const [selectedOrderForPaymentDetails, setSelectedOrderForPaymentDetails] = useState<Order | null>(null);

  const getTodayDateISO = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.toISOString();
  };

  const getEndOfTodayDateISO = () => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return today.toISOString();
  };

  const fetchOrdersAndDealers = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Fetch all dealers assigned to the current user for the filter dropdown
      const { data: assignedDealersData, error: assignedDealersError } = await supabase
        .from('dealer_sales_persons')
        .select('dealers(id, name)')
        .eq('sales_person_id', user.id);
      if (assignedDealersError) {
        console.error('Error fetching assigned dealers for filter:', assignedDealersError.message);
        showError('Failed to load dealers for filter.');
        setAllDealers([]);
      } else {
        setAllDealers((assignedDealersData || []).map((item: any) => ({
          value: item.dealers.id,
          label: item.dealers.name
        })));
      }

      // Build the query for orders, including payments directly
      let query = supabase
        .from('orders')
        .select(`
          id,
          order_number,
          order_date,
          total_amount,
          payment_due_date,
          payment_status,
          dealers (name, phone),
          payments (
            amount,
            payment_method,
            payment_date,
            cheque_dd_no,
            cheque_dd_date,
            card_number,
            card_holder_name,
            expiry_date,
            bank_name,
            account_number,
            ifsc_code,
            upi_id,
            transaction_id
          )
        `)
        .eq('user_id', user.id) // Filter by current sales person
        .order('payment_due_date', { ascending: true });

      const todayISO = getTodayDateISO();
      const endOfTodayISO = getEndOfTodayDateISO();

      if (filterStatus === 'pending') {
        query = query.eq('payment_status', 'pending');
      } else if (filterStatus === 'paid') {
        query = query.eq('payment_status', 'paid');
      } else if (filterStatus === 'pending_approval') {
        query = query.eq('payment_status', 'pending_approval');
      } else if (filterStatus === 'overdue') {
        query = query.eq('payment_status', 'pending').lte('payment_due_date', todayISO);
      } else if (filterStatus === 'upcoming') {
        query = query.eq('payment_status', 'pending').gte('payment_due_date', endOfTodayISO);
      } else if (filterStatus === 'todays_due') {
        query = query.eq('payment_status', 'pending')
          .gte('payment_due_date', todayISO)
          .lte('payment_due_date', endOfTodayISO);
      }

      // Apply dealer filter
      if (filterDealerId) {
        query = query.eq('dealer_id', filterDealerId);
      }

      // Apply date range filter for order_date
      if (filterFromDate) {
        const startOfDay = `${filterFromDate}T00:00:00.000Z`;
        query = query.gte('order_date', startOfDay);
      }
      if (filterToDate) {
        const endOfDay = `${filterToDate}T23:59:59.999Z`;
        query = query.lte('order_date', endOfDay);
      }

      const { data: ordersData, error: ordersError } = await query;
      if (ordersError) {
        console.error('Error fetching orders:', ordersError.message);
        showError('Failed to load orders.');
        setOrders([]);
      } else {
        const formattedOrders: Order[] = (ordersData || []).map((order: any) => {
          // Payment details are now directly nested in order.payments
          const paymentInfo = order.payments && order.payments.length > 0 ? order.payments[0] : null;
          return {
            id: order.id,
            order_number: order.order_number,
            order_date: order.order_date,
            total_amount: order.total_amount,
            dealer_name: order.dealers?.name || 'N/A',
            dealer_phone: order.dealers?.phone || '',
            payment_due_date: order.payment_due_date,
            payment_status: order.payment_status,
            // Payment details
            payment_method: paymentInfo?.payment_method || null,
            payment_amount: paymentInfo?.amount || null,
            payment_date: paymentInfo?.payment_date || null,
            cheque_dd_no: paymentInfo?.cheque_dd_no || null,
            cheque_dd_date: paymentInfo?.cheque_dd_date || null,
            card_number: paymentInfo?.card_number || null,
            card_holder_name: paymentInfo?.card_holder_name || null,
            expiry_date: paymentInfo?.expiry_date || null,
            bank_name: paymentInfo?.bank_name || null,
            account_number: paymentInfo?.account_number || null,
            ifsc_code: paymentInfo?.ifsc_code || null,
            upi_id: paymentInfo?.upi_id || null,
            transaction_id: paymentInfo?.transaction_id || null,
          };
        });
        setOrders(formattedOrders);
      }

      // Fetch dealer balances and overdue amounts
      const { data: dealerBalancesData, error: dealerBalancesError } = await supabase
        .from('dealer_sales_persons')
        .select(`
          dealers (
            id,
            name,
            dealer_balances (
              opening_balance
            ),
            orders (
              total_amount,
              payment_status,
              payment_due_date
            )
          )
        `)
        .eq('sales_person_id', user.id);

      if (dealerBalancesError) {
        console.error('Error fetching dealer balances:', dealerBalancesError.message);
        showError('Failed to load dealer balances.');
        setDealerBalances([]);
      } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const formattedBalances: DealerBalance[] = (dealerBalancesData || []).map((item: any) => {
          const dealer = item.dealers;
          const openingBalance = dealer.dealer_balances?.[0]?.opening_balance || 0;
          
          // Calculate overdue amount (pending orders with due date <= today)
          const overdueAmount = (dealer.orders || [])
            .filter((order: any) => 
              order.payment_status === 'pending' && 
              new Date(order.payment_due_date) <= today
            )
            .reduce((sum: number, order: any) => sum + order.total_amount, 0);
          
          const totalOverdue = openingBalance + overdueAmount;
          
          return {
            id: dealer.id,
            name: dealer.name,
            opening_balance: openingBalance,
            overdue_amount: overdueAmount,
            total_overdue: totalOverdue
          };
        });
        
        setDealerBalances(formattedBalances);
      }
    } catch (error: any) {
      console.error('Error in fetchOrdersAndDealers:', error.message);
      showError('An unexpected error occurred while fetching orders.');
    } finally {
      setLoading(false);
    }
  }, [user, filterStatus, filterDealerId, filterFromDate, filterToDate]);

  useEffect(() => {
    fetchOrdersAndDealers();
  }, [fetchOrdersAndDealers]);

  const handleClearFilters = () => {
    // Reset to default showing today's due payments
    setFilterStatus('todays_due');
    setFilterDealerId('');
    setFilterFromDate('');
    setFilterToDate('');
  };

  const handleAddPaymentDetails = (order: Order) => {
    setSelectedOrderForPaymentUpdate(order);
    setIsUpdatePaymentDialogOpen(true);
  };

  const handleViewPaymentDetails = (order: Order) => {
    setSelectedOrderForPaymentDetails(order);
    setIsPaymentDetailsDialogOpen(true);
  };

  const handlePaymentUpdated = () => {
    fetchOrdersAndDealers(); // Refresh the list after a payment is updated
  };

  const isOverdue = (dueDate: string | null, status: string) => {
    if (!dueDate || status !== 'pending') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    return due < today;
  };

  const getStatusColor = (status: string, dueDate: string | null) => {
    if (status === 'paid') return 'text-green-600 bg-green-100';
    if (status === 'pending_approval') return 'text-blue-600 bg-blue-100';
    if (isOverdue(dueDate, status)) return 'text-red-600 bg-red-100';
    if (status === 'pending') return 'text-yellow-600 bg-yellow-100';
    return 'text-gray-600 bg-gray-100';
  };

  const getStatusIcon = (status: string, dueDate: string | null) => {
    if (status === 'paid') return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (status === 'pending_approval') return <Clock className="h-4 w-4 text-blue-600" />;
    if (isOverdue(dueDate, status)) return <AlertCircle className="h-4 w-4 text-red-600" />;
    if (status === 'pending') return <Clock className="h-4 w-4 text-yellow-600" />;
    return <Clock className="h-4 w-4 text-gray-600" />;
  };

  const renderPaymentDetails = (order: Order) => {
    if (!order.payment_method) return null;
    return (
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Payment Details for Order #{order.order_number}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <p><strong>Payment Method:</strong> {order.payment_method}</p>
            <p><strong>Amount:</strong> ₹{order.payment_amount?.toFixed(2) || 'N/A'}</p>
            <p><strong>Payment Date:</strong> {formatDate(order.payment_date)}</p>
          </div>
          {order.payment_method === 'Cheque/DD' && (
            <div>
              <p><strong>Cheque/DD No:</strong> {order.cheque_dd_no || 'N/A'}</p>
              <p><strong>Cheque/DD Date:</strong> {formatDate(order.cheque_dd_date)}</p>
            </div>
          )}
          {order.payment_method === 'Card' && (
            <div>
              <p><strong>Card Number:</strong> {order.card_number ? `**** **** **** ${order.card_number.slice(-4)}` : 'N/A'}</p>
              <p><strong>Card Holder:</strong> {order.card_holder_name || 'N/A'}</p>
              <p><strong>Expiry Date:</strong> {order.expiry_date || 'N/A'}</p>
            </div>
          )}
          {order.payment_method === 'Bank Transfer' && (
            <div>
              <p><strong>Bank Name:</strong> {order.bank_name || 'N/A'}</p>
              <p><strong>Account Number:</strong> {order.account_number ? `****${order.account_number.slice(-4)}` : 'N/A'}</p>
              <p><strong>IFSC Code:</strong> {order.ifsc_code || 'N/A'}</p>
            </div>
          )}
          {order.payment_method === 'UPI' && (
            <div>
              <p><strong>UPI ID:</strong> {order.upi_id || 'N/A'}</p>
            </div>
          )}
          {(order.payment_method === 'Card' || order.payment_method === 'Bank Transfer' || order.payment_method === 'UPI' || order.payment_method === 'Cash') && (
            <div>
              <p><strong>Transaction ID:</strong> {order.transaction_id || 'N/A'}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className="bg-card text-card-foreground shadow-lg mb-6">
      <CardHeader className="bg-indigo-500 dark:bg-indigo-700 text-white rounded-t-lg p-4">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-xl font-semibold">Payment Status</CardTitle>
            <CardDescription className="text-indigo-100 dark:text-indigo-200">
              View and manage the payment status of all orders.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div id="payment-filters" className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-muted rounded-lg">
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterStatus">Payment Status</Label>
            <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as typeof filterStatus)}>
              <SelectTrigger id="filterStatus" className="w-full">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="pending_approval">Pending Approval</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="todays_due">Today's Due</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterDealer">Dealer Name</Label>
            <Select value={filterDealerId || "all"} onValueChange={(value) => setFilterDealerId(value === "all" ? "" : value)}>
              <SelectTrigger id="filterDealer" className="w-full">
                <SelectValue placeholder="Filter by dealer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Dealers</SelectItem>
                {allDealers.map(dealer => (
                  <SelectItem key={dealer.value} value={dealer.value}>{dealer.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterFromDate">From Order Date</Label>
            <Input id="filterFromDate" type="date" value={filterFromDate} onChange={(e) => setFilterFromDate(e.target.value)} className="w-full" />
          </div>
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterToDate">To Order Date</Label>
            <Input id="filterToDate" type="date" value={filterToDate} onChange={(e) => setFilterToDate(e.target.value)} className="w-full" />
          </div>
          <Button onClick={fetchOrdersAndDealers} className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Apply Filters
          </Button>
          <Button variant="outline" onClick={handleClearFilters} className="flex items-center gap-2">
            Clear Filters
          </Button>
        </div>

        {/* Dealer Balances Section */}
        <div className="mb-6 p-4 bg-muted rounded-lg">
          <h3 className="text-lg font-semibold mb-3">Dealer Balances</h3>
          {dealerBalances.length === 0 ? (
            <p className="text-muted-foreground">No dealer balances available.</p>
          ) : (
            <div className="max-h-60 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-muted-foreground">Dealer Name</TableHead>
                    <TableHead className="text-muted-foreground text-right">Opening Balance</TableHead>
                    <TableHead className="text-muted-foreground text-right">Overdue Amount</TableHead>
                    <TableHead className="text-muted-foreground text-right">Total Overdue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dealerBalances
                    .filter(dealer => dealer.total_overdue > 0) // Only show dealers with overdue amounts
                    .map((dealer) => (
                      <TableRow key={dealer.id} className="hover:bg-accent/50">
                        <TableCell className="font-medium text-foreground">{dealer.name}</TableCell>
                        <TableCell className="text-right">₹{dealer.opening_balance.toFixed(2)}</TableCell>
                        <TableCell className="text-right">₹{dealer.overdue_amount.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-semibold text-red-600">₹{dealer.total_overdue.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
              {dealerBalances.filter(dealer => dealer.total_overdue > 0).length === 0 && (
                <p className="text-muted-foreground text-center py-2">No dealers with overdue amounts.</p>
              )}
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading orders...</p>
            </div>
          ) : orders.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No orders found for the selected criteria.</p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow className="bg-muted hover:bg-muted/90">
                    <TableHead className="text-muted-foreground">Order No.</TableHead>
                    <TableHead className="text-muted-foreground">Dealer Name</TableHead>
                    <TableHead className="text-muted-foreground">Order Date</TableHead>
                    <TableHead className="text-muted-foreground text-right">Total Amount</TableHead>
                    <TableHead className="text-muted-foreground">Payment Status</TableHead>
                    <TableHead className="text-muted-foreground">Payment Due Date</TableHead>
                    <TableHead className="text-muted-foreground text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow 
                      key={order.id} 
                      className={isOverdue(order.payment_due_date, order.payment_status) ? "bg-red-50/50 hover:bg-red-100/50" : "hover:bg-accent/50"}
                    >
                      <TableCell className="font-medium text-foreground">#{order.order_number}</TableCell>
                      <TableCell className="text-muted-foreground">{order.dealer_name}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(order.order_date)}</TableCell>
                      <TableCell className="text-muted-foreground text-right">₹{order.total_amount.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold w-fit ${getStatusColor(order.payment_status, order.payment_due_date)}`}>
                          {getStatusIcon(order.payment_status, order.payment_due_date)}
                          <span className="capitalize">{order.payment_status.replace('_', ' ')}</span>
                        </div>
                      </TableCell>
                      <TableCell className={isOverdue(order.payment_due_date, order.payment_status) ? "text-destructive font-semibold" : "text-muted-foreground"}>
                        {formatDate(order.payment_due_date)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-2">
                          {order.payment_status === 'pending' && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleAddPaymentDetails(order)} 
                              title="Add Payment Details"
                            >
                              <DollarSign className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                          {(order.payment_status === 'paid' || order.payment_status === 'pending_approval') && order.payment_method && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleViewPaymentDetails(order)} 
                              title="View Payment Details"
                            >
                              <Eye className="h-4 w-4 text-blue-600" />
                            </Button>
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

        {/* Payment Details Section - Always visible below the table */}
        <div className="mt-6 p-4 bg-muted rounded-lg">
          <h3 className="text-lg font-semibold mb-3">Payment Details</h3>
          {orders.filter(order => order.payment_status === 'paid' || order.payment_status === 'pending_approval').length === 0 ? (
            <p className="text-muted-foreground">No paid orders with payment details available.</p>
          ) : (
            <div className="space-y-4 max-h-60 overflow-y-auto">
              {orders
                .filter(order => order.payment_status === 'paid' || order.payment_status === 'pending_approval')
                .map(order => (
                  <div key={`payment-${order.id}`} className="p-3 bg-background rounded-md border">
                    {renderPaymentDetails(order)}
                  </div>
                ))}
            </div>
          )}
        </div>
      </CardContent>
      {selectedOrderForPaymentUpdate && (
        <UpdatePaymentDialog 
          orderToUpdate={selectedOrderForPaymentUpdate} 
          isOpen={isUpdatePaymentDialogOpen} 
          onOpenChange={setIsUpdatePaymentDialogOpen} 
          onPaymentUpdated={handlePaymentUpdated} 
        />
      )}
      {/* Payment Details Dialog */}
      <Dialog open={isPaymentDetailsDialogOpen} onOpenChange={setIsPaymentDetailsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Payment Details</DialogTitle>
            <DialogDescription>
              Detailed information about the payment for this order.
            </DialogDescription>
          </DialogHeader>
          {selectedOrderForPaymentDetails && (
            <div className="py-4">
              {renderPaymentDetails(selectedOrderForPaymentDetails)}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default PaymentStatusCard;