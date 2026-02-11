"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Printer, CheckCircle, XCircle, Clock, Database } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'; // Import Alert components

interface LoginLog {
  id: string;
  user_id: string;
  login_time: string;
  success: boolean;
  ip_address: string | null;
  user_name: string;
  user_type: string;
  last_active_at: string | null; // New field
}

interface FilterOption {
  value: string;
  label: string;
}

interface LoginLogReportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const SQL_COMMAND = `
-- Ensure uuid-ossp extension is enabled if not already
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create login_logs table
CREATE TABLE IF NOT EXISTS public.login_logs (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL,
    login_time timestamp with time zone NOT NULL DEFAULT now(),
    success boolean NOT NULL,
    ip_address text NULL,
    CONSTRAINT login_logs_pkey PRIMARY KEY (id),
    CONSTRAINT login_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 2. Enable RLS for login_logs
ALTER TABLE public.login_logs ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies for login_logs
CREATE POLICY "Admins can manage all login logs" ON public.login_logs FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Users can view own login logs" ON public.login_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Allow public insert for login logs" ON public.login_logs FOR INSERT WITH CHECK (true);

-- 4. Create user_activity_logs table
CREATE TABLE IF NOT EXISTS public.user_activity_logs (
    user_id uuid NOT NULL,
    last_active_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT user_activity_logs_pkey PRIMARY KEY (user_id),
    CONSTRAINT user_activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 5. Enable RLS for user_activity_logs
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for user_activity_logs
DROP POLICY IF EXISTS "Users can insert their own activity log" ON public.user_activity_logs;
CREATE POLICY "Users can insert their own activity log" ON public.user_activity_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own activity log" ON public.user_activity_logs;
CREATE POLICY "Users can update their own activity log" ON public.user_activity_logs FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins and Sales Persons can read all activity logs" ON public.user_activity_logs;
CREATE POLICY "Admins and Sales Persons can read all activity logs" ON public.user_activity_logs FOR SELECT TO authenticated USING (TRUE);
`;

const LoginLogReportDialog: React.FC<LoginLogReportDialogProps> = ({ isOpen, onOpenChange }) => {
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<FilterOption[]>([]);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [tableMissing, setTableMissing] = useState(false);

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
    setTableMissing(false);
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
      if (logsError) {
        if (logsError.code === '42P01' || logsError.message.includes('relation "login_logs" does not exist')) {
          setTableMissing(true);
          setLogs([]);
          return;
        }
        throw logsError;
      }

      // 3. Fetch last active times for all users in the logs
      const userIdsInLogs = [...new Set(logsData.map(log => log.user_id))];
      let activityMap = new Map<string, string>();
      
      if (userIdsInLogs.length > 0) {
        const { data: activityData, error: activityError } = await supabase
          .from('user_activity_logs')
          .select('user_id, last_active_at')
          .in('user_id', userIdsInLogs);

        if (activityError && !activityError.message.includes('relation "user_activity_logs" does not exist')) {
          console.warn('Error fetching activity logs:', activityError.message);
        } else if (activityData) {
          activityMap = new Map(activityData.map(a => [a.user_id, a.last_active_at]));
        }
      }

      // 4. Format logs
      const formattedLogs: LoginLog[] = (logsData || []).map((log: any) => {
        const userInfo = userMap.get(log.user_id) || { name: 'Unknown User', type: 'N/A' };
        return {
          ...log,
          user_name: userInfo.name,
          user_type: userInfo.type,
          last_active_at: activityMap.get(log.user_id) || null,
        };
      });
      
      setLogs(formattedLogs);

    } catch (error: any) {
      console.error('Error fetching login logs:', error.message);
      if (!tableMissing) {
        showError('Failed to load login log data. Ensure the required tables exist and are accessible.');
      }
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [filterUserId, filterStatus, filterFromDate, filterToDate, tableMissing]);

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
    if (tableMissing) {
      showError('Cannot print report: The required database table is missing.');
      return;
    }
    try {
      const doc = new jsPDF({
        orientation: 'landscape'
      });

      const companyNameText = companyName ? companyName.toUpperCase() : "COMPANY NAME";
      doc.setFontSize(22);
      doc.text(companyNameText, doc.internal.pageSize.width / 2, 15, { align: 'center' });
      doc.setFontSize(18);
      doc.text("User Login & Activity Report", doc.internal.pageSize.width / 2, 25, { align: 'center' });
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

      const tableColumn = ["User Name", "User Type", "Login Time", "Last Active Time", "Status", "IP Address"];
      const tableRows = logs.map(log => [
        log.user_name,
        log.user_type,
        new Date(log.login_time).toLocaleString(),
        log.last_active_at ? new Date(log.last_active_at).toLocaleString() : 'N/A',
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
          0: { cellWidth: 30 },
          1: { cellWidth: 25, halign: 'center' },
          2: { cellWidth: 35 },
          3: { cellWidth: 35 },
          4: { cellWidth: 20, halign: 'center' },
          5: { cellWidth: 30, halign: 'center' },
        }
      });

      doc.save('user_login_activity_report.pdf');
      showSuccess('User Login & Activity report generated successfully!');
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      showError(`Failed to generate report: ${error.message || 'An unknown error occurred.'}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1000px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary">User Login & Activity Report</DialogTitle>
          <DialogDescription>
            View user login history and last recorded activity time. (Last Active Time updates every 5 minutes while the user is active in the app.)
          </DialogDescription>
        </DialogHeader>

        {tableMissing ? (
          <div className="p-6 space-y-4">
            <Alert variant="destructive">
              <Database className="h-4 w-4" />
              <AlertTitle>Database Tables Missing</AlertTitle>
              <AlertDescription>
                The required tables <code>public.login_logs</code> and <code>public.user_activity_logs</code> do not exist. Please run the following SQL command in your Supabase SQL Editor to enable this feature:
              </AlertDescription>
            </Alert>
            <pre className="bg-gray-100 dark:bg-gray-900 p-3 rounded-md overflow-x-auto text-sm">
              <code>{SQL_COMMAND}</code>
            </pre>
            <p className="text-sm text-muted-foreground">
              Note: After creating the tables, successful logins will be logged automatically, and activity will be tracked every 5 minutes when the app is open.
            </p>
            <Button onClick={fetchLoginLogs} disabled={loading} className="flex items-center gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Retry Fetch
            </Button>
          </div>
        ) : (
          <>
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
                        <TableHead className="text-muted-foreground font-bold">Last Login Time</TableHead>
                        <TableHead className="text-muted-foreground font-bold">Last Active Time</TableHead>
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
                          <TableCell className="text-foreground">
                            {log.last_active_at ? new Date(log.last_active_at).toLocaleString() : 'N/A'}
                          </TableCell>
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default LoginLogReportDialog;