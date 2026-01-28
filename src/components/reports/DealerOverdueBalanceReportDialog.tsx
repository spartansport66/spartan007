"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Printer, MessageCircle, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import { useSession } from '@/contexts/SessionContext';
import { formatDate } from '@/utils/date'; // Import formatDate

// IMPORTANT: Replace with the actual URL of your deployed Edge Function
const SEND_WHATSAPP_MESSAGE_EDGE_FUNCTION_URL = "https://hxftiocfihhdutciaisl.supabase.co/functions/v1/send-whatsapp-message";

interface DealerOverdueData {
  id: string;
  name: string;
  phone: string;
  city: string;
  state: string;
  currentBalance: number;
  oldestDueDate: string | null; // ISO string
  lastBillingDate: string | null; // ISO string
  overdueMonths: number; // Calculated
}

interface FilterOption {
  value: string;
  label: string;
}

interface DealerOverdueBalanceReportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const indianStates = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Lakshadweep", "Puducherry"
];

const DealerOverdueBalanceReportDialog: React.FC<DealerOverdueBalanceReportDialogProps> = ({ isOpen, onOpenChange }) => {
  const { user } = useSession();
  const [dealers, setDealers] = useState<DealerOverdueData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDealerName, setFilterDealerName] = useState<string>('');
  const [filterCity, setFilterCity] = useState<string>('');
  const [filterState, setFilterState] = useState<string>('');
  const [filterOverduePeriod, setFilterOverduePeriod] = useState<'all' | '1_month' | '3_months' | '6_months'>('all');
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [sentDealerIds, setSentDealerIds] = useState<Set<string>>(new Set());

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
      console.error('[DealerOverdueBalanceReportDialog] Error fetching company name for PDF:', error.message);
      setCompanyName(null);
    }
  }, []);

  const calculateOverdueMonths = (oldestDueDate: string | null, lastBillingDate: string | null, currentBalance: number): number => {
    if (currentBalance <= 0) return 0; // Not overdue if balance is zero or negative

    let effectiveDate: Date | null = null;

    if (oldestDueDate) {
      effectiveDate = new Date(oldestDueDate);
    } else if (lastBillingDate) {
      // If no specific order due date, but there's an opening balance, use last billing date as a proxy
      effectiveDate = new Date(lastBillingDate);
    }

    if (!effectiveDate) return 0; // Cannot determine overdue period without a date

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day UTC
    effectiveDate.setHours(0, 0, 0, 0); // Normalize to start of day UTC

    if (effectiveDate >= today) return 0; // Not overdue if due date is today or in the future

    const diffTime = Math.abs(today.getTime() - effectiveDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return Math.floor(diffDays / 30); // Approximate months
  };

  const fetchDealersWithOverdueBalances = useCallback(async () => {
    setLoading(true);
    try {
      const { data: dealersRawData, error: dealersError } = await supabase
        .from('dealers')
        .select(`
          id, name, phone, city, state, last_billing_date,
          dealer_balances(opening_balance),
          orders(id, total_amount, payment_status, payment_due_date, payments(amount, status))
        `);

      if (dealersError) {
        console.error('[DealerOverdueBalanceReportDialog] Error fetching dealers with overdue balances:', dealersError.message);
        throw dealersError;
      }
      
      console.log('[DealerOverdueBalanceReportDialog] Raw data fetched:', dealersRawData);

      const formattedDealers: DealerOverdueData[] = (dealersRawData || []).map(d => {
        // Safely access opening_balance, assuming d.dealer_balances is an array of one element or null
        const openingBalance = d.dealer_balances?.[0]?.opening_balance || 0;

        let currentBalance = openingBalance;
        let oldestDueDate: string | null = null;

        (d.orders || []).forEach((order: any) => {
          currentBalance += order.total_amount;

          if (order.payment_status === 'pending' && order.payment_due_date) {
            if (!oldestDueDate || new Date(order.payment_due_date) < new Date(oldestDueDate)) {
              oldestDueDate = order.payment_due_date;
            }
          }

          (order.payments || []).forEach((payment: any) => {
            if (payment.status === 'completed') {
              currentBalance -= payment.amount;
            }
          });
        });

        // If there's an opening balance and no other specific due dates, consider last_billing_date
        if (openingBalance > 0 && !oldestDueDate && d.last_billing_date) {
          oldestDueDate = d.last_billing_date;
        }

        const overdueMonths = calculateOverdueMonths(oldestDueDate, d.last_billing_date, currentBalance);

        return {
          id: d.id,
          name: d.name,
          phone: d.phone || '',
          city: d.city || 'N/A',
          state: d.state || 'N/A',
          currentBalance: currentBalance,
          oldestDueDate: oldestDueDate,
          lastBillingDate: d.last_billing_date,
          overdueMonths: overdueMonths,
        };
      });

      // Apply filters
      const filtered = formattedDealers.filter(dealer => {
        const matchesName = filterDealerName ? dealer.name.toLowerCase().includes(filterDealerName.toLowerCase()) : true;
        const matchesCity = filterCity ? dealer.city.toLowerCase().includes(filterCity.toLowerCase()) : true;
        const matchesState = filterState ? dealer.state.toLowerCase().includes(filterState.toLowerCase()) : true;

        let matchesOverduePeriod = true;
        if (filterOverduePeriod === '1_month') {
          matchesOverduePeriod = dealer.overdueMonths >= 1;
        } else if (filterOverduePeriod === '3_months') {
          matchesOverduePeriod = dealer.overdueMonths >= 3;
        } else if (filterOverduePeriod === '6_months') {
          matchesOverduePeriod = dealer.overdueMonths >= 6;
        } else if (filterOverduePeriod === 'all') {
          matchesOverduePeriod = dealer.currentBalance > 0; // Only show dealers with positive balance
        }

        return matchesName && matchesCity && matchesState && matchesOverduePeriod;
      });

      // Sort by overdue months (descending) then by name
      filtered.sort((a, b) => {
        if (b.overdueMonths !== a.overdueMonths) {
          return b.overdueMonths - a.overdueMonths;
        }
        return a.name.localeCompare(b.name);
      });

      console.log('[DealerOverdueBalanceReportDialog] Filtered data count:', filtered.length); // ADDED LOG
      setDealers(filtered);
    } catch (error: any) {
      console.error('[DealerOverdueBalanceReportDialog] Error fetching dealers with overdue balances:', error.message);
      showError(`Failed to load overdue dealer data: ${error.message}`);
      setDealers([]);
    } finally {
      setLoading(false);
    }
  }, [filterDealerName, filterCity, filterState, filterOverduePeriod]);

  useEffect(() => {
    if (isOpen) {
      fetchCompanyInfo();
      fetchDealersWithOverdueBalances();
    } else {
      // Reset state when dialog closes
      setFilterDealerName('');
      setFilterCity('');
      setFilterState('');
      setFilterOverduePeriod('all');
      setSentDealerIds(new Set());
    }
  }, [isOpen, fetchCompanyInfo, fetchDealersWithOverdueBalances]);

  const handleClearFilters = () => {
    setFilterDealerName('');
    setFilterCity('');
    setFilterState('');
    setFilterOverduePeriod('all');
  };

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
      showError('Company name is required to send WhatsApp messages. Please set it in Admin Dashboard -> Company Information.');
      return;
    }

    setIsSendingWhatsApp(true);
    try {
      const formattedBalance = dealer.currentBalance.toFixed(2);
      const formattedDueDate = dealer.oldestDueDate ? formatDate(dealer.oldestDueDate) : 'N/A';
      const message = `Dear ${dealer.name},\n\nThis is a reminder from *${companyName}* that your current outstanding balance is *₹${formattedBalance}*, due from *${formattedDueDate}*. Please clear your balance as soon as possible.\n\nThank you!`;

      const response = await fetch(SEND_WHATSAPP_MESSAGE_EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dealerIds: [dealer.id],
          message: message,
          comboOfferId: null, // No combo offer for balance due message
          sentByUserId: user.id,
          messageType: 'balance_due',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send WhatsApp message');
      }

      showSuccess('WhatsApp message prepared. A new tab may open, please ensure pop-ups are allowed.');

      const encodedMessage = encodeURIComponent(message);
      const whatsappUrl = `https://web.whatsapp.com/send?phone=${dealer.phone}&text=${encodedMessage}`;
      window.open(whatsappUrl, '_blank');
      setSentDealerIds(prev => new Set([...prev, dealer.id]));
    } catch (error: any) {
      console.error('[DealerOverdueBalanceReportDialog] Error sending WhatsApp message:', error);
      showError(`Failed to send WhatsApp message: ${error.message}`);
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  const handleResetSentStatus = () => {
    setSentDealerIds(new Set());
    showSuccess('Sent status reset for all dealers.');
  };

  const handlePrint = () => {
    try {
      const doc = new jsPDF({
        orientation: 'landscape'
      });

      const companyNameText = companyName ? companyName.toUpperCase() : "COMPANY NAME";
      doc.setFontSize(22);
      doc.text(companyNameText, doc.internal.pageSize.width / 2, 15, { align: 'center' });
      doc.setFontSize(18);
      doc.text("Dealer Overdue Balance Report", doc.internal.pageSize.width / 2, 25, { align: 'center' });
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, doc.internal.pageSize.width / 2, 32, { align: 'center' });

      let filterDetails = [];
      if (filterDealerName) filterDetails.push(`Dealer Name: ${filterDealerName}`);
      if (filterCity) filterDetails.push(`City: ${filterCity}`);
      if (filterState) filterDetails.push(`State: ${filterState}`);
      if (filterOverduePeriod !== 'all') filterDetails.push(`Overdue Period: ${filterOverduePeriod.replace('_', ' ')}`);

      if (filterDetails.length > 0) {
        doc.setFontSize(9);
        doc.text(`Filters: ${filterDetails.join(' | ')}`, doc.internal.pageSize.width / 2, 38, { align: 'center' });
      }

      const tableColumn = ["Dealer Name", "Phone", "City", "State", "Current Balance (₹)", "Oldest Due Date", "Overdue (Months)"];
      const tableRows = dealers.map(dealer => [
        dealer.name,
        dealer.phone || 'N/A',
        dealer.city || 'N/A',
        dealer.state || 'N/A',
        dealer.currentBalance.toFixed(2),
        formatDate(dealer.oldestDueDate),
        dealer.overdueMonths.toString(),
      ]);

      const totalOverdueBalance = dealers.reduce((sum, dealer) => sum + dealer.currentBalance, 0);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        foot: [[{ content: 'Total Overdue Balance', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } }, `₹${totalOverdueBalance.toFixed(2)}`, '', '']],
        startY: 45,
        styles: {
          fontSize: 7,
          cellPadding: 2,
          valign: 'middle',
        },
        headStyles: {
          fillColor: [30, 58, 138],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
        },
        bodyStyles: {
          textColor: [0, 0, 0],
        },
        footStyles: {
          fillColor: [220, 220, 220],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          fontSize: 8,
        },
        margin: { top: 10, left: 10, right: 10 },
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: 25 },
          2: { cellWidth: 25 },
          3: { cellWidth: 25 },
          4: { cellWidth: 30, halign: 'right' },
          5: { cellWidth: 25, halign: 'center' },
          6: { cellWidth: 25, halign: 'center' },
        }
      });

      doc.save('dealer_overdue_balance_report.pdf');
      showSuccess('Dealer overdue balance report generated successfully!');
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      showError(`Failed to generate report: ${error.message || 'An unknown error occurred.'}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1000px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary">Dealer Overdue Balance Report</DialogTitle>
          <DialogDescription>
            View and manage dealers with outstanding balances overdue by specific periods.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-card rounded-lg">
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterDealerName">Dealer Name</Label>
            <Input
              id="filterDealerName"
              placeholder="Filter by name"
              value={filterDealerName}
              onChange={(e) => setFilterDealerName(e.target.value)}
              className="w-full"
              disabled={loading}
            />
          </div>
          <div className="flex-1 min-w-[100px]">
            <Label htmlFor="filterCity">City</Label>
            <Input
              id="filterCity"
              placeholder="Filter by city"
              value={filterCity}
              onChange={(e) => setFilterCity(e.target.value)}
              className="w-full"
              disabled={loading}
            />
          </div>
          <div className="flex-1 min-w-[100px]">
            <Label htmlFor="filterState">State</Label>
            <Select
              value={filterState || "all"}
              onValueChange={(value) => setFilterState(value === "all" ? "" : value)}
              disabled={loading}
            >
              <SelectTrigger id="filterState" className="w-full">
                <SelectValue placeholder="Select a state" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {indianStates.map((state) => (
                  <SelectItem key={state} value={state}>
                    {state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterOverduePeriod">Overdue Period</Label>
            <Select 
              value={filterOverduePeriod} 
              onValueChange={(value: string) => setFilterOverduePeriod(value as 'all' | '1_month' | '3_months' | '6_months')} 
              disabled={loading}
            >
              <SelectTrigger id="filterOverduePeriod" className="w-full">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Overdue Balances</SelectItem>
                <SelectItem value="1_month">More than 1 Month Due</SelectItem>
                <SelectItem value="3_months">More than 3 Months Due</SelectItem>
                <SelectItem value="6_months">More than 6 Months Due</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={fetchDealersWithOverdueBalances} disabled={loading} className="flex items-center gap-2 bg-primary hover:bg-primary/90">
            <Search className="h-4 w-4" /> Apply Filters
          </Button>
          <Button variant="outline" onClick={handleClearFilters} disabled={loading} className="flex items-center gap-2">
            Clear Filters
          </Button>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-lg text-foreground">Loading dealer data...</p>
            </div>
          ) : dealers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No overdue dealer balances found matching your criteria.</p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-muted">
                  <TableRow className="bg-muted hover:bg-muted/90">
                    <TableHead className="text-muted-foreground font-bold">Dealer Name</TableHead>
                    <TableHead className="text-muted-foreground font-bold">Phone</TableHead>
                    <TableHead className="text-muted-foreground font-bold">City</TableHead>
                    <TableHead className="text-muted-foreground font-bold">State</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-right">Current Balance (₹)</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-center">Oldest Due Date</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-center">Overdue (Months)</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dealers.map((dealer) => (
                    <TableRow key={dealer.id} className="hover:bg-accent/50">
                      <TableCell className="font-medium text-foreground">{dealer.name}</TableCell>
                      <TableCell className="text-foreground">{dealer.phone || 'N/A'}</TableCell>
                      <TableCell className="text-foreground">{dealer.city || 'N/A'}</TableCell>
                      <TableCell className="text-foreground">{dealer.state || 'N/A'}</TableCell>
                      <TableCell className="text-foreground text-right font-medium">₹{dealer.currentBalance.toFixed(2)}</TableCell>
                      <TableCell className="text-foreground text-center">
                        {formatDate(dealer.oldestDueDate)}
                      </TableCell>
                      <TableCell className="text-foreground text-center">{dealer.overdueMonths}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSendWhatsApp(dealer)}
                          title={sentDealerIds.has(dealer.id) ? "Message Sent" : "Send WhatsApp Reminder"}
                          disabled={isSendingWhatsApp || !dealer.phone || sentDealerIds.has(dealer.id)}
                        >
                          {isSendingWhatsApp && sentDealerIds.has(dealer.id) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <MessageCircle className="h-4 w-4 text-blue-500" />
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

        {sentDealerIds.size > 0 && (
          <div className="flex justify-end mt-4">
            <Button 
              variant="outline" 
              onClick={handleResetSentStatus} 
              disabled={isSendingWhatsApp}
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" /> Reset Sent Status
            </Button>
          </div>
        )}

        <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handlePrint} disabled={dealers.length === 0} className="border border-input hover:bg-accent hover:text-accent-foreground">
            <Printer className="mr-2 h-4 w-4" /> Print Report
          </Button>
          <Button onClick={() => onOpenChange(false)} className="bg-primary hover:bg-primary/90">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DealerOverdueBalanceReportDialog;