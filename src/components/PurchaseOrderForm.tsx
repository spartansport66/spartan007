"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { Loader2, Plus, Trash2, Check, ChevronsUpDown, ShoppingCart } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface RawMaterial {
  id: string;
  name: string;
  unit_of_measure: string;
  current_stock: number;
}

interface Supplier {
  id: string;
  name: string;
}

interface POItem {
  id: string;
  raw_material_id: string;
  quantity: number;
  unit_price: number;
}

interface PurchaseOrderFormProps {
  onOrderPlaced: () => void;
}

const PurchaseOrderForm: React.FC<PurchaseOrderFormProps> = ({ onOrderPlaced }) => {
  const { user } = useSession();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [poItems, setPoItems] = useState<POItem[]>([{ id: Date.now().toString(), raw_material_id: '', quantity: 1, unit_price: 0 }]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Searchable dropdown states
  const [isSupplierPopoverOpen, setIsSupplierPopoverOpen] = useState(false);
  const [supplierSearchValue, setSupplierSearchValue] = useState("");
  const [popoverOpenStates, setPopoverOpenStates] = useState<Record<string, boolean>>({});
  const [materialSearchValue, setMaterialSearchValue] = useState("");

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: suppliersData, error: suppliersError } = await supabase
        .from('suppliers')
        .select('id, name')
        .order('name', { ascending: true });

      if (suppliersError) throw suppliersError;
      setSuppliers(suppliersData || []);

      const { data: materialsData, error: materialsError } = await supabase
        .from('raw_materials')
        .select('id, name, unit_of_measure, current_stock')
        .order('name', { ascending: true });

      if (materialsError) throw materialsError;
      setRawMaterials(materialsData || []);

    } catch (error: any) {
      console.error('Error fetching initial data:', error.message);
      showError(`Failed to load data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const calculateItemTotal = (item: POItem) => {
    return item.quantity * item.unit_price;
  };

  const calculateTotalOrderValue = () => {
    return poItems.reduce((total, item) => total + calculateItemTotal(item), 0);
  };

  const totalOrderValue = calculateTotalOrderValue();

  const addPOItem = () => {
    setPoItems([...poItems, { id: Date.now().toString(), raw_material_id: '', quantity: 1, unit_price: 0 }]);
    setPopoverOpenStates(prev => ({ ...prev, [Date.now().toString()]: false }));
  };

  const removePOItem = (id: string) => {
    if (poItems.length > 1) {
      setPoItems(poItems.filter(item => item.id !== id));
      setPopoverOpenStates(prev => {
        const newState = { ...prev };
        delete newState[id];
        return newState;
      });
    }
  };

  const updatePOItem = (id: string, field: keyof POItem, value: string | number) => {
    setPoItems(poItems.map(item =>
      item.id === id ? { ...item, [field]: typeof value === 'string' ? parseFloat(value) || 0 : value } : item
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      showError('User not authenticated.');
      return;
    }
    if (!selectedSupplier) {
      showError('Please select a supplier.');
      return;
    }
    if (poItems.some(item => !item.raw_material_id || item.quantity <= 0 || item.unit_price <= 0)) {
      showError('Please fill in all material fields, quantity, and unit price.');
      return;
    }
    if (totalOrderValue <= 0) {
      showError('Total order value must be greater than zero.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Insert the new purchase order
      const { data: newPO, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
          supplier_id: selectedSupplier,
          created_by: user.id,
          total_amount: totalOrderValue,
          expected_delivery_date: expectedDeliveryDate,
          status: 'placed', // Default status upon creation
        })
        .select('id, po_number')
        .single();

      if (poError) throw new Error(`Failed to create Purchase Order: ${poError.message}`);
      if (!newPO) throw new Error('Purchase Order creation failed, no PO ID returned.');

      // 2. Insert PO items
      const poItemsToInsert = poItems.map(item => ({
        purchase_order_id: newPO.id,
        raw_material_id: item.raw_material_id,
        quantity_ordered: item.quantity,
        unit_price: item.unit_price,
        total_price: calculateItemTotal(item),
      }));

      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(poItemsToInsert);

      if (itemsError) throw new Error(`Failed to insert PO items: ${itemsError.message}`);

      showSuccess(`Purchase Order #${newPO.po_number} placed successfully!`);

      // Reset form
      setSelectedSupplier('');
      setPoItems([{ id: Date.now().toString(), raw_material_id: '', quantity: 1, unit_price: 0 }]);
      setExpectedDeliveryDate(new Date().toISOString().split('T')[0]);
      onOrderPlaced();
    } catch (error: any) {
      console.error('Error placing purchase order:', error);
      showError(`Failed to place purchase order: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSuppliers = useMemo(() => {
    if (!supplierSearchValue) return suppliers;
    const lowerCaseSearchValue = supplierSearchValue.toLowerCase();
    return suppliers.filter(supplier => 
      supplier.name.toLowerCase().includes(lowerCaseSearchValue)
    );
  }, [suppliers, supplierSearchValue]);

  const filteredMaterials = useMemo(() => {
    if (!materialSearchValue) return rawMaterials;
    const lowerCaseSearchValue = materialSearchValue.toLowerCase();
    return rawMaterials.filter(material => 
      material.name.toLowerCase().includes(lowerCaseSearchValue)
    );
  }, [rawMaterials, materialSearchValue]);

  const currentSupplierName = selectedSupplier ? suppliers.find(s => s.id === selectedSupplier)?.name : "Select supplier...";

  return (
    <Card className="bg-card text-card-foreground shadow-lg">
      <CardHeader className="bg-purple-600 dark:bg-purple-800 text-white rounded-t-lg p-4">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <ShoppingCart className="h-6 w-6" /> Create New Purchase Order
        </CardTitle>
        <CardDescription className="text-purple-100 dark:text-purple-200">
          Place an order for raw materials with a selected supplier.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Supplier Selection */}
          <div>
            <Label htmlFor="supplier">Supplier</Label>
            <Popover open={isSupplierPopoverOpen} onOpenChange={setIsSupplierPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={isSupplierPopoverOpen}
                  className="w-full justify-between"
                  disabled={suppliers.length === 0 || loading || isSubmitting}
                >
                  {currentSupplierName}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                <Command>
                  <CommandInput
                    placeholder="Search supplier..."
                    value={supplierSearchValue}
                    onValueChange={setSupplierSearchValue}
                  />
                  <CommandList className="max-h-[300px] overflow-y-auto">
                    {filteredSuppliers.length === 0 ? (
                      <CommandEmpty>No supplier found.</CommandEmpty>
                    ) : (
                      <CommandGroup>
                        {filteredSuppliers.map((supplier) => (
                          <CommandItem
                            key={supplier.id}
                            value={supplier.name}
                            onSelect={(currentValue) => {
                              const selected = suppliers.find(s => s.name.toLowerCase() === currentValue.toLowerCase());
                              setSelectedSupplier(selected?.id || '');
                              setIsSupplierPopoverOpen(false);
                              setSupplierSearchValue("");
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedSupplier === supplier.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {supplier.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Expected Delivery Date */}
          <div>
            <Label htmlFor="deliveryDate">Expected Delivery Date</Label>
            <Input
              id="deliveryDate"
              type="date"
              value={expectedDeliveryDate}
              onChange={(e) => setExpectedDeliveryDate(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <Separator />

          {/* PO Items */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label className="text-lg font-semibold">Raw Materials</Label>
              <Button
                type="button"
                onClick={addPOItem}
                size="sm"
                className="flex items-center gap-1"
                disabled={isSubmitting}
              >
                <Plus className="h-4 w-4" />
                Add Item
              </Button>
            </div>

            {poItems.map((item, index) => {
              const material = rawMaterials.find(m => m.id === item.raw_material_id);
              return (
                <div key={item.id} className="space-y-3 p-4 border rounded-md bg-muted/50">
                  <div className="flex items-end gap-2">
                    <div className="flex-grow">
                      <Label>Raw Material</Label>
                      <Popover 
                        open={popoverOpenStates[item.id]} 
                        onOpenChange={(openState) => {
                          setPopoverOpenStates(prev => ({ ...prev, [item.id]: openState }));
                          if (openState) {
                            setMaterialSearchValue("");
                          }
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={popoverOpenStates[item.id]}
                            className="w-full justify-between"
                            disabled={rawMaterials.length === 0 || loading || isSubmitting}
                          >
                            {material?.name || "Select material..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                          <Command>
                            <CommandInput
                              placeholder="Search material..."
                              value={materialSearchValue}
                              onValueChange={setMaterialSearchValue}
                            />
                            <CommandList className="max-h-[300px] overflow-y-auto">
                              {filteredMaterials.length === 0 ? (
                                <CommandEmpty>No material found.</CommandEmpty>
                              ) : (
                                <CommandGroup>
                                  {filteredMaterials.map((material) => (
                                    <CommandItem
                                      key={material.id}
                                      value={material.name}
                                      onSelect={() => {
                                        updatePOItem(item.id, 'raw_material_id', material.id);
                                        setPopoverOpenStates(prev => ({ ...prev, [item.id]: false }));
                                        setMaterialSearchValue("");
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          item.raw_material_id === material.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <div>
                                        <div>{material.name} ({material.unit_of_measure})</div>
                                        <div className="text-xs text-muted-foreground">
                                          Stock: {material.current_stock}
                                        </div>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              )}
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    {poItems.length > 1 && (
                      <div className="flex-shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removePOItem(item.id)}
                          className="h-9 w-9"
                          disabled={isSubmitting}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-4 items-end">
                    <div>
                      <Label>Quantity ({material?.unit_of_measure || 'Units'})</Label>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updatePOItem(item.id, 'quantity', e.target.value)}
                        min="1"
                        className="w-full"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div>
                      <Label>Unit Price (₹)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(e) => updatePOItem(item.id, 'unit_price', e.target.value)}
                        min="0.01"
                        className="w-full"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div>
                      <Label>Item Total</Label>
                      <div className="font-medium text-lg">₹{calculateItemTotal(item).toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total Summary */}
          <div className="p-4 bg-muted rounded-md space-y-2">
            <div className="flex justify-between text-lg font-bold">
              <span>Total Purchase Order Value:</span>
              <span>₹{totalOrderValue.toFixed(2)}</span>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-purple-600 text-white hover:bg-purple-700"
            disabled={isSubmitting || loading || poItems.some(item => !item.raw_material_id || item.quantity <= 0 || item.unit_price <= 0) || totalOrderValue <= 0}
          >
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Place Purchase Order'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default PurchaseOrderForm;