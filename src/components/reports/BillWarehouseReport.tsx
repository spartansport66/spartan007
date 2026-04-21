"use client";
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { Loader2, Eye, Printer, Search } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Invoice {
  id: string;
  bill_number: string;
  invoice_date: string;
  company_id: string;
  company_name: string;
  dealer_name: string;
  grand_total: number;
  payment_status: string;
  gst_amount: number;
  delivery_location?: string;
}

interface BillWarehouseReportProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onReprint?: (invoiceId: string) => void;
}

export default function BillWarehouseReport({ isOpen, onOpenChange, onReprint }: BillWarehouseReportProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [billNumberFilter, setBillNumberFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetchInvoices();
      fetchCompanies();
    }
  }, [isOpen]);

  useEffect(() => {
    applyFilters();
  }, [invoices, billNumberFilter, companyFilter, dateFromFilter, dateToFilter]);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      // Fetch from both spartan and fightor tables
      const { data: spartanData, error: spartanError } = await supabase
        .from('spartan')
        .select(`
          id,
          bill_number,
          invoice_date,
          company_id,
          grand_total,
          payment_status,
          gst_amount,
          companies(name),
          dealers(name)
        `)
        .order('invoice_date', { ascending: false });

      const { data: fightorData, error: fightorError } = await supabase
        .from('fightor')
        .select(`
          id,
          bill_number,
          invoice_date,
          company_id,
          grand_total,
          payment_status,
          gst_amount,
          companies(name),
          dealers(name)
        `)
        .order('invoice_date', { ascending: false });

      if (spartanError && fightorError) throw spartanError;

      const data = [...(spartanData || []), ...(fightorData || [])];

      const processed = (data || []).map((inv: any) => ({
        id: inv.id,
        bill_number: inv.bill_number,
        invoice_date: inv.invoice_date,
        company_id: inv.company_id,
        company_name: inv.companies?.name || 'N/A',
        dealer_name: inv.dealers?.name || 'N/A',
        grand_total: inv.grand_total,
        payment_status: inv.payment_status,
        gst_amount: inv.gst_amount,
      }));

      setInvoices(processed);
    } catch (err: any) {
      showError(`Failed to fetch invoices: ${err.message}`);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setCompanies(data || []);
    } catch (err: any) {
      console.error('Failed to fetch companies:', err);
    }
  };

  const applyFilters = () => {
    let filtered = invoices;

    if (billNumberFilter.trim()) {
      filtered = filtered.filter(inv => 
        inv.bill_number.toLowerCase().includes(billNumberFilter.toLowerCase())
      );
    }

    if (companyFilter) {
      filtered = filtered.filter(inv => inv.company_id === companyFilter);
    }

    if (dateFromFilter) {
      filtered = filtered.filter(inv => inv.invoice_date >= dateFromFilter);
    }

    if (dateToFilter) {
      filtered = filtered.filter(inv => inv.invoice_date <= dateToFilter);
    }

    setFilteredInvoices(filtered);
  };

  const handleViewBill = (invoiceId: string) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice) return;

    // Open printable format
    window.open(`/bill-view/${invoiceId}`, '_blank');
  };

  const handleReprint = (invoiceId: string) => {
    if (onReprint) {
      onReprint(invoiceId);
      onOpenChange(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Warehouse Bill Report</DialogTitle>
          <DialogDescription>View warehouse/company-wise bills with details and reprint options</DialogDescription>
        </DialogHeader>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-muted rounded-lg">
          <div>
            <Label htmlFor="billNumber" className="text-xs">Bill Number</Label>
            <Input
              id="billNumber"
              placeholder="Search bill..."
              value={billNumberFilter}
              onChange={(e) => setBillNumberFilter(e.target.value)}
              className="text-sm"
            />
          </div>
          <div>
            <Label htmlFor="company" className="text-xs">Warehouse/Company</Label>
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger id="company" className="text-sm">
                <SelectValue placeholder="All Companies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Companies</SelectItem>
                {companies.map(company => (
                  <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="dateFrom" className="text-xs">From Date</Label>
            <Input
              id="dateFrom"
              type="date"
              value={dateFromFilter}
              onChange={(e) => setDateFromFilter(e.target.value)}
              className="text-sm"
            />
          </div>
          <div>
            <Label htmlFor="dateTo" className="text-xs">To Date</Label>
            <Input
              id="dateTo"
              type="date"
              value={dateToFilter}
              onChange={(e) => setDateToFilter(e.target.value)}
              className="text-sm"
            />
          </div>
          <div className="flex items-end gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setBillNumberFilter('');
                setCompanyFilter('');
                setDateFromFilter('');
                setDateToFilter('');
              }}
              className="w-full"
            >
              Clear
            </Button>
          </div>
        </div>

        {/* Results Counter */}
        <div className="text-sm text-muted-foreground px-4">
          Showing {filteredInvoices.length} of {invoices.length} bills
        </div>

        {/* Table */}
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto border rounded-md">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2">Loading invoices...</p>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No bills found matching your filters
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow className="bg-muted hover:bg-muted/90">
                  <TableHead className="text-xs">Bill Number</TableHead>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Warehouse/Company</TableHead>
                  <TableHead className="text-xs">Dealer</TableHead>
                  <TableHead className="text-xs text-right">GST Amount</TableHead>
                  <TableHead className="text-xs text-right">Grand Total</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map(invoice => (
                  <TableRow key={invoice.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium text-sm">{invoice.bill_number}</TableCell>
                    <TableCell className="text-sm">{new Date(invoice.invoice_date).toLocaleDateString()}</TableCell>
                    <TableCell className="text-sm">{invoice.company_name}</TableCell>
                    <TableCell className="text-sm">{invoice.dealer_name}</TableCell>
                    <TableCell className="text-sm text-right">₹{invoice.gst_amount.toFixed(2)}</TableCell>
                    <TableCell className="text-sm text-right font-semibold">₹{invoice.grand_total.toFixed(2)}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(invoice.payment_status)}`}>
                        {invoice.payment_status.charAt(0).toUpperCase() + invoice.payment_status.slice(1)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleViewBill(invoice.id)}
                          title="View Bill"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleReprint(invoice.id)}
                          title="Reprint Bill"
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
