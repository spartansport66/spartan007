"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, MessageCircle, Send, Users, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import MultiSelect from '@/components/MultiSelect';
import { Checkbox } from '@/components/ui/checkbox';
import { useSession } from '@/contexts/SessionContext';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// IMPORTANT: Replace with the actual URL of your deployed Edge Function
const SEND_WHATSAPP_MESSAGE_EDGE_FUNCTION_URL = "https://hxftiocfihhdutciaisl.supabase.co/functions/v1/send-whatsapp-message";

interface Product {
  id: string;
  name: string;
  price: number;
}

interface Dealer {
  id: string;
  name: string;
  phone: string;
  city: string;
  state: string;
}

interface ComboOffer {
  id: string;
  name: string;
  description: string | null;
  dealers: Dealer[];
}

interface DealerOption {
  value: string;
  label: string;
  phone: string;
  city: string;
  state: string;
}

interface SendWhatsAppOfferCardProps {
  onMessageSent: () => void;
}

const SendWhatsAppOfferCard: React.FC<SendWhatsAppOfferCardProps> = ({ onMessageSent }) => {
  const { user } = useSession();
  const [allRawDealers, setAllRawDealers] = useState<DealerOption[]>([]);
  const [comboOffers, setComboOffers] = useState<ComboOffer[]>([]);
  const [selectedDealerIds, setSelectedDealerIds] = useState<string[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState<string>('');
  const [whatsappMessage, setWhatsappMessage] = useState<string>('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [sendToAllDealers, setSendToAllDealers] = useState(false);
  const [companyName, setCompanyName] = useState<string | null>(null);

  // Filter states
  const [filterCity, setFilterCity] = useState<string>('');
  const [filterState, setFilterState] = useState<string>('');
  const [filteredDealersForTable, setFilteredDealersForTable] = useState<DealerOption[]>([]);

  console.log('SendWhatsAppOfferCard Render - isSending:', isSending, 'selectedOfferId:', selectedOfferId);

  const fetchInitialData = useCallback(async () => {
    setInitialLoading(true);
    try {
      const { data: dealersData, error: dealersError } = await supabase
        .from('dealers')
        .select('id, name, phone, city, state');
      if (dealersError) throw dealersError;
      setAllRawDealers((dealersData || []).map(d => ({ 
        value: d.id, 
        label: `${d.name} (${d.phone || 'No Phone'})`, 
        phone: d.phone || '',
        city: d.city || 'N/A',
        state: d.state || 'N/A',
      })));

      const { data: offersData, error: offersError } = await supabase
        .from('combo_offers')
        .select(`
          id,
          name,
          description,
          combo_offer_dealers(dealers(id, name, phone, city, state))
        `)
        .order('name', { ascending: true });

      if (offersError) throw offersError;
      const formattedOffers: ComboOffer[] = (offersData || []).map((offer: any) => ({
        id: offer.id,
        name: offer.name,
        description: offer.description,
        dealers: offer.combo_offer_dealers.map((cod: any) => cod.dealers),
      }));
      setComboOffers(formattedOffers);

      const { data: companyInfo, error: companyInfoError } = await supabase
        .from('company_info')
        .select('company_name')
        .limit(1)
        .single();
      if (companyInfoError && companyInfoError.code !== 'PGRST116') throw companyInfoError;
      setCompanyName(companyInfo?.company_name || null);

    } catch (error: any) {
      console.error('Error fetching initial data for WhatsApp card:', error.message);
      showError(`Failed to load data: ${error.message}`);
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    let currentDealers: DealerOption[] = [];
    if (selectedOfferId) {
      const selectedOffer = comboOffers.find(o => o.id === selectedOfferId);
      if (selectedOffer) {
        const assignedDealerIds = new Set(selectedOffer.dealers.map(d => d.id));
        currentDealers = allRawDealers.filter(d => assignedDealerIds.has(d.value));
      }
    } else {
      currentDealers = allRawDealers;
    }

    const filtered = currentDealers.filter(dealer => {
      const matchesCity = filterCity ? dealer.city.toLowerCase().includes(filterCity.toLowerCase()) : true;
      const matchesState = filterState ? dealer.state.toLowerCase().includes(filterState.toLowerCase()) : true;
      return matchesCity && matchesState;
    });
    setFilteredDealersForTable(filtered);
  }, [selectedOfferId, comboOffers, allRawDealers, filterCity, filterState]);

  useEffect(() => {
    if (selectedOfferId) {
      const offer = comboOffers.find(o => o.id === selectedOfferId);
      if (offer) {
        const message = `Hello Dealer,\n\n*${companyName || 'Our Company'}* is excited to announce a new Combo Offer: *"${offer.name}"*!\n\n${offer.description ? `Details: ${offer.description}\n\n` : ''}Contact your sales person for more details.\n\nThank you!`;
        setWhatsappMessage(message);
      }
    } else {
      setWhatsappMessage('');
    }
  }, [selectedOfferId, comboOffers, companyName]);

  const handleSendWhatsApp = async (targetDealerIds: string[]) => {
    if (!user) {
      showError('You must be logged in to send WhatsApp messages.');
      return;
    }
    if (!selectedOfferId) {
      showError('Please select a combo offer.');
      return;
    }
    if (!whatsappMessage.trim()) {
      showError('WhatsApp message cannot be empty.');
      return;
    }

    if (targetDealerIds.length === 0) {
      showError('No dealers selected or filtered to send messages to.');
      return;
    }

    console.log('handleSendWhatsApp called. Setting isSending to true.');
    setIsSending(true);
    try {
      const response = await fetch(SEND_WHATSAPP_MESSAGE_EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dealerIds: targetDealerIds,
          message: whatsappMessage,
          comboOfferId: selectedOfferId,
          sentByUserId: user.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send WhatsApp messages');
      }

      showSuccess('WhatsApp messages prepared. Please check new tabs to send them manually.');
      data.results.forEach((result: any) => {
        if (result.status === 'success' && result.url) {
          window.open(result.url, '_blank');
        }
      });

      setSelectedDealerIds([]);
      setSendToAllDealers(false);
      onMessageSent();
    } catch (error: any) {
      console.error('Error sending WhatsApp messages:', error);
      showError(`Failed to send WhatsApp messages: ${error.message}`);
    } finally {
      console.log('handleSendWhatsApp finally block. Setting isSending to false.');
      setIsSending(false);
    }
  };

  const handleBulkSend = () => {
    const dealerIdsToSend = filteredDealersForTable.map(d => d.value);
    handleSendWhatsApp(dealerIdsToSend);
  };

  const handleIndividualSend = (dealerId: string) => {
    handleSendWhatsApp([dealerId]);
  };

  const handleClearFilters = () => {
    setFilterCity('');
    setFilterState('');
  };

  return (
    <Card className="bg-card text-card-foreground shadow-lg h-full">
      <CardHeader className="bg-blue-600 dark:bg-blue-800 text-white rounded-t-lg p-4">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <MessageCircle className="h-6 w-6" /> Send WhatsApp Offer
        </CardTitle>
        <CardDescription className="text-blue-100 dark:text-blue-200">
          Select an offer and dealers to send a personalized WhatsApp message.
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

            {selectedOfferId && (
              <>
                <div className="flex flex-wrap items-end gap-4 mb-4 p-3 border rounded-md bg-muted/50">
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

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="sendToAllDealers"
                      checked={sendToAllDealers}
                      onCheckedChange={(checked) => {
                        setSendToAllDealers(!!checked);
                        if (!!checked) {
                          setSelectedDealerIds([]);
                        }
                      }}
                      disabled={isSending || filteredDealersForTable.length === 0}
                    />
                    <Label htmlFor="sendToAllDealers" className="text-base font-medium flex items-center gap-2">
                      <Users className="h-4 w-4" /> Send to All {filteredDealersForTable.length} Filtered Dealers
                    </Label>
                  </div>
                  {!sendToAllDealers && (
                    <>
                      <Label htmlFor="selectDealers">Select Specific Dealers from Filtered List</Label>
                      <MultiSelect
                        options={filteredDealersForTable.map(d => ({ value: d.value, label: d.label }))}
                        value={selectedDealerIds}
                        onChange={setSelectedDealerIds}
                        placeholder="Select dealers"
                        disabled={isSending || filteredDealersForTable.length === 0}
                      />
                    </>
                  )}
                </div>

                <div className="overflow-x-auto max-h-[300px] overflow-y-auto border rounded-md">
                  {filteredDealersForTable.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">No dealers found matching criteria for this offer.</p>
                  ) : (
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow className="bg-muted hover:bg-muted/90">
                          <TableHead className="text-muted-foreground">Dealer Name</TableHead>
                          <TableHead className="text-muted-foreground">Phone</TableHead>
                          <TableHead className="text-muted-foreground">City</TableHead>
                          <TableHead className="text-muted-foreground">State</TableHead>
                          <TableHead className="text-muted-foreground text-center">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredDealersForTable.map((dealer) => (
                          <TableRow key={dealer.value} className="hover:bg-accent/50">
                            <TableCell className="font-medium text-foreground">{dealer.label.split('(')[0].trim()}</TableCell>
                            <TableCell className="text-muted-foreground">{dealer.phone || 'N/A'}</TableCell>
                            <TableCell className="text-muted-foreground">{dealer.city}</TableCell>
                            <TableCell className="text-muted-foreground">{dealer.state}</TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleIndividualSend(dealer.value)}
                                title={`Send to ${dealer.label.split('(')[0].trim()}`}
                                disabled={isSending || !dealer.phone}
                              >
                                <Send className="h-4 w-4 text-blue-500" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>

                <div>
                  <Label htmlFor="whatsappMessage">WhatsApp Message Preview</Label>
                  <Textarea
                    id="whatsappMessage"
                    value={whatsappMessage}
                    onChange={(e) => setWhatsappMessage(e.target.value)}
                    rows={8}
                    placeholder="Your dynamic message will appear here..."
                    className="resize-y"
                    disabled={isSending}
                  />
                </div>

                <Button
                  onClick={handleBulkSend}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                  disabled={isSending || !selectedOfferId || (filteredDealersForTable.length === 0) || !whatsappMessage.trim()}
                >
                  {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {isSending ? 'Preparing Messages...' : `Send to All ${filteredDealersForTable.length} Filtered Dealers`}
                </Button>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default SendWhatsAppOfferCard;