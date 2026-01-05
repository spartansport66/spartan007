"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, Printer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';

interface ProductionAlert {
  id: string;
  product_name: string;
  required_quantity: number;
  created_at: string;
  resolved: boolean;
  sales_person_name: string | null;
  dealer_name: string | null;
}

// Format date as dd/mm/yyyy
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const ProductionAlertsCard: React.FC = () => {
  const [alerts, setAlerts] = useState<ProductionAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      // First, let's fetch alerts without joins to see if that works
      const { data: alertsData, error: alertsError } = await supabase
        .from('production_alerts')
        .select(`
          id,
          product_id,
          required_quantity,
          created_at,
          resolved,
          created_by,
          dealer_id
        `)
        .eq('resolved', false)
        .order('created_at', { ascending: false });

      if (alertsError) {
        console.error('Error fetching alerts data:', alertsError.message);
        throw alertsError;
      }

      // If we successfully fetched alerts, now get product names
      const productIds = [...new Set(alertsData.map(alert => alert.product_id).filter(id => id))];
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name')
        .in('id', productIds);

      if (productsError) {
        console.error('Error fetching products data:', productsError.message);
        throw productsError;
      }

      // Get salesperson names if created_by exists
      const salesPersonIds = [...new Set(alertsData.map(alert => alert.created_by).filter(id => id))];
      let salesPersonsData: any[] = [];
      if (salesPersonIds.length > 0) {
        const { data, error: salesPersonsError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', salesPersonIds);

        if (salesPersonsError) {
          console.error('Error fetching sales persons data:', salesPersonsError.message);
          // We won't throw here as this is supplementary data
        } else {
          salesPersonsData = data || [];
        }
      }

      // Get dealer names if dealer_id exists
      const dealerIds = [...new Set(alertsData.map(alert => alert.dealer_id).filter(id => id))];
      let dealersData: any[] = [];
      if (dealerIds.length > 0) {
        const { data, error: dealersError } = await supabase
          .from('dealers')
          .select('id, name')
          .in('id', dealerIds);

        if (dealersError) {
          console.error('Error fetching dealers data:', dealersError.message);
          // We won't throw here as this is supplementary data
        } else {
          dealersData = data || [];
        }
      }

      // Create maps for quick lookups
      const productMap = new Map(productsData?.map(p => [p.id, p.name]) || []);
      const salesPersonMap = new Map(salesPersonsData?.map(sp => [sp.id, `${sp.first_name || ''} ${sp.last_name || ''}`.trim()]) || []);
      const dealerMap = new Map(dealersData?.map(d => [d.id, d.name]) || []);

      // Format the alerts with all the information
      const formattedAlerts: ProductionAlert[] = (alertsData || []).map((alert: any) => ({
        id: alert.id,
        product_name: productMap.get(alert.product_id) || 'Unknown Product',
        required_quantity: alert.required_quantity,
        created_at: alert.created_at,
        resolved: alert.resolved,
        sales_person_name: alert.created_by ? (salesPersonMap.get(alert.created_by) || 'Unknown Salesperson') : 'Not specified',
        dealer_name: alert.dealer_id ? (dealerMap.get(alert.dealer_id) || 'Unknown Dealer') : 'Not specified',
      }));

      setAlerts(formattedAlerts);
    } catch (error: any) {
      console.error('Error fetching production alerts:', error.message);
      showError('Failed to load production alerts.');
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();

    // Subscribe to changes in the production_alerts table
    const channel = supabase
      .channel('production_alerts_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'production_alerts',
        },
        (payload) => {
          console.log('New production alert received!', payload);
          fetchAlerts(); // Refetch alerts on new alert
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'production_alerts',
        },
        (payload) => {
          console.log('Production alert updated!', payload);
          fetchAlerts(); // Refetch alerts on update
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAlerts]);

  const handlePrint = () => {
    try {
      const doc = new jsPDF({
        orientation: 'landscape' // Use landscape for more columns
      });

      doc.setFontSize(18);
      doc.text("Production Alerts Report", 14, 22);
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

      const tableColumn = ["Product Name", "Required Quantity", "Requested By", "For Dealer", "Alerted At"];
      const tableRows = alerts.map(alert => [
        alert.product_name,
        alert.required_quantity.toString(),
        alert.sales_person_name || 'Not specified',
        alert.dealer_name || 'Not specified',
        formatDate(alert.created_at),
      ]);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 40,
        styles: {
          fontSize: 8
        },
        headStyles: {
          fillColor: [249, 115, 22], // Orange color to match the card header
          textColor: [255, 255, 255]
        },
        margin: {
          top: 25,
          left: 10,
          right: 10
        },
        columnStyles: {
          0: { cellWidth: 40 }, // Product Name
          1: { cellWidth: 30, halign: 'right' }, // Required Quantity
          2: { cellWidth: 40 }, // Requested By
          3: { cellWidth: 40 }, // For Dealer
          4: { cellWidth: 40 }, // Alerted At
        }
      });

      doc.save('production_alerts_report.pdf');
      showSuccess('Production alerts report generated successfully!');
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      showError(`Failed to generate production alerts report: ${error.message || 'An unknown error occurred.'}`);
    }
  };

  if (loading) {
    return (
      <Card className="bg-card text-card-foreground shadow-lg h-full">
        <CardHeader className="bg-orange-500 dark:bg-orange-700 text-white rounded-t-lg p-4">
          <CardTitle className="text-xl font-semibold">Production Alerts</CardTitle>
          <CardDescription className="text-orange-100 dark:text-orange-200">
            Urgent material requirements from sales orders.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading alerts...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card text-card-foreground shadow-lg h-full">
      <CardHeader className="bg-orange-500 dark:bg-orange-700 text-white rounded-t-lg p-4">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-xl font-semibold">Production Alerts</CardTitle>
            <CardDescription className="text-orange-100 dark:text-orange-200">
              Urgent material requirements from sales orders. ({alerts.length} pending)
            </CardDescription>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handlePrint}
            disabled={alerts.length === 0}
            className="flex items-center gap-1"
          >
            <Printer className="h-4 w-4" /> Print
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="overflow-x-auto">
          {alerts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No active production alerts. All material requirements are met.</p>
          ) : (
            <div className="max-h-[250px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow className="bg-muted hover:bg-muted/90">
                    <TableHead className="text-muted-foreground">Product</TableHead>
                    <TableHead className="text-muted-foreground text-right">Required Quantity</TableHead>
                    <TableHead className="text-muted-foreground">Requested By</TableHead>
                    <TableHead className="text-muted-foreground">For Dealer</TableHead>
                    <TableHead className="text-muted-foreground">Alerted At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alerts.map((alert) => (
                    <TableRow key={alert.id} className="hover:bg-accent/50">
                      <TableCell className="font-medium text-foreground">{alert.product_name}</TableCell>
                      <TableCell className="text-muted-foreground text-right">{alert.required_quantity}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {alert.sales_person_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {alert.dealer_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(alert.created_at)}
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
  );
};

export default ProductionAlertsCard;