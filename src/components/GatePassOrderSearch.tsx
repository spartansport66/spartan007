"use client";

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Search, Truck, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

interface OrderItemDetail {
  product_name: string;
  quantity: number;
  product_code: string;
}

interface OrderDetail {
  id: string;
  order_number: number;
  order_date: string;
  total_amount: number;
  dealer_name: string;
  dealer_address: string;
  dealer_phone: string;
  sales_person_name: string;
  dispatched: boolean;
  gate_pass_dispatch_time: string | null;
  bill_no: string | null;
  dispatch_date: string | null;
  dispatch_number: number | null;
  items: OrderItemDetail[];
  is_online: boolean;
  online_order_details?: {
    client_name: string;
    address: string | null;
    contact_no: string | null;
  } | null;
}

interface GatePassOrderSearchProps {
  onDispatchSuccess: () => void;
}

const formatDate = (dateString: string | null) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const GatePassOrderSearch: React.FC<GatePassOrderSearchProps> = ({ onDispatchSuccess }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isDispatching, setIsDispatching] = useState(false);

  const fetchOrder = useCallback(async () => {
    if (!searchTerm.trim()) {
      setOrder(null);
      return;
    }
    setLoading(true);
    setOrder(null);

    const search = searchTerm.trim();
    const searchNum = parseInt(search);

    if (isNaN(searchNum) || searchNum <= 0) {
        showError("Please enter a valid Dispatch Number.");
        setLoading(false);
        return;
    }

    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, order_number, order_date, total_amount, dispatched, bill_no, dispatch_date, dispatch_number, gate_pass_dispatch_time,
          dealers (name, address, phone),
          profiles:user_id (first_name, last_name),
          sales (quantity, products (name, code)),
          online_order_details (client_name, address, contact_no)
        `)
        .eq('dispatch_number', searchNum)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (!data) {
        showError(`Dispatch Number "${search}" not found.`);
        setOrder(null);
        return;
      }
      
      if (!data.bill_no) {
        showError(`Order #${data.order_number} found, but Bill Number is missing. It must be processed by the Admin first.`);
        setOrder(null);
        return;
      }

      const isOnline = (data.dealers as any)?.name === 'Online Order';
      const hasSalesItems = data.sales && data.sales.length > 0;

      if (isOnline && !data.gate_pass_dispatch_time && !hasSalesItems) {
        showError(`Order #${data.order_number} is an online order that has not been processed by an admin yet. Stock has not been assigned.`);
        setOrder(null);
        return;
      }

      const salesPersonName = `${(data.profiles as any)?.first_name || ''} ${(data.profiles as any)?.last_name || ''}`.trim() || 'N/A';
      const onlineDetails = data.online_order_details?.[0] || null;

      const formattedOrder: OrderDetail = {
        id: data.id,
        order_number: data.order_number,
        order_date: data.order_date,
        total_amount: data.total_amount,
        dealer_name: isOnline ? onlineDetails?.client_name || 'Online Customer' : (data.dealers as any)?.name || 'N/A',
        dealer_address: isOnline ? onlineDetails?.address || 'N/A' : (data.dealers as any)?.address || 'N/A',
        dealer_phone: isOnline ? onlineDetails?.contact_no || 'N/A' : (data.dealers as any)?.phone || 'N/A',
        sales_person_name: salesPersonName,
        dispatched: data.dispatched,
        gate_pass_dispatch_time: data.gate_pass_dispatch_time,
        bill_no: data.bill_no,
        dispatch_date: data.dispatch_date,
        dispatch_number: data.dispatch_number,
        is_online: isOnline,
        online_order_details: onlineDetails,
        items: (data.sales || []).map((sale: any) => ({
          product_name: sale.products?.name || 'N/A',
          quantity: sale.quantity,
          product_code: sale.products?.code || 'N/A',
        })),
      };

      setOrder(formattedOrder);
      showSuccess(`Order #${formattedOrder.order_number} loaded.`);

    } catch (error: any) {
      console.error('Error fetching order:', error.message);
      showError(`Failed to fetch order: ${error.message}`);
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  const handleDispatchOrder = async () => {
    if (!order || order.gate_pass_dispatch_time) return;

    setIsDispatching(true);
    try {
      const dispatchTime = new Date().toISOString();
      
      // The sales record for online orders is now created during the admin dispatch step.
      // The gate keeper's only responsibility is to set the gate_pass_dispatch_time.

      // Update the gate_pass_dispatch_time field
      const { error } = await supabase
        .from('orders')
        .update({ gate_pass_dispatch_time: dispatchTime })
        .eq('id', order.id);

      if (error) throw error;

      showSuccess(`Order #${order.order_number} successfully authorized for OUT!`);
      setOrder(prev => prev ? { ...prev, gate_pass_dispatch_time: dispatchTime } : null);
      onDispatchSuccess();

    } catch (error: any) {
      console.error('Error dispatching order:', error.message);
      showError(`Failed to authorize dispatch: ${error.message}`);
    } finally {
      setIsDispatching(false);
    }
  };
  
  const isFullyDispatched = order?.gate_pass_dispatch_time !== null;
  const isReadyForGatePass = order?.dispatched === true && order?.bill_no !== null && !isFullyDispatched;

  return (
    <Card className="bg-card text-card-foreground shadow-lg">
      <CardHeader className="bg-green-600 dark:bg-green-800 text-white rounded-t-lg p-4">
        <CardTitle className="text-2xl font-semibold flex items-center gap-2">
          <Truck className="h-6 w-6" /> Gate Pass / Dispatch Manager
        </CardTitle>
        <CardDescription className="text-green-100 dark:text-green-200">
          Search for an order by Dispatch Number to authorize material dispatch.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 space-y-6">
        <div className="flex gap-4 items-end">
          <div className="flex-grow">
            <Label htmlFor="searchTerm">Dispatch Number</Label>
            <Input
              id="searchTerm"
              placeholder="e.g., 1719840000000"
              type="number"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={loading}
            />
          </div>
          <Button onClick={fetchOrder} disabled={loading || !searchTerm.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>

        {order && (
          <div className="space-y-4 p-4 border rounded-md">
            <h3 className="text-xl font-bold flex items-center gap-2">
              Order #{order.order_number}
              <span className={`text-sm font-medium px-3 py-1 rounded-full ${isFullyDispatched ? 'bg-green-100 text-green-700' : order.dispatched ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                {isFullyDispatched ? 'DISPATCHED (GATE PASS)' : order.dispatched ? 'ADMIN DISPATCHED' : 'AWAITING ADMIN DISPATCH'}
              </span>
            </h3>
            
            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p><span className="font-semibold">Dealer/Customer:</span> {order.dealer_name}</p>
                <p><span className="font-semibold">Address:</span> {order.dealer_address}</p>
                <p><span className="font-semibold">Phone:</span> {order.dealer_phone}</p>
                <p><span className="font-semibold">Sales Person:</span> {order.sales_person_name}</p>
              </div>
              <div>
                <p><span className="font-semibold">Order Date:</span> {formatDate(order.order_date)}</p>
                <p><span className="font-semibold">Total Amount:</span> ₹{order.total_amount.toFixed(2)}</p>
                <p><span className="font-semibold">Bill No:</span> {order.bill_no || 'N/A'}</p>
                <p><span className="font-semibold">Admin Dispatch No:</span> {order.dispatch_number || 'N/A'}</p>
                <p><span className="font-semibold">Admin Dispatch Date:</span> {formatDate(order.dispatch_date)}</p>
                {isFullyDispatched && (
                  <p><span className="font-semibold text-green-600">Gate Pass Time:</span> {new Date(order.gate_pass_dispatch_time!).toLocaleString()}</p>
                )}
              </div>
            </div>

            <Separator />

            <h4 className="text-lg font-semibold">Items to Dispatch</h4>
            <div className="max-h-40 overflow-y-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Product Name</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        No items found for this order.
                      </TableCell>
                    </TableRow>
                  ) : (
                    order.items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.product_code}</TableCell>
                        <TableCell>{item.product_name}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {isReadyForGatePass ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="w-full bg-green-600 hover:bg-green-700 mt-4" disabled={isDispatching}>
                    <Truck className="mr-2 h-4 w-4" /> Authorize Final OUT
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Final Material OUT</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to authorize the final physical dispatch of Order #{order.order_number}? This action will record the current time as the Gate Pass Dispatch Time and deduct stock from inventory.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDispatchOrder} disabled={isDispatching}>
                      {isDispatching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Confirm Final OUT'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : isFullyDispatched ? (
              <Button 
                className="w-full bg-blue-600 hover:bg-blue-700 mt-4" 
                onClick={() => showSuccess(`Order #${order.order_number} is already fully dispatched.`)}
                disabled={true}
              >
                <CheckCircle className="mr-2 h-4 w-4" /> Fully Dispatched
              </Button>
            ) : (
              <Alert variant="destructive" className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Not Ready for Gate Pass</AlertTitle>
                <AlertDescription>
                  This order is awaiting initial dispatch/billing from the Admin.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
        
        {!order && !loading && searchTerm.trim() && (
            <Alert variant="default">
                <XCircle className="h-4 w-4" />
                <AlertTitle>No Order Found</AlertTitle>
                <AlertDescription>
                    Could not find an order matching Dispatch Number "{searchTerm}".
                </AlertDescription>
            </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default GatePassOrderSearch;