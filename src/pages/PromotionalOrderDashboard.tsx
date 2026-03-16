"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, LogOut, Plus, Eye, Send, CheckCircle2, XCircle, Trash2, Link as LinkIcon, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { showError, showSuccess } from '@/utils/toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import PromotionalOrderForm from '@/components/PromotionalOrderForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface PromotionalOrder {
  id: string;
  order_number: number;
  order_date: string;
  material_out_type: 'returnable' | 'non_returnable';
  promotion_type: string;
  dealer_name: string;
  sales_person_name: string;
  total_amount: number;
  status: string;
  authorization_status?: string;
  auth_token?: string;
}

const PromotionalOrderDashboard = () => {
  const navigate = useNavigate();
  const { user, userType, loading: sessionLoading } = useSession();
  const [promotionalOrders, setPromotionalOrders] = useState<PromotionalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'pending' | 'approved' | 'all'>('pending');
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [selectedOrderForLink, setSelectedOrderForLink] = useState<PromotionalOrder | null>(null);

  useEffect(() => {
    if (!sessionLoading) {
      if (!user) {
        navigate('/login');
      } else if (userType !== 'manager' && userType !== 'super_admin' && userType !== 'hod' && userType !== 'sales_hod') {
        showError('Access Denied: Only HOD/Managers can access this page.');
        navigate('/');
      }
    }
  }, [sessionLoading, user, userType, navigate]);

  const fetchPromotionalOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('promotional_orders')
        .select(`
          id,
          order_number,
          order_date,
          material_out_type,
          promotion_type,
          total_amount,
          status,
          authorization_status,
          auth_token,
          dealers (name),
          sales_person:profiles!sales_person_id (first_name, last_name)
        `)
        .order('order_date', { ascending: false });

      if (error) throw error;

      const formatted = (data || []).map((order: any) => ({
        id: order.id,
        order_number: order.order_number,
        order_date: order.order_date,
        material_out_type: order.material_out_type,
        promotion_type: order.promotion_type,
        dealer_name: (order.dealers as any)?.name || 'N/A',
        sales_person_name: `${(order.sales_person as any)?.first_name || ''} ${(order.sales_person as any)?.last_name || ''}`.trim(),
        total_amount: order.total_amount,
        status: order.status,
        authorization_status: order.authorization_status,
        auth_token: order.auth_token,
      }));

      setPromotionalOrders(formatted);
    } catch (error: any) {
      showError(`Failed to load promotional orders: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPromotionalOrders();
  }, [fetchPromotionalOrders, refreshKey]);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error && error.message !== 'Auth session missing!') {
        showError(`Logout failed: ${error.message}.`);
      } else {
        showSuccess('Logged out successfully!');
      }
    } catch (error: any) {
      showError(`An unexpected error occurred during logout: ${error.message}.`);
    } finally {
      navigate('/');
    }
  };

  const handleOrderCreated = () => {
    setIsFormOpen(false);
    setRefreshKey(prev => prev + 1);
    showSuccess('Promotional order created successfully!');
  };

  const handleSendAuthorization = async (order: PromotionalOrder) => {
    if (!order.auth_token) {
      showError('This order does not have an authorization token');
      return;
    }

    try {
      // Generate authorization link
      const authLink = `${window.location.origin}/authorize-promotional/${order.auth_token}`;
      
      const whatsappMessage = `📋 *ORDER P${order.order_number}*

${order.promotion_type}
Party: ${order.dealer_name}
Amount: ₹${order.total_amount || 0}
Type: ${order.material_out_type === 'returnable' ? '↩️ Returnable' : '✓ Non-Returnable'}

🔗 *AUTHORIZE LINK:*
${authLink}`;

      // Copy to clipboard
      await navigator.clipboard.writeText(whatsappMessage);
      showSuccess('✅ Message copied to clipboard! Redirecting to WhatsApp...');

      // WhatsApp Web URL with phone number for testing (9815260205 with country code +91)
      const phoneNumber = '61408949488'; // Australia country code +61
      const encoded = encodeURIComponent(whatsappMessage);
      const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encoded}`;
      
      // Open WhatsApp Web with pre-filled message
      setTimeout(() => {
        window.open(whatsappUrl, '_blank');
      }, 500);
    } catch (error: any) {
      showError(`Failed to generate authorization: ${error.message}`);
    }
  };

  const handleDeleteOrder = async (order: PromotionalOrder) => {
    if (!window.confirm(`Are you sure you want to delete promotional order P${order.order_number}? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('promotional_orders')
        .delete()
        .eq('id', order.id);

      if (error) throw error;

      showSuccess(`Promotional order P${order.order_number} deleted successfully!`);
      setRefreshKey(prev => prev + 1);
    } catch (error: any) {
      showError(`Failed to delete order: ${error.message}`);
    }
  };

  const handleViewAuthLink = (order: PromotionalOrder) => {
    if (!order.auth_token) {
      showError('This order does not have an authorization token');
      return;
    }
    setSelectedOrderForLink(order);
    setIsLinkDialogOpen(true);
  };

  const handleCopyLink = async (order: PromotionalOrder) => {
    if (!order.auth_token) return;
    const authLink = `${window.location.origin}/authorize-promotional/${order.auth_token}`;
    try {
      await navigator.clipboard.writeText(authLink);
      showSuccess('Authorization link copied to clipboard!');
    } catch (error: any) {
      showError('Failed to copy link');
    }
  };

  const filteredOrders = promotionalOrders.filter(order => {
    if (selectedTab === 'pending') return order.status === 'pending';
    if (selectedTab === 'approved') return order.status === 'approved';
    return true;
  });

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading...</p>
      </div>
    );
  }

  if (userType !== 'manager' && userType !== 'super_admin' && userType !== 'hod' && userType !== 'sales_hod') {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-7xl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-primary">📦 Promotional Material Out</h1>
          <Button onClick={handleLogout} variant="outline" className="flex items-center gap-2">
            <LogOut className="h-4 w-4" /> Logout
          </Button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={selectedTab === 'pending' ? 'default' : 'outline'}
            onClick={() => setSelectedTab('pending')}
            className={selectedTab === 'pending' ? 'bg-yellow-600 hover:bg-yellow-700' : ''}
          >
            Pending ({promotionalOrders.filter(o => o.status === 'pending').length})
          </Button>
          <Button
            variant={selectedTab === 'approved' ? 'default' : 'outline'}
            onClick={() => setSelectedTab('approved')}
            className={selectedTab === 'approved' ? 'bg-green-600 hover:bg-green-700' : ''}
          >
            Approved ({promotionalOrders.filter(o => o.status === 'approved').length})
          </Button>
          <Button
            variant={selectedTab === 'all' ? 'default' : 'outline'}
            onClick={() => setSelectedTab('all')}
            className={selectedTab === 'all' ? 'bg-blue-600 hover:bg-blue-700' : ''}
          >
            All ({promotionalOrders.length})
          </Button>
          <Button
            onClick={() => setIsFormOpen(true)}
            className="ml-auto bg-purple-600 hover:bg-purple-700 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> New Order
          </Button>
        </div>

        {/* Promotional Order Form Modal */}
        {isFormOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white dark:bg-gray-900 border-b p-4 flex justify-between items-center">
                <h2 className="text-xl font-bold">Create Promotional Order</h2>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
              <div className="p-6">
                <PromotionalOrderForm onOrderCreated={handleOrderCreated} />
              </div>
            </div>
          </div>
        )}

        {/* Orders Table */}
        <Card className="bg-card text-card-foreground shadow-lg">
          <CardHeader className="bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-800 dark:to-pink-800 text-white rounded-t-lg p-4">
            <CardTitle>Promotional Orders</CardTitle>
            <CardDescription className="text-purple-100">
              Manage promotional material distribution and authorizations
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : filteredOrders.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No promotional orders found.</p>
            ) : (
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted">
                      <TableHead className="font-bold">Order #</TableHead>
                      <TableHead className="font-bold">Date</TableHead>
                      <TableHead className="font-bold">Party</TableHead>
                      <TableHead className="font-bold">Promotion</TableHead>
                      <TableHead className="font-bold">Material Type</TableHead>
                      <TableHead className="font-bold">Amount</TableHead>
                      <TableHead className="font-bold">Status</TableHead>
                      <TableHead className="text-center font-bold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow key={order.id} className="hover:bg-muted/50">
                        <TableCell className="font-bold">P{order.order_number}</TableCell>
                        <TableCell>{new Date(order.order_date).toLocaleDateString()}</TableCell>
                        <TableCell>{order.dealer_name}</TableCell>
                        <TableCell className="font-medium">{order.promotion_type}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            order.material_out_type === 'returnable'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          }`}>
                            {order.material_out_type === 'returnable' ? '↩️ Returnable' : '🚫 Non-Returnable'}
                          </span>
                        </TableCell>
                        <TableCell className="font-semibold">₹{order.total_amount.toFixed(2)}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            order.status === 'approved'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : order.status === 'rejected'
                              ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          }`}>
                            {order.status.toUpperCase()}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/promotional-orders/${order.id}`)}
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {order.status === 'pending' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleViewAuthLink(order)}
                                  title="View Authorization Link"
                                  className="text-blue-600 hover:text-blue-700"
                                >
                                  <LinkIcon className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleSendAuthorization(order)}
                                  title="Send Authorization Link"
                                  className="text-green-600 hover:text-green-700"
                                >
                                  <Send className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteOrder(order)}
                                  title="Delete Order"
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Authorization Link Dialog */}
      <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Authorization Link - Order P{selectedOrderForLink?.order_number}</DialogTitle>
            <DialogDescription>
              Share this link with the approver to authorize the promotional order
            </DialogDescription>
          </DialogHeader>

          {selectedOrderForLink && (
            <div className="space-y-6">
              {/* Order Info */}
              <div className="bg-muted p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Party</p>
                    <p className="font-semibold">{selectedOrderForLink.dealer_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Promotion Type</p>
                    <p className="font-semibold">{selectedOrderForLink.promotion_type}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Material Type</p>
                    <p className="font-semibold">
                      {selectedOrderForLink.material_out_type === 'returnable' ? '↩️ Returnable' : '✓ Non-Returnable'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Amount</p>
                    <p className="font-semibold text-green-600">₹{selectedOrderForLink.total_amount.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Authorization Link */}
              <div className="space-y-3">
                <label className="text-sm font-semibold">Authorization Link:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={`${window.location.origin}/authorize-promotional/${selectedOrderForLink.auth_token}`}
                    readOnly
                    className="flex-1 px-3 py-2 border rounded-md bg-muted text-sm font-mono"
                  />
                  <Button
                    onClick={() => handleCopyLink(selectedOrderForLink)}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Copy className="h-4 w-4" /> Copy
                  </Button>
                </div>
              </div>

              {/* QR Code Info */}
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  ℹ️ Share this link via WhatsApp, Email, or any other communication channel. The approver will be able to authorize or reject the order by clicking the link.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  onClick={() => handleCopyLink(selectedOrderForLink)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
                >
                  <Copy className="h-4 w-4" /> Copy & Close
                </Button>
                <Button
                  onClick={() => setIsLinkDialogOpen(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <MadeWithDyad />
    </div>
  );
};

export default PromotionalOrderDashboard;
