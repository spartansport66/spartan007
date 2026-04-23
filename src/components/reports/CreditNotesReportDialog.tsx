"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { Loader2, Download, Eye, Edit, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import CreditNoteDialog from '@/components/CreditNoteDialog';
import CreditNoteDetailsDialog from '@/components/CreditNoteDetailsDialog';
import { CreditNote } from '@/types/creditNote';
import { format } from 'date-fns';

interface CreditNotesReportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  issued: 'bg-blue-100 text-blue-800',
  partially_used: 'bg-yellow-100 text-yellow-800',
  fully_used: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  expired: 'bg-orange-100 text-orange-800',
};

export default function CreditNotesReportDialog({
  isOpen,
  onOpenChange,
}: CreditNotesReportDialogProps) {
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [approvalFilter, setApprovalFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedCreditNote, setSelectedCreditNote] = useState<CreditNote | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCreditNotes();
    }
  }, [isOpen]);

  const loadCreditNotes = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('credit_notes')
        .select('*');

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (approvalFilter !== 'all') {
        query = query.eq('approval_status', approvalFilter);
      }

      if (fromDate) {
        query = query.gte('credit_note_date', new Date(fromDate).toISOString());
      }

      if (toDate) {
        query = query.lte('credit_note_date', new Date(toDate).toISOString());
      }

      const { data, error } = await query.order('credit_note_date', {
        ascending: false,
      });

      if (error) throw error;
      setCreditNotes(data || []);
    } catch (err) {
      console.error('Error loading credit notes:', err);
      showError('Failed to load credit notes');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = () => {
    loadCreditNotes();
  };

  const calculateTotals = () => {
    return {
      totalIssued: creditNotes.reduce((sum, cn) => sum + cn.credit_amount, 0),
      totalUsed: creditNotes.reduce((sum, cn) => sum + cn.credit_used, 0),
      totalRemaining: creditNotes.reduce((sum, cn) => sum + cn.credit_remaining, 0),
    };
  };

  const totals = calculateTotals();

  const handlePreviewCreditNote = (creditNote: CreditNote) => {
    setSelectedCreditNote(creditNote);
    setIsPreviewOpen(true);
  };

  const handleEditCreditNote = (creditNote: CreditNote) => {
    setSelectedCreditNote(creditNote);
    setIsEditOpen(true);
  };

  const handleDeleteCreditNote = async (creditNote: CreditNote) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('credit_notes')
        .delete()
        .eq('id', creditNote.id);
      if (error) throw error;
      showSuccess('Credit note deleted successfully');
      loadCreditNotes();
    } catch (err) {
      console.error('Error deleting credit note:', err);
      showError('Failed to delete credit note');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCSV = () => {
    const headers = [
      'Credit Note #',
      'Date',
      'Amount',
      'Used',
      'Remaining',
      'Status',
      'Approval',
      'Reason',
    ];
    const rows = creditNotes.map((cn) => [
      cn.credit_note_number,
      format(new Date(cn.credit_note_date), 'MMM dd, yyyy'),
      cn.credit_amount.toFixed(2),
      cn.credit_used.toFixed(2),
      cn.credit_remaining.toFixed(2),
      cn.status,
      cn.approval_status,
      cn.reason,
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `credit-notes-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Credit Notes Report</DialogTitle>
          <DialogDescription>
            View and analyze all credit notes issued to dealers
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Filters */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="issued">Issued</SelectItem>
                      <SelectItem value="partially_used">Partially Used</SelectItem>
                      <SelectItem value="fully_used">Fully Used</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="approval">Approval Status</Label>
                  <Select value={approvalFilter} onValueChange={setApprovalFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Approvals</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fromDate">From Date</Label>
                  <Input
                    id="fromDate"
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="toDate">To Date</Label>
                  <Input
                    id="toDate"
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                  />
                </div>

                <div className="flex items-end gap-2">
                  <Button onClick={handleFilterChange} className="w-full">
                    Apply Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Total Issued</p>
                  <p className="text-lg font-bold">₹{totals.totalIssued.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-yellow-50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Total Used</p>
                  <p className="text-lg font-bold">₹{totals.totalUsed.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Total Remaining</p>
                  <p className="text-lg font-bold">₹{totals.totalRemaining.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Total Records</p>
                  <p className="text-lg font-bold">{creditNotes.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardContent className="pt-6">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : creditNotes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No credit notes found
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Credit Note #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Used</TableHead>
                        <TableHead className="text-right">Remaining</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Approval</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {creditNotes.map((cn) => (
                        <TableRow key={cn.id}>
                          <TableCell className="font-mono text-sm">
                            {cn.credit_note_number}
                          </TableCell>
                          <TableCell className="text-sm">
                            {format(new Date(cn.credit_note_date), 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            ₹{cn.credit_amount.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            ₹{cn.credit_used.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right text-green-600 font-semibold">
                            ₹{cn.credit_remaining.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={statusColors[cn.status]}
                            >
                              {cn.status.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                cn.approval_status === 'approved'
                                  ? 'bg-green-100 text-green-800'
                                  : cn.approval_status === 'pending'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-red-100 text-red-800'
                              }
                            >
                              {cn.approval_status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {cn.reason.replace(/_/g, ' ')}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Preview"
                                onClick={() => handlePreviewCreditNote(cn)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Edit"
                                onClick={() => handleEditCreditNote(cn)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    title="Delete"
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      Delete {cn.credit_note_number}?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This action will permanently remove the credit note and its items.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteCreditNote(cn)}
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Download Button */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleDownloadCSV}>
              <Download className="h-4 w-4 mr-2" />
              Download CSV
            </Button>
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        </div>
      </DialogContent>

      {selectedCreditNote && (
        <CreditNoteDetailsDialog
          isOpen={isPreviewOpen}
          onOpenChange={(open) => {
            setIsPreviewOpen(open);
            if (!open) setSelectedCreditNote(null);
          }}
          creditNote={selectedCreditNote}
        />
      )}

      <CreditNoteDialog
        isOpen={isEditOpen}
        onOpenChange={(open) => {
          setIsEditOpen(open);
          if (!open) setSelectedCreditNote(null);
        }}
        onSuccess={loadCreditNotes}
        creditNote={selectedCreditNote}
      />
    </Dialog>
  );
}
