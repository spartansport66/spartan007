"use client";
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { showSuccess, showError } from '@/utils/toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import MultiSelect from '@/components/MultiSelect';

const formSchema = z.object({
  name: z.string().min(2, { message: 'Dealer name must be at least 2 characters.' }),
  contactPerson: z.string().nullable().optional(), // Made optional
  email: z.string().email({ message: 'Please enter a valid email address.' }).nullable().optional(), // Made optional
  phone: z.string().min(10, { message: 'Phone number must be at least 10 digits.' }).max(15, { message: 'Phone number cannot exceed 15 digits.' }),
  address: z.string().min(5, { message: 'Address must be at least 5 characters.' }),
  city: z.string().min(2, { message: 'City must be at least 2 characters.' }),
  state: z.string().min(2, { message: 'State must be at least 2 characters.' }),
  country: z.string().min(2, { message: 'Country must be at least 2 characters.' }),
  creditLimit: z.preprocess(
    (val) => Number(val),
    z.number().min(0, { message: 'Credit limit cannot be negative.' })
  ),
  allottedCreditDays: z.preprocess(
    (val) => Number(val),
    z.number().int().min(0, { message: 'Allotted credit days cannot be negative.' })
  ),
  openingBalance: z.preprocess(
    (val) => Number(val),
    z.number().min(0, { message: 'Opening balance cannot be negative.' })
  ),
  assignedSalesPersonIds: z.array(z.string().uuid()).min(1, { message: 'At least one sales person must be assigned.' }),
  lastBillingDate: z.string().nullable().optional(), // New: Optional last billing date
});

interface SalesPerson {
  id: string;
  first_name: string;
  last_name: string;
}

const AddDealer = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, isAdmin } = useSession();
  const [salesPersons, setSalesPersons] = useState<SalesPerson[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      contactPerson: '', // Default to empty string
      email: '', // Default to empty string
      phone: '',
      address: '',
      city: '',
      state: '',
      country: '',
      creditLimit: 0,
      allottedCreditDays: 0,
      openingBalance: 0,
      assignedSalesPersonIds: [],
      lastBillingDate: '', // Default to empty string
    },
  });

  useEffect(() => {
    const fetchSalesPersons = async () => {
      if (!user) {
        setDataLoading(false);
        return;
      }
      
      // Always fetch all sales persons to populate the options
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('user_type', 'sales_person');
      
      if (error) {
        console.error('Error fetching sales persons:', error);
        showError(`Failed to load sales persons: ${error.message}`);
        setSalesPersons([]);
      } else {
        setSalesPersons(data || []);
      }
      
      // Set default assigned sales person(s) based on role
      if (!isAdmin && user) {
        // If current user is a sales person, automatically assign themselves
        form.setValue('assignedSalesPersonIds', [user.id]);
      } else if (isAdmin) {
        // If admin, leave it empty for them to choose
        form.setValue('assignedSalesPersonIds', []);
      }
      
      setDataLoading(false);
    };
    
    if (!sessionLoading && user) {
      fetchSalesPersons();
    } else if (!sessionLoading && !user) {
      navigate('/login');
    }
  }, [user, sessionLoading, isAdmin, navigate, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      showError('You must be logged in to add a dealer.');
      navigate('/login');
      return;
    }
    
    try {
      const dealerData = {
        user_id: user.id, // Creator of the dealer
        name: values.name,
        contact_person: values.contactPerson || null, // Pass null if optional and empty
        email: values.email || null, // Pass null if optional and empty
        phone: values.phone,
        address: values.address,
        city: values.city,
        state: values.state,
        country: values.country,
        credit_limit: values.creditLimit,
        allotted_credit_days: values.allottedCreditDays,
        last_billing_date: values.lastBillingDate || null, // New: Insert last_billing_date
      };
      
      const { data: newDealer, error: dealerError } = await supabase
        .from('dealers')
        .insert([dealerData])
        .select()
        .single();
      
      if (dealerError) {
        throw dealerError;
      }
      
      // Insert dealer balance
      const { error: balanceError } = await supabase
        .from('dealer_balances')
        .insert({
          dealer_id: newDealer.id,
          opening_balance: values.openingBalance,
          closing_balance: values.openingBalance, // Initially same as opening
        });
      
      if (balanceError) {
        throw balanceError;
      }
      
      // Insert into the new join table: dealer_sales_persons
      const dealerSalesPersonsData = values.assignedSalesPersonIds.map(spId => ({
        dealer_id: newDealer.id,
        sales_person_id: spId,
      }));
      
      const { error: joinTableError } = await supabase
        .from('dealer_sales_persons')
        .insert(dealerSalesPersonsData);
      
      if (joinTableError) {
        throw joinTableError;
      }
      
      showSuccess('Dealer added successfully and sales persons assigned!');
      form.reset();
      console.log('New Dealer Data:', newDealer);
      navigate('/manage-dealers');
    } catch (error: any) {
      console.error('Error adding dealer:', error);
      showError(`Failed to add dealer: ${error.message}`);
    }
  };

  if (sessionLoading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading...</p>
      </div>
    );
  }
  
  const salesPersonOptions = salesPersons.map(sp => ({
    value: sp.id,
    label: `${sp.first_name} ${sp.last_name}`,
  }));

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-md sm:max-w-lg">
        <Button 
          variant="outline" 
          onClick={() => navigate(isAdmin ? '/admin-dashboard' : '/dashboard')} 
          className="mb-6 flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
        
        <Card className="bg-card text-card-foreground shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-primary">Add New Dealer</CardTitle>
            <CardDescription className="text-muted-foreground">
              Enter the details for a new dealer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dealer Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Global Distributors" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="contactPerson"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Person (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Jane Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email (Optional)</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="e.g., jane.doe@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="e.g., +1234567890" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., 123 Main St" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Anytown" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., CA" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., USA" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="creditLimit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Credit Limit</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 5000.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="allottedCreditDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Allotted Credit Days</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 30" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="openingBalance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Opening Balance</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 10000.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lastBillingDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Billing Date (Optional)</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="assignedSalesPersonIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assign Sales Person(s)</FormLabel>
                      <FormControl>
                        <MultiSelect 
                          options={salesPersonOptions}
                          value={field.value} // Changed from 'selected' to 'value'
                          onChange={field.onChange} // Changed from 'onSelect' to 'onChange'
                          placeholder="Select sales person(s)"
                          disabled={!isAdmin} // Disable if not admin, sales person automatically assigns themselves
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                  Add Dealer
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

export default AddDealer;