"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Trash2, Check, ChevronsUpDown, Percent, Search, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSession } from '@/contexts/SessionContext';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';

interface Product {
  id: string;
  code: string;
  name: string;
  dp: number;
  closing_stock: number;
  gst: string;
}

interface ComboItem {
  id: string;
  product_id: string;
  product_name: string;
  product_code: string;
  quantity: number;
  discount_percent: number;
  gst_percent: number;
  unit_price: number;
}

interface Combo {
  combo_id: string;
  combo_code?: string;
  combo_name: string;
  combo_description: string;
  combo_category: string;
  combo_dp: number;
  combo_gst: number;
  item_count: number;
  items: ComboItem[];
}

interface Dealer {
  id: string;
  name: string;
  gst_number?: string | null;
  gst_registration_type?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  phone?: string | null;
  contact_person?: string | null;
  email?: string | null;
}

interface SalesPerson {
  id: string;
  first_name: string;
  last_name: string;
  user_type: string;
}

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  product_name: string;
  product_code: string;
  unit_dp: number;
  discount_percent: number;
  gst_percent: number;
  taxable_value: number;
  gst_amount: number;
  total_price: number;
}

interface OrderToEdit {
  id: string;
  order_number: number;
  order_date: string;
  dealer_id: string;
  user_id: string;
  total_amount: number;
  discount_amount: number;
  round_off: number;
  freight_charges: number;
  company_id?: string | null;
  bill_no: string | null;
  dispatch_date: string | null;
  delivery_location: string | null;
  transport_name: string | null;
  booking_destination: string | null;
  date_of_dispatch: string | null;
  items: OrderItem[];
}

interface EditOrderDialogProps {
  orderId: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderUpdated: () => void;
  billStatus?: { allowed: boolean; message?: string };
  showBillRestrictionWarning?: boolean;
  cancelledBillInfo?: any;
  originalCompanyId?: string;
  originalBillNumber?: string;
  cancelledInvoiceId?: string;
  isBillingDashboard?: boolean;
  fullScreen?: boolean;
}

const formSchema = z.object({
  orderNumber: z.preprocess((val) => Number(val), z.number().int().min(1, { message: 'Order number must be at least 1.' })),
  orderDate: z.string().min(1, { message: 'Order date is required.' }),
  dealerId: z.string().uuid({ message: 'Please select a dealer.' }),
  salesPersonId: z.string().uuid({ message: 'Please select a sales person.' }),
  billingCompanyId: z.string().default(''),
  billNo: z.string().optional().default(''),
  discountAmount: z.preprocess((val) => Number(val), z.number().min(0)),
  dispatchDate: z.string().default(''),
  roundOff: z.preprocess((val) => Number(val), z.number().default(0)),
  freightCharges: z.preprocess((val) => Number(val), z.number().min(0).default(0)),
  deliveryLocation: z.string().default(''),
  transportName: z.string().default(''),
  bookingDestination: z.string().default(''),
  dateOfDispatch: z.string().default(''),
});

// Helper function to fetch all products with pagination
const fetchAllProducts = async (): Promise<Product[]> => {
  let allProducts: Product[] = [];
  let page = 0;
  const pageSize = 1000; // A common page size for Supabase
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('products')
      .select('id, code, name, dp, closing_stock, gst')
      .eq('is_active', true)
      .order('name', { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error("Error fetching products page:", error);
      throw error;
    }

    if (data) {
      allProducts.push(...data);
    }

    if (!data || data.length < pageSize) {
      hasMore = false;
    } else {
      page++;
    }
  }
  return allProducts;
};

// Helper function to update dealer GST number
const updateDealerGstNumber = async (dealerId: string, gstNumber: string): Promise<boolean> => {
  try {
    console.log('📝 updateDealerGstNumber called:', { dealerId, gstNumber });
    
    // Determine registration type based on GST number
    const registrationType = gstNumber && gstNumber.trim() ? 'registered' : 'unregistered';
    
    const { error } = await supabase
      .from('dealers')
      .update({ 
        gst_number: gstNumber || null,
        gst_registration_type: registrationType
      })
      .eq('id', dealerId);
    
    console.log('📝 Supabase response:', { error });
    if (error) throw error;
    console.log('✅ GST updated successfully');
    return true;
  } catch (error: any) {
    console.error('❌ Error updating dealer GST:', error?.message || error);
    return false;
  }
};

// Helper function to map company ID to table name
const getInvoiceTableName = (companyId: string): string => {
  const COMPANY_TABLES: Record<string, string> = {
    '8d4f9e5c-8f83-4a79-8229-3a563aa4ed56': 'spartan',
    'e14cf6e2-a3c8-48f1-a418-1acb0983c070': 'fightor',
  };
  return COMPANY_TABLES[companyId] || 'spartan'; // Default to spartan if not found
};

// Helper function to validate no missing bill numbers in company sequence
const validateBillNumberSequence = async (
  companyId: string,
  billSeriesId: string | null,
  newBillNumber: string,
  originalBillNumber?: string
): Promise<{ valid: boolean; message?: string }> => {
  try {
    console.log('🔍 Validating bill number sequence for company:', companyId);
    console.log('   New bill number:', newBillNumber);

    if (originalBillNumber && newBillNumber === originalBillNumber) {
      console.log('   Bill number is unchanged from original, skipping gap validation.');
      return { valid: true };
    }

    // Extract the sequence number from bill number (e.g., "M/26-27/1010" -> "1010")
    const billNumberParts = newBillNumber.split('/');
    const sequenceStr = billNumberParts[billNumberParts.length - 1];
    const newSequence = parseInt(sequenceStr, 10);

    if (isNaN(newSequence)) {
      console.warn('⚠️ Could not parse sequence from bill number:', newBillNumber);
      return { valid: true }; // Allow if can't parse
    }

    if (billSeriesId) {
      const { data: seriesData, error: seriesError } = await supabase
        .from('bill_series')
        .select('series_prefix, series_separator, current_sequence_number')
        .eq('id', billSeriesId)
        .maybeSingle();

      if (seriesError) {
        console.warn('⚠️ Could not fetch bill series for validation:', seriesError);
      } else if (seriesData) {
        const prefix = seriesData.series_prefix || '';
        const separator = seriesData.series_separator || '';
        const expectedBillNumber = `${prefix}${separator}${seriesData.current_sequence_number}`;
        const expectedSequence = seriesData.current_sequence_number;

        console.log('   Expected bill number from series:', expectedBillNumber);
        console.log('   Expected sequence from series:', expectedSequence);

        if (newBillNumber === expectedBillNumber) {
          console.log('✅ Bill number matches expected next series number.');
          return { valid: true };
        }

        if (newSequence < expectedSequence) {
          console.warn('⚠️ Bill number is older than expected series sequence:', newSequence, '<', expectedSequence);
          return {
            valid: true,
            message: `⚠️ Warning: Bill number ${newBillNumber} is older than the expected next series number ${expectedBillNumber}. Only proceed if this is intentional.`,
          };
        }

        if (newSequence > expectedSequence) {
          const gapCount = newSequence - expectedSequence;
          console.warn(`⚠️ Gap detected from expected series: ${gapCount} missing number(s) between ${expectedBillNumber} and ${newBillNumber}`);
          return {
            valid: true,
            message: `⚠️ Warning: There are ${gapCount} missing bill number(s) in the selected series. Only proceed if this is intentional.`,
          };
        }

        // If sequence number equals expected sequence but full bill number doesn't match prefix/separator,
        // warn about series mismatch.
        if (newSequence === expectedSequence && newBillNumber !== expectedBillNumber) {
          return {
            valid: true,
            message: `⚠️ Warning: Bill number ${newBillNumber} does not match the selected bill series format ${expectedBillNumber}.`,
          };
        }
      }
    }

    // Fallback: Validate against existing invoices in the company table and same bill series when possible
    const tableName = getInvoiceTableName(companyId);
    let query = supabase
      .from(tableName)
      .select('bill_number')
      .not('bill_number', 'is', null);

    if (billSeriesId) {
      query = query.eq('bill_series_id', billSeriesId);
    }

    const { data: previousBills, error } = await query
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('❌ Error fetching previous bill numbers:', error);
      return { valid: true }; // Allow if can't verify
    }

    if (!previousBills || previousBills.length === 0) {
      console.log('✅ No previous bills found - sequence is valid (first bill)');
      return { valid: true };
    }

    // Extract sequence from last bill
    const lastBillNumber = previousBills[0].bill_number;
    const lastBillParts = lastBillNumber.split('/');
    const lastSequenceStr = lastBillParts[lastBillParts.length - 1];
    const lastSequence = parseInt(lastSequenceStr, 10);

    if (isNaN(lastSequence)) {
      console.warn('⚠️ Could not parse previous bill sequence:', lastBillNumber);
      return { valid: true };
    }

    console.log('📊 Bill number validation:');
    console.log('   Last sequence:', lastSequence);
    console.log('   New sequence:', newSequence);
    console.log('   Gap:', newSequence - lastSequence - 1);

    const gap = newSequence - lastSequence;
    
    if (gap <= 0) {
      console.log('⚠️ New bill number is not greater than last bill number');
      console.log('   This is OK if changing to a different company series');
      return { valid: true };
    }

    if (gap === 1) {
      console.log('✅ Bill number sequence is continuous (no gaps)');
      return { valid: true };
    }

    const gapCount = gap - 1;
    console.warn(`⚠️ Gap detected in bill number sequence: ${gapCount} missing number(s) between ${lastSequence} and ${newSequence}`);
    return {
      valid: true,
      message: `⚠️ Warning: There are ${gapCount} missing bill number(s) between ${lastSequence} and ${newSequence}. Only proceed if this is intentional.`,
    };
  } catch (err: any) {
    console.error('❌ Error in bill number validation:', err);
    return { valid: true, message: 'Could not validate bill number sequence' };
  }
};

// Helper function to fetch all combos
const fetchAllCombos = async (): Promise<Combo[]> => {
  try {
    const { data, error } = await supabase.rpc('get_all_active_combos_with_items');
    if (error) {
      console.error("Error fetching combos:", error);
      throw error;
    }
    return (data || []).map((combo: any) => ({
      combo_id: combo.combo_id,
      combo_code: combo.combo_code,
      combo_name: combo.combo_name,
      combo_description: combo.combo_description,
      combo_category: combo.combo_category,
      combo_dp: combo.combo_dp,
      combo_gst: combo.combo_gst,
      item_count: combo.item_count,
      items: Array.isArray(combo.items) ? combo.items : [],
    }));
  } catch (error) {
    console.error('Error fetching combos:', error);
    return [];
  }
};

const EditOrderDialog: React.FC<EditOrderDialogProps> = ({ orderId, isOpen, onOpenChange, onOrderUpdated, billStatus, showBillRestrictionWarning, cancelledBillInfo, originalCompanyId, originalBillNumber, cancelledInvoiceId, isBillingDashboard = false, fullScreen = false }) => {
  const { user, session } = useSession();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<SalesPerson[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [orderData, setOrderData] = useState<OrderToEdit | null>(null);
  const [editingGstNumber, setEditingGstNumber] = useState<string | null>(null);
  const [gstNumberInput, setGstNumberInput] = useState<string>('');
  const [companies, setCompanies] = useState<Array<{ id: string; name: string }>>([]);
  const [financialYears, setFinancialYears] = useState<Array<{ id: string; year_name: string }>>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedFinancialYearId, setSelectedFinancialYearId] = useState<string>('');
  const [nextBillNumber, setNextBillNumber] = useState<string>('');
  const [billSeriesId, setBillSeriesId] = useState<string>('');
  const [currentBillSeries, setCurrentBillSeries] = useState<any>(null);
  const [isGeneratingBill, setIsGeneratingBill] = useState(false);
  const [originalInvoiceCompanyId, setOriginalInvoiceCompanyId] = useState<string | null>(null);
  const [originalInvoiceBillNumber, setOriginalInvoiceBillNumber] = useState<string>('');
  const [linkedInvoiceId, setLinkedInvoiceId] = useState<string | null>(null);

  const [isProductPopoverOpen, setIsProductPopoverOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [selectionTab, setSelectionTab] = useState<'products' | 'combos'>('products');
  const [newItemProductId, setNewItemProductId] = useState<string>('');
  const [newItemComboId, setNewItemComboId] = useState<string>('');
  const [newItemQuantity, setNewItemQuantity] = useState<number>(1);
  const [newItemUnitPrice, setNewItemUnitPrice] = useState<number>(0);
  const [newItemDiscountPercent, setNewItemDiscountPercent] = useState<string>('0');
  const [newItemGstPercent, setNewItemGstPercent] = useState<string>('0');
  const [newComboDiscountPercent, setNewComboDiscountPercent] = useState<string>('0');
  const [newComboGstPercent, setNewComboGstPercent] = useState<string>('0');

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      orderNumber: 0,
      orderDate: '',
      dealerId: '',
      salesPersonId: '',
      billingCompanyId: '',
      discountAmount: 0,
      dispatchDate: '',
      roundOff: 0,
      freightCharges: 0,
      deliveryLocation: '',
      transportName: '',
      bookingDestination: '',
      dateOfDispatch: '',
    },
  });

  const fetchInitialData = useCallback(async () => {
    try {
      const [productsData, combosData, dealersRes, usersRes] = await Promise.all([
        fetchAllProducts(),
        fetchAllCombos(),
        supabase.from('dealers').select('id, name, gst_number, gst_registration_type, address, city, state, country, phone, contact_person, email').order('name'),
        supabase.from('profiles').select('id, first_name, last_name, user_type').in('user_type', ['sales_person', 'admin']).order('first_name'),
      ]);

      if (dealersRes.error) throw dealersRes.error;
      if (usersRes.error) throw usersRes.error;

      setProducts(productsData || []);
      setCombos(combosData || []);
      setDealers(dealersRes.data || []);
      setAssignableUsers(usersRes.data || []);
    } catch (error: any) {
      console.error('Error fetching initial data:', error.message);
      showError('Failed to load form data.');
    }
  }, []);

  const fetchOrderDetails = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const { data: orderRaw, error: orderError } = await supabase
        .from('orders')
        .select(`
          id, order_number, order_date, dealer_id, user_id, freight_charges, total_amount, discount_amount, round_off, bill_no, dispatch_date, delivery_location, transport_name, booking_destination, date_of_dispatch,
          dealers (name),
          sales (product_id, quantity, total_price, unit_price, discount_percent, gst_percent, products (name, code, dp, gst))
        `)
        .eq('id', id)
        .single();

      if (orderError) throw orderError;

      // Fetch company and invoice ID from BOTH company tables
      // Important: Get the ACTIVE invoice (not rejected ones)
      let companyId: string | null = null;
      let invoiceId: string | null = null;
      let invoiceData: any = null;
      
      console.log('📋 Fetching invoice for order:', id);
      
      // Query both spartan and fightor tables - INCLUDE bill_number to get the original bill
      const { data: spartanData, error: spartanError } = await supabase
        .from('spartan')
        .select('id, company_id, status, bill_number')
        .eq('order_id', id)
        .neq('status', 'reject')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      const { data: fightorData, error: fightorError } = await supabase
        .from('fightor')
        .select('id, company_id, status, bill_number')
        .eq('order_id', id)
        .neq('status', 'reject')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      // Use whichever one was found (should only be one per order, but spartan takes precedence)
      if (spartanData) {
        invoiceData = spartanData;
        console.log('✅ Found invoice in spartan table');
      } else if (fightorData) {
        invoiceData = fightorData;
        console.log('✅ Found invoice in fightor table');
      }
      
      // Fallback: if no active invoice, check rejected ones - INCLUDE bill_number
      if (!invoiceData) {
        console.log('⚠️ No active invoice found, checking rejected invoices...');
        
        const { data: rejectedSpartan } = await supabase
          .from('spartan')
          .select('id, company_id, status, bill_number')
          .eq('order_id', id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        const { data: rejectedFightor } = await supabase
          .from('fightor')
          .select('id, company_id, status, bill_number')
          .eq('order_id', id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        invoiceData = rejectedSpartan || rejectedFightor;
      }
      
      if (invoiceData) {
        companyId = invoiceData.company_id;
        invoiceId = invoiceData.id;
        console.log('✅ Found invoice:', invoiceId);
        console.log('   Company ID:', companyId);
        console.log('   Status:', invoiceData.status);
        console.log('   Bill Number from invoice:', invoiceData.bill_number);
      } else {
        console.log('⚠️ No invoice found for order:', id);
      }

      const fetchedItems: OrderItem[] = (orderRaw.sales || []).map((sale: any, index: number) => {
        // Use only the stored unit_price from the sales table (snapshot at order creation time)
        // Never fall back to current product price - preserve original order price
        const unitPrice = sale.unit_price ?? 0;
        const discPercent = sale.discount_percent || 0;
        const gstPercent = sale.gst_percent || parseFloat(sale.products?.gst || "0") || 0;
        
        const taxableUnitPrice = unitPrice * (1 - discPercent / 100);
        const taxableValue = taxableUnitPrice * sale.quantity;
        const gstAmount = (taxableValue * gstPercent) / 100;

        return {
          id: `${sale.product_id}-${index}`,
          product_id: sale.product_id,
          quantity: sale.quantity,
          product_name: sale.products?.name || 'N/A',
          product_code: sale.products?.code || 'N/A',
          unit_dp: unitPrice,
          discount_percent: discPercent,
          gst_percent: gstPercent,
          taxable_value: taxableValue,
          gst_amount: gstAmount,
          total_price: sale.total_price,
        };
      });

      const orderToSet: OrderToEdit = {
        ...orderRaw,
        company_id: companyId || undefined,
        items: fetchedItems,
      };
      setOrderData(orderToSet);
      setLinkedInvoiceId(invoiceId);
      setOriginalInvoiceCompanyId(companyId);
      
      // Use bill_number from INVOICE (has the original bill), fallback to order's bill_no
      const billNumberToUse = invoiceData?.bill_number || orderRaw.bill_no;
      if (billNumberToUse) {
        console.log('📌 Setting bill number from invoice:', billNumberToUse);
        setNextBillNumber(billNumberToUse);
        setOriginalInvoiceBillNumber(billNumberToUse); // Also save as original for comparison
      } else {
        console.log('⚠️ No bill_no found in invoice or order');
        setNextBillNumber('');
        setOriginalInvoiceBillNumber('');
      }
      
      // If there's an existing invoice with a company, update selectedCompanyId to trigger FY fetch (not bill number generation)
      if (companyId) {
        console.log('📋 Setting selectedCompanyId from linked invoice:', companyId);
        setSelectedCompanyId(companyId);
      }
      
      setOrderItems(fetchedItems);

      form.reset({
        orderNumber: orderRaw.order_number,
        orderDate: orderRaw.order_date ? orderRaw.order_date.split('T')[0] : '',
        dealerId: orderRaw.dealer_id,
        salesPersonId: orderRaw.user_id,
        billingCompanyId: companyId || '',
        billNo: orderRaw.bill_no || '',
        discountAmount: orderRaw.discount_amount || 0,
        dispatchDate: orderRaw.dispatch_date ? orderRaw.dispatch_date.split('T')[0] : '',
        roundOff: orderRaw.round_off || 0,
        freightCharges: orderRaw.freight_charges || 0,
        deliveryLocation: orderRaw.delivery_location || '',
        transportName: orderRaw.transport_name || '',
        bookingDestination: orderRaw.booking_destination || '',
        dateOfDispatch: orderRaw.date_of_dispatch ? orderRaw.date_of_dispatch.split('T')[0] : '',
      });
      
      console.log('📝 Form reset with billingCompanyId:', companyId);
      console.log('   invoiceId state:', invoiceId);
      console.log('   originalCompanyId state:', companyId);

    } catch (error: any) {
      console.error('Error fetching order details:', error.message);
      showError(`Failed to load order details: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [form, user]);

  // Fetch companies
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const { data, error } = await supabase
          .from('companies')
          .select('id, name')
          .eq('is_active', true)
          .order('name');
        
        if (error) throw error;
        setCompanies(data || []);
      } catch (err) {
        console.error('Error fetching companies:', err);
      }
    };

    if (isOpen) {
      fetchCompanies();
    }
  }, [isOpen]);

  // Set original company when editing cancelled bills
  useEffect(() => {
    if (originalCompanyId && cancelledBillInfo && isOpen) {
      console.log('📝 Editing cancelled bill with company:', originalCompanyId);
      setSelectedCompanyId(originalCompanyId);
      // Financial year will auto-select in the next effect
    }
  }, [originalCompanyId, cancelledBillInfo, isOpen]);

  // Auto-fetch and auto-select active financial year for selected company
  useEffect(() => {
    console.log('🏢 Company selection changed:', selectedCompanyId);
    
    if (!selectedCompanyId) {
      console.log('⏭️ Clearing FY - no company selected');
      setFinancialYears([]);
      setSelectedFinancialYearId('');
      setNextBillNumber(''); // Clear old bill number
      setBillSeriesId(''); // Clear old bill series
      setCurrentBillSeries(null); // Clear bill series object
      return;
    }

    const fetchAndAutoSelectFY = async () => {
      try {
        console.log('📡 Fetching FY for company:', selectedCompanyId);
        
        // IMPORTANT: Only clear bill number if company CHANGED from original
        // For same company (editing cancelled bill), preserve original bill number
        const isSameCompany = selectedCompanyId === originalInvoiceCompanyId && linkedInvoiceId;
        if (!isSameCompany) {
          console.log('🔄 Clearing old bill number and series for new company');
          setNextBillNumber('');
          setBillSeriesId('');
          setCurrentBillSeries(null);
        } else {
          console.log('🔒 Same company - preserving original bill number');
        }
        
        const { data, error } = await supabase
          .from('financial_years')
          .select('id, year_name')
          .eq('company_id', selectedCompanyId)
          .eq('is_active', true)
          .order('start_date', { ascending: false });
        
        if (error) throw error;
        console.log('📥 FY response:', data);
        
        setFinancialYears(data || []);
        
        // Auto-select the first active financial year
        if (data && data.length > 0) {
          console.log('✅ Auto-selecting FY:', data[0].year_name, 'ID:', data[0].id);
          setSelectedFinancialYearId(data[0].id);
        } else {
          console.warn('⚠️ No FY found');
          setSelectedFinancialYearId('');
          setNextBillNumber(''); // Clear bill number if no FY
          setBillSeriesId(''); // Clear bill series if no FY
        }
      } catch (err) {
        console.error('Error fetching financial years:', err);
      }
    };

    fetchAndAutoSelectFY();
  }, [selectedCompanyId, linkedInvoiceId, originalInvoiceCompanyId]);

  // Fetch bill_series for selected company and financial year
  // Database trigger will auto-generate bill number on INSERT
  useEffect(() => {
    if (!selectedCompanyId || !selectedFinancialYearId) {
      console.log('⏭️ Skipping - missing company or FY');
      return;
    }

    const fetchBillSeries = async () => {
      try {
        const { data, error } = await supabase
          .from('bill_series')
          .select('id, series_prefix, series_separator, current_sequence_number')
          .eq('company_id', selectedCompanyId)
          .eq('financial_year_id', selectedFinancialYearId)
          .eq('is_active', true)
          .maybeSingle();
        
        if (error) throw error;
        
        if (data) {
          console.log('✅ Bill series found');
          setCurrentBillSeries(data);
          setBillSeriesId(data.id);
          
          // Only set calculated next bill if NOT editing same company
          // For same company (editing cancelled bill), preserve original bill number
          const isSameCompany = selectedCompanyId === originalInvoiceCompanyId && linkedInvoiceId;
          if (!isSameCompany) {
            // Show preview of next bill (for display only - trigger will generate it)
            const nextSeq = data.current_sequence_number;
            const previewBill = data.series_prefix + (data.series_separator || '') + nextSeq;
            console.log('📊 Next bill will be:', previewBill);
            setNextBillNumber(previewBill);
          } else {
            console.log('🔒 Same company - keeping original bill number:', nextBillNumber);
          }
        } else {
          console.log('⚠️ No bill series found');
          setBillSeriesId('');
          setCurrentBillSeries(null);
          setNextBillNumber('');
        }
      } catch (err) {
        console.error('❌ Error fetching bill series:', err);
        setBillSeriesId('');
        setCurrentBillSeries(null);
        setNextBillNumber('');
      }
    };

    fetchBillSeries();
  }, [selectedCompanyId, selectedFinancialYearId, linkedInvoiceId, originalInvoiceCompanyId]);

  useEffect(() => {
    if (isOpen && orderId) {
      fetchInitialData();
      fetchOrderDetails(orderId);
    }
  }, [isOpen, orderId, fetchInitialData, fetchOrderDetails]);

  const totalTaxableValue = useMemo(() => {
    return orderItems.reduce((total, item) => total + item.taxable_value, 0);
  }, [orderItems]);

  const totalGstAmount = useMemo(() => {
    return orderItems.reduce((total, item) => total + item.gst_amount, 0);
  }, [orderItems]);

  const preGlobalDiscountTotal = useMemo(() => {
    return orderItems.reduce((total, item) => total + item.total_price, 0);
  }, [orderItems]);

  const discountAmountValue = form.watch('discountAmount');
  const roundOffValue = form.watch('roundOff');
  const freightChargesValue = form.watch('freightCharges');

  useEffect(() => {
    const subtotalAfterDiscount = preGlobalDiscountTotal - (Number(discountAmountValue) || 0);
    const roundedTotal = Math.round(subtotalAfterDiscount);
    const calculatedRoundOff = roundedTotal - subtotalAfterDiscount;
    form.setValue('roundOff', parseFloat(calculatedRoundOff.toFixed(2)));
  }, [preGlobalDiscountTotal, discountAmountValue, form]);

  const finalOrderValue = useMemo(() => {
    const discount = Number(discountAmountValue) || 0;
    const roundOff = Number(roundOffValue) || 0;
    const freight = Number(freightChargesValue) || 0;
    return Math.max(0, preGlobalDiscountTotal - discount + roundOff + freight);
  }, [preGlobalDiscountTotal, discountAmountValue, roundOffValue, freightChargesValue]);

  const newItemCalculations = useMemo(() => {
    const discPercent = parseFloat(newItemDiscountPercent as any) || 0;
    const gstPercent = parseFloat(newItemGstPercent as any) || 0;
    const taxableUnitPrice = newItemUnitPrice * (1 - discPercent / 100);
    const taxableValue = taxableUnitPrice * newItemQuantity;
    const gstAmount = (taxableValue * gstPercent) / 100;
    const totalPrice = taxableValue + gstAmount;

    return { taxableValue, gstAmount, totalPrice };
  }, [newItemUnitPrice, newItemDiscountPercent, newItemQuantity, newItemGstPercent]);

  const addOrderItem = () => {
    if (selectionTab === 'products') {
      // Add individual product
      if (!newItemProductId || newItemQuantity <= 0) {
        showError("Please select a product and enter a valid quantity.");
        return;
      }
      const product = products.find(p => p.id === newItemProductId);
      if (!product) return;

      const newOrderItem: OrderItem = {
        id: Date.now().toString(),
        product_id: product.id,
        quantity: newItemQuantity,
        product_name: product.name,
        product_code: product.code,
        unit_dp: newItemUnitPrice,
        discount_percent: parseFloat(newItemDiscountPercent as any) || 0,
        gst_percent: parseFloat(newItemGstPercent as any) || 0,
        taxable_value: newItemCalculations.taxableValue,
        gst_amount: newItemCalculations.gstAmount,
        total_price: newItemCalculations.totalPrice,
      };
      setOrderItems(prevItems => [...prevItems, newOrderItem]);
      setNewItemProductId('');
      setNewItemQuantity(1);
      setNewItemUnitPrice(0);
      setNewItemDiscountPercent('0');
      setNewItemGstPercent('0');
    } else {
      // Add combo items
      if (!newItemComboId) {
        showError("Please select a combo.");
        return;
      }
      const selectedCombo = combos.find(c => c.combo_id === newItemComboId);
      if (!selectedCombo || !selectedCombo.items || selectedCombo.items.length === 0) {
        showError("Combo has no items.");
        return;
      }

      const comboItems = selectedCombo.items.map((item, index) => {
        const itemQuantity = item.quantity * newItemQuantity;
        const unitPrice = item.unit_price || 0;
        // Use combo discount/GST if specified, otherwise use item defaults
        const discPercent = parseFloat(newComboDiscountPercent as any) || item.discount_percent || 0;
        const gstPercent = parseFloat(newComboGstPercent as any) || item.gst_percent || 0;
        
        const taxableUnitPrice = unitPrice * (1 - discPercent / 100);
        const taxableValue = taxableUnitPrice * itemQuantity;
        const gstAmount = (taxableValue * gstPercent) / 100;
        const totalPrice = taxableValue + gstAmount;

        return {
          id: `${selectedCombo.combo_id}-${item.product_id}-${Date.now()}-${index}`,
          product_id: item.product_id,
          quantity: itemQuantity,
          product_name: item.product_name,
          product_code: item.product_code,
          unit_dp: unitPrice,
          discount_percent: discPercent,
          gst_percent: gstPercent,
          taxable_value: taxableValue,
          gst_amount: gstAmount,
          total_price: totalPrice,
        };
      });

      setOrderItems(prevItems => [...prevItems, ...comboItems]);
      setNewItemComboId('');
      setNewItemQuantity(1);
      setNewComboDiscountPercent('0');
      setNewComboGstPercent('0');
      showSuccess(`Added ${selectedCombo.combo_name} to order`);
    }
  };

  const updateOrderItem = (id: string, field: keyof OrderItem, value: number) => {
    setOrderItems(prev => prev.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        const discount = (updatedItem.unit_dp * updatedItem.discount_percent) / 100;
        const discountedUnitPrice = Math.max(0, updatedItem.unit_dp - discount);
        updatedItem.taxable_value = discountedUnitPrice * updatedItem.quantity;
        updatedItem.gst_amount = (updatedItem.taxable_value * updatedItem.gst_percent) / 100;
        updatedItem.total_price = updatedItem.taxable_value + updatedItem.gst_amount;
        return updatedItem;
      }
      return item;
    }));
  };

  const removeOrderItem = (id: string) => {
    setOrderItems(orderItems.filter(item => item.id !== id));
  };

  const filteredProducts = useMemo(() => {
    if (!productSearch) return products;
    const search = productSearch.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(search) || p.code.toLowerCase().includes(search));
  }, [products, productSearch]);

  const currentProductDisplay = useMemo(() => {
    if (!newItemProductId) return "Select product...";
    const product = products.find(p => p.id === newItemProductId);
    return product ? `${product.name} (${product.code})` : "Select product...";
  }, [newItemProductId, products]);

  const handleSaveGstNumber = async (dealerId: string) => {
    console.log('🔧 handleSaveGstNumber called:', { dealerId, gstNumberInput });
    
    // Validate and clean GST number: must be exactly 15 alphanumeric characters
    const trimmedGst = gstNumberInput.trim().toUpperCase();
    if (trimmedGst && !/^[A-Z0-9]{15}$/.test(trimmedGst)) {
      showError('GST number must be exactly 15 alphanumeric characters (letters & digits)');
      console.warn('⚠️ Invalid GST format:', trimmedGst);
      return;
    }
    
    setIsSubmitting(true);
    try {
      const success = await updateDealerGstNumber(dealerId, trimmedGst);
      console.log('🔧 updateDealerGstNumber returned:', success);
      if (success) {
        const registrationType = trimmedGst ? 'registered' : 'unregistered';
        // Update local dealer state
        setDealers(dealers.map(d => 
          d.id === dealerId ? { ...d, gst_number: trimmedGst || null, gst_registration_type: registrationType } : d
        ));
        setEditingGstNumber(null);
        showSuccess('GST number updated successfully');
        console.log('✅ UI updated, edit mode closed');
      } else {
        showError('Failed to update GST number');
        console.error('❌ updateDealerGstNumber failed');
      }
    } catch (error) {
      console.error('Error:', error);
      showError('Failed to update GST number');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSave = async (values: z.infer<typeof formSchema>) => {
    if (!orderData) return;
    if (orderItems.length === 0) {
      showError('Order must have at least one item.');
      return;
    }
    setIsSubmitting(true);

    console.log('💾 SAVING ORDER...');
    console.log('   Order ID:', orderData.id);
    console.log('   Original Company ID (prop):', originalCompanyId);
    console.log('   Original Company ID (fetched):', originalInvoiceCompanyId);
    console.log('   Original Bill Number (prop):', originalBillNumber);
    console.log('   Original Bill Number (fetched):', originalInvoiceBillNumber);
    console.log('   New Company ID:', values.billingCompanyId);

    try {
      const finalDiscountAmount = parseFloat((Number(values.discountAmount) || 0).toFixed(2));
      const finalOrderAmount = parseFloat(finalOrderValue.toFixed(2));

      // Use EITHER prop values OR fetched values - prefer fetched for accuracy
      const effectiveOriginalCompanyId = originalCompanyId || originalInvoiceCompanyId;
      const effectiveOriginalBillNumber = originalBillNumber || originalInvoiceBillNumber;
      
      // Determine bill number to save
      // IMPORTANT: When company changes, we MUST use the NEW company's bill number (nextBillNumber)
      const companyChanged = linkedInvoiceId && effectiveOriginalCompanyId && values.billingCompanyId !== effectiveOriginalCompanyId;
      
      let billNumberToSave: string | null | undefined = undefined;
      const originalOrderBillNo = orderData.bill_no?.toString().trim() || null;
      const incomingBillNo = values.billNo?.trim() || null;

      if (companyChanged && isBillingDashboard) {
        // Company CHANGED in Billing Dashboard - use suggested next bill number for the new company
        console.log('🔄 Billing Dashboard: Company CHANGED - Using NEW company bill number');
        console.log('   Original company:', effectiveOriginalCompanyId);
        console.log('   New company:', values.billingCompanyId);
        if (!nextBillNumber) {
          console.error('❌ ERROR: Company changed but nextBillNumber is empty!');
          showError('Bill series for selected company not found. Please select a different company.');
          throw new Error('Bill number not available for selected company');
        }
        billNumberToSave = nextBillNumber;
        console.log('   Using nextBillNumber (new company):', billNumberToSave);
      } else if (companyChanged) {
        console.log('🔄 Non-billing dashboard: Company changed, preserving existing invoice bill generation behavior');
        billNumberToSave = undefined;
      } else if (incomingBillNo) {
        // User entered a bill number explicitly
        console.log('✨ User entered bill number');
        billNumberToSave = incomingBillNo;
        console.log('   Using form billNo:', billNumberToSave);
      } else if (!originalOrderBillNo) {
        // Original order had no bill number; write NULL
        console.log('✨ No original bill number and no bill entered - setting NULL');
        billNumberToSave = null;
      } else {
        // Original order had a bill number and user left the field blank; keep it unchanged
        console.log('✨ Blank form billNo, preserving existing bill_no');
        billNumberToSave = undefined;
      }

      console.log('   📝 Bill Number Logic:');
      console.log('      companyChanged:', companyChanged);
      console.log('      nextBillNumber:', nextBillNumber);
      console.log('      originalOrderBillNo:', originalOrderBillNo);
      console.log('      incomingBillNo:', incomingBillNo);
      console.log('      billNumberToSave:', billNumberToSave);
      console.log('      linkedInvoiceId:', linkedInvoiceId);
      console.log('      cancelledInvoiceId:', cancelledInvoiceId);

      const updatePayload: any = {
        order_number: values.orderNumber,
        order_date: values.orderDate,
        dealer_id: values.dealerId,
        user_id: values.salesPersonId,
        total_amount: finalOrderAmount,
        discount_amount: finalDiscountAmount,
        round_off: values.roundOff,
        freight_charges: values.freightCharges,
        dispatch_date: values.dispatchDate && values.dispatchDate.trim() ? values.dispatchDate : null,
        delivery_location: values.deliveryLocation && values.deliveryLocation.trim() ? values.deliveryLocation : null,
        transport_name: values.transportName && values.transportName.trim() ? values.transportName : null,
        booking_destination: values.bookingDestination && values.bookingDestination.trim() ? values.bookingDestination : null,
        date_of_dispatch: values.dateOfDispatch && values.dateOfDispatch.trim() ? values.dateOfDispatch : null,
      };
      if (billNumberToSave !== undefined) {
        updatePayload.bill_no = billNumberToSave;
      }

      // Add bill_date only when a real bill number is being set on this update
      if (billNumberToSave && values.billingCompanyId) {
        updatePayload.bill_date = new Date().toISOString().split('T')[0];
        console.log('   ✅ Adding bill_date to payload:', updatePayload.bill_date);
      } else {
        console.log('   ⚠️ NOT adding bill_date - billNumberToSave:', billNumberToSave, 'billingCompanyId:', values.billingCompanyId);
      }

      console.log('   📦 Complete Update Payload:');
      console.log('      bill_no:', updatePayload.bill_no);
      console.log('      bill_date:', updatePayload.bill_date);
      console.log('      company context - billingCompanyId:', values.billingCompanyId);

      // Validate bill number sequence BEFORE updating
      if (billNumberToSave && values.billingCompanyId) {
        console.log('🔍 VALIDATING BILL NUMBER SEQUENCE...');
        const validation = await validateBillNumberSequence(
          values.billingCompanyId,
          billSeriesId || null,
          billNumberToSave,
          effectiveOriginalBillNumber
        );
        
        if (validation.message) {
          console.warn('⚠️ Bill sequence validation warning:', validation.message);
          // Show warning but allow continuation (user is aware of gaps)
          showError(validation.message);
        }
      }

      // 1. Update Order
      const { data: updateData, error: orderUpdateError } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', orderData.id)
        .select();

      console.log('   📡 Order Update Response:', { updateData, orderUpdateError });

      if (orderUpdateError) {
        console.error('❌ ORDER UPDATE ERROR:', orderUpdateError);
        throw orderUpdateError;
      }
      
      if (updateData) {
        console.log('✅ Order updated successfully');
        console.log('   Updated bill_no in response:', updateData[0]?.bill_no);
        console.log('   Updated bill_date in response:', updateData[0]?.bill_date);
      }

      // VERIFY: Read back from database to confirm data was actually saved
      console.log('🔍 VERIFYING data was saved to database...');
      const { data: verifyData, error: verifyError } = await supabase
        .from('orders')
        .select('id, bill_no, bill_date, order_number')
        .eq('id', orderData.id)
        .single();

      if (verifyError) {
        console.error('❌ VERIFY ERROR:', verifyError);
      } else {
        console.log('✅ DATABASE VERIFICATION:');
        console.log('   Order ID:', verifyData.id);
        console.log('   Bill No in DB:', verifyData.bill_no);
        console.log('   Bill Date in DB:', verifyData.bill_date);
        console.log('   Order Number in DB:', verifyData.order_number);
      }

      // 2. Update Sales Items
      if (orderItems.length > 0) {
        await supabase.from('sales').delete().eq('order_id', orderData.id);
        const salesToInsert = orderItems.map(item => ({
          order_id: orderData.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_dp,
          discount_percent: item.discount_percent,
          gst_percent: item.gst_percent,
          total_price: item.total_price,
        }));
        await supabase.from('sales').insert(salesToInsert);
      }

      // 3. Update Payment
      const { data: payment } = await supabase
        .from('payments')
        .select('id')
        .eq('order_id', orderData.id)
        .eq('status', 'pending_approval')
        .maybeSingle();

      if (payment) {
        await supabase
          .from('payments')
          .update({ amount: finalOrderAmount, dealer_id: values.dealerId })
          .eq('id', payment.id);
      }

      // 4. Handle Invoice logic based on company change
      const invoiceIdToUpdate = linkedInvoiceId; // Use the actual linked invoice
      
      if (invoiceIdToUpdate && companyChanged) {
        // COMPANY CHANGED: Create NEW invoice instead of updating old one
        console.log('🆕 STEP 4A: COMPANY CHANGED - Creating NEW invoice for new company');
        console.log('   Old invoice ID:', invoiceIdToUpdate);
        console.log('   Old company ID:', effectiveOriginalCompanyId);
        console.log('   New company ID:', values.billingCompanyId);
        console.log('   New bill number:', billNumberToSave);

        try {
          // Fetch old invoice to copy items - use correct table based on original company
          const oldTableName = getInvoiceTableName(originalInvoiceCompanyId || '');
          const { data: oldInvoice, error: fetchError } = await supabase
            .from(oldTableName)
            .select('*')
            .eq('id', invoiceIdToUpdate)
            .single();

          if (fetchError || !oldInvoice) {
            throw new Error('Could not fetch old invoice to copy');
          }

          // Create NEW invoice with new company
          const newInvoicePayload: any = {
            order_id: orderData.id,
            company_id: values.billingCompanyId,
            financial_year_id: selectedFinancialYearId || null,
            bill_series_id: billSeriesId || null,
            bill_number: billNumberToSave,
            bill_date: new Date().toISOString().split('T')[0],
            dealer_id: values.dealerId,
            gst_number: dealers.find(d => d.id === values.dealerId)?.gst_number || null,
            total_amount: finalOrderValue,
            discount_amount: Number(values.discountAmount) || 0,
            round_off: Number(values.roundOff) || 0,
            freight_charges: Number(values.freightCharges) || 0,
            taxable_value: totalTaxableValue,
            total_gst: totalGstAmount,
            grand_total: finalOrderValue,
            payment_status: 'pending',
            notes: '',
            reassigned_from_invoice_id: invoiceIdToUpdate,
            reassignment_reason: `Company changed from ${originalCompanyId} to ${values.billingCompanyId}`,
            reassigned_at: new Date().toISOString(),
          };

          console.log('   📝 New Invoice Payload:', { bill_number: newInvoicePayload.bill_number, company_id: newInvoicePayload.company_id });
          console.log('   📤 Inserting new invoice...');

          // Use correct table for new company
          const newTableName = getInvoiceTableName(values.billingCompanyId);
          const { data: newInvoiceResult, error: insertError } = await supabase
            .from(newTableName)
            .insert([newInvoicePayload])
            .select();

          if (insertError) {
            console.error('❌ Failed to create new invoice:', insertError);
            showError(`Failed to create new invoice: ${insertError.message}`);
            throw insertError;
          }

          if (newInvoiceResult && newInvoiceResult.length > 0) {
            const newInvoiceId = newInvoiceResult[0].id;
            console.log('✅ New invoice created:', newInvoiceId);
            console.log('   Bill number:', newInvoiceResult[0].bill_number);
            console.log('   Company ID:', newInvoiceResult[0].company_id);

            // Mark old invoice as REJECTED (company changed) with new bill number as reference
            console.log('   🔗 Marking old invoice as REJECTED with new bill number...');
            const rejectionReason = `Company changed to ${values.billingCompanyId}. New bill number for reference: ${billNumberToSave}`;
            const oldTableName = getInvoiceTableName(originalInvoiceCompanyId || '');
            const { data: rejectUpdateData, error: rejectError } = await supabase
              .from(oldTableName)
              .update({ 
                status: 'reject',
                rejection_reason: rejectionReason,
                reassigned_to_invoice_id: newInvoiceId 
              })
              .eq('id', invoiceIdToUpdate)
              .select();

            if (rejectError) {
              console.error('❌ ERROR marking old invoice as rejected:', rejectError);
              console.error('   Error code:', rejectError.code);
              console.error('   Error message:', rejectError.message);
              throw new Error(`Failed to reject old invoice: ${rejectError.message}`);
            }

            if (!rejectUpdateData || rejectUpdateData.length === 0) {
              console.error('❌ Old invoice update returned no rows - it may not exist or RLS blocked it');
              throw new Error('Failed to update old invoice - check RLS policies');
            }

            console.log('   ✅ Old invoice marked as rejected');
            console.log('   Updated invoice:', rejectUpdateData[0]);
            console.log('   New status:', rejectUpdateData[0].status);
            console.log('   Rejection reason:', rejectUpdateData[0].rejection_reason);

            // Copy items from old invoice to new invoice
            console.log('   📋 Copying items to new invoice...');
            const { data: oldItems } = await supabase
              .from('sales')
              .select('*')
              .eq('order_id', orderData.id);

            // Items are already attached to the order, so new invoice will use same items
            
            showSuccess('✓ New invoice created with new company (old invoice marked rejected)');
          }
        } catch (err: any) {
          console.error('❌ Exception creating new invoice:', err);
          showError(`Failed to create new invoice: ${err?.message || err}`);
          throw err;
        }
      } else if (invoiceIdToUpdate && !companyChanged) {
        // COMPANY SAME: Keep existing bill number, just update other fields
        console.log('🔄 STEP 4B: COMPANY SAME - Updating existing invoice');
        console.log('   Invoice ID:', invoiceIdToUpdate);
        console.log('   Keeping bill number:', billNumberToSave);

        const invoiceUpdatePayload: any = {
          // Don't change company_id, bill_series_id, bill_number when company is same
          bill_date: new Date().toISOString().split('T')[0],
          dealer_id: values.dealerId,
          gst_number: dealers.find(d => d.id === values.dealerId)?.gst_number || null,
          total_amount: finalOrderValue,
          discount_amount: Number(values.discountAmount) || 0,
          round_off: Number(values.roundOff) || 0,
          freight_charges: Number(values.freightCharges) || 0,
          taxable_value: totalTaxableValue,
          total_gst: totalGstAmount,
          grand_total: finalOrderValue,
          payment_status: 'pending',
          status: null, // IMPORTANT: Clear 'reject' status when reactivating
          notes: '',
        };

        console.log('   📝 Invoice Update Payload (same company):', invoiceUpdatePayload);

        try {
          const tableName = getInvoiceTableName(originalInvoiceCompanyId || '');
          const { data: updateResult, error: updateError } = await supabase
            .from(tableName)
            .update(invoiceUpdatePayload)
            .eq('id', invoiceIdToUpdate)
            .select();

          if (updateError) {
            console.error('❌ Invoice update failed:', updateError);
            showError(`Failed to update invoice: ${updateError.message}`);
            throw updateError;
          }

          console.log('✅ Invoice updated (same company)');
          showSuccess('✓ Invoice updated successfully');
        } catch (err: any) {
          console.error('❌ Exception updating invoice:', err);
          showError(`Failed to update invoice: ${err?.message || err}`);
          throw err;
        }
      } else if (values.billingCompanyId && !linkedInvoiceId && !cancelledInvoiceId) {
        // NEW BILL: Create new invoice for new order
        // Database trigger will auto-generate bill_number (no RPC needed)
        console.log('🆕 STEP 4C: Creating NEW INVOICE (trigger will auto-generate bill)');
        
        try {
          const invoiceCreatePayload: any = {
            order_id: orderData.id,
            company_id: values.billingCompanyId,
            financial_year_id: selectedFinancialYearId || null,
            bill_series_id: billSeriesId || null,
            ...(isBillingDashboard ? { bill_number: nextBillNumber || null } : {}),
            bill_date: new Date().toISOString().split('T')[0],
            dealer_id: values.dealerId,
            gst_number: dealers.find(d => d.id === values.dealerId)?.gst_number || null,
            total_amount: finalOrderValue,
            discount_amount: Number(values.discountAmount) || 0,
            round_off: Number(values.roundOff) || 0,
            freight_charges: Number(values.freightCharges) || 0,
            taxable_value: totalTaxableValue,
            total_gst: totalGstAmount,
            grand_total: finalOrderValue,
            payment_status: 'pending',
            status: null,
            notes: '',
            created_by: user?.id,
          };

          console.log('   📝 New Invoice Payload:', invoiceCreatePayload);

          console.log('   📤 Creating new invoice...');
          const tableName = getInvoiceTableName(values.billingCompanyId);
          const { data: createResult, error: createError } = await supabase
            .from(tableName)
            .insert([invoiceCreatePayload])
            .select();

          console.log('   📡 Invoice Create Response:', { created: createResult?.length > 0, error: createError });

          if (createError) {
            console.error('❌ Invoice creation failed:', createError);
            showError(`Failed to create invoice: ${createError.message}`);
            throw createError;
          }

          if (createResult && createResult.length > 0) {
            console.log('✅ Invoice created successfully');
            console.log('   Invoice ID:', createResult[0].id);
            console.log('   Bill Number (auto-generated):', createResult[0].bill_number);
            showSuccess(`✓ Bill #${createResult[0].bill_number} generated successfully!`);
          }
        } catch (err: any) {
          console.error('❌ Exception creating bill:', err);
          showError(`Failed to create bill: ${err?.message || err}`);
          throw err;
        }
      } else {
        console.log('⚠️ No invoice linked or no company selected');
      }

      // Final verification - log what was saved
      console.log('🎉 SAVE COMPLETE - Summary:');
      console.log('   ✅ Order updated with:');
      console.log('      - bill_no:', updateData?.[0]?.bill_no || 'NOT SET');
      console.log('      - bill_date:', updateData?.[0]?.bill_date || 'NOT SET');
      console.log('   ✅ Invoice:', linkedInvoiceId ? 'updated' : 'created');
      console.log('   ✅ Order ID:', orderData.id);

      showSuccess(`Order #${values.orderNumber} updated successfully.`);
      onOrderUpdated();
      onOpenChange(false);

    } catch (error: any) {
      console.error('Error saving order changes:', error);
      showError(`Failed to save order changes: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentSalesPersonId = form.watch('salesPersonId');
  
  const userListToRender = useMemo(() => {
    return assignableUsers.filter(u => u.user_type === 'sales_person');
  }, [assignableUsers]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          fullScreen
            ? 'left-0 top-0 w-full h-screen max-w-none max-h-none translate-x-0 translate-y-0 rounded-none sm:rounded-none p-0 flex flex-col'
            : 'sm:max-w-[500px] md:max-w-[800px] lg:max-w-6xl max-h-[95vh] flex flex-col',
        )}
      >
        {/* Header */}
        <div className="border-b bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-blue-900">Edit Order #{orderData?.order_number}</h2>
              <p className="text-xs text-blue-700 mt-0.5">Modify items, dealer info, and billing details</p>
            </div>
            <button onClick={() => onOpenChange(false)} className="text-gray-500 hover:text-gray-700">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        {loading ? (
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSave)} className="flex flex-col flex-1 overflow-hidden">
              
              {/* Top Section - Order & Dealer Info (Compact) */}
              <div className="flex-shrink-0 border-b bg-white px-6 py-3 space-y-3">
                
                {/* Row 1: Order Date, Dealer, Sales Person */}
                <div className="grid grid-cols-5 gap-3">
                  <FormField control={form.control} name="orderDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Order Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} disabled={isSubmitting} className="h-8 text-xs" />
                      </FormControl>
                    </FormItem>
                  )} />
                  
                  <FormField control={form.control} name="dealerId" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Dealer</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {dealers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  
                  <FormField control={form.control} name="salesPersonId" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Sales Person</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {userListToRender.map(op => <SelectItem key={op.id} value={op.id}>{op.first_name} {op.last_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="discountAmount" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Discount (₹)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} disabled={isSubmitting} className="h-8 text-xs" />
                      </FormControl>
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="freightCharges" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Freight (₹)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} disabled={isSubmitting} className="h-8 text-xs" />
                      </FormControl>
                    </FormItem>
                  )} />
                </div>

                {/* Dealer Info - Inline Compact Display with Colors */}
                {form.watch('dealerId') && (() => {
                  const selectedDealer = dealers.find(d => d.id === form.watch('dealerId'));
                  return selectedDealer ? (
                    <div className="grid grid-cols-5 gap-3 p-3 bg-gradient-to-r from-amber-50 via-orange-50 to-red-50 rounded-lg border-2 border-amber-300">
                      <div className="bg-white rounded border-l-4 border-amber-500 pl-2 py-1"><span className="font-bold text-amber-700">👤 Name:</span> <span className="text-amber-900">{selectedDealer.name}</span></div>
                      <div className="bg-white rounded border-l-4 border-orange-500 pl-2 py-1"><span className="font-bold text-orange-700">📞 Contact:</span> <span className="text-orange-900">{selectedDealer.contact_person || 'N/A'}</span></div>
                      <div className="bg-white rounded border-l-4 border-red-500 pl-2 py-1"><span className="font-bold text-red-700">☎️ Phone:</span> <span className="text-red-900">{selectedDealer.phone || 'N/A'}</span></div>
                      <div className="bg-white rounded border-l-4 border-yellow-500 pl-2 py-1"><span className="font-bold text-yellow-700">📍 Address:</span> <span className="text-yellow-900">{selectedDealer.address || 'N/A'}</span></div>
                      <div className="bg-white rounded border-l-4 border-green-500 pl-2 py-1">
                        <span className="font-bold text-green-700">🏢 GST:</span>
                        {editingGstNumber === selectedDealer.id ? (
                          <div className="flex gap-1 mt-1">
                            <Input 
                              type="text" 
                              value={gstNumberInput} 
                              onChange={(e) => setGstNumberInput(e.target.value.toUpperCase())} 
                              placeholder="Enter GST" 
                              className="h-6 text-xs border-green-400 focus:border-green-500"
                              disabled={isSubmitting}
                            />
                            <Button 
                              type="button" 
                              size="sm" 
                              className="h-6 px-2 bg-green-600 hover:bg-green-700 text-white text-xs" 
                              onClick={() => handleSaveGstNumber(selectedDealer.id)}
                              disabled={isSubmitting}
                            >
                              ✓
                            </Button>
                            <Button 
                              type="button" 
                              size="sm" 
                              className="h-6 px-2 bg-red-500 hover:bg-red-600 text-white text-xs" 
                              onClick={() => {
                                setEditingGstNumber(null);
                                setGstNumberInput('');
                              }}
                              disabled={isSubmitting}
                            >
                              ✕
                            </Button>
                          </div>
                        ) : (
                          <div className="flex justify-between items-center gap-1">
                            <span className="text-green-900 text-sm">{selectedDealer.gst_number || 'Unregistered'}</span>
                            <Button 
                              type="button" 
                              size="sm" 
                              className="h-5 px-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs" 
                              onClick={() => {
                                setEditingGstNumber(selectedDealer.id);
                                setGstNumberInput(selectedDealer.gst_number || '');
                              }}
                              disabled={isSubmitting}
                            >
                              ✎
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null;
                })()}

                {/* Billing Info Row */}
                {form.getValues('billingCompanyId') && (
                  <div className="grid grid-cols-3 gap-3 p-3 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-lg border-2 border-blue-300">
                    <div className="bg-white rounded border-l-4 border-blue-500 pl-2 py-1">
                      <span className="font-bold text-blue-700">🏪 Company:</span> <span className="text-blue-900">{companies.find(c => c.id === form.getValues('billingCompanyId'))?.name || 'N/A'}</span>
                    </div>
                    {selectedFinancialYearId && (
                      <div className="bg-white rounded border-l-4 border-indigo-500 pl-2 py-1">
                        <span className="font-bold text-indigo-700">📊 FY:</span> <span className="text-indigo-900">{financialYears.find(fy => fy.id === selectedFinancialYearId)?.year_name}</span>
                      </div>
                    )}
                    {nextBillNumber && (
                      <div className="bg-white rounded border-l-4 border-purple-500 pl-2 py-1">
                        <span className="font-bold text-purple-700">📄 Bill #:</span> <span className="font-mono font-bold text-purple-700 text-lg">{nextBillNumber}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Delivery & Transport Info - Editable Single Line */}
                <div className="mt-3 grid grid-cols-4 gap-2 p-3 bg-gradient-to-r from-green-50 via-blue-50 to-purple-50 rounded-lg border-2 border-green-200">
                  <FormField control={form.control} name="deliveryLocation" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold bg-gradient-to-r from-green-600 to-green-700 text-white px-2 py-1 rounded">📍 Delivery Location</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., Warehouse A" 
                          {...field} 
                          disabled={isSubmitting} 
                          className="h-7 text-xs border-2 border-green-300 focus:border-green-500 focus:ring-green-400" 
                        />
                      </FormControl>
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="transportName" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold bg-gradient-to-r from-blue-600 to-blue-700 text-white px-2 py-1 rounded">🚚 Transport</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., XYZ Logistics" 
                          {...field} 
                          disabled={isSubmitting} 
                          className="h-7 text-xs border-2 border-blue-300 focus:border-blue-500 focus:ring-blue-400" 
                        />
                      </FormControl>
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="bookingDestination" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold bg-gradient-to-r from-purple-600 to-purple-700 text-white px-2 py-1 rounded">📦 Destination</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., Delhi" 
                          {...field} 
                          disabled={isSubmitting} 
                          className="h-7 text-xs border-2 border-purple-300 focus:border-purple-500 focus:ring-purple-400" 
                        />
                      </FormControl>
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="dateOfDispatch" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold bg-gradient-to-r from-amber-600 to-amber-700 text-white px-2 py-1 rounded">📅 Dispatch Date</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          disabled={isSubmitting} 
                          className="h-7 text-xs border-2 border-amber-300 focus:border-amber-500 focus:ring-amber-400" 
                        />
                      </FormControl>
                    </FormItem>
                  )} />
                </div>
              </div>

              {/* Items Section - 80% Height with Scrolling */}
              <div className="flex-1 flex flex-col overflow-hidden px-6 py-3">
                
                {/* Items Tabs */}
                <div className="mb-2 flex-shrink-0">
                  <Tabs value={selectionTab} onValueChange={(val) => setSelectionTab(val as 'products' | 'combos')} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 h-8">
                      <TabsTrigger value="products" className="text-xs">Add Products ({products.length})</TabsTrigger>
                      <TabsTrigger value="combos" className="text-xs">Add Combos ({combos.length})</TabsTrigger>
                    </TabsList>
                    
                    {/* Products Tab */}
                    <TabsContent value="products" className="space-y-2 mt-2">
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Popover open={isProductPopoverOpen} onOpenChange={setIsProductPopoverOpen}>
                            <PopoverTrigger asChild>
                              <Button variant="outline" role="combobox" className="w-full justify-between h-8 text-xs">{productSearch || 'Select product'}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-0" align="start">
                              <div className="p-2">
                                <Input placeholder="Search..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="h-8 text-xs mb-2" />
                                <ScrollArea className="h-64">
                                  {products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase())).map(product => (
                                    <button key={product.id} onClick={() => { setNewItemProductId(product.id); setProductSearch(''); setIsProductPopoverOpen(false); }} className="w-full justify-start font-normal h-auto py-2 px-2 text-xs hover:bg-gray-100">
                                      <Check className={cn("mr-2 h-4 w-4 flex-shrink-0", newItemProductId === product.id ? "opacity-100" : "opacity-0")} />
                                      <div className="flex flex-col items-start w-full">
                                        <div className="flex items-center justify-between w-full gap-2">
                                          <span>{product.name}</span>
                                          <span className="text-gray-500">₹{product.dp}</span>
                                        </div>
                                        <span className="text-gray-400 text-xs">{product.code}</span>
                                      </div>
                                    </button>
                                  ))}
                                </ScrollArea>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <Button type="button" onClick={addOrderItem} disabled={!newItemProductId || isSubmitting} className="h-8 text-xs px-2 bg-green-600 hover:bg-green-700">
                          <Plus className="h-3 w-3 mr-1" /> Add
                        </Button>
                      </div>
                    </TabsContent>

                    {/* Combos Tab */}
                    <TabsContent value="combos" className="space-y-2 mt-2">
                      <div className="flex gap-2">
                        <Select value={newItemComboId} onValueChange={setNewItemComboId} disabled={isSubmitting}>
                          <SelectTrigger className="h-8 text-xs flex-1">
                            <SelectValue placeholder="Select combo" />
                          </SelectTrigger>
                          <SelectContent>
                            {combos.map(combo => {
                              const avgDiscount = combo.items && combo.items.length > 0 ? combo.items.reduce((sum, item) => sum + (item.discount_percent || 0), 0) / combo.items.length : 0;
                              return (
                                <SelectItem key={combo.combo_id} value={combo.combo_id}>
                                  <div className="flex flex-col">
                                    <span className="font-medium">{combo.combo_name}</span>
                                    <span className="text-xs text-muted-foreground">{combo.item_count} items • ₹{combo.combo_dp.toFixed(2)}</span>
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <Button type="button" onClick={addOrderItem} disabled={!newItemComboId || isSubmitting} className="h-8 text-xs px-2 bg-green-600 hover:bg-green-700">
                          <Plus className="h-3 w-3 mr-1" /> Add
                        </Button>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>

                {/* Items Table - Scrollable with Alternating Colors */}
                {orderItems.length > 0 ? (
                  <div className="flex-1 overflow-y-auto border-2 border-pink-300 rounded-lg bg-white">
                    <Table className="text-xs">
                      <TableHeader className="sticky top-0 bg-gradient-to-r from-pink-300 via-pink-400 to-pink-300 z-10">
                        <TableRow>
                          <TableHead className="w-40 font-bold text-white">📦 Product</TableHead>
                          <TableHead className="w-16 text-center font-bold text-white">📊 Qty</TableHead>
                          <TableHead className="w-20 text-right font-bold text-white">💵 Price</TableHead>
                          <TableHead className="w-16 text-center font-bold text-white">🏷️ Disc%</TableHead>
                          <TableHead className="w-16 text-center font-bold text-white">🎯 GST%</TableHead>
                          <TableHead className="w-20 text-right font-bold text-white">💰 Total</TableHead>
                          <TableHead className="w-8 font-bold text-white">🗑️</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orderItems.map((item, index) => {
                          const isEvenRow = index % 2 === 0;
                          const bgColor = isEvenRow ? 'bg-pink-50 hover:bg-pink-100' : 'bg-rose-300 hover:bg-rose-400';
                          const borderColor = isEvenRow ? 'border-b border-pink-200' : 'border-b border-rose-400';
                          
                          return (
                            <TableRow key={item.id} className={`${bgColor} ${borderColor}`}>
                              <TableCell className="font-medium text-xs text-gray-800">{item.product_name} ({item.product_code})</TableCell>
                              <TableCell className="text-center">
                                <Input type="number" value={item.quantity} onChange={(e) => updateOrderItem(item.id, 'quantity', parseInt(e.target.value) || 0)} className={`h-7 text-xs text-center border-2 ${isEvenRow ? 'border-pink-300 focus:border-pink-500 bg-white' : 'border-rose-400 focus:border-rose-600 bg-rose-50'}`} disabled={isSubmitting} />
                              </TableCell>
                              <TableCell className="text-right">
                                <Input type="number" step="0.01" value={item.unit_dp} onChange={(e) => updateOrderItem(item.id, 'unit_dp', parseFloat(e.target.value) || 0)} className={`h-7 text-xs text-right border-2 ${isEvenRow ? 'border-pink-300 focus:border-pink-500 bg-white' : 'border-rose-400 focus:border-rose-600 bg-rose-50'}`} disabled={isSubmitting} />
                              </TableCell>
                              <TableCell className="text-center">
                                <Input type="number" step="0.1" value={item.discount_percent} onChange={(e) => updateOrderItem(item.id, 'discount_percent', parseFloat(e.target.value) || 0)} className={`h-7 text-xs text-center border-2 ${isEvenRow ? 'border-pink-300 focus:border-pink-500 bg-white' : 'border-rose-400 focus:border-rose-600 bg-rose-50'}`} disabled={isSubmitting} />
                              </TableCell>
                              <TableCell className="text-center">
                                <Input type="number" step="0.1" value={item.gst_percent} onChange={(e) => updateOrderItem(item.id, 'gst_percent', parseFloat(e.target.value) || 0)} className={`h-7 text-xs text-center border-2 ${isEvenRow ? 'border-pink-300 focus:border-pink-500 bg-white' : 'border-rose-400 focus:border-rose-600 bg-rose-50'}`} disabled={isSubmitting} />
                              </TableCell>
                              <TableCell className={`text-right font-bold text-lg ${isEvenRow ? 'text-green-700' : 'text-white'}`}>₹{item.total_price.toFixed(2)}</TableCell>
                              <TableCell>
                                <Button variant="ghost" size="icon" onClick={() => removeOrderItem(item.id)} disabled={isSubmitting} className={`h-6 w-6 ${isEvenRow ? 'hover:bg-pink-200' : 'hover:bg-rose-500'}`}>
                                  <Trash2 className={`h-3 w-3 ${isEvenRow ? 'text-red-500' : 'text-white'}`} />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center border-2 border-pink-300 rounded-lg bg-gradient-to-br from-pink-50 to-rose-50">
                    <p className="text-pink-500 text-sm font-semibold">No items added. Use tabs above to add products or combos.</p>
                  </div>
                )}
              </div>

              {/* Bottom Section - Totals and Actions (Fixed) */}
              <div className="flex-shrink-0 border-t bg-gradient-to-r from-gray-50 via-blue-50 to-purple-50 px-6 py-3 space-y-2">
                <div className="grid grid-cols-5 gap-4 text-sm">
                  <div className="p-3 bg-gradient-to-br from-green-100 to-green-50 rounded-lg border-2 border-green-400 shadow-md">
                    <p className="text-xs font-bold text-green-700">💰 Taxable Value</p>
                    <p className="font-bold text-green-900 text-lg">₹{totalTaxableValue.toFixed(2)}</p>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-orange-100 to-orange-50 rounded-lg border-2 border-orange-400 shadow-md">
                    <p className="text-xs font-bold text-orange-700">📊 Total GST</p>
                    <p className="font-bold text-orange-900 text-lg">₹{totalGstAmount.toFixed(2)}</p>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-blue-100 to-blue-50 rounded-lg border-2 border-blue-400 shadow-md">
                    <p className="text-xs font-bold text-blue-700">🧮 Subtotal</p>
                    <p className="font-bold text-blue-900 text-lg">₹{preGlobalDiscountTotal.toFixed(2)}</p>
                  </div>
                  <FormField control={form.control} name="roundOff" render={({ field }) => (
                    <FormItem className="p-3 bg-gradient-to-br from-amber-100 to-amber-50 rounded-lg border-2 border-amber-400 shadow-md">
                      <FormLabel className="text-xs font-bold text-amber-700 block">🔄 Round Off</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} className="h-8 text-xs font-bold text-right bg-white border-amber-300" disabled={isSubmitting} />
                      </FormControl>
                    </FormItem>
                  )} />
                  <div className="p-3 bg-gradient-to-br from-red-200 via-purple-200 to-blue-200 rounded-lg border-2 border-purple-500 shadow-lg">
                    <p className="text-xs font-bold text-purple-900">💎 TOTAL AMOUNT</p>
                    <p className="font-bold text-purple-900 text-xl">₹{finalOrderValue.toFixed(2)}</p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 justify-end pt-2">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting || isGeneratingBill} className="text-xs h-8 bg-red-50 hover:bg-red-100 border-red-300 text-red-700 font-bold">✕ Cancel</Button>
                  <Button type="submit" disabled={isSubmitting || isGeneratingBill} className="text-xs h-8 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold shadow-md">
                    {isSubmitting ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : '💾 Save Order'}
                  </Button>
                  {form.getValues('billingCompanyId') && selectedFinancialYearId && nextBillNumber && billSeriesId && !linkedInvoiceId && !cancelledInvoiceId && (
                    <Button type="button" className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white text-xs h-8 font-bold shadow-md" onClick={async () => {
                      setIsGeneratingBill(true);
                      try {
                        const isFormValid = await form.trigger();
                        if (!isFormValid) {
                          showError('Please fix form errors before generating bill');
                          setIsGeneratingBill(false);
                          return;
                        }
                        const values = form.getValues();
                        await handleSave(values);
                      } catch (err) {
                        console.error('Error in bill generation:', err);
                      } finally {
                        setIsGeneratingBill(false);
                      }
                    }} disabled={isSubmitting || isGeneratingBill}>
                      {isGeneratingBill ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : '📄 Generate Bill'}
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EditOrderDialog;

