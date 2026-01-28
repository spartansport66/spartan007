"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Printer, CheckCircle, XCircle, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';

interface LoginLog {
  id: string;
  user_id: string;
  login_time: string;
  success: boolean;
  ip_address: string | null;
  user_name: string;
  user_type: string;
}

interface FilterOption {
  value: string;
  label: string;
}

interface LoginLogReportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const LoginLogReportDialog: React.FC<LoginLogReportDialogProps> = ({ isOpen, onOpenChange }) => {
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<FilterOption[]>([]);
  const [companyName, setCompanyName] = useState<string | null>(null);

  // Filter states
  const [filterUserId, setFilterUserId] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'failure'>('all');
  const [filterFromDate, setFilterFromDate] = useState<string>('');
  const [filterToDate, setFilterToDate] = useState<string>('');

  const fetchCompanyInfo = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('company_info')
        .select('company_name')
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      setCompanyName(data?.company_name || null);
    } catch (error: any) {
      console.error('Error fetching company name for PDF:', error.message);
      setCompanyName(null);
    }
  }, []);

  const fetchLoginLogs = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch all users (profiles) for mapping and filtering
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, user_type')
        .order('first_name', { ascending: true });

      if (profilesError) throw profilesError;
      
      const userMap = new Map(profilesData.map(p => [p.id, { 
        name: `${p.first_name} ${p.last_name || ''}`.trim(), 
        type: p.user_type 
      }]));
      
      setAllUsers((profilesData || []).map(p => ({ 
        value: p.id, 
        label: `${p.first_name} ${p.last_name || ''} (${p.user_type})`.trim() 
      })));

      // 2. Build the query for login logs
      let query = supabase
        .from('login_logs')
        .select(`id, user_id, login_time, success, ip_address`)
        .order('login_time', { ascending: false });

      // Apply filters
      if (filterUserId) {
        query = query.eq('user_id', filterUserId);
      }
      if (filterStatus !== 'all') {
        query = query.eq('success', filterStatus === 'success');
      }
      if (filterFromDate) {
        const startOfDay = `${filterFromDate}T00:00:00.000Z`;
        query = query.gte('login_time', startOfDay);
      }
      if (filterToDate) {
        const endOfDay = `${filterToDate}T23:59:59.999Z`;
        query = query.lte('login_time', endOfDay);
      }

      const { data: logsData, error: logsError } = await query;
      if (logsError) throw logsError;

      const formattedLogs: LoginLog[] = (logsData || []).map((log: any) => {
        const userInfo = userMap.get(log.user_id) || { name: 'Unknown User', type: 'N/A' };
        return {
          ...log,
          user_name: userInfo.name,
          user_type: userInfo.type,
        };
      });
      
      setLogs(formattedLogs);

    } catch (error: any) {
      console.error('Error fetching login logs:', error.message);
      showError('Failed to load login log data. Ensure the `login_logs` table exists.');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [filterUserId, filterStatus, filterFromDate, filterToDate]);

  useEffect(() => {
    if (isOpen) {
      fetchCompanyInfo();
      fetchLoginLogs();
    }
  }, [isOpen, fetchCompanyInfo, fetchLoginLogs]);

  const handleClearFilters = () => {
    setFilterUserId('');
    setFilterStatus('all');
    setFilterFromDate('');
    setFilterToDate('');
  };

  const handlePrint = () => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait'
      });

      const companyNameText = companyName ? companyName.toUpperCase() : "COMPANY NAME";
      doc.setFontSize(22);
      doc.text(companyNameText, doc.internal.pageSize.width / 2, 15, { align: 'center' });
      doc.setFontSize(18);
      doc.text("User Login Log Report", doc.internal.pageSize.width / 2, 25, { align: 'center' });
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, doc.internal.pageSize.width / 2, 32, { align: 'center' });

      let filterDetails = [];
      if (filterUserId) {
        const userLabel = allUsers.find(u => u.value === filterUserId)?.label;
        if (userLabel) filterDetails.push(`User: ${userLabel}`);
      }
      if (filterStatus !== 'all') filterDetails.push(`Status: ${filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)}`);
      if (filterFromDate || filterToDate) filterDetails.push(`Period: ${filterFromDate || 'Start'} to ${filterToDate || 'End'}`);

      if (filterDetails.length > 0) {
        doc.setFontSize(9);
        doc.text(`Filters: ${filterDetails.join(' | ')}`, doc.internal.pageSize.width / 2, 38, { align: 'center' });
      }

      const tableColumn = ["User Name", "User Type", "Login Time", "Status", "IP Address"];
      const tableRows = logs.map(log => [
        log.user_name,
        log.user_type,
        new Date(log.login_time).toLocaleString(),
        log.success ? 'Success' : 'Failure',
        log.ip_address || 'N/A',
      ]);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 45,
        styles: {
          fontSize: 8,
          cellPadding: 2,
          valign: 'middle',
        },
        headStyles: {
          fillColor: [30, 58, 138],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
        },
        bodyStyles: {
          textColor: [0, 0, 0],
        },
        margin: { top: 10, left: 10, right: 10 },
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: 30, halign: 'center' },
          2: { cellWidth: 40 },
          3: { cellWidth: 20, halign: 'center' },
          4: { cellWidth: 30, halign: 'center' },
        }
      });

      doc.save('login_log_report.pdf');
      showSuccess('Login log report generated successfully!');
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      showError(`Failed to generate report: ${error.message || 'An unknown error occurred.'}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary">User Login Log Report</DialogTitle>
          <DialogDescription>
            View and filter user login history. (Requires `login_logs` table in Supabase)
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-card rounded-lg">
          <div className="flex-1 min-w-[180px]">
            <Label htmlFor="filterUser">User</Label>
            <Select value={filterUserId || "all"} onValueChange={(value) => setFilterUserId(value === "all" ? "" : value)} disabled={loading}>
              <SelectTrigger id="filterUser" className="w-full">
                <SelectValue placeholder="All Users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {allUsers.map(user => (
                  <SelectItem key={user.value} value={user.value}>{user.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[120px]">
            <Label htmlFor="filterStatus">Status</Label>
            <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as typeof filterStatus)} disabled={loading}>
              <SelectTrigger id="filterStatus" className="w-full">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failure">Failure</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterFromDate">From Date</Label>
            <Input
              id="filterFromDate"
              type="date"
              value={filterFromDate}
              onChange={(e) => setFilterFromDate(e.target.value)}
              className="w-full"
              disabled={loading}
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="filterToDate">To Date</Label>
            <Input
              id="filterToDate"
              type="date"
              value={filterToDate}
              onChange={(e) => setFilterToDate(e.target.value)}
              className="w-full"
              disabled={loading}
            />
          </div>
          <Button onClick={fetchLoginLogs} disabled={loading} className="flex items-center gap-2 bg-primary hover:bg-primary/90">
            <Search className="h-4 w-4" /> Apply Filters
          </Button>
          <Button variant="outline" onClick={handleClearFilters} disabled={loading} className="flex items-center gap-2">
            Clear Filters
          </Button>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-lg text-foreground">Loading login logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No login logs found matching your criteria.</p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-muted">
                  <TableRow className="bg-muted hover:bg-muted/90">
                    <TableHead className="text-muted-foreground font-bold">User Name</TableHead>
                    <TableHead className="text-muted-foreground font-bold">User Type</TableHead>
                    <TableHead className="text-muted-foreground font-bold">Login Time</TableHead>
                    <TableHead className="text-muted-foreground font-bold text-center">Status</TableHead>
                    <TableHead className="text-muted-foreground font-bold">IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-accent/50">
                      <TableCell className="font-medium text-foreground">{log.user_name}</TableCell>
                      <TableCell className="text-foreground capitalize">{log.user_type.replace('_', ' ')}</TableCell>
                      <TableCell className="text-foreground">{new Date(log.login_time).toLocaleString()}</TableCell>
                      <TableCell className="text-center">
                        <div className={`flex items-center justify-center gap-1 px-3 py-1 rounded-full text-xs font-semibold w-fit mx-auto ${log.success ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'}`}>
                          {log.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                          {log.success ? 'Success' : 'Failure'}
                        </div>
                      </TableCell>
                      <TableCell className="text-foreground">{log.ip_address || 'N/A'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handlePrint} disabled={logs.length === 0} className="border border-input hover:bg-accent hover:text-accent-foreground">
            <Printer className="mr-2 h-4 w-4" /> Print Report
          </Button>
          <Button onClick={() => onOpenChange(false)} className="bg-primary hover:bg-primary/90">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LoginLogReportDialog;