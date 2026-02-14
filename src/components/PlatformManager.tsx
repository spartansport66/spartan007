"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface Platform {
  id: string;
  name: string;
}

const PlatformManager: React.FC = () => {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newPlatformName, setNewPlatformName] = useState('');

  const fetchPlatforms = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('online_platforms')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      setPlatforms(data || []);
    } catch (error: any) {
      showError(`Failed to load platforms: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlatforms();
  }, [fetchPlatforms]);

  const handleAddPlatform = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlatformName.trim()) {
      showError('Platform name cannot be empty.');
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('online_platforms')
        .insert({ name: newPlatformName.trim() });
      if (error) throw error;
      showSuccess('Platform added successfully!');
      setNewPlatformName('');
      fetchPlatforms();
    } catch (error: any) {
      showError(`Failed to add platform: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePlatform = async (id: string) => {
    try {
      const { error } = await supabase
        .from('online_platforms')
        .delete()
        .eq('id', id);
      if (error) throw error;
      showSuccess('Platform deleted successfully.');
      fetchPlatforms();
    } catch (error: any) {
      showError(`Failed to delete platform: ${error.message}`);
    }
  };

  return (
    <Card className="bg-card text-card-foreground shadow-lg">
      <CardHeader>
        <CardTitle>Manage Online Platforms</CardTitle>
        <CardDescription>Add or remove online sales platforms like Amazon, Flipkart, etc.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleAddPlatform} className="flex items-end gap-4">
          <div className="flex-grow space-y-2">
            <Label htmlFor="platformName">New Platform Name</Label>
            <Input
              id="platformName"
              value={newPlatformName}
              onChange={(e) => setNewPlatformName(e.target.value)}
              placeholder="e.g., Amazon"
              disabled={isSubmitting}
            />
          </div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Add
          </Button>
        </form>

        <div className="max-h-96 overflow-y-auto border rounded-md">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : platforms.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No platforms added yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Platform Name</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {platforms.map((platform) => (
                  <TableRow key={platform.id}>
                    <TableCell className="font-medium">{platform.name}</TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete {platform.name}?</AlertDialogTitle>
                            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeletePlatform(platform.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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

export default PlatformManager;