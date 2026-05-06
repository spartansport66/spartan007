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
import { showError, showSuccess } from '@/utils/toast';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface MissedDailyVisitReportData {
  id: string;
  sales_person_name: string;
  is_blocked: boolean;
  visit_count: number;
}

interface FilterOption {
  value: string;
  label: string;
}

interface SalesPersonMissedDailyVisitsReportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const getYesterdayDateString = () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const day = String(yesterday.getDate()).padStart(2, '0');
  const month = String(yesterday.getMonth() + 1).padStart(2, '0');
  const year = yesterday.getFullYear();
  return `${year}-${month}-${day}`;
};

const SalesPersonMissedDailyVisitsReportDialog: React.FC<SalesPersonMissedDailyVisitsReportDialogProps> = ({ isOpen, onOpenChange }) => {
  const [reportData, setReportData] = useState<MissedDailyVisitReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpdatingBlock, setIsUpdatingBlock] = useState(false);
  const [blockingSalesPersonId, setBlockingSalesPersonId] = useState<string | null>(null);
  const [allSalesPersons, setAllSalesPersons] = useState<FilterOption[]>([]);
  const [blockSupportAvailable, setBlockSupportAvailable] = useState(true);

  const [filterSalesPersonId, setFilterSalesPersonId] = useState<string>('');
  const [filterFromDate, setFilterFromDate] = useState<string>(getYesterdayDateString());
  const [filterToDate, setFilterToDate] = useState<string>(getYesterdayDateString());

  const formatProfileName = (profile: any) => {
    const parts = [profile?.first_name, profile?.last_name].filter((part) => part && part.toString().trim());
    return parts.join(' ') || 'Unknown Salesperson';
  };

  const fetchReportData = useCallback(async () => {
    setLoading(true);
    try {
      const fromDate = filterFromDate || getYesterdayDateString();
      const toDate = filterToDate || getYesterdayDateString();
      const startOfFromDate = `${fromDate}T00:00:00.000Z`;
      const endOfToDate = `${toDate}T23:59:59.999Z`;

      let profilesData: any[] = [];
      let hasBlockColumn = true;
      const { data: profilesResult, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, is_blocked')
        .eq('user_type', 'sales_person');

      if (profilesError) {
        if (profilesError.message?.includes('is_blocked')) {
          hasBlockColumn = false;
          const { data: fallbackProfiles, error: fallbackError } = await supabase
            .from('profiles')
            .select('id, first_name, last_name')
            .eq('user_type', 'sales_person');

          if (fallbackError) throw fallbackError;
          profilesData = fallbackProfiles || [];
        } else {
          throw profilesError;
        }
      } else {
        profilesData = profilesResult || [];
      }

      setBlockSupportAvailable(hasBlockColumn);

      const visitCounts = new Map<string, number>();
      let visitsData: any[] | null = null;
      let visitsError: any = null;
      const visitColumns: Array<'visit_time' | 'visit_date'> = ['visit_time', 'visit_date'];

      for (const visitColumn of visitColumns) {
        const query = supabase.from('sales_person_visits').select('sales_person_id');
        if (visitColumn === 'visit_time') {
          query.gte('visit_time', startOfFromDate).lte('visit_time', endOfToDate);
        } else {
          query.gte('visit_date', fromDate).lte('visit_date', toDate);
        }

        const { data, error } = await query;
        if (!error) {
          visitsData = data || [];
          break;
        }

        if (error.message?.includes(visitColumn)) {
          visitsError = error;
          continue;
        }

        throw error;
      }

      if (!visitsData) throw visitsError;

      (visitsData || []).forEach((visit: any) => {
        const salesPersonId = visit.sales_person_id;
        if (!salesPersonId) return;
        visitCounts.set(salesPersonId, (visitCounts.get(salesPersonId) || 0) + 1);
      });

      const formattedProfiles = profilesData.map((profile: any) => ({
        id: profile.id,
        sales_person_name: formatProfileName(profile),
        is_blocked: hasBlockColumn ? Boolean(profile.is_blocked) : false,
        visit_count: visitCounts.get(profile.id) || 0,
      }));

      setAllSalesPersons(profilesData.map((profile: any) => ({
        value: profile.id,
        label: formatProfileName(profile),
      })));

      const missedRows = formattedProfiles.filter(profile => {
        if (filterSalesPersonId && profile.id !== filterSalesPersonId) {
          return false;
        }
        return profile.visit_count < 5;
      });

      setReportData(missedRows);
    } catch (error: any) {
      console.error('Error fetching missed daily visits report:', error?.message || error);
      showError('Failed to load missed daily visits report.');
      setReportData([]);
    } finally {
      setLoading(false);
    }
  }, [filterSalesPersonId, filterFromDate, filterToDate]);

  useEffect(() => {
    if (isOpen) {
      fetchReportData();
    }
  }, [isOpen, fetchReportData]);

  const handleClearFilters = () => {
    setFilterSalesPersonId('');
    const yesterday = getYesterdayDateString();
    setFilterFromDate(yesterday);
    setFilterToDate(yesterday);
  };

  const handleToggleBlock = async (salesPersonId: string, currentlyBlocked: boolean) => {
    if (!blockSupportAvailable) {
      showError('Profile blocking is unavailable until the profile schema is updated.');
      return;
    }

    setIsUpdatingBlock(true);
    setBlockingSalesPersonId(salesPersonId);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_blocked: !currentlyBlocked })
        .eq('id', salesPersonId);

      if (error) throw error;
      showSuccess(`Sales person ${currentlyBlocked ? 'unblocked' : 'blocked'} successfully.`);
      await fetchReportData();
    } catch (error: any) {
      console.error('Error updating block status:', error?.message || error, error);
      if (error?.status === 403 || error?.message?.toLowerCase().includes('permission denied')) {
        showError('Failed to update profile status due to Supabase RLS policies. Please update profile policies to allow admin profile updates.');
      } else if (error?.message?.includes('is_blocked')) {
        showError('Profile blocking is unavailable until the profile schema is updated.');
      } else {
        showError(`Failed to ${currentlyBlocked ? 'unblock' : 'block'} sales person.`);
      }
    } finally {
      setIsUpdatingBlock(false);
      setBlockingSalesPersonId(null);
    }
  };

  const handlePrint = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(18);
    doc.text('Missing Daily Visits Report', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);

    const filterDetails = [`Date Range: ${filterFromDate} to ${filterToDate}`];
    if (filterSalesPersonId) {
      const salesPersonLabel = allSalesPersons.find(sp => sp.value === filterSalesPersonId)?.label;
      if (salesPersonLabel) filterDetails.push(`Sales Person: ${salesPersonLabel}`);
    }

    if (filterDetails.length) {
      doc.setFontSize(9);
      doc.text(`Filters: ${filterDetails.join(' | ')}`, doc.internal.pageSize.width / 2, 30, { align: 'center' });
    }

    const tableColumn = ['Sales Person', 'Status'];
    const tableRows = reportData.map(row => [row.sales_person_name, 'Missing Visit']);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 36,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0] },
      margin: { top: 25 },
      columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 40, halign: 'center' } },
    });

    doc.save('missing_daily_visits_report.pdf');
    showSuccess('Missing daily visits report generated successfully!');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1000px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-orange-600">Sales Person Missing Daily Visits</DialogTitle>
          <DialogDescription>
            View sales persons who have not logged daily visits for the selected date range. Default is yesterday.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-card rounded-lg">
          <div className="flex-1 min-w-[180px]">
            <Label htmlFor="filterSalesPerson" className="text-foreground font-medium">Sales Person</Label>
            <Select value={filterSalesPersonId || 'all'} onValueChange={(value) => setFilterSalesPersonId(value === 'all' ? '' : value)}>
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

          <Button onClick={fetchReportData} className="flex items-center gap-2 bg-primary hover:bg-primary/90">
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
              <p className="ml-2 text-lg text-foreground">Loading report data...</p>
            </div>
          ) : reportData.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No missing daily visit records found for the selected range.</p>
          ) : (
            <>
              {!blockSupportAvailable && (
                <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
                  Profile blocking is unavailable until the profile schema is updated.
                </div>
              )}
              <div className="max-h-[400px] overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted">
                    <TableRow className="bg-muted hover:bg-muted/90">
                      <TableHead className="text-muted-foreground font-bold">Sales Person</TableHead>
                      <TableHead className="text-muted-foreground font-bold text-center">Visits</TableHead>
                      <TableHead className="text-muted-foreground font-bold text-center">Status</TableHead>
                      <TableHead className="text-muted-foreground font-bold text-center">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.map((row) => (
                      <TableRow key={row.id} className="hover:bg-accent/50">
                        <TableCell className="font-medium text-foreground">{row.sales_person_name}</TableCell>
                        <TableCell className="text-center text-foreground font-semibold">{row.visit_count}</TableCell>
                        <TableCell className={`text-center font-semibold ${row.is_blocked ? 'text-destructive' : 'text-amber-700'}`}>
                          {row.is_blocked ? 'Blocked' : 'Low Visits'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant={row.is_blocked ? 'destructive' : 'outline'}
                            onClick={() => handleToggleBlock(row.id, row.is_blocked)}
                            disabled={!blockSupportAvailable || (isUpdatingBlock && blockingSalesPersonId === row.id)}
                          >
                            {isUpdatingBlock && blockingSalesPersonId === row.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : blockSupportAvailable ? (row.is_blocked ? 'Unblock' : 'Block') : 'Unavailable'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handlePrint} disabled={reportData.length === 0} className="border border-input hover:bg-accent hover:text-accent-foreground">
            <Printer className="mr-2 h-4 w-4" /> Print Report
          </Button>
          <Button onClick={() => onOpenChange(false)} className="bg-primary hover:bg-primary/90">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SalesPersonMissedDailyVisitsReportDialog;
