"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Eye, Copy } from 'lucide-react';
import { CreditNote } from '@/types/creditNote';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import CreditNoteDialog from '@/components/CreditNoteDialog';
import CreditNoteDetailsDialog from '@/components/CreditNoteDetailsDialog';
import { format } from 'date-fns';

interface CreditNotesCardProps {
  dealerId?: string;
  companyId?: string;
  showCreateButton?: boolean;
  title?: string;
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  issued: 'bg-blue-100 text-blue-800',
  partially_used: 'bg-yellow-100 text-yellow-800',
  fully_used: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  expired: 'bg-orange-100 text-orange-800',
};

const approvalColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

export default function CreditNotesCard({
  dealerId,
  companyId,
  showCreateButton = true,
  title = 'Credit Notes',
}: CreditNotesCardProps) {
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCreditNote, setSelectedCreditNote] = useState<CreditNote | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);

  useEffect(() => {
    loadCreditNotes();
  }, [dealerId, companyId]);

  const loadCreditNotes = async () => {
    setLoading(true);
    try {
      let query = supabase.from('credit_notes').select('*');

      if (dealerId) {
        query = query.eq('dealer_id', dealerId);
      }
      if (companyId) {
        query = query.eq('company_id', companyId);
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

  const handleViewDetails = (creditNote: CreditNote) => {
    setSelectedCreditNote(creditNote);
    setIsDetailsDialogOpen(true);
  };

  const handleCopyNumber = (number: string) => {
    navigator.clipboard.writeText(number);
    showError('Credit note number copied!');
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>
                {creditNotes.length} credit note{creditNotes.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
            {showCreateButton && (
              <Button
                size="sm"
                onClick={() => {
                  setSelectedCreditNote(null);
                  setIsDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                New Credit Note
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
                    <TableHead>Amount</TableHead>
                    <TableHead>Used</TableHead>
                    <TableHead>Remaining</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Approval</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {creditNotes.map((cn) => (
                    <TableRow key={cn.id}>
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-2">
                          {cn.credit_note_number}
                          <button
                            onClick={() => handleCopyNumber(cn.credit_note_number)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(cn.credit_note_date), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell className="font-semibold">
                        ₹{cn.credit_amount.toFixed(2)}
                      </TableCell>
                      <TableCell>₹{cn.credit_used.toFixed(2)}</TableCell>
                      <TableCell className="font-semibold">
                        ₹{cn.credit_remaining.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={statusColors[cn.status]}
                        >
                          {cn.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={approvalColors[cn.approval_status]}
                        >
                          {cn.approval_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleViewDetails(cn)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CreditNoteDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSuccess={loadCreditNotes}
        creditNote={selectedCreditNote}
        dealerId={dealerId}
      />

      {selectedCreditNote && (
        <CreditNoteDetailsDialog
          isOpen={isDetailsDialogOpen}
          onOpenChange={setIsDetailsDialogOpen}
          creditNote={selectedCreditNote}
        />
      )}
    </>
  );
}
