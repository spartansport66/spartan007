"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, MessageCircle, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { useSession } from '@/contexts/SessionContext';
import { cn } from '@/lib/utils';

// IMPORTANT: Replace with the actual URL of your deployed Edge Function
const SEND_WHATSAPP_MESSAGE_EDGE_FUNCTION_URL = "https://hxftiocfihhdutciaisl.supabase.co/functions/v1/send-whatsapp-message";

interface DealerOverdueData {
  id: string;
  name: string;
  phone: string;
  closing_balance: number;
  last_billing_date: string | null;
  daysSinceLastBill: number | null;
}

const OVERDUE_THRESHOLD_DAYS = 60;

const calculateDaysSinceLastBill = (lastBillingDate: string | null): number | null => {
  if (!lastBillingDate) return null;
  const lastBill = new Date(lastBillingDate);
  const today = new Date();
  
  // Normalize dates to midnight UTC for accurate day difference calculation
  lastBill.setUTCHours(0, 0, 0, 0);
  today.setUTCHours(0, 0, 0, 0);

  // If the last bill date is today or in the future, the overdue period is 0 days.
  if (lastBill.getTime() >= today.getTime()) {
    return 0;
  }

  const diffTime = today.getTime() - lastBill.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
};

const SalesPersonOverdueBalanceCard: React.FC = () => {
  const { user, loading: sessionLoading } = useSession();
  const [overdueDealers, setOverdueDealers] = useState<DealerOverdueData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [companyName, setCompanyName] = useState<string | null>(null);

  const fetchCompanyInfo = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('company_info')
        .select('company_name')
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      setCompanyName(data?.company_name || null);
    } catch (error: any) {
      console.error('Error fetching company name:', error.message);
      setCompanyName(null);
    }
  }, []);

  const fetchOverdueDealers = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Fetch all dealer data needed for calculation, filtered by sales person assignment
      const { data: dealersRawData, error: dealersError } = await supabase
        .from('dealer_sales_persons')
        .select(`
          dealers (
            id,
            name,
            phone,
            last_billing_date,
            dealer_balances(opening_balance),
            orders(total_amount, payment_status, payments(amount, status))
          )
        `)
        .eq('sales_person_id', user.id);

      if (dealersError) throw dealersError;

      const formattedDealers: DealerOverdueData[] = (dealersRawData || []).map((item: any) => {
        const d = item.dealers;
        const openingBalance = d.dealer_balances?.[0]?.opening_balance || 0;
        
        let totalSales = 0;
        let totalPayments = 0;

        (d.orders || []).forEach((order: any) => {
          totalSales += order.total_amount;
          (order.payments || []).forEach((payment: any) => {
            if (payment.status === 'completed') {
              totalPayments += payment.amount;
            }
          });
        });

        const closingBalance = openingBalance + totalSales - totalPayments;
        const daysSinceLastBill = calculateDaysSinceLastBill(d.last_billing_date);
        
        return {
          id: d.id,
          name: d.name,
          phone: d.phone || '',
          closing_balance: closingBalance,
          last_billing_date: d.last_billing_date,
          daysSinceLastBill: daysSinceLastBill,
        };
      });

      // Filter: closing_balance > 0 AND daysSinceLastBill > 60
      const filteredOverdue = formattedDealers.filter(dealer => 
        dealer.closing_balance > 0 && 
        dealer.daysSinceLastBill !== null && 
        dealer.daysSinceLastBill > OVERDUE_THRESHOLD_DAYS
      );
      
      setOverdueDealers(filteredOverdue);
    } catch (error: any) {
      console.error('Error fetching overdue dealers:', error.message);
      showError(`Failed to load overdue accounts: ${error.message}`);
      setOverdueDealers([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchCompanyInfo();
      fetchOverdueDealers();
    }
  }, [user, fetchOverdueDealers, fetchCompanyInfo]);

  const handleSendWhatsApp = async (dealer: DealerOverdueData) => {
    if (!user) {
      showError('You must be logged in to send WhatsApp messages.');
      return;
    }
    if (!dealer.phone) {
      showError(`Phone number not available for ${dealer.name}.`);
      return;
    }
    if (!companyName) {
      showError('Company name is required to send WhatsApp messages. Please contact an administrator.');
      return;
    }

    setIsSendingWhatsApp(true);
    try {
      const formattedBalance = dealer.closing_balance.toFixed(2);
      const formattedDays = dealer.daysSinceLastBill;
      
      // Draft a professional message
      const message = `Hello ${dealer.name},\n\nThis is an urgent reminder from *${companyName}* regarding your account. Your current outstanding balance is *₹${formattedBalance}*.\n\nOur records show this balance is overdue by approximately ${formattedDays} days since your last bill date. Please clear this outstanding balance immediately to avoid account suspension.\n\nThank you for your prompt attention.\n\nBest regards,\n${companyName} Team`;

      // 1. Log the message send attempt via Edge Function
      const response = await fetch(SEND_WHATSAPP_MESSAGE_EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dealerIds: [dealer.id],
          message: message,
          comboOfferId: null,
          sentByUserId: user.id,
          messageType: 'closing_balance_overdue_reminder',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to log WhatsApp message send attempt');
      }

      // 2. Open WhatsApp Web/Desktop
      showSuccess(`WhatsApp message drafted for ${dealer.name}. Please check the new tab.`);
      
      const encodedMessage = encodeURIComponent(message);
      const whatsappUrl = `https://web.whatsapp.com/send?phone=${dealer.phone}&text=${encodedMessage}`;
      window.open(whatsappUrl, '_blank');
      
    } catch (error: any) {
      console.error('Error sending WhatsApp message:', error);
      showError(`Failed to send WhatsApp message: ${error.message}`);
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  if (sessionLoading || loading) {
    return (
      <Card className="bg-card text-card-foreground shadow-lg h-full lg:col-span-2">
        <CardHeader className="bg-red-600 dark:bg-red-800 text-white rounded-t-lg p-4">
          <CardTitle className="text-xl font-semibold">Overdue Accounts ({OVERDUE_THRESHOLD_DAYS}+ Days)</CardTitle>
          <CardDescription className="text-red-100 dark:text-red-200">Accounts with positive balance overdue by more than {OVERDUE_THRESHOLD_DAYS} days.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading overdue accounts...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card text-card-foreground shadow-lg h-full lg:col-span-2">
      <CardHeader className="bg-red-600 dark:bg-red-800 text-white rounded-t-lg p-4">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" /> Overdue Accounts ({OVERDUE_THRESHOLD_DAYS}+ Days)
        </CardTitle>
        <CardDescription className="text-red-100 dark:text-red-200">
          {overdueDealers.length} accounts with positive balance overdue by more than {OVERDUE_THRESHOLD_DAYS} days.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        <div className="overflow-x-auto">
          {overdueDealers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No accounts currently overdue by more than {OVERDUE_THRESHOLD_DAYS} days. Good job!</p>
          ) : (
            <div className="max-h-[300px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow className="bg-muted hover:bg-muted/90">
                    <TableHead className="text-muted-foreground">Dealer Name</TableHead>
                    <TableHead className="text-muted-foreground text-right">Closing Balance</TableHead>
                    <TableHead className="text-muted-foreground text-center">Last Bill Date</TableHead>
                    <TableHead className="text-muted-foreground text-center">Days Overdue</TableHead>
                    <TableHead className="text-muted-foreground text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overdueDealers.map((dealer) => (
                    <TableRow key={dealer.id} className="bg-red-50/50 hover:bg-red-100/50">
                      <TableCell className="font-medium text-red-800 dark:text-red-200">{dealer.name}</TableCell>
                      <TableCell className="text-red-800 dark:text-red-200 text-right font-semibold">₹{dealer.closing_balance.toFixed(2)}</TableCell>
                      <TableCell className="text-red-800 dark:text-red-200 text-center">
                        {dealer.last_billing_date ? new Date(dealer.last_billing_date).toLocaleDateString() : 'N/A'}
                      </TableCell>
                      <TableCell className="text-red-800 dark:text-red-200 text-center font-semibold">
                        {dealer.daysSinceLastBill !== null ? dealer.daysSinceLastBill : 'N/A'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSendWhatsApp(dealer)}
                          title="Send Urgent WhatsApp Reminder"
                          disabled={isSendingWhatsApp || !dealer.phone}
                        >
                          {isSendingWhatsApp ? (
                            <Loader2 className="h-4 w-4 animate-spin text-red-600" />
                          ) : (
                            <MessageCircle className="h-4 w-4 text-red-600" />
                          )}
                        </Button>
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
  );
};

export default SalesPersonOverdueBalanceCard;