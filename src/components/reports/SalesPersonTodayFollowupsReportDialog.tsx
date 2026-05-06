"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Printer, AlertTriangle, Clock, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';

interface FollowupReportData {
  id: string;
  sales_person_name: string;
  dealer_name: string;
  next_visit_date: string | null; // YYYY-MM-DD or null
  visit_time: string; // ISO string
  visit_status: string;
  remarks: string | null;
  photo_url: string | null;
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
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const fetchFollowupsAndSalesPersons = useCallback(async () => {
    setLoading(true);
    try {
      const defaultTodayDateString = new Date().toISOString().split('T')[0];
      const todayDateString = filterDate || defaultTodayDateString;
      const today = new Date(todayDateString);
      today.setUTCHours(0, 0, 0, 0);

      // 1. Fetch all sales persons for the filter dropdown
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('user_type', 'sales_person');
      
      if (profilesError) throw profilesError;
      const formatProfileName = (profile: any) => {
        const parts = [profile?.first_name, profile?.last_name].filter((part) => part && part.toString().trim());
        return parts.join(' ') || 'Unknown Salesperson';
      };
      setAllSalesPersons((profilesData || []).map(p => ({ value: p.id, label: formatProfileName(p) })));
      const salesPersonMap = new Map(profilesData.map(p => [p.id, formatProfileName(p)]));

      const startOfSelectedDate = `${todayDateString}T00:00:00.000Z`;
      const endOfSelectedDate = `${todayDateString}T23:59:59.999Z`;

      // 2. Fetch visits logged for the selected date
      let query = supabase
        .from('sales_person_visits')
        .select(`
          id,
          sales_person_id,
          dealer_id,
          dealers (name),
          visit_time,
          photo_url,
          next_visit_date,
          visit_status,
          remarks
        `)
        .gte('visit_time', startOfSelectedDate)
        .lte('visit_time', endOfSelectedDate)
        .order('visit_time', { ascending: true });

      // Apply sales person filter
      if (filterSalesPersonId) {
        query = query.eq('sales_person_id', filterSalesPersonId);
      }

      const { data: visitsData, error: visitsError } = await query;
      if (visitsError) throw visitsError;

      // 3. Process each visit row directly so the photo shown matches the actual logged visit.
      const formattedFollowups: FollowupReportData[] = (visitsData || []).map((visit: any) => {
        const nextVisitDate = visit.next_visit_date || null;
        const followupDate = nextVisitDate ? new Date(nextVisitDate) : null;
        if (followupDate) followupDate.setUTCHours(0, 0, 0, 0);
        const isOverdue = followupDate ? followupDate < today : false;

        return {
          id: visit.id,
          sales_person_name: salesPersonMap.get(visit.sales_person_id) || 'N/A',
          dealer_name: (visit.dealers as any)?.name || 'N/A',
          visit_time: visit.visit_time,
          next_visit_date: nextVisitDate,
          visit_status: visit.visit_status || 'N/A',
          remarks: visit.remarks,
          photo_url: visit.photo_url || null,
          isOverdue: isOverdue,
        };
      });

      formattedFollowups.sort((a, b) => {
        if (a.isOverdue !== b.isOverdue) {
          return a.isOverdue ? -1 : 1;
        }
        return new Date(b.visit_time).getTime() - new Date(a.visit_time).getTime();
      });

      setFollowups(formattedFollowups);

    } catch (error: any) {
      console.error('Error fetching today\'s follow-ups:', error.message);
      showError('Failed to load today\'s follow-up report data.');
      setFollowups([]);
    } finally {
      setLoading(false);
    }
  }, [filterSalesPersonId, filterDate]);

  useEffect(() => {
    if (isOpen) {
      fetchFollowupsAndSalesPersons();
    }
  }, [isOpen, fetchFollowupsAndSalesPersons]);

  const handleClearFilters = () => {
    setFilterSalesPersonId('');
    setFilterDate(new Date().toISOString().split('T')[0]);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return 'N/A';
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
    doc.text("Daily Visit Report", 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);

    let filterDetails = [];
    if (filterSalesPersonId) {
        const salesPersonLabel = allSalesPersons.find(sp => sp.value === filterSalesPersonId)?.label;
        if (salesPersonLabel) filterDetails.push(`Sales Person: ${salesPersonLabel}`);
    }
    filterDetails.push(`Follow-up Date: ${formatDate(filterDate)}`);

    if (filterDetails.length > 0) {
        doc.setFontSize(9);
        doc.text(`Filters: ${filterDetails.join(' | ')}`, doc.internal.pageSize.width / 2, 30, { align: 'center' });
    }
    
    const tableColumn = ["Sales Person", "Dealer Name", "Follow-up Date", "Last Visit Remarks", "Last Visit Time"];
    const tableRows = followups.map(visit => [
      visit.sales_person_name,
      visit.dealer_name,
      formatDate(visit.next_visit_date),
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
          <DialogTitle className="text-2xl font-bold text-orange-600">Today's Follow-ups</DialogTitle>
          <DialogDescription>
            View dealers whose visit date is today. Default is current date.
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

          <div className="flex-1 min-w-[180px]">
            <Label htmlFor="filterVisitDate" className="text-foreground font-medium">Follow-up Date</Label>
            <Input
              id="filterVisitDate"
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full"
            />
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
              <p className="ml-2 text-lg text-foreground">Loading daily visit data...</p>
            </div>
          ) : followups.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {filterDate
                ? `No visit records found for ${formatDate(filterDate)}.`
                : 'No visit records found for the selected date.'}
            </p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-muted">
                  <TableRow className="bg-muted hover:bg-muted/90">
                    <TableHead className="text-muted-foreground font-bold">Status</TableHead>
                    <TableHead className="text-muted-foreground font-bold">Sales Person</TableHead>
                    <TableHead className="text-muted-foreground font-bold">Dealer Name</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-center">Follow-up Date</TableHead>
                    <TableHead className="text-muted-foreground font-bold">Last Visit Remarks</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-center">Photo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {followups.map((visit) => (
                    <TableRow key={visit.id} className={visit.isOverdue ? "bg-red-50/50 hover:bg-red-100/50" : "hover:bg-accent/50"}>
                      <TableCell className="font-medium text-foreground">
                        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold w-fit ${visit.isOverdue ? 'text-red-600 bg-red-100' : 'text-orange-600 bg-orange-100'}`}>
                            {visit.isOverdue ? <AlertTriangle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                            {visit.isOverdue ? 'Overdue' : 'Logged Today'}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-foreground">{visit.sales_person_name}</TableCell>
                      <TableCell className="text-foreground">{visit.dealer_name}</TableCell>
                      <TableCell className="text-center text-foreground font-semibold">
                        {formatDate(visit.next_visit_date)}
                      </TableCell>
                      <TableCell className="text-foreground max-w-[200px] truncate" title={visit.remarks || ''}>{visit.remarks || 'N/A'}</TableCell>
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