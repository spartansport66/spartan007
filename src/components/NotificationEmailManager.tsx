"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Trash2, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';

interface NotificationEmail {
  id: string;
  department_name: string;
  email_address: string;
}

const NotificationEmailManager: React.FC = () => {
  const [emails, setEmails] = useState<NotificationEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [newDept, setNewDept] = useState('');
  const [newEmail, setNewEmail] = useState('');

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notification_emails')
        .select('*')
        .order('department_name', { ascending: true });

      if (error) throw error;
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
    if (!newDept.trim() || !newEmail.trim()) {
      showError('Please fill in both department and email.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('notification_emails')
        .insert({
          department_name: newDept.trim(),
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

  return (
    <Card className="bg-card text-card-foreground shadow-lg h-full">
      <CardHeader className="bg-slate-700 text-white rounded-t-lg p-4">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <Mail className="h-5 w-5" /> Order Notification Emails
        </CardTitle>
        <CardDescription className="text-slate-200">
          Manage which departments receive automated emails when an order is placed.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 space-y-6">
        <form onSubmit={handleAddEmail} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end p-4 border rounded-md bg-muted/30">
          <div className="space-y-2">
            <Label htmlFor="dept">Department</Label>
            <Input 
              id="dept" 
              placeholder="e.g., Accounts" 
              value={newDept} 
              onChange={(e) => setNewDept(e.target.value)}
              disabled={isSubmitting}
            />
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