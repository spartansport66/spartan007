"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft, ShoppingCart, PlusCircle, Factory, Building, Package, Eye, Boxes } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { showError } from '@/utils/toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import PurchaseOrderForm from '@/components/PurchaseOrderForm';
import RawMaterialForm from '@/components/RawMaterialForm';
import SupplierForm from '@/components/SupplierForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface PurchaseOrder {
  id: string;
  po_number: number;
  order_date: string;
  expected_delivery_date: string | null;
  status: string;
  total_amount: number;
  supplier_name: string;
}

const PurchaseDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, userType } = useSession();
  const [loadingData, setLoadingData] = useState(true);
  const [recentPOs, setRecentPOs] = useState<PurchaseOrder[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [dialogTab, setDialogTab] = useState<'material' | 'supplier'>('material');
  const [refreshKey, setRefreshKey] = useState(0);

  const isAuthorized = userType === 'admin' || userType === 'manager' || userType === 'inventory_manager';

  const fetchRecentPOs = useCallback(async () => {
    setLoadingData(true);
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          id, po_number, order_date, expected_delivery_date, status, total_amount,
          suppliers (name)
        `)
        .order('order_date', { ascending: false })
        .limit(10);

      if (error) throw error;

      const formattedPOs: PurchaseOrder[] = (data || []).map((po: any) => ({
        id: po.id,
        po_number: po.po_number,
        order_date: po.order_date,
        expected_delivery_date: po.expected_delivery_date,
        status: po.status,
        total_amount: po.total_amount,
        supplier_name: po.suppliers?.name || 'N/A',
      }));
      setRecentPOs(formattedPOs);
    } catch (error: any) {
      console.error('Error fetching recent POs:', error.message);
      showError(`Failed to load recent purchase orders: ${error.message}`);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading) {
      if (!user) {
        navigate('/login');
      } else if (!isAuthorized) {
        showError('Access Denied: You do not have permission to view this page.');
        navigate('/');
      } else {
        fetchRecentPOs();
      }
    }
  }, [sessionLoading, user, isAuthorized, navigate, fetchRecentPOs, refreshKey]);

  const handleOrderPlaced = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleMaterialOrSupplierAdded = () => {
    setRefreshKey(prev => prev + 1);
    setIsAddDialogOpen(false);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  if (sessionLoading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading purchase dashboard...</p>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-6xl">
        <Button 
          variant="outline" 
          onClick={() => navigate(userType === 'admin' ? '/admin-dashboard' : '/manager-dashboard')} 
          className="mb-6 flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
        
        <h1 className="text-3xl sm:text-4xl font-bold text-primary mb-6 flex items-center gap-3">
          <Factory className="h-8 w-8" /> Raw Material Purchase Dashboard
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Card 1: Create PO */}
          <div className="lg:col-span-2">
            <PurchaseOrderForm onOrderPlaced={handleOrderPlaced} key={`po-form-${refreshKey}`} />
          </div>

          {/* Card 2: Quick Actions */}
          <Card className="bg-card text-card-foreground shadow-lg h-full">
            <CardHeader className="bg-indigo-500 dark:bg-indigo-700 text-white rounded-t-lg p-4">
              <CardTitle className="text-xl font-semibold">Quick Setup</CardTitle>
              <CardDescription className="text-indigo-100 dark:text-indigo-200">
                Add new materials or suppliers.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <Button 
                onClick={() => { setDialogTab('material'); setIsAddDialogOpen(true); }} 
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                <Package className="h-4 w-4 mr-2" /> Add Raw Material
              </Button>
              <Button 
                onClick={() => { setDialogTab('supplier'); setIsAddDialogOpen(true); }} 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Building className="h-4 w-4 mr-2" /> Add Supplier
              </Button>
              <Button 
                onClick={() => navigate('/inventory-management')} 
                variant="outline"
                className="w-full flex items-center gap-2"
              >
                <Boxes className="h-4 w-4" /> Manage Inventory (WIP)
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Recent Purchase Orders Table */}
        <Card className="bg-card text-card-foreground shadow-lg">
          <CardHeader className="bg-teal-500 dark:bg-teal-700 text-white rounded-t-lg p-4">
            <CardTitle className="text-xl font-semibold">Recent Purchase Orders</CardTitle>
            <CardDescription className="text-teal-100 dark:text-teal-200">
              Last 10 purchase orders placed.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <div className="overflow-x-auto">
              {loadingData ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading orders...</p>
                </div>
              ) : recentPOs.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No purchase orders found.</p>
              ) : (
                <div className="max-h-[400px] overflow-y-auto border rounded-md">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow className="bg-muted hover:bg-muted/90">
                        <TableHead className="text-muted-foreground">PO No.</TableHead>
                        <TableHead className="text-muted-foreground">Supplier</TableHead>
                        <TableHead className="text-muted-foreground">Order Date</TableHead>
                        <TableHead className="text-muted-foreground">Delivery Date</TableHead>
                        <TableHead className="text-muted-foreground">Status</TableHead>
                        <TableHead className="text-muted-foreground text-right">Total Amount</TableHead>
                        <TableHead className="text-muted-foreground text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentPOs.map((po) => (
                        <TableRow key={po.id} className="hover:bg-accent/50">
                          <TableCell className="font-medium text-foreground">#{po.po_number}</TableCell>
                          <TableCell className="text-muted-foreground">{po.supplier_name}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(po.order_date)}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(po.expected_delivery_date)}</TableCell>
                          <TableCell className="text-muted-foreground capitalize">{po.status}</TableCell>
                          <TableCell className="text-muted-foreground text-right">₹{po.total_amount.toFixed(2)}</TableCell>
                          <TableCell className="text-center">
                            <Button variant="ghost" size="icon" title="View Details" disabled>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <MadeWithDyad />

      {/* Add Material/Supplier Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>
              {dialogTab === 'material' ? 'Add New Raw Material' : 'Add New Supplier'}
            </DialogTitle>
          </DialogHeader>
          <Tabs value={dialogTab} onValueChange={(value) => setDialogTab(value as 'material' | 'supplier')} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="material">Raw Material</TabsTrigger>
              <TabsTrigger value="supplier">Supplier</TabsTrigger>
            </TabsList>
            <TabsContent value="material" className="mt-4">
              <RawMaterialForm onMaterialAdded={handleMaterialOrSupplierAdded} />
            </TabsContent>
            <TabsContent value="supplier" className="mt-4">
              <SupplierForm onSupplierAdded={handleMaterialOrSupplierAdded} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PurchaseDashboard;