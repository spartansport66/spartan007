"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, MessageCircle, Send, AlertTriangle } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface Dealer {
  id: string;
  name: string;
  phone: string;
  closing_balance: number;
}

interface RCSBulkMessageSenderProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDealers: Dealer[];
  companyName: string | null;
}

const RCSBulkMessageSender: React.FC<RCSBulkMessageSenderProps> = ({
  isOpen,
  onOpenChange,
  selectedDealers,
  companyName,
}) => {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (isOpen && selectedDealers.length > 0) {
      // Generate a default personalized message template
      const firstDealer = selectedDealers[0];
      const formattedBalance = firstDealer.closing_balance.toFixed(2);
      
      const defaultMessage = `Hello [DEALER_NAME],\n\nThis is a friendly reminder from *${companyName || 'Our Company'}* regarding your account. Your current outstanding balance is *₹[CLOSING_BALANCE]*.\n\nTo ensure your account remains active, please clear this outstanding balance promptly.\n\nThank you!`;
      setMessage(defaultMessage);
    }
  }, [isOpen, selectedDealers, companyName]);

  const handleMockSend = () => {
    if (selectedDealers.length === 0) {
      showError('No dealers selected.');
      return;
    }
    if (!message.trim()) {
      showError('Message content cannot be empty.');
      return;
    }

    setIsSending(true);
    
    // --- MOCK RCS SENDING LOGIC ---
    setTimeout(() => {
      setIsSending(false);
      showSuccess(`Mock RCS message sent to ${selectedDealers.length} dealers! (Real API integration required)`);
      onOpenChange(false);
    }, 2000);
  };

  const renderMessagePreview = () => {
    if (!message) return "Start typing your message...";
    
    // Use the first selected dealer for a realistic preview
    const dealer = selectedDealers[0];
    if (!dealer) return "Select dealers to see a preview.";

    const previewMessage = message
      .replace(/\[DEALER_NAME\]/g, dealer.name)
      .replace(/\[CLOSING_BALANCE\]/g, dealer.closing_balance.toFixed(2))
      .replace(/\*/g, ''); // Remove markdown for cleaner preview

    return (
      <div className="p-3 bg-white dark:bg-gray-900 border rounded-md text-sm whitespace-pre-wrap">
        {previewMessage}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary flex items-center gap-2">
            <MessageCircle className="h-6 w-6" /> RCS Bulk Message Sender (Mock)
          </DialogTitle>
          <DialogDescription>
            Draft and send personalized bulk messages via a simulated RCS service.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 bg-yellow-100 text-yellow-800 rounded-md flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            <p className="text-sm font-medium">
              This is a **MOCK** interface. Real RCS integration requires a third-party API and server-side setup.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="font-semibold">Selected Dealers ({selectedDealers.length})</Label>
              <div className="max-h-40 overflow-y-auto border rounded-md mt-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedDealers.map(dealer => (
                      <TableRow key={dealer.id}>
                        <TableCell className="text-sm">{dealer.name}</TableCell>
                        <TableCell className="text-right text-sm">₹{dealer.closing_balance.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
            <div>
              <Label className="font-semibold">Message Preview (for {selectedDealers[0]?.name || 'N/A'})</Label>
              <div className="mt-2">
                {renderMessagePreview()}
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="rcsMessage" className="font-semibold">Message Content (Use [DEALER_NAME] and [CLOSING_BALANCE] for personalization)</Label>
            <Textarea
              id="rcsMessage"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              placeholder="Draft your RCS message here..."
              className="resize-y mt-2"
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleMockSend} disabled={isSending || selectedDealers.length === 0 || !message.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {isSending ? 'Sending Mock RCS...' : `Send Mock RCS to ${selectedDealers.length} Dealers`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RCSBulkMessageSender;