"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, PlusCircle, Edit, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
}

const supplierSchema = z.object({
  name: z.string().min(2, 'Name is required.'),
  contact_person: z.string().optional(),
  email: z.string().email('Invalid email address.').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
});

const SupplierManager: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  const form = useForm<z.infer<typeof supplierSchema>>({
    resolver: zodResolver(supplierSchema),
  });

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('suppliers').select('*').order('name');
      if (error) throw error;
      setSuppliers(data || []);
    } catch (error: any) {
      showError(`Failed to load suppliers: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  useEffect(() => {
    if (selectedSupplier) {
      form.reset({
        ...selectedSupplier,
        contact_person: selectedSupplier.contact_person || '',
        email: selectedSupplier.email || '',
        phone: selectedSupplier.phone || '',
        address: selectedSupplier.address || '',
      });
    } else {
      form.reset({ name: '', contact_person: '', email: '', phone: '', address: '' });
    }
  }, [selectedSupplier, form]);

  const handleSave = async (values: z.infer<typeof supplierSchema>) => {
    try {
      if (selectedSupplier) {
        // Update
        const { error } = await supabase.from('suppliers').update(values).eq('id', selectedSupplier.id);
        if (error) throw error;
        showSuccess('Supplier updated successfully.');
      } else {
        // Create
        const { error } = await supabase.from('suppliers').insert(values);
        if (error) throw error;
        showSuccess('Supplier added successfully.');
      }
      setIsDialogOpen(false);
      fetchSuppliers();
    } catch (error: any) {
      showError(`Failed to save supplier: ${error.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('suppliers').delete().eq('id', id);
      if (error) throw error;
      showSuccess('Supplier deleted successfully.');
      fetchSuppliers();
    } catch (error: any) {
      showError(`Failed to delete supplier: ${error.message}`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Manage Suppliers</CardTitle>
            <CardDescription>Add, edit, or remove suppliers for your raw materials.</CardDescription>
          </div>
          <Button onClick={() => { setSelectedSupplier(null); setIsDialogOpen(true); }}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Supplier
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact Person</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-medium">{supplier.name}</TableCell>
                    <TableCell>{supplier.contact_person || 'N/A'}</TableCell>
                    <TableCell>{supplier.email || 'N/A'}</TableCell>
                    <TableCell>{supplier.phone || 'N/A'}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedSupplier(supplier); setIsDialogOpen(true); }}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(supplier.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedSupplier ? 'Edit Supplier' : 'Add New Supplier'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
            <div><Label>Name</Label><Input {...form.register('name')} />{form.formState.errors.name && <p className="text-destructive text-sm">{form.formState.errors.name.message}</p>}</div>
            <div><Label>Contact Person</Label><Input {...form.register('contact_person')} /></div>
            <div><Label>Email</Label><Input type="email" {...form.register('email')} />{form.formState.errors.email && <p className="text-destructive text-sm">{form.formState.errors.email.message}</p>}</div>
            <div><Label>Phone</Label><Input {...form.register('phone')} /></div>
            <div><Label>Address</Label><Input {...form.register('address')} /></div>
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default SupplierManager;