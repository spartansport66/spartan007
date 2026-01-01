"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Send, RotateCcw } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { showError } from '@/utils/toast';

interface DealerOption {
  value: string;
  label: string;
  phone: string;
  city: string;
  state: string;
}

interface SelectedDealersListCardProps {
  selectedDealerIds: string[];
  allRawDealers: DealerOption[];
  sentDealerIds: Set<string>;
  isSending: boolean;
  selectedOfferId: string;
  whatsappMessage: string;
  companyName: string | null;
  onIndividualSend: (dealerId: string, dealerName: string, dealerPhone: string, personalizedMessage: string) => Promise<void>;
  onResetSentStatus: () => void;
}

const SelectedDealersListCard: React.FC<SelectedDealersListCardProps> = ({
  selectedDealerIds,
  allRawDealers,
  sentDealerIds,
  isSending,
  selectedOfferId,
  whatsappMessage,
  companyName,
  onIndividualSend,
  onResetSentStatus,
}) => {
  const handleSendClick = async (dealerId: string) => {
    const dealer = allRawDealers.find(d => d.value === dealerId);
    if (!dealer) {
      showError('Dealer not found.');
      return;
    }
    if (!dealer.phone) {
      showError(`Phone number not available for ${dealer.label.split('(')[0].trim()}.`);
      return;
    }
    if (!selectedOfferId) {
      showError('Please select a combo offer first.');
      return;
    }
    if (!whatsappMessage.trim()) {
      showError('WhatsApp message cannot be empty.');
      return;
    }

    // Extract dealer name from the label property
    const dealerName = dealer.label.split('(')[0].trim();
    const personalizedMessage = whatsappMessage.replace('[DEALER_NAME]', dealerName);
    await onIndividualSend(dealerId, dealerName, dealer.phone, personalizedMessage);
  };

  return (
    <Card className="bg-card text-card-foreground shadow-lg h-full">
      <CardHeader className="bg-blue-600 dark:bg-blue-800 text-white rounded-t-lg p-4">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          Selected Dealers
        </CardTitle>
        <CardDescription className="text-blue-100 dark:text-blue-200">
          Review and send WhatsApp messages to individual dealers.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {selectedDealerIds.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No dealers selected for messaging.</p>
        ) : (
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto border rounded-md">
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
                {selectedDealerIds.map((dealerId) => {
                  const dealer = allRawDealers.find(d => d.value === dealerId);
                  if (!dealer) return null;
                  const isDealerSent = sentDealerIds.has(dealer.value);
                  
                  return (
                    <TableRow 
                      key={dealer.value} 
                      className={cn("hover:bg-accent/50", isDealerSent && "opacity-50 cursor-not-allowed")}
                    >
                      <TableCell className="font-medium text-foreground">{dealer.label.split('(')[0].trim()}</TableCell>
                      <TableCell className="text-muted-foreground">{dealer.phone || 'N/A'}</TableCell>
                      <TableCell className="text-muted-foreground">{dealer.city}</TableCell>
                      <TableCell className="text-muted-foreground">{dealer.state}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSendClick(dealer.value)}
                          title={isDealerSent ? "Already Sent" : `Send to ${dealer.label.split('(')[0].trim()}`}
                          disabled={isSending || !dealer.phone || !selectedOfferId || !whatsappMessage.trim() || isDealerSent}
                        >
                          <Send className="h-4 w-4 text-blue-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {sentDealerIds.size > 0 && (
          <div className="flex justify-end mt-4">
            <Button 
              variant="outline" 
              onClick={onResetSentStatus} 
              disabled={isSending}
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" /> Reset Sent Status
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SelectedDealersListCard;