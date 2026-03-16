"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionContext';
import { LogOut, Loader2, UserCog } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import PaymentOverviewCard from '@/components/PaymentOverviewCard';
import PaymentsReportDialog from '@/components/reports/PaymentsReportDialog';
import TodaySalesCard from '@/components/TodaySalesCard';
import DailyReportCard from '@/components/DailyReportCard';

const ManagerDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, userType } = useSession();
  const [loadingData, setLoadingData] = useState(false);
  
  const [refreshKey, setRefreshKey] = useState(0);
  const [isPaymentsReportOpen, setIsPaymentsReportOpen] = useState(false);
  const [paymentsReportInitialStatus, setPaymentsReportInitialStatus] = useState<'all' | 'pending' | 'paid' | 'overdue' | 'upcoming' | 'todays_due' | 'pending_approval'>('all');
  const [paymentsReportInitialFromDate, setPaymentsReportInitialFromDate] = useState<string>('');
  const [paymentsReportInitialToDate, setPaymentsReportInitialToDate] = useState<string>('');
  const [paymentsReportDialogKey, setPaymentsReportDialogKey] = useState(0);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error && error.message !== 'Auth session missing!') {
        showError(`Logout failed: ${error.message}.`);
      } else {
        showSuccess('Logged out successfully!');
      }
    } catch (error: any) {
      showError(`An unexpected error occurred during logout: ${error.message}.`);
    } finally {
      navigate('/');
    }
  };

  const handleViewPaymentsReport = () => {
    setPaymentsReportInitialStatus('all');
    setPaymentsReportInitialFromDate('');
    setPaymentsReportInitialToDate('');
    setPaymentsReportDialogKey(prev => prev + 1);
    setIsPaymentsReportOpen(true);
  };

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
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-0 sm:ml-2 text-base sm:text-lg text-gray-700 dark:text-gray-300 mb-4">Loading manager dashboard...</p>
        <Button onClick={handleLogout} variant="destructive" size="sm" className="flex items-center gap-2" aria-label="Force Logout">
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Force Logout</span>
        </Button>
      </div>
    );
  }

  if (userType !== 'manager') return null;

  return (
    <div className="min-h-screen bg-background text-foreground p-3 sm:p-6 lg:p-8">
      <div className="max-w-screen-lg mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary flex items-center gap-2">
            <UserCog className="h-6 w-6 sm:h-8 sm:w-8" />
            <span className="text-lg sm:text-xl md:text-2xl">Manager Dashboard</span>
          </h1>

          <div className="flex items-center gap-2">
            <Button 
              onClick={() => navigate('/promotional-orders')}
              variant="default"
              size="sm" 
              className="hidden sm:flex items-center gap-2 bg-purple-600 hover:bg-purple-700"
            >
              📦 Promotional Orders
            </Button>

            <Button onClick={handleViewPaymentsReport} variant="ghost" size="sm" className="hidden sm:flex items-center gap-2">
              Reports
            </Button>

            <Button onClick={handleLogout} variant="outline" size="sm" className="flex items-center gap-2" aria-label="Logout">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>

        <div className="mb-4">
          <DailyReportCard />
        </div>

        {/* Dashboard Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <PaymentOverviewCard 
            key={`payment-overview-${refreshKey}`} 
            onViewReport={handleViewPaymentsReport} 
          />
          <TodaySalesCard />
        </div>

        <div className="mt-6">
          <MadeWithDyad />
        </div>

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
    </div>
  );
};

export default ManagerDashboard;