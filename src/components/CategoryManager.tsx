"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Trash2, Database, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

interface Category {
  id: string;
  name: string;
}

const SQL_COMMAND = `
-- 1. Create the categories table
CREATE TABLE public.categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- 3. Add RLS policies
CREATE POLICY "Allow read access to authenticated users" ON public.categories
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow insert for inventory managers and admins" ON public.categories
FOR INSERT TO authenticated WITH CHECK (public.has_inventory_access());

CREATE POLICY "Allow update for inventory managers and admins" ON public.categories
FOR UPDATE TO authenticated USING (public.has_inventory_access());

CREATE POLICY "Allow delete for inventory managers and admins" ON public.categories
FOR DELETE TO authenticated USING (public.has_inventory_access());

-- 4. Add category_id column to products table
ALTER TABLE public.products
ADD COLUMN category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;
`;

const CategoryManager: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [tableMissing, setTableMissing] = useState(false);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setTableMissing(false);
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        if (error.code === '42P01' || error.message.includes('relation "categories" does not exist')) {
          setTableMissing(true);
          return;
        }
        throw error;
      }
      setCategories(data || []);
    } catch (error: any) {
      console.error('Error fetching categories:', error.message);
      showError('Failed to load category list.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) {
      showError('Category name cannot be empty.');
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('categories')
        .insert({ name: newCategoryName.trim() });
      if (error) throw error;
      showSuccess('Category added successfully!');
      setNewCategoryName('');
      fetchCategories();
    } catch (error: any) {
      showError(`Failed to add category: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);
      if (error) throw error;
      showSuccess('Category deleted successfully.');
      fetchCategories();
    } catch (error: any) {
      showError(`Failed to delete category: ${error.message}`);
    }
  };

  if (tableMissing) {
    return (
      <div className="space-y-4 p-4">
        <Alert variant="destructive">
          <Database className="h-4 w-4" />
          <AlertTitle>Database Setup Required</AlertTitle>
          <AlertDescription>
            The <code>categories</code> table and related product column are missing. Please run the following SQL in your Supabase SQL Editor to enable this feature:
          </AlertDescription>
        </Alert>
        <pre className="bg-slate-950 text-slate-50 p-4 rounded-md overflow-x-auto text-xs font-mono">
          {SQL_COMMAND}
        </pre>
        <Button onClick={fetchCategories} className="w-full">
          <RotateCcw className="mr-2 h-4 w-4" /> I've run the SQL, Retry
        </Button>
      </div>
    );
  }

  return (
    <Card className="bg-card text-card-foreground shadow-lg">
      <CardHeader>
        <CardTitle>Manage Product Categories</CardTitle>
        <CardDescription>Add or remove categories for organizing your products.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleAddCategory} className="flex items-end gap-4">
          <div className="flex-grow space-y-2">
            <Label htmlFor="categoryName">New Category Name</Label>
            <Input
              id="categoryName"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="e.g., Everware, Plastics, etc."
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
          ) : categories.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No categories added yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category Name</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete {category.name}?</AlertDialogTitle>
                            <AlertDialogDescription>This action cannot be undone. Products in this category will become uncategorized.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteCategory(category.id)}>Delete</AlertDialogAction>
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

export default CategoryManager;