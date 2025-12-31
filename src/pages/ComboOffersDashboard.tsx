"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { showSuccess, showError } from '@/utils/toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { ArrowLeft, Loader2, Gift, PlusCircle } from 'lucide-react';
import { useSession } from '@/contexts/SessionContext';
import SendWhatsAppOfferCard from '@/components/SendWhatsAppOfferCard';
import SentWhatsAppOffersCard from '@/components/SentWhatsAppOffersCard';

const ComboOffersDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, isAdmin } = useSession();
  const [loadingData, setLoadingData] = useState(true);
  const [whatsappRefreshKey, setWhatsappRefreshKey] = useState(0); // Key to refresh WhatsApp logs

  // This component doesn't need to fetch combo offers directly,
  // but it needs to ensure the user is an admin.
  useEffect(() => {
    if (!sessionLoading) {
      if (!user) {
        navigate('/login');
      } else if (!isAdmin) {
        showError('Access Denied: You must be an administrator to view this page.');
        navigate('/dashboard');
      } else {
        setLoadingData(false); // Admin user, no further data to load for this dashboard itself
      }
    }
  }, [sessionLoading, user, isAdmin, navigate]);

  const handleWhatsAppMessageSent = () => {
    setWhatsappRefreshKey(prev => prev + 1); // Increment key to refresh SentWhatsAppOffersCard
  };

  if (sessionLoading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading combo offers dashboard...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return null; // Should be redirected by useEffect
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <Button variant="outline" onClick={() => navigate('/admin-dashboard')} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Admin Dashboard
        </Button>
        <h1 className="text-2xl sm:text-3xl font-bold text-primary">Combo Offer Management</h1>
        <div className="w-fit"></div> {/* Spacer for alignment */}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-6 flex-grow"> {/* Added flex-grow */}
        {/* Card 1: Create New Combo Offer */}
        <Card className="bg-card text-card-foreground shadow-lg h-full flex flex-col justify-between">
          <CardHeader className="bg-purple-600 dark:bg-purple-800 text-white rounded-t-lg p-4">
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <PlusCircle className="h-6 w-6" /> Create New Offer
            </CardTitle>
            <CardDescription className="text-purple-100 dark:text-purple-200">
              Define a new combo offer with products and discounts.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 flex-grow flex items-center justify-center">
            <Button onClick={() => navigate('/create-combo-offer')} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              <Gift className="h-5 w-5 mr-2" /> Create Combo Offer
            </Button>
          </CardContent>
        </Card>

        {/* Card 2: Send WhatsApp Offer */}
        <SendWhatsAppOfferCard onMessageSent={handleWhatsAppMessageSent} />

        {/* Card 3: Manage Sent WhatsApp Offers */}
        <SentWhatsAppOffersCard refreshKey={whatsappRefreshKey} />
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default ComboOffersDashboard;