"use client";

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { showError, showSuccess } from '@/utils/toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2, ArrowLeft, CheckCircle, XCircle, Eye, Filter } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { MadeWithDyad } from '@/components/made-with-dyad';

interface BillForVerification {
  id: string;
  bill_number: string;
  bill_date: string;
  grand_total: number;
  order_id?: string;
  companies?: { id: string; name: string };
  dealers?: { id: string; name: string };
  payment_status: string;
  verification_status: 'pending' | 'verified' | 'rejected';
}

const BillVerificationDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, userType } = useSession();
  const [bills, setBills] = useState<BillForVerification[]>([]);
  const [filteredBills, setFilteredBills] = useState<BillForVerification[]>([]);
  const [verifiedBills, setVerifiedBills] = useState<BillForVerification[]>([]);
  const [rejectedBills, setRejectedBills] = useState<BillForVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDealer, setSelectedDealer] = useState<string>('all');
  const [dealersList, setDealersList] = useState<Array<{ id: string; name: string }>>([]);
  const [searchBill, setSearchBill] = useState<string>('');

  const [isVerifyDialogOpen, setIsVerifyDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<BillForVerification | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewBill, setPreviewBill] = useState<BillForVerification | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Check authorization - only accounting or admin
  useEffect(() => {
    if (!sessionLoading && userType && userType !== 'accounting' && userType !== 'admin') {
      navigate('/');
      showError('You do not have access to this page');
    }
  }, [sessionLoading, userType, navigate]);

  // Fetch bills pending verification
  useEffect(() => {
    if (user && !sessionLoading) {
      fetchBills();
    }
  }, [user, sessionLoading]);

  const fetchBills = async () => {
    try {
      setLoading(true);

      // Fetch all invoices from both spartan and fightor tables
      const { data: spartanData, error: spartanError } = await supabase
        .from('spartan')
        .select(`
          id,
          bill_number,
          bill_date,
          grand_total,
          order_id,
          payment_status,
          companies (id, name),
          dealers (id, name)
        `)
        .order('bill_date', { ascending: false })
        .limit(1000);

      const { data: fightorData, error: fightorError } = await supabase
        .from('fightor')
        .select(`
          id,
          bill_number,
          bill_date,
          grand_total,
          order_id,
          payment_status,
          companies (id, name),
          dealers (id, name)
        `)
        .order('bill_date', { ascending: false })
        .limit(1000);

      // Combine data from both tables
      const data = [...(spartanData || []), ...(fightorData || [])];
      
      if (spartanError && fightorError) {
        throw spartanError;
      }

      if (data && data.length > 0) {
        // For now, assume all bills are pending verification
        // In a real implementation, this would come from a verification_status field in the database
        const pendingBills = (data as BillForVerification[]).filter(
          (bill) => bill.verification_status === undefined || bill.verification_status === 'pending'
        );
        
        setBills(pendingBills);
        setFilteredBills(pendingBills);

        // Fetch verified bills
        const verifiedData = (data as BillForVerification[]).filter(
          (bill) => bill.verification_status === 'verified'
        );
        setVerifiedBills(verifiedData);

        // Fetch rejected bills
        const rejectedData = (data as BillForVerification[]).filter(
          (bill) => bill.verification_status === 'rejected'
        );
        setRejectedBills(rejectedData);
      }

      // Fetch dealers for filter dropdown
      const { data: dealersData, error: dealersError } = await supabase
        .from('dealers')
        .select('id, name')
        .order('name');

      if (!dealersError && dealersData) {
        setDealersList(dealersData);
      }
    } catch (error) {
      showError('Failed to fetch bills');
      console.error('Error fetching bills:', error);
    } finally {
      setLoading(false);
    }
  };

  // Apply filters
  useEffect(() => {
    let filtered = bills;

    if (selectedDealer !== 'all') {
      filtered = filtered.filter((bill) => bill.dealers?.id === selectedDealer);
    }

    if (searchBill) {
      const search = searchBill.toLowerCase();
      filtered = filtered.filter(
        (bill) =>
          bill.bill_number.toLowerCase().includes(search) ||
          bill.dealers?.name?.toLowerCase().includes(search) ||
          bill.companies?.name?.toLowerCase().includes(search)
      );
    }

    setFilteredBills(filtered);
  }, [bills, selectedDealer, searchBill]);

  const handleVerifyBill = (bill: BillForVerification) => {
    setSelectedBill(bill);
    setIsVerifyDialogOpen(true);
  };

  const confirmVerifyBill = async () => {
    if (!selectedBill) return;

    try {
      setIsSubmitting(true);

      // Update bill verification status in database
      const { data: spartanData, error: spartanError } = await supabase
        .from('spartan')
        .update({ verification_status: 'verified' })
        .eq('id', selectedBill.id)
        .select();

      console.log('Spartan update result:', { spartanData, spartanError });

      // If error or no data returned, try fightor
      if (spartanError || !spartanData || spartanData.length === 0) {
        console.log('Bill not found in spartan, trying fightor...');
        const { data: fightorData, error: fightorError } = await supabase
          .from('fightor')
          .update({ verification_status: 'verified' })
          .eq('id', selectedBill.id)
          .select();

        console.log('Fightor update result:', { fightorData, fightorError });

        if (fightorError) throw fightorError;

        if (!fightorData || fightorData.length === 0) {
          throw new Error('Bill not found in either spartan or fightor table');
        }
      }

      if (spartanError && !spartanData) {
        throw spartanError;
      }

      // Move bill from pending to verified
      setBills(bills.filter((b) => b.id !== selectedBill.id));
      setVerifiedBills([...verifiedBills, { ...selectedBill, verification_status: 'verified' }]);

      showSuccess(`Bill ${selectedBill.bill_number} has been verified`);
      setIsVerifyDialogOpen(false);
      setSelectedBill(null);
    } catch (error) {
      showError('Failed to verify bill');
      console.error('Error verifying bill:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectBill = (bill: BillForVerification) => {
    setSelectedBill(bill);
    setRejectionReason('');
    setIsRejectDialogOpen(true);
  };

  const confirmRejectBill = async () => {
    if (!selectedBill) return;

    if (!rejectionReason.trim()) {
      showError('Please provide a reason for rejection');
      return;
    }

    try {
      setIsSubmitting(true);

      // Update bill verification status in database
      const { data: spartanData, error: spartanError } = await supabase
        .from('spartan')
        .update({ 
          verification_status: 'rejected',
          rejection_reason: rejectionReason 
        })
        .eq('id', selectedBill.id)
        .select();

      console.log('Spartan update result:', { spartanData, spartanError });

      // If error or no data returned, try fightor
      if (spartanError || !spartanData || spartanData.length === 0) {
        console.log('Bill not found in spartan, trying fightor...');
        const { data: fightorData, error: fightorError } = await supabase
          .from('fightor')
          .update({ 
            verification_status: 'rejected',
            rejection_reason: rejectionReason 
          })
          .eq('id', selectedBill.id)
          .select();

        console.log('Fightor update result:', { fightorData, fightorError });

        if (fightorError) throw fightorError;

        if (!fightorData || fightorData.length === 0) {
          throw new Error('Bill not found in either spartan or fightor table');
        }
      }

      if (spartanError && !spartanData) {
        throw spartanError;
      }

      // Move bill from pending to rejected
      setBills(bills.filter((b) => b.id !== selectedBill.id));
      setRejectedBills([...rejectedBills, { ...selectedBill, verification_status: 'rejected' }]);

      showSuccess(`Bill ${selectedBill.bill_number} has been rejected`);
      setIsRejectDialogOpen(false);
      setSelectedBill(null);
      setRejectionReason('');
    } catch (error) {
      showError('Failed to reject bill');
      console.error('Error rejecting bill:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (sessionLoading || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin h-8 w-8 text-indigo-600" />
      </div>
    );
  }

  if (userType !== 'accounting' && userType !== 'admin') {
    return null;
  }

  const stats = [
    {
      label: 'Pending Verification',
      value: bills.length,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
    },
    {
      label: 'Verified Bills',
      value: verifiedBills.length,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      label: 'Rejected Bills',
      value: rejectedBills.length,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-gray-200 rounded-lg transition"
                title="Go Back"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Bill Verification Dashboard</h1>
                <p className="text-gray-600 text-sm mt-1">Review and verify pending bills for the dealer ledger</p>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-4">
            {stats.map((stat, index) => (
              <Card key={index} className={stat.bgColor}>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                    <p className="text-xs text-gray-600 mt-1 font-medium">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="dealer-filter" className="text-sm font-medium">
                  Filter by Dealer
                </Label>
                <select
                  id="dealer-filter"
                  value={selectedDealer}
                  onChange={(e) => setSelectedDealer(e.target.value)}
                  className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Dealers</option>
                  {dealersList.map((dealer) => (
                    <option key={dealer.id} value={dealer.id}>
                      {dealer.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="search-bill" className="text-sm font-medium">
                  Search by Bill # or Dealer
                </Label>
                <Input
                  id="search-bill"
                  placeholder="Search..."
                  value={searchBill}
                  onChange={(e) => setSearchBill(e.target.value)}
                  className="mt-2"
                />
              </div>

              <div className="flex items-end">
                <Button
                  onClick={() => {
                    setSelectedDealer('all');
                    setSearchBill('');
                  }}
                  variant="outline"
                  className="w-full"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending Bills Section */}
        <Card className="mb-6">
          <CardHeader className="bg-yellow-50 border-b">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-yellow-600" />
              <span>Pending Verification ({filteredBills.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {filteredBills.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No pending bills to verify</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Bill #</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Company</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Dealer</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700">Amount</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Payment Status</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredBills.map((bill) => (
                      <tr key={bill.id} className="hover:bg-yellow-50 transition">
                        <td className="px-4 py-3 font-mono font-bold text-yellow-600">#{bill.bill_number}</td>
                        <td className="px-4 py-3 text-gray-700">{bill.companies?.name || 'N/A'}</td>
                        <td className="px-4 py-3 text-gray-700">{bill.dealers?.name || 'N/A'}</td>
                        <td className="px-4 py-3 text-gray-600">{format(new Date(bill.bill_date), 'MMM dd, yyyy')}</td>
                        <td className="px-4 py-3 text-right font-bold text-green-600">
                          ₹{bill.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold ${
                              bill.payment_status === 'paid'
                                ? 'bg-green-100 text-green-800'
                                : bill.payment_status === 'partial'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {bill.payment_status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex justify-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setPreviewBill(bill);
                                setIsPreviewOpen(true);
                              }}
                              title="View Bill Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleVerifyBill(bill)}
                              className="bg-green-600 hover:bg-green-700"
                              disabled={isSubmitting}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Verify
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleRejectBill(bill)}
                              variant="destructive"
                              disabled={isSubmitting}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Verified Bills Section */}
        {verifiedBills.length > 0 && (
          <Card className="mb-6">
            <CardHeader className="bg-green-50 border-b">
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span>Verified Bills ({verifiedBills.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Bill #</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Company</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Dealer</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700">Amount</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Payment Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {verifiedBills.map((bill) => (
                      <tr key={bill.id} className="hover:bg-green-50 transition">
                        <td className="px-4 py-3 font-mono font-bold text-green-600">#{bill.bill_number}</td>
                        <td className="px-4 py-3 text-gray-700">{bill.companies?.name || 'N/A'}</td>
                        <td className="px-4 py-3 text-gray-700">{bill.dealers?.name || 'N/A'}</td>
                        <td className="px-4 py-3 text-gray-600">{format(new Date(bill.bill_date), 'MMM dd, yyyy')}</td>
                        <td className="px-4 py-3 text-right font-bold text-green-600">
                          ₹{bill.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold ${
                              bill.payment_status === 'paid'
                                ? 'bg-green-100 text-green-800'
                                : bill.payment_status === 'partial'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {bill.payment_status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rejected Bills Section */}
        {rejectedBills.length > 0 && (
          <Card>
            <CardHeader className="bg-red-50 border-b">
              <CardTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-600" />
                <span>Rejected Bills ({rejectedBills.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Bill #</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Company</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Dealer</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700">Amount</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Payment Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rejectedBills.map((bill) => (
                      <tr key={bill.id} className="hover:bg-red-50 transition">
                        <td className="px-4 py-3 font-mono font-bold text-red-600">#{bill.bill_number}</td>
                        <td className="px-4 py-3 text-gray-700">{bill.companies?.name || 'N/A'}</td>
                        <td className="px-4 py-3 text-gray-700">{bill.dealers?.name || 'N/A'}</td>
                        <td className="px-4 py-3 text-gray-600">{format(new Date(bill.bill_date), 'MMM dd, yyyy')}</td>
                        <td className="px-4 py-3 text-right font-bold text-green-600">
                          ₹{bill.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold ${
                              bill.payment_status === 'paid'
                                ? 'bg-green-100 text-green-800'
                                : bill.payment_status === 'partial'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {bill.payment_status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Verify Bill Dialog */}
      <Dialog open={isVerifyDialogOpen} onOpenChange={setIsVerifyDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Verify Bill</DialogTitle>
            <DialogDescription>
              Confirm verification of Bill #{selectedBill?.bill_number}
            </DialogDescription>
          </DialogHeader>

          {selectedBill && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded">
                <div>
                  <Label className="text-xs text-gray-600">Bill Number</Label>
                  <p className="font-semibold text-sm mt-1">{selectedBill.bill_number}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Dealer</Label>
                  <p className="font-semibold text-sm mt-1">{selectedBill.dealers?.name || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Amount</Label>
                  <p className="font-semibold text-sm mt-1">₹{selectedBill.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Date</Label>
                  <p className="font-semibold text-sm mt-1">{format(new Date(selectedBill.bill_date), 'MMM dd, yyyy')}</p>
                </div>
              </div>

              <div className="p-3 bg-green-50 border border-green-200 rounded">
                <p className="text-xs text-green-700">
                  This bill will be marked as verified and included in the dealer ledger.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsVerifyDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmVerifyBill}
              className="bg-green-600 hover:bg-green-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Verify Bill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Bill Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Bill</DialogTitle>
            <DialogDescription>
              Reject Bill #{selectedBill?.bill_number} and provide a reason
            </DialogDescription>
          </DialogHeader>

          {selectedBill && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded">
                <div>
                  <Label className="text-xs text-gray-600">Bill Number</Label>
                  <p className="font-semibold text-sm mt-1">{selectedBill.bill_number}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Dealer</Label>
                  <p className="font-semibold text-sm mt-1">{selectedBill.dealers?.name || 'N/A'}</p>
                </div>
              </div>

              <div>
                <Label htmlFor="rejection-reason">Reason for Rejection *</Label>
                <Textarea
                  id="rejection-reason"
                  placeholder="e.g., Amount mismatch, Missing details, Quality issues..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="mt-2"
                  rows={4}
                />
              </div>

              <div className="p-3 bg-red-50 border border-red-200 rounded">
                <p className="text-xs text-red-700">
                  This bill will be marked as rejected and excluded from the dealer ledger.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>
              Keep Bill
            </Button>
            <Button
              onClick={confirmRejectBill}
              variant="destructive"
              disabled={isSubmitting || !rejectionReason.trim()}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
              Reject Bill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bill Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bill Details - {previewBill?.bill_number}</DialogTitle>
          </DialogHeader>

          {previewBill && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded">
                <div>
                  <Label className="text-xs text-gray-600">Bill Number</Label>
                  <p className="font-mono font-bold text-lg mt-1">#{previewBill.bill_number}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Bill Date</Label>
                  <p className="font-semibold mt-1">{format(new Date(previewBill.bill_date), 'dd MMM yyyy')}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Company</Label>
                  <p className="font-semibold mt-1">{previewBill.companies?.name || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Dealer</Label>
                  <p className="font-semibold mt-1">{previewBill.dealers?.name || 'N/A'}</p>
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded border border-blue-200">
                <h3 className="font-semibold mb-2">Amount Details</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Grand Total:</span>
                    <span className="font-bold text-green-600">₹{previewBill.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded">
                <div>
                  <Label className="text-xs text-gray-600">Payment Status</Label>
                  <span
                    className={`inline-block px-3 py-1 rounded text-xs font-semibold mt-1 ${
                      previewBill.payment_status === 'paid'
                        ? 'bg-green-100 text-green-800'
                        : previewBill.payment_status === 'partial'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {previewBill.payment_status.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MadeWithDyad />
    </div>
  );
};

export default BillVerificationDashboard;
