"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { ArrowLeft, Edit, Trash2, Eye, Loader2 } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';

interface Dealer {
  id: string;
  name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  credit_limit: number;
  user_id: string; // Added user_id to interface for RLS checks
}

const ManageDealers = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, isAdmin } = useSession(); // Get isAdmin from session context
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDealers = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('dealers')
      .select('*'); // RLS will handle visibility based on user.id or isAdmin

    if (error) {
      console.error('Error fetching dealers:', error);
      setError(`Failed to load dealers: ${error.message}`);
      showError(`Failed to load dealers: ${error.message}`);
      setDealers([]);
    } else {
      setDealers(data || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!sessionLoading && user) {
      fetchDealers();
    } else if (!sessionLoading && !user) {
      navigate('/login');
    }
  }, [sessionLoading, user, fetchDealers, navigate]);

  const handleView = (dealerId: string) => {
    showSuccess(`Viewing dealer ${dealerId}`);
    console.log('View dealer:', dealerId);
  };

  const handleEdit = (dealerId: string) => {
    showSuccess(`Editing dealer ${dealerId}`);
    console.log('Edit dealer:', dealerId);
  };

  const handleDelete = async (dealerId: string) => {
    if (window.confirm(`Are you sure you want to delete this dealer?`)) {
      const { error } = await supabase
        .from('dealers')
        .delete()
        .eq('id', dealerId); // RLS will enforce user_id or admin check

      if (error) {
        console.error('Error deleting dealer:', error);
        showError(`Failed to delete dealer: ${error.message}`);
      } else {
        showSuccess('Dealer deleted successfully!');
        fetchDealers();
      }
    }
  };

  if (sessionLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading dealers...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
        <p className="text-lg text-red-600 dark:text-red-400 mb-4">{error}</p>
        <Button onClick={() => navigate('/dashboard')} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-6xl"> {/* Increased max-w for more columns */}
        <Button variant="outline" onClick={() => navigate('/dashboard')} className="mb-6 flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Button>

        <Card className="bg-card text-card-foreground shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-primary">Manage Dealers</CardTitle>
            <CardDescription className="text-muted-foreground">View, edit, or delete your registered dealers.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              {dealers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No dealers found. Add a new dealer to get started!</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted hover:bg-muted/90">
                      <TableHead className="text-muted-foreground">Name</TableHead>
                      <TableHead className="text-muted-foreground">Contact Person</TableHead>
                      <TableHead className="text-muted-foreground">Email</TableHead>
                      <TableHead className="text-muted-foreground">Phone</TableHead>
                      <TableHead className="text-muted-foreground">Address</TableHead>
                      <TableHead className="text-muted-foreground">City</TableHead>
                      <TableHead className="text-muted-foreground">State</TableHead>
                      <TableHead className="text-muted-foreground">Country</TableHead>
                      <TableHead className="text-muted-foreground">Credit Limit</TableHead>
                      <TableHead className="text-muted-foreground">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dealers.map((dealer) => (
                      <TableRow key={dealer.id} className="hover:bg-accent/50">
                        <TableCell className="font-medium text-foreground">{dealer.name}</TableCell>
                        <TableCell className="text-muted-foreground">{dealer.contact_person}</TableCell>
                        <TableCell className="text-muted-foreground">{dealer.email}</TableCell>
                        <TableCell className="text-muted-foreground">{dealer.phone}</TableCell>
                        <TableCell className="text-muted-foreground">{dealer.address}</TableCell>
                        <TableCell className="text-muted-foreground">{dealer.city}</TableCell>
                        <TableCell className="text-muted-foreground">{dealer.state}</TableCell>
                        <TableCell className="text-muted-foreground">{dealer.country}</TableCell>
                        <TableCell className="text-muted-foreground">${dealer.credit_limit.toFixed(2)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleView(dealer.id)} title="View Dealer">
                              <Eye className="h-4 w-4" />
                            </Button>
                            {(isAdmin || user?.id === dealer.user_id) && ( // Only show edit/delete if admin or creator
                              <>
                                <Button variant="ghost" size="icon" onClick={() => handleEdit(dealer.id)} title="Edit Dealer">
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(dealer.id)} title="Delete Dealer">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
            <div className="mt-6 text-right">
              <Button onClick={() => navigate('/add-dealer')} className="bg-primary text-primary-foreground hover:bg-primary/90">
                Add New Dealer
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default ManageDealers;