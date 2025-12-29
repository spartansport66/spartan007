"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { ArrowLeft, Edit, Trash2, Eye, Loader2 } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'; // Added FormField, FormItem, FormLabel
import MultiSelect from '@/components/MultiSelect'; // Import MultiSelect

interface Dealer {
  id: string;
  name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  credit_limit: number;
  user_id: string;
  assigned_sales_persons: { id: string; first_name: string; last_name: string }[]; // Updated to array
}

interface SalesPerson {
  id: string;
  first_name: string;
  last_name: string;
}

const formSchema = z.object({
  name: z.string().min(2, { message: 'Dealer name must be at least 2 characters.' }),
  contactPerson: z.string().min(2, { message: 'Contact person name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  phone: z.string().min(10, { message: 'Phone number must be at least 10 digits.' }).max(15, { message: 'Phone number cannot exceed 15 digits.' }),
  address: z.string().min(5, { message: 'Address must be at least 5 characters.' }),
  city: z.string().min(2, { message: 'City must be at least 2 characters.' }),
  state: z.string().min(2, { message: 'State must be at least 2 characters.' }),
  country: z.string().min(2, { message: 'Country must be at least 2 characters.' }),
  creditLimit: z.preprocess(
    (val) => Number(val),
    z.number().min(0, { message: 'Credit limit cannot be negative.' })
  ),
  assignedSalesPersonIds: z.array(z.string().uuid()).min(1, { message: 'At least one sales person must be assigned.' }),
});

const ManageDealers = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, isAdmin } = useSession();
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null);
  const [allSalesPersons, setAllSalesPersons] = useState<SalesPerson[]>([]); // All sales persons for multi-select options

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      contactPerson: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      country: '',
      creditLimit: 0,
      assignedSalesPersonIds: [],
    },
  });

  useEffect(() => {
    if (selectedDealer) {
      form.reset({
        name: selectedDealer.name,
        contactPerson: selectedDealer.contact_person,
        email: selectedDealer.email,
        phone: selectedDealer.phone,
        address: selectedDealer.address,
        city: selectedDealer.city,
        state: selectedDealer.state,
        country: selectedDealer.country,
        creditLimit: selectedDealer.credit_limit,
        assignedSalesPersonIds: selectedDealer.assigned_sales_persons.map(sp => sp.id),
      });
    }
  }, [selectedDealer, form]);

  const fetchAllSalesPersons = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .eq('user_type', 'sales_person');

    if (error) {
      console.error('Error fetching all sales persons:', error);
      showError(`Failed to load sales persons: ${error.message}`);
    } else {
      setAllSalesPersons(data || []);
    }
  }, []);

  const fetchDealers = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    // Fetch dealers and their assigned sales persons
    const { data, error } = await supabase
      .from('dealers')
      .select(`
        *,
        dealer_sales_persons(sales_person_id, profiles(id, first_name, last_name))
      `);

    if (error) {
      console.error('Error fetching dealers:', error);
      setError(`Failed to load dealers: ${error.message}`);
      showError(`Failed to load dealers: ${error.message}`);
      setDealers([]);
    } else {
      const formattedDealers: Dealer[] = (data || []).map((d: any) => ({
        ...d,
        assigned_sales_persons: d.dealer_sales_persons.map((dsp: any) => ({
          id: dsp.profiles.id,
          first_name: dsp.profiles.first_name,
          last_name: dsp.profiles.last_name,
        })),
      }));
      setDealers(formattedDealers);
    }
    setLoading(false);
  }, [user]); // Removed isAdmin from dependency array as RLS handles filtering

  useEffect(() => {
    if (!sessionLoading && user) {
      fetchAllSalesPersons();
      fetchDealers();
    } else if (!sessionLoading && !user) {
      navigate('/login');
    }
  }, [sessionLoading, user, fetchDealers, fetchAllSalesPersons, navigate]);

  const handleEdit = (dealer: Dealer) => {
    setSelectedDealer(dealer);
    setIsEditDialogOpen(true);
  };

  const handleUpdateDealer = async (values: z.infer<typeof formSchema>) => {
    if (!selectedDealer || !user) return;

    const updateData: Partial<Omit<Dealer, 'assigned_sales_persons'>> = {
      name: values.name,
      contact_person: values.contactPerson,
      email: values.email,
      phone: values.phone,
      address: values.address,
      city: values.city,
      state: values.state,
      country: values.country,
      credit_limit: values.creditLimit,
    };

    const { error: dealerUpdateError } = await supabase
      .from('dealers')
      .update(updateData)
      .eq('id', selectedDealer.id);

    if (dealerUpdateError) {
      console.error('Error updating dealer:', dealerUpdateError);
      showError(`Failed to update dealer: ${dealerUpdateError.message}`);
      return;
    }

    // Update dealer_sales_persons join table
    const currentAssignedIds = selectedDealer.assigned_sales_persons.map(sp => sp.id);
    const newAssignedIds = values.assignedSalesPersonIds;

    const toAdd = newAssignedIds.filter(id => !currentAssignedIds.includes(id));
    const toRemove = currentAssignedIds.filter(id => !newAssignedIds.includes(id));

    if (toAdd.length > 0) {
      const { error: addError } = await supabase
        .from('dealer_sales_persons')
        .insert(toAdd.map(spId => ({ dealer_id: selectedDealer.id, sales_person_id: spId })));
      if (addError) {
        console.error('Error adding sales persons:', addError);
        showError(`Failed to assign sales persons: ${addError.message}`);
        return;
      }
    }

    if (toRemove.length > 0) {
      const { error: removeError } = await supabase
        .from('dealer_sales_persons')
        .delete()
        .eq('dealer_id', selectedDealer.id)
        .in('sales_person_id', toRemove);
      if (removeError) {
        console.error('Error removing sales persons:', removeError);
        showError(`Failed to unassign sales persons: ${removeError.message}`);
        return;
      }
    }

    showSuccess('Dealer updated successfully!');
    setIsEditDialogOpen(false);
    fetchDealers(); // Refresh data
  };

  const handleDelete = async (dealerId: string) => {
    const { error } = await supabase
      .from('dealers')
      .delete()
      .eq('id', dealerId);

    if (error) {
      console.error('Error deleting dealer:', error);
      showError(`Failed to delete dealer: ${error.message}`);
    } else {
      showSuccess('Dealer deleted successfully!');
      fetchDealers();
    }
  };

  if (sessionLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading dealers...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
        <p className="text-lg text-red-600 dark:text-red-400 mb-4">{error}</p>
        <Button onClick={() => navigate(isAdmin ? '/admin-dashboard' : '/dashboard')} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Button>
      </div>
    );
  }

  const salesPersonOptions = allSalesPersons.map(sp => ({
    value: sp.id,
    label: `${sp.first_name} ${sp.last_name}`,
  }));

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-full">
        <Button variant="outline" onClick={() => navigate(isAdmin ? '/admin-dashboard' : '/dashboard')} className="mb-6 flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Button>

        <Card className="bg-card text-card-foreground shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-primary">Manage Dealers</CardTitle>
            <CardDescription className="text-muted-foreground">View, edit, or delete your registered dealers.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              {dealers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No dealers found. Add a new dealer to get started!</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted hover:bg-muted/90">
                      <TableHead className="text-muted-foreground">Name</TableHead>
                      <TableHead className="text-muted-foreground">Contact Person</TableHead>
                      <TableHead className="text-muted-foreground">Email</TableHead>
                      <TableHead className="text-muted-foreground">Phone</TableHead>
                      <TableHead className="text-muted-foreground">Address</TableHead>
                      <TableHead className="text-muted-foreground">City</TableHead>
                      <TableHead className="text-muted-foreground">State</TableHead>
                      <TableHead className="text-muted-foreground">Country</TableHead>
                      <TableHead className="text-muted-foreground">Credit Limit</TableHead>
                      <TableHead className="text-muted-foreground">Assigned To</TableHead>
                      <TableHead className="text-muted-foreground">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dealers.map((dealer) => (
                      <TableRow key={dealer.id} className="hover:bg-accent/50">
                        <TableCell className="font-medium text-foreground">{dealer.name}</TableCell>
                        <TableCell className="text-muted-foreground">{dealer.contact_person}</TableCell>
                        <TableCell className="text-muted-foreground">{dealer.email}</TableCell>
                        <TableCell className="text-muted-foreground">{dealer.phone}</TableCell>
                        <TableCell className="text-muted-foreground">{dealer.address}</TableCell>
                        <TableCell className="text-muted-foreground">{dealer.city}</TableCell>
                        <TableCell className="text-muted-foreground">{dealer.state}</TableCell>
                        <TableCell className="text-muted-foreground">{dealer.country}</TableCell>
                        <TableCell className="text-muted-foreground">₹{dealer.credit_limit.toFixed(2)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {dealer.assigned_sales_persons.length > 0
                            ? dealer.assigned_sales_persons.map(sp => `${sp.first_name} ${sp.last_name}`).join(', ')
                            : 'Unassigned'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(dealer)} title="Edit Dealer">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" title="Delete Dealer">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the dealer.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(dealer.id)}>Continue</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
            <div className="mt-6 text-right">
              <Button onClick={() => navigate('/add-dealer')} className="bg-primary text-primary-foreground hover:bg-primary/90">
                Add New Dealer
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <MadeWithDyad />

      {selectedDealer && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Dealer</DialogTitle>
              <DialogDescription>
                Make changes to the dealer here. Click save when you're done.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(handleUpdateDealer)} className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Input id="name" {...form.register('name')} className="col-span-3" />
                {form.formState.errors.name && <p className="col-span-4 text-right text-sm text-destructive">{form.formState.errors.name.message}</p>}
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="contactPerson" className="text-right">
                  Contact Person
                </Label>
                <Input id="contactPerson" {...form.register('contactPerson')} className="col-span-3" />
                {form.formState.errors.contactPerson && <p className="col-span-4 text-right text-sm text-destructive">{form.formState.errors.contactPerson.message}</p>}
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="email" className="text-right">
                  Email
                </Label>
                <Input id="email" type="email" {...form.register('email')} className="col-span-3" />
                {form.formState.errors.email && <p className="col-span-4 text-right text-sm text-destructive">{form.formState.errors.email.message}</p>}
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="phone" className="text-right">
                  Phone
                </Label>
                <Input id="phone" type="tel" {...form.register('phone')} className="col-span-3" />
                {form.formState.errors.phone && <p className="col-span-4 text-right text-sm text-destructive">{form.formState.errors.phone.message}</p>}
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="address" className="text-right">
                  Address
                </Label>
                <Input id="address" {...form.register('address')} className="col-span-3" />
                {form.formState.errors.address && <p className="col-span-4 text-right text-sm text-destructive">{form.formState.errors.address.message}</p>}
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="city" className="text-right">
                  City
                </Label>
                <Input id="city" {...form.register('city')} className="col-span-3" />
                {form.formState.errors.city && <p className="col-span-4 text-right text-sm text-destructive">{form.formState.errors.city.message}</p>}
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="state" className="text-right">
                  State
                </Label>
                <Input id="state" {...form.register('state')} className="col-span-3" />
                {form.formState.errors.state && <p className="col-span-4 text-right text-sm text-destructive">{form.formState.errors.state.message}</p>}
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="country" className="text-right">
                  Country
                </Label>
                <Input id="country" {...form.register('country')} className="col-span-3" />
                {form.formState.errors.country && <p className="col-span-4 text-right text-sm text-destructive">{form.formState.errors.country.message}</p>}
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="creditLimit" className="text-right">
                  Credit Limit
                </Label>
                <Input id="creditLimit" type="number" placeholder="e.g., 5000.00" {...form.register('creditLimit')} className="col-span-3" />
                {form.formState.errors.creditLimit && <p className="col-span-4 text-right text-sm text-destructive">{form.formState.errors.creditLimit.message}</p>}
              </div>
              <FormField
                control={form.control}
                name="assignedSalesPersonIds"
                render={({ field }) => (
                  <FormItem className="grid grid-cols-4 items-center gap-4">
                    <FormLabel className="text-right">Assign to</FormLabel>
                    <FormControl className="col-span-3">
                      <MultiSelect
                        options={salesPersonOptions}
                        value={field.value} // Changed from 'selected' to 'value'
                        onChange={field.onChange} // Changed from 'onSelect' to 'onChange'
                        placeholder="Select sales person(s)"
                        disabled={!isAdmin} // Only admin can change assignments
                      />
                    </FormControl>
                    {form.formState.errors.assignedSalesPersonIds && <p className="col-span-4 text-right text-sm text-destructive">{form.formState.errors.assignedSalesPersonIds.message}</p>}
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit">Save changes</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default ManageDealers;