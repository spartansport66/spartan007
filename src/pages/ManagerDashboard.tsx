"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionContext';
import { LogOut, Loader2, UserCog } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import PaymentOverviewCard from '@/components/PaymentOverviewCard'; // New Import
import PaymentsReportDialog from '@/components/reports/PaymentsReportDialog'; // New Import

const ManagerDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, userType } = useSession();
  const [loadingData, setLoadingData] = useState(false);
  
  // State required for PaymentOverviewCard and its associated report dialog
  const [refreshKey, setRefreshKey] = useState(0);
  const [isPaymentsReportOpen, setIsPaymentsReportOpen] = useState(false);
  const [paymentsReportInitialStatus, setPaymentsReportInitialStatus] = useState<'all' | 'pending' | 'paid' | 'overdue' | 'upcoming' | 'todays_due' | 'pending_approval'>('all');
  const [paymentsReportInitialFromDate, setPaymentsReportInitialFromDate] = useState<string>('');
  const [paymentsReportInitialToDate, setPaymentsReportInitialToDate] = useState<string>('');
  const [paymentsReportDialogKey, setPaymentsReportDialogKey] = useState(0);

  // Function to handle logout
  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error && error.message !== 'Auth session missing!') {
        showError(`Logout failed: ${error.message}. Redirecting to login.`);
      } else {
        showSuccess('Logged out successfully!');
      }
    } catch (error: any) {
      showError(`An unexpected error occurred during logout: ${error.message}. Redirecting to login.`);
    } finally {
      navigate('/login');
    }
  };

  // Handler to open the payments report dialog
  const handleViewPaymentsReport = () => {
    setPaymentsReportInitialStatus('all');
    setPaymentsReportInitialFromDate('');
    setPaymentsReportInitialToDate('');
    setPaymentsReportDialogKey(prev => prev + 1);
    setIsPaymentsReportOpen(true);
  };

  // Authentication and Redirection Logic
  useEffect(() => {
    if (!sessionLoading) {
      if (!user) {
        navigate('/login');
      } else if (userType !== 'manager') {
        showError('Access Denied: Only managers can view this page.');
        navigate('/dashboard');
      }
    }
  }, [sessionLoading, user, userType, navigate]);

  if (sessionLoading || loadingData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-gray-700 dark:text-gray-300 mb-4">Loading manager dashboard...</p>
        <Button onClick={handleLogout} variant="destructive" className="flex items-center gap-2"><LogOut className="h-4 w-4" />Force Logout</Button>
      </div>
    );
  }

  if (userType !== 'manager') return null;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-primary flex items-center gap-2">
          <UserCog className="h-8 w-8" />
          Admin Dashboard
        </h1>
        <Button onClick={handleLogout} variant="outline" className="flex items-center gap-2">
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>

      {/* Dashboard Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <PaymentOverviewCard 
          key={`payment-overview-${refreshKey}`} 
          onViewReport={handleViewPaymentsReport} 
        />
        {/* Placeholder for other manager cards */}
        <div className="flex flex-col items-center justify-center h-full min-h-[200px] border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8">
          <h2 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">
            More Manager Tools Coming Soon
          </h2>
          <p className="text-sm text-muted-foreground text-center">
            This space is reserved for manager-specific reports and actions.
          </p>
        </div>
      </div>

      <MadeWithDyad />

      {/* Dialogs */}
      <PaymentsReportDialog 
        key={paymentsReportDialogKey} 
        isOpen={isPaymentsReportOpen} 
        onOpenChange={setIsPaymentsReportOpen} 
        initialFilterStatus={paymentsReportInitialStatus} 
        initialFilterFromDate={paymentsReportInitialFromDate} 
        initialFilterToDate={paymentsReportInitialToDate} 
      />
    </div>
  );
};

export default ManagerDashboard;