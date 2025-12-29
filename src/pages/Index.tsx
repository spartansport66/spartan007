"use client";

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionContext';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();
  const { session, loading, isAdmin, userType } = useSession();

  useEffect(() => {
    if (!loading) {
      if (session) {
        if (isAdmin) {
          navigate('/admin-dashboard'); // Redirect admin users to Admin Dashboard
        } else {
          navigate('/dashboard'); // Redirect other users to Sales Dashboard
        }
      } else {
        navigate('/login');
      }
    }
  }, [session, loading, navigate, isAdmin, userType]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading...</p>
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