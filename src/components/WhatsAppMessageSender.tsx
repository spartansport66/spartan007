"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, MessageCircle, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import MultiSelect from '@/components/MultiSelect';
import { Input } from '@/components/ui/input';

interface ComboOffer {
  id: string;
  name: string;
  description: string | null;
}

interface DealerOption {
  value: string;
  label: string;
  phone: string;
  city: string;
  state: string;
}

interface WhatsAppMessageSenderProps {
  allRawDealers: DealerOption[];
  comboOffers: ComboOffer[];
  selectedDealerIds: string[];
  setSelectedDealerIds: (ids: string[]) => void;
  selectedOfferId: string;
  setSelectedOfferId: (id: string) => void;
  whatsappMessage: string;
  setWhatsappMessage: (message: string) => void;
  filterCity: string;
  setFilterCity: (city: string) => void;
  filterState: string;
  setFilterState: (state: string) => void;
  isSending: boolean;
  companyName: string | null;
  initialLoading: boolean;
  filteredDealersForMultiSelect: DealerOption[];
  handleClearFilters: () => void;
}

const WhatsAppMessageSender: React.FC<WhatsAppMessageSenderProps> = ({
  allRawDealers,
  comboOffers,
  selectedDealerIds,
  setSelectedDealerIds,
  selectedOfferId,
  setSelectedOfferId,
  whatsappMessage,
  setWhatsappMessage,
  filterCity,
  setFilterCity,
  filterState,
  setFilterState,
  isSending,
  companyName,
  initialLoading,
  filteredDealersForMultiSelect,
  handleClearFilters,
}) => {
  // Dynamically generate WhatsApp message based on selected offer
  useEffect(() => {
    if (selectedOfferId) {
      const offer = comboOffers.find(o => o.id === selectedOfferId);
      if (offer) {
        const message = `Hello [DEALER_NAME],\n\n*${companyName || 'Our Company'}* is excited to announce a new Combo Offer: *"${offer.name}"*!\n\n${offer.description ? `Details: ${offer.description}\n\n` : ''}\n\nThank you!`;
        setWhatsappMessage(message);
      }
    } else {
      if (whatsappMessage.startsWith(`Hello [DEALER_NAME],\n\n*${companyName || 'Our Company'}*`)) {
        setWhatsappMessage('');
      }
    }
  }, [selectedOfferId, comboOffers, companyName, setWhatsappMessage]);

  const handleSelectAll = () => {
    const allFilteredIds = filteredDealersForMultiSelect.map(d => d.value);
    setSelectedDealerIds(allFilteredIds);
  };

  const handleDeselectAll = () => {
    setSelectedDealerIds([]);
  };

  return (
    <Card className="bg-card text-card-foreground shadow-lg h-full">
      <CardHeader className="bg-blue-600 dark:bg-blue-800 text-white rounded-t-lg p-4">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <MessageCircle className="h-6 w-6" /> Prepare WhatsApp Offer
        </CardTitle>
        <CardDescription className="text-blue-100 dark:text-blue-200">
          Filter dealers, select an offer, and preview your personalized message.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {initialLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading data...</p>
          </div>
        ) : (
          <>
            {/* Dealer Filters */}
            <div className="flex flex-wrap items-end gap-4 p-3 border rounded-md bg-muted/50">
              <div className="flex-1 min-w-[120px]">
                <Label htmlFor="filterCity">Filter by City</Label>
                <Input
                  id="filterCity"
                  placeholder="e.g., Mumbai"
                  value={filterCity}
                  onChange={(e) => setFilterCity(e.target.value)}
                  disabled={isSending}
                />
              </div>
              <div className="flex-1 min-w-[120px]">
                <Label htmlFor="filterState">Filter by State</Label>
                <Input
                  id="filterState"
                  placeholder="e.g., Maharashtra"
                  value={filterState}
                  onChange={(e) => setFilterState(e.target.value)}
                  disabled={isSending}
                />
              </div>
              <Button onClick={handleClearFilters} variant="outline" disabled={isSending}>
                Clear Filters
              </Button>
            </div>

            {/* Select All/Deselect All Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={handleSelectAll}
                variant="outline"
                size="sm"
                disabled={isSending || filteredDealersForMultiSelect.length === 0}
              >
                Select All Filtered
              </Button>
              <Button
                onClick={handleDeselectAll}
                variant="outline"
                size="sm"
                disabled={isSending || selectedDealerIds.length === 0}
              >
                Deselect All
              </Button>
            </div>

            {/* Multi-Select Dealers */}
            <div className="space-y-2">
              <Label htmlFor="selectDealers">Select Dealers</Label>
              <MultiSelect
                options={filteredDealersForMultiSelect.map(d => ({ value: d.value, label: d.label }))}
                value={selectedDealerIds}
                onChange={setSelectedDealerIds}
                placeholder="Select dealers"
                className="max-h-[120px] overflow-y-auto" {/* Added max-h and overflow-y-auto */}
                disabled={isSending || filteredDealersForMultiSelect.length === 0}
              />
              {filteredDealersForMultiSelect.length === 0 && (
                <p className="text-sm text-muted-foreground">No dealers found matching your filters.</p>
              )}
            </div>

            {/* Select Combo Offer */}
            <div>
              <Label htmlFor="selectOffer">Select Combo Offer</Label>
              <Select value={selectedOfferId} onValueChange={setSelectedOfferId} disabled={comboOffers.length === 0 || isSending}>
                <SelectTrigger id="selectOffer">
                  <SelectValue placeholder={comboOffers.length === 0 ? "No active offers available" : "Select an offer"} />
                </SelectTrigger>
                <SelectContent>
                  {comboOffers.map(offer => (
                    <SelectItem key={offer.id} value={offer.id}>
                      {offer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* WhatsApp Message Preview */}
            <div>
              <Label htmlFor="whatsappMessage">WhatsApp Message Preview</Label>
              <Textarea
                id="whatsappMessage"
                value={whatsappMessage}
                onChange={(e) => setWhatsappMessage(e.target.value)}
                rows={8}
                placeholder="Your dynamic message will appear here..."
                className="resize-y"
                disabled={isSending || !selectedOfferId}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default WhatsAppMessageSender;