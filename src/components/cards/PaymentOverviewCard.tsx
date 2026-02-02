"use client";
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, Hourglass, CheckCircle, Clock } from 'lucide-react';
import { showError } from '@/utils/toast';

interface PaymentOverviewCardProps {
  selectedSalesPersonId?: string | null;
}

const PaymentOverviewCard = ({ selectedSalesPersonId }: PaymentOverviewCardProps) => {
  const [totalPending, setTotalPending] = useState<number>(0);
  const [totalReceived, setTotalReceived] = useState<number>(0);
  const [totalPendingApproval, setTotalPendingApproval] = useState<number>(0);
  const [todayReceived, setTodayReceived] = useState<number>(0);
  const [todayPendingApproval, setTodayPendingApproval] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchPaymentData = async () => {
      setLoading(true);
      try {
        // Correctly get the current date
        const today = new Date();
        
        // Set to the beginning of the day in UTC
        const startOfUTCToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0));
        
        // Set to the end of the day in UTC
        const endOfUTCToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999));

        console.log('DEBUG: PaymentOverviewCard - Start of UTC Today:', startOfUTCToday.toISOString());
        console.log('DEBUG: PaymentOverviewCard - End of UTC Today:', endOfUTCToday.toISOString());

        // 1. Total Pending Amount (from orders)
        console.log('DEBUG: PaymentOverviewCard - Querying for total pending orders...');
        let pendingOrdersQuery = supabase
          .from('orders')
          .select('total_price')
          .eq('payment_status', 'pending');
        if (selectedSalesPersonId) {
          pendingOrdersQuery = pendingOrdersQuery.eq('sales_person_id', selectedSalesPersonId);
        }
        const { data: pendingOrders, error: pendingError } = await pendingOrdersQuery;
        if (pendingError) throw new Error(`Error fetching pending orders: ${pendingError.message}`);
        console.log('DEBUG: PaymentOverviewCard - Raw pendingOrders data:', pendingOrders);
        const totalPendingAmount = pendingOrders?.reduce((sum, order) => sum + (order.total_price || 0), 0) || 0;
        console.log('DEBUG: PaymentOverviewCard - Calculated Total Pending Amount:', totalPendingAmount);
        setTotalPending(totalPendingAmount);

        // 2. Total Received Amount (from payments, status 'approved')
        console.log('DEBUG: PaymentOverviewCard - Querying for total received payments...');
        let receivedPaymentsQuery = supabase
          .from('payments')
          .select('amount')
          .eq('status', 'approved');
        if (selectedSalesPersonId) {
          receivedPaymentsQuery = receivedPaymentsQuery.eq('sales_person_id', selectedSalesPersonId);
        }
        const { data: receivedPayments, error: receivedError } = await receivedPaymentsQuery;
        if (receivedError) throw new Error(`Error fetching received payments: ${receivedError.message}`);
        console.log('DEBUG: PaymentOverviewCard - Raw receivedPayments data:', receivedPayments);
        const totalReceivedAmount = receivedPayments?.reduce((sum, payment) => sum + (payment.amount || 0), 0) || 0;
        console.log('DEBUG: PaymentOverviewCard - Calculated Total Received Amount:', totalReceivedAmount);
        setTotalReceived(totalReceivedAmount);

        // 3. Total Pending for Approval Amount (from payments, status 'pending_approval')
        console.log('DEBUG: PaymentOverviewCard - Querying for total pending_approval payments...');
        let pendingApprovalPaymentsQuery = supabase
          .from('payments')
          .select('amount')
          .eq('status', 'pending_approval');
        if (selectedSalesPersonId) {
          pendingApprovalPaymentsQuery = pendingApprovalPaymentsQuery.eq('sales_person_id', selectedSalesPersonId);
        }
        const { data: pendingApprovalPayments, error: pendingApprovalError } = await pendingApprovalPaymentsQuery;
        if (pendingApprovalError) throw new Error(`Error fetching pending approval payments: ${pendingApprovalError.message}`);
        console.log('DEBUG: PaymentOverviewCard - Raw pendingApprovalPayments data:', pendingApprovalPayments);
        const totalPendingApprovalAmount = pendingApprovalPayments?.reduce((sum, payment) => sum + (payment.amount || 0), 0) || 0;
        console.log('DEBUG: PaymentOverviewCard - Calculated Total Pending for Approval Amount:', totalPendingApprovalAmount);
        setTotalPendingApproval(totalPendingApprovalAmount);

        // 4. Today's Received Amount (approved_at is today)
        console.log('DEBUG: PaymentOverviewCard - Querying for today received payments (approved_at)...');
        let todayReceivedQuery = supabase
          .from('payments')
          .select('amount')
          .eq('status', 'approved')
          .gte('approved_at', startOfUTCToday.toISOString())
          .lte('approved_at', endOfUTCToday.toISOString());
        if (selectedSalesPersonId) {
          todayReceivedQuery = todayReceivedQuery.eq('sales_person_id', selectedSalesPersonId);
        }
        const { data: todayReceivedData, error: todayReceivedError } = await todayReceivedQuery;
        if (todayReceivedError) throw new Error(`Error fetching today's received payments: ${todayReceivedError.message}`);
        console.log('DEBUG: PaymentOverviewCard - Raw todayReceived data (approved_at):', todayReceivedData);
        const todayReceivedAmount = todayReceivedData?.reduce((sum, payment) => sum + (payment.amount || 0), 0) || 0;
        console.log('DEBUG: PaymentOverviewCard - Calculated Today Received Amount:', todayReceivedAmount);
        setTodayReceived(todayReceivedAmount);

        // 5. Today's Pending for Approval Amount (payment_date is today)
        console.log('DEBUG: PaymentOverviewCard - Querying for today pending approval payments (payment_date)...');
        let todayPendingApprovalQuery = supabase
          .from('payments')
          .select('amount')
          .eq('status', 'pending_approval')
          .gte('payment_date', startOfUTCToday.toISOString())
          .lte('payment_date', endOfUTCToday.toISOString());
        if (selectedSalesPersonId) {
          todayPendingApprovalQuery = todayPendingApprovalQuery.eq('sales_person_id', selectedSalesPersonId);
        }
        const { data: todayPendingApprovalData, error: todayPendingApprovalError } = await todayPendingApprovalQuery;
        if (todayPendingApprovalError) throw new Error(`Error fetching today's pending approval payments: ${todayPendingApprovalError.message}`);
        console.log('DEBUG: PaymentOverviewCard - Raw todayPendingApproval data (payment_date):', todayPendingApprovalData);
        const todayPendingApprovalAmount = todayPendingApprovalData?.reduce((sum, payment) => sum + (payment.amount || 0), 0) || 0;
        console.log('DEBUG: PaymentOverviewCard - Calculated Today Pending for Approval Amount (payment_date):', todayPendingApprovalAmount);
        setTodayPendingApproval(todayPendingApprovalAmount);

      } catch (error: any) {
        console.error('DEBUG: PaymentOverviewCard - Error fetching payment data:', error);
        showError(error.message);
      } finally {
        setLoading(false);
      }
    };

    console.log('DEBUG: PaymentOverviewCard - useEffect triggered');
    fetchPaymentData();
  }, [selectedSalesPersonId]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const renderStat = (title: string, value: number, icon: React.ReactNode, isLoading: boolean) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-3/4" />
        ) : (
          <div className="text-2xl font-bold">{formatCurrency(value)}</div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {renderStat("Total Pending", totalPending, <Hourglass className="h-4 w-4 text-muted-foreground" />, loading)}
      {renderStat("Total Received", totalReceived, <CheckCircle className="h-4 w-4 text-muted-foreground" />, loading)}
      {renderStat("Pending for Approval", totalPendingApproval, <Clock className="h-4 w-4 text-muted-foreground" />, loading)}
      {renderStat("Today's Received", todayReceived, <DollarSign className="h-4 w-4 text-muted-foreground" />, loading)}
      {renderStat("Today's Pending Approval", todayPendingApproval, <Hourglass className="h-4 w-4 text-muted-foreground" />, loading)}
    </div>
  );
};

export default PaymentOverviewCard;