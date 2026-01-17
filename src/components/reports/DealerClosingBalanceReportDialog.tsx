"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Printer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import { useSession } from '@/contexts/SessionContext';

interface DealerBalanceReportData {
  id: string;
  name: string;
  city: string;
  state: string;
  assignedSalesPersons: string; // Comma-separated names
  openingBalance: number;
  totalDebits: number; // Sum of all order amounts
  totalCredits: number; // Sum of all completed payment amounts
  closingBalance: number; // Calculated: openingBalance + totalDebits - totalCredits
}

interface FilterOption {
  value: string;
  label: string;
}

interface DealerClosingBalanceReportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const DealerClosingBalanceReportDialog: React.FC<DealerClosingBalanceReportDialogProps> = ({ isOpen, onOpenChange }) => {
  const { user } = useSession();
  const [reportData, setReportData] = useState<DealerBalanceReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [allSalesPersons, setAllSalesPersons] = useState<FilterOption[]>([]);
  const [filterDealerName, setFilterDealerName] = useState<string>('');
  const [filterCity, setFilterCity] = useState<string>('');
  const [filterState, setFilterState] = useState<string>('');
  const [filterSalesPersonId, setFilterSalesPersonId] = useState<string>('');
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
      console.error('[DealerClosingBalanceReportDialog] Error fetching company name for PDF:', error.message);
      setCompanyName(null);
    }
  }, []);

  const fetchReportData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all sales persons for the filter dropdown
      const { data: salesPersonsData, error: salesPersonsError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('user_type', 'sales_person')
        .order('first_name', { ascending: true });

      if (salesPersonsError) {
        console.error('[DealerClosingBalanceReportDialog] Error fetching sales persons for filter:', salesPersonsError.message);
        showError('Failed to load sales persons for filter.');
        setAllSalesPersons([]);
      } else {
        setAllSalesPersons((salesPersonsData || []).map(sp => ({
          value: sp.id,
          label: `${sp.first_name} ${sp.last_name || ''}`.trim(),
        })));
      }

      // Fetch all dealers with their assigned sales persons and opening balances
      let dealersQuery = supabase
        .from('dealers')
        .select(`
          id, name, city, state,
          dealer_sales_persons(sales_person_id, profiles(first_name, last_name)),
          dealer_balances(opening_balance),
          orders(id, total_amount, payments(amount, status))
        `);

      // Apply filters
      if (filterDealerName) {
        dealersQuery = dealersQuery.ilike('name', `%${filterDealerName}%`);
      }
      if (filterCity) {
        dealersQuery = dealersQuery.ilike('city', `%${filterCity}%`);
      }
      if (filterState) {
        dealersQuery = dealersQuery.ilike('state', `%${filterState}%`);
      }
      if (filterSalesPersonId) {
        dealersQuery = dealersQuery.eq('dealer_sales_persons.sales_person_id', filterSalesPersonId);
      }

      dealersQuery = dealersQuery.order('name', { ascending: true });

      const { data: dealersRaw, error: dealersError } = await dealersQuery;

      if (dealersError) {
        console.error('[DealerClosingBalanceReportDialog] Error fetching dealers:', dealersError.message);
        throw dealersError;
      }

      const processedData: DealerBalanceReportData[] = (dealersRaw || []).map((dealer: any) => {
        const assignedSalesPersons = (dealer.dealer_sales_persons || [])
          .map((dsp: any) => `${dsp.profiles.first_name} ${dsp.profiles.last_name || ''}`.trim())
          .join(', ') || 'N/A';

        const openingBalance = dealer.dealer_balances?.[0]?.opening_balance || 0;

        let totalDebits = 0;
        let totalCredits = 0;

        (dealer.orders || []).forEach((order: any) => {
          totalDebits += order.total_amount; // All orders are debits
          (order.payments || []).forEach((payment: any) => {
            if (payment.status === 'completed') {
              totalCredits += payment.amount; // Only completed payments are credits
            }
          });
        });

        const closingBalance = openingBalance + totalDebits - totalCredits;

        return {
          id: dealer.id,
          name: dealer.name,
          city: dealer.city || 'N/A',
          state: dealer.state || 'N/A',
          assignedSalesPersons: assignedSalesPersons,
          openingBalance: openingBalance,
          totalDebits: totalDebits,
          totalCredits: totalCredits,
          closingBalance: closingBalance,
        };
      });

      setReportData(processedData);
    } catch (error: any) {
      console.error('[DealerClosingBalanceReportDialog] Error fetching report data:', error.message);
      showError(`Failed to load report data: ${error.message}`);
      setReportData([]);
    } finally {
      setLoading(false);
    }
  }, [filterDealerName, filterCity, filterState, filterSalesPersonId]);

  useEffect(() => {
    if (isOpen) {
      fetchCompanyInfo();
      fetchReportData();
    }
  }, [isOpen, fetchCompanyInfo, fetchReportData]);

  const handleClearFilters = () => {
    setFilterDealerName('');
    setFilterCity('');
    setFilterState('');
    setFilterSalesPersonId('');
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
      doc.text("Dealer Closing Balance Report", doc.internal.pageSize.width / 2, 25, { align: 'center' });
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, doc.internal.pageSize.width / 2, 32, { align: 'center' });

      let filterDetails = [];
      if (filterDealerName) filterDetails.push(`Dealer Name: ${filterDealerName}`);
      if (filterCity) filterDetails.push(`City: ${filterCity}`);
      if (filterState) filterDetails.push(`State: ${filterState}`);
      if (filterSalesPersonId) {
        const salesPersonLabel = allSalesPersons.find(sp => sp.value === filterSalesPersonId)?.label;
        if (salesPersonLabel) filterDetails.push(`Sales Person: ${salesPersonLabel}`);
      }
      
      if (filterDetails.length > 0) {
        doc.setFontSize(9);
        doc.text(`Filters: ${filterDetails.join(' | ')}`, doc.internal.pageSize.width / 2, 38, { align: 'center' });
      }

      const tableColumn = ["Dealer Name", "City", "State", "Assigned Sales Persons", "Opening Balance (₹)", "Total Debits (₹)", "Total Credits (₹)", "Closing Balance (₹)"];
      const tableRows = reportData.map(dealer => [
        dealer.name,
        dealer.city,
        dealer.state,
        dealer.assignedSalesPersons,
        dealer.openingBalance.toFixed(2),
        dealer.totalDebits.toFixed(2),
        dealer.totalCredits.toFixed(2),
        dealer.closingBalance.toFixed(2),
      ]);

      const totalOpeningBalance = reportData.reduce((sum, dealer) => sum + dealer.openingBalance, 0);
      const totalDebits = reportData.reduce((sum, dealer) => sum + dealer.totalDebits, 0);
      const totalCredits = reportData.reduce((sum, dealer) => sum + dealer.totalCredits, 0);
      const totalClosingBalance = reportData.reduce((sum, dealer) => sum + dealer.closingBalance, 0);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        foot: [
          [
            { content: 'Totals', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } },
            `₹${totalOpeningBalance.toFixed(2)}`,
            `₹${totalDebits.toFixed(2)}`,
            `₹${totalCredits.toFixed(2)}`,
            `₹${totalClosingBalance.toFixed(2)}`,
          ]
        ],
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
          0: { cellWidth: 30 }, // Dealer Name
          1: { cellWidth: 20 }, // City
          2: { cellWidth: 20 }, // State
          3: { cellWidth: 40 }, // Assigned Sales Persons
          4: { cellWidth: 25, halign: 'right' }, // Opening Balance
          5: { cellWidth: 25, halign: 'right' }, // Total Debits
          6: { cellWidth: 25, halign: 'right' }, // Total Credits
          7: { cellWidth: 25, halign: 'right' }, // Closing Balance
        }
      });

      doc.save('dealer_closing_balance_report.pdf');
      showSuccess('Dealer closing balance report generated successfully!');
    } catch (error: any) {
      console.error('[DealerClosingBalanceReportDialog] Error generating PDF:', error);
      showError(`Failed to generate report: ${error.message || 'An unknown error occurred.'}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1200px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary">Dealer Closing Balance Report</DialogTitle>
          <DialogDescription>
            Generate a report showing the closing balance for all dealers.
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
            <Input
              id="filterState"
              placeholder="Filter by state"
              value={filterState}
              onChange={(e) => setFilterState(e.target.value)}
              className="w-full"
              disabled={loading}
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterSalesPerson">Sales Person</Label>
            <Select value={filterSalesPersonId || "all"} onValueChange={(value) => setFilterSalesPersonId(value === "all" ? "" : value)} disabled={loading}>
              <SelectTrigger id="filterSalesPerson" className="w-full">
                <SelectValue placeholder="All Sales Persons" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sales Persons</SelectItem>
                {allSalesPersons.map(sp => (
                  <SelectItem key={sp.value} value={sp.value}>{sp.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={fetchReportData} disabled={loading} className="flex items-center gap-2 bg-primary hover:bg-primary/90">
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
              <p className="ml-2 text-lg text-foreground">Loading report data...</p>
            </div>
          ) : reportData.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No dealer closing balance data found matching your criteria.</p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-muted">
                  <TableRow className="bg-muted hover:bg-muted/90">
                    <TableHead className="text-muted-foreground font-bold">Dealer Name</TableHead>
                    <TableHead className="text-muted-foreground font-bold">City</TableHead>
                    <TableHead className="text-muted-foreground font-bold">State</TableHead>
                    <TableHead className="text-muted-foreground font-bold">Assigned Sales Persons</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-right">Opening Balance (₹)</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-right">Total Debits (₹)</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-right">Total Credits (₹)</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-right">Closing Balance (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.map((dealer) => (
                    <TableRow key={dealer.id} className="hover:bg-accent/50">
                      <TableCell className="font-medium text-foreground">{dealer.name}</TableCell>
                      <TableCell className="text-foreground">{dealer.city}</TableCell>
                      <TableCell className="text-foreground">{dealer.state}</TableCell>
                      <TableCell className="text-foreground">{dealer.assignedSalesPersons}</TableCell>
                      <TableCell className="text-foreground text-right">{dealer.openingBalance.toFixed(2)}</TableCell>
                      <TableCell className="text-foreground text-right">{dealer.totalDebits.toFixed(2)}</TableCell>
                      <TableCell className="text-foreground text-right">{dealer.totalCredits.toFixed(2)}</TableCell>
                      <TableCell className="text-foreground text-right font-bold">{dealer.closingBalance.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handlePrint} disabled={reportData.length === 0} className="border border-input hover:bg-accent hover:text-accent-foreground">
            <Printer className="mr-2 h-4 w-4" /> Print Report
          </Button>
          <Button onClick={() => onOpenChange(false)} className="bg-primary hover:bg-primary/90">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DealerClosingBalanceReportDialog;