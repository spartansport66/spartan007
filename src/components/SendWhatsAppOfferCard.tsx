"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, MessageCircle, Send, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import MultiSelect from '@/components/MultiSelect';
import { Checkbox } from '@/components/ui/checkbox';
import { useSession } from '@/contexts/SessionContext';

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
}

interface ComboOffer {
  id: string;
  name: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  start_date: string;
  end_date: string;
  products: Product[]; // Nested products
  dealers: Dealer[]; // Nested dealers (all dealers assigned to this offer)
}

interface DealerOption {
  value: string;
  label: string;
  phone: string;
}

interface SendWhatsAppOfferCardProps {
  onMessageSent: () => void; // Callback to refresh sent logs
}

const SendWhatsAppOfferCard: React.FC<SendWhatsAppOfferCardProps> = ({ onMessageSent }) => {
  const { user } = useSession();
  const [allDealers, setAllDealers] = useState<DealerOption[]>([]);
  const [comboOffers, setComboOffers] = useState<ComboOffer[]>([]);
  const [selectedDealerIds, setSelectedDealerIds] = useState<string[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState<string>('');
  const [whatsappMessage, setWhatsappMessage] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [sendToAllDealers, setSendToAllDealers] = useState(false);
  const [companyName, setCompanyName] = useState<string | null>(null);

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all dealers
      const { data: dealersData, error: dealersError } = await supabase
        .from('dealers')
        .select('id, name, phone');
      if (dealersError) throw dealersError;
      setAllDealers((dealersData || []).map(d => ({ value: d.id, label: `${d.name} (${d.phone || 'No Phone'})`, phone: d.phone || '' })));

      // Fetch all active combo offers with their products and assigned dealers
      const { data: offersData, error: offersError } = await supabase
        .from('combo_offers')
        .select(`
          id,
          name,
          description,
          discount_type,
          discount_value,
          start_date,
          end_date,
          combo_offer_products(products(id, name, price)),
          combo_offer_dealers(dealers(id, name, phone))
        `)
        .gte('end_date', new Date().toISOString().split('T')[0]) // Only active offers
        .order('name', { ascending: true });

      if (offersError) throw offersError;
      const formattedOffers: ComboOffer[] = (offersData || []).map((offer: any) => ({
        id: offer.id,
        name: offer.name,
        description: offer.description,
        discount_type: offer.discount_type,
        discount_value: offer.discount_value,
        start_date: offer.start_date,
        end_date: offer.end_date,
        products: offer.combo_offer_products.map((cop: any) => cop.products),
        dealers: offer.combo_offer_dealers.map((cod: any) => cod.dealers),
      }));
      setComboOffers(formattedOffers);

      // Fetch company name for message template
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
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Dynamically generate WhatsApp message
  useEffect(() => {
    if (selectedOfferId) {
      const offer = comboOffers.find(o => o.id === selectedOfferId);
      if (offer) {
        const discountText = offer.discount_type === 'percentage'
          ? `${offer.discount_value}% discount`
          : `₹${offer.discount_value.toFixed(2)} off`;
        const productsList = offer.products.map(p => p.name).join(', ');
        const validity = `${new Date(offer.start_date).toLocaleDateString()} to ${new Date(offer.end_date).toLocaleDateString()}`;
        
        const message = `Hello Dealer,\n\n*${companyName || 'Our Company'}* is excited to announce a new Combo Offer: *"${offer.name}"*!\n\nDetails:\n- *Discount:* ${discountText}\n- *Products Included:* ${productsList}\n- *Validity:* ${validity}\n\nDon't miss out on this amazing deal! Contact your sales person for more details.\n\nThank you!`;
        setWhatsappMessage(message);
      }
    } else {
      setWhatsappMessage('');
    }
  }, [selectedOfferId, comboOffers, companyName]);

  const handleSendWhatsApp = async () => {
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

    let targetDealerIds = selectedDealerIds;
    if (sendToAllDealers) {
      targetDealerIds = allDealers.map(d => d.value);
    }

    if (targetDealerIds.length === 0) {
      showError('Please select at least one dealer or choose to send to all dealers.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(SEND_WHATSAPP_MESSAGE_EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dealerIds: targetDealerIds,
          message: whatsappMessage,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send WhatsApp messages');
      }

      // Log each sent message to the database
      for (const result of data.results) {
        if (result.status === 'success') {
          await supabase.from('whatsapp_sent_logs').insert({
            combo_offer_id: selectedOfferId,
            dealer_id: result.dealerId,
            message_content: whatsappMessage,
            sent_by: user.id,
          });
        }
      }

      showSuccess('WhatsApp messages prepared. Please check new tabs to send them manually.');
      // Open WhatsApp Web for each successful message
      data.results.forEach((result: any) => {
        if (result.status === 'success' && result.url) {
          window.open(result.url, '_blank');
        }
      });

      setSelectedDealerIds([]);
      setSelectedOfferId('');
      setWhatsappMessage('');
      setSendToAllDealers(false);
      onMessageSent(); // Notify parent to refresh sent logs
    } catch (error: any) {
      console.error('Error sending WhatsApp messages:', error);
      showError(`Failed to send WhatsApp messages: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredDealerOptions = allDealers.filter(dealer => {
    const selectedOffer = comboOffers.find(o => o.id === selectedOfferId);
    if (!selectedOffer) return true; // If no offer selected, show all dealers
    // Only show dealers assigned to the selected offer
    return selectedOffer.dealers.some(assignedDealer => assignedDealer.id === dealer.value);
  });

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
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading data...</p>
          </div>
        ) : (
          <>
            <div>
              <Label htmlFor="selectOffer">Select Combo Offer</Label>
              <Select value={selectedOfferId} onValueChange={setSelectedOfferId} disabled={comboOffers.length === 0}>
                <SelectTrigger id="selectOffer">
                  <SelectValue placeholder={comboOffers.length === 0 ? "No active offers available" : "Select an offer"} />
                </SelectTrigger>
                <SelectContent>
                  {comboOffers.map(offer => (
                    <SelectItem key={offer.id} value={offer.id}>
                      {offer.name} ({offer.discount_type === 'percentage' ? `${offer.discount_value}%` : `₹${offer.discount_value.toFixed(2)}`})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center space-x-2 mb-2">
                <Checkbox
                  id="sendToAllDealers"
                  checked={sendToAllDealers}
                  onCheckedChange={(checked) => {
                    setSendToAllDealers(!!checked);
                    if (!!checked) {
                      setSelectedDealerIds([]); // Clear individual selections if sending to all
                    }
                  }}
                />
                <Label htmlFor="sendToAllDealers" className="text-base font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" /> Send to All Assigned Dealers (for selected offer)
                </Label>
              </div>
              {!sendToAllDealers && (
                <>
                  <Label htmlFor="selectDealers">Select Specific Dealers</Label>
                  <MultiSelect
                    options={filteredDealerOptions}
                    value={selectedDealerIds}
                    onChange={setSelectedDealerIds}
                    placeholder="Select dealers"
                    disabled={filteredDealerOptions.length === 0}
                  />
                </>
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
              />
            </div>

            <Button
              onClick={handleSendWhatsApp}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
              disabled={loading || !selectedOfferId || (!sendToAllDealers && selectedDealerIds.length === 0) || !whatsappMessage.trim()}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {loading ? 'Preparing Messages...' : 'Send WhatsApp'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default SendWhatsAppOfferCard;