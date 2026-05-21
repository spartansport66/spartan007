"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Eye, Copy, Trash2, Search, X } from 'lucide-react';
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

interface Dealer {
  id: string;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
}

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
  const [allDealers, setAllDealers] = useState<Dealer[]>([]);
  const [dealerSearchQuery, setDealerSearchQuery] = useState('');
  const [selectedDealerForFilter, setSelectedDealerForFilter] = useState<Dealer | null>(null);
  const [showDealerDropdown, setShowDealerDropdown] = useState(false);

  useEffect(() => {
    loadDealers();
    loadCreditNotes();
  }, [dealerId, companyId]);

  const loadDealers = async () => {
    try {
      const { data, error } = await supabase
        .from('dealers')
        .select('id, name, contact_person, phone, email')
        .order('name', { ascending: true });

      if (error) throw error;
      setAllDealers(data || []);
    } catch (err) {
      console.error('Error loading dealers:', err);
    }
  };

  const filteredDealers = allDealers.filter((dealer) =>
    dealer.name.toLowerCase().includes(dealerSearchQuery.toLowerCase()) ||
    dealer.contact_person?.toLowerCase().includes(dealerSearchQuery.toLowerCase()) ||
    dealer.phone?.includes(dealerSearchQuery)
  );

  const loadCreditNotes = async () => {
    setLoading(true);
    try {
      let query = supabase.from('credit_notes').select('*');

      if (selectedDealerForFilter) {
        query = query.eq('dealer_id', selectedDealerForFilter.id);
      } else if (dealerId) {
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

  const handleDelete = async (creditNoteId: string) => {
    if (!window.confirm('Are you sure you want to delete this credit note?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('credit_notes')
        .delete()
        .eq('id', creditNoteId);

      if (error) throw error;
      loadCreditNotes();
      showError('Credit note deleted successfully!');
    } catch (err) {
      console.error('Error deleting credit note:', err);
      showError('Failed to delete credit note');
    }
  };

  const handleCopyNumber = (number: string) => {
    navigator.clipboard.writeText(number);
    showError('Credit note number copied!');
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center mb-4">
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

          {/* Dealer Search */}
          {!dealerId && (
            <div className="relative">
              <Label htmlFor="dealer-search" className="text-xs mb-2 block">Search Dealer</Label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="dealer-search"
                    type="text"
                    placeholder="Search by name, contact, or phone..."
                    value={dealerSearchQuery}
                    onChange={(e) => setDealerSearchQuery(e.target.value)}
                    onFocus={() => setShowDealerDropdown(true)}
                    className="pl-10"
                  />
                </div>
                {selectedDealerForFilter && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedDealerForFilter(null);
                      setDealerSearchQuery('');
                      loadCreditNotes();
                    }}
                    className="text-gray-500 hover:text-red-600"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Dropdown List */}
              {showDealerDropdown && dealerSearchQuery.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {filteredDealers.length > 0 ? (
                    <ul className="py-1">
                      {filteredDealers.map((dealer) => (
                        <li
                          key={dealer.id}
                          onClick={() => {
                            setSelectedDealerForFilter(dealer);
                            setDealerSearchQuery('');
                            setShowDealerDropdown(false);
                            loadCreditNotes();
                          }}
                          className="px-4 py-2 cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          <p className="font-medium text-gray-900 dark:text-white">{dealer.name}</p>
                          {dealer.contact_person && (
                            <p className="text-xs text-gray-600 dark:text-gray-400">Contact: {dealer.contact_person}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="px-4 py-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                      No dealers found
                    </div>
                  )}
                </div>
              )}

              {/* Selected Dealer Badge */}
              {selectedDealerForFilter && (
                <div className="mt-2">
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    Filtering: {selectedDealerForFilter.name}
                  </Badge>
                </div>
              )}
            </div>
          )}
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
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewDetails(cn)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(cn.id)}
                            className="hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
