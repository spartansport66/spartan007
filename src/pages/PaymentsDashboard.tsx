"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { DollarSign, LogOut, Plus, Eye, FileText, Loader2, Search, CheckCircle, Clock, AlertCircle, CreditCard } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { formatCurrency } from '@/utils/format';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import AddPaymentForm from '@/components/AddPaymentForm';
import PendingPaymentsReport from '@/components/reports/PendingPaymentsReport';
import DealerLedgerReport from '@/components/reports/DealerLedgerReport';
import CreditNotesCard from '@/components/CreditNotesCard';

interface Dealer {
  id: string;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
}

interface PaymentSummary {
  totalPending: number;
  totalApproved: number;
  totalRejected: number;
  pendingCount: number;
  approvedCount: number;
}

const PaymentsDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, userType } = useSession();
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null);
  const [isAddPaymentDialogOpen, setIsAddPaymentDialogOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('add-payment');
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary>({
    totalPending: 0,
    totalApproved: 0,
    totalRejected: 0,
    pendingCount: 0,
    approvedCount: 0,
  });

  // Fetch dealers
  const fetchDealers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('dealers')
        .select('id, name, contact_person, phone, email')
        .order('name', { ascending: true });

      if (error) throw error;
      setDealers(data || []);
    } catch (error: any) {
      showError(`Failed to load dealers: ${error.message}`);
    }
  }, []);

  // Fetch payment summary
  const fetchPaymentSummary = useCallback(async () => {
    try {
      // Get pending payments from payment_received table
      const { data: pendingData, error: pendingError } = await supabase
        .from('payment_received')
        .select('amount')
        .eq('status', 'pending_approval');

      // Get approved payments from payment_received table
      const { data: approvedData, error: approvedError } = await supabase
        .from('payment_received')
        .select('amount')
        .eq('status', 'completed');

      // Get rejected payments from payment_received table
      const { data: rejectedData, error: rejectedError } = await supabase
        .from('payment_received')
        .select('amount')
        .eq('status', 'rejected');

      if (pendingError || approvedError || rejectedError) throw new Error('Failed to fetch payment summary');

      const totalPending = (pendingData || []).reduce((sum, p) => sum + (p.amount || 0), 0);
      const totalApproved = (approvedData || []).reduce((sum, p) => sum + (p.amount || 0), 0);
      const totalRejected = (rejectedData || []).reduce((sum, p) => sum + (p.amount || 0), 0);

      setPaymentSummary({
        totalPending,
        totalApproved,
        totalRejected,
        pendingCount: pendingData?.length || 0,
        approvedCount: approvedData?.length || 0,
      });
    } catch (error: any) {
      console.error('Error fetching payment summary:', error);
    }
  }, []);

  // Load data on component mount
  useEffect(() => {
    if (!sessionLoading && userType === 'payment') {
      setLoadingData(true);
      Promise.all([fetchDealers(), fetchPaymentSummary()]).finally(() => setLoadingData(false));
    } else if (!sessionLoading && userType !== 'payment') {
      navigate('/dashboard');
    }
  }, [sessionLoading, userType, fetchDealers, fetchPaymentSummary, navigate]);

  const filteredDealers = dealers.filter((dealer) =>
    dealer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    dealer.contact_person?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    dealer.phone?.includes(searchQuery)
  );

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error && error.message !== 'Auth session missing!') {
        showError(`Logout failed: ${error.message}`);
      } else {
        showSuccess('Logged out successfully!');
        navigate('/login');
      }
    } catch (error: any) {
      showError(`Logout error: ${error.message}`);
    }
  };

  const handlePaymentAdded = () => {
    setIsAddPaymentDialogOpen(false);
    setSelectedDealer(null);
    fetchPaymentSummary();
    showSuccess('Payment added successfully!');
  };

  if (sessionLoading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <DollarSign className="h-8 w-8 text-green-600" />
            Payments Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage dealer payments and approval workflow</p>
        </div>
        <Button onClick={handleLogout} variant="outline" className="flex items-center gap-2">
          <LogOut className="h-4 w-4" /> Logout
        </Button>
      </div>

      {/* Summary Cards - Above All Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 shadow-lg">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400 flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Pending Approval
                </p>
                <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-200 mt-2">
                  {formatCurrency(paymentSummary.totalPending)}
                </p>
                <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">{paymentSummary.pendingCount} payments</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 shadow-lg">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-400 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" /> Approved
                </p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-200 mt-2">
                  {formatCurrency(paymentSummary.totalApproved)}
                </p>
                <p className="text-xs text-green-600 dark:text-green-500 mt-1">{paymentSummary.approvedCount} payments</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 shadow-lg">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-400 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" /> Rejected
                </p>
                <p className="text-2xl font-bold text-red-900 dark:text-red-200 mt-2">
                  {formatCurrency(paymentSummary.totalRejected)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Button
          onClick={() => setActiveSection('add-payment')}
          className={`flex items-center justify-center gap-2 py-6 font-semibold text-base ${
            activeSection === 'add-payment'
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300'
          }`}
        >
          <Plus className="h-5 w-5" />
          Add Payment
        </Button>

        <Button
          onClick={() => setActiveSection('pending')}
          className={`flex items-center justify-center gap-2 py-6 font-semibold text-base ${
            activeSection === 'pending'
              ? 'bg-yellow-600 text-white hover:bg-yellow-700'
              : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300'
          }`}
        >
          <Clock className="h-5 w-5" />
          Pending Approval
        </Button>

        <Button
          onClick={() => setActiveSection('credit-notes')}
          className={`flex items-center justify-center gap-2 py-6 font-semibold text-base ${
            activeSection === 'credit-notes'
              ? 'bg-purple-600 text-white hover:bg-purple-700'
              : 'bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300'
          }`}
        >
          <CreditCard className="h-5 w-5" />
          Credit Notes
        </Button>

        <Button
          onClick={() => setActiveSection('ledger')}
          className={`flex items-center justify-center gap-2 py-6 font-semibold text-base ${
            activeSection === 'ledger'
              ? 'bg-teal-600 text-white hover:bg-teal-700'
              : 'bg-teal-100 text-teal-700 hover:bg-teal-200 dark:bg-teal-900/30 dark:text-teal-300'
          }`}
        >
          <Eye className="h-5 w-5" />
          Dealer Ledger
        </Button>
      </div>

      {/* Content Section */}
      <div className="space-y-6">
        {/* Add Payment Section */}
        {activeSection === 'add-payment' && (
          <>
            {/* Add Payment Card */}
            <Card>
              <CardHeader>
                <CardTitle>Add Payment</CardTitle>
                <CardDescription>Select a dealer and add a new payment</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Dealer Dropdown with Search */}
                  <div>
                    <Label htmlFor="dealer-search">Select Dealer</Label>
                    <div className="relative mt-2">
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            id="dealer-search"
                            type="text"
                            placeholder="Search by name, contact, or phone..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                      </div>

                      {/* Dropdown List */}
                      {searchQuery.length > 0 && (
                        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-64 overflow-y-auto">
                          {filteredDealers.length > 0 ? (
                            <ul className="py-1">
                              {filteredDealers.map((dealer, index) => (
                                <li
                                  key={dealer.id}
                                  onClick={() => {
                                    setSelectedDealer(dealer);
                                    setSearchQuery('');
                                  }}
                                  className={`px-4 py-3 cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 ${
                                    selectedDealer?.id === dealer.id
                                      ? 'bg-primary/10 dark:bg-primary/20'
                                      : ''
                                  }`}
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <p className="font-medium text-gray-900 dark:text-white">{dealer.name}</p>
                                      {dealer.contact_person && (
                                        <p className="text-xs text-gray-600 dark:text-gray-400">Contact: {dealer.contact_person}</p>
                                      )}
                                      {dealer.phone && (
                                        <p className="text-xs text-gray-600 dark:text-gray-400">Phone: {dealer.phone}</p>
                                      )}
                                    </div>
                                    <span className="ml-2 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-2 py-1 rounded">
                                      {index + 1}
                                    </span>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                              No dealers found
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Selected Dealer Info Card */}
                  {selectedDealer && (
                    <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                      <CardContent className="pt-6">
                        <div className="space-y-2">
                          <p className="text-sm text-blue-700 dark:text-blue-400">Selected Dealer</p>
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

                  {/* Add Payment Button */}
                  {selectedDealer && (
                    <div className="pt-4">
                      <Button
                        onClick={() => setIsAddPaymentDialogOpen(true)}
                        className="w-full bg-primary text-white hover:bg-primary/90 flex items-center justify-center gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Add Payment for {selectedDealer.name}
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Pending Payments Section */}
        {activeSection === 'pending' && <PendingPaymentsReport />}

        {/* Credit Notes Section */}
        {activeSection === 'credit-notes' && (
          <CreditNotesCard
            showCreateButton={true}
            title="Create & Manage Credit Notes"
          />
        )}

        {/* Dealer Ledger Section */}
        {activeSection === 'ledger' && <DealerLedgerReport />}
      </div>

      {/* Add Payment Dialog */}
      <Dialog open={isAddPaymentDialogOpen} onOpenChange={setIsAddPaymentDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Payment</DialogTitle>
            <DialogDescription>
              Add a new payment for {selectedDealer?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedDealer && (
            <AddPaymentForm
              dealerId={selectedDealer.id}
              dealerName={selectedDealer.name}
              onPaymentAdded={handlePaymentAdded}
            />
          )}
        </DialogContent>
      </Dialog>

      <MadeWithDyad />
    </div>
  );
};

export default PaymentsDashboard;
