"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import MultiSelect from '@/components/MultiSelect';
import { DialogFooter } from '@/components/ui/dialog';

interface Dealer {
  id: string;
  name: string;
}

interface ComboOfferDealerAssignmentProps {
  comboOfferId: string;
  onAssignmentsUpdated: () => void; // Callback to refresh parent data
}

const ComboOfferDealerAssignment: React.FC<ComboOfferDealerAssignmentProps> = ({ comboOfferId, onAssignmentsUpdated }) => {
  const [allDealers, setAllDealers] = useState<Dealer[]>([]);
  const [assignedDealerIds, setAssignedDealerIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchDealersAndAssignments = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all dealers
      const { data: dealersData, error: dealersError } = await supabase
        .from('dealers')
        .select('id, name')
        .order('name', { ascending: true });

      if (dealersError) throw dealersError;
      setAllDealers(dealersData || []);

      // Fetch current assignments for this combo offer
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('combo_offer_dealers')
        .select('dealer_id')
        .eq('combo_offer_id', comboOfferId);

      if (assignmentsError) throw assignmentsError;
      setAssignedDealerIds(assignmentsData?.map(item => item.dealer_id) || []);

    } catch (error: any) {
      console.error('Error fetching dealers and assignments:', error.message);
      showError(`Failed to load dealer assignments: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [comboOfferId]);

  useEffect(() => {
    fetchDealersAndAssignments();
  }, [fetchDealersAndAssignments]);

  const handleSaveAssignments = async () => {
    setIsSaving(true);
    try {
      // Fetch current assignments again to ensure we have the latest state
      const { data: currentAssignments, error: fetchError } = await supabase
        .from('combo_offer_dealers')
        .select('dealer_id')
        .eq('combo_offer_id', comboOfferId);

      if (fetchError) throw fetchError;
      const currentAssignedIds = new Set(currentAssignments?.map(item => item.dealer_id) || []);

      const newAssignedIdsSet = new Set(assignedDealerIds);

      const toAdd = assignedDealerIds.filter(id => !currentAssignedIds.has(id));
      const toRemove = Array.from(currentAssignedIds).filter(id => !newAssignedIdsSet.has(id));

      // Perform insertions
      if (toAdd.length > 0) {
        const { error: addError } = await supabase
          .from('combo_offer_dealers')
          .insert(toAdd.map(dealerId => ({ combo_offer_id: comboOfferId, dealer_id: dealerId })));
        if (addError) throw addError;
      }

      // Perform deletions
      if (toRemove.length > 0) {
        const { error: removeError } = await supabase
          .from('combo_offer_dealers')
          .delete()
          .eq('combo_offer_id', comboOfferId)
          .in('dealer_id', toRemove);
        if (removeError) throw removeError;
      }

      showSuccess('Dealer assignments updated successfully!');
      onAssignmentsUpdated(); // Notify parent to refresh
    } catch (error: any) {
      console.error('Error saving dealer assignments:', error.message);
      showError(`Failed to save assignments: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const dealerOptions = allDealers.map(dealer => ({
    value: dealer.id,
    label: dealer.name,
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading dealers...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="assignDealers">Assign Dealers</Label>
        <MultiSelect
          options={dealerOptions}
          value={assignedDealerIds}
          onChange={setAssignedDealerIds}
          placeholder="Select dealers to assign"
          className="w-full"
          disabled={isSaving}
        />
      </div>
      <DialogFooter>
        <Button onClick={handleSaveAssignments} disabled={isSaving}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save Assignments'}
        </Button>
      </DialogFooter>
    </div>
  );
};

export default ComboOfferDealerAssignment;