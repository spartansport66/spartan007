"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Printer, Edit, Save, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';

interface DealerOpeningBalance {
  id: string; // Dealer ID
  name: string; // Dealer Name
  opening_balance: number;
}

interface OpeningBalanceReportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const editBalanceFormSchema = z.object({
  openingBalance: z.preprocess(
    (val) => Number(val),
    z.number().min(0, { message: 'Opening balance cannot be negative.' })
  ),
});

const OpeningBalanceReportDialog: React.FC<OpeningBalanceReportDialogProps> = ({ isOpen, onOpenChange }) => {
  const [dealers, setDealers] = useState<DealerOpeningBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDealerName, setFilterDealerName] = useState<string>('');
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [editingDealerId, setEditingDealerId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const editForm = useForm<z.infer<typeof editBalanceFormSchema>>({
    resolver: zodResolver(editBalanceFormSchema),
    defaultValues: {
      openingBalance: 0,
    },
  });

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

  const fetchOpeningBalances = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('dealers')
        .select(`
          id,
          name,
          dealer_balances(opening_balance)
        `)
        .order('name', { ascending: true });

      if (filterDealerName) {
        query = query.ilike('name', `%${filterDealerName}%`);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching dealer opening balances:', error.message);
        showError('Failed to load dealer opening balances.');
        setDealers([]);
      } else {
        const formattedDealers: DealerOpeningBalance[] = (data || []).map((d: any) => {
          console.log(`DEBUG: Dealer ${d.name} (ID: ${d.id}) raw dealer_balances:`, d.dealer_balances); // Added log
          return {
            id: d.id,
            name: d.name,
            opening_balance: d.dealer_balances?.[0]?.opening_balance || 0,
          };
        });
        setDealers(formattedDealers);
      }
    } catch (error: any) {
      console.error('Error in fetchOpeningBalances:', error.message);
      showError('An unexpected error occurred while fetching dealer data.');
    } finally {
      setLoading(false);
    }
  }, [filterDealerName]);

  useEffect(() => {
    if (isOpen) {
      fetchCompanyInfo();
      fetchOpeningBalances();
    }
  }, [isOpen, fetchCompanyInfo, fetchOpeningBalances]);

  const handleClearFilters = () => {
    setFilterDealerName('');
  };

  const handleEditClick = (dealer: DealerOpeningBalance) => {
    setEditingDealerId(dealer.id);
    editForm.reset({
      openingBalance: dealer.opening_balance,
    });
  };

  const handleUpdateBalance = async (values: z.infer<typeof editBalanceFormSchema>) => {
    if (!editingDealerId) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('dealer_balances')
        .upsert(
          {
            dealer_id: editingDealerId,
            opening_balance: values.openingBalance,
            // Note: closing_balance is typically derived, not directly updated here.
            // If it needs to be updated, ensure the logic is correct.
          },
          { onConflict: 'dealer_id' } // Upsert based on dealer_id
        );

      if (error) throw error;

      showSuccess('Opening balance updated successfully!');
      setEditingDealerId(null);
      fetchOpeningBalances(); // Refresh data
    } catch (error: any) {
      console.error('Error updating opening balance:', error);
      showError(`Failed to update opening balance: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingDealerId(null);
    editForm.reset();
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
      doc.text("Dealer Opening Balance Report", doc.internal.pageSize.width / 2, 25, { align: 'center' });
      doc.setFontSize(10);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, doc.internal.pageSize.width / 2, 32, { align: 'center' });

      let filterDetails = [];
      if (filterDealerName) filterDetails.push(`Dealer Name: ${filterDealerName}`);
      
      if (filterDetails.length > 0) {
        doc.setFontSize(9);
        doc.text(`Filters: ${filterDetails.join(' | ')}`, doc.internal.pageSize.width / 2, 38, { align: 'center' });
      }

      const tableColumn = ["Dealer Name", "Opening Balance (₹)"];
      const tableRows = dealers.map(dealer => [
        dealer.name,
        dealer.opening_balance.toFixed(2),
      ]);

      const totalOpeningBalance = dealers.reduce((sum, dealer) => sum + dealer.opening_balance, 0);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        foot: [
          [
            { content: 'Total Opening Balance', styles: { halign: 'right', fontStyle: 'bold' } },
            `₹${totalOpeningBalance.toFixed(2)}`,
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
          0: { cellWidth: 120 },
          1: { cellWidth: 50, halign: 'right' },
        }
      });

      doc.save('dealer_opening_balance_report.pdf');
      showSuccess('Dealer opening balance report generated successfully!');
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      showError(`Failed to generate report: ${error.message || 'An unknown error occurred.'}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary">Dealer Opening Balance Report</DialogTitle>
          <DialogDescription>
            View and manage opening balances for all dealers.
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
          <Button onClick={fetchOpeningBalances} className="flex items-center gap-2 bg-primary hover:bg-primary/90">
            <Search className="h-4 w-4" /> Apply Filter
          </Button>
          <Button variant="outline" onClick={handleClearFilters} className="flex items-center gap-2">
            Clear Filter
          </Button>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-lg text-foreground">Loading data...</p>
            </div>
          ) : dealers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No dealer opening balance data found.</p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-muted">
                  <TableRow className="bg-muted hover:bg-muted/90">
                    <TableHead className="text-muted-foreground font-bold">Dealer Name</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-right">Opening Balance (₹)</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dealers.map((dealer) => (
                    <TableRow key={dealer.id} className="hover:bg-accent/50">
                      <TableCell className="font-medium text-foreground">{dealer.name}</TableCell>
                      <TableCell className="text-right">
                        {editingDealerId === dealer.id ? (
                          <Form {...editForm}>
                            <form onSubmit={editForm.handleSubmit(handleUpdateBalance)} className="flex items-center justify-end gap-2">
                              <FormField
                                control={editForm.control}
                                name="openingBalance"
                                render={({ field }) => (
                                  <FormItem className="mb-0">
                                    <FormControl>
                                      <Input type="number" step="0.01" {...field} className="w-32 text-right" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </form>
                          </Form>
                        ) : (
                          `₹${dealer.opening_balance.toFixed(2)}`
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-2">
                          {editingDealerId === dealer.id ? (
                            <>
                              <Button type="button" size="icon" onClick={editForm.handleSubmit(handleUpdateBalance)} disabled={isSubmitting} title="Save Changes">
                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                              </Button>
                              <Button type="button" variant="outline" size="icon" onClick={handleCancelEdit} disabled={isSubmitting} title="Cancel Edit">
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <Button variant="ghost" size="icon" onClick={() => handleEditClick(dealer)} title="Edit Opening Balance">
                              <Edit className="h-4 w-4" />
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

export default OpeningBalanceReportDialog;