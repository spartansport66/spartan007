"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { showSuccess, showError } from '@/utils/toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { ArrowLeft, Loader2, Gift, PlusCircle, Edit, Trash2, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import WhatsAppMessageSender from '@/components/WhatsAppMessageSender';
import SelectedDealersListCard from '@/components/SelectedDealersListCard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import ComboOfferDealerAssignment from '@/components/ComboOfferDealerAssignment';

// IMPORTANT: Replace with the actual URL of your deployed Edge Function
const SEND_WHATSAPP_MESSAGE_EDGE_FUNCTION_URL = "https://hxftiocfihhdutciaisl.supabase.co/functions/v1/send-whatsapp-message";

interface ComboOffer {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  assigned_dealers_count?: number; 
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

const createOfferFormSchema = z.object({
  offerName: z.string().min(1, { message: 'Offer name is required.' }),
  description: z.string().optional(),
});

const editOfferFormSchema = z.object({
  name: z.string().min(1, { message: 'Offer name is required.' }),
  description: z.string().optional(),
});

const ComboOffersDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, isAdmin } = useSession();
  const [loadingData, setLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [comboOffersList, setComboOffersList] = useState<ComboOffer[]>([]);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<ComboOffer | null>(null);
  const [isAssignDealersDialogOpen, setIsAssignDealersDialogOpen] = useState(false);
  const [selectedOfferForAssignment, setSelectedOfferForAssignment] = useState<ComboOffer | null>(null);

  // WhatsApp Sender States (lifted from WhatsAppMessageSender)
  const [allRawDealers, setAllRawDealers] = useState<DealerOption[]>([]);
  const [comboOffersForSender, setComboOffersForSender] = useState<ComboOffer[]>([]); // Renamed to avoid conflict
  const [selectedDealerIds, setSelectedDealerIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('whatsapp_selectedDealerIds');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [selectedOfferId, setSelectedOfferId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('whatsapp_selectedOfferId') || '';
    }
    return '';
  });
  const [whatsappMessage, setWhatsappMessage] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('whatsapp_message') || '';
    }
    return '';
  });
  const [filterCity, setFilterCity] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('whatsapp_filterCity') || '';
    }
    return '';
  });
  const [filterState, setFilterState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('whatsapp_filterState') || '';
    }
    return '';
  });
  const [sentDealerIds, setSentDealerIds] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('whatsapp_sentDealerIds');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    }
    return new Set();
  });
  const [initialLoadingWhatsApp, setInitialLoadingWhatsApp] = useState(true);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [filteredDealersForMultiSelect, setFilteredDealersForMultiSelect] = useState<DealerOption[]>([]);
  const [messageType, setMessageType] = useState<'combo_offer' | 'balance_due'>(() => {
    if (typeof window !== 'undefined') {
      return (sessionStorage.getItem('whatsapp_messageType') as 'combo_offer' | 'balance_due') || 'combo_offer';
    }
    return 'combo_offer';
  });
  const [balanceDuePeriodFilter, setBalanceDuePeriodFilter] = useState<'all' | '1_month' | '3_months' | '6_months'>(() => {
    if (typeof window !== 'undefined') {
      return (sessionStorage.getItem('whatsapp_balanceDuePeriodFilter') as 'all' | '1_month' | '3_months' | '6_months') || 'all';
    }
    return 'all';
  });


  // Forms
  const createForm = useForm<z.infer<typeof createOfferFormSchema>>({
    resolver: zodResolver(createOfferFormSchema),
    defaultValues: {
      offerName: '',
      description: '',
    },
  });

  const editForm = useForm<z.infer<typeof editOfferFormSchema>>({
    resolver: zodResolver(editOfferFormSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  // Effects to save WhatsApp sender state to sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('whatsapp_selectedDealerIds', JSON.stringify(selectedDealerIds));
    }
  }, [selectedDealerIds]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('whatsapp_selectedOfferId', selectedOfferId);
    }
  }, [selectedOfferId]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('whatsapp_message', whatsappMessage);
    }
  }, [whatsappMessage]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('whatsapp_filterCity', filterCity);
    }
  }, [filterCity]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('whatsapp_filterState', filterState);
    }
  }, [filterState]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('whatsapp_sentDealerIds', JSON.stringify(Array.from(sentDealerIds)));
    }
  }, [sentDealerIds]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('whatsapp_messageType', messageType);
    }
  }, [messageType]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('whatsapp_balanceDuePeriodFilter', balanceDuePeriodFilter);
    }
  }, [balanceDuePeriodFilter]);

  // Fetch initial data for Combo Offers List
  const fetchComboOffers = useCallback(async () => {
    setLoadingData(true);
    try {
      const { data, error } = await supabase
        .from('combo_offers')
        .select(`
          id, 
          name, 
          description, 
          created_at,
          combo_offer_dealers(count)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const formattedOffers: ComboOffer[] = (data || []).map((offer: any) => ({
        id: offer.id,
        name: offer.name,
        description: offer.description,
        created_at: offer.created_at,
        assigned_dealers_count: offer.combo_offer_dealers[0]?.count || 0,
      }));
      setComboOffersList(formattedOffers);
      setComboOffersForSender(formattedOffers); // Also update for the sender component
    } catch (error: any) {
      console.error('Error fetching combo offers:', error.message);
      showError(`Failed to load combo offers: ${error.message}`);
    } finally {
      setLoadingData(false);
    }
  }, []);

  // Fetch initial data for WhatsApp Sender
  const fetchWhatsAppInitialData = useCallback(async () => {
    setInitialLoadingWhatsApp(true);
    try {
      // Fetch all dealers with their balances, orders, and payments
      const { data: dealersRawData, error: dealersError } = await supabase
        .from('dealers')
        .select(`
          id, name, phone, city, state, last_billing_date,
          dealer_balances(opening_balance),
          orders(id, total_amount, payment_status, payment_due_date, payments(amount, status, payment_date, cheque_dd_date))
        `);

      if (dealersError) throw dealersError;

      const formattedDealers: DealerOption[] = (dealersRawData || []).map(d => {
        const openingBalance = d.dealer_balances?.[0]?.opening_balance || 0;

        let currentBalance = openingBalance;
        let oldestDueDate: string | null = null;

        // Process orders and payments to calculate current balance and oldest due date
        (d.orders || []).forEach((order: any) => {
          // All orders are debits (increase amount owed)
          currentBalance += order.total_amount;

          // If order is pending, consider its due date for oldestDueDate
          if (order.payment_status === 'pending' && order.payment_due_date) {
            if (!oldestDueDate || new Date(order.payment_due_date) < new Date(oldestDueDate)) {
              oldestDueDate = order.payment_due_date;
            }
          }

          // Iterate through payments associated with this order
          (order.payments || []).forEach((payment: any) => {
            if (payment.status === 'completed') {
              currentBalance -= payment.amount;
            }
          });
        });

        // If there's an opening balance and no other specific due dates, consider last_billing_date
        if (openingBalance > 0 && !oldestDueDate && d.last_billing_date) {
           // If opening balance is the only outstanding, and last_billing_date exists, use it as a conceptual due date
           oldestDueDate = d.last_billing_date;
        }


        return {
          value: d.id,
          label: `${d.name} (${d.phone || 'No Phone'})`,
          phone: d.phone || '',
          city: d.city || 'N/A',
          state: d.state || 'N/A',
          currentBalance: currentBalance,
          oldestDueDate: oldestDueDate,
          lastBillingDate: d.last_billing_date, // New: Populate lastBillingDate
        };
      });
      setAllRawDealers(formattedDealers);

      // Fetch company info
      const { data: companyInfo, error: companyInfoError } = await supabase
        .from('company_info')
        .select('company_name')
        .limit(1)
        .single();
      if (companyInfoError && companyInfoError.code !== 'PGRST116') throw companyInfoError;
      setCompanyName(companyInfo?.company_name || null);

    } catch (error: any) {
      console.error('Error fetching initial data for WhatsApp sender:', error.message);
      showError(`Failed to load WhatsApp sender data: ${error.message}`);
    } finally {
      setInitialLoadingWhatsApp(false);
    }
  }, []);

  // Main useEffect for page load and session checks
  useEffect(() => {
    if (!sessionLoading) {
      if (!user) {
        navigate('/login');
      } else if (!isAdmin) {
        showError('Access Denied: You must be an administrator to view this page.');
        navigate('/dashboard');
      } else {
        fetchComboOffers();
        fetchWhatsAppInitialData();
      }
    }
  }, [sessionLoading, user, isAdmin, navigate, fetchComboOffers, fetchWhatsAppInitialData]);

  // Effect to filter dealers for the MultiSelect options based on city/state/balance filters
  useEffect(() => {
    const filtered = allRawDealers.filter(dealer => {
      const matchesCity = filterCity ? dealer.city.toLowerCase().includes(filterCity.toLowerCase()) : true;
      const matchesState = filterState ? dealer.state.toLowerCase().includes(filterState.toLowerCase()) : true;
      
      let matchesBalanceDuePeriod = true;
      if (messageType === 'balance_due') {
        if (dealer.currentBalance <= 0) {
          matchesBalanceDuePeriod = false; // No balance, so no match for any due period
        } else if (balanceDuePeriodFilter === 'all') {
          matchesBalanceDuePeriod = true; // Show all dealers with a positive balance
        } else { // Time-based filters: '1_month', '3_months', '6_months'
          if (!dealer.oldestDueDate) {
            matchesBalanceDuePeriod = false; // Cannot determine due period if no oldest due date
          } else {
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Normalize today to start of day UTC
            const oldestDue = new Date(dealer.oldestDueDate);
            oldestDue.setHours(0, 0, 0, 0); // Normalize oldestDue to start of day UTC

            // If oldestDue is in the future, it's not "overdue" for any period yet
            if (oldestDue > today) {
              matchesBalanceDuePeriod = false;
            } else {
              // Calculate difference in days for past due dates
              const diffTime = Math.abs(today.getTime() - oldestDue.getTime());
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

              if (balanceDuePeriodFilter === '1_month') {
                matchesBalanceDuePeriod = diffDays >= 30;
              } else if (balanceDuePeriodFilter === '3_months') {
                matchesBalanceDuePeriod = diffDays >= 90;
              } else if (balanceDuePeriodFilter === '6_months') {
                matchesBalanceDuePeriod = diffDays >= 180;
              }
            }
          }
        }
      }
      // If messageType is not 'balance_due', matchesBalanceDuePeriod remains true.

      return matchesCity && matchesState && matchesBalanceDuePeriod;
    });
    setFilteredDealersForMultiSelect(filtered);
  }, [allRawDealers, filterCity, filterState, messageType, balanceDuePeriodFilter]);

  useEffect(() => {
    if (selectedOffer) {
      editForm.reset({
        name: selectedOffer.name,
        description: selectedOffer.description || '',
      });
    }
  }, [selectedOffer, editForm]);

  const handleCreateOffer = async (values: z.infer<typeof createOfferFormSchema>) => {
    if (!user) {
      showError('You must be logged in to create a combo offer.');
      return;
    }
    setIsSubmitting(true);

    try {
      const { error: offerError } = await supabase
        .from('combo_offers')
        .insert({
          name: values.offerName,
          description: values.description,
          created_by: user.id,
        });

      if (offerError) throw offerError;

      showSuccess('Combo offer created successfully!');
      createForm.reset({
        offerName: '',
        description: '',
      });
      fetchComboOffers();
    } catch (error: any) {
      console.error('Error creating combo offer:', error);
      showError(`Failed to create combo offer: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditOffer = (offer: ComboOffer) => {
    setSelectedOffer(offer);
    setIsEditDialogOpen(true);
  };

  const handleUpdateOffer = async (values: z.infer<typeof editOfferFormSchema>) => {
    if (!selectedOffer) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('combo_offers')
        .update({
          name: values.name,
          description: values.description,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedOffer.id);

      if (error) throw error;

      showSuccess('Combo offer updated successfully!');
      setIsEditDialogOpen(false);
      fetchComboOffers();
    } catch (error: any) {
      console.error('Error updating combo offer:', error);
      showError(`Failed to update combo offer: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteOffer = async (offerId: string) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('combo_offers')
        .delete()
        .eq('id', offerId);

      if (error) throw error;

      showSuccess('Combo offer deleted successfully!');
      fetchComboOffers();
    } catch (error: any) {
      console.error('Error deleting combo offer:', error);
      showError(`Failed to delete combo offer: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWhatsAppMessageSent = () => {
    // This callback is triggered when a message is sent, useful for refreshing logs if any
    // For now, it just ensures the sent status is updated in the UI via setSentDealerIds
  };

  const handleManageDealers = (offer: ComboOffer) => {
    setSelectedOfferForAssignment(offer);
    setIsAssignDealersDialogOpen(true);
  };

  const handleAssignmentsUpdated = () => {
    fetchComboOffers();
    // No need for whatsappRefreshKey anymore, as state is lifted
  };

  const handleClearFilters = () => {
    setFilterCity('');
    setFilterState('');
    setBalanceDuePeriodFilter('all'); // Clear balance due filter as well
  };

  const handleIndividualSendWhatsApp = async (
    dealerId: string, 
    dealerName: string, 
    dealerPhone: string, 
    personalizedMessage: string,
    currentBalance: number, // New
    oldestDueDate: string | null // New
  ) => {
    if (!user) {
      showError('You must be logged in to send WhatsApp messages.');
      return;
    }
    setIsSendingWhatsApp(true);
    try {
      let finalMessage = personalizedMessage;
      let finalComboOfferId = selectedOfferId; // Default to selectedOfferId

      if (messageType === 'balance_due') {
        // If message type is balance due, construct the message here
        const formattedBalance = currentBalance.toFixed(2);
        const formattedDueDate = oldestDueDate ? new Date(oldestDueDate).toLocaleDateString() : 'N/A';
        finalMessage = `Dear ${dealerName},\n\nThis is a reminder from *${companyName || 'Our Company'}* that your current outstanding balance is *₹${formattedBalance}*, due from *${formattedDueDate}*. Please clear your balance as soon as possible.\n\nThank you!`;
        finalComboOfferId = ''; // No combo offer ID for balance due message
      }

      const response = await fetch(SEND_WHATSAPP_MESSAGE_EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dealerIds: [dealerId],
          message: finalMessage,
          comboOfferId: finalComboOfferId, // Pass the appropriate comboOfferId (or empty string)
          sentByUserId: user.id,
          messageType: messageType, // Pass message type to Edge Function for logging
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send WhatsApp message');
      }

      showSuccess('WhatsApp message prepared. A new tab may open, please ensure pop-ups are allowed.');
      
      const encodedMessage = encodeURIComponent(finalMessage);
      const whatsappUrl = `https://web.whatsapp.com/send?phone=${dealerPhone}&text=${encodedMessage}`;
      window.open(whatsappUrl, '_blank');
      setSentDealerIds(prev => new Set([...prev, dealerId]));
      handleWhatsAppMessageSent(); // Trigger parent refresh if needed
    } catch (error: any) {
      console.error('Error sending WhatsApp message:', error);
      showError(`Failed to send WhatsApp message: ${error.message}`);
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  const handleResetSentStatus = () => {
    setSentDealerIds(new Set());
    showSuccess('Sent status reset for all dealers.');
  };

  if (sessionLoading || loadingData || initialLoadingWhatsApp) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading combo offers dashboard...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <Button variant="outline" onClick={() => navigate('/admin-dashboard')} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Admin Dashboard
        </Button>
        <h1 className="text-2xl sm:text-3xl font-bold text-primary">Combo Offer Management</h1>
        <div className="w-fit"></div>
      </div>

      {/* First Row: Three Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Card 1: Create New Combo Offer (Inline Form) */}
        <Card className="bg-card text-card-foreground shadow-lg h-full flex flex-col justify-between">
          <CardHeader className="bg-purple-600 dark:bg-purple-800 text-white rounded-t-lg p-4">
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <PlusCircle className="h-6 w-6" /> Create New Offer
            </CardTitle>
            <CardDescription className="text-purple-100 dark:text-purple-200">
              Define a new combo offer with details.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 flex-grow">
            {/* List of existing offers with edit/delete icons */}
            {comboOffersList.length > 0 && (
              <div className="mb-4 max-h-40 overflow-y-auto border rounded-md p-2 bg-muted/10">
                <h3 className="text-sm font-medium mb-2 text-muted-foreground">Existing Offers:</h3>
                <ul className="space-y-1">
                  {comboOffersList.map((offer) => (
                    <li key={offer.id} className="flex justify-between items-center text-sm p-1 hover:bg-accent rounded">
                      <span className="truncate">{offer.name}</span>
                      <div className="flex space-x-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleEditOffer(offer)}
                          title="Edit Offer"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleManageDealers(offer)} // Added Manage Dealers button
                          title="Manage Assigned Dealers"
                        >
                          <Users className="h-3 w-3" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              title="Delete Offer"
                              disabled={isSubmitting}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the combo offer "{offer.name}".
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteOffer(offer.id)} disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Delete'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(handleCreateOffer)} className="space-y-4">
                <FormField
                  control={createForm.control}
                  name="offerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Offer Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Summer Sales Combo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="e.g., Special discount on selected products for summer." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    'Create Combo Offer'
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Card 2: WhatsApp Message Sender (now handles message type and filters) */}
        <WhatsAppMessageSender 
          allRawDealers={allRawDealers}
          comboOffers={comboOffersForSender}
          selectedDealerIds={selectedDealerIds}
          setSelectedDealerIds={setSelectedDealerIds}
          selectedOfferId={selectedOfferId}
          setSelectedOfferId={setSelectedOfferId}
          whatsappMessage={whatsappMessage}
          setWhatsappMessage={setWhatsappMessage}
          filterCity={filterCity}
          setFilterCity={setFilterCity}
          filterState={filterState}
          setFilterState={setFilterState}
          isSending={isSendingWhatsApp}
          companyName={companyName}
          initialLoading={initialLoadingWhatsApp}
          filteredDealersForMultiSelect={filteredDealersForMultiSelect}
          handleClearFilters={handleClearFilters}
          messageType={messageType} // Pass messageType
          setMessageType={setMessageType} // Pass setMessageType
          balanceDuePeriodFilter={balanceDuePeriodFilter} // Pass balanceDuePeriodFilter
          setBalanceDuePeriodFilter={setBalanceDuePeriodFilter} // Pass setBalanceDuePeriodFilter
        />

        {/* Card 3: Selected Dealers List for WhatsApp */}
        <SelectedDealersListCard
          selectedDealerIds={selectedDealerIds}
          allRawDealers={allRawDealers}
          sentDealerIds={sentDealerIds}
          isSending={isSendingWhatsApp}
          selectedOfferId={selectedOfferId}
          whatsappMessage={whatsappMessage}
          companyName={companyName}
          onIndividualSend={handleIndividualSendWhatsApp}
          onResetSentStatus={handleResetSentStatus}
          messageType={messageType} // Pass messageType
        />
      </div>

      <MadeWithDyad />

      {/* Edit Offer Dialog */}
      {selectedOffer && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit Combo Offer</DialogTitle>
              <DialogDescription>
                Make changes to the combo offer details.
              </DialogDescription>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(handleUpdateOffer)} className="grid gap-4 py-4">
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Offer Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save changes'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}

      {/* Assign Dealers Dialog */}
      {selectedOfferForAssignment && (
        <Dialog open={isAssignDealersDialogOpen} onOpenChange={setIsAssignDealersDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Assign Dealers to "{selectedOfferForAssignment.name}"</DialogTitle>
              <DialogDescription>
                Select which dealers should receive this combo offer.
              </DialogDescription>
            </DialogHeader>
            <ComboOfferDealerAssignment 
              comboOfferId={selectedOfferForAssignment.id} 
              onAssignmentsUpdated={handleAssignmentsUpdated} 
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default ComboOffersDashboard;