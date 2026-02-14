"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, PlusCircle, Trash2, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Product {
  id: string;
  name: string;
  code: string;
}

interface RawMaterial {
  id: string;
  name: string;
  code: string;
}

interface BomItem {
  id: string; // This will be the raw_material_id
  name: string;
  code: string;
  quantity_required: number;
}

const BillOfMaterialsManager: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [bomItems, setBomItems] = useState<BomItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // New item form state
  const [newItemMaterialId, setNewItemMaterialId] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState(1);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [productsRes, materialsRes] = await Promise.all([
        supabase.from('products').select('id, name, code').order('name'),
        supabase.from('raw_materials').select('id, name, code').order('name'),
      ]);
      if (productsRes.error) throw productsRes.error;
      if (materialsRes.error) throw materialsRes.error;
      setProducts(productsRes.data || []);
      setRawMaterials(materialsRes.data || []);
    } catch (error: any) {
      showError(`Failed to load initial data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchBomForProduct = useCallback(async (productId: string) => {
    if (!productId) {
      setBomItems([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bill_of_materials')
        .select(`
          raw_material_id,
          quantity_required,
          raw_materials (name, code)
        `)
        .eq('product_id', productId);
      if (error) throw error;
      
      const formattedItems = data.map((item: any) => ({
        id: item.raw_material_id,
        name: item.raw_materials.name,
        code: item.raw_materials.code,
        quantity_required: item.quantity_required,
      }));
      setBomItems(formattedItems);
    } catch (error: any) {
      showError(`Failed to load BOM: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBomForProduct(selectedProductId);
  }, [selectedProductId, fetchBomForProduct]);

  const handleAddItem = () => {
    const material = rawMaterials.find(m => m.id === newItemMaterialId);
    if (!material || newItemQuantity <= 0) {
      showError('Please select a material and enter a valid quantity.');
      return;
    }
    if (bomItems.some(item => item.id === material.id)) {
      showError('This material is already in the BOM.');
      return;
    }
    setBomItems(prev => [...prev, {
      id: material.id,
      name: material.name,
      code: material.code,
      quantity_required: newItemQuantity,
    }]);
    setNewItemMaterialId('');
    setNewItemQuantity(1);
  };

  const handleRemoveItem = (materialId: string) => {
    setBomItems(prev => prev.filter(item => item.id !== materialId));
  };

  const handleSaveBom = async () => {
    if (!selectedProductId) return;
    setIsSaving(true);
    try {
      // Delete existing BOM for the product
      const { error: deleteError } = await supabase
        .from('bill_of_materials')
        .delete()
        .eq('product_id', selectedProductId);
      if (deleteError) throw deleteError;

      // Insert new BOM items
      if (bomItems.length > 0) {
        const itemsToInsert = bomItems.map(item => ({
          product_id: selectedProductId,
          raw_material_id: item.id,
          quantity_required: item.quantity_required,
        }));
        const { error: insertError } = await supabase.from('bill_of_materials').insert(itemsToInsert);
        if (insertError) throw insertError;
      }
      showSuccess('Bill of Materials saved successfully!');
    } catch (error: any) {
      showError(`Failed to save BOM: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manage Bill of Materials (BOM)</CardTitle>
        <CardDescription>Define the raw material "recipe" for each of your finished products.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="max-w-md">
          <Label>Select a Finished Product</Label>
          <Select value={selectedProductId} onValueChange={setSelectedProductId}>
            <SelectTrigger><SelectValue placeholder="Select a product to define its BOM" /></SelectTrigger>
            <SelectContent>
              {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.code})</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {selectedProductId && (
          <>
            <div className="p-4 border rounded-md bg-muted/50">
              <h4 className="font-semibold mb-2">Add Raw Material to BOM</h4>
              <div className="grid grid-cols-3 gap-4 items-end">
                <div className="col-span-2"><Label>Raw Material</Label><Select value={newItemMaterialId} onValueChange={setNewItemMaterialId}><SelectTrigger><SelectValue placeholder="Select Material" /></SelectTrigger><SelectContent>{rawMaterials.map(m => <SelectItem key={m.id} value={m.id}>{m.name} ({m.code})</SelectItem>)}</SelectContent></Select></div>
                <div><Label>Quantity Required</Label><Input type="number" value={newItemQuantity} onChange={e => setNewItemQuantity(Number(e.target.value))} min="0.01" step="0.01" /></div>
              </div>
              <Button onClick={handleAddItem} className="mt-4 w-full"><PlusCircle className="mr-2 h-4 w-4" />Add to BOM</Button>
            </div>

            {loading ? <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div> : (
              <div className="max-h-[40vh] overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Raw Material Code</TableHead>
                      <TableHead>Raw Material Name</TableHead>
                      <TableHead className="text-right">Quantity Required</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bomItems.map(item => (
                      <TableRow key={item.id}>
                        <TableCell>{item.code}</TableCell>
                        <TableCell>{item.name}</TableCell>
                        <TableCell className="text-right">{item.quantity_required}</TableCell>
                        <TableCell><Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <Button onClick={handleSaveBom} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save BOM for this Product
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default BillOfMaterialsManager;