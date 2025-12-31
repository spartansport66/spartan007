"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { showSuccess, showError } from '@/utils/toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { ArrowLeft, Loader2, Gift, Edit, Trash2, PlusCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import MultiSelect from '@/components/MultiSelect';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import SendWhatsAppOfferCard from '@/components/SendWhatsAppOfferCard'; // New import
import SentWhatsAppOffersCard from '@/components/SentWhatsAppOffersCard'; // New import


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

interface ProductOption {
  value: string;
  label: string;
}

interface DealerOption {
  value: string;
  label: string;
  phone: string; // Include phone for WhatsApp
}

interface ComboOffer {
  id: string;
  name: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  start_date: string;
  end_date: string;
  created_by: string;
  created_at: string;
  products: Product[]; // Nested products
  dealers: Dealer[]; // Nested dealers
}

const editFormSchema = z.object({
  offerName: z.string().min(1, { message: 'Offer name is required.' }),
  description: z.string().optional(),
  discountType: z.enum(['percentage', 'fixed_amount'], { message: 'Please select a discount type.' }),
  discountValue: z.preprocess(
    (val) => Number(val),
    z.number().min(0, { message: 'Discount value cannot be negative.' })
  ),
  startDate: z.string().min(1, { message: 'Start date is required.' }),
  endDate: z.string().min(1, { message: 'End date is required.' }),
  selectedProductIds: z.array(z.string().uuid()).min(1, { message: 'At least one product must be selected for the combo.' }),
  selectedDealerIds: z.array(z.string().uuid()).min(1, { message: 'At least one dealer must be assigned to the offer.' }),
}).superRefine((data, ctx) => {
  if (new Date(data.startDate) > new Date(data.endDate)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'End date cannot be before start date.',
      path: ['endDate'],
    });
  }
});

const ManageComboOffers = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, isAdmin } = useSession();
  const [comboOffers, setComboOffers] = useState<ComboOffer[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<ComboOffer | null>(null);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [allDealers, setAllDealers] = useState<Dealer[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [whatsappRefreshKey, setWhatsappRefreshKey] = useState(0); // Key to refresh WhatsApp logs

  const editForm = useForm<z.infer<typeof editFormSchema>>({
    resolver: zodResolver(editFormSchema),
    defaultValues: {
      offerName: '',
      description: '',
      discountType: 'percentage',
      discountValue: 0,
      startDate: '',
      endDate: '',
      selectedProductIds: [],
      selectedDealerIds: [],
    },
  });

  const fetchInitialData = useCallback(async () => {
    if (!user) {
      setLoadingData(false);
      return;
    }

    try {
      // Fetch all products for MultiSelect options
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name, price');
      if (productsError) throw productsError;
      setAllProducts(productsData || []);

      // Fetch all dealers for MultiSelect options
      const { data: dealersData, error: dealersError } = await supabase
        .from('dealers')
        .select('id, name, phone');
      if (dealersError) throw dealersError;
      setAllDealers(dealersData || []);

      // Fetch combo offers with nested products and dealers
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
          created_by,
          created_at,
          combo_offer_products(products(id, name, price)),
          combo_offer_dealers(dealers(id, name, phone))
        `)
        .order('created_at', { ascending: false });

      if (offersError) throw offersError;

      const formattedOffers: ComboOffer[] = (offersData || []).map((offer: any) => ({
        id: offer.id,
        name: offer.name,
        description: offer.description,
        discount_type: offer.discount_type,
        discount_value: offer.discount_value,
        start_date: offer.start_date,
        end_date: offer.end_date,
        created_by: offer.created_by,
        created_at: offer.created_at,
        products: offer.combo_offer_products.map((cop: any) => cop.products),
        dealers: offer.combo_offer_dealers.map((cod: any) => cod.dealers),
      }));
      setComboOffers(formattedOffers);

    } catch (error: any) {
      console.error('Error fetching combo offers:', error.message);
      showError(`Failed to load combo offers: ${error.message}`);
      setComboOffers([]);
    } finally {
      setLoadingData(false);
    }
  }, [user]);

  useEffect(() => {
    if (!sessionLoading) {
      if (!user) {
        navigate('/login');
      } else if (!isAdmin) {
        showError('Access Denied: You must be an administrator to view this page.');
        navigate('/dashboard');
      } else {
        fetchInitialData();
      }
    }
  }, [sessionLoading, user, isAdmin, navigate, fetchInitialData]);

  useEffect(() => {
    if (selectedOffer) {
      editForm.reset({
        offerName: selectedOffer.name,
        description: selectedOffer.description || '',
        discountType: selectedOffer.discount_type,
        discountValue: selectedOffer.discount_value,
        startDate: selectedOffer.start_date,
        endDate: selectedOffer.end_date,
        selectedProductIds: selectedOffer.products.map(p => p.id),
        selectedDealerIds: selectedOffer.dealers.map(d => d.id),
      });
    }
  }, [selectedOffer, editForm]);

  const handleEdit = (offer: ComboOffer) => {
    setSelectedOffer(offer);
    setIsEditDialogOpen(true);
  };

  const handleUpdateOffer = async (values: z.infer<typeof editFormSchema>) => {
    if (!selectedOffer || !user) return;
    setIsSubmitting(true);

    try {
      // 1. Update the combo offer details
      const { error: offerUpdateError } = await supabase
        .from('combo_offers')
        .update({
          name: values.offerName,
          description: values.description,
          discount_type: values.discountType,
          discount_value: values.discountValue,
          start_date: values.startDate,
          end_date: values.endDate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedOffer.id);

      if (offerUpdateError) throw offerUpdateError;

      // 2. Update linked products (delete old, insert new)
      const currentProductIds = selectedOffer.products.map(p => p.id);
      const newProductIds = values.selectedProductIds;

      const productsToAdd = newProductIds.filter(id => !currentProductIds.includes(id));
      const productsToRemove = currentProductIds.filter(id => !newProductIds.includes(id));

      if (productsToRemove.length > 0) {
        const { error: removeError } = await supabase
          .from('combo_offer_products')
          .delete()
          .eq('combo_offer_id', selectedOffer.id)
          .in('product_id', productsToRemove);
        if (removeError) throw removeError;
      }
      if (productsToAdd.length > 0) {
        const { error: addError } = await supabase
          .from('combo_offer_products')
          .insert(productsToAdd.map(productId => ({ combo_offer_id: selectedOffer.id, product_id: productId })));
        if (addError) throw addError;
      }

      // 3. Update linked dealers (delete old, insert new)
      const currentDealerIds = selectedOffer.dealers.map(d => d.id);
      const newDealerIds = values.selectedDealerIds;

      const dealersToAdd = newDealerIds.filter(id => !currentDealerIds.includes(id));
      const dealersToRemove = currentDealerIds.filter(id => !newDealerIds.includes(id));

      if (dealersToRemove.length > 0) {
        const { error: removeError } = await supabase
          .from('combo_offer_dealers')
          .delete()
          .eq('combo_offer_id', selectedOffer.id)
          .in('dealer_id', dealersToRemove);
        if (removeError) throw removeError;
      }
      if (dealersToAdd.length > 0) {
        const { error: addError } = await supabase
          .from('combo_offer_dealers')
          .insert(dealersToAdd.map(dealerId => ({ combo_offer_id: selectedOffer.id, dealer_id: dealerId })));
        if (addError) throw addError;
      }

      showSuccess('Combo offer updated successfully!');
      setIsEditDialogOpen(false);
      fetchInitialData(); // Refresh data
    } catch (error: any) {
      console.error('Error updating combo offer:', error);
      showError(`Failed to update combo offer: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (offerId: string) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('combo_offers')
        .delete()
        .eq('id', offerId);

      if (error) throw error;

      showSuccess('Combo offer deleted successfully!');
      fetchInitialData(); // Refresh data
    } catch (error: any) {
      console.error('Error deleting combo offer:', error);
      showError(`Failed to delete combo offer: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWhatsAppMessageSent = () => {
    setWhatsappRefreshKey(prev => prev + 1); // Increment key to refresh SentWhatsAppOffersCard
  };

  if (sessionLoading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading combo offers...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return null; // Should be redirected by useEffect
  }

  const productOptions = allProducts.map(p => ({ value: p.id, label: `${p.name} (₹${p.price.toFixed(2)})` }));
  const dealerOptions = allDealers.map(d => ({ value: d.id, label: `${d.name} (${d.phone || 'No Phone'})`, phone: d.phone || '' }));

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-full">
        <Button variant="outline" onClick={() => navigate('/admin-dashboard')} className="mb-6 flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Admin Dashboard
        </Button>

        <h1 className="text-2xl sm:text-3xl font-bold text-primary text-center mb-6">Combo Offer Management</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-6">
          {/* Card 1: Create New Combo Offer */}
          <Card className="bg-card text-card-foreground shadow-lg h-full flex flex-col justify-between">
            <CardHeader className="bg-purple-600 dark:bg-purple-800 text-white rounded-t-lg p-4">
              <CardTitle className="text-xl font-semibold flex items-center gap-2">
                <PlusCircle className="h-6 w-6" /> Create New Offer
              </CardTitle>
              <CardDescription className="text-purple-100 dark:text-purple-200">
                Define a new combo offer with products and discounts.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 flex-grow flex items-center justify-center">
              <Button onClick={() => navigate('/create-combo-offer')} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                <Gift className="h-5 w-5 mr-2" /> Create Combo Offer
              </Button>
            </CardContent>
          </Card>

          {/* Card 2: Send WhatsApp Offer */}
          <SendWhatsAppOfferCard onMessageSent={handleWhatsAppMessageSent} />

          {/* Card 3: Manage Sent WhatsApp Offers */}
          <SentWhatsAppOffersCard refreshKey={whatsappRefreshKey} />
        </div>

        {/* Card 4: Manage Existing Combo Offers (Table) */}
        <Card className="bg-card text-card-foreground shadow-lg">
          <CardHeader className="bg-pink-600 dark:bg-pink-800 text-white rounded-t-lg p-4">
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <Gift className="h-6 w-6" /> Existing Combo Offers
            </CardTitle>
            <CardDescription className="text-pink-100 dark:text-pink-200">
              View, edit, or delete existing combo offers.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <div className="overflow-x-auto">
              {comboOffers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No combo offers found. Create a new one!</p>
              ) : (
                <div className="max-h-[500px] overflow-y-auto border rounded-md">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow className="bg-muted hover:bg-muted/90">
                        <TableHead className="text-muted-foreground">Offer Name</TableHead>
                        <TableHead className="text-muted-foreground">Discount</TableHead>
                        <TableHead className="text-muted-foreground">Validity</TableHead>
                        <TableHead className="text-muted-foreground">Products</TableHead>
                        <TableHead className="text-muted-foreground">Assigned Dealers</TableHead>
                        <TableHead className="text-muted-foreground text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comboOffers.map((offer) => (
                        <TableRow key={offer.id} className="hover:bg-accent/50">
                          <TableCell className="font-medium text-foreground">{offer.name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {offer.discount_type === 'percentage' ? `${offer.discount_value}%` : `₹${offer.discount_value.toFixed(2)}`}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(offer.start_date).toLocaleDateString()} - {new Date(offer.end_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {offer.products.map(p => p.name).join(', ') || 'N/A'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {offer.dealers.map(d => d.name).join(', ') || 'N/A'}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center gap-2">
                              <Button variant="ghost" size="icon" onClick={() => handleEdit(offer)} title="Edit Offer">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" title="Delete Offer" disabled={isSubmitting}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This action cannot be undone. This will permanently delete the combo offer.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(offer.id)} disabled={isSubmitting}>
                                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Delete'}
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
            </div>
          </CardContent>
        </Card>
      </div>
      <MadeWithDyad />

      {selectedOffer && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Combo Offer: {selectedOffer.name}</DialogTitle>
              <DialogDescription>
                Make changes to the combo offer details, products, and assigned dealers.
              </DialogDescription>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(handleUpdateOffer)} className="grid gap-4 py-4">
                <FormField
                  control={editForm.control}
                  name="offerName"
                  render={({ field }) => (
                    <FormItem>
                      <Label htmlFor="offerName">Offer Name</Label>
                      <Input id="offerName" {...field} />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <Label htmlFor="description">Description (Optional)</Label>
                      <Textarea id="description" {...field} />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="discountType"
                    render={({ field }) => (
                      <FormItem>
                        <Label htmlFor="discountType">Discount Type</Label>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <SelectTrigger id="discountType">
                            <SelectValue placeholder="Select discount type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentage">Percentage (%)</SelectItem>
                            <SelectItem value="fixed_amount">Fixed Amount (₹)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="discountValue"
                    render={({ field }) => (
                      <FormItem>
                        <Label htmlFor="discountValue">Discount Value</Label>
                        <Input id="discountValue" type="number" step="0.01" {...field} />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <Label htmlFor="startDate">Start Date</Label>
                        <Input id="startDate" type="date" {...field} />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <Label htmlFor="endDate">End Date</Label>
                        <Input id="endDate" type="date" {...field} />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={editForm.control}
                  name="selectedProductIds"
                  render={({ field }) => (
                    <FormItem>
                      <Label htmlFor="selectedProductIds">Products in Combo</Label>
                      <MultiSelect
                        options={productOptions}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Select products for the combo"
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="selectedDealerIds"
                  render={({ field }) => (
                    <FormItem>
                      <Label htmlFor="selectedDealerIds">Assign to Dealers</Label>
                      <MultiSelect
                        options={dealerOptions}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Select dealers for this offer"
                      />
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
    </div>
  );
};

export default ManageComboOffers;