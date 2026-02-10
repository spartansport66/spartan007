"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Printer, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';

interface VisitReportData {
  id: string;
  sales_person_name: string;
  dealer_name: string;
  visit_time: string;
  photo_url: string | null;
  visit_status: string; // New field
  remarks: string | null; // New field
  next_visit_date: string | null; // New field
}

interface FilterOption {
  value: string;
  label: string;
}

interface SalesPersonVisitReportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SalesPersonVisitReportDialog: React.FC<SalesPersonVisitReportDialogProps> = ({ isOpen, onOpenChange }) => {
  const [visits, setVisits] = useState<VisitReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [allSalesPersons, setAllSalesPersons] = useState<FilterOption[]>([]);
  
  // Filter states
  const [filterSalesPersonId, setFilterSalesPersonId] = useState<string>('');
  const [filterFromDate, setFilterFromDate] = useState<string>('');
  const [filterToDate, setFilterToDate] = useState<string>('');

  const fetchVisitsAndSalesPersons = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch all sales persons for the filter dropdown
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('user_type', 'sales_person');
      
      if (profilesError) throw profilesError;
      setAllSalesPersons((profilesData || []).map(p => ({ value: p.id, label: `${p.first_name} ${p.last_name}` })));
      const salesPersonMap = new Map(profilesData.map(p => [p.id, `${p.first_name} ${p.last_name}`]));

      // 2. Build the query for visits
      let query = supabase
        .from('sales_person_visits')
        .select(`
          id,
          visit_time,
          photo_url,
          sales_person_id,
          visit_status,
          remarks,
          next_visit_date,
          dealers (name)
        `)
        .order('visit_time', { ascending: false });

      // Apply filters
      if (filterSalesPersonId) {
        query = query.eq('sales_person_id', filterSalesPersonId);
      }
      if (filterFromDate) {
        const startOfDay = `${filterFromDate}T00:00:00.000Z`;
        query = query.gte('visit_time', startOfDay);
      }
      if (filterToDate) {
        const endOfDay = `${filterToDate}T23:59:59.999Z`;
        query = query.lte('visit_time', endOfDay);
      }

      const { data: visitsData, error: visitsError } = await query;
      if (visitsError) throw visitsError;

      const formattedVisits: VisitReportData[] = (visitsData || []).map((visit: any) => ({
        id: visit.id,
        sales_person_name: salesPersonMap.get(visit.sales_person_id) || 'N/A',
        dealer_name: (visit.dealers as any)?.name || 'N/A',
        visit_time: visit.visit_time,
        photo_url: visit.photo_url,
        visit_status: visit.visit_status || 'Routine Visit',
        remarks: visit.remarks || null,
        next_visit_date: visit.next_visit_date || null,
      }));
      setVisits(formattedVisits);

    } catch (error: any) {
      console.error('Error fetching visits data:', error.message);
      showError('Failed to load visit report data.');
      setVisits([]);
    } finally {
      setLoading(false);
    }
  }, [filterSalesPersonId, filterFromDate, filterToDate]);

  useEffect(() => {
    if (isOpen) {
      fetchVisitsAndSalesPersons();
    }
  }, [isOpen, fetchVisitsAndSalesPersons]);

  const handleClearFilters = () => {
    setFilterSalesPersonId('');
    setFilterFromDate('');
    setFilterToDate('');
  };

  const handlePrint = () => {
    const doc = new jsPDF({
      orientation: 'landscape'
    });
    doc.setFontSize(18);
    doc.text("Sales Person Daily Visit Report", 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);

    const tableColumn = ["Sales Person", "Dealer Name", "Visit Time", "Status", "Remarks", "Next Visit Date", "Photo Link"];
    const tableRows = visits.map(visit => [
      visit.sales_person_name,
      visit.dealer_name,
      new Date(visit.visit_time).toLocaleString(),
      visit.visit_status,
      visit.remarks || 'N/A',
      visit.next_visit_date ? new Date(visit.next_visit_date).toLocaleDateString() : 'N/A',
      visit.photo_url ? 'View Photo' : 'N/A',
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 30,
      styles: {
        fontSize: 8
      },
      headStyles: {
        fillColor: [200, 200, 200],
        textColor: [0, 0, 0]
      },
      margin: { top: 25 },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 30 },
        2: { cellWidth: 30 },
        3: { cellWidth: 25 },
        4: { cellWidth: 40 },
        5: { cellWidth: 25 },
        6: { cellWidth: 20, halign: 'center' },
      }
    });

    doc.save('sales_person_visit_report.pdf');
    showSuccess('Visit report generated successfully!');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1200px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary">Sales Person Daily Visit Report</DialogTitle>
          <DialogDescription>
            View logged dealer visits, filtered by sales person and date range.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-card rounded-lg">
          <div className="flex-1 min-w-[180px]">
            <Label htmlFor="filterSalesPerson" className="text-foreground font-medium">Sales Person</Label>
            <Select value={filterSalesPersonId || "all"} onValueChange={(value) => setFilterSalesPersonId(value === "all" ? "" : value)}>
              <SelectTrigger id="filterSalesPerson" className="w-full">
                <SelectValue placeholder="All Sales Persons" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sales Persons</SelectItem>
                {allSalesPersons.map(sp => (
                  <SelectItem key={sp.value} value={sp.value}>{sp.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterFromDate" className="text-foreground font-medium">From Date</Label>
            <Input
              id="filterFromDate"
              type="date"
              value={filterFromDate}
              onChange={(e) => setFilterFromDate(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterToDate" className="text-foreground font-medium">To Date</Label>
            <Input
              id="filterToDate"
              type="date"
              value={filterToDate}
              onChange={(e) => setFilterToDate(e.target.value)}
              className="w-full"
            />
          </div>
          <Button onClick={fetchVisitsAndSalesPersons} className="flex items-center gap-2 bg-primary hover:bg-primary/90">
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
              <p className="ml-2 text-lg text-foreground">Loading visit data...</p>
            </div>
          ) : visits.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No visits found matching your criteria.</p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-muted">
                  <TableRow className="bg-muted hover:bg-muted/90">
                    <TableHead className="text-muted-foreground font-bold">Sales Person</TableHead>
                    <TableHead className="text-muted-foreground font-bold">Dealer Name</TableHead>
                    <TableHead className="text-muted-foreground font-bold">Visit Time</TableHead>
                    <TableHead className="text-muted-foreground font-bold">Status</TableHead>
                    <TableHead className="text-muted-foreground font-bold">Remarks</TableHead>
                    <TableHead className="text-muted-foreground font-bold">Next Visit Date</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-center">Photo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visits.map((visit) => (
                    <TableRow key={visit.id} className="hover:bg-accent/50">
                      <TableCell className="font-medium text-foreground">{visit.sales_person_name}</TableCell>
                      <TableCell className="text-foreground">{visit.dealer_name}</TableCell>
                      <TableCell className="text-foreground">{new Date(visit.visit_time).toLocaleString()}</TableCell>
                      <TableCell className="text-foreground">{visit.visit_status}</TableCell>
                      <TableCell className="text-foreground max-w-[200px] truncate" title={visit.remarks || ''}>{visit.remarks || 'N/A'}</TableCell>
                      <TableCell className="text-foreground">{visit.next_visit_date ? new Date(visit.next_visit_date).toLocaleDateString() : 'N/A'}</TableCell>
                      <TableCell className="text-center">
                        {visit.photo_url ? (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => window.open(visit.photo_url!, '_blank')}
                            title="View Photo"
                          >
                            <Eye className="h-4 w-4 text-blue-500" />
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handlePrint} disabled={visits.length === 0} className="border border-input hover:bg-accent hover:text-accent-foreground">
            <Printer className="mr-2 h-4 w-4" /> Print Report
          </Button>
          <Button onClick={() => onOpenChange(false)} className="bg-primary hover:bg-primary/90">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};