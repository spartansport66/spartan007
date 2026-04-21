"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { showError, showSuccess } from '@/utils/toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Loader2, FileText, Printer, Eye, Download, ArrowLeft, Filter } from 'lucide-react';
import { MadeWithDyad } from '@/components/made-with-dyad';
import PrintBillDialog from '@/components/PrintBillDialog';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface Invoice {
  id: string;
  bill_number: string;
  bill_date: string;
  order_id: string;
  company_id: string;
  dealer_id: string;
  gst_number: string | null;
  total_amount: number;
  discount_amount: number;
  freight_charges: number;
  round_off: number;
  taxable_value: number;
  total_gst: number;
  grand_total: number;
  payment_status: string;
  created_at: string;
  companies?: { name: string };
  dealers?: { name: string; address?: string; city?: string; state?: string };
}

const InvoiceReports = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, userType } = useSession();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [searchBillNo, setSearchBillNo] = useState<string>('');
  const [filterCompany, setFilterCompany] = useState<string>('all');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [companies, setCompanies] = useState<Array<{ id: string; name: string }>>([]);

  // Dialog states
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<string | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedInvoiceDetails, setSelectedInvoiceDetails] = useState<Invoice | null>(null);

  // Authorization check
  useEffect(() => {
    if (!sessionLoading && userType !== 'billing' && userType !== 'admin') {
      showError('You do not have permission to access this page');
      navigate('/dashboard');
    }
  }, [sessionLoading, userType, navigate]);

  // Fetch companies for filter
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const { data, error } = await supabase
          .from('companies')
          .select('id, name')
          .eq('is_active', true)
          .order('name');

        if (error) throw error;
        setCompanies(data || []);
      } catch (err) {
        console.error('Error fetching companies:', err);
      }
    };

    if (!sessionLoading) {
      fetchCompanies();
    }
  }, [sessionLoading]);

  // Fetch invoices
  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch from both spartan and fightor tables
      const { data: spartanData, error: spartanError } = await supabase
        .from('spartan')
        .select(`
          id,
          bill_number,
          bill_date,
          order_id,
          company_id,
          dealer_id,
          gst_number,
          total_amount,
          discount_amount,
          freight_charges,
          round_off,
          taxable_value,
          total_gst,
          grand_total,
          payment_status,
          created_at,
          companies(name),
          dealers(name, address, city, state)
        `)
        .order('bill_date', { ascending: false })
        .order('bill_number', { ascending: false });

      const { data: fightorData, error: fightorError } = await supabase
        .from('fightor')
        .select(`
          id,
          bill_number,
          bill_date,
          order_id,
          company_id,
          dealer_id,
          gst_number,
          total_amount,
          discount_amount,
          freight_charges,
          round_off,
          taxable_value,
          total_gst,
          grand_total,
          payment_status,
          created_at,
          companies(name),
          dealers(name, address, city, state)
        `)
        .order('bill_date', { ascending: false })
        .order('bill_number', { ascending: false });

      if (spartanError && fightorError) throw spartanError;
      
      const data = [...(spartanData || []), ...(fightorData || [])];
      setInvoices(data);
      applyFilters(data);
    } catch (err) {
      console.error('Error fetching invoices:', err);
      showError('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading) {
      fetchInvoices();
    }
  }, [sessionLoading, fetchInvoices]);

  // Apply filters
  const applyFilters = useCallback(
    (invoicesToFilter: Invoice[]) => {
      let filtered = [...invoicesToFilter];

      // Search by bill number
      if (searchBillNo.trim()) {
        filtered = filtered.filter((inv) =>
          inv.bill_number.toLowerCase().includes(searchBillNo.toLowerCase())
        );
      }

      // Filter by company
      if (filterCompany !== 'all') {
        filtered = filtered.filter((inv) => inv.company_id === filterCompany);
      }

      // Filter by payment status
      if (filterPaymentStatus !== 'all') {
        filtered = filtered.filter((inv) => inv.payment_status === filterPaymentStatus);
      }

      // Filter by date range
      if (filterDateFrom) {
        const fromDate = new Date(filterDateFrom);
        filtered = filtered.filter((inv) => new Date(inv.bill_date) >= fromDate);
      }

      if (filterDateTo) {
        const toDate = new Date(filterDateTo);
        toDate.setHours(23, 59, 59, 999);
        filtered = filtered.filter((inv) => new Date(inv.bill_date) <= toDate);
      }

      setFilteredInvoices(filtered);
    },
    [searchBillNo, filterCompany, filterPaymentStatus, filterDateFrom, filterDateTo]
  );

  useEffect(() => {
    applyFilters(invoices);
  }, [searchBillNo, filterCompany, filterPaymentStatus, filterDateFrom, filterDateTo, invoices, applyFilters]);

  const handleResetFilters = () => {
    setSearchBillNo('');
    setFilterCompany('all');
    setFilterPaymentStatus('all');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  const handleExportCSV = () => {
    if (filteredInvoices.length === 0) {
      showError('No invoices to export');
      return;
    }

    const headers = [
      'Bill Number',
      'Bill Date',
      'Company',
      'Dealer',
      'Taxable Value',
      'GST Amount',
      'Discount',
      'Freight',
      'Grand Total',
      'Payment Status',
    ];

    const rows = filteredInvoices.map((inv) => [
      inv.bill_number,
      format(new Date(inv.bill_date), 'dd-MMM-yyyy'),
      inv.companies?.name || 'N/A',
      inv.dealers?.name || 'N/A',
      inv.taxable_value.toFixed(2),
      inv.total_gst.toFixed(2),
      inv.discount_amount.toFixed(2),
      inv.freight_charges.toFixed(2),
      inv.grand_total.toFixed(2),
      inv.payment_status,
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice_report_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    showSuccess('Report exported successfully');
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800';
      case 'pending':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (sessionLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/dashboard')}
              className="hover:bg-gray-200"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Invoice Reports</h1>
              <p className="text-gray-600">View, filter, and reprint all invoices</p>
            </div>
          </div>
          <FileText className="h-10 w-10 text-primary" />
        </div>

        {/* Filters Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filter Invoices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Search Bill Number */}
              <div>
                <Label className="text-sm">Search Bill Number</Label>
                <Input
                  placeholder="Bill number..."
                  value={searchBillNo}
                  onChange={(e) => setSearchBillNo(e.target.value)}
                  className="mt-1"
                />
              </div>

              {/* Company Filter */}
              <div>
                <Label className="text-sm">Company</Label>
                <Select value={filterCompany} onValueChange={setFilterCompany}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Companies</SelectItem>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Payment Status Filter */}
              <div>
                <Label className="text-sm">Payment Status</Label>
                <Select value={filterPaymentStatus} onValueChange={setFilterPaymentStatus}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date From */}
              <div>
                <Label className="text-sm">Date From</Label>
                <Input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="mt-1"
                />
              </div>

              {/* Date To */}
              <div>
                <Label className="text-sm">Date To</Label>
                <Input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Filter Buttons */}
            <div className="flex gap-2 mt-4">
              <Button variant="outline" onClick={handleResetFilters}>
                Reset Filters
              </Button>
              <Button onClick={handleExportCSV} className="ml-auto">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results Summary */}
        <div className="mb-4 text-sm text-gray-600">
          Showing <span className="font-bold">{filteredInvoices.length}</span> of{' '}
          <span className="font-bold">{invoices.length}</span> invoices
        </div>

        {/* Invoices Table */}
        {filteredInvoices.length > 0 ? (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-100 hover:bg-gray-100">
                    <TableHead>Bill Number</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Dealer</TableHead>
                    <TableHead className="text-right">Taxable Value</TableHead>
                    <TableHead className="text-right">GST</TableHead>
                    <TableHead className="text-right">Grand Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id} className="hover:bg-gray-50">
                      <TableCell className="font-mono font-bold text-blue-600">
                        {invoice.bill_number}
                      </TableCell>
                      <TableCell>{format(new Date(invoice.bill_date), 'dd-MMM-yyyy')}</TableCell>
                      <TableCell className="text-sm">{invoice.companies?.name || 'N/A'}</TableCell>
                      <TableCell className="text-sm">{invoice.dealers?.name || 'N/A'}</TableCell>
                      <TableCell className="text-right">
                        ₹{invoice.taxable_value.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        ₹{invoice.total_gst.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        ₹{invoice.grand_total.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs font-semibold ${getPaymentStatusColor(
                            invoice.payment_status
                          )}`}
                        >
                          {invoice.payment_status}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex gap-2 justify-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedInvoiceDetails(invoice);
                              setIsDetailsDialogOpen(true);
                            }}
                            title="View Details"
                          >
                            <Eye className="h-4 w-4 text-blue-600" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedInvoiceForPrint(invoice.order_id);
                              setIsPrintDialogOpen(true);
                            }}
                            title="Print/Reprint"
                          >
                            <Printer className="h-4 w-4 text-green-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <FileText className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-600">No invoices found matching your filters</p>
          </div>
        )}

        {/* Invoice Details Dialog */}
        {selectedInvoiceDetails && (
          <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Invoice Details - {selectedInvoiceDetails.bill_number}</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Header Info */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded">
                  <div>
                    <Label className="text-xs text-gray-600">Bill Number</Label>
                    <p className="font-mono font-bold text-lg">{selectedInvoiceDetails.bill_number}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">Bill Date</Label>
                    <p className="font-semibold">
                      {format(new Date(selectedInvoiceDetails.bill_date), 'dd MMM yyyy')}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">Company</Label>
                    <p className="font-semibold">{selectedInvoiceDetails.companies?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">Dealer</Label>
                    <p className="font-semibold">{selectedInvoiceDetails.dealers?.name || 'N/A'}</p>
                  </div>
                </div>

                {/* Amount Details */}
                <div className="p-4 bg-blue-50 rounded border border-blue-200">
                  <h3 className="font-semibold mb-2">Amount Breakdown</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Taxable Value:</span>
                      <span>₹{selectedInvoiceDetails.taxable_value.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>GST Amount:</span>
                      <span>₹{selectedInvoiceDetails.total_gst.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Discount:</span>
                      <span>₹{selectedInvoiceDetails.discount_amount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Freight:</span>
                      <span>₹{selectedInvoiceDetails.freight_charges.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Round Off:</span>
                      <span>₹{selectedInvoiceDetails.round_off.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold border-t pt-1 text-base">
                      <span>Grand Total:</span>
                      <span>₹{selectedInvoiceDetails.grand_total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Status and GST */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded">
                  <div>
                    <Label className="text-xs text-gray-600">Payment Status</Label>
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-semibold mt-1 ${getPaymentStatusColor(
                        selectedInvoiceDetails.payment_status
                      )}`}
                    >
                      {selectedInvoiceDetails.payment_status}
                    </span>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">GST Number</Label>
                    <p className="font-mono text-sm">{selectedInvoiceDetails.gst_number || 'N/A'}</p>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsDetailsDialogOpen(false)}
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setSelectedInvoiceForPrint(selectedInvoiceDetails.order_id);
                    setIsPrintDialogOpen(true);
                    setIsDetailsDialogOpen(false);
                  }}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Reprint Invoice
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Print Dialog */}
        {isPrintDialogOpen && selectedInvoiceForPrint && (
          <PrintBillDialog
            isOpen={isPrintDialogOpen}
            onOpenChange={setIsPrintDialogOpen}
            orderId={selectedInvoiceForPrint}
          />
        )}

        <MadeWithDyad />
      </div>
    </div>
  );
};

export default InvoiceReports;
