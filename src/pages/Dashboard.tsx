"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionContext';
import { MadeWithDyad } from '@/components/made-with-dyad';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading } = useSession();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error logging out:', error.message);
    } else {
      navigate('/login');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-lg text-gray-700 dark:text-gray-300">Loading dashboard...</p>
      </div>
    );
  }

  if (!user) {
    navigate('/login');
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md text-center">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Sales Dashboard</h1>
        <p className="text-xl text-gray-700 dark:text-gray-300 mb-6">Welcome, {user.email}!</p>
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
          This is your personalized dashboard where you can manage sales and interact with registered wholesalers.
        </p>
        <div className="space-y-4">
          <Button className="w-full py-3 text-lg">View Products</Button>
          <Button className="w-full py-3 text-lg">Manage Wholesalers</Button>
          <Button className="w-full py-3 text-lg">Sales Reports</Button>
          <Button onClick={handleLogout} variant="destructive" className="w-full py-3 text-lg">
            Logout
          </Button>
        </div>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default Dashboard;