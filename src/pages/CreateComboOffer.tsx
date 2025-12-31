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
import { ArrowLeft, Loader2, Gift } from 'lucide-react'; // Removed MessageCircle
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import MultiSelect from '@/components/MultiSelect';
import { Label } from '@/components/ui/label';
// Removed Checkbox import as sendWhatsApp is no longer here

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

const formSchema = z.object({
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

const CreateComboOffer = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, isAdmin } = useSession();
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [allDealers, setAllDealers] = useState<Dealer[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      offerName: '',
      description: '',
      discountType: 'percentage',
      discountValue: 0,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      selectedProductIds: [],
      selectedDealerIds: [],
    },
  });

  const fetchInitialData = useCallback(async () => {
    if (!user) {
      setDataLoading(false);
      return;
    }

    try {
      // Fetch all products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name, price');
      if (productsError) throw productsError;
      setAllProducts(productsData || []);

      // Fetch all dealers
      const { data: dealersData, error: dealersError } = await supabase
        .from('dealers')
        .select('id, name, phone');
      if (dealersError) throw dealersError;
      setAllDealers(dealersData || []);

    } catch (error: any) {
      console.error('Error fetching initial data:', error.message);
      showError(`Failed to load initial data: ${error.message}`);
    } finally {
      setDataLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!sessionLoading && !user) {
      navigate('/login');
    } else if (!sessionLoading && user && !isAdmin) {
      showError('Access Denied: Only administrators can create combo offers.');
      navigate('/dashboard');
    } else if (!sessionLoading && user && isAdmin) {
      fetchInitialData();
    }
  }, [sessionLoading, user, isAdmin, navigate, fetchInitialData]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      showError('You must be logged in to create a combo offer.');
      navigate('/login');
      return;
    }
    setIsSubmitting(true);

    try {
      // 1. Create the combo offer
      const { data: newOffer, error: offerError } = await supabase
        .from('combo_offers')
        .insert({
          name: values.offerName,
          description: values.description,
          discount_type: values.discountType,
          discount_value: values.discountValue,
          start_date: values.startDate,
          end_date: values.endDate,
          created_by: user.id,
        })
        .select()
        .single();

      if (offerError) throw offerError;

      // 2. Link products to the combo offer
      const productLinks = values.selectedProductIds.map(productId => ({
        combo_offer_id: newOffer.id,
        product_id: productId,
        quantity: 1, // Default quantity for now, can be extended later
      }));
      const { error: productLinkError } = await supabase
        .from('combo_offer_products')
        .insert(productLinks);
      if (productLinkError) throw productLinkError;

      // 3. Link dealers to the combo offer
      const dealerLinks = values.selectedDealerIds.map(dealerId => ({
        combo_offer_id: newOffer.id,
        dealer_id: dealerId,
      }));
      const { error: dealerLinkError } = await supabase
        .from('combo_offer_dealers')
        .insert(dealerLinks);
      if (dealerLinkError) throw dealerLinkError;

      showSuccess('Combo offer created successfully!');
      form.reset();
      navigate('/manage-combo-offers'); // Redirect to manage page after creation
    } catch (error: any) {
      console.error('Error creating combo offer:', error);
      showError(`Failed to create combo offer: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (sessionLoading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading data...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return null; // Should be redirected by useEffect
  }

  const productOptions = allProducts.map(p => ({ value: p.id, label: `${p.name} (₹${p.price.toFixed(2)})` }));
  const dealerOptions = allDealers.map(d => ({ value: d.id, label: `${d.name} (${d.phone || 'No Phone'})` }));

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-3xl">
        <Button variant="outline" onClick={() => navigate('/admin-dashboard')} className="mb-6 flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Admin Dashboard
        </Button>

        <Card className="bg-card text-card-foreground shadow-lg">
          <CardHeader className="bg-purple-600 dark:bg-purple-800 text-white rounded-t-lg p-4">
            <CardTitle className="text-2xl font-semibold flex items-center gap-2">
              <Gift className="h-6 w-6" /> Create Combo Offer
            </CardTitle>
            <CardDescription className="text-purple-100 dark:text-purple-200">
              Define new combo offers with discounts and assign them to dealers.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
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
                  control={form.control}
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="discountType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Discount Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select discount type" />
                            </SelectTrigger>
                          </FormControl>
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
                    control={form.control}
                    name="discountValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Discount Value</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="e.g., 10 for 10% or 500 for ₹500" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="selectedProductIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Products in Combo</FormLabel>
                      <FormControl>
                        <MultiSelect
                          options={productOptions}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Select products for the combo"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="selectedDealerIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assign to Dealers</FormLabel>
                      <FormControl>
                        <MultiSelect
                          options={dealerOptions}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Select dealers for this offer"
                        />
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
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default CreateComboOffer;