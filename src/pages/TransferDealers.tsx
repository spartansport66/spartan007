"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft, ArrowRight, Search } from 'lucide-react';
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
  currentSalesPersonId?: string;
  currentSalesPersonName?: string;
}

const TransferDealers = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: sessionLoading } = useSession();
  const [salesPersons, setSalesPersons] = useState<SalesPerson[]>([]);
  const [selectedState, setSelectedState] = useState<string>('');
  const [fromSalesPersonId, setFromSalesPersonId] = useState<string>('');
  const [toSalesPersonId, setToSalesPersonId] = useState<string>('');
  const [dealersByState, setDealersByState] = useState<Dealer[]>([]);
  const [dealersOfFromSalesPerson, setDealersOfFromSalesPerson] = useState<Dealer[]>([]);
  const [selectedDealerIds, setSelectedDealerIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTransferring, setIsTransferring] = useState(false);
  const [states, setStates] = useState<string[]>([]);
  const [searchMethod, setSearchMethod] = useState<'state' | 'sales_person'>('state');

  const fetchSalesPersons = useCallback(async () => {
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
    }
  }, []);

  const fetchStates = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('dealers')
        .select('state')
        .not('state', 'is', null);
      if (error) throw error;
      const uniqueStates = [...new Set((data || []).map(d => d.state).filter(Boolean))].sort() as string[];
      setStates(uniqueStates);
    } catch (error: any) {
      showError(`Failed to load states: ${error.message}`);
    }
  }, []);

  const fetchDealersByState = useCallback(async (state: string) => {
    if (!state) {
      setDealersByState([]);
      return;
    }
    setLoading(true);
    try {
      const { data: dealersData, error: dealersError } = await supabase
        .from('dealers')
        .select('id, name, city, state')
        .eq('state', state)
        .order('name');
      if (dealersError) throw dealersError;

      // Fetch current sales person assignment for each dealer
      const dealersWithSalesPerson = await Promise.all(
        (dealersData || []).map(async (dealer) => {
          const { data: spData } = await supabase
            .from('dealer_sales_persons')
            .select('sales_person_id')
            .eq('dealer_id', dealer.id)
            .maybeSingle();
          
          let currentSalesPersonId = '';
          let currentSalesPersonName = '';
          if (spData?.sales_person_id) {
            currentSalesPersonId = spData.sales_person_id;
            const person = salesPersons.find(sp => sp.id === spData.sales_person_id);
            if (person) {
              currentSalesPersonName = person.name;
            }
          }
          
          return {
            ...dealer,
            currentSalesPersonId,
            currentSalesPersonName,
          };
        })
      );

      setDealersByState(dealersWithSalesPerson);
    } catch (error: any) {
      showError(`Failed to load dealers: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [salesPersons]);

  const fetchDealersForSalesPerson = useCallback(async (salesPersonId: string) => {
    if (!salesPersonId) {
      setDealersOfFromSalesPerson([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('dealer_sales_persons')
        .select('dealer_id, dealers(id, name, city, state)')
        .eq('sales_person_id', salesPersonId);
      if (error) throw error;
      const dealers = (data || []).map((item: any) => item.dealers).filter(Boolean);
      setDealersOfFromSalesPerson(dealers);
    } catch (error: any) {
      showError(`Failed to load dealers: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading && !isAdmin) {
      showError('Access Denied.');
      navigate('/dashboard');
    } else if (!sessionLoading) {
      setLoading(true);
      Promise.all([fetchSalesPersons(), fetchStates()]).finally(() => setLoading(false));
    }
  }, [sessionLoading, isAdmin, navigate, fetchSalesPersons, fetchStates]);

  useEffect(() => {
    if (searchMethod === 'state') {
      fetchDealersByState(selectedState);
    } else {
      fetchDealersForSalesPerson(fromSalesPersonId);
    }
    setSelectedDealerIds([]); // Reset selection when search changes
  }, [selectedState, fromSalesPersonId, searchMethod, fetchDealersByState, fetchDealersForSalesPerson]);

  const handleSelectAll = (checked: boolean) => {
    const dealers = searchMethod === 'state' ? dealersByState : dealersOfFromSalesPerson;
    setSelectedDealerIds(checked ? dealers.map(d => d.id) : []);
  };

  const handleSelectDealer = (dealerId: string, checked: boolean) => {
    setSelectedDealerIds(prev => checked ? [...prev, dealerId] : prev.filter(id => id !== dealerId));
  };

  const handleTransfer = async () => {
    if (!toSalesPersonId || selectedDealerIds.length === 0) {
      showError('Please select a target sales person and at least one dealer.');
      return;
    }
    setIsTransferring(true);
    try {
      // Delete existing dealer-sales person assignments
      const { error: deleteError } = await supabase
        .from('dealer_sales_persons')
        .delete()
        .in('dealer_id', selectedDealerIds);
      if (deleteError) throw deleteError;

      // Create new dealer-sales person assignments
      const newAssignments = selectedDealerIds.map(dealerId => ({
        dealer_id: dealerId,
        sales_person_id: toSalesPersonId,
      }));

      const { error: insertError } = await supabase
        .from('dealer_sales_persons')
        .insert(newAssignments);
      if (insertError) throw insertError;

      showSuccess(`${selectedDealerIds.length} dealer(s) transferred to the selected sales person successfully!`);
      // Reset state
      setSelectedState('');
      setFromSalesPersonId('');
      setToSalesPersonId('');
      setSelectedDealerIds([]);
      setDealersByState([]);
      setDealersOfFromSalesPerson([]);
    } catch (error: any) {
      showError(`Transfer failed: ${error.message}`);
    } finally {
      setIsTransferring(false);
    }
  };

  const currentDealers = searchMethod === 'state' ? dealersByState : dealersOfFromSalesPerson;
  const isAllSelected = currentDealers.length > 0 && selectedDealerIds.length === currentDealers.length;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl">
        <Button variant="outline" onClick={() => navigate('/admin-dashboard')} className="mb-6 flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Admin Dashboard
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Transfer Dealers by State</CardTitle>
            <CardDescription>Search dealers by state and reassign them to a sales person.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3 pb-4 border-b">
              <Label>Search Method</Label>
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setSearchMethod('state');
                    setFromSalesPersonId('');
                  }}
                  className={`px-4 py-2 rounded-md transition ${
                    searchMethod === 'state'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  Search by State
                </button>
                <button
                  onClick={() => {
                    setSearchMethod('sales_person');
                    setSelectedState('');
                  }}
                  className={`px-4 py-2 rounded-md transition ${
                    searchMethod === 'sales_person'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  Search by Sales Person
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              {searchMethod === 'state' ? (
                <div className="space-y-2">
                  <Label>Select State</Label>
                  <Select value={selectedState} onValueChange={setSelectedState} disabled={loading}>
                    <SelectTrigger>
                      <Search className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Search by state..." />
                    </SelectTrigger>
                    <SelectContent>
                      {states.map(state => (
                        <SelectItem key={state} value={state}>{state}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>From Sales Person</Label>
                  <Select value={fromSalesPersonId} onValueChange={setFromSalesPersonId} disabled={loading}>
                    <SelectTrigger><SelectValue placeholder="Select a sales person" /></SelectTrigger>
                    <SelectContent>{salesPersons.map(sp => <SelectItem key={sp.id} value={sp.id}>{sp.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex justify-center items-center pt-6">
                <ArrowRight className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <Label>Transfer To Sales Person</Label>
                <Select value={toSalesPersonId} onValueChange={setToSalesPersonId} disabled={loading}>
                  <SelectTrigger><SelectValue placeholder="Select a sales person" /></SelectTrigger>
                  <SelectContent>{salesPersons.map(sp => <SelectItem key={sp.id} value={sp.id}>{sp.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {(selectedState || fromSalesPersonId) && (
              <div className="space-y-4">
                <h3 className="font-semibold">
                  {searchMethod === 'state' 
                    ? `Dealers in ${selectedState}` 
                    : `Dealers of ${salesPersons.find(sp => sp.id === fromSalesPersonId)?.name}`}
                </h3>
                {loading ? <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div> : (
                  <div className="max-h-96 overflow-y-auto border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12"><Checkbox checked={isAllSelected} onCheckedChange={handleSelectAll} /></TableHead>
                          <TableHead>Dealer Name</TableHead>
                          <TableHead>City</TableHead>
                          <TableHead>{searchMethod === 'state' ? 'Current Sales Person' : 'State'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentDealers.length === 0 ? (
                          <TableRow><TableCell colSpan={4} className="text-center">No dealers found.</TableCell></TableRow>
                        ) : (
                          currentDealers.map(dealer => (
                            <TableRow key={dealer.id}>
                              <TableCell><Checkbox checked={selectedDealerIds.includes(dealer.id)} onCheckedChange={checked => handleSelectDealer(dealer.id, !!checked)} /></TableCell>
                              <TableCell>{dealer.name}</TableCell>
                              <TableCell>{dealer.city || 'N/A'}</TableCell>
                              <TableCell>{searchMethod === 'state' ? (dealer.currentSalesPersonName || 'Unassigned') : (dealer.state || 'N/A')}</TableCell>
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
              disabled={isTransferring || !toSalesPersonId || selectedDealerIds.length === 0 || (!selectedState && !fromSalesPersonId)}
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