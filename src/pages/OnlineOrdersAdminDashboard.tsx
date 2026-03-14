"use client";
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { Loader2, ArrowLeft, Printer, Upload, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface OnlineOrder {
  id: string;
  order_no: string;
  gatepass_no: string;
  client_name: string;
  platform_order_number: string;
  created_at: string;
  platform_name: string;
  raw_item_name: string;
}

const OnlineOrdersAdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, isAdmin } = useSession();
  const [orders, setOrders] = useState<OnlineOrder[]>([]);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [filterOrderNumber, setFilterOrderNumber] = useState('');
  const [filterDispatchNumber, setFilterDispatchNumber] = useState('');
  const [filterDate, setFilterDate] = useState('');

  useEffect(() => {
    if (!sessionLoading) {
      if (!user || !isAdmin) {
        navigate('/');
      } else {
        fetchOnlineOrders();
      }
    }
  }, [user, sessionLoading, isAdmin, navigate]);

  const fetchOnlineOrders = async () => {
    setLoading(true);
    try {
      // Fetch online orders with raw_item_name directly from online_order_details
      const { data, error } = await supabase
        .from('online_order_details')
        .select(`
          id,
          order_id,
          client_name,
          platform_order_number,
          created_at,
          raw_item_name,
          online_platforms!fk_online_order_details_platform_id (name),
          online_orders (order_number, dispatch_number)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mappedOrders = (data || []).map((order: any) => ({
        id: order.id,
        order_no: order.online_orders?.order_number?.toString() || '-',
        gatepass_no: order.online_orders?.dispatch_number?.toString() || '-',
        client_name: order.client_name,
        platform_order_number: order.platform_order_number,
        created_at: order.created_at,
        platform_name: order.online_platforms?.name || 'N/A',
        raw_item_name: order.raw_item_name,
      }));

      setOrders(mappedOrders);

      // Extract unique platforms and add hardcoded ones
      const uniquePlatforms = Array.from(new Set(mappedOrders.map(o => o.platform_name)));
      const hardcodedPlatforms = ['Meesho', 'Website'];
      const allPlatforms = Array.from(new Set([...uniquePlatforms, ...hardcodedPlatforms]));
      setPlatforms(allPlatforms);
      
      // Set selected platform to first platform if not already set
      if (!selectedPlatform && allPlatforms.length > 0) {
        setSelectedPlatform(allPlatforms[0]);
      }
    } catch (error: any) {
      console.error('Error fetching online orders:', error);
      showError('Failed to load online orders');
      setOrders([]);
      // Still set hardcoded platforms even if fetch fails
      const hardcodedPlatforms = ['Meesho', 'Website'];
      setPlatforms(hardcodedPlatforms);
      if (!selectedPlatform && hardcodedPlatforms.length > 0) {
        setSelectedPlatform(hardcodedPlatforms[0]);
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesPlatform = !selectedPlatform || order.platform_name === selectedPlatform;
      const matchesOrderNumber = !filterOrderNumber || 
        (order.platform_order_number?.toLowerCase().includes(filterOrderNumber.toLowerCase()));
      const matchesDispatchNumber = !filterDispatchNumber || 
        (order.id?.toLowerCase().includes(filterDispatchNumber.toLowerCase()));
      const matchesDate = !filterDate || 
        (new Date(order.created_at).toLocaleDateString() === new Date(filterDate).toLocaleDateString());
      
      return matchesPlatform && matchesOrderNumber && matchesDispatchNumber && matchesDate;
    });
  }, [orders, selectedPlatform, filterOrderNumber, filterDispatchNumber, filterDate]);

  const toggleSelectOrder = (orderId: string) => {
    const newSelected = new Set(selectedOrderIds);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrderIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedOrderIds.size === filteredOrders.length) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(filteredOrders.map(o => o.id)));
    }
  };

  const handlePrintSelected = async () => {
    if (selectedOrderIds.size === 0) {
      showError('Please select at least one order to print');
      return;
    }

    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const selectedOrders = filteredOrders.filter(o => selectedOrderIds.has(o.id));
      
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 10;
      let yPosition = margin;
      let isFirstPage = true;

      // Column configuration
      const headerCells = ['Order No', 'Gatepass No', 'Platform Order', 'Client', 'Item', 'Date'];
      const cellWidths = [22, 22, 35, 35, 155, 18]; // Full width landscape without Platform column
      const fixedRowHeight = 6.5; // Fixed height for single row

      // Function to draw table header
      const drawTableHeader = (startY: number) => {
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(8);
        (doc as any).setFont('helvetica', 'bold');
        
        let xPos = margin;
        headerCells.forEach((header, i) => {
          doc.setDrawColor(0);
          doc.rect(xPos, startY, cellWidths[i], 8);
          doc.text(header, xPos + 1, startY + 4, { maxWidth: cellWidths[i] - 2 });
          xPos += cellWidths[i];
        });
        
        return startY + 8;
      };

      // Draw blue header only on first page
      doc.setFillColor(0, 51, 102); // Dark blue
      doc.rect(margin, yPosition, pageWidth - 2 * margin, 16, 'F');
      
      doc.setTextColor(255, 255, 255); // White text
      doc.setFontSize(20);
      (doc as any).setFont('helvetica', 'bold');
      doc.text(`ONLINE ORDER - ${selectedPlatform}`, pageWidth / 2, yPosition + 11, { align: 'center' });
      
      yPosition += 20;

      // Draw first table header
      yPosition = drawTableHeader(yPosition);

      // Table rows
      (doc as any).setFont('helvetica', 'normal');
      doc.setFontSize(7);

      selectedOrders.forEach((order, index) => {
        // Check if we need a new page
        if (yPosition + fixedRowHeight > pageHeight - margin) {
          doc.addPage();
          yPosition = margin;
          // Draw table header on new page
          yPosition = drawTableHeader(yPosition);
        }

        let xPos = margin;
        const rowStartY = yPosition;

        // Order No
        doc.rect(xPos, rowStartY, cellWidths[0], fixedRowHeight);
        doc.text(order.order_no, xPos + 1, rowStartY + 3, { maxWidth: cellWidths[0] - 2 });
        xPos += cellWidths[0];

        // Gatepass No
        doc.rect(xPos, rowStartY, cellWidths[1], fixedRowHeight);
        doc.text(order.gatepass_no, xPos + 1, rowStartY + 3, { maxWidth: cellWidths[1] - 2 });
        xPos += cellWidths[1];

        // Platform Order No
        doc.rect(xPos, rowStartY, cellWidths[2], fixedRowHeight);
        doc.text(order.platform_order_number || '-', xPos + 1, rowStartY + 3, { maxWidth: cellWidths[2] - 2 });
        xPos += cellWidths[2];

        // Client
        doc.rect(xPos, rowStartY, cellWidths[3], fixedRowHeight);
        doc.text(order.client_name, xPos + 1, rowStartY + 3, { maxWidth: cellWidths[3] - 2 });
        xPos += cellWidths[3];

        // Item (single line, truncated)
        doc.rect(xPos, rowStartY, cellWidths[4], fixedRowHeight);
        doc.text(order.raw_item_name || '-', xPos + 1, rowStartY + 3, { maxWidth: cellWidths[4] - 2 });
        xPos += cellWidths[4];

        // Date
        doc.rect(xPos, rowStartY, cellWidths[5], fixedRowHeight);
        doc.text(new Date(order.created_at).toLocaleDateString(), xPos + 1, rowStartY + 3, { maxWidth: cellWidths[5] - 2 });

        yPosition = rowStartY + fixedRowHeight;
      });

      const sanitizedPlatform = selectedPlatform.replace(/\s+/g, '_').toLowerCase();
      doc.save(`online_orders_${sanitizedPlatform}.pdf`);
      showSuccess(`Printed ${selectedOrders.length} order(s) successfully`);
    } catch (error: any) {
      console.error('Print error:', error);
      showError('Failed to print orders');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-7xl mx-auto">
        <Button variant="ghost" onClick={() => navigate('/admin-dashboard')} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Admin Dashboard
        </Button>

        <Card className="shadow-xl border-0">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg">
            <CardTitle className="text-3xl">Online Orders Admin Dashboard</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Extract New Orders */}
            <div className="border-b pb-6 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg">
              <Label className="mb-4 block text-lg font-bold text-blue-900">📤 Upload & Extract Orders</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Button
                  onClick={() => navigate('/flipkart-extractor')}
                  className="flex flex-col items-center gap-2 h-auto py-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg"
                >
                  <FileText className="w-6 h-6" />
                  <span className="text-sm">Flipkart</span>
                </Button>
                <Button
                  onClick={() => navigate('/meesho-extractor')}
                  className="flex flex-col items-center gap-2 h-auto py-6 bg-pink-600 hover:bg-pink-700 text-white font-semibold shadow-lg"
                >
                  <FileText className="w-6 h-6" />
                  <span className="text-sm">Meesho</span>
                </Button>
                <Button
                  onClick={() => navigate('/amazon-extractor')}
                  className="flex flex-col items-center gap-2 h-auto py-6 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold shadow-lg"
                >
                  <FileText className="w-6 h-6" />
                  <span className="text-sm">Amazon</span>
                </Button>
                <Button
                  onClick={() => navigate('/spartan-extractor')}
                  className="flex flex-col items-center gap-2 h-auto py-6 bg-gray-700 hover:bg-gray-800 text-white font-semibold shadow-lg"
                >
                  <Upload className="w-6 h-6" />
                  <span className="text-sm">Spartan</span>
                </Button>
              </div>
            </div>

            {/* Platform Selection */}
            {platforms.length > 0 && (
              <div className="border-b pb-4 bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg">
                <Label className="mb-4 block text-lg font-bold text-purple-900">🛍️ Select Platform</Label>
                <div className="flex flex-wrap gap-3">
                  {platforms.map((platform) => {
                    const platformColors: Record<string, string> = {
                      'Flipkart': 'bg-blue-500 hover:bg-blue-600',
                      'Meesho': 'bg-pink-500 hover:bg-pink-600',
                      'Amazon': 'bg-yellow-500 hover:bg-yellow-600',
                      'Spartan': 'bg-gray-600 hover:bg-gray-700',
                    };
                    const color = platformColors[platform] || 'bg-indigo-500 hover:bg-indigo-600';
                    
                    return (
                      <Button
                        key={platform}
                        onClick={() => {
                          setSelectedPlatform(platform);
                          setSelectedOrderIds(new Set());
                        }}
                        className={`font-semibold text-white shadow-md transition-all ${
                          selectedPlatform === platform ? color : 'bg-gray-400 hover:bg-gray-500'
                        }`}
                      >
                        {platform}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg">
              <Label className="mb-4 block text-lg font-bold text-green-900">🔍 Search & Filter</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="filterOrderNumber">Search Order Number</Label>
                <Input
                  id="filterOrderNumber"
                  placeholder="Filter by order number"
                  value={filterOrderNumber}
                  onChange={(e) => setFilterOrderNumber(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="filterDispatchNumber">Search Dispatch No</Label>
                <Input
                  id="filterDispatchNumber"
                  placeholder="Filter by dispatch number"
                  value={filterDispatchNumber}
                  onChange={(e) => setFilterDispatchNumber(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="filterDate">Filter by Date</Label>
                <Input
                  id="filterDate"
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                />
              </div>
            </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 bg-gradient-to-r from-orange-50 to-red-50 p-4 rounded-lg">
              {selectedPlatform && (
                <div className="text-sm font-semibold flex items-center gap-2 text-gray-700">
                  <span className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-4 py-2 rounded-full font-bold">
                    📊 {selectedPlatform} • {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={handlePrintSelected} 
                disabled={selectedOrderIds.size === 0}
                className="gap-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold shadow-lg disabled:opacity-50"
              >
                <Printer className="h-4 w-4" />
                Print Selected ({selectedOrderIds.size})
              </Button>
            </div>

            {/* Table */}
            {loading ? (
              <div className="flex justify-center items-center py-16 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg">
                <div className="text-center">
                  <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mx-auto mb-4" />
                  <p className="text-lg font-semibold text-indigo-700">Loading orders...</p>
                </div>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-12 bg-gradient-to-br from-gray-50 to-blue-50 rounded-lg border-2 border-dashed border-gray-300">
                <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <p className="text-xl font-semibold text-gray-600">No online orders found</p>
                <p className="text-sm text-gray-500 mt-2">Upload and extract orders to see them here</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border-2 border-indigo-200">
                <Table>
                  <TableHeader className="bg-gradient-to-r from-indigo-600 to-purple-600">
                    <TableRow className="hover:bg-none">
                      <TableHead className="w-12 text-white font-bold">
                        <Checkbox
                          checked={selectedOrderIds.size === filteredOrders.length && filteredOrders.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="text-white font-bold">Order No</TableHead>
                      <TableHead className="text-white font-bold">Gatepass No</TableHead>
                      <TableHead className="text-white font-bold">Order Number</TableHead>
                      <TableHead className="text-white font-bold">Client Name</TableHead>
                      <TableHead className="text-white font-bold">Item</TableHead>
                      <TableHead className="text-white font-bold">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order, idx) => (
                      <TableRow key={order.id} className={idx % 2 === 0 ? 'bg-indigo-50 hover:bg-indigo-100' : 'bg-purple-50 hover:bg-purple-100'}>
                        <TableCell>
                          <Checkbox
                            checked={selectedOrderIds.has(order.id)}
                            onCheckedChange={() => toggleSelectOrder(order.id)}
                          />
                        </TableCell>
                        <TableCell>{order.order_no}</TableCell>
                        <TableCell>{order.gatepass_no}</TableCell>
                        <TableCell>{order.platform_order_number || '-'}</TableCell>
                        <TableCell>{order.client_name}</TableCell>
                        <TableCell>{order.raw_item_name || '-'}</TableCell>
                        <TableCell>{new Date(order.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OnlineOrdersAdminDashboard;
