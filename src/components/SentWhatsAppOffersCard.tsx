"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, History, Eye, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface SentLog {
  id: string;
  combo_offer_id: string | null;
  dealer_id: string | null;
  message_content: string;
  sent_at: string;
  sent_by: string | null;
  combo_offers: { name: string } | null;
  dealers: { name: string } | null;
  profiles: { first_name: string; last_name: string } | null;
}

interface SentWhatsAppOffersCardProps {
  refreshKey: number; // Prop to trigger re-fetch
}

const SentWhatsAppOffersCard: React.FC<SentWhatsAppOffersCardProps> = ({ refreshKey }) => {
  const [sentLogs, setSentLogs] = useState<SentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMessageViewOpen, setIsMessageViewOpen] = useState(false);
  const [viewedMessageContent, setViewedMessageContent] = useState<string>('');

  const fetchSentLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('whatsapp_sent_logs')
        .select(`
          id,
          combo_offer_id,
          dealer_id,
          message_content,
          sent_at,
          sent_by,
          combo_offers(name),
          dealers(name),
          profiles(first_name, last_name)
        `)
        .order('sent_at', { ascending: false });

      if (error) throw error;

      // Map the fetched data to match the SentLog interface, handling nested arrays
      const formattedLogs: SentLog[] = (data || []).map((log: any) => ({
        id: log.id,
        combo_offer_id: log.combo_offer_id,
        dealer_id: log.dealer_id,
        message_content: log.message_content,
        sent_at: log.sent_at,
        sent_by: log.sent_by,
        combo_offers: log.combo_offers ? { name: log.combo_offers.name } : null, // Ensure single object or null
        dealers: log.dealers ? { name: log.dealers.name } : null, // Ensure single object or null
        profiles: log.profiles ? { first_name: log.profiles.first_name, last_name: log.profiles.last_name } : null, // Ensure single object or null
      }));
      
      setSentLogs(formattedLogs);
    } catch (error: any) {
      console.error('Error fetching sent WhatsApp logs:', error.message);
      showError(`Failed to load sent messages: ${error.message}`);
      setSentLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSentLogs();
  }, [fetchSentLogs, refreshKey]); // Re-fetch when refreshKey changes

  const handleViewMessage = (content: string) => {
    setViewedMessageContent(content);
    setIsMessageViewOpen(true);
  };

  const handleDeleteLog = async (logId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('whatsapp_sent_logs')
        .delete()
        .eq('id', logId);

      if (error) throw error;

      showSuccess('Message log deleted successfully!');
      fetchSentLogs(); // Refresh the list
    } catch (error: any) {
      console.error('Error deleting message log:', error.message);
      showError(`Failed to delete message log: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-card text-card-foreground shadow-lg h-full">
      <CardHeader className="bg-green-600 dark:bg-green-800 text-white rounded-t-lg p-4">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <History className="h-6 w-6" /> Sent WhatsApp Offers
        </CardTitle>
        <CardDescription className="text-green-100 dark:text-green-200">
          History of WhatsApp messages sent for combo offers.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading sent messages...</p>
          </div>
        ) : sentLogs.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No WhatsApp messages sent yet.</p>
        ) : (
          <div className="max-h-[400px] overflow-y-auto border rounded-md">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow className="bg-muted hover:bg-muted/90">
                  <TableHead className="text-muted-foreground">Offer Name</TableHead>
                  <TableHead className="text-muted-foreground">Dealer</TableHead>
                  <TableHead className="text-muted-foreground">Sent By</TableHead>
                  <TableHead className="text-muted-foreground">Sent At</TableHead>
                  <TableHead className="text-muted-foreground text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sentLogs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-accent/50">
                    <TableCell className="font-medium text-foreground">{log.combo_offers?.name || 'N/A'}</TableCell>
                    <TableCell className="text-muted-foreground">{log.dealers?.name || 'N/A'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {log.profiles ? `${log.profiles.first_name} ${log.profiles.last_name}` : 'N/A'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(log.sent_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleViewMessage(log.message_content)} title="View Message">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" title="Delete Log" disabled={loading}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action will permanently delete this WhatsApp message log.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteLog(log.id)} disabled={loading}>
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Delete'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={isMessageViewOpen} onOpenChange={setIsMessageViewOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>WhatsApp Message Content</DialogTitle>
            <DialogDescription>
              The full content of the sent WhatsApp message.
            </DialogDescription>
          </DialogHeader>
          <Textarea value={viewedMessageContent} readOnly rows={10} className="resize-none" />
          <DialogFooter>
            <Button onClick={() => setIsMessageViewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default SentWhatsAppOffersCard;