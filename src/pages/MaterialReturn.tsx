"use client";

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useSession } from '@/contexts/SessionContext';
import { showError } from '@/utils/toast';
import MaterialReturnForm from '@/components/MaterialReturnForm';

const MaterialReturn = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, isAdmin } = useSession();

  useEffect(() => {
    if (!sessionLoading) {
      if (!user) {
        navigate('/login');
      } else if (!isAdmin) {
        showError('Access Denied: Only administrators can access this page.');
        navigate('/dashboard');
      }
    }
  }, [sessionLoading, user, isAdmin, navigate]);

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl">
        <Button 
          variant="outline" 
          onClick={() => navigate('/admin-dashboard')} 
          className="mb-6 flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Admin Dashboard
        </Button>
        
        <MaterialReturnForm />
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default MaterialReturn;