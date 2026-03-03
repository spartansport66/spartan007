"use client";
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import SalesHODApprovalCard from '@/components/SalesHODApprovalCard';
import ApprovedHODOrdersCard from '@/components/ApprovedHODOrdersCard';
import SalesHODDispatchedCard from '@/components/SalesHODDispatchedCard';
import DisapprovedHODOrdersCard from '@/components/DisapprovedHODOrdersCard';

const SalesHODDashboard: React.FC = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error && error.message !== 'Auth session missing!') {
        showError(`Logout failed: ${error.message}`);
      } else {
        showSuccess('Logged out successfully!');
      }
    } catch (err: any) {
      showError(`An unexpected error occurred during logout: ${err.message}`);
    } finally {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-primary">Sales HOD Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage approvals of orders awaiting dispatch.</p>
        </div>
        <div>
          <Button variant="outline" size="icon" onClick={handleLogout} title="Logout">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="lg:col-span-1"><SalesHODApprovalCard /></div>
        <div className="lg:col-span-1 flex flex-col gap-4">
          <ApprovedHODOrdersCard />
          <DisapprovedHODOrdersCard />
        </div>
        <div className="lg:col-span-2"><SalesHODDispatchedCard /></div>
      </div>
    </div>
  );
};

export default SalesHODDashboard;
