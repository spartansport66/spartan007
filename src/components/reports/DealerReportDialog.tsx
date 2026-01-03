"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Printer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';

interface DealerReportData {
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
  assigned_sales_persons: string; // Comma-separated names
}

interface DealerReportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const DealerReportDialog: React.FC<DealerReportDialogProps> = ({ isOpen, onOpenChange }) => {
  const [dealers, setDealers] = useState<DealerReportData[]>([]);
  const [loading, setLoading] = useState(true);
  // Filter states
  const [filterDealerName, setFilterDealerName] = useState<string>('');
  const [filterCity, setFilterCity] = useState<string>('');
  const [filterState, setFilterState] = useState<string>('');
  const [filterCountry, setFilterCountry] = useState<string>('');

  const fetchDealers = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('dealers')
        .select(`
          id, name, contact_person, email, phone, address, city, state, country, credit_limit,
          dealer_sales_persons (profiles (first_name, last_name))
        `)
        .order('name', { ascending: true });

      // Apply filters
      if (filterDealerName) {
        query = query.ilike('name', `%${filterDealerName}%`);
      }
      if (filterCity) {
        query = query.ilike('city', `%${filterCity}%`);
      }
      if (filterState) {
        query = query.ilike('state', `%${filterState}%`);
      }
      if (filterCountry) {
        query = query.ilike('country', `%${filterCountry}%`);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching dealers for report:', error.message);
        showError('Failed to load dealer data.');
        setDealers([]);
      } else {
        const formattedDealers: DealerReportData[] = (data || []).map((d: any) => ({
          id: d.id,
          name: d.name,
          contact_person: d.contact_person,
          email: d.email,
          phone: d.phone,
          address: d.address,
          city: d.city,
          state: d.state,
          country: d.country,
          credit_limit: d.credit_limit,
          assigned_sales_persons: d.dealer_sales_persons
            .map((dsp: any) => `${dsp.profiles.first_name} ${dsp.profiles.last_name}`)
            .join(', ') || 'N/A',
        }));
        setDealers(formattedDealers);
      }
    } catch (error: any) {
      console.error('Error in fetchDealers:', error.message);
      showError('An unexpected error occurred while fetching dealer data.');
    } finally {
      setLoading(false);
    }
  }, [filterDealerName, filterCity, filterState, filterCountry]);

  useEffect(() => {
    if (isOpen) {
      fetchDealers();
    }
  }, [isOpen, fetchDealers]);

  const handleClearFilters = () => {
    setFilterDealerName('');
    setFilterCity('');
    setFilterState('');
    setFilterCountry('');
  };

  const handlePrint = () => {
    const doc = new jsPDF({
      orientation: 'landscape'
    });
    doc.setFontSize(18);
    doc.text("Dealer Report", 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);

    const tableColumn = [
      "Name", "Contact Person", "Email", "Phone", "Address", "City", "State", "Country", "Credit Limit", "Assigned Sales Persons"
    ];
    const tableRows = dealers.map(dealer => [
      dealer.name,
      dealer.contact_person,
      dealer.email,
      dealer.phone,
      dealer.address,
      dealer.city,
      dealer.state,
      dealer.country,
      `₹${dealer.credit_limit.toFixed(2)}`,
      dealer.assigned_sales_persons,
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 30,
      styles: {
        fontSize: 7
      },
      headStyles: {
        fillColor: [200, 200, 200],
        textColor: [0, 0, 0]
      },
      margin: { top: 25, left: 10, right: 10 },
      columnStyles: {
        0: { cellWidth: 25 },  // Name
        1: { cellWidth: 25 },  // Contact Person
        2: { cellWidth: 35 },  // Email
        3: { cellWidth: 25 },  // Phone
        4: { cellWidth: 35 },  // Address
        5: { cellWidth: 20 },  // City
        6: { cellWidth: 20 },  // State
        7: { cellWidth: 20 },  // Country
        8: { cellWidth: 25 },  // Credit Limit
        9: { cellWidth: 40 },  // Assigned Sales Persons
      }
    });

    doc.save('dealer_report.pdf');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1200px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dealer Report</DialogTitle>
          <DialogDescription>
            Generate a comprehensive report of all registered dealers.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterDealerName">Dealer Name</Label>
            <Input
              id="filterDealerName"
              placeholder="Filter by name"
              value={filterDealerName}
              onChange={(e) => setFilterDealerName(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex-1 min-w-[100px]">
            <Label htmlFor="filterCity">City</Label>
            <Input
              id="filterCity"
              placeholder="Filter by city"
              value={filterCity}
              onChange={(e) => setFilterCity(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex-1 min-w-[100px]">
            <Label htmlFor="filterState">State</Label>
            <Input
              id="filterState"
              placeholder="Filter by state"
              value={filterState}
              onChange={(e) => setFilterState(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex-1 min-w-[100px]">
            <Label htmlFor="filterCountry">Country</Label>
            <Input
              id="filterCountry"
              placeholder="Filter by country"
              value={filterCountry}
              onChange={(e) => setFilterCountry(e.target.value)}
              className="w-full"
            />
          </div>
          <Button onClick={fetchDealers} className="flex items-center gap-2">
            <Search className="h-4 w-4" /> Apply Filters
          </Button>
          <Button variant="outline" onClick={handleClearFilters} className="flex items-center gap-2">
            Clear Filters
          </Button>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading dealer data...</p>
            </div>
          ) : dealers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No dealers found matching your criteria.</p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow className="bg-muted hover:bg-muted/90">
                    <TableHead className="text-muted-foreground">Name</TableHead>
                    <TableHead className="text-muted-foreground">Contact Person</TableHead>
                    <TableHead className="text-muted-foreground">Email</TableHead>
                    <TableHead className="text-muted-foreground">Phone</TableHead>
                    <TableHead className="text-muted-foreground">Address</TableHead>
                    <TableHead className="text-muted-foreground">City</TableHead>
                    <TableHead className="text-muted-foreground">State</TableHead>
                    <TableHead className="text-muted-foreground">Country</TableHead>
                    <TableHead className="text-muted-foreground text-right">Credit Limit</TableHead>
                    <TableHead className="text-muted-foreground">Assigned Sales Persons</TableHead>
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
                      <TableCell className="text-muted-foreground text-right">₹{dealer.credit_limit.toFixed(2)}</TableCell>
                      <TableCell className="text-muted-foreground">{dealer.assigned_sales_persons}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handlePrint} disabled={dealers.length === 0}>
            <Printer className="mr-2 h-4 w-4" /> Print Report
          </Button>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DealerReportDialog;