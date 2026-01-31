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
  bill_no: string | null;
  dispatch_date: string | null;
  dispatch_number: number | null;
  items: OrderItemDetail[];
}

interface GatePassOrderSearchProps {
  onDispatchSuccess: () => void;
}

const formatDate = (dateString: string) => {
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
    const isNumeric = /^\d+$/.test(search);
    const searchNum = isNumeric ? parseInt(search) : null;

    const selectFields = `
      id, order_number, order_date, total_amount, dispatched, bill_no, dispatch_date, dispatch_number,
      dealers (name, address, phone),
      profiles:user_id (first_name, last_name),
      sales (quantity, products (name, code))
    `;

    let query;
    if (isNumeric) {
        // Search ONLY by Dispatch Number if numeric
        query = supabase
            .from('orders')
            .select(selectFields)
            .eq('dispatch_number', searchNum)
            .limit(1)
            .single();
    } else {
        // Search ONLY by Bill Number if non-numeric
        query = supabase
            .from('orders')
            .select(selectFields)
            .eq('bill_no', search)
            .limit(1)
            .single();
    }
    
    const { data, error } = await query;

    try {
      if (error && error.code !== 'PGRST116') { // PGRST116 means "no rows found"
        console.error('Supabase Query Error:', error.message);
        throw error;
      }

      if (!data) {
        showError(`Order, Bill No., or Dispatch No. "${search}" not found.`);
        setOrder(null);
        return;
      }
      
      // Check mandatory condition: Bill Number must be present for dispatch
      if (!data.bill_no) {
        showError(`Order #${data.order_number} found, but Bill Number is missing. It must be processed by the Admin first.`);
        setOrder(null);
        return;
      }

      // Access profiles data using the explicit alias 'profiles'
      const salesPersonName = `${data.profiles?.first_name || ''} ${data.profiles?.last_name || ''}`.trim() || 'N/A';

      const formattedOrder: OrderDetail = {
        id: data.id,
        order_number: data.order_number,
        order_date: data.order_date,
        total_amount: data.total_amount,
        dealer_name: data.dealers?.name || 'N/A',
        dealer_address: data.dealers?.address || 'N/A',
        dealer_phone: data.dealers?.phone || 'N/A',
        sales_person_name: salesPersonName,
        dispatched: data.dispatched,
        bill_no: data.bill_no,
        dispatch_date: data.dispatch_date,
        dispatch_number: data.dispatch_number,
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
    if (!order || order.dispatched) return;

    setIsDispatching(true);
    try {
      // Generate a unique dispatch number (simple timestamp + random suffix)
      const dispatchNumber = Date.now() + Math.floor(Math.random() * 1000);

      const { error } = await supabase
        .from('orders')
        .update({
          dispatched: true,
          dispatch_date: new Date().toISOString(),
          dispatch_number: dispatchNumber,
        })
        .eq('id', order.id);

      if (error) throw error;

      showSuccess(`Order #${order.order_number} successfully dispatched! Dispatch No: ${dispatchNumber}`);
      
      // Update local state and notify parent
      setOrder(prev => prev ? { ...prev, dispatched: true, dispatch_date: new Date().toISOString(), dispatch_number: dispatchNumber } : null);
      onDispatchSuccess();

    } catch (error: any) {
      console.error('Error dispatching order:', error.message);
      showError(`Failed to dispatch order: ${error.message}`);
    } finally {
      setIsDispatching(false);
    }
  };

  return (
    <Card className="bg-card text-card-foreground shadow-lg">
      <CardHeader className="bg-green-600 dark:bg-green-800 text-white rounded-t-lg p-4">
        <CardTitle className="text-2xl font-semibold flex items-center gap-2">
          <Truck className="h-6 w-6" /> Gate Pass / Dispatch Manager
        </CardTitle>
        <CardDescription className="text-green-100 dark:text-green-200">
          Search for an order by Bill Number or Dispatch Number to authorize material dispatch.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 space-y-6">
        <div className="flex gap-4 items-end">
          <div className="flex-grow">
            <Label htmlFor="searchTerm">Bill Number or Dispatch Number</Label>
            <Input
              id="searchTerm"
              placeholder="e.g., INV-2024-001 or 1719840000000"
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
              <span className={`text-sm font-medium px-3 py-1 rounded-full ${order.dispatched ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                {order.dispatched ? 'DISPATCHED' : 'AWAITING DISPATCH'}
              </span>
            </h3>
            
            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p><span className="font-semibold">Dealer:</span> {order.dealer_name}</p>
                <p><span className="font-semibold">Address:</span> {order.dealer_address}</p>
                <p><span className="font-semibold">Phone:</span> {order.dealer_phone}</p>
                <p><span className="font-semibold">Sales Person:</span> {order.sales_person_name}</p>
              </div>
              <div>
                <p><span className="font-semibold">Order Date:</span> {formatDate(order.order_date)}</p>
                <p><span className="font-semibold">Total Amount:</span> ₹{order.total_amount.toFixed(2)}</p>
                <p><span className="font-semibold">Bill No:</span> {order.bill_no || 'N/A'}</p>
                {order.dispatched && (
                  <>
                    <p><span className="font-semibold">Dispatch No:</span> {order.dispatch_number}</p>
                    <p><span className="font-semibold">Dispatch Date:</span> {formatDate(order.dispatch_date!)}</p>
                  </>
                )}
              </div>
            </div>

            <Separator />

            <h4 className="text-lg font-semibold">Items to Dispatch ({order.items.length})</h4>
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
                  {order.items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{item.product_code}</TableCell>
                      <TableCell>{item.product_name}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {!order.dispatched ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="w-full bg-green-600 hover:bg-green-700 mt-4" disabled={isDispatching}>
                    <Truck className="mr-2 h-4 w-4" /> Authorize OUT
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Dispatch Authorization</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to authorize the dispatch of Order #{order.order_number}? This action cannot be undone and will mark the material as OUT.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDispatchOrder} disabled={isDispatching}>
                      {isDispatching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Confirm OUT'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <Button className="w-full bg-gray-500 cursor-not-allowed mt-4" disabled>
                <CheckCircle className="mr-2 h-4 w-4" /> Already Dispatched
              </Button>
            )}
          </div>
        )}
        
        {!order && !loading && searchTerm.trim() && (
            <Alert variant="default">
                <XCircle className="h-4 w-4" />
                <AlertTitle>No Order Found</AlertTitle>
                <AlertDescription>
                    Could not find an order matching "{searchTerm}". Please check the Bill Number or Dispatch Number.
                </AlertDescription>
            </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default GatePassOrderSearch;