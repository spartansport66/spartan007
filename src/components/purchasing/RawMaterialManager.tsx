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

interface RawMaterial {
  id: string;
  name: string;
  code: string;
  unit_of_measure: string | null;
  current_stock: number;
}

const materialSchema = z.object({
  name: z.string().min(2, 'Name is required.'),
  code: z.string().min(1, 'Code is required.'),
  unit_of_measure: z.string().optional(),
  current_stock: z.preprocess((val) => Number(val || 0), z.number().min(0)),
});

const RawMaterialManager: React.FC = () => {
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<RawMaterial | null>(null);

  const form = useForm<z.infer<typeof materialSchema>>({
    resolver: zodResolver(materialSchema),
  });

  const fetchMaterials = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('raw_materials').select('*').order('name');
      if (error) throw error;
      setMaterials(data || []);
    } catch (error: any) {
      showError(`Failed to load raw materials: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  useEffect(() => {
    if (selectedMaterial) {
      form.reset({
        ...selectedMaterial,
        unit_of_measure: selectedMaterial.unit_of_measure || '',
      });
    } else {
      form.reset({ name: '', code: '', unit_of_measure: '', current_stock: 0 });
    }
  }, [selectedMaterial, form]);

  const handleSave = async (values: z.infer<typeof materialSchema>) => {
    try {
      if (selectedMaterial) {
        const { error } = await supabase.from('raw_materials').update(values).eq('id', selectedMaterial.id);
        if (error) throw error;
        showSuccess('Raw material updated successfully.');
      } else {
        const { error } = await supabase.from('raw_materials').insert(values);
        if (error) throw error;
        showSuccess('Raw material added successfully.');
      }
      setIsDialogOpen(false);
      fetchMaterials();
    } catch (error: any) {
      showError(`Failed to save raw material: ${error.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('raw_materials').delete().eq('id', id);
      if (error) throw error;
      showSuccess('Raw material deleted successfully.');
      fetchMaterials();
    } catch (error: any) {
      showError(`Failed to delete raw material: ${error.message}`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Manage Raw Materials</CardTitle>
            <CardDescription>Add, edit, or remove raw materials for production.</CardDescription>
          </div>
          <Button onClick={() => { setSelectedMaterial(null); setIsDialogOpen(true); }}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Material
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
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Current Stock</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materials.map((material) => (
                  <TableRow key={material.id}>
                    <TableCell className="font-medium">{material.code}</TableCell>
                    <TableCell>{material.name}</TableCell>
                    <TableCell>{material.unit_of_measure || 'N/A'}</TableCell>
                    <TableCell className="text-right">{material.current_stock}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedMaterial(material); setIsDialogOpen(true); }}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(material.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
            <DialogTitle>{selectedMaterial ? 'Edit Raw Material' : 'Add New Raw Material'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
            <div><Label>Code</Label><Input {...form.register('code')} />{form.formState.errors.code && <p className="text-destructive text-sm">{form.formState.errors.code.message}</p>}</div>
            <div><Label>Name</Label><Input {...form.register('name')} />{form.formState.errors.name && <p className="text-destructive text-sm">{form.formState.errors.name.message}</p>}</div>
            <div><Label>Unit of Measure</Label><Input {...form.register('unit_of_measure')} placeholder="e.g., kg, meters, units" /></div>
            <div><Label>Opening Stock</Label><Input type="number" {...form.register('current_stock')} /></div>
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

export default RawMaterialManager;