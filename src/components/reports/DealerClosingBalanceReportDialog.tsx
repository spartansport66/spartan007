"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Printer, Scale } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import { useSession } from '@/contexts/SessionContext';

interface DealerClosingBalance {
  id: string; // Dealer ID
  name: string; // Dealer Name
  closing_balance: number;
  last_billing_date: string | null; // Now directly from dealers table
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
  const [dealers, setDealers] = useState<DealerClosingBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDealerName, setFilterDealerName] = useState<string>('');
  const [filterSalesPersonId, setFilterSalesPersonId] = useState<string>('');
  const [allSalesPersons, setAllSalesPersons] = useState<FilterOption[]>([]);
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
      console.error('Error fetching company name for PDF:', error.message);
      setCompanyName(null);
    }
  }, []);

  const fetchClosingBalances = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all sales persons first to populate the filter dropdown
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

      let query;
      if (filterSalesPersonId) {
        query = supabase
          .from('dealers')
          .select(`
            id,
            name,
            last_billing_date,
            dealer_balances(closing_balance),
            dealer_sales_persons!inner(sales_person_id)
          `)
          .eq('dealer_sales_persons.sales_person_id', filterSalesPersonId);
      } else {
        query = supabase
          .from('dealers')
          .select(`
            id,
            name,
            last_billing_date,
            dealer_balances(closing_balance)
          `);
      }

      if (filterDealerName) {
        query = query.ilike('name', `%${filterDealerName}%`);
      }

      query = query.order('name', { ascending: true });

      const { data, error } = await query;
      if (error) {
        console.error('[DealerClosingBalanceReportDialog] Error fetching dealer closing balances:', error.message);
        showError('Failed to load dealer closing balances.');
        setDealers([]);
      } else {
        const formattedDealers: DealerClosingBalance[] = (data || []).map((d: any) => {
          const closingBalance = d.dealer_balances?.closing_balance || 0;
          
          return {
            id: d.id,
            name: d.name,
            closing_balance: closingBalance,
            last_billing_date: d.last_billing_date,
          };
        });
        setDealers(formattedDealers);
      }
    } catch (error: any) {
      console.error('Error in fetchClosingBalances:', error.message);
      showError('An unexpected error occurred while fetching dealer data.');
    } finally {
      setLoading(false);
    }
  }, [filterDealerName, filterSalesPersonId]);

  useEffect(() => {
    if (isOpen) {
      fetchCompanyInfo();
      fetchClosingBalances();
    }
  }, [isOpen, fetchCompanyInfo, fetchClosingBalances]);

  const handleClearFilters = () => {
    setFilterDealerName('');
    setFilterSalesPersonId('');
  };

  const handlePrint = () => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait'
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
      if (filterSalesPersonId) {
        const salesPersonLabel = allSalesPersons.find(sp => sp.value === filterSalesPersonId)?.label;
        if (salesPersonLabel) filterDetails.push(`Sales Person: ${salesPersonLabel}`);
      }
      
      if (filterDetails.length > 0) {
        doc.setFontSize(9);
        doc.text(`Filters: ${filterDetails.join(' | ')}`, doc.internal.pageSize.width / 2, 38, { align: 'center' });
      }

      const tableColumn = ["Dealer Name", "Closing Balance (₹)", "Last Billing Date"];
      const tableRows = dealers.map(dealer => [
        dealer.name,
        dealer.closing_balance.toFixed(2),
        dealer.last_billing_date ? new Date(dealer.last_billing_date).toLocaleDateString() : '',
      ]);

      const totalClosingBalance = dealers.reduce((sum, dealer) => sum + dealer.closing_balance, 0);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        foot: [
          [
            { content: 'Total Closing Balance', styles: { halign: 'right', fontStyle: 'bold' }, colSpan: 2 },
            `₹${totalClosingBalance.toFixed(2)}`,
            '',
          ]
        ],
        startY: 45,
        styles: {
          fontSize: 8,
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
          0: { cellWidth: 80 }, // Dealer Name
          1: { cellWidth: 40, halign: 'right' }, // Closing Balance
          2: { cellWidth: 40, halign: 'center' }, // Last Billing Date
        }
      });

      doc.save('dealer_closing_balance_report.pdf');
      showSuccess('Dealer closing balance report generated successfully!');
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      showError(`Failed to generate report: ${error.message || 'An unknown error occurred.'}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary">Dealer Closing Balance Report</DialogTitle>
          <DialogDescription>
            View the closing balances for all dealers.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-card rounded-lg">
          <div className="flex-1 min-w-[180px]">
            <Label htmlFor="filterDealerName">Dealer Name</Label>
            <Input
              id="filterDealerName"
              placeholder="Filter by dealer name"
              value={filterDealerName}
              onChange={(e) => setFilterDealerName(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <Label htmlFor="filterSalesPerson">Sales Person</Label>
            <Select value={filterSalesPersonId || "all"} onValueChange={(value) => setFilterSalesPersonId(value === "all" ? "" : value)}>
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
          <Button onClick={fetchClosingBalances} className="flex items-center gap-2 bg-primary hover:bg-primary/90">
            <Search className="h-4 w-4" /> Apply Filter
          </Button>
          <Button variant="outline" onClick={handleClearFilters} className="flex items-center gap-2">
            Clear Filters
          </Button>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-lg text-foreground">Loading data...</p>
            </div>
          ) : dealers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No dealer closing balance data found.</p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-muted">
                  <TableRow className="bg-muted hover:bg-muted/90">
                    <TableHead className="text-muted-foreground font-bold">Dealer Name</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-right">Closing Balance (₹)</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-center">Last Billing Date</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dealers.map((dealer) => (
                    <TableRow key={dealer.id} className="hover:bg-accent/50">
                      <TableCell className="font-medium text-foreground">{dealer.name}</TableCell>
                      <TableCell className="text-right">
                        {`₹${dealer.closing_balance.toFixed(2)}`}
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {dealer.last_billing_date ? new Date(dealer.last_billing_date).toLocaleDateString() : ''}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-2">
                          <Button variant="ghost" size="icon" disabled title="Closing balance is calculated">
                            <Scale className="h-4 w-4 text-gray-400" />
                          </Button>
                        </div>
                      </TableCell>
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

export default DealerClosingBalanceReportDialog;