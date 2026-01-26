"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Printer, AlertTriangle, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import { getEndOfUTCDayISO } from '@/utils/date';

interface FollowupReportData {
  id: string;
  sales_person_name: string;
  dealer_name: string;
  next_visit_date: string; // YYYY-MM-DD
  last_visit_time: string; // ISO string
  visit_status: string;
  remarks: string | null;
  isOverdue: boolean;
}

interface FilterOption {
  value: string;
  label: string;
}

interface SalesPersonTodayFollowupsReportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const SalesPersonTodayFollowupsReportDialog: React.FC<SalesPersonTodayFollowupsReportDialogProps> = ({ isOpen, onOpenChange }) => {
  const [followups, setFollowups] = useState<FollowupReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [allSalesPersons, setAllSalesPersons] = useState<FilterOption[]>([]);
  
  // Filter states
  const [filterSalesPersonId, setFilterSalesPersonId] = useState<string>('');

  const fetchFollowupsAndSalesPersons = useCallback(async () => {
    setLoading(true);
    try {
      const endOfTodayISO = getEndOfUTCDayISO();
      const today = new Date(endOfTodayISO);
      today.setUTCHours(0, 0, 0, 0);

      // 1. Fetch all sales persons for the filter dropdown
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('user_type', 'sales_person');
      
      if (profilesError) throw profilesError;
      setAllSalesPersons((profilesData || []).map(p => ({ value: p.id, label: `${p.first_name} ${p.last_name}` })));
      const salesPersonMap = new Map(profilesData.map(p => [p.id, `${p.first_name} ${p.last_name}`]));

      // 2. Fetch all visits that have a next_visit_date <= today
      let query = supabase
        .from('sales_person_visits')
        .select(`
          id,
          sales_person_id,
          dealers (name),
          visit_time,
          next_visit_date,
          visit_status,
          remarks
        `)
        .not('next_visit_date', 'is', null) // Only consider visits that set a follow-up date
        .lte('next_visit_date', endOfTodayISO) // Follow-up date is today or earlier
        .order('next_visit_date', { ascending: true });

      // Apply sales person filter
      if (filterSalesPersonId) {
        query = query.eq('sales_person_id', filterSalesPersonId);
      }

      const { data: visitsData, error: visitsError } = await query;
      if (visitsError) throw visitsError;

      // 3. Process data to get the LATEST relevant follow-up for each dealer/salesperson pair
      const latestFollowupsMap = new Map<string, any>(); // Key: sales_person_id-dealer_id

      for (const visit of visitsData || []) {
        const key = `${visit.sales_person_id}-${visit.dealers?.name}`;
        
        // Since we ordered by visit_time descending in the main query (if we had one), 
        // we need to ensure we only keep the latest visit that set the follow-up date.
        // However, since we are filtering by next_visit_date <= today, we need to find the latest visit
        // that *set* a follow-up date that is due today or earlier.
        
        // A simpler approach: Group by dealer/salesperson and find the latest visit time.
        // Since the query is already filtered by next_visit_date <= today, we just need to ensure
        // we don't duplicate entries if multiple visits set the same follow-up date.
        
        // Let's re-fetch the latest visit for each dealer that has a follow-up due today or earlier.
        // This is complex due to the nature of the data (visits are logged, but follow-up is a date).
        
        // For simplicity and correctness: We assume the query above returns all visits where the follow-up date is due.
        // We need to group by dealer and only show the entry corresponding to the *latest* visit time
        // that resulted in a follow-up date <= today.
        
        const currentVisitTime = new Date(visit.visit_time).getTime();
        const existing = latestFollowupsMap.get(key);

        if (!existing || currentVisitTime > new Date(existing.visit_time).getTime()) {
            latestFollowupsMap.set(key, visit);
        }
      }
      
      const formattedFollowups: FollowupReportData[] = Array.from(latestFollowupsMap.values()).map((visit: any) => {
        const nextVisitDate = visit.next_visit_date;
        const followupDate = new Date(nextVisitDate);
        followupDate.setUTCHours(0, 0, 0, 0);
        const isOverdue = followupDate < today;

        return {
          id: visit.id,
          sales_person_name: salesPersonMap.get(visit.sales_person_id) || 'N/A',
          dealer_name: visit.dealers?.name || 'N/A',
          visit_time: visit.visit_time,
          next_visit_date: nextVisitDate,
          visit_status: visit.visit_status || 'N/A',
          remarks: visit.remarks,
          isOverdue: isOverdue,
        };
      });

      // Sort: Overdue first, then by follow-up date ascending
      formattedFollowups.sort((a, b) => {
        if (a.isOverdue !== b.isOverdue) {
          return a.isOverdue ? -1 : 1;
        }
        return new Date(a.next_visit_date).getTime() - new Date(b.next_visit_date).getTime();
      });

      setFollowups(formattedFollowups);

    } catch (error: any) {
      console.error('Error fetching today\'s follow-ups:', error.message);
      showError('Failed to load today\'s follow-up report data.');
      setFollowups([]);
    } finally {
      setLoading(false);
    }
  }, [filterSalesPersonId]);

  useEffect(() => {
    if (isOpen) {
      fetchFollowupsAndSalesPersons();
    }
  }, [isOpen, fetchFollowupsAndSalesPersons]);

  const handleClearFilters = () => {
    setFilterSalesPersonId('');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handlePrint = () => {
    const doc = new jsPDF({
      orientation: 'landscape'
    });
    doc.setFontSize(18);
    doc.text("Today's Dealer Follow-up Report", 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);

    let filterDetails = [];
    if (filterSalesPersonId) {
        const salesPersonLabel = allSalesPersons.find(sp => sp.value === filterSalesPersonId)?.label;
        if (salesPersonLabel) filterDetails.push(`Sales Person: ${salesPersonLabel}`);
    }
    filterDetails.push(`Due Date: Today or Earlier`);

    if (filterDetails.length > 0) {
        doc.setFontSize(9);
        doc.text(`Filters: ${filterDetails.join(' | ')}`, doc.internal.pageSize.width / 2, 30, { align: 'center' });
    }
    
    const tableColumn = ["Sales Person", "Dealer Name", "Follow-up Date", "Status", "Last Visit Remarks", "Last Visit Time"];
    const tableRows = followups.map(visit => [
      visit.sales_person_name,
      visit.dealer_name,
      formatDate(visit.next_visit_date),
      visit.visit_status,
      visit.remarks || 'N/A',
      new Date(visit.visit_time).toLocaleString(),
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      styles: {
        fontSize: 8
      },
      headStyles: {
        fillColor: [249, 115, 22], // Orange color
        textColor: [255, 255, 255]
      },
      margin: { top: 25 },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 30 },
        2: { cellWidth: 25, halign: 'center' },
        3: { cellWidth: 25 },
        4: { cellWidth: 60 },
        5: { cellWidth: 30 },
      }
    });

    doc.save('todays_followup_report.pdf');
    showSuccess('Today\'s Follow-up report generated successfully!');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1000px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-orange-600">Today's Dealer Follow-ups</DialogTitle>
          <DialogDescription>
            View all dealer follow-ups that are due today or are currently overdue.
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
          
          <Button onClick={fetchFollowupsAndSalesPersons} className="flex items-center gap-2 bg-primary hover:bg-primary/90">
            <Search className="h-4 w-4" /> Apply Filter
          </Button>
          <Button variant="outline" onClick={handleClearFilters} className="flex items-center gap-2">
            Clear Filter
          </Button>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-lg text-foreground">Loading follow-up data...</p>
            </div>
          ) : followups.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No follow-ups due today or earlier found.</p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-muted">
                  <TableRow className="bg-muted hover:bg-muted/90">
                    <TableHead className="text-muted-foreground font-bold">Status</TableHead>
                    <TableHead className="text-muted-foreground font-bold">Sales Person</TableHead>
                    <TableHead className="text-muted-foreground font-bold">Dealer Name</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-center">Follow-up Date</TableHead>
                    <TableHead className="text-muted-foreground font-bold">Last Visit Status</TableHead>
                    <TableHead className="text-muted-foreground font-bold">Last Visit Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {followups.map((visit) => (
                    <TableRow key={visit.id} className={visit.isOverdue ? "bg-red-50/50 hover:bg-red-100/50" : "hover:bg-accent/50"}>
                      <TableCell className="font-medium text-foreground">
                        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold w-fit ${visit.isOverdue ? 'text-red-600 bg-red-100' : 'text-orange-600 bg-orange-100'}`}>
                            {visit.isOverdue ? <AlertTriangle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                            {visit.isOverdue ? 'Overdue' : 'Due Today'}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-foreground">{visit.sales_person_name}</TableCell>
                      <TableCell className="text-foreground">{visit.dealer_name}</TableCell>
                      <TableCell className="text-center text-foreground font-semibold">
                        {formatDate(visit.next_visit_date)}
                      </TableCell>
                      <TableCell className="text-foreground">{visit.visit_status}</TableCell>
                      <TableCell className="text-foreground max-w-[200px] truncate" title={visit.remarks || ''}>{visit.remarks || 'N/A'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handlePrint} disabled={followups.length === 0} className="border border-input hover:bg-accent hover:text-accent-foreground">
            <Printer className="mr-2 h-4 w-4" /> Print Report
          </Button>
          <Button onClick={() => onOpenChange(false)} className="bg-primary hover:bg-primary/90">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SalesPersonTodayFollowupsReportDialog;