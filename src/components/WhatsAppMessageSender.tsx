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
  currentBalance: number; // Added for balance due filtering and message
  oldestDueDate: string | null; // Added for balance due filtering and message
  lastBillingDate: string | null; // New: last_billing_date from dealers table
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
  messageType: 'combo_offer' | 'balance_due'; // New prop
  setMessageType: (type: 'combo_offer' | 'balance_due') => void; // New prop
  balanceDuePeriodFilter: 'all' | '1_month' | '3_months' | '6_months'; // New prop
  setBalanceDuePeriodFilter: (filter: 'all' | '1_month' | '3_months' | '6_months') => void; // New prop
}

const indianStates = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Lakshadweep", "Puducherry"
];

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
  messageType, // Destructure new props
  setMessageType, // Destructure new props
  balanceDuePeriodFilter, // Destructure new props
  setBalanceDuePeriodFilter, // Destructure new props
}) => {
  // Dynamically generate WhatsApp message based on selected offer or balance due
  useEffect(() => {
    if (messageType === 'combo_offer') {
      if (selectedOfferId) {
        const offer = comboOffers.find(o => o.id === selectedOfferId);
        if (offer) {
          const message = `Hello [DEALER_NAME],\n\n*${companyName || 'Our Company'}* is excited to announce a new Combo Offer: *"${offer.name}"*!\n\n${offer.description ? `Details: ${offer.description}\n\n` : ''}\n\nThank you!`;
          setWhatsappMessage(message);
        } else {
          setWhatsappMessage('');
        }
      } else {
        setWhatsappMessage('');
      }
    } else if (messageType === 'balance_due') {
      // For balance due, the message will be personalized per dealer in handleIndividualSendWhatsApp
      // Set a generic template here for preview
      setWhatsappMessage(`Dear [DEALER_NAME],\n\nThis is a reminder from *${companyName || 'Our Company'}* that your current outstanding balance is *₹[CURRENT_BALANCE]*, due from *[OLDEST_DUE_DATE]*. Please clear your balance as soon as possible.\n\nThank you!`);
    }
  }, [selectedOfferId, comboOffers, companyName, setWhatsappMessage, messageType]);

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
          <MessageCircle className="h-6 w-6" /> Prepare WhatsApp Message
        </CardTitle>
        <CardDescription className="text-blue-100 dark:text-blue-200">
          Filter dealers, select message type, and preview your personalized message.
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
            {/* Message Type Selector */}
            <div>
              <Label htmlFor="messageType">Message Type</Label>
              <Select value={messageType} onValueChange={setMessageType} disabled={isSending}>
                <SelectTrigger id="messageType">
                  <SelectValue placeholder="Select message type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="combo_offer">Combo Offer</SelectItem>
                  <SelectItem value="balance_due">Balance Due Reminder</SelectItem>
                </SelectContent>
              </Select>
            </div>

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
                <Select
                  value={filterState || "all"} // Set default value to "all" if filterState is empty
                  onValueChange={(value) => setFilterState(value === "all" ? "" : value)} // Convert "all" back to ""
                  disabled={isSending}
                >
                  <SelectTrigger id="filterState" className="w-full">
                    <SelectValue placeholder="Select a state" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All States</SelectItem> {/* Changed value to "all" */}
                    {indianStates.map((state) => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {messageType === 'balance_due' && (
                <div className="flex-1 min-w-[150px]">
                  <Label htmlFor="balanceDuePeriodFilter">Balance Due Period</Label>
                  <Select value={balanceDuePeriodFilter} onValueChange={setBalanceDuePeriodFilter} disabled={isSending}>
                    <SelectTrigger id="balanceDuePeriodFilter" className="w-full">
                      <SelectValue placeholder="Select due period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Dealers (with balance)</SelectItem>
                      <SelectItem value="1_month">Over 1 Month Due</SelectItem>
                      <SelectItem value="3_months">Over 3 Months Due</SelectItem>
                      <SelectItem value="6_months">Over 6 Months Due</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
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
              {/* Added max-h and overflow-y-auto for MultiSelect */}
              <MultiSelect
                options={filteredDealersForMultiSelect.map(d => ({ value: d.value, label: d.label }))}
                value={selectedDealerIds}
                onChange={setSelectedDealerIds}
                placeholder="Select dealers"
                className="max-h-[120px] overflow-y-auto" 
                disabled={isSending || filteredDealersForMultiSelect.length === 0}
              />
              {filteredDealersForMultiSelect.length === 0 && (
                <p className="text-sm text-muted-foreground">No dealers found matching your filters.</p>
              )}
            </div>

            {/* Select Combo Offer (only if messageType is combo_offer) */}
            {messageType === 'combo_offer' && (
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
            )}

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
                disabled={isSending || (messageType === 'combo_offer' && !selectedOfferId)}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default WhatsAppMessageSender;