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
import { ArrowLeft, Edit, Trash2, Loader2, CalendarDays, Upload, FileSpreadsheet, Search, Printer } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import MultiSelect from '@/components/MultiSelect';
import DealerMonthlyCreditManager from '@/components/DealerMonthlyCreditManager';
import DealerExcelUpload from '@/components/DealerExcelUpload';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';

interface DealerBalanceFromQuery {
  opening_balance: number | null;
  closing_balance: number | null;
}

interface DealerWithRelations {
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
  allotted_credit_days: number;
  user_id: string;
  last_billing_date: string | null; // New: Directly from dealers table
  dealer_sales_persons: { sales_person_id: string; profiles: { id: string; first_name: string; last_name: string } }[];
  dealer_balances: { opening_balance: number | null } | null; // Corrected type to object or null
  dealer_monthly_credit_limits: { dealer_id: string; credit_limit: number; month_year: string }[];
  orders: { 
    total_amount: number; 
    payment_status: string;
    payments: { amount: number; status: string }[]; // Payments are nested under orders
  }[]; // Added orders
}

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
  allotted_credit_days: number;
  user_id: string;
  last_billing_date: string | null; // New: Directly from dealers table
  assigned_sales_persons: { id: string; first_name: string; last_name: string }[];
  current_month_credit_limit: number;
  opening_balance: number;
  current_balance: number; // New field for calculated current balance
}

interface SalesPerson {
  id: string;
  first_name: string;
  last_name: string;
}

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

const ManageDealers = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, isAdmin } = useSession();
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null);
  const [allSalesPersons, setAllSalesPersons] = useState<SalesPerson[]>([]);
  const [isMonthlyCreditDialogOpen, setIsMonthlyCreditDialogOpen] = useState(false);
  const [selectedDealerForMonthlyCredit, setSelectedDealerForMonthlyCredit] = useState<Dealer | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [companyName, setCompanyName] = useState<string | null>(null); // New state for company name

  // Applied filter states (used for fetching data)
  const [appliedFilterDealerName, setAppliedFilterDealerName] = useState<string>('');
  const [appliedFilterCity, setAppliedFilterCity] = useState<string>('');
  const [appliedFilterState, setAppliedFilterState] = useState<string>('');
  const [appliedFilterSalesPersonId, setAppliedFilterSalesPersonId] = useState<string>('');

  // Pending filter states (bound to input fields)
  const [pendingFilterDealerName, setPendingFilterDealerName] = useState<string>('');
  const [pendingFilterCity, setPendingFilterCity] = useState<string>('');
  const [pendingFilterState, setPendingFilterState] = useState<string>('');
  const [pendingFilterSalesPersonId, setPendingFilterSalesPersonId] = useState<string>('');
  
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
    if (selectedDealer) {
      console.log('DEBUG: selectedDealer changed. Resetting form with:', selectedDealer);
      form.reset({
        name: selectedDealer.name,
        contactPerson: selectedDealer.contact_person || '', // Handle null/undefined
        email: selectedDealer.email || '', // Handle null/undefined
        phone: selectedDealer.phone,
        address: selectedDealer.address,
        city: selectedDealer.city,
        state: selectedDealer.state,
        country: selectedDealer.country,
        creditLimit: selectedDealer.credit_limit,
        allottedCreditDays: selectedDealer.allotted_credit_days,
        openingBalance: selectedDealer.opening_balance || 0,
        assignedSalesPersonIds: selectedDealer.assigned_sales_persons.map(sp => sp.id),
        lastBillingDate: selectedDealer.last_billing_date ? selectedDealer.last_billing_date.split('T')[0] : '', // New: Set lastBillingDate
      });
      console.log('DEBUG: Form reset with openingBalance:', selectedDealer.opening_balance || 0);
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
      setAllSalesPersons([]);
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
    
    try {
      let query;
      if (appliedFilterSalesPersonId) {
        // If filtering by sales person, use !inner join to filter dealers that have this sales person
        query = supabase
          .from('dealers')
          .select(`
            id, name, contact_person, email, phone, address, city, state, country, credit_limit, allotted_credit_days, user_id, last_billing_date,
            dealer_sales_persons!inner(sales_person_id, profiles(id, first_name, last_name)),
            dealer_balances(opening_balance),
            dealer_monthly_credit_limits(dealer_id, credit_limit, month_year),
            orders(total_amount, payment_status, payments(amount, status))
          `)
          .eq('dealer_sales_persons.sales_person_id', appliedFilterSalesPersonId);
      } else {
        // If not filtering by sales person, use a regular select to get all dealers and their assignments
        query = supabase
          .from('dealers')
          .select(`
            id, name, contact_person, email, phone, address, city, state, country, credit_limit, allotted_credit_days, user_id, last_billing_date,
            dealer_sales_persons(sales_person_id, profiles(id, first_name, last_name)),
            dealer_balances(opening_balance),
            dealer_monthly_credit_limits(dealer_id, credit_limit, month_year),
            orders(total_amount, payment_status, payments(amount, status))
          `);
      }

      // Apply other filters
      if (appliedFilterDealerName) {
        query = query.ilike('name', `%${appliedFilterDealerName}%`);
      }
      if (appliedFilterCity) {
        query = query.ilike('city', `%${appliedFilterCity}%`);
      }
      if (appliedFilterState) {
        query = query.ilike('state', `%${appliedFilterState}%`);
      }
      
      query = query.order('name', { ascending: true });

      const { data: dealersData, error: dealersError } = await query as { data: DealerWithRelations[] | null; error: any };
      
      if (dealersError) {
        throw dealersError;
      }
      
      console.log('[ManageDealers] Raw dealersData from Supabase:', dealersData);
      
      // Add more specific logging for dealer_balances
      dealersData?.forEach(d => {
        console.log(`[ManageDealers] Dealer ${d.name} (ID: ${d.id}) raw dealer_balances:`, d.dealer_balances);
      });

      // Create a map of dealer balances for easy lookup
      const balancesMap = new Map<string, { opening_balance: number | null }>(); // Corrected type
      dealersData?.forEach(d => {
        // d.dealer_balances will be either an object { opening_balance: ... } or null
        balancesMap.set(d.id, d.dealer_balances || { opening_balance: 0 });
      });
      
      // Get current month for credit limit
      const today = new Date();
      const currentMonthYear = new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1)).toISOString().split('T')[0];
      
      // Create a map of monthly limits for easy lookup
      const monthlyLimitsMap = new Map(
        dealersData?.flatMap(d => d.dealer_monthly_credit_limits?.filter((limit: any) => limit.month_year === currentMonthYear).map((limit: any) => [d.id, limit.credit_limit])) || []
      );
      
      const formattedDealers: Dealer[] = (dealersData || []).map((d: DealerWithRelations) => {
        const assignedSalesPersons = d.dealer_sales_persons.map((dsp: any) => ({
          id: dsp.profiles.id,
          first_name: dsp.profiles.first_name,
          last_name: dsp.profiles.last_name,
        }));
        
        const balance = balancesMap.get(d.id) || { opening_balance: 0 }; // Corrected access
        const openingBalance = balance.opening_balance || 0; // This will now be correct because `balance` itself will be the object, not an array.
        
        const currentMonthCreditLimit = monthlyLimitsMap.has(d.id) 
          ? monthlyLimitsMap.get(d.id)! 
          : d.credit_limit;

        // Calculate current balance
        let currentBalance = openingBalance;
        console.log(`[ManageDealers] Dealer ${d.name} (ID: ${d.id}) initial currentBalance from opening_balance: ${openingBalance}`);

        (d.orders || []).forEach(order => {
          // All orders are debits (increase amount owed)
          currentBalance += order.total_amount;
          // Now, iterate through payments associated with this order
          (order.payments || []).forEach(payment => {
            if (payment.status === 'completed') {
              currentBalance -= payment.amount;
            }
          });
        });
        
        const dealerObject = {
          ...d,
          assigned_sales_persons: assignedSalesPersons,
          current_month_credit_limit: currentMonthCreditLimit,
          opening_balance: openingBalance,
          current_balance: currentBalance, // Use calculated current balance
        };
        console.log(`[ManageDealers] Dealer ${dealerObject.name} (ID: ${dealerObject.id}) - Opening Balance: ${dealerObject.opening_balance}, Current Balance: ${dealerObject.current_balance}`);
        return dealerObject;
      });
      
      setDealers(formattedDealers);
    } catch (error: any) {
      console.error('Error fetching dealers:', error);
      setError(`Failed to load dealers: ${error.message}`);
      showError(`Failed to load dealers: ${error.message}`);
      setDealers([]);
    } finally {
      setLoading(false);
    }
  }, [user, appliedFilterDealerName, appliedFilterCity, appliedFilterState, appliedFilterSalesPersonId]); // Dependencies are now the *applied* filters

  const fetchCompanyInfo = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('company_info')
        .select('company_name')
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      setCompanyName(data?.company_name || null);
    } catch (error: any) {
      console.error('Error fetching company name for PDF:', error.message);
      setCompanyName(null);
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading && user) {
      fetchAllSalesPersons();
      fetchDealers();
      fetchCompanyInfo(); // Fetch company info here
    } else if (!sessionLoading && !user) {
      navigate('/login');
    }
  }, [sessionLoading, user, fetchDealers, fetchAllSalesPersons, fetchCompanyInfo, navigate]);

  const handleEdit = (dealer: Dealer) => {
    setSelectedDealer(dealer);
    setIsEditDialogOpen(true);
  };

  const handleManageMonthlyCredit = (dealer: Dealer) => {
    setSelectedDealerForMonthlyCredit(dealer);
    setIsMonthlyCreditDialogOpen(true);
  };

  const handleUpdateDealer = async (values: z.infer<typeof formSchema>) => {
    if (!selectedDealer || !user) return;
    
    try {
      // Update dealer information
      const updateData: Partial<Omit<Dealer, 'assigned_sales_persons' | 'current_month_credit_limit' | 'opening_balance' | 'current_balance'>> = {
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
        last_billing_date: values.lastBillingDate || null, // New: Update last_billing_date
      };
      
      const { error: dealerUpdateError } = await supabase
        .from('dealers')
        .update(updateData)
        .eq('id', selectedDealer.id);
      
      if (dealerUpdateError) {
        throw dealerUpdateError;
      }
      
      // Update dealer balance
      const { data: balanceUpsertData, error: balanceUpdateError } = await supabase
        .from('dealer_balances')
        .upsert({
          dealer_id: selectedDealer.id,
          opening_balance: values.openingBalance,
          // Removed closing_balance from here, as it should be dynamically calculated
        }, { onConflict: 'dealer_id' })
        .select(); // Select the updated data to log it
      
      if (balanceUpdateError) {
        console.error('Error updating dealer balance:', balanceUpdateError); // Log the actual error
        throw balanceUpdateError;
      }
      
      // Update sales person assignments
      const currentAssignedIds = selectedDealer.assigned_sales_persons.map(sp => sp.id);
      const newAssignedIds = values.assignedSalesPersonIds;
      const toAdd = newAssignedIds.filter(id => !currentAssignedIds.includes(id));
      const toRemove = currentAssignedIds.filter(id => !newAssignedIds.includes(id));
      
      if (toAdd.length > 0) {
        const { error: addError } = await supabase
          .from('dealer_sales_persons')
          .insert(toAdd.map(spId => ({
            dealer_id: selectedDealer.id,
            sales_person_id: spId
          })));
        
        if (addError) {
          throw addError;
        }
      }
      
      if (toRemove.length > 0) {
        const { error: removeError } = await supabase
          .from('dealer_sales_persons')
          .delete()
          .eq('dealer_id', selectedDealer.id)
          .in('sales_person_id', toRemove);
        
        if (removeError) {
          throw removeError;
        }
      }
      
      showSuccess('Dealer updated successfully!');
      setIsEditDialogOpen(false);
      fetchDealers();
    } catch (error: any) {
      console.error('Error updating dealer:', error);
      showError(`Failed to update dealer: ${error.message}`);
    }
  };

  const handleDelete = async (dealerId: string) => {
    try {
      const { error } = await supabase
        .from('dealers')
        .delete()
        .eq('id', dealerId);
      
      if (error) {
        throw error;
      }
      
      showSuccess('Dealer deleted successfully!');
      fetchDealers();
    } catch (error: any) {
      console.error('Error deleting dealer:', error);
      showError(`Failed to delete dealer: ${error.message}`);
    }
  };

  const handleUploadComplete = () => {
    fetchDealers();
    setIsUploadDialogOpen(false);
  };

  const handleApplyFilters = () => {
    setAppliedFilterDealerName(pendingFilterDealerName);
    setAppliedFilterCity(pendingFilterCity);
    setAppliedFilterState(pendingFilterState);
    setAppliedFilterSalesPersonId(pendingFilterSalesPersonId);
    // fetchDealers will be called by the useEffect due to dependency change
  };

  const handleClearFilters = () => {
    setPendingFilterDealerName('');
    setPendingFilterCity('');
    setPendingFilterState('');
    setPendingFilterSalesPersonId('');
    setAppliedFilterDealerName('');
    setAppliedFilterCity('');
    setAppliedFilterState('');
    setAppliedFilterSalesPersonId('');
    // fetchDealers will be called by the useEffect due to dependency change
  };

  const handlePrint = () => {
    try {
      const doc = new jsPDF({
        orientation: 'landscape' // Landscape for more columns
      });

      const companyNameText = companyName ? companyName.toUpperCase() : "COMPANY NAME";
      doc.setFontSize(22);
      doc.text(companyNameText, doc.internal.pageSize.width / 2, 15, { align: 'center' });
      doc.setFontSize(18);
      doc.text("Dealer Report", doc.internal.pageSize.width / 2, 25, { align: 'center' });
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, doc.internal.pageSize.width / 2, 32, { align: 'center' });

      const tableColumn = [
        "Name", "Contact Person", "Email", "Phone", "Address", "City", "State", "Country",
        "Opening Balance", "Current Balance", "Monthly Credit Limit", "Credit Days", "Last Billing Date", "Assigned To"
      ];
      const tableRows = dealers.map(dealer => [
        dealer.name,
        dealer.contact_person || 'N/A',
        dealer.email || 'N/A',
        dealer.phone || 'N/A',
        dealer.address,
        dealer.city || 'N/A',
        dealer.state || 'N/A',
        dealer.country || 'N/A',
        `₹${dealer.opening_balance.toFixed(2)}`,
        `₹${dealer.current_balance.toFixed(2)}`, // Use calculated current balance
        `₹${dealer.current_month_credit_limit.toFixed(2)}`,
        dealer.allotted_credit_days, 
        dealer.last_billing_date ? new Date(dealer.last_billing_date).toLocaleDateString() : 'N/A', // New: Display last_billing_date
        dealer.assigned_sales_persons.length > 0
          ? dealer.assigned_sales_persons.map(sp => `${sp.first_name} ${sp.last_name || ''}`.trim()).join(', ')
          : 'Unassigned',
      ]);

      const totalOpeningBalance = dealers.reduce((sum, dealer) => sum + dealer.opening_balance, 0);
      const totalCurrentBalance = dealers.reduce((sum, dealer) => sum + dealer.current_balance, 0); // Sum of current balances
      const totalMonthlyCreditLimit = dealers.reduce((sum, dealer) => sum + dealer.current_month_credit_limit, 0);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        foot: [
          [
            { content: 'Totals', colSpan: 8, styles: { halign: 'right', fontStyle: 'bold' } },
            `₹${totalOpeningBalance.toFixed(2)}`,
            `₹${totalCurrentBalance.toFixed(2)}`, // Display total current balance
            `₹${totalMonthlyCreditLimit.toFixed(2)}`,
            '', // Credit Days
            '', // Last Billing Date
            '', // Assigned To
          ]
        ],
        startY: 45, // Adjusted startY to accommodate the new header
        styles: {
          fontSize: 7,
          cellPadding: 2,
          valign: 'middle',
          overflow: 'linebreak'
        },
        headStyles: {
          fillColor: [30, 58, 138], // Dark blue (similar to indigo-800)
          textColor: [255, 255, 255], // White
          fontStyle: 'bold',
          halign: 'center',
        },
        bodyStyles: {
          textColor: [0, 0, 0],
        },
        footStyles: {
          fillColor: [220, 220, 220], // Light gray
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          fontSize: 8,
        },
        margin: { top: 10, left: 10, right: 10 },
        columnStyles: {
          0: { cellWidth: 20 }, // Name
          1: { cellWidth: 20 }, // Contact Person
          2: { cellWidth: 30 }, // Email
          3: { cellWidth: 20 }, // Phone
          4: { cellWidth: 30 }, // Address
          5: { cellWidth: 15 }, // City
          6: { cellWidth: 15 }, // State
          7: { cellWidth: 15 }, // Country
          8: { cellWidth: 20, halign: 'right' }, // Opening Balance
          9: { cellWidth: 20, halign: 'right' }, // Current Balance
          10: { cellWidth: 20, halign: 'right' }, // Monthly Credit Limit
          11: { cellWidth: 15, halign: 'right' }, // Credit Days
          12: { cellWidth: 20, halign: 'center' }, // Last Billing Date
          13: { cellWidth: 35 }, // Assigned To
        }
      });

      doc.save('dealer_report.pdf');
      showSuccess('Dealer report generated successfully!');
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      showError(`Failed to generate dealer report: ${error.message || 'An unknown error occurred.'}`);
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
        <Button 
          onClick={() => navigate(isAdmin ? '/admin-dashboard' : '/dashboard')} 
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const salesPersonOptions = allSalesPersons.map(sp => ({
    value: sp.id,
    label: `${sp.first_name} ${sp.last_name || ''}`.trim(),
  }));

  return (
    <div className="h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-full flex flex-col flex-grow overflow-hidden">
        <Button 
          variant="outline" 
          onClick={() => navigate(isAdmin ? '/admin-dashboard' : '/dashboard')} 
          className="mb-6 flex items-center gap-2 flex-shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
        
        <div className="grid grid-cols-1 gap-6 mb-6 flex-grow overflow-hidden">
          <Card className="bg-card text-card-foreground shadow-lg flex flex-col flex-grow overflow-hidden">
            <CardHeader className="flex-shrink-0">
              <CardTitle className="text-2xl font-semibold text-primary">Manage Dealers</CardTitle>
              <CardDescription className="text-muted-foreground">
                View, edit, or delete your registered dealers.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 flex flex-col flex-grow overflow-hidden">
              {/* Filter Section */}
              <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-muted rounded-lg flex-shrink-0">
                <div className="flex-1 min-w-[150px]">
                  <Label htmlFor="filterDealerName">Dealer Name</Label>
                  <Input
                    id="filterDealerName"
                    placeholder="Filter by name"
                    value={pendingFilterDealerName}
                    onChange={(e) => setPendingFilterDealerName(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="flex-1 min-w-[100px]">
                  <Label htmlFor="filterCity">City</Label>
                  <Input
                    id="filterCity"
                    placeholder="Filter by city"
                    value={pendingFilterCity}
                    onChange={(e) => setPendingFilterCity(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="flex-1 min-w-[100px]">
                  <Label htmlFor="filterState">State</Label>
                  <Input
                    id="filterState"
                    placeholder="Filter by state"
                    value={pendingFilterState}
                    onChange={(e) => setPendingFilterState(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="flex-1 min-w-[150px]">
                  <Label htmlFor="filterSalesPerson">Assigned Sales Person</Label>
                  <Select value={pendingFilterSalesPersonId || "all"} onValueChange={(value) => setPendingFilterSalesPersonId(value === "all" ? "" : value)}>
                    <SelectTrigger id="filterSalesPerson" className="w-full">
                      <SelectValue placeholder="All Sales Persons" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sales Persons</SelectItem>
                      {allSalesPersons.map(sp => (
                        <SelectItem key={sp.id} value={sp.id}>{sp.first_name} {sp.last_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleApplyFilters} className="flex items-center gap-2">
                  <Search className="h-4 w-4" /> Apply Filters
                </Button>
                <Button variant="outline" onClick={handleClearFilters} className="flex items-center gap-2">
                  Clear Filters
                </Button>
                <Button variant="outline" onClick={handlePrint} disabled={dealers.length === 0} className="flex items-center gap-2">
                  <Printer className="h-4 w-4" /> Print Report
                </Button>
              </div>

              <div className="overflow-x-auto flex-grow overflow-y-auto border rounded-md">
                {dealers.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No dealers found. Add a new dealer to get started!
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted hover:bg-muted/90">
                        <TableHead className="text-muted-foreground">Name</TableHead>
                        <TableHead className="text-muted-foreground">Contact Person</TableHead>
                        <TableHead className="text-muted-foreground">Email</TableHead>
                        <TableHead className="text-muted-foreground">Phone</TableHead>
                        <TableHead className="text-muted-foreground">City</TableHead>
                        <TableHead className="text-muted-foreground">State</TableHead>
                        <TableHead className="text-muted-foreground">Country</TableHead>
                        <TableHead className="text-muted-foreground">Opening Balance</TableHead>
                        <TableHead className="text-muted-foreground">Current Balance</TableHead>
                        <TableHead className="text-muted-foreground">Monthly Credit Limit</TableHead>
                        <TableHead className="text-muted-foreground">Credit Days</TableHead>
                        <TableHead className="text-muted-foreground">Last Billing Date</TableHead> {/* New Table Head */}
                        <TableHead className="text-muted-foreground">Assigned To</TableHead>
                        <TableHead className="text-muted-foreground">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dealers.map((dealer) => (
                        <TableRow key={dealer.id} className="hover:bg-accent/50">
                          <TableCell className="font-medium text-foreground">{dealer.name}</TableCell>
                          <TableCell className="text-muted-foreground">{dealer.contact_person || 'N/A'}</TableCell>
                          <TableCell className="text-muted-foreground">{dealer.email || 'N/A'}</TableCell>
                          <TableCell className="text-muted-foreground">{dealer.phone || 'N/A'}</TableCell>
                          <TableCell className="text-muted-foreground">{dealer.city || 'N/A'}</TableCell>
                          <TableCell className="text-muted-foreground">{dealer.state || 'N/A'}</TableCell>
                          <TableCell className="text-muted-foreground">{dealer.country || 'N/A'}</TableCell>
                          <TableCell className={`text-muted-foreground ${dealer.opening_balance > 0 ? 'text-red-600 font-semibold' : ''}`}>
                            ₹{dealer.opening_balance.toFixed(2)}
                          </TableCell>
                          <TableCell className={`text-muted-foreground ${dealer.current_balance > 0 ? 'text-red-600 font-semibold' : ''}`}>
                            ₹{dealer.current_balance.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">₹{dealer.current_month_credit_limit.toFixed(2)}</TableCell>
                          <TableCell className="text-muted-foreground">{dealer.allotted_credit_days}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {dealer.last_billing_date ? new Date(dealer.last_billing_date).toLocaleDateString() : 'N/A'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {dealer.assigned_sales_persons.length > 0 
                              ? dealer.assigned_sales_persons.map(sp => `${sp.first_name} ${sp.last_name || ''}`.trim()).join(', ') 
                              : 'Unassigned'}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleEdit(dealer)} 
                                title="Edit Dealer"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleManageMonthlyCredit(dealer)} 
                                title="Manage Monthly Credit Limits"
                              >
                                <CalendarDays className="h-4 w-4" />
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
              
              <div className="mt-6 flex flex-wrap gap-4 flex-shrink-0">
                <Button 
                  onClick={() => navigate('/add-dealer')} 
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Add New Dealer
                </Button>
                <Button 
                  onClick={() => setIsUploadDialogOpen(true)} 
                  className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Bulk Upload Dealers
                </Button>
                <Button 
                  onClick={() => navigate('/sheet-converter')} 
                  variant="outline" 
                  className="flex items-center gap-2"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Sheet Converter
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
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
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleUpdateDealer)} className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    Name
                  </Label>
                  <Input
                    id="name"
                    {...form.register('name')}
                    className="col-span-3"
                  />
                  {form.formState.errors.name && <p className="col-span-4 text-right text-sm text-destructive">{form.formState.errors.name.message}</p>}
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="contactPerson" className="text-right">
                    Contact Person (Optional)
                  </Label>
                  <Input
                    id="contactPerson"
                    {...form.register('contactPerson')}
                    className="col-span-3"
                  />
                  {form.formState.errors.contactPerson && <p className="col-span-4 text-right text-sm text-destructive">{form.formState.errors.contactPerson.message}</p>}
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="email" className="text-right">
                    Email (Optional)
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    {...form.register('email')}
                    className="col-span-3"
                  />
                  {form.formState.errors.email && <p className="col-span-4 text-right text-sm text-destructive">{form.formState.errors.email.message}</p>}
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="phone" className="text-right">
                    Phone
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    {...form.register('phone')}
                    className="col-span-3"
                  />
                  {form.formState.errors.phone && <p className="col-span-4 text-right text-sm text-destructive">{form.formState.errors.phone.message}</p>}
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="address" className="text-right">
                    Address
                  </Label>
                  <Input
                    id="address"
                    {...form.register('address')}
                    className="col-span-3"
                  />
                  {form.formState.errors.address && <p className="col-span-4 text-right text-sm text-destructive">{form.formState.errors.address.message}</p>}
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="city" className="text-right">
                    City
                  </Label>
                  <Input
                    id="city"
                    {...form.register('city')}
                    className="col-span-3"
                  />
                  {form.formState.errors.city && <p className="col-span-4 text-right text-sm text-destructive">{form.formState.errors.city.message}</p>}
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="state" className="text-right">
                    State
                  </Label>
                  <Input
                    id="state"
                    {...form.register('state')}
                    className="col-span-3"
                  />
                  {form.formState.errors.state && <p className="col-span-4 text-right text-sm text-destructive">{form.formState.errors.state.message}</p>}
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="country" className="text-right">
                    Country
                  </Label>
                  <Input
                    id="country"
                    {...form.register('country')}
                    className="col-span-3"
                  />
                  {form.formState.errors.country && <p className="col-span-4 text-right text-sm text-destructive">{form.formState.errors.country.message}</p>}
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="creditLimit" className="text-right">
                    Credit Limit
                  </Label>
                  <Input
                    id="creditLimit"
                    type="number"
                    placeholder="e.g., 5000.00"
                    {...form.register('creditLimit')}
                    className="col-span-3"
                  />
                  {form.formState.errors.creditLimit && <p className="col-span-4 text-right text-sm text-destructive">{form.formState.errors.creditLimit.message}</p>}
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="allottedCreditDays" className="text-right">
                    Credit Days
                  </Label>
                  <Input
                    id="allottedCreditDays"
                    type="number"
                    placeholder="e.g., 30"
                    {...form.register('allottedCreditDays')}
                    className="col-span-3"
                  />
                  {form.formState.errors.allottedCreditDays && <p className="col-span-4 text-right text-sm text-destructive">{form.formState.errors.allottedCreditDays.message}</p>}
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="openingBalance" className="text-right">
                    Opening Balance
                  </Label>
                  <Input
                    id="openingBalance"
                    type="number"
                    step="0.01" // Added step for decimal input
                    placeholder="e.g., 10000.00"
                    {...form.register('openingBalance')}
                    className="col-span-3"
                  />
                  {form.formState.errors.openingBalance && <p className="col-span-4 text-right text-sm text-destructive">{form.formState.errors.openingBalance.message}</p>}
                </div>
                <FormField
                  control={form.control}
                  name="lastBillingDate"
                  render={({ field }) => (
                    <FormItem className="grid grid-cols-4 items-center gap-4">
                      <FormLabel htmlFor="lastBillingDate" className="text-right">
                        Last Billing Date (Optional)
                      </FormLabel>
                      <FormControl className="col-span-3">
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage className="col-span-4 text-right" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="assignedSalesPersonIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-right">Assign to</FormLabel>
                      <FormControl>
                        <MultiSelect
                          options={salesPersonOptions}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Select sales person(s)"
                          disabled={!isAdmin}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit">Save changes</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}
      
      {selectedDealerForMonthlyCredit && (
        <Dialog open={isMonthlyCreditDialogOpen} onOpenChange={setIsMonthlyCreditDialogOpen}>
          <DialogContent className="sm:max-w-[700px]">
            <DialogHeader>
              <DialogTitle>Manage Monthly Credit Limits for {selectedDealerForMonthlyCredit.name}</DialogTitle>
              <DialogDescription>
                Add, edit, or delete month-wise credit limits for this dealer.
              </DialogDescription>
            </DialogHeader>
            <DealerMonthlyCreditManager 
              dealer={selectedDealerForMonthlyCredit} 
              onCreditLimitsUpdated={fetchDealers} 
            />
          </DialogContent>
        </Dialog>
      )}
      
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Upload Dealers</DialogTitle>
            <DialogDescription>
              Upload an Excel sheet to add multiple dealers at once
            </DialogDescription>
          </DialogHeader>
          <DealerExcelUpload onUploadComplete={handleUploadComplete} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManageDealers;