"use client";
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { showError, showSuccess } from '@/utils/toast';
import { Loader2, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const paymentFormSchema = z.object({
  paymentMethod: z.string().min(1, 'Payment method is required'),
  amountPaid: z.string().min(1, 'Amount is required').refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, 'Amount must be a positive number'),
  paymentDate: z.string().min(1, 'Payment date is required'),
  transactionReference: z.string().optional(),
  remarks: z.string().optional(),
});

interface Dealer {
  id: string;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
}

interface AddPaymentFormProps {
  dealerId: string;
  dealerName: string;
  onPaymentAdded: () => void;
}

const AddPaymentForm: React.FC<AddPaymentFormProps> = ({ dealerId: initialDealerId, dealerName: initialDealerName, onPaymentAdded }) => {
  const { user } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allDealers, setAllDealers] = useState<Dealer[]>([]);
  const [dealerSearchQuery, setDealerSearchQuery] = useState('');
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null);
  const [showDealerDropdown, setShowDealerDropdown] = useState(false);

  useEffect(() => {
    loadDealers();
  }, []);

  useEffect(() => {
    if (!selectedDealer) {
      setSelectedDealer({
        id: initialDealerId,
        name: initialDealerName,
      });
    }
  }, [initialDealerId, initialDealerName]);

  const loadDealers = async () => {
    try {
      const { data, error } = await supabase
        .from('dealers')
        .select('id, name, contact_person, phone, email')
        .order('name', { ascending: true });

      if (error) throw error;
      setAllDealers(data || []);
    } catch (err) {
      console.error('Error loading dealers:', err);
    }
  };

  const filteredDealers = allDealers.filter((dealer) =>
    dealer.name.toLowerCase().includes(dealerSearchQuery.toLowerCase()) ||
    dealer.contact_person?.toLowerCase().includes(dealerSearchQuery.toLowerCase()) ||
    dealer.phone?.includes(dealerSearchQuery)
  );

  const form = useForm<z.infer<typeof paymentFormSchema>>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      paymentMethod: 'cash',
      amountPaid: '',
      paymentDate: new Date().toISOString().split('T')[0],
      transactionReference: '',
      remarks: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof paymentFormSchema>) => {
    if (!user || !selectedDealer) {
      showError('User or dealer not authenticated');
      return;
    }

    setIsSubmitting(true);
    try {
      // Prepare the payment data for payment_received table
      const paymentData = {
        dealer_id: selectedDealer.id,
        payment_method: values.paymentMethod,
        amount: parseFloat(values.amountPaid),
        payment_date: values.paymentDate,
        transaction_reference: values.transactionReference || null,
        remarks: values.remarks || null,
        status: 'pending_approval',
        created_by: user.id,
        sales_person_name: user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Unknown',
      };

      console.log('Inserting payment to payment_received:', paymentData);

      const { data, error } = await supabase
        .from('payment_received')
        .insert([paymentData])
        .select();

      console.log('Insert response:', { data, error });

      if (error) {
        throw error;
      }

      showSuccess(`Payment of ₹${parseFloat(values.amountPaid).toFixed(2)} added successfully for ${dealerName}!`);
      form.reset();
      onPaymentAdded();
    } catch (error: any) {
      console.error('Error adding payment:', error);
      showError(`Failed to add payment: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Dealer Selection - Searchable Dropdown */}
        <div>
          <Label htmlFor="dealer-search-form">Change Dealer (Optional)</Label>
          <div className="relative mt-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="dealer-search-form"
                type="text"
                placeholder="Search to change dealer..."
                value={dealerSearchQuery}
                onChange={(e) => setDealerSearchQuery(e.target.value)}
                onFocus={() => setShowDealerDropdown(true)}
                className="pl-10"
              />
            </div>

            {/* Dropdown List */}
            {showDealerDropdown && dealerSearchQuery.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-48 overflow-y-auto">
                {filteredDealers.length > 0 ? (
                  <ul className="py-1">
                    {filteredDealers.map((dealer) => (
                      <li
                        key={dealer.id}
                        onClick={() => {
                          setSelectedDealer(dealer);
                          setDealerSearchQuery('');
                          setShowDealerDropdown(false);
                        }}
                        className="px-4 py-3 cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <p className="font-medium text-gray-900 dark:text-white">{dealer.name}</p>
                        {dealer.contact_person && (
                          <p className="text-xs text-gray-600 dark:text-gray-400">Contact: {dealer.contact_person}</p>
                        )}
                        {dealer.phone && (
                          <p className="text-xs text-gray-600 dark:text-gray-400">Phone: {dealer.phone}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="px-4 py-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                    No dealers found
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Selected Dealer Info */}
        {selectedDealer && (
          <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase">Selected Dealer</p>
                <h3 className="font-bold text-lg text-blue-900 dark:text-blue-200">{selectedDealer.name}</h3>
                {selectedDealer.contact_person && (
                  <p className="text-sm text-blue-700 dark:text-blue-400">Contact: {selectedDealer.contact_person}</p>
                )}
                {selectedDealer.phone && (
                  <p className="text-sm text-blue-700 dark:text-blue-400">Phone: {selectedDealer.phone}</p>
                )}
                {selectedDealer.email && (
                  <p className="text-sm text-blue-700 dark:text-blue-400">Email: {selectedDealer.email}</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Amount Paid */}
        <FormField
          control={form.control}
          name="amountPaid"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Amount Paid (₹)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  step="0.01"
                  min="0"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Payment Method */}
        <FormField
          control={form.control}
          name="paymentMethod"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Payment Method</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="debit_card">Debit Card</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Payment Date */}
        <FormField
          control={form.control}
          name="paymentDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Payment Date</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Transaction Reference */}
        <FormField
          control={form.control}
          name="transactionReference"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Transaction Reference (Optional)</FormLabel>
              <FormControl>
                <Input
                  placeholder="Cheque number, UPI ID, or transaction ID"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Remarks */}
        <FormField
          control={form.control}
          name="remarks"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Remarks (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Add any additional notes..."
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-primary text-white hover:bg-primary/90"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Adding Payment...
            </>
          ) : (
            'Add Payment'
          )}
        </Button>
      </form>
    </Form>
  );
};

export default AddPaymentForm;
