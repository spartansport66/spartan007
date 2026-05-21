"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Printer, RefreshCw, Search, X } from 'lucide-react';

interface Dealer {
  id: string;
  name: string;
}

interface LedgerRow {
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  type: string;
  paymentStatus?: string; // 'pending_approval', 'completed', 'rejected'
}

const DealerLedgerReportNew = () => {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [selectedDealerId, setSelectedDealerId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [ledgerRows, setLedgerRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [totals, setTotals] = useState({ totalDebit: 0, totalCredit: 0, finalBalance: 0 });
  const [selectedDealerName, setSelectedDealerName] = useState<string>('');
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const ENTRIES_PER_PAGE = 10;
  const [displayedRows, setDisplayedRows] = useState<LedgerRow[]>([]);

  // Fetch all dealers
  useEffect(() => {
    const fetchDealers = async () => {
      const { data } = await supabase
        .from('dealers')
        .select('id, name')
        .order('name');
      if (data) setDealers(data);
    };
    fetchDealers();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchInputRef.current && !searchInputRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch ledger when dealer changes
  useEffect(() => {
    if (!selectedDealerId) return;
    const dealer = dealers.find(d => d.id === selectedDealerId);
    setSelectedDealerName(dealer?.name || '');
    fetchLedger();
  }, [selectedDealerId, dealers]);

  // Handle scroll to load more entries
  const handleTableScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const scrollPercentage = (element.scrollTop + element.clientHeight) / element.scrollHeight;
    
    // Load more when user scrolls to 80% of the table
    if (scrollPercentage > 0.8 && displayedRows.length < ledgerRows.length) {
      const newCount = Math.min(displayedRows.length + ENTRIES_PER_PAGE, ledgerRows.length);
      setDisplayedRows(ledgerRows.slice(0, newCount));
    }
  }, [displayedRows.length, ledgerRows.length]);

  const fetchLedger = useCallback(async () => {
    if (!selectedDealerId) return;
    setLoading(true);

    try {
      // Get opening balance
      const { data: balances } = await supabase
        .from('dealer_balances')
        .select('opening_balance')
        .eq('dealer_id', selectedDealerId)
        .single();

      const openingBalance = balances?.opening_balance || 0;

      // Get invoices from both spartan and fightor tables
      const { data: spartanInvoices } = await supabase
        .from('spartan')
        .select('id, bill_number, bill_date, grand_total, status')
        .eq('dealer_id', selectedDealerId)
        .in('status', ['approve', 'approved'])
        .order('bill_date');

      const { data: fightorInvoices } = await supabase
        .from('fightor')
        .select('id, bill_number, bill_date, grand_total, status')
        .eq('dealer_id', selectedDealerId)
        .in('status', ['approve', 'approved'])
        .order('bill_date');

      const invoices = [...(spartanInvoices || []), ...(fightorInvoices || [])];

      // Get payments from payment_received table
      const { data: payments } = await supabase
        .from('payment_received')
        .select('id, payment_date, amount, status')
        .eq('dealer_id', selectedDealerId)
        .order('payment_date');

      // Get approved credit notes for this dealer
      const { data: creditNotes } = await supabase
        .from('credit_notes')
        .select('id, credit_note_number, credit_note_date, credit_amount, status, approval_status')
        .eq('dealer_id', selectedDealerId)
        .eq('approval_status', 'approved')
        .neq('status', 'cancelled')
        .order('credit_note_date');

      // Build ledger rows
      const rows: LedgerRow[] = [];
      let runningBalance = openingBalance;

      // Opening balance row - always first
      const openingRow: LedgerRow = {
        date: '0000-01-01', // Special sorting marker to ensure it stays first
        description: 'Opening Balance',
        debit: openingBalance,
        credit: 0,
        balance: runningBalance,
        type: 'opening',
      };

      // Invoices
      const invoiceRows: LedgerRow[] = (invoices || []).map((inv) => {
        return {
          date: inv.bill_date,
          description: `Invoice ${inv.bill_number}`,
          debit: Number(inv.grand_total) || 0,
          credit: 0,
          balance: 0, // Will be recalculated after sorting
          type: 'invoice',
        };
      });

      // Payments - only completed payments affect balance
      const paymentRows: LedgerRow[] = (payments || []).map((pmt) => {
        // Status label for description
        const statusLabel = pmt.status === 'completed' ? 'Approved' : pmt.status === 'pending_approval' ? 'Pending' : 'Rejected';
        
        return {
          date: pmt.payment_date,
          description: `Payment Received - ${statusLabel}`,
          debit: 0,
          credit: pmt.status === 'completed' ? Number(pmt.amount) || 0 : 0, // Only approved payments show amount and count
          balance: 0, // Will be recalculated after sorting
          type: 'payment',
          paymentStatus: pmt.status,
        };
      });

      const creditNoteRows: LedgerRow[] = (creditNotes || []).map((note) => ({
        date: note.credit_note_date,
        description: `Credit Note ${note.credit_note_number}${note.status ? ` (${note.status.replace(/_/g, ' ')})` : ''}`,
        debit: 0,
        credit: Number(note.credit_amount) || 0,
        balance: 0,
        type: 'credit_note',
      }));

      // Combine and sort: opening balance first, then others by date ascending (oldest first)
      const otherRows = [...invoiceRows, ...paymentRows, ...creditNoteRows];
      otherRows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      rows.push(openingRow, ...otherRows);

      // Recalculate balances and totals after sorting
      let balance = openingBalance;
      let totalDebit = openingBalance;
      let totalCredit = 0;
      
      rows.forEach((row) => {
        if (row.type !== 'opening') {
          // Add to debit/credit totals
          if (row.debit > 0) {
            totalDebit += row.debit;
          }
          if (row.credit > 0) {
            totalCredit += row.credit;
          }
          
          // Update balance only for items that affect it
          balance += row.debit - row.credit;
          row.balance = balance;
        }
      });

      setLedgerRows(rows);
      // Show only first 10 entries
      setDisplayedRows(rows.slice(0, ENTRIES_PER_PAGE));
      setTotals({
        totalDebit,
        totalCredit,
        finalBalance: balance,
      });
    } catch (error) {
      console.error('Error fetching ledger:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedDealerId]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '', 'width=1000,height=700');
    if (!printWindow) return;

    const tableHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Dealer Ledger Report - ${selectedDealerName}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 20px;
            color: #333;
          }
          .header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
          }
          .header p {
            margin: 5px 0;
            font-size: 14px;
            color: #666;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          th {
            background-color: #f0f0f0;
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
            font-weight: bold;
            font-size: 13px;
          }
          td {
            border: 1px solid #ddd;
            padding: 10px;
            font-size: 13px;
          }
          tr.opening {
            background-color: #e3f2fd;
            font-weight: bold;
          }
          tr.invoice {
            background-color: #fffde7;
          }
          tr.payment {
            background-color: #f1f8e9;
          }
          tr.totals {
            background-color: #e0e0e0;
            font-weight: bold;
            border-top: 2px solid #333;
          }
          .text-right {
            text-align: right;
          }
          .status-badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: bold;
          }
          .status-approved {
            background-color: #c8e6c9;
            color: #2e7d32;
          }
          .status-pending {
            background-color: #fff9c4;
            color: #f57f17;
          }
          .status-rejected {
            background-color: #ffcdd2;
            color: #c62828;
          }
          .summary {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin-top: 20px;
          }
          .summary-card {
            border: 1px solid #ddd;
            padding: 15px;
            text-align: center;
            border-radius: 5px;
          }
          .summary-card h3 {
            margin: 0 0 10px 0;
            font-size: 12px;
            color: #666;
          }
          .summary-card p {
            margin: 0;
            font-size: 18px;
            font-weight: bold;
          }
          .footer {
            margin-top: 30px;
            text-align: right;
            font-size: 12px;
            color: #999;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>DEALER LEDGER REPORT</h1>
          <p><strong>Dealer:</strong> ${selectedDealerName}</p>
          <p><strong>Generated:</strong> ${new Date().toLocaleDateString('en-IN')}</p>
        </div>

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th class="text-right">Debit (₹)</th>
              <th class="text-right">Credit (₹)</th>
              <th class="text-right">Balance (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${ledgerRows.map((row) => `
              <tr class="${row.type}">
                <td>${row.type === 'opening' ? '-' : new Date(row.date).toLocaleDateString('en-IN')}</td>
                <td>${row.description}</td>
                <td class="text-right">${row.debit > 0 ? formatCurrency(row.debit) : '-'}</td>
                <td class="text-right">${row.credit > 0 ? formatCurrency(row.credit) : '-'}</td>
                <td class="text-right"><strong>${formatCurrency(row.balance)}</strong></td>
              </tr>
            `).join('')}
            <tr class="totals">
              <td colspan="2">TOTAL</td>
              <td class="text-right">${formatCurrency(totals.totalDebit)}</td>
              <td class="text-right">${formatCurrency(totals.totalCredit)}</td>
              <td class="text-right">${formatCurrency(totals.finalBalance)}</td>
            </tr>
          </tbody>
        </table>

        <div class="summary">
          <div class="summary-card">
            <h3>Total Debit</h3>
            <p>${formatCurrency(totals.totalDebit)}</p>
          </div>
          <div class="summary-card">
            <h3>Total Credit</h3>
            <p>${formatCurrency(totals.totalCredit)}</p>
          </div>
          <div class="summary-card">
            <h3>Net Balance</h3>
            <p>${formatCurrency(totals.finalBalance)}</p>
          </div>
        </div>

        <div class="footer">
          <p>This is a computer-generated report. No signature required.</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(tableHTML);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex gap-2 items-center">
        {/* Searchable Dealer Input */}
        <div className="flex-1 relative">
          <div className="flex items-center relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400 pointer-events-none" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Search dealer by name..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value.length > 0) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setDropdownPosition({
                    top: rect.bottom + 4,
                    left: rect.left,
                    width: rect.width,
                  });
                  setShowDropdown(true);
                }
              }}
              onFocus={(e) => {
                if (searchQuery.length > 0) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setDropdownPosition({
                    top: rect.bottom + 4,
                    left: rect.left,
                    width: rect.width,
                  });
                  setShowDropdown(true);
                }
              }}
              className="pl-10 pr-8"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setShowDropdown(false);
                }}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Dropdown List - Rendered in Portal outside dialog */}
          {showDropdown && searchQuery.length > 0 && createPortal(
            <div
              style={{
                position: 'fixed',
                top: `${dropdownPosition.top}px`,
                left: `${dropdownPosition.left}px`,
                width: `${dropdownPosition.width}px`,
              }}
              className="z-[9999] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-64 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {dealers
                .filter((dealer) =>
                  dealer.name.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((dealer) => (
                  <div
                    key={dealer.id}
                    onClick={() => {
                      setSelectedDealerId(dealer.id);
                      setSelectedDealerName(dealer.name);
                      setSearchQuery(dealer.name);
                      setShowDropdown(false);
                    }}
                    className="px-4 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border-b dark:border-gray-700 last:border-b-0"
                  >
                    <p className="font-medium text-sm">{dealer.name}</p>
                  </div>
                ))}
              {dealers.filter((dealer) =>
                dealer.name.toLowerCase().includes(searchQuery.toLowerCase())
              ).length === 0 && (
                <div className="px-4 py-3 text-center text-gray-500 text-sm">
                  No dealers found
                </div>
              )}
            </div>,
            document.body
          )}
        </div>

        <Button onClick={fetchLedger} variant="outline" className="gap-2" title="Refresh ledger data">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
        {ledgerRows.length > 0 && (
          <Button onClick={handlePrint} variant="outline" className="gap-2">
            <Printer className="h-4 w-4" />
            Print
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : ledgerRows.length > 0 ? (
        <div className="space-y-4 flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto border rounded-lg" onScroll={handleTableScroll}>
            <Table>
              <TableHeader className="bg-gray-100 sticky top-0">
                <TableRow>
                  <TableHead className="w-24">Date</TableHead>
                  <TableHead className="w-96">Description</TableHead>
                  <TableHead className="text-right w-28">Debit (₹)</TableHead>
                  <TableHead className="text-right w-28">Credit (₹)</TableHead>
                  <TableHead className="text-right w-28 font-bold">Balance (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedRows.map((row, idx) => (
                  <TableRow
                    key={idx}
                    className={
                      row.type === 'opening'
                        ? 'bg-blue-50 font-semibold'
                        : row.type === 'invoice'
                        ? 'bg-yellow-50'
                        : row.type === 'credit_note'
                        ? 'bg-purple-50'
                        : row.paymentStatus === 'completed'
                        ? 'bg-green-50'
                        : 'bg-orange-50'
                    }
                  >
                    <TableCell className="text-sm">
                      {row.type === 'opening' ? '-' : new Date(row.date).toLocaleDateString('en-IN')}
                    </TableCell>
                    <TableCell className="text-sm">{row.description}</TableCell>
                    <TableCell className="text-right text-sm">
                      {row.debit > 0 ? formatCurrency(row.debit) : '-'}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {row.credit > 0 ? formatCurrency(row.credit) : '-'}
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold">
                      {formatCurrency(row.balance)}
                    </TableCell>
                  </TableRow>
                ))}
                {/* Totals Row */}
                <TableRow className="bg-gray-200 font-bold text-base">
                  <TableCell colSpan={2}>TOTAL</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(totals.totalDebit)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(totals.totalCredit)}
                  </TableCell>
                  <TableCell className="text-right bg-blue-100">
                    {formatCurrency(totals.finalBalance)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            {ledgerRows.length > ENTRIES_PER_PAGE && (
              <div className="p-4 bg-gray-50 text-center text-sm text-gray-600 border-t">
                Showing {displayedRows.length} of {ledgerRows.length} entries (Scroll to load more)
              </div>
            )}
          </div>

          {/* Summary Section */}
          <div className="grid grid-cols-3 gap-4 flex-shrink-0">
            <Card className="bg-blue-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gray-600">Total Debit</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(totals.totalDebit)}</p>
              </CardContent>
            </Card>
            <Card className="bg-red-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gray-600">Total Credit</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(totals.totalCredit)}</p>
              </CardContent>
            </Card>
            <Card className="bg-green-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gray-600">Net Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${totals.finalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(totals.finalBalance)}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : selectedDealerId ? (
        <div className="flex-1 flex items-center justify-center text-gray-500 py-12">No ledger entries found</div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <p>Select a dealer to view ledger</p>
        </div>
      )}
    </div>
  );
};

export default DealerLedgerReportNew;
