"use client";

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { showError } from '@/utils/toast';
import { useSession } from '@/contexts/SessionContext';
import ProductTableManager from '@/components/ProductTableManager'; // Import the new component

const ManageProducts = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, userType, isAdmin } = useSession();
  const isAuthorized = userType === 'admin' || userType === 'inventory_manager';

  useEffect(() => {
    if (!sessionLoading && !user) {
      navigate('/login');
    } else if (!sessionLoading && user && !isAuthorized) {
      showError('Access Denied: Only authorized personnel can manage products.');
      navigate('/dashboard'); // Sales persons go to their dashboard
    }
  }, [sessionLoading, user, isAuthorized, navigate]);

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading product management...</p>
      </div>
    );
  }

  if (!isAuthorized) {
    return null; // Render nothing if not authorized, as they are redirected
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-full">
        <Button 
          variant="outline" 
          onClick={() => navigate(userType === 'admin' ? '/admin-dashboard' : '/product-dashboard')} 
          className="mb-6 flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Button>

        <ProductTableManager isAdmin={isAdmin} /> {/* Render the reusable component */}
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default ManageProducts;