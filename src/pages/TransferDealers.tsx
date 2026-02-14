"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { useSession } from '@/contexts/SessionContext';
import { MadeWithDyad } from '@/components/made-with-dyad';

interface SalesPerson {
  id: string;
  name: string;
}

interface Dealer {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
}

const TransferDealers = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: sessionLoading } = useSession();
  const [salesPersons, setSalesPersons] = useState<SalesPerson[]>([]);
  const [fromSalesPersonId, setFromSalesPersonId] = useState<string>('');
  const [toSalesPersonId, setToSalesPersonId] = useState<string>('');
  const [dealersOfFromSalesPerson, setDealersOfFromSalesPerson] = useState<Dealer[]>([]);
  const [selectedDealerIds, setSelectedDealerIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTransferring, setIsTransferring] = useState(false);

  const fetchSalesPersons = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('user_type', 'sales_person')
        .order('first_name');
      if (error) throw error;
      setSalesPersons((data || []).map(p => ({ id: p.id, name: `${p.first_name} ${p.last_name || ''}`.trim() })));
    } catch (error: any) {
      showError(`Failed to load sales persons: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading && !isAdmin) {
      showError('Access Denied.');
      navigate('/dashboard');
    } else if (!sessionLoading) {
      fetchSalesPersons();
    }
  }, [sessionLoading, isAdmin, navigate, fetchSalesPersons]);

  const fetchDealersForSalesPerson = useCallback(async (salesPersonId: string) => {
    if (!salesPersonId) {
      setDealersOfFromSalesPerson([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('dealer_sales_persons')
        .select('dealers(id, name, city, state)')
        .eq('sales_person_id', salesPersonId);
      if (error) throw error;
      setDealersOfFromSalesPerson((data || []).map((item: any) => item.dealers).filter(Boolean));
    } catch (error: any) {
      showError(`Failed to load dealers: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDealersForSalesPerson(fromSalesPersonId);
    setSelectedDealerIds([]); // Reset selection when 'from' person changes
  }, [fromSalesPersonId, fetchDealersForSalesPerson]);

  const handleSelectAll = (checked: boolean) => {
    setSelectedDealerIds(checked ? dealersOfFromSalesPerson.map(d => d.id) : []);
  };

  const handleSelectDealer = (dealerId: string, checked: boolean) => {
    setSelectedDealerIds(prev => checked ? [...prev, dealerId] : prev.filter(id => id !== dealerId));
  };

  const handleTransfer = async () => {
    if (!fromSalesPersonId || !toSalesPersonId || selectedDealerIds.length === 0 || fromSalesPersonId === toSalesPersonId) {
      showError('Please make sure you have selected a different "From" and "To" salesperson and at least one dealer.');
      return;
    }
    setIsTransferring(true);
    try {
      const { error } = await supabase
        .from('dealer_sales_persons')
        .update({ sales_person_id: toSalesPersonId })
        .eq('sales_person_id', fromSalesPersonId)
        .in('dealer_id', selectedDealerIds);
      if (error) throw error;
      showSuccess(`${selectedDealerIds.length} dealer(s) transferred successfully!`);
      // Reset state
      setFromSalesPersonId('');
      setToSalesPersonId('');
      setSelectedDealerIds([]);
      setDealersOfFromSalesPerson([]);
    } catch (error: any) {
      showError(`Transfer failed: ${error.message}`);
    } finally {
      setIsTransferring(false);
    }
  };

  const isAllSelected = dealersOfFromSalesPerson.length > 0 && selectedDealerIds.length === dealersOfFromSalesPerson.length;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl">
        <Button variant="outline" onClick={() => navigate('/admin-dashboard')} className="mb-6 flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Admin Dashboard
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Transfer Dealers</CardTitle>
            <CardDescription>Reassign dealers from one sales person to another.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div className="space-y-2">
                <Label>From Sales Person</Label>
                <Select value={fromSalesPersonId} onValueChange={setFromSalesPersonId} disabled={loading}>
                  <SelectTrigger><SelectValue placeholder="Select a sales person" /></SelectTrigger>
                  <SelectContent>{salesPersons.map(sp => <SelectItem key={sp.id} value={sp.id}>{sp.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex justify-center items-center pt-6">
                <ArrowRight className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <Label>To Sales Person</Label>
                <Select value={toSalesPersonId} onValueChange={setToSalesPersonId} disabled={loading}>
                  <SelectTrigger><SelectValue placeholder="Select a sales person" /></SelectTrigger>
                  <SelectContent>{salesPersons.filter(sp => sp.id !== fromSalesPersonId).map(sp => <SelectItem key={sp.id} value={sp.id}>{sp.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {fromSalesPersonId && (
              <div className="space-y-4">
                <h3 className="font-semibold">Dealers Assigned to {salesPersons.find(sp => sp.id === fromSalesPersonId)?.name}</h3>
                {loading ? <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div> : (
                  <div className="max-h-96 overflow-y-auto border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12"><Checkbox checked={isAllSelected} onCheckedChange={handleSelectAll} /></TableHead>
                          <TableHead>Dealer Name</TableHead>
                          <TableHead>City</TableHead>
                          <TableHead>State</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dealersOfFromSalesPerson.length === 0 ? (
                          <TableRow><TableCell colSpan={4} className="text-center">No dealers assigned.</TableCell></TableRow>
                        ) : (
                          dealersOfFromSalesPerson.map(dealer => (
                            <TableRow key={dealer.id}>
                              <TableCell><Checkbox checked={selectedDealerIds.includes(dealer.id)} onCheckedChange={checked => handleSelectDealer(dealer.id, !!checked)} /></TableCell>
                              <TableCell>{dealer.name}</TableCell>
                              <TableCell>{dealer.city || 'N/A'}</TableCell>
                              <TableCell>{dealer.state || 'N/A'}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}

            <Button
              onClick={handleTransfer}
              disabled={isTransferring || !fromSalesPersonId || !toSalesPersonId || selectedDealerIds.length === 0}
              className="w-full"
            >
              {isTransferring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Transfer {selectedDealerIds.length} Dealer(s)
            </Button>
          </CardContent>
        </Card>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default TransferDealers;