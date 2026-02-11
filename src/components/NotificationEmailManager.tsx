"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2, Mail, Database, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

interface NotificationEmail {
  id: string;
  department_name: string;
  email_address: string;
}

const DEPARTMENTS = [
  "Accounts",
  "Manager",
  "Gate Keeper",
  "Warehouse / Order Prep",
  "Sales Head",
  "Inventory Manager",
  "General Admin"
];

const SQL_COMMAND = `
CREATE TABLE IF NOT EXISTS public.notification_emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  department_name TEXT NOT NULL,
  email_address TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.notification_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage notification emails" ON public.notification_emails
FOR ALL TO authenticated USING (public.is_admin());
`;

const NotificationEmailManager: React.FC = () => {
  const [emails, setEmails] = useState<NotificationEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);
  
  const [newDept, setNewDept] = useState('');
  const [newEmail, setNewEmail] = useState('');

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    setTableMissing(false);
    try {
      const { data, error } = await supabase
        .from('notification_emails')
        .select('*')
        .order('department_name', { ascending: true });

      if (error) {
        if (error.code === '42P01' || error.message.includes('relation "notification_emails" does not exist')) {
          setTableMissing(true);
          return;
        }
        throw error;
      }
      setEmails(data || []);
    } catch (error: any) {
      console.error('Error fetching notification emails:', error.message);
      showError('Failed to load email list.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  const handleAddEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDept || !newEmail.trim()) {
      showError('Please select a department and enter an email.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('notification_emails')
        .insert({
          department_name: newDept,
          email_address: newEmail.trim().toLowerCase(),
        });

      if (error) throw error;

      showSuccess('Email added to notification list!');
      setNewDept('');
      setNewEmail('');
      fetchEmails();
    } catch (error: any) {
      showError(`Failed to add email: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEmail = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notification_emails')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      showSuccess('Email removed.');
      fetchEmails();
    } catch (error: any) {
      showError(`Failed to remove email: ${error.message}`);
    }
  };

  if (tableMissing) {
    return (
      <div className="space-y-4 p-4">
        <Alert variant="destructive">
          <Database className="h-4 w-4" />
          <AlertTitle>Database Table Missing</AlertTitle>
          <AlertDescription>
            The <code>notification_emails</code> table does not exist. Please run the following SQL in your Supabase SQL Editor:
          </AlertDescription>
        </Alert>
        <pre className="bg-slate-950 text-slate-50 p-4 rounded-md overflow-x-auto text-xs font-mono">
          {SQL_COMMAND}
        </pre>
        <Button onClick={fetchEmails} className="w-full">
          <RotateCcw className="mr-2 h-4 w-4" /> I've run the SQL, Retry
        </Button>
      </div>
    );
  }

  return (
    <Card className="bg-card text-card-foreground shadow-lg h-full border-none shadow-none">
      <CardContent className="p-0 space-y-6">
        <form onSubmit={handleAddEmail} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end p-4 border rounded-md bg-muted/30">
          <div className="space-y-2">
            <Label htmlFor="dept">Department</Label>
            <Select value={newDept} onValueChange={setNewDept} disabled={isSubmitting}>
              <SelectTrigger id="dept">
                <SelectValue placeholder="Select Dept" />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="dept@company.com" 
              value={newEmail} 
              onChange={(e) => setNewEmail(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Add Recipient
          </Button>
        </form>

        <div className="overflow-x-auto border rounded-md">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : emails.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No notification emails configured.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted">
                  <TableHead>Department</TableHead>
                  <TableHead>Email Address</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {emails.map((email) => (
                  <TableRow key={email.id}>
                    <TableCell className="font-medium">{email.department_name}</TableCell>
                    <TableCell>{email.email_address}</TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDeleteEmail(email.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default NotificationEmailManager;