"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { Loader2, Download } from 'lucide-react';
import { CreditNote, CreditNoteItem, CreditNoteApplication } from '@/types/creditNote';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';

interface CreditNoteDetailsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  creditNote: CreditNote;
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  issued: 'bg-blue-100 text-blue-800',
  partially_used: 'bg-yellow-100 text-yellow-800',
  fully_used: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  expired: 'bg-orange-100 text-orange-800',
};

export default function CreditNoteDetailsDialog({
  isOpen,
  onOpenChange,
  creditNote,
}: CreditNoteDetailsDialogProps) {
  const [items, setItems] = useState<CreditNoteItem[]>([]);
  const [applications, setApplications] = useState<CreditNoteApplication[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadDetails();
    }
  }, [isOpen, creditNote]);

  const loadDetails = async () => {
    setLoading(true);
    try {
      const [itemsResult, applicationsResult] = await Promise.all([
        supabase
          .from('credit_note_items')
          .select('*')
          .eq('credit_note_id', creditNote.id),
        supabase
          .from('credit_note_applications')
          .select('*')
          .eq('credit_note_id', creditNote.id),
      ]);

      if (itemsResult.error) throw itemsResult.error;
      if (applicationsResult.error) throw applicationsResult.error;

      setItems(itemsResult.data || []);
      setApplications(applicationsResult.data || []);
    } catch (err) {
      console.error('Error loading credit note details:', err);
      showError('Failed to load credit note details');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalAmount = () => {
    return items.reduce((sum, item) => sum + (item.item_amount || 0), 0);
  };

  const calculateGSTAmount = () => {
    const gst = creditNote.gst_percentage || 0;
    return (calculateTotalAmount() * gst) / 100;
  };

  const calculateGrandTotal = () => {
    return calculateTotalAmount() + calculateGSTAmount();
  };

  const handleDownloadPDF = () => {
    // TODO: Implement PDF download functionality
    showError('PDF download feature coming soon');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Credit Note Details</DialogTitle>
          <DialogDescription>
            {creditNote.credit_note_number}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header Information */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Credit Note Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Credit Note #</p>
                    <p className="font-semibold">{creditNote.credit_note_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date</p>
                    <p className="font-semibold">
                      {format(new Date(creditNote.credit_note_date), 'MMM dd, yyyy')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Reason</p>
                    <p className="font-semibold">
                      {creditNote.reason.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge className={statusColors[creditNote.status]}>
                      {creditNote.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  {creditNote.referenced_bill_number && (
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Referenced Invoice
                      </p>
                      <p className="font-semibold">
                        {creditNote.referenced_bill_number}
                      </p>
                    </div>
                  )}
                  {creditNote.expiry_date && (
                    <div>
                      <p className="text-sm text-muted-foreground">Expiry Date</p>
                      <p className="font-semibold">
                        {format(new Date(creditNote.expiry_date), 'MMM dd, yyyy')}
                      </p>
                    </div>
                  )}
                  {creditNote.description && (
                    <div className="col-span-2">
                      <p className="text-sm text-muted-foreground">Description</p>
                      <p className="text-sm">{creditNote.description}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Credit Note Items */}
            {items.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Items</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{item.description}</p>
                              {item.reason_for_return && (
                                <p className="text-xs text-muted-foreground">
                                  {item.reason_for_return}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {item.quantity_returned}
                          </TableCell>
                          <TableCell className="text-right">
                            ₹{item.unit_price.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            ₹{item.item_amount.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Totals */}
                  <div className="flex justify-end mt-4 space-y-2">
                    <div className="w-48 space-y-2">
                      <div className="flex justify-between py-1">
                        <span className="text-muted-foreground">Subtotal:</span>
                        <span>₹{calculateTotalAmount().toFixed(2)}</span>
                      </div>
                      {creditNote.gst_percentage && creditNote.gst_percentage > 0 && (
                        <div className="flex justify-between py-1">
                          <span className="text-muted-foreground">
                            GST ({creditNote.gst_percentage}%):
                          </span>
                          <span>₹{calculateGSTAmount().toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between py-2 font-bold border-t">
                        <span>Total:</span>
                        <span>₹{calculateGrandTotal().toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Summary */}
            <Card className="bg-muted">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Credit Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Credit Amount</p>
                    <p className="text-lg font-bold">
                      ₹{creditNote.credit_amount.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Credit Used</p>
                    <p className="text-lg font-bold">
                      ₹{creditNote.credit_used.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Credit Remaining</p>
                    <p className="text-lg font-bold text-green-600">
                      ₹{creditNote.credit_remaining.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Usage Percentage
                    </p>
                    <p className="text-lg font-bold">
                      {creditNote.credit_amount > 0
                        ? (
                            (creditNote.credit_used /
                              creditNote.credit_amount) *
                            100
                          ).toFixed(1)
                        : 0}
                      %
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Applications */}
            {applications.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Applications</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Applied Date</TableHead>
                        <TableHead>Amount Applied</TableHead>
                        <TableHead>Reference</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {applications.map((app) => (
                        <TableRow key={app.id}>
                          <TableCell>
                            {format(new Date(app.application_date), 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell className="font-semibold">
                            ₹{app.amount_applied.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {app.invoice_id ? 'Invoice' : 'Payment'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleDownloadPDF()}>
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
