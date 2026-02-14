"use client";
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionContext';
import { showError } from '@/utils/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, BarChart, Settings, FileText, ArrowLeft } from 'lucide-react';
import { MadeWithDyad } from '@/components/made-with-dyad';

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const { userType, loading, isAdmin } = useSession();

  useEffect(() => {
    if (!loading && userType !== 'super_admin' && userType !== 'manager') {
      showError('Access Denied: You do not have permission to view this page.');
      navigate('/dashboard');
    }
  }, [userType, loading, navigate]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl">
        <Button variant="outline" onClick={() => navigate(userType === 'manager' ? '/manager-dashboard' : '/admin-dashboard')} className="mb-6 flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Button>

        <Card className="bg-card text-card-foreground shadow-lg w-full">
          <CardHeader>
            <CardTitle className="text-2xl sm:text-3xl font-bold text-primary text-center">
              Super Admin Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <DashboardCard
                title="Manage All Users"
                icon={<Users className="h-8 w-8 text-primary" />}
                onClick={() => navigate('/super-admin/manage-users')}
              />
              <DashboardCard
                title="System Analytics"
                icon={<BarChart className="h-8 w-8 text-primary" />}
                onClick={() => navigate('/super-admin/analytics')}
              />
              <DashboardCard
                title="System Settings"
                icon={<Settings className="h-8 w-8 text-primary" />}
                onClick={() => navigate('/super-admin/settings')}
              />
              <DashboardCard
                title="Audit Logs"
                icon={<FileText className="h-8 w-8 text-primary" />}
                onClick={() => navigate('/super-admin/logs')}
              />
            </div>
          </CardContent>
        </Card>
      </div>
      <MadeWithDyad />
    </div>
  );
};

const DashboardCard = ({ title, icon, onClick }: { title: string; icon: React.ReactNode; onClick: () => void; }) => (
  <Card 
    className="bg-card-foreground/5 hover:bg-card-foreground/10 transition-all duration-300 cursor-pointer"
    onClick={onClick}
  >
    <CardContent className="p-6 flex flex-col items-center justify-center text-center gap-4">
      {icon}
      <p className="text-lg font-semibold text-foreground">{title}</p>
    </CardContent>
  </Card>
);

export default SuperAdminDashboard;