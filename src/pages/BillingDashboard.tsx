"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { showError, showSuccess } from '@/utils/toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Loader2, Plus, FileText, Edit, DollarSign, ArrowLeft, LogOut, TrendingUp, Eye, Printer, Filter, Trash2, AlertCircle, Check, X, MoreVertical, Download, Truck } from 'lucide-react';
import { MadeWithDyad } from '@/components/made-with-dyad';
import EditOrderDialog from '@/components/EditOrderDialog';
import PrintBillDialog from '@/components/PrintBillDialog';
import DealerLedgerReportNewDialog from '@/components/reports/DealerLedgerReportNewDialog';
import CreditNoteDialog from '@/components/CreditNoteDialog';
import CreditNotesReportDialog from '@/components/reports/CreditNotesReportDialog';
import ImportBillsDialog from '@/components/ImportBillsDialog';
import EwayBillDialog from '@/components/EwayBillDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import {
  BillingProgressCard,
  RevenueSummaryCard,
  PendingPaymentsCard,
  CustomerMetricsCard,
  MonthlyRevenueChart,
  InvoiceStatusChart,
  PaymentAgeingCard,
  PendingPayment,
  CustomerMetric,
  MonthData,
  InvoiceStatus,
  AgeingData,
} from '@/components/dashboard';

interface OrderWithDetails {
  id: string;
  order_number: number;
  order_date: string;
  dealer_id: string;
  dealer_name: string;
  dealer_gst: string | null;
  total_amount: number;
  discount_amount: number;
  round_off: number;
  freight_charges: number;
  bill_no: string | null;
  status: string;
  payment_status: string;
  items_count: number;
  is_urgent?: boolean;
}

interface InvoiceReport {
  total_generated: number;
  total_amount: number;
  pending_payment: number;
  paid_amount: number;
  recent_invoices: Array<{
    id: string;
    bill_number: string;
    bill_date: string;
    grand_total: number;
    payment_status: string;
    status?: 'approve' | 'reject' | null;
    dealers?: { name: string };
    companies?: { name: string };
  }>;
}

// Helper function to query from both company tables
const queryBothInvoiceTables = async (
  selectClause: string,
  filters?: { column: string; value: any; operator?: string }[],
  orderBy?: { column: string; ascending: boolean },
  limit?: number
) => {
  try {
    // Query spartan table
    let spartanQuery = supabase.from('spartan').select(selectClause);
    if (filters) {
      filters.forEach(f => {
        if (f.operator === 'eq') spartanQuery = spartanQuery.eq(f.column, f.value);
        else if (f.operator === 'neq') spartanQuery = spartanQuery.neq(f.column, f.value);
        else if (f.operator === 'gte') spartanQuery = spartanQuery.gte(f.column, f.value);
        else spartanQuery = spartanQuery.eq(f.column, f.value);
      });
    }
    if (orderBy) spartanQuery = spartanQuery.order(orderBy.column, { ascending: orderBy.ascending });
    if (limit) spartanQuery = spartanQuery.limit(limit);

    const { data: spartanData, error: spartanError } = await spartanQuery;

    // Query fightor table
    let fightorQuery = supabase.from('fightor').select(selectClause);
    if (filters) {
      filters.forEach(f => {
        if (f.operator === 'eq') fightorQuery = fightorQuery.eq(f.column, f.value);
        else if (f.operator === 'neq') fightorQuery = fightorQuery.neq(f.column, f.value);
        else if (f.operator === 'gte') fightorQuery = fightorQuery.gte(f.column, f.value);
        else fightorQuery = fightorQuery.eq(f.column, f.value);
      });
    }
    if (orderBy) fightorQuery = fightorQuery.order(orderBy.column, { ascending: orderBy.ascending });
    if (limit) fightorQuery = fightorQuery.limit(limit);

    const { data: fightorData, error: fightorError } = await fightorQuery;

    // Combine results
    const combined = [...(spartanData || []), ...(fightorData || [])];
    
    // Sort if needed
    if (orderBy) {
      combined.sort((a, b) => {
        const aVal = a[orderBy.column];
        const bVal = b[orderBy.column];
        if (aVal < bVal) return orderBy.ascending ? -1 : 1;
        if (aVal > bVal) return orderBy.ascending ? 1 : -1;
        return 0;
      });
    }

    // Apply limit to combined results
    if (limit) return combined.slice(0, limit);
    return combined;
  } catch (error) {
    console.error('Error querying invoice tables:', error);
    return [];
  }
};

const BillingDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, userType } = useSession();
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDealer, setSelectedDealer] = useState<string>('all');
  const [dealersList, setDealersList] = useState<Array<{ id: string; name: string }>>([]);
  const [searchOrder, setSearchOrder] = useState<string>('');
  const [searchBill, setSearchBill] = useState<string>('');
  const [searchHoldOrder, setSearchHoldOrder] = useState<string>('');
  const [searchApprovedBill, setSearchApprovedBill] = useState<string>('');
  const [searchCancelledBill, setSearchCancelledBill] = useState<string>('');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedOrderForEdit, setSelectedOrderForEdit] = useState<string | null>(null);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [selectedOrderForPrint, setSelectedOrderForPrint] = useState<string | { id: string; sourceTable?: string } | null>(null);
  const [isBillGenerateDialogOpen, setIsBillGenerateDialogOpen] = useState(false);
  const [selectedOrderForBill, setSelectedOrderForBill] = useState<OrderWithDetails | null>(null);
  const [isGeneratingBill, setIsGeneratingBill] = useState(false);
  const [companies, setCompanies] = useState<Array<{ 
    id: string; 
    name: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    gst_number?: string;
    contact_number?: string;
    email?: string;
    website?: string;
    logo_url?: string;
    is_active?: boolean;
  }>>([]);
  const [financialYears, setFinancialYears] = useState<Array<{ id: string; year_name: string }>>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedFinancialYearId, setSelectedFinancialYearId] = useState<string>('');
  const [nextBillNumber, setNextBillNumber] = useState<string>('');
  const [billSeriesId, setBillSeriesId] = useState<string>('');
  const [billSeriesDetails, setBillSeriesDetails] = useState<any>({});
  const [isBillSettingsDialogOpen, setIsBillSettingsDialogOpen] = useState(false);
  const [editableBillSettings, setEditableBillSettings] = useState<any>({});
  const [invoiceStats, setInvoiceStats] = useState<InvoiceReport>({
    total_generated: 0,
    total_amount: 0,
    pending_payment: 0,
    paid_amount: 0,
    recent_invoices: [],
  });
  const [approvedInvoices, setApprovedInvoices] = useState<any[]>([]);
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [isDealerLedgerReportOpen, setIsDealerLedgerReportOpen] = useState(false);
  const [selectedInvoiceForPreview, setSelectedInvoiceForPreview] = useState<any>(null);
  const [heldOrders, setHeldOrders] = useState<OrderWithDetails[]>([]);
  const [holdReasons, setHoldReasons] = useState<Map<string, string>>(new Map());
  const [isHoldDialogOpen, setIsHoldDialogOpen] = useState(false);
  const [selectedOrderForHold, setSelectedOrderForHold] = useState<OrderWithDetails | null>(null);
  const [holdReason, setHoldReason] = useState<string>('');
  const [isEditingFromHeldOrders, setIsEditingFromHeldOrders] = useState(false);
  const [isEditingFromCancelledBills, setIsEditingFromCancelledBills] = useState(false);
  const [cancelledBills, setCancelledBills] = useState<Array<{ id: string; bill_number: string; grand_total: number; dealers?: { name: string } }>>([]);
  const [selectedCancelledBillInfo, setSelectedCancelledBillInfo] = useState<any>(null);
  const [isCancelBillDialogOpen, setIsCancelBillDialogOpen] = useState(false);
  const [isCreditNoteDialogOpen, setIsCreditNoteDialogOpen] = useState(false);
  const [isCreditNotesReportOpen, setIsCreditNotesReportOpen] = useState(false);
  const [isImportBillsDialogOpen, setIsImportBillsDialogOpen] = useState(false);
  const [isEwayBillDialogOpen, setIsEwayBillDialogOpen] = useState(false);
  const [selectedBillForCancel, setSelectedBillForCancel] = useState<any>(null);
  const [cancelBillReason, setCancelBillReason] = useState<string>('');
  const [billVerificationStatus, setBillVerificationStatus] = useState<Map<string, 'pending' | 'verified' | 'rejected'>>(new Map());

  // Dashboard metrics state
  const [dashboardMetrics, setDashboardMetrics] = useState({
    invoiceProgress: 0,
    totalRevenue: 0,
    targetRevenue: 5000000, // ₹50L target
    pendingPayments: [] as PendingPayment[],
    topDealers: [] as CustomerMetric[],
    monthlyRevenue: [] as MonthData[],
    invoiceStatuses: [] as InvoiceStatus[],
    paymentAgeing: [] as AgeingData[],
  });
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Check authorization
  useEffect(() => {
    if (!sessionLoading && userType !== 'billing' && userType !== 'admin') {
      showError('You do not have permission to access this page');
      navigate('/dashboard');
    }
  }, [sessionLoading, userType, navigate]);

  // Fetch companies
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const { data, error } = await supabase
          .from('companies')
          .select('id, name, address, city, state, country, gst_number, contact_number, email, website, logo_url, is_active')
          .order('name');
        
        if (error) {
          console.error('Error fetching companies:', error);
          throw error;
        }
        console.log('Fetched companies:', data); // Debug log
        setCompanies(data || []);
      } catch (err) {
        console.error('Error fetching companies:', err);
      }
    };

    fetchCompanies();
  }, []);

  // Fetch financial years for selected company
  useEffect(() => {
    if (!selectedCompanyId) {
      setFinancialYears([]);
      setSelectedFinancialYearId('');
      return;
    }

    const fetchFYs = async () => {
      try {
        const { data, error } = await supabase
          .from('financial_years')
          .select('id, year_name')
          .eq('company_id', selectedCompanyId)
          .eq('is_active', true)
          .order('start_date', { ascending: false });
        
        if (error) throw error;
        setFinancialYears(data || []);
      } catch (err) {
        console.error('Error fetching financial years:', err);
      }
    };

    fetchFYs();
  }, [selectedCompanyId]);

  // Fetch next bill number for selected company and financial year
  useEffect(() => {
    if (!selectedCompanyId || !selectedFinancialYearId) {
      setNextBillNumber('');
      setBillSeriesId('');
      return;
    }

    const fetchNextBillNumber = async () => {
      try {
        const { data, error } = await supabase
          .from('bill_series')
          .select('id, series_prefix, series_separator, current_sequence_number')
          .eq('company_id', selectedCompanyId)
          .eq('financial_year_id', selectedFinancialYearId)
          .eq('is_active', true)
          .single();
        
        if (error) throw error;
        
        if (data) {
          setBillSeriesId(data.id);
          setBillSeriesDetails(data);
          setEditableBillSettings({
            series_prefix: data.series_prefix,
            series_separator: data.series_separator || '',
            current_sequence_number: data.current_sequence_number
          });
          const separator = data.series_separator || '';
          const billNo = `${data.series_prefix}${separator}${data.current_sequence_number}`;
          setNextBillNumber(billNo);
        }
      } catch (err) {
        console.error('Error fetching bill number:', err);
        showError('Could not fetch bill number. Please check if bill series is configured.');
      }
    };

    fetchNextBillNumber();
  }, [selectedCompanyId, selectedFinancialYearId]);

  // Fetch invoice statistics and recent invoices
  const fetchInvoiceStats = useCallback(async () => {
    setIsReportLoading(true);
    try {
      // Query from both spartan and fightor tables
      const { data: spartanData, error: spartanError } = await supabase
        .from('spartan')
        .select(`
          id,
          order_id,
          bill_number,
          bill_date,
          grand_total,
          payment_status,
          status,
          cancellation_reason,
          rejection_reason,
          dealers(id, name, gst_number),
          companies(id, name, address, city, state, country, gst_number, contact_number, email)
        `)
        .order('bill_date', { ascending: false });

      const { data: fightorData, error: fightorError } = await supabase
        .from('fightor')
        .select(`
          id,
          order_id,
          bill_number,
          bill_date,
          grand_total,
          payment_status,
          status,
          cancellation_reason,
          rejection_reason,
          dealers(id, name, gst_number),
          companies(id, name, address, city, state, country, gst_number, contact_number, email)
        `)
        .order('bill_date', { ascending: false });

      if (spartanError && fightorError) throw spartanError;

      // Add source table info to track bill origin
      const spartanWithSource = (spartanData || []).map(inv => ({ ...inv, source_table: 'spartan' }));
      const fightorWithSource = (fightorData || []).map(inv => ({ ...inv, source_table: 'fightor' }));

      // Combine results
      const invoices = [...spartanWithSource, ...fightorWithSource];
      invoices.sort((a, b) => new Date(b.bill_date).getTime() - new Date(a.bill_date).getTime());
      invoices.splice(20); // Keep only latest 20

      const pendingInvoices = invoices.filter((inv) => inv.status === 'pending' || inv.status === null);
      const approvedBills = invoices.filter((inv) => inv.status === 'approve');
      const cancelledBillsList = invoices.filter((inv) => inv.status === 'cancelled' || inv.status === 'reject');
      
      const totalGenerated = invoices.length;
      const totalAmount = invoices.reduce((sum, inv) => sum + (inv.grand_total || 0), 0);
      const pendingPayments = invoices
        .filter((inv) => inv.payment_status === 'pending' && inv.status !== 'cancelled')
        .reduce((sum, inv) => sum + (inv.grand_total || 0), 0);
      const paidAmount = invoices
        .filter((inv) => inv.payment_status === 'paid')
        .reduce((sum, inv) => sum + (inv.grand_total || 0), 0);

      setInvoiceStats({
        total_generated: totalGenerated,
        total_amount: totalAmount,
        pending_payment: pendingPayments,
        paid_amount: paidAmount,
        recent_invoices: pendingInvoices.slice(0, 5),
      });
      
      setApprovedInvoices(approvedBills);
      setCancelledBills(cancelledBillsList);
    } catch (err) {
      console.error('Error fetching invoice stats:', err);
    } finally {
      setIsReportLoading(false);
    }
  }, []);

  // Fetch dashboard metrics
  const fetchDashboardMetrics = useCallback(async () => {
    setDashboardLoading(true);
    try {
      const today = new Date();
      const monthStart = startOfMonth(today);
      const monthEnd = endOfMonth(today);
      const last30Days = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Fetch all invoices for dashboard from both tables
      const { data: spartanInvoices, error: spartanError } = await supabase
        .from('spartan')
        .select(`
          id,
          bill_number,
          grand_total,
          payment_status,
          dealer_id,
          bill_date,
          dealers(id, name)
        `)
        .order('bill_date', { ascending: false });

      const { data: fightorInvoices, error: fightorError } = await supabase
        .from('fightor')
        .select(`
          id,
          bill_number,
          grand_total,
          payment_status,
          dealer_id,
          bill_date,
          dealers(id, name)
        `)
        .order('bill_date', { ascending: false });

      if (spartanError && fightorError) throw spartanError;

      const allInvoices = [...(spartanInvoices || []), ...(fightorInvoices || [])];

      // Get current month invoices
      const invoices = (allInvoices || []).filter((inv: any) => {
        const invDate = new Date(inv.bill_date);
        return invDate >= monthStart && invDate <= monthEnd;
      });

      // Fetch all orders to calculate progress
      const { data: allOrders, error: allOrdersError } = await supabase
        .from('orders')
        .select('id, order_number, bill_no, hod_status')
        .eq('hod_status', 'approved');

      if (allOrdersError) throw allOrdersError;

      // Fetch pending orders (awaiting billing)
      const { data: pendingOrders, error: orderError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          order_date,
          total_amount,
          dealers(id, name)
        `)
        .is('bill_no', null)
        .eq('hod_status', 'approved');

      if (orderError) throw orderError;

      // Calculate invoice progress (billed vs total approved)
      const totalApprovedOrders = allOrders?.length || 1;
      const billedOrders = (allInvoices || []).length;
      const invoiceProgress = Math.round((billedOrders / totalApprovedOrders) * 100);

      // Calculate revenue - use last 30 days if current month is empty
      let currentRevenue = invoices?.reduce((sum: number, inv: any) => sum + (inv.grand_total || 0), 0) || 0;
      if (currentRevenue === 0) {
        currentRevenue = (allInvoices || [])
          .filter((inv: any) => new Date(inv.bill_date) >= last30Days)
          .reduce((sum: number, inv: any) => sum + (inv.grand_total || 0), 0);
      }

      // Get pending payments
      const allInvoicesList = allInvoices || [];
      const pendingInvoices = allInvoicesList.filter((inv: any) => inv.payment_status === 'pending');
      const pendingPaymentsList: PendingPayment[] = pendingInvoices
        .slice(0, 5)
        .map((inv: any) => ({
          id: inv.id,
          dealerName: inv.dealers?.name || 'Unknown',
          amount: inv.grand_total || 0,
          invoiceNumber: inv.bill_number?.toString() || '',
          daysOverdue: Math.floor((today.getTime() - new Date(inv.bill_date).getTime()) / (1000 * 60 * 60 * 24)),
        }))
        .filter(p => p.dealerName !== 'Demo' && p.dealerName !== 'Unknown'); // Remove demo entries

      // Get top dealers from all invoices
      const dealerMap = new Map<string, { revenue: number; orders: number; name: string }>();
      allInvoicesList.forEach((inv: any) => {
        const dealerId = inv.dealer_id;
        const dealerName = inv.dealers?.name || 'Unknown';
        
        // Skip demo entries
        if (dealerName === 'Demo' || dealerName === 'Unknown') return;

        if (dealerMap.has(dealerId)) {
          const current = dealerMap.get(dealerId)!;
          dealerMap.set(dealerId, {
            revenue: current.revenue + (inv.grand_total || 0),
            orders: current.orders + 1,
            name: dealerName,
          });
        } else {
          dealerMap.set(dealerId, { revenue: inv.grand_total || 0, orders: 1, name: dealerName });
        }
      });

      const totalDealerRevenue = Array.from(dealerMap.values()).reduce((sum, d) => sum + d.revenue, 0) || 1;
      const topDealersList: CustomerMetric[] = Array.from(dealerMap.entries())
        .map(([id, data]) => ({
          id,
          name: data.name,
          revenue: data.revenue,
          percentage: (data.revenue / totalDealerRevenue) * 100,
          orders: data.orders,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      // Get monthly revenue for last 6 months
      const monthlyData: MonthData[] = [];
      const totalRevenue = allInvoicesList.reduce((sum: number, inv: any) => sum + (inv.grand_total || 0), 0) || 5000000;
      const targetRevenue = Math.max(totalRevenue * 1.2, 5000000); // Target is 20% more than actual or ₹50L minimum

      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(today, i);
        const mStart = startOfMonth(monthDate);
        const mEnd = endOfMonth(monthDate);
        
        const monthRevenue = allInvoicesList
          .filter((inv: any) => {
            const invDate = new Date(inv.bill_date);
            return invDate >= mStart && invDate <= mEnd;
          })
          .reduce((sum: number, inv: any) => sum + (inv.grand_total || 0), 0) || 0;

        monthlyData.push({
          month: format(monthDate, 'MMM'),
          revenue: monthRevenue,
          target: targetRevenue / 6, // Distribute target across months
        });
      }

      // Get invoice status distribution - excluding demo data
      const validInvoices = allInvoicesList.filter((inv: any) => 
        inv.dealers?.name !== 'Demo' && inv.dealers?.name !== 'Unknown'
      );
      const totalInvoiceCount = validInvoices.length || 1;
      const paidCount = validInvoices.filter((inv: any) => inv.payment_status === 'paid').length;
      const pendingCount = validInvoices.filter((inv: any) => inv.payment_status === 'pending').length;
      const overdueCount = validInvoices.filter((inv: any) => {
        const daysDiff = Math.floor((today.getTime() - new Date(inv.bill_date).getTime()) / (1000 * 60 * 60 * 24));
        return inv.payment_status === 'pending' && daysDiff > 30;
      }).length;

      const invoiceStatuses: InvoiceStatus[] = [
        { status: 'Paid', count: paidCount, percentage: (paidCount / totalInvoiceCount) * 100, color: '#10B981' },
        { status: 'Pending', count: pendingCount, percentage: (pendingCount / totalInvoiceCount) * 100, color: '#F59E0B' },
        { status: 'Overdue', count: overdueCount, percentage: (overdueCount / totalInvoiceCount) * 100, color: '#EF4444' },
        { status: 'Paid', count: paidCount, percentage: 0, color: '#6B7280' }, // Placeholder
      ];

      // Get payment ageing
      const ageingBuckets = [
        { period: '0-30 Days', minDays: 0, maxDays: 30, color: '#10B981' },
        { period: '30-60 Days', minDays: 30, maxDays: 60, color: '#F59E0B' },
        { period: '60-90 Days', minDays: 60, maxDays: 90, color: '#FF6B6B' },
        { period: '90+ Days', minDays: 90, maxDays: 999, color: '#DC2626' },
      ];

      const ageing: AgeingData[] = ageingBuckets.map((bucket) => {
        const invoicesInBucket = pendingInvoices.filter((inv: any) => {
          const days = Math.floor((today.getTime() - new Date(inv.bill_date).getTime()) / (1000 * 60 * 60 * 24));
          return days >= bucket.minDays && days <= bucket.maxDays;
        });
        
        const amount = invoicesInBucket.reduce((sum: number, inv: any) => sum + (inv.grand_total || 0), 0);
        const totalPending = pendingInvoices.reduce((sum: number, inv: any) => sum + (inv.grand_total || 0), 0) || 1;

        return {
          period: bucket.period,
          amount,
          percentage: (amount / totalPending) * 100,
          invoices: invoicesInBucket.length,
          color: bucket.color,
        };
      });

      setDashboardMetrics({
        invoiceProgress,
        totalRevenue: currentRevenue,
        targetRevenue: targetRevenue / 6,
        pendingPayments: pendingPaymentsList,
        topDealers: topDealersList,
        monthlyRevenue: monthlyData,
        invoiceStatuses,
        paymentAgeing: ageing,
      });
    } catch (err) {
      console.error('Error fetching dashboard metrics:', err);
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  // Fetch invoice statistics and recent invoices
  useEffect(() => {
    if (!sessionLoading) {
      fetchDashboardMetrics();
      fetchInvoiceStats();
    }
  }, [sessionLoading, fetchDashboardMetrics, fetchInvoiceStats]);

  // Fetch dealers for filter dropdown
  const fetchDealers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('dealers')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      setDealersList(data || []);
    } catch (err) {
      console.error('Error fetching dealers:', err);
    }
  }, []);

  // Fetch orders WITHOUT bills (orders awaiting billing)
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, 
          order_number, 
          order_date, 
          dealer_id,
          total_amount,
          discount_amount,
          round_off,
          freight_charges,
          bill_no,
          status,
          payment_status,
          hod_status,
          hold_status,
          hold_reason,
          is_urgent,
          dealers(id, name, gst_number),
          sales(id)
        `)
        .is('bill_no', null)
        .eq('hod_status', 'approved')
        .order('order_date', { ascending: false });

      if (error) throw error;

      const formattedOrders: OrderWithDetails[] = (data || [])
        .filter((order: any) => {
          // Hide orders where dealer name contains "Online Order"
          const dealerName = order.dealers?.name || '';
          if (dealerName.toLowerCase().includes('online order')) return false;
          
          // Hide orders that are on hold (hold_status = 'active')
          if (order.hold_status === 'active') return false;
          
          return true;
        })
        .map((order: any) => ({
          id: order.id,
          order_number: order.order_number,
          order_date: order.order_date,
          dealer_id: order.dealer_id,
          dealer_name: order.dealers?.name || 'Unknown',
          dealer_gst: order.dealers?.gst_number || null,
          total_amount: order.total_amount,
          discount_amount: order.discount_amount || 0,
          round_off: order.round_off || 0,
          freight_charges: order.freight_charges || 0,
          bill_no: order.bill_no,
          status: order.status,
          payment_status: order.payment_status,
          items_count: order.sales?.length || 0,
          is_urgent: order.is_urgent || false,
        }));

      setOrders(formattedOrders);
      applyFilters(formattedOrders, selectedDealer, searchOrder);
    } catch (err) {
      console.error('Error fetching orders:', err);
      showError('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [selectedDealer, searchOrder]);

  // Fetch held orders from database
  const fetchHeldOrders = useCallback(async () => {
    try {
      // Fetch held orders from database (hold_status = 'active')
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, 
          order_number, 
          order_date, 
          dealer_id,
          total_amount,
          discount_amount,
          round_off,
          freight_charges,
          bill_no,
          status,
          payment_status,
          hod_status,
          is_urgent,
          dealers(id, name, gst_number),
          sales(id)
        `)
        .eq('hold_status', 'active')
        .is('bill_no', null)
        .eq('hod_status', 'approved')
        .order('order_date', { ascending: false });

      if (error) {
        console.warn('Hold status feature not yet available (migration pending):', error.message);
        return; // Silently fail - feature not yet enabled
      }

      if (data) {
        const formattedHeldOrders: OrderWithDetails[] = data
          .filter((order: any) => {
            const dealerName = order.dealers?.name || '';
            return !dealerName.toLowerCase().includes('online order');
          })
          .map((order: any) => ({
            id: order.id,
            order_number: order.order_number,
            order_date: order.order_date,
            dealer_id: order.dealer_id,
            dealer_name: order.dealers?.name || 'Unknown',
            dealer_gst: order.dealers?.gst_number || null,
            total_amount: order.total_amount,
            discount_amount: order.discount_amount || 0,
            round_off: order.round_off || 0,
            freight_charges: order.freight_charges || 0,
            bill_no: order.bill_no,
            status: order.status,
            payment_status: order.payment_status,
            items_count: order.sales?.length || 0,
          }));

        setHeldOrders(formattedHeldOrders);
      }
    } catch (err) {
      console.warn('Could not fetch held orders:', err);
      // Silently continue - hold feature not yet available
    }
  }, []);

  // Apply filters
  const applyFilters = (ordersToFilter: OrderWithDetails[], dealerId: string, search: string) => {
    let filtered = ordersToFilter;

    if (dealerId && dealerId !== 'all') {
      filtered = filtered.filter((order) => order.dealer_id === dealerId);
    }

    if (search) {
      filtered = filtered.filter((order) =>
        order.order_number.toString().includes(search) ||
        order.dealer_name.toLowerCase().includes(search.toLowerCase())
      );
    }

    setFilteredOrders(filtered);
  };

  useEffect(() => {
    fetchDealers();
    fetchOrders();
    fetchHeldOrders();
  }, []);

  useEffect(() => {
    applyFilters(orders, selectedDealer, searchOrder);
  }, [selectedDealer, searchOrder, orders]);

  // Smart auto-sync: Check for changes without full refetch
  useEffect(() => {
    if (sessionLoading) return;

    console.log('⚡ Smart auto-sync activated (checks every 10 seconds)');
    let lastOrderHash = '';
    let lastInvoiceHash = '';

    const autoSyncInterval = setInterval(async () => {
      try {
        // Get lightweight signatures of current data (using order_date instead of updated_at)
        const { data: orderSignature, error: orderError } = await supabase
          .from('orders')
          .select('id, is_urgent, bill_no, status, order_date')
          .is('bill_no', null)
          .eq('hod_status', 'approved')
          .order('order_date', { ascending: false })
          .limit(50);

        if (orderError) {
          console.error('Order signature error:', orderError);
        } else {
          // Create hash of signatures
          const newOrderHash = JSON.stringify(orderSignature);

          // If data changed, do full refetch and update UI
          if (newOrderHash !== lastOrderHash && lastOrderHash !== '') {
            console.log('✨ Orders changed - auto-syncing...');
            setLastSyncTime(new Date());
            fetchOrders();
            lastOrderHash = newOrderHash;
          } else if (lastOrderHash === '') {
            lastOrderHash = newOrderHash; // First load, just store hash
          }
        }

        const { data: spartanSignature, error: spartanError } = await supabase
          .from('spartan')
          .select('id, status, bill_date')
          .order('bill_date', { ascending: false })
          .limit(50);

        const { data: fightorSignature, error: fightorError } = await supabase
          .from('fightor')
          .select('id, status, bill_date')
          .order('bill_date', { ascending: false })
          .limit(50);

        if (spartanError && fightorError) {
          console.error('Invoice signature error');
        } else {
          const invoiceSignature = [...(spartanSignature || []), ...(fightorSignature || [])];
          const newInvoiceHash = JSON.stringify(invoiceSignature);

          // If data changed, do full refetch and update UI
          if (newInvoiceHash !== lastInvoiceHash && lastInvoiceHash !== '') {
            console.log('✨ Invoices changed - auto-syncing...');
            setLastSyncTime(new Date());
            fetchInvoiceStats();
            fetchDashboardMetrics();
            lastInvoiceHash = newInvoiceHash;
          } else if (lastInvoiceHash === '') {
            lastInvoiceHash = newInvoiceHash; // First load, just store hash
          }
        }
      } catch (error) {
        console.error('Auto-sync check failed:', error);
      }
    }, 10000); // Check every 10 seconds

    return () => {
      console.log('⛔ Stopping auto-sync');
      clearInterval(autoSyncInterval);
    };
  }, [sessionLoading]);

  // Generate Bill
  const handleGenerateBill = async () => {
    if (!selectedCompanyId || !selectedFinancialYearId || !selectedOrderForBill) {
      showError('Please select company and financial year');
      return;
    }

    setIsGeneratingBill(true);
    try {
      // Determine which table to use based on company ID
      const tableName = selectedCompanyId === '8d4f9e5c-8f83-4a79-8229-3a563aa4ed56'
        ? 'spartan'
        : selectedCompanyId === 'e14cf6e2-a3c8-48f1-a418-1acb0983c070'
          ? 'fightor'
          : null;

      if (!tableName) {
        showError('Unknown company selected');
        setIsGeneratingBill(false);
        return;
      }

      if (!billSeriesId) {
        showError('Please select a valid bill series for the chosen company and financial year');
        setIsGeneratingBill(false);
        return;
      }

      const billDate = new Date().toISOString().split('T')[0];
      console.log('🔔 Generating bill for company:', selectedCompanyId);
      console.log('   Table:', tableName);
      console.log('   Bill series ID:', billSeriesId);
      console.log('   Preview bill number:', nextBillNumber);

      const { data: invoiceResult, error: invoiceError } = await supabase
        .from(tableName)
        .insert([
          {
            order_id: selectedOrderForBill.id,
            company_id: selectedCompanyId,
            financial_year_id: selectedFinancialYearId,
            bill_series_id: billSeriesId,
            bill_number: nextBillNumber,
            bill_date: billDate,
            dealer_id: selectedOrderForBill.dealer_id,
            gst_number: selectedOrderForBill.dealer_gst,
            total_amount: selectedOrderForBill.total_amount,
            discount_amount: selectedOrderForBill.discount_amount,
            round_off: selectedOrderForBill.round_off,
            freight_charges: selectedOrderForBill.freight_charges,
            taxable_value: selectedOrderForBill.total_amount - selectedOrderForBill.discount_amount,
            total_gst: 0,
            grand_total: selectedOrderForBill.total_amount - selectedOrderForBill.discount_amount + selectedOrderForBill.round_off + selectedOrderForBill.freight_charges,
            created_by: user?.id,
          },
        ])
        .select();

      if (invoiceError) {
        console.warn('⚠️ Invoice insert error:', invoiceError);
        throw invoiceError;
      }

      const generatedBillNumber = invoiceResult?.[0]?.bill_number || nextBillNumber;
      console.log('📄 Generated invoice result:', invoiceResult);
      console.log('   Bill number used for order:', generatedBillNumber);

      const { data: updateData, error: updateError } = await supabase
        .from('orders')
        .update({ 
          bill_no: generatedBillNumber,
          bill_date: billDate
        })
        .eq('id', selectedOrderForBill.id)
        .select();

      console.log('📡 Order update response:', { updateData, updateError });

      if (updateError) throw updateError;

      if (!updateData || updateData.length === 0) {
        console.warn('⚠️ Order update returned no data');
      } else {
        console.log('✅ Order updated:', updateData[0]);
      }

      console.log('✅ Invoice created successfully');
      showSuccess(`Bill ${generatedBillNumber} generated successfully`);
      setIsBillGenerateDialogOpen(false);
      setSelectedCompanyId('');
      setSelectedFinancialYearId('');
      setNextBillNumber('');
      setBillSeriesId('');
      setSelectedOrderForBill(null);
      
      // Refresh data after a brief delay to ensure DB is updated
      setTimeout(() => {
        fetchOrders();
        fetchDashboardMetrics();
        fetchInvoiceStats();
      }, 500);
    } catch (err) {
      console.error('Error generating bill:', err);
      showError('Failed to generate bill');
    } finally {
      setIsGeneratingBill(false);
    }
  };

  const handleOpenBillDialog = (order: OrderWithDetails) => {
    setSelectedOrderForBill(order);
    setSelectedCompanyId('');
    setSelectedFinancialYearId('');
    setNextBillNumber('');
    setBillSeriesId('');
    setIsBillGenerateDialogOpen(true);
  };

  const handleRefresh = () => {
    fetchOrders();
    fetchDashboardMetrics();
  };

  const handlePreviewBill = (invoice: any) => {
    setSelectedInvoiceForPreview(invoice);
    setIsPreviewDialogOpen(true);
  };

  const handlePrintBill = (invoice: any) => {
    console.log('🖨️ Print button clicked for invoice:', invoice);
    console.log('   ├─ invoice.id:', invoice.id);
    console.log('   ├─ invoice.order_id:', invoice.order_id);
    console.log('   ├─ invoice.bill_number:', invoice.bill_number);
    console.log('   └─ invoice.source_table:', invoice.source_table);
    
    if (!invoice.id) {
      console.error('❌ Invoice has no id:', invoice);
      showError('Cannot print bill: invoice ID missing');
      return;
    }
    // Use bill ID (invoice.id), not order_id - the bill is what we're printing
    console.log('✅ Using bill ID:', invoice.id);
    setSelectedOrderForPrint({ id: invoice.id, sourceTable: invoice.source_table });
    setIsPrintDialogOpen(true);
  };

  // Hold Order
  const handleHoldOrder = (order: OrderWithDetails) => {
    setSelectedOrderForHold(order);
    setHoldReason('');
    setIsHoldDialogOpen(true);
  };

  // Confirm Hold Order
  const confirmHoldOrder = async () => {
    if (selectedOrderForHold) {
      if (!holdReason.trim()) {
        showError('Please provide a reason for holding the order');
        return;
      }
      try {
        // Update database with hold status
        const { error } = await supabase
          .from('orders')
          .update({ hold_status: 'active', hold_reason: holdReason })
          .eq('id', selectedOrderForHold.id);

        if (error) {
          if (error.message.includes('column') && error.message.includes('hold_status')) {
            showError('Hold feature is not yet enabled. Please apply the database migration.');
            console.warn('Hold status columns not found. Migration needed.');
            return;
          }
          throw error;
        }

        // Move order from filteredOrders to heldOrders
        setHeldOrders([...heldOrders, selectedOrderForHold]);
        setHoldReasons(new Map(holdReasons).set(selectedOrderForHold.id, holdReason));
        setOrders(orders.filter(o => o.id !== selectedOrderForHold.id));
        applyFilters(orders.filter(o => o.id !== selectedOrderForHold.id), selectedDealer, searchOrder);
        showSuccess(`Order #${selectedOrderForHold.order_number} has been held`);
        setIsHoldDialogOpen(false);
        setSelectedOrderForHold(null);
        setHoldReason('');
      } catch (err) {
        console.error('Error holding order:', err);
        showError('Failed to hold order. Please contact support.');
      }
    }
  };

  // Delete Order (only if no bill_no)
  const handleDeleteOrder = async (order: OrderWithDetails) => {
    // Check if order has a bill number
    if (order.bill_no) {
      showError('Cannot delete order that already has a bill number');
      return;
    }

    // Confirm deletion
    if (!window.confirm(`Are you sure you want to delete Order #${order.order_number}? This action cannot be undone.`)) {
      return;
    }

    try {
      // Delete order and associated sales items
      const { error: deleteError } = await supabase
        .from('orders')
        .delete()
        .eq('id', order.id);

      if (deleteError) throw deleteError;

      // Remove from orders list
      setOrders(orders.filter(o => o.id !== order.id));
      applyFilters(orders.filter(o => o.id !== order.id), selectedDealer, searchOrder);
      showSuccess(`Order #${order.order_number} has been deleted`);
    } catch (err) {
      console.error('Error deleting order:', err);
      showError('Failed to delete order. Please contact support.');
    }
  };

  // Release Order
  const handleReleaseOrder = async (order: OrderWithDetails) => {
    try {
      // Update database to release hold
      const { error } = await supabase
        .from('orders')
        .update({ hold_status: 'released', hold_reason: null })
        .eq('id', order.id);

      if (error) {
        if (error.message.includes('column') && error.message.includes('hold_status')) {
          showError('Hold feature is not yet enabled. Please apply the database migration.');
          console.warn('Hold status columns not found. Migration needed.');
          return;
        }
        throw error;
      }

      // Move order from heldOrders back to filteredOrders
      setHeldOrders(heldOrders.filter(o => o.id !== order.id));
      const newReasons = new Map(holdReasons);
      newReasons.delete(order.id);
      setHoldReasons(newReasons);
      setOrders([...orders, order]);
      applyFilters([...orders, order], selectedDealer, searchOrder);
      showSuccess(`Order #${order.order_number} has been released`);
    } catch (err) {
      console.error('Error releasing order:', err);
      showError('Failed to release order. Please contact support.');
    }
  };

  // Preview Held Order
  const handlePreviewHeldOrder = (order: OrderWithDetails) => {
    setSelectedOrderForEdit(order.id);
    setIsEditingFromHeldOrders(true);
    setIsEditDialogOpen(true);
  };

  // Cancel Bill
  const handleCancelBill = (invoice: any) => {
    setSelectedBillForCancel(invoice);
    setCancelBillReason('');
    setIsCancelBillDialogOpen(true);
  };

  // Confirm Cancel Bill
  const confirmCancelBill = async () => {
    if (selectedBillForCancel) {
      if (!cancelBillReason.trim()) {
        showError('Please provide a reason for cancelling the bill');
        return;
      }
      try {
        // Try updating in spartan table first
        let { error } = await supabase
          .from('spartan')
          .update({ 
            status: 'cancelled', 
            cancellation_reason: cancelBillReason 
          })
          .eq('id', selectedBillForCancel.id);

        // If not found in spartan, try fightor
        if (error && error.message.includes('No rows')) {
          ({ error } = await supabase
            .from('fightor')
            .update({ 
              status: 'cancelled', 
              cancellation_reason: cancelBillReason 
            })
            .eq('id', selectedBillForCancel.id));
        }

        if (error) throw error;

        showSuccess(`Bill ${selectedBillForCancel.bill_number} has been cancelled`);
        setIsCancelBillDialogOpen(false);
        setSelectedBillForCancel(null);
        setCancelBillReason('');
        
        // Refresh the invoice stats to show updated data
        fetchInvoiceStats();
      } catch (err) {
        console.error('Error cancelling bill:', err);
        showError('Failed to cancel bill');
      }
    }
  };

  // Restore Cancelled Bill
  const handleRestoreBill = async (bill: any) => {
    try {
      // Determine which table to use
      const tableName = bill.company_id === '8d4f9e5c-8f83-4a79-8229-3a563aa4ed56'
        ? 'spartan'
        : bill.company_id === 'e14cf6e2-a3c8-48f1-a418-1acb0983c070'
          ? 'fightor'
          : null;

      if (!tableName) {
        showError('Unknown company');
        return;
      }

      // Query bill_series to get next sequence number
      console.log('🔔 Fetching bill series for bill number generation...');
      const { data: billSeriesData, error: seriesError } = await supabase
        .from('bill_series')
        .select('current_sequence_number, series_prefix, series_separator')
        .eq('company_id', bill.company_id)
        .eq('is_active', true)
        .maybeSingle();

      if (seriesError || !billSeriesData) {
        console.error('Error fetching bill series:', seriesError);
        showError('Unable to generate new bill number - bill series not found');
        return;
      }

      // Construct new bill number from bill_series
      const nextSeq = billSeriesData.current_sequence_number;
      const newBillNumber = billSeriesData.series_prefix + 
        (billSeriesData.series_separator || '') + 
        nextSeq;
      console.log('📄 New Bill Number:', newBillNumber);

      // Try updating in the correct table
      let { error, data: updateData } = await supabase
        .from(tableName)
        .update({ 
          status: 'pending',
          cancellation_reason: null,
          rejection_reason: null,
          bill_number: newBillNumber
        })
        .eq('id', bill.id)
        .select();

      // If not found, try the other table
      if (error || !updateData || updateData.length === 0) {
        const otherTable = tableName === 'spartan' ? 'fightor' : 'spartan';
        console.log(`Bill not found in ${tableName}, trying ${otherTable}...`);
        
        ({ error, data: updateData } = await supabase
          .from(otherTable)
          .update({ 
            status: 'pending',
            cancellation_reason: null,
            rejection_reason: null,
            bill_number: newBillNumber
          })
          .eq('id', bill.id)
          .select());
      }

      if (error) throw error;

      showSuccess(`Bill ${bill.bill_number} has been restored with new bill number ${newBillNumber}`);
      
      // Refresh the invoice stats to show updated data
      fetchInvoiceStats();
    } catch (err) {
      console.error('Error restoring bill:', err);
      showError('Failed to restore bill');
    }
  };

  // Save Bill Generation Settings
  const handleSaveBillSettings = async () => {
    if (!billSeriesId) return;
    
    try {
      const { error } = await supabase
        .from('bill_series')
        .update({
          series_prefix: editableBillSettings.series_prefix,
          series_separator: editableBillSettings.series_separator,
          current_sequence_number: editableBillSettings.current_sequence_number
        })
        .eq('id', billSeriesId);

      if (error) throw error;

      setBillSeriesDetails(editableBillSettings);
      const separator = editableBillSettings.series_separator || '';
      const billNo = `${editableBillSettings.series_prefix}${separator}${editableBillSettings.current_sequence_number}`;
      setNextBillNumber(billNo);
      
      showSuccess('Bill generation settings updated successfully');
      setIsBillSettingsDialogOpen(false);
    } catch (err) {
      console.error('Error saving bill settings:', err);
      showError('Failed to save bill settings');
    }
  };

  // Edit Cancelled Bill
  const handleEditCancelledBill = (bill: any) => {
    if (bill.order_id) {
      setSelectedCancelledBillInfo(bill); // Store bill info for display
      setSelectedOrderForEdit(bill.order_id);
      setIsEditingFromCancelledBills(true);
      setIsEditDialogOpen(true);
    }
  };

  // Check if order can generate bill (first-come-first-serve logic)
  const canGenerateBill = (order: OrderWithDetails): { allowed: boolean; message?: string } => {
    // CONDITION 1: If order is URGENT, bypass all FIFO checks
    if (order.is_urgent) {
      return { allowed: true };
    }

    // CONDITION 2: For NON-URGENT orders, enforce FIFO (First Come First Go)
    // Get all non-urgent orders sorted by date (oldest first)
    const nonUrgentOrders = filteredOrders
      .filter(o => !o.is_urgent)
      .sort((a, b) => new Date(a.order_date).getTime() - new Date(b.order_date).getTime());
    
    const orderIndex = nonUrgentOrders.findIndex(o => o.id === order.id);

    // Check if this is the first non-urgent order
    if (orderIndex === 0) {
      return { allowed: true };
    }

    // Check if any previous non-urgent order is on hold
    const hasPreviousOnHold = heldOrders.some((heldOrder) => {
      const heldIndex = nonUrgentOrders.findIndex(o => o.id === heldOrder.id);
      return heldIndex >= 0 && heldIndex < orderIndex;
    });

    if (hasPreviousOnHold) {
      return { 
        allowed: false, 
        message: 'Previous order is on hold. Release it first.' 
      };
    }

    // Check if any previous non-urgent order has not been billed yet (FIFO check)
    const hasPreviousUnbilled = nonUrgentOrders
      .slice(0, orderIndex)
      .some(o => !o.bill_no);

    if (hasPreviousUnbilled) {
      return { 
        allowed: false, 
        message: 'Previous order is not fulfilled. Generate bill for that first.' 
      };
    }

    return { allowed: true };
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        showError(`Logout failed: ${error.message}`);
        return;
      }
      showSuccess('Logged out successfully');
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
      showError('Failed to logout');
    } finally {
      setLoading(false);
    }
  };

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 text-white">
        <div className="w-full px-6 py-3 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-1">Billing Dashboard</h1>
              <p className="text-sm text-blue-100">Create, manage, and track invoices efficiently</p>
            </div>
          <div className="flex items-center gap-2">
            <Button 
              onClick={() => {
                setLastSyncTime(new Date());
                fetchOrders();
                fetchInvoiceStats();
                fetchDashboardMetrics();
                fetchHeldOrders();
              }}
              className="bg-blue-500 hover:bg-blue-600 text-white text-xs"
              size="sm"
              title="Manual refresh all data"
            >
              🔄 Sync Now
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-blue-500 hover:text-white"
                >
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  onClick={() => setIsCreditNoteDialogOpen(true)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create Credit Note</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setIsCreditNotesReportOpen(true)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <FileText className="h-4 w-4" />
                  <span>Credit Notes Report</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setIsDealerLedgerReportOpen(true)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <FileText className="h-4 w-4" />
                  <span>Dealer Ledger Report</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setIsImportBillsDialogOpen(true)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  <span>Import Bills</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setIsEwayBillDialogOpen(true)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Truck className="h-4 w-4" />
                  <span>E-way Bill Manager</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="flex items-center gap-2 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          </div>
        </div>
      </div>

      <div className="w-full px-6 py-8 lg:px-8">

        {/* Orders Awaiting Billing - Card Grid Layout */}
        <div className="mb-8">

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="animate-spin h-12 w-12 text-indigo-600" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-dashed border-2 border-indigo-300">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <FileText className="h-24 w-24 text-indigo-200 mb-4" />
                <p className="text-xl font-semibold text-gray-700 mb-2">No Pending Orders</p>
                <p className="text-gray-500">All orders have been processed!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {/* Summary Stats */}
              {(() => {
                const ordersWithoutBills = filteredOrders.filter((o) => !o.bill_no);
                return (
                  <>
                    <Card className="bg-gradient-to-br from-blue-100 to-blue-50 border-l-4 border-blue-600">
                      <CardContent className="pt-6">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Total Orders</p>
                          <p className="text-3xl font-bold text-blue-600 mt-2">{ordersWithoutBills.length}</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-green-100 to-green-50 border-l-4 border-green-600">
                      <CardContent className="pt-6">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Total Value</p>
                          <p className="text-3xl font-bold text-green-600 mt-2">₹{(ordersWithoutBills.reduce((sum, o) => sum + o.total_amount, 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-purple-100 to-purple-50 border-l-4 border-purple-600">
                      <CardContent className="pt-6">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Avg Order Value</p>
                          <p className="text-3xl font-bold text-purple-600 mt-2">₹{(ordersWithoutBills.length > 0 ? (ordersWithoutBills.reduce((sum, o) => sum + o.total_amount, 0) / ordersWithoutBills.length) : 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-orange-100 to-orange-50 border-l-4 border-orange-600">
                      <CardContent className="pt-6">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Total Items</p>
                          <p className="text-3xl font-bold text-orange-600 mt-2">{ordersWithoutBills.reduce((sum, o) => sum + o.items_count, 0)}</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-slate-100 to-slate-50 border-l-4 border-slate-600 col-span-1 md:col-span-4">
                      <CardContent className="pt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-gray-600">E-way Bill Manager</p>
                          <p className="text-lg font-semibold text-slate-800 mt-1">Save API keys and upload GST e-way bills</p>
                        </div>
                        <Button
                          onClick={() => setIsEwayBillDialogOpen(true)}
                          className="bg-slate-600 hover:bg-slate-700 text-white text-xs"
                        >
                          Open E-way Bill Manager
                        </Button>
                      </CardContent>
                    </Card>
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {/* Two Column Layout - Orders & Bills */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Left Column - Order Details & Hold Orders */}
          <div className="flex flex-col space-y-6">
            <div className="flex flex-col">
              <div className="flex flex-col border border-gray-200 rounded-lg bg-white min-h-80 h-80">
              {/* Title Row */}
              <div className="bg-blue-50 p-3 border-b sticky top-0">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-bold flex items-center gap-2 text-blue-700">
                    <FileText className="h-5 w-5" />
                    Orders Awaiting Billing ({filteredOrders.filter((o) => !o.bill_no).length})
                  </h3>
                  <div className="text-xs text-gray-500 flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full inline-block"></span>
                    {lastSyncTime ? (
                      <span>Updated: {lastSyncTime.toLocaleTimeString()}</span>
                    ) : (
                      <span>Syncing...</span>
                    )}
                  </div>
                </div>
                <Input
                  placeholder="Search by Order #, Bill #, or Dealer name..."
                  value={searchOrder}
                  onChange={(e) => setSearchOrder(e.target.value)}
                  className="mt-2 h-8 text-xs"
                />
              </div>
              {/* Header Row */}
              <div className="bg-gray-100 p-3 grid grid-cols-12 gap-2 font-semibold text-xs text-gray-700 border-b sticky top-12">
                <div className="col-span-2">Order #</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-3">Dealer</div>
                <div className="col-span-1 text-center">Days</div>
                <div className="col-span-2">Amount</div>
                <div className="col-span-2">Actions</div>
              </div>

              {/* Orders List */}
              <div className="space-y-0 overflow-y-auto flex-1 divide-y">
                {filteredOrders.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">No pending orders</div>
                ) : (
                  filteredOrders
                    .filter((order) => !order.bill_no) // Hide orders that have bills
                    .sort((a, b) => {
                      // Prioritize urgent orders first
                      if (a.is_urgent && !b.is_urgent) return -1;
                      if (!a.is_urgent && b.is_urgent) return 1;
                      // Then sort by date (oldest first)
                      return new Date(a.order_date).getTime() - new Date(b.order_date).getTime();
                    })
                    .map((order, index) => {
                      const daysAgo = Math.floor(
                        (new Date().getTime() - new Date(order.order_date).getTime()) / (1000 * 60 * 60 * 24)
                      );
                      const billStatus = canGenerateBill(order);
                      const isActive = billStatus.allowed;
                      return (
                        <div key={order.id} className={`p-3 transition-colors grid grid-cols-12 gap-2 items-center ${isActive ? 'bg-green-50 hover:bg-green-100' : 'bg-red-50 hover:bg-red-100'}`}>
                          {/* Order # */}
                          <div className="col-span-2">
                            <p className="text-sm font-bold text-blue-600"># {order.order_number}</p>
                          </div>

                          {/* Status Badge */}
                          <div className="col-span-2">
                            {isActive ? (
                              <span className="px-2 py-1 bg-green-500 text-white rounded text-xs font-bold text-center inline-block w-full">Active</span>
                            ) : (
                              <span className="px-2 py-1 bg-red-500 text-white rounded text-xs font-bold text-center inline-block w-full">Inactive</span>
                            )}
                          </div>

                          {/* Dealer */}
                          <div className="col-span-3 min-w-0">
                            <p className="text-xs text-gray-600 truncate" title={order.dealer_name}>{order.dealer_name}</p>
                          </div>

                          {/* Days */}
                          <div className="col-span-1 text-center">
                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs font-semibold inline-block">
                              {daysAgo}d
                            </span>
                          </div>

                          {/* Amount */}
                          <div className="col-span-2 text-right">
                            <p className="text-sm font-bold text-green-600">₹{(order.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                          </div>

                          {/* Action Buttons */}
                          <div className="col-span-2 flex gap-1 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              className="px-1.5 py-1 h-6"
                              onClick={() => {
                                setSelectedOrderForEdit(order.id);
                                setIsEditingFromHeldOrders(false);
                                setIsEditDialogOpen(true);
                              }}
                              title="Edit order"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              className={`px-1.5 py-1 h-6 text-xs font-semibold ${isActive ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-400 text-white cursor-not-allowed'}`}
                              onClick={() => {
                                if (isActive) handleOpenBillDialog(order);
                                else showError(billStatus.message || 'Cannot generate bill for this order');
                              }}
                              title={isActive ? "Generate bill for this order" : billStatus.message}
                              disabled={!isActive}
                            >
                              {isActive ? '📄 Bill' : 'Blocked'}
                            </Button>
                            <Button
                              size="sm"
                              className="bg-orange-600 hover:bg-orange-700 text-white px-1.5 py-1 h-6 text-xs"
                              onClick={() => handleHoldOrder(order)}
                              title="Hold order"
                            >
                              Hold
                            </Button>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
            </div>

            {/* Hold Orders Section - Below Order Details */}
            <div className="flex flex-col">
              <div className="flex flex-col border border-gray-200 rounded-lg bg-white min-h-64 h-64">
                {/* Title Row */}
                <div className="bg-orange-50 p-3 border-b sticky top-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-orange-700">
                      <Filter className="h-5 w-5" />
                      Hold Orders ({heldOrders.length})
                    </h3>
                    <div className="text-xs text-gray-500 flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full inline-block"></span>
                      {lastSyncTime ? (
                        <span>Updated: {lastSyncTime.toLocaleTimeString()}</span>
                      ) : (
                        <span>Syncing...</span>
                      )}
                    </div>
                  </div>
                  <Input
                    placeholder="Search by Order # or Dealer name..."
                    value={searchHoldOrder}
                    onChange={(e) => setSearchHoldOrder(e.target.value)}
                    className="mt-2 h-8 text-xs"
                  />
                </div>
                {/* Header Row */}
                <div className="bg-orange-100 p-3 grid grid-cols-12 gap-2 font-semibold text-xs text-gray-700 border-b sticky top-12">
                  <div className="col-span-2">Order #</div>
                  <div className="col-span-4">Dealer</div>
                  <div className="col-span-4">Reason</div>
                  <div className="col-span-1">Days</div>
                  <div className="col-span-1">Act</div>
                </div>

                {/* Held Orders List */}
                <div className="space-y-0 overflow-y-auto flex-1 divide-y">
                  {heldOrders.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">No held orders</div>
                  ) : (
                    heldOrders
                      .filter((order) => {
                        if (!searchHoldOrder.trim()) return true;
                        const search = searchHoldOrder.toLowerCase();
                        return (
                          order.order_number?.toLowerCase().includes(search) ||
                          order.dealer_name?.toLowerCase().includes(search)
                        );
                      })
                      .sort((a, b) => {
                        // Prioritize urgent orders first
                        if (a.is_urgent && !b.is_urgent) return -1;
                        if (!a.is_urgent && b.is_urgent) return 1;
                        // Then sort by date (oldest first)
                        return new Date(a.order_date).getTime() - new Date(b.order_date).getTime();
                      })
                      .map((order) => {
                        const daysAgo = Math.floor(
                          (new Date().getTime() - new Date(order.order_date).getTime()) / (1000 * 60 * 60 * 24)
                        );
                        const reason = holdReasons.get(order.id) || 'N/A';
                        return (
                          <div key={order.id} className="p-3 hover:bg-orange-50 transition-colors grid grid-cols-12 gap-2 items-center text-xs">
                            {/* Order # */}
                            <div className="col-span-2">
                              <p className="font-bold text-orange-600"># {order.order_number}</p>
                            </div>

                            {/* Dealer - Full name */}
                            <div className="col-span-4">
                              <p className="text-gray-700 font-medium break-words">{order.dealer_name}</p>
                            </div>

                            {/* Reason - Full text */}
                            <div className="col-span-4">
                              <p className="text-gray-600 break-words">{reason}</p>
                            </div>

                            {/* Days */}
                            <div className="col-span-1 text-center">
                              <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs font-semibold inline-block">
                                {daysAgo}d
                              </span>
                            </div>

                            {/* Action Buttons */}
                            <div className="col-span-1 flex gap-0.5 justify-center">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="px-1 py-0.5 h-5 w-5"
                                onClick={() => handlePreviewHeldOrder(order)}
                                title="View Details"
                              >
                                <Eye className="h-3 w-3 text-blue-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="px-1 py-0.5 h-5 w-5 text-green-600 hover:text-green-700"
                                onClick={() => handleReleaseOrder(order)}
                                title="Release order"
                              >
                                ↩
                              </Button>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col space-y-6">
            {/* Pending Bills Section */}
            <div className="flex flex-col">
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col min-h-96 h-96">
                {/* Title Row */}
                <div className="bg-yellow-50 p-3 border-b sticky top-0">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-yellow-700 whitespace-nowrap">
                      <AlertCircle className="h-5 w-5" />
                      Pending Bills - Awaiting Approval ({invoiceStats.recent_invoices.length})
                    </h3>
                    <Input
                      placeholder="Search by Bill #, Dealer name, or Order #..."
                      value={searchBill}
                      onChange={(e) => setSearchBill(e.target.value)}
                      className="h-8 text-xs flex-1"
                    />
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-gray-500 flex items-center gap-2 whitespace-nowrap">
                        <span className="w-2 h-2 bg-green-500 rounded-full inline-block"></span>
                        {lastSyncTime ? (
                          <span>Updated: {lastSyncTime.toLocaleTimeString()}</span>
                        ) : (
                          <span>Syncing...</span>
                        )}
                      </div>
                      <Button onClick={fetchInvoiceStats} size="sm" className="bg-yellow-600 hover:bg-yellow-700 text-white text-xs py-1 whitespace-nowrap">
                        <Filter className="h-3 w-3 mr-1" />
                        Refresh
                      </Button>
                    </div>
                  </div>
                </div>
                {isReportLoading ? (
                  <div className="flex justify-center items-center h-full">
                    <Loader2 className="animate-spin h-8 w-8 text-indigo-600" />
                  </div>
                ) : invoiceStats.recent_invoices.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500 p-6">
                    <FileText className="h-12 w-12 text-gray-300 mb-2" />
                    <p className="text-sm">No bills created yet</p>
                  </div>
                ) : (
                  <>
                    {/* Header Row */}
                    <div className="bg-gray-100 p-3 grid grid-cols-12 gap-2 font-semibold text-xs text-gray-700 border-b sticky top-12">
                      <div className="col-span-2">Bill #</div>
                      <div className="col-span-2">Company</div>
                      <div className="col-span-1.5">Verification</div>
                      <div className="col-span-2.5">Dealer</div>
                      <div className="col-span-1 text-center">Date</div>
                      <div className="col-span-2 text-right">Amount</div>
                    </div>

                    {/* Bills List */}
                    <div className="overflow-y-auto flex-1">
                      <div className="space-y-0 divide-y">
                        {invoiceStats.recent_invoices
                          .filter((invoice) => {
                            if (!searchBill.trim()) return true;
                            const search = searchBill.toLowerCase();
                            return (
                              invoice.bill_number?.toLowerCase().includes(search) ||
                              invoice.dealer_name?.toLowerCase().includes(search) ||
                              invoice.order_number?.toLowerCase().includes(search)
                            );
                          })
                          .map((invoice) => {
                            const verificationStatus = billVerificationStatus.get(invoice.id) || 'pending';
                            return (
                            <div key={invoice.id} className="p-3 hover:bg-indigo-50 transition-colors grid grid-cols-12 gap-2 items-center text-xs">
                              {/* Bill # */}
                              <div className="col-span-2">
                                <p className="font-mono font-bold text-indigo-600"># {invoice.bill_number}</p>
                              </div>

                              {/* Company */}
                              <div className="col-span-2 min-w-0">
                                <p className="text-gray-700 truncate font-medium text-xs">{invoice.companies?.name || 'N/A'}</p>
                              </div>

                              {/* Verification Status */}
                              <div className="col-span-1.5">
                                <span
                                  className={`px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap inline-block ${
                                    verificationStatus === 'verified'
                                      ? 'bg-green-100 text-green-800'
                                      : verificationStatus === 'rejected'
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-yellow-100 text-yellow-800'
                                  }`}
                                >
                                  {verificationStatus === 'verified' ? 'Verified' : verificationStatus === 'rejected' ? 'Rejected' : 'Pending'}
                                </span>
                              </div>

                              {/* Dealer */}
                              <div className="col-span-2.5 min-w-0">
                                <p className="text-gray-600 truncate text-xs">{invoice.dealers?.name || 'N/A'}</p>
                              </div>

                              {/* Date */}
                              <div className="col-span-1 text-center">
                                <p className="text-gray-500 text-xs">{format(new Date(invoice.bill_date), 'MMM dd')}</p>
                              </div>

                              {/* Amount */}
                              <div className="col-span-2 text-right">
                                <p className="font-bold text-green-600">₹{(invoice.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                              </div>

                              {/* Actions - Hidden */}
                              <div className="col-span-1 flex gap-1 justify-center">
                                {/* Action icons hidden */}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Approved Bills Section */}
            <div className="flex flex-col">
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col min-h-96 h-96">
                {/* Title Row */}
                <div className="bg-green-50 p-3 border-b sticky top-0">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-green-700 whitespace-nowrap">
                      <Check className="h-5 w-5" />
                      Approved Bills ({approvedInvoices.length})
                    </h3>
                    <Input
                      placeholder="Search by Bill #, Dealer name, or Order #..."
                      value={searchApprovedBill}
                      onChange={(e) => setSearchApprovedBill(e.target.value)}
                      className="h-8 text-xs flex-1"
                    />
                    <div className="text-xs text-gray-500 flex items-center gap-2 whitespace-nowrap">
                      <span className="w-2 h-2 bg-green-500 rounded-full inline-block"></span>
                      {lastSyncTime ? (
                        <span>Updated: {lastSyncTime.toLocaleTimeString()}</span>
                      ) : (
                        <span>Syncing...</span>
                      )}
                    </div>
                  </div>
                </div>
                {approvedInvoices.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500 p-6">
                    <Check className="h-12 w-12 text-gray-300 mb-2" />
                    <p className="text-sm">No approved bills</p>
                  </div>
                ) : (
                  <>
                    {/* Header Row */}
                    <div className="bg-green-50 p-3 grid grid-cols-12 gap-2 font-semibold text-xs text-gray-700 border-b sticky top-12">
                      <div className="col-span-2">Bill #</div>
                      <div className="col-span-2">Company</div>
                      <div className="col-span-2.5">Dealer</div>
                      <div className="col-span-1 text-center">Date</div>
                      <div className="col-span-2 text-right">Amount</div>
                      <div className="col-span-2 text-center">Actions</div>
                    </div>

                    {/* Approved Bills List */}
                    <div className="overflow-y-auto flex-1 divide-y">
                      <div className="space-y-0 divide-y">
                        {approvedInvoices
                          .filter((invoice) => {
                            if (!searchApprovedBill.trim()) return true;
                            const search = searchApprovedBill.toLowerCase();
                            return (
                              invoice.bill_number?.toLowerCase().includes(search) ||
                              invoice.dealers?.name?.toLowerCase().includes(search) ||
                              invoice.order_number?.toLowerCase().includes(search)
                            );
                          })
                          .map((invoice) => (
                          <div key={invoice.id} className="p-3 hover:bg-green-50 transition-colors grid grid-cols-12 gap-2 items-center text-xs">
                            {/* Bill # */}
                            <div className="col-span-2">
                              <p className="font-mono font-bold text-green-600"># {invoice.bill_number}</p>
                            </div>

                            {/* Company */}
                            <div className="col-span-2 min-w-0">
                              <p className="text-gray-700 truncate font-medium text-xs">{invoice.companies?.name || 'N/A'}</p>
                            </div>

                            {/* Dealer */}
                            <div className="col-span-2.5 min-w-0">
                              <p className="text-gray-600 truncate text-xs">{invoice.dealers?.name || 'N/A'}</p>
                            </div>

                            {/* Date */}
                            <div className="col-span-1 text-center">
                              <p className="text-gray-500 text-xs">{format(new Date(invoice.bill_date), 'MMM dd')}</p>
                            </div>

                            {/* Amount */}
                            <div className="col-span-2 text-right">
                              <p className="font-bold text-green-600">₹{(invoice.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </div>

                            {/* Actions */}
                            <div className="col-span-2 flex gap-1 justify-center">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="px-1.5 py-1 h-6"
                                onClick={() => handlePreviewBill(invoice)}
                                title="View Details"
                              >
                                <Eye className="h-3 w-3 text-blue-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="px-1.5 py-1 h-6"
                                onClick={() => handlePrintBill(invoice)}
                                title="Print/Reprint"
                              >
                                <Printer className="h-3 w-3 text-green-600" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Cancelled Bills Section */}
            <div className="flex flex-col">
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col min-h-96 h-96">
                {/* Title Row */}
                <div className="bg-red-50 p-3 border-b sticky top-0">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-red-700 whitespace-nowrap">
                      <X className="h-5 w-5" />
                      Cancelled Bills ({cancelledBills.length})
                    </h3>
                    <Input
                      placeholder="Search by Bill #, Dealer name, or Order #..."
                      value={searchCancelledBill}
                      onChange={(e) => setSearchCancelledBill(e.target.value)}
                      className="h-8 text-xs flex-1"
                    />
                    <div className="text-xs text-gray-500 flex items-center gap-2 whitespace-nowrap">
                      <span className="w-2 h-2 bg-green-500 rounded-full inline-block"></span>
                      {lastSyncTime ? (
                        <span>Updated: {lastSyncTime.toLocaleTimeString()}</span>
                      ) : (
                        <span>Syncing...</span>
                      )}
                    </div>
                  </div>
                </div>
                {cancelledBills.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500 p-6">
                    <X className="h-12 w-12 text-gray-300 mb-2" />
                    <p className="text-sm">No cancelled bills</p>
                  </div>
                ) : (
                  <>
                    {/* Header Row */}
                    <div className="bg-red-50 p-3 grid grid-cols-12 gap-2 font-semibold text-xs text-gray-700 border-b sticky top-12">
                      <div className="col-span-2">Bill #</div>
                      <div className="col-span-2">Company</div>
                      <div className="col-span-1.5">Dealer</div>
                      <div className="col-span-3">Reason</div>
                      <div className="col-span-1">Amount</div>
                      <div className="col-span-1 text-center">Date</div>
                      <div className="col-span-1 text-center">Act</div>
                    </div>

                    {/* Cancelled Bills List */}
                    <div className="overflow-y-auto flex-1 divide-y">
                      <div className="space-y-0 divide-y">
                        {cancelledBills
                          .filter((bill) => {
                            if (!searchCancelledBill.trim()) return true;
                            const search = searchCancelledBill.toLowerCase();
                            return (
                              bill.bill_number?.toLowerCase().includes(search) ||
                              bill.dealers?.name?.toLowerCase().includes(search) ||
                              bill.order_number?.toLowerCase().includes(search)
                            );
                          })
                          .sort((a, b) => new Date(b.cancelled_at || new Date()).getTime() - new Date(a.cancelled_at || new Date()).getTime())
                          .map((bill) => (
                            <div key={bill.id} className="p-3 hover:bg-red-50 transition-colors grid grid-cols-12 gap-2 items-center text-xs">
                              {/* Bill # */}
                              <div className="col-span-2">
                                <p className="font-bold text-red-600"># {bill.bill_number}</p>
                              </div>

                              {/* Company Name */}
                              <div className="col-span-2">
                                {(() => {
                                  const expectedCompanyId = bill.source_table === 'spartan' 
                                    ? '8d4f9e5c-8f83-4a79-8229-3a563aa4ed56'
                                    : 'e14cf6e2-a3c8-48f1-a418-1acb0983c070';
                                  const companyChanged = bill.company_id !== expectedCompanyId;
                                  return (
                                    <div className="flex items-center gap-1">
                                      <p className="text-gray-700 font-medium text-xs">{bill.companies?.name || 'N/A'}</p>
                                      {companyChanged && (
                                        <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs rounded font-semibold">Changed</span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>

                              {/* Dealer */}
                              <div className="col-span-1.5">
                                <p className="text-gray-700 font-medium break-words text-xs">{bill.dealers?.name || 'N/A'}</p>
                              </div>

                              {/* Reason */}
                              <div className="col-span-3">
                                <p className="text-gray-600 break-words text-xs">
                                  {bill.status === 'reject' 
                                    ? bill.rejection_reason || 'N/A'
                                    : bill.cancellation_reason || 'N/A'
                                  }
                                </p>
                              </div>

                              {/* Amount */}
                              <div className="col-span-1">
                                <p className="font-bold text-red-600 text-xs">₹{(bill.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                              </div>

                              {/* Date */}
                              <div className="col-span-1 text-center">
                                <p className="text-xs text-gray-500">
                                  {bill.bill_date ? format(new Date(bill.bill_date), 'MMM d') : 'N/A'}
                                </p>
                              </div>

                              {/* Actions */}
                              <div className="col-span-1 flex gap-1 justify-center">
                                {(() => {
                                  const reason = bill.status === 'reject' 
                                    ? bill.rejection_reason 
                                    : bill.cancellation_reason;
                                  const hasNewBillNumberReason = reason?.includes('New bill number for reference');
                                  
                                  if (hasNewBillNumberReason) {
                                    return (
                                      <div className="text-xs text-gray-500 font-semibold" title="Cannot edit - new bill number issued">
                                        View Only
                                      </div>
                                    );
                                  }
                                  
                                  return (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="px-1.5 py-1 h-6"
                                      onClick={() => handleEditCancelledBill(bill)}
                                      title="Edit and re-send for approval"
                                    >
                                      <Edit className="h-3.5 w-3.5 text-orange-600" />
                                    </Button>
                                  );
                                })()}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Order Dialog */}
      {selectedOrderForEdit && (() => {
        const editingOrder = filteredOrders.find(o => o.id === selectedOrderForEdit);
        const editBillStatus = editingOrder ? canGenerateBill(editingOrder) : undefined;
        return (
          <EditOrderDialog
            isOpen={isEditDialogOpen}
            isBillingDashboard={true}
            fullScreen={!isEditingFromHeldOrders && !isEditingFromCancelledBills}
            onOpenChange={(open) => {
              setIsEditDialogOpen(open);
              if (!open) {
                setIsEditingFromHeldOrders(false);
                setIsEditingFromCancelledBills(false);
                setSelectedCancelledBillInfo(null);
              }
            }}
            orderId={selectedOrderForEdit}
            cancelledBillInfo={selectedCancelledBillInfo}
            originalCompanyId={selectedCancelledBillInfo?.companies?.id}
            originalBillNumber={selectedCancelledBillInfo?.bill_number}
            cancelledInvoiceId={selectedCancelledBillInfo?.id}
            onOrderUpdated={async () => {
              fetchOrders();
              setSelectedOrderForEdit(null);
              
              // If editing from cancelled bills, reset the bill status to NULL and clear reasons
              if (isEditingFromCancelledBills && selectedCancelledBillInfo) {
                try {
                  // Determine which table to use
                  const tableName = selectedCancelledBillInfo.company_id === '8d4f9e5c-8f83-4a79-8229-3a563aa4ed56'
                    ? 'spartan'
                    : selectedCancelledBillInfo.company_id === 'e14cf6e2-a3c8-48f1-a418-1acb0983c070'
                      ? 'fightor'
                      : null;

                  if (!tableName) {
                    showError('Unknown company');
                    return;
                  }

                  // Query bill_series to get next sequence number
                  console.log('🔔 Fetching bill series for bill number generation...');
                  const { data: billSeriesData, error: seriesError } = await supabase
                    .from('bill_series')
                    .select('current_sequence_number, series_prefix, series_separator')
                    .eq('company_id', selectedCancelledBillInfo.company_id)
                    .eq('is_active', true)
                    .maybeSingle();

                  if (seriesError || !billSeriesData) {
                    console.error('Error fetching bill series:', seriesError);
                    showError('Unable to generate new bill number - bill series not found');
                    return;
                  }

                  // Construct new bill number from bill_series
                  const nextSeq = billSeriesData.current_sequence_number;
                  const newBillNumber = billSeriesData.series_prefix + 
                    (billSeriesData.series_separator || '') + 
                    nextSeq;
                  console.log('📄 New Bill Number:', newBillNumber);

                  // Try updating in the correct table
                  let { error, data: updateData } = await supabase
                    .from(tableName)
                    .update({
                      status: null,
                      cancellation_reason: null,
                      rejection_reason: null,
                      bill_number: newBillNumber
                    })
                    .eq('id', selectedCancelledBillInfo.id)
                    .select();

                  // If not found, try the other table
                  if (error || !updateData || updateData.length === 0) {
                    const otherTable = tableName === 'spartan' ? 'fightor' : 'spartan';
                    console.log(`Bill not found in ${tableName}, trying ${otherTable}...`);
                    
                    ({ error, data: updateData } = await supabase
                      .from(otherTable)
                      .update({
                        status: null,
                        cancellation_reason: null,
                        rejection_reason: null,
                        bill_number: newBillNumber
                      })
                      .eq('id', selectedCancelledBillInfo.id)
                      .select());
                  }
                  
                  if (!error && updateData && updateData.length > 0) {
                    showSuccess(`Bill has been updated with new bill number ${newBillNumber} and is ready for re-generation`);
                    fetchInvoiceStats();
                  } else {
                    console.error('Error updating bill:', error);
                    showError('Failed to update bill');
                  }
                } catch (err) {
                  console.error('Error updating bill status:', err);
                  showError('Error updating bill');
                }
              }
              
              setIsEditingFromHeldOrders(false);
              setIsEditingFromCancelledBills(false);
              setSelectedCancelledBillInfo(null);
            }}
            billStatus={editBillStatus}
            showBillRestrictionWarning={!isEditingFromHeldOrders && !isEditingFromCancelledBills}
          />
        );
      })()}

      {/* Print Bill Dialog */}
      {selectedOrderForPrint && (
        <PrintBillDialog
          isOpen={isPrintDialogOpen}
          onOpenChange={setIsPrintDialogOpen}
          orderId={selectedOrderForPrint}
        />
      )}

      {/* Hold Order Dialog */}
      <Dialog open={isHoldDialogOpen} onOpenChange={setIsHoldDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Hold Order</DialogTitle>
            <DialogDescription>
              Hold Order #{selectedOrderForHold?.order_number} and provide a reason
            </DialogDescription>
          </DialogHeader>

          {selectedOrderForHold && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded">
                <div>
                  <Label className="text-xs text-gray-600">Dealer Name</Label>
                  <p className="font-semibold text-sm mt-1">{selectedOrderForHold.dealer_name}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Order Amount</Label>
                  <p className="font-semibold text-sm mt-1">₹{(selectedOrderForHold.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>

              <div>
                <Label htmlFor="hold-reason">Reason for Hold *</Label>
                <Input
                  id="hold-reason"
                  placeholder="e.g., Pending customer confirmation, Payment issue, Quality check..."
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                  className="mt-2"
                />
              </div>

              <p className="text-sm text-gray-600">
                This order will be moved to Hold Orders and the next order will be available for bill generation on first-come-first-serve basis.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsHoldDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmHoldOrder} className="bg-orange-600 hover:bg-orange-700" disabled={!holdReason.trim()}>
              Hold Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Bill Dialog */}
      <Dialog open={isBillGenerateDialogOpen} onOpenChange={setIsBillGenerateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Bill</DialogTitle>
            <DialogDescription>
              Select company and financial year for Order #{selectedOrderForBill?.order_number}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Dealer Name</Label>
              <p className="text-sm font-semibold">{selectedOrderForBill?.dealer_name}</p>
            </div>

            <div>
              <Label>Order Total</Label>
              <p className="text-sm font-semibold">
                ₹{selectedOrderForBill?.total_amount.toFixed(2)}
              </p>
            </div>

            <div>
              <Label htmlFor="company-select">Company *</Label>
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company: any) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name} ({company.id.slice(0, 8)}) - {company.city}, {company.state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="fy-select">Financial Year *</Label>
              <Select value={selectedFinancialYearId} onValueChange={setSelectedFinancialYearId} disabled={!selectedCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select financial year" />
                </SelectTrigger>
                <SelectContent>
                  {financialYears.map((fy) => (
                    <SelectItem key={fy.id} value={fy.id}>
                      {fy.year_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {nextBillNumber && (
              <div className="bg-blue-50 p-3 rounded border border-blue-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Label>Next Bill Number</Label>
                    <p className="text-lg font-mono font-bold text-blue-700 mt-1">{nextBillNumber}</p>
                    <p className="text-xs text-gray-600 mt-2">
                      Prefix: {billSeriesDetails.series_prefix} | Separator: '{billSeriesDetails.series_separator || 'none'}' | Sequence: {billSeriesDetails.current_sequence_number}
                    </p>
                  </div>
                  <Button 
                    size="sm"
                    variant="outline"
                    onClick={() => setIsBillSettingsDialogOpen(true)}
                    className="ml-3"
                    title="Edit bill generation settings"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBillGenerateDialogOpen(false)} disabled={isGeneratingBill}>
              Cancel
            </Button>
            <Button onClick={handleGenerateBill} disabled={!nextBillNumber || isGeneratingBill}>
              {isGeneratingBill ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Generating...
                </>
              ) : (
                'Generate Bill'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bill Preview Dialog */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invoice Details - {selectedInvoiceForPreview?.bill_number}</DialogTitle>
          </DialogHeader>

          {selectedInvoiceForPreview && (
            <div className="space-y-4 py-4">
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded">
                <div>
                  <Label className="text-xs text-gray-600">Bill Number</Label>
                  <p className="font-mono font-bold text-lg"># {selectedInvoiceForPreview.bill_number}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Bill Date</Label>
                  <p className="font-semibold">
                    {format(new Date(selectedInvoiceForPreview.bill_date), 'dd MMM yyyy')}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Company</Label>
                  <p className="font-semibold">{selectedInvoiceForPreview.companies?.name || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Dealer</Label>
                  <p className="font-semibold">{selectedInvoiceForPreview.dealers?.name || 'N/A'}</p>
                </div>
              </div>

              {/* Amount Details */}
              <div className="p-4 bg-blue-50 rounded border border-blue-200">
                <h3 className="font-semibold mb-2">Amount Breakdown</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Grand Total:</span>
                    <span className="font-bold text-green-600">₹{(selectedInvoiceForPreview.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Status and Payment */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded">
                <div>
                  <Label className="text-xs text-gray-600">Payment Status</Label>
                  <span
                    className={`inline-block px-3 py-1 rounded text-xs font-semibold mt-1 ${
                      selectedInvoiceForPreview.payment_status === 'paid'
                        ? 'bg-green-100 text-green-800'
                        : selectedInvoiceForPreview.payment_status === 'partial'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {selectedInvoiceForPreview.payment_status.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPreviewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bill Generation Settings Dialog */}
      <Dialog open={isBillSettingsDialogOpen} onOpenChange={setIsBillSettingsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bill Generation Settings</DialogTitle>
            <DialogDescription>
              Modify bill series prefix, separator, and sequence number
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="series_prefix">Bill Prefix</Label>
              <Input
                id="series_prefix"
                value={editableBillSettings.series_prefix || ''}
                onChange={(e) => setEditableBillSettings({ ...editableBillSettings, series_prefix: e.target.value })}
                placeholder="e.g., INV"
              />
            </div>
            
            <div>
              <Label htmlFor="series_separator">Separator</Label>
              <Input
                id="series_separator"
                value={editableBillSettings.series_separator || ''}
                onChange={(e) => setEditableBillSettings({ ...editableBillSettings, series_separator: e.target.value })}
                placeholder="e.g., - or /"
                maxLength={1}
              />
            </div>
            
            <div>
              <Label htmlFor="current_sequence">Current Sequence Number</Label>
              <Input
                id="current_sequence"
                type="number"
                value={editableBillSettings.current_sequence_number || ''}
                onChange={(e) => setEditableBillSettings({ ...editableBillSettings, current_sequence_number: parseInt(e.target.value) || 0 })}
                placeholder="e.g., 1001"
              />
            </div>

            <div className="bg-blue-50 p-3 rounded border border-blue-200">
              <p className="text-sm font-semibold text-blue-700 mb-1">Preview:</p>
              <p className="text-lg font-mono font-bold text-blue-600">
                {editableBillSettings.series_prefix}{editableBillSettings.series_separator || ''}{editableBillSettings.current_sequence_number}
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBillSettingsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveBillSettings} className="bg-blue-600 hover:bg-blue-700">
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Bill Dialog */}
      <Dialog open={isCancelBillDialogOpen} onOpenChange={setIsCancelBillDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Bill</DialogTitle>
            <DialogDescription>
              Cancel Bill #{selectedBillForCancel?.bill_number} and provide a reason
            </DialogDescription>
          </DialogHeader>

          {selectedBillForCancel && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded">
                <div>
                  <Label className="text-xs text-gray-600">Bill Number</Label>
                  <p className="font-semibold text-sm mt-1">{selectedBillForCancel.bill_number}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Dealer Name</Label>
                  <p className="font-semibold text-sm mt-1">{selectedBillForCancel.dealers?.name || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Bill Amount</Label>
                  <p className="font-semibold text-sm mt-1">₹{(selectedBillForCancel.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Bill Date</Label>
                  <p className="font-semibold text-sm mt-1">{format(new Date(selectedBillForCancel.bill_date), 'MMM dd, yyyy')}</p>
                </div>
              </div>

              <div className="p-3 bg-red-50 border border-red-200 rounded">
                <p className="text-xs text-red-700 flex gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  This action will mark the bill as cancelled. Cancelled bills will not appear in the dealer ledger.
                </p>
              </div>

              <div>
                <Label htmlFor="cancel-reason">Reason for Cancellation *</Label>
                <Input
                  id="cancel-reason"
                  placeholder="e.g., Invoice error, Customer request, Quality issues..."
                  value={cancelBillReason}
                  onChange={(e) => setCancelBillReason(e.target.value)}
                  className="mt-2"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCancelBillDialogOpen(false)}>
              Keep Bill
            </Button>
            <Button onClick={confirmCancelBill} className="bg-red-600 hover:bg-red-700" disabled={!cancelBillReason.trim()}>
              Cancel Bill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dealer Ledger Report Dialog */}
      <DealerLedgerReportNewDialog
        isOpen={isDealerLedgerReportOpen}
        onOpenChange={setIsDealerLedgerReportOpen}
      />

      {/* Credit Note Dialog */}
      <CreditNoteDialog
        isOpen={isCreditNoteDialogOpen}
        onOpenChange={setIsCreditNoteDialogOpen}
        onSuccess={() => {
          setIsCreditNoteDialogOpen(false);
          showSuccess('Credit note created successfully');
        }}
      />

      {/* Credit Notes Report Dialog */}
      <CreditNotesReportDialog
        isOpen={isCreditNotesReportOpen}
        onOpenChange={setIsCreditNotesReportOpen}
      />

      {/* Import Bills Dialog */}
      <ImportBillsDialog
        isOpen={isImportBillsDialogOpen}
        onClose={() => setIsImportBillsDialogOpen(false)}
        onImportComplete={() => {
          setIsImportBillsDialogOpen(false);
          // Optionally refresh the dashboard
          // fetchOrders();
        }}
      />

      <EwayBillDialog
        isOpen={isEwayBillDialogOpen}
        onOpenChange={setIsEwayBillDialogOpen}
      />

      <MadeWithDyad />
    </div>
  );
};

export default BillingDashboard;
