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
}

const ProductionAlertsCard: React.FC = () => {
  const [alerts, setAlerts] = useState<ProductionAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('production_alerts')
        .select(`
          id,
          required_quantity,
          created_at,
          resolved,
          products (name)
        `)
        .eq('resolved', false) // Only fetch unresolved alerts
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedAlerts: ProductionAlert[] = (data || []).map((alert: any) => ({
        id: alert.id,
        product_name: alert.products?.name || 'Unknown Product',
        required_quantity: alert.required_quantity,
        created_at: alert.created_at,
        resolved: alert.resolved,
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
        orientation: 'portrait'
      });
      
      doc.setFontSize(18);
      doc.text("Production Alerts Report", 14, 22);
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

      const tableColumn = ["Product Name", "Required Quantity", "Alerted At"];
      const tableRows = alerts.map(alert => [
        alert.product_name,
        alert.required_quantity.toString(),
        new Date(alert.created_at).toLocaleString(),
      ]);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 40,
        styles: {
          fontSize: 10
        },
        headStyles: {
          fillColor: [249, 115, 22], // Orange color to match the card header
          textColor: [255, 255, 255]
        },
        margin: { top: 25, left: 10, right: 10 },
        columnStyles: {
          0: { cellWidth: 'auto' }, // Product Name
          1: { cellWidth: 40, halign: 'right' }, // Required Quantity
          2: { cellWidth: 'auto' }, // Alerted At
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
                    <TableHead className="text-muted-foreground">Alerted At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alerts.map((alert) => (
                    <TableRow key={alert.id} className="hover:bg-accent/50">
                      <TableCell className="font-medium text-foreground">{alert.product_name}</TableCell>
                      <TableCell className="text-muted-foreground text-right">{alert.required_quantity}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(alert.created_at).toLocaleString()}
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