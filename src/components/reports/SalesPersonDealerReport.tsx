"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Printer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import { useSession } from '@/contexts/SessionContext';

interface DealerReportData {
  id: string;
  name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  credit_limit: number;
  opening_balance: number; // Added opening balance
  current_balance: number; // Added current balance
}

interface SalesPersonDealerReportProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const SalesPersonDealerReport: React.FC<SalesPersonDealerReportProps> = ({ isOpen, onOpenChange }) => {
  const { user } = useSession();
  const [dealers, setDealers] = useState<DealerReportData[]>([]);
  const [loading, setLoading] = useState(true);
  // Filter states
  const [filterDealerName, setFilterDealerName] = useState<string>('');
  const [filterCity, setFilterCity] = useState<string>('');
  const [filterState, setFilterState] = useState<string>('');
  const [filterCountry, setFilterCountry] = useState<string>('');
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
      console.error('[SalesPersonDealerReport] Error fetching company name for PDF:', error.message);
      setCompanyName(null);
    }
  }, []);

  const fetchDealers = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let query = supabase
        .from('dealer_sales_persons')
        .select(`
          dealers (
            id, name, contact_person, email, phone, address, city, state, country, credit_limit,
            dealer_balances(opening_balance),
            orders(total_amount, payment_status, payments(amount, status))
          )
        `)
        .eq('sales_person_id', user.id) // Filter by current user's assigned dealers
        .order('dealers.name', { ascending: true });

      // Apply filters
      if (filterDealerName) {
        query = query.ilike('dealers.name', `%${filterDealerName}%`);
      }
      if (filterCity) {
        query = query.ilike('dealers.city', `%${filterCity}%`);
      }
      if (filterState) {
        query = query.ilike('dealers.state', `%${filterState}%`);
      }
      if (filterCountry) {
        query = query.ilike('dealers.country', `%${filterCountry}%`);
      }

      const { data, error } = await query;
      if (error) {
        console.error('[SalesPersonDealerReport] Error fetching dealers for report:', error.message);
        showError('Failed to load dealer data.');
        setDealers([]);
      } else {
        const formattedDealers: DealerReportData[] = (data || []).map((item: any) => {
          const dealer = item.dealers;
          const openingBalance = dealer.dealer_balances?.opening_balance || 0;

          let currentBalance = openingBalance;
          (dealer.orders || []).forEach((order: any) => {
            currentBalance += order.total_amount;
            (order.payments || []).forEach((payment: any) => {
              if (payment.status === 'completed') {
                currentBalance -= payment.amount;
              }
            });
          });

          return {
            id: dealer.id,
            name: dealer.name,
            contact_person: dealer.contact_person,
            email: dealer.email,
            phone: dealer.phone,
            address: dealer.address,
            city: dealer.city,
            state: dealer.state,
            country: dealer.country,
            credit_limit: dealer.credit_limit,
            opening_balance: openingBalance,
            current_balance: currentBalance,
          };
        });
        setDealers(formattedDealers);
      }
    } catch (error: any) {
      console.error('[SalesPersonDealerReport] Error in fetchDealers:', error.message);
      showError('An unexpected error occurred while fetching dealer data.');
    } finally {
      setLoading(false);
    }
  }, [user?.id, filterDealerName, filterCity, filterState, filterCountry]);

  useEffect(() => {
    if (isOpen) {
      fetchDealers();
      fetchCompanyInfo();
    }
  }, [isOpen, fetchDealers, fetchCompanyInfo]);

  const handleClearFilters = () => {
    setFilterDealerName('');
    setFilterCity('');
    setFilterState('');
    setFilterCountry('');
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
      doc.text("My Dealer Report", doc.internal.pageSize.width / 2, 25, { align: 'center' });
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, doc.internal.pageSize.width / 2, 32, { align: 'center' });

      let filterDetails = [];
      if (filterDealerName) filterDetails.push(`Dealer Name: ${filterDealerName}`);
      if (filterCity) filterDetails.push(`City: ${filterCity}`);
      if (filterState) filterDetails.push(`State: ${filterState}`);
      if (filterCountry) filterDetails.push(`Country: ${filterCountry}`);

      if (filterDetails.length > 0) {
        doc.setFontSize(9);
        doc.text(`Filters: ${filterDetails.join(' | ')}`, doc.internal.pageSize.width / 2, 38, { align: 'center' });
      }

      const tableColumn = [
        "Name", "Contact Person", "Email", "Phone", "Address", "City", "State", "Country", "Credit Limit", "Opening Balance", "Current Balance"
      ];
      const tableRows = dealers.map(dealer => [
        dealer.name,
        dealer.contact_person || 'N/A',
        dealer.email || 'N/A',
        dealer.phone || 'N/A',
        dealer.address,
        dealer.city || 'N/A',
        dealer.state || 'N/A',
        dealer.country || 'N/A',
        `₹${dealer.credit_limit.toFixed(2)}`,
        `₹${dealer.opening_balance.toFixed(2)}`,
        `₹${dealer.current_balance.toFixed(2)}`,
      ]);

      const totalOpeningBalance = dealers.reduce((sum, dealer) => sum + dealer.opening_balance, 0);
      const totalCurrentBalance = dealers.reduce((sum, dealer) => sum + dealer.current_balance, 0);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        foot: [
          [
            { content: 'Totals', colSpan: 9, styles: { halign: 'right', fontStyle: 'bold' } },
            `₹${totalOpeningBalance.toFixed(2)}`,
            `₹${totalCurrentBalance.toFixed(2)}`,
          ]
        ],
        startY: 45,
        styles: {
          fontSize: 7
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
          0: { cellWidth: 20 },
          1: { cellWidth: 20 },
          2: { cellWidth: 30 },
          3: { cellWidth: 20 },
          4: { cellWidth: 30 },
          5: { cellWidth: 15 },
          6: { cellWidth: 15 },
          7: { cellWidth: 15 },
          8: { cellWidth: 20, halign: 'right' },
          9: { cellWidth: 20, halign: 'right' },
          10: { cellWidth: 20, halign: 'right' },
        }
      });

      doc.save('my_dealer_report.pdf');
      showSuccess('My Dealer report generated successfully!');
    } catch (error: any) {
      console.error('[SalesPersonDealerReport] Error generating PDF:', error);
      showError(`Failed to generate dealer report: ${error.message || 'An unknown error occurred.'}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1200px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary">My Dealer Report</DialogTitle>
          <DialogDescription>
            Generate a comprehensive report of all dealers assigned to you.
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
            />
          </div>
          <div className="flex-1 min-w-[100px]">
            <Label htmlFor="filterState">State</Label>
            <Input
              id="filterState"
              placeholder="Filter by state"
              value={filterState}
              onChange={(e) => setFilterState(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex-1 min-w-[100px]">
            <Label htmlFor="filterCountry">Country</Label>
            <Input
              id="filterCountry"
              placeholder="Filter by country"
              value={filterCountry}
              onChange={(e) => setFilterCountry(e.target.value)}
              className="w-full"
            />
          </div>
          <Button onClick={fetchDealers} className="flex items-center gap-2 bg-primary hover:bg-primary/90">
            <Search className="h-4 w-4" /> Apply Filters
          </Button>
          <Button variant="outline" onClick={handleClearFilters} className="flex items-center gap-2">
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
            <p className="text-center text-muted-foreground py-8">No dealers found matching your criteria.</p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-muted">
                  <TableRow className="bg-muted hover:bg-muted/90">
                    <TableHead className="text-muted-foreground font-bold">Name</TableHead>
                    <TableHead className="text-muted-foreground font-bold">Contact Person</TableHead>
                    <TableHead className="text-muted-foreground font-bold">Email</TableHead>
                    <TableHead className="text-muted-foreground font-bold">Phone</TableHead>
                    <TableHead className="text-muted-foreground font-bold">Address</TableHead>
                    <TableHead className="text-muted-foreground font-bold">City</TableHead>
                    <TableHead className="text-muted-foreground font-bold">State</TableHead>
                    <TableHead className="text-muted-foreground font-bold">Country</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-right">Credit Limit</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-right">Opening Balance</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-right">Current Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dealers.map((dealer) => (
                    <TableRow key={dealer.id} className="hover:bg-accent/50">
                      <TableCell className="font-medium text-foreground">{dealer.name}</TableCell>
                      <TableCell className="text-foreground">{dealer.contact_person || 'N/A'}</TableCell>
                      <TableCell className="text-foreground">{dealer.email || 'N/A'}</TableCell>
                      <TableCell className="text-foreground">{dealer.phone || 'N/A'}</TableCell>
                      <TableCell className="text-foreground">{dealer.address}</TableCell>
                      <TableCell className="text-foreground">{dealer.city || 'N/A'}</TableCell>
                      <TableCell className="text-foreground">{dealer.state || 'N/A'}</TableCell>
                      <TableCell className="text-foreground">{dealer.country || 'N/A'}</TableCell>
                      <TableCell className="text-foreground text-right">₹{dealer.credit_limit.toFixed(2)}</TableCell>
                      <TableCell className="text-foreground text-right">₹{dealer.opening_balance.toFixed(2)}</TableCell>
                      <TableCell className="text-foreground text-right">₹{dealer.current_balance.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

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

export default SalesPersonDealerReport;