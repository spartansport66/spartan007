"use client";
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionContext';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { Loader2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';

const Index = () => {
  const navigate = useNavigate();
  const { session, loading, isAdmin, userType, mustResetPassword } = useSession();
  const [forceLogoutLoading, setForceLogoutLoading] = useState(false);

  useEffect(() => {
    console.log('Index useEffect triggered');
    console.log('session:', session);
    console.log('loading:', loading);
    console.log('isAdmin:', isAdmin);
    console.log('userType:', userType);
    console.log('mustResetPassword:', mustResetPassword);
    
    if (!loading) {
      if (session) {
        // Only redirect if userType has been determined (is not null)
        if (userType !== null) { 
          if (mustResetPassword && userType === 'sales_person') {
            console.log('Redirecting sales person to force password reset.');
            navigate('/force-password-reset');
          } else if (userType === 'gate_keeper') {
            console.log('Redirecting to gate pass dashboard');
            navigate('/gate-pass-dashboard');
          } else if (userType === 'inventory_manager') {
            console.log('Redirecting to product dashboard');
            navigate('/product-dashboard');
          } else if (userType === 'manager') {
            console.log('Redirecting to manager dashboard');
            navigate('/manager-dashboard'); // Keep Manager Dashboard as primary
          } else if (userType === 'super_admin') {
            console.log('Redirecting to super admin dashboard');
            navigate('/super-admin-dashboard');
          } else if (isAdmin) {
            console.log('Redirecting to admin dashboard');
            navigate('/admin-dashboard');
          } else {
            console.log('Redirecting to user dashboard');
            navigate('/dashboard');
          }
        }
      } else {
        console.log('Redirecting to login');
        navigate('/login');
      }
    }
  }, [session, loading, isAdmin, userType, mustResetPassword, navigate]);

  const handleForceLogout = async () => {
    setForceLogoutLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error && error.message !== 'Auth session missing!') {
        console.warn('Logout API call failed:', error.message);
        showError(`Logout failed: ${error.message}. You are being redirected.`);
      } else {
        showSuccess('Logged out successfully!');
      }
      // Always navigate to login to clear client-side state
      navigate('/login');
    } catch (error: any) {
      console.error('Unexpected error during logout:', error);
      showError(`An unexpected error occurred during logout: ${error.message}. Redirecting.`);
    } finally {
      setForceLogoutLoading(false);
    }
  };

  if (loading || (session && userType === null)) { // Also show loading if session exists but userType is not yet fetched
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-gray-700 dark:text-gray-300 mb-4">Loading...</p>
        <Button 
          onClick={handleForceLogout} 
          variant="destructive" 
          className="flex items-center gap-2"
          disabled={forceLogoutLoading}
        >
          <LogOut className="h-4 w-4" /> 
          {forceLogoutLoading ? 'Logging out...' : 'Force Logout'}
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-white">Welcome</h1>
        <p className="text-xl text-gray-600 dark:text-gray-400">Redirecting...</p>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default Index;