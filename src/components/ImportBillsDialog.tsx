"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Download, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { format } from 'date-fns';
import { exportBillsToExcel, generateBillExportFilename, BillDataForExport } from '@/utils/billExportToExcel';

interface BillRecord {
  id: string;
  bill_number: string;
  bill_date: string;
  grand_total: number;
  payment_status: string;
  status: string;
  dealer_name?: string;
  company_name?: string;
  company_id?: string;
  dealer_id?: string;
  source_table: 'spartan' | 'fightor';
}

interface ImportBillsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

const ImportBillsDialog: React.FC<ImportBillsDialogProps> = ({ isOpen, onClose, onImportComplete }) => {
  const [fromDate, setFromDate] = useState<string>(format(new Date(new Date().setMonth(new Date().getMonth() - 1)), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedCompanies, setSelectedCompanies] = useState<'spartan' | 'fightor' | 'both'>('both');
  const [bills, setBills] = useState<BillRecord[]>([]);
  const [selectedBills, setSelectedBills] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [importStats, setImportStats] = useState<{ success: number; failed: number } | null>(null);

  // Fetch companies on mount
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const { data, error } = await supabase
          .from('companies')
          .select('id, name')
          .order('name');

        if (error) throw error;
        setCompanies(data || []);
      } catch (error) {
        console.error('Error fetching companies:', error);
      }
    };

    if (isOpen) {
      fetchCompanies();
    }
  }, [isOpen]);

  // Query bills from selected tables
  const fetchBills = async () => {
    setLoading(true);
    try {
      const filters = [
        { column: 'bill_date', value: fromDate, operator: 'gte' },
        { column: 'bill_date', value: toDate, operator: 'lte' },
      ];

      let allBills: BillRecord[] = [];

      // Query Spartan table
      if (selectedCompanies === 'spartan' || selectedCompanies === 'both') {
        let spartanQuery = supabase
          .from('spartan')
          .select(`
            id,
            bill_number,
            bill_date,
            grand_total,
            payment_status,
            status,
            dealer_id,
            company_id,
            dealers(name),
            companies(name)
          `)
          .gte('bill_date', fromDate)
          .lte('bill_date', toDate)
          .order('bill_date', { ascending: false });

        const { data: spartanData, error: spartanError } = await spartanQuery;

        if (spartanError) throw spartanError;

        if (spartanData) {
          const mappedData = spartanData.map((bill: any) => ({
            id: bill.id,
            bill_number: bill.bill_number,
            bill_date: bill.bill_date,
            grand_total: bill.grand_total,
            payment_status: bill.payment_status,
            status: bill.status,
            dealer_name: bill.dealers?.name || 'Unknown',
            company_name: bill.companies?.name || 'Spartan',
            company_id: bill.company_id,
            dealer_id: bill.dealer_id,
            source_table: 'spartan' as const,
          }));
          allBills = [...allBills, ...mappedData];
        }
      }

      // Query Fighter table
      if (selectedCompanies === 'fightor' || selectedCompanies === 'both') {
        let fightorQuery = supabase
          .from('fightor')
          .select(`
            id,
            bill_number,
            bill_date,
            grand_total,
            payment_status,
            status,
            dealer_id,
            company_id,
            dealers(name),
            companies(name)
          `)
          .gte('bill_date', fromDate)
          .lte('bill_date', toDate)
          .order('bill_date', { ascending: false });

        const { data: fightorData, error: fightorError } = await fightorQuery;

        if (fightorError) throw fightorError;

        if (fightorData) {
          const mappedData = fightorData.map((bill: any) => ({
            id: bill.id,
            bill_number: bill.bill_number,
            bill_date: bill.bill_date,
            grand_total: bill.grand_total,
            payment_status: bill.payment_status,
            status: bill.status,
            dealer_name: bill.dealers?.name || 'Unknown',
            company_name: bill.companies?.name || 'Fighter',
            company_id: bill.company_id,
            dealer_id: bill.dealer_id,
            source_table: 'fightor' as const,
          }));
          allBills = [...allBills, ...mappedData];
        }
      }

      // Sort by date descending
      allBills.sort((a, b) => new Date(b.bill_date).getTime() - new Date(a.bill_date).getTime());
      setBills(allBills);
      setSelectedBills(new Set()); // Reset selection
    } catch (error) {
      console.error('Error fetching bills:', error);
      showError('Failed to fetch bills');
    } finally {
      setLoading(false);
    }
  };

  // Toggle bill selection
  const toggleBillSelection = (billId: string) => {
    const newSelected = new Set(selectedBills);
    if (newSelected.has(billId)) {
      newSelected.delete(billId);
    } else {
      newSelected.add(billId);
    }
    setSelectedBills(newSelected);
  };

  // Select/deselect all
  const toggleSelectAll = () => {
    if (selectedBills.size === bills.length) {
      setSelectedBills(new Set());
    } else {
      setSelectedBills(new Set(bills.map(b => b.id)));
    }
  };

  // Import selected bills
  const handleImportBills = async () => {
    if (selectedBills.size === 0) {
      showError('Please select bills to import');
      return;
    }

    setImporting(true);
    let successCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    try {
      const billsToImport = bills.filter(b => selectedBills.has(b.id));

      for (const bill of billsToImport) {
        try {
          const { data: existing, error: existingError } = await supabase
            .from(bill.source_table)
            .select('id')
            .eq('bill_number', bill.bill_number)
            .maybeSingle();

          if (existing) {
            // Bill already exists in the source table, skip as duplicate
            skippedCount++;
            continue;
          }

          const { error } = await supabase
            .from(bill.source_table)
            .insert({
              bill_number: bill.bill_number,
              bill_date: bill.bill_date,
              grand_total: bill.grand_total,
              payment_status: bill.payment_status,
              status: bill.status,
              dealer_id: bill.dealer_id,
              company_id: bill.company_id,
            });

          if (existingError) {
            failedCount++;
            console.error(`Error checking existing bill ${bill.bill_number}:`, existingError);
          } else if (error) {
            failedCount++;
            console.error(`Error importing bill ${bill.bill_number}:`, error);
          } else {
            successCount++;
          }
        } catch (billError) {
          failedCount++;
          console.error(`Error processing bill ${bill.bill_number}:`, billError);
        }
      }

      setImportStats({ success: successCount, failed: failedCount });
      const summaryParts = [];
      if (successCount) summaryParts.push(`${successCount} imported`);
      if (skippedCount) summaryParts.push(`${skippedCount} skipped`);
      if (failedCount) summaryParts.push(`${failedCount} failed`);
      showSuccess(`Import complete: ${summaryParts.join(', ')}`);

      if (onImportComplete) {
        onImportComplete();
      }
    } catch (error) {
      console.error('Error during import:', error);
      showError('Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    // Reset state
    setImportStats(null);
    setSelectedBills(new Set());
    setBills([]);
    onClose();
  };

  // Export selected bills to Excel
  const handleExportToExcel = async () => {
    if (bills.length === 0) {
      showError('No bills to export');
      return;
    }

    try {
      // Fetch detailed bill data for export
      const billsToExport = bills.filter(b => selectedBills.has(b.id));
      
      if (billsToExport.length === 0) {
        showError('Please select bills to export');
        return;
      }

      const exportData: BillDataForExport[] = [];

      for (const bill of billsToExport) {
        try {
          // Fetch full bill details including items
          const { data: billDetails, error } = await supabase
            .from(bill.source_table)
            .select(`
              id,
              bill_number,
              bill_date,
              grand_total,
              payment_status,
              status,
              freight_charges,
              round_off,
              order_id,
              dealers(name, gst_number, address, city, state),
              companies(name, gst_number)
            `)
            .eq('id', bill.id)
            .maybeSingle();

          if (error || !billDetails) {
            console.error(`Error fetching bill details for ${bill.bill_number}:`, error);
            continue;
          }

          let items: any[] = [];
          if (billDetails.order_id) {
            const { data: salesItems, error: salesError } = await supabase
              .from('sales')
              .select(`
                quantity,
                unit_price,
                discount_percent,
                gst_percent,
                total_price,
                products(name, code, size, hsn)
              `)
              .eq('order_id', billDetails.order_id);

            if (salesError) {
              console.error(`Error fetching sales items for order ${billDetails.order_id}:`, salesError);
            } else {
              items = salesItems || [];
            }
          }

          exportData.push({
            id: billDetails.id,
            bill_number: billDetails.bill_number,
            bill_date: billDetails.bill_date,
            grand_total: billDetails.grand_total,
            payment_status: billDetails.payment_status,
            status: billDetails.status,
            dealer_name: billDetails.dealers?.name || 'Unknown',
            dealer_gst: billDetails.dealers?.gst_number || '',
            dealer_code: '',
            dealer_address: billDetails.dealers?.address || '',
            dealer_city: billDetails.dealers?.city || '',
            dealer_state: billDetails.dealers?.state || '',
            company_name: billDetails.companies?.name || bill.company_name || '',
            company_gst: billDetails.companies?.gst_number || '',
            freight_charges: billDetails.freight_charges || 0,
            round_off: billDetails.round_off || 0,
            items: items.map((item: any) => ({
              product_name: item.products?.name || 'Unknown',
              product_code: item.products?.code || 'N/A',
              product_size: item.products?.size || 'N/A',
              hsn_code: item.products?.hsn || 'N/A',
              quantity: item.quantity || 0,
              unit: item.unit || 'Nos',
              unit_price: item.unit_price || 0,
              discount_percent: item.discount_percent || 0,
              gst_percent: item.gst_percent || 0,
              total_price: item.total_price || 0,
            })),
          });
        } catch (err) {
          console.error(`Error processing bill ${bill.bill_number}:`, err);
        }
      }

      if (exportData.length === 0) {
        showError('Could not export any bills');
        return;
      }

      // Export to Excel
      const filename = generateBillExportFilename(
        selectedCompanies === 'both' ? 'All' : selectedCompanies
      );
      exportBillsToExcel(exportData, filename);
      showSuccess(`Exported ${exportData.length} bill(s) to Excel`);
    } catch (error) {
      console.error('Error exporting bills:', error);
      showError('Failed to export bills to Excel');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Import Bills from {selectedCompanies === 'both' ? 'Companies' : selectedCompanies.charAt(0).toUpperCase() + selectedCompanies.slice(1)}
          </DialogTitle>
          <DialogDescription>
            Select date range and company to fetch bills for import
          </DialogDescription>
        </DialogHeader>

        {importStats ? (
          // Import Results View
          <div className="space-y-4 py-6">
            <Card className={importStats.failed === 0 ? 'border-green-300 bg-green-50' : 'border-yellow-300 bg-yellow-50'}>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    {importStats.failed === 0 ? (
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    ) : (
                      <AlertCircle className="h-6 w-6 text-yellow-600" />
                    )}
                    <span className="text-lg font-semibold">
                      {importStats.failed === 0
                        ? 'All bills imported successfully!'
                        : `Import completed with issues`}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-3 rounded border-l-4 border-green-500">
                      <p className="text-sm text-gray-600">Successfully Imported</p>
                      <p className="text-2xl font-bold text-green-600">{importStats.success}</p>
                    </div>
                    <div className={`${importStats.failed > 0 ? 'bg-white border-l-4 border-red-500' : 'bg-gray-50'} p-3 rounded`}>
                      <p className="text-sm text-gray-600">Failed</p>
                      <p className={`text-2xl font-bold ${importStats.failed > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {importStats.failed}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            {/* Filters Section */}
            <div className="space-y-4 py-6 border-b">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="fromDate" className="text-sm font-semibold">From Date</Label>
                  <Input
                    id="fromDate"
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="toDate" className="text-sm font-semibold">To Date</Label>
                  <Input
                    id="toDate"
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="company" className="text-sm font-semibold">Company</Label>
                  <Select value={selectedCompanies} onValueChange={(value: any) => setSelectedCompanies(value)}>
                    <SelectTrigger id="company" className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="spartan">Spartan</SelectItem>
                      <SelectItem value="fightor">Fighter</SelectItem>
                      <SelectItem value="both">Both Companies</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={fetchBills}
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Fetching...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Fetch Bills
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Bills Table Section */}
            {bills.length > 0 && (
              <div className="space-y-4 py-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-gray-700">
                    Total Bills: {bills.length} | Selected: {selectedBills.size}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={toggleSelectAll}
                      className="text-xs"
                    >
                      {selectedBills.size === bills.length ? 'Deselect All' : 'Select All'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportToExcel}
                      disabled={selectedBills.size === 0}
                      className="text-xs bg-emerald-50 border-emerald-300 hover:bg-emerald-100"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Export Excel
                    </Button>
                  </div>
                </div>

                <ScrollArea className="h-[400px] border rounded-md">
                  <Table className="text-xs">
                    <TableHeader className="sticky top-0 bg-gray-100">
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={selectedBills.size === bills.length && bills.length > 0}
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>
                        <TableHead>Bill #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Party</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Payment</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bills.map((bill, index) => (
                        <TableRow
                          key={bill.id}
                          className={index % 2 === 0 ? 'bg-blue-50' : 'bg-blue-100'}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedBills.has(bill.id)}
                              onCheckedChange={() => toggleBillSelection(bill.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{bill.bill_number}</TableCell>
                          <TableCell>{format(new Date(bill.bill_date), 'dd/MM/yyyy')}</TableCell>
                          <TableCell>{bill.dealer_name}</TableCell>
                          <TableCell className="font-semibold">{bill.company_name}</TableCell>
                          <TableCell className="text-right font-semibold text-green-600">
                            ₹{bill.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              bill.status === 'approve' ? 'bg-green-200 text-green-800' :
                              bill.status === 'reject' ? 'bg-red-200 text-red-800' :
                              bill.status === 'pending' ? 'bg-yellow-200 text-yellow-800' :
                              'bg-gray-200 text-gray-800'
                            }`}>
                              {bill.status}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              bill.payment_status === 'paid' ? 'bg-green-200 text-green-800' :
                              'bg-orange-200 text-orange-800'
                            }`}>
                              {bill.payment_status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            )}

            {bills.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <AlertCircle className="h-12 w-12 mb-3 text-gray-300" />
                <p>Click "Fetch Bills" to load bills from selected date range and company</p>
              </div>
            )}
          </>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
          >
            Close
          </Button>
          {!importStats && bills.length > 0 && (
            <Button
              onClick={handleImportBills}
              disabled={importing || selectedBills.size === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Import {selectedBills.size} Bill{selectedBills.size !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          )}
          {importStats && (
            <Button
              onClick={handleClose}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImportBillsDialog;
