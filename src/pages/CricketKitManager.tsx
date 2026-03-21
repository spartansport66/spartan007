import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Plus, Edit2 } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  code: string;
  dp: number;
  gst: string;
}

interface KitItem {
  id: string;
  product_id: string;
  product_name: string;
  product_code: string;
  product_dp: number;
  quantity: number;
  discount_percent: number;
  gst_percent: number;
}

interface CricketKit {
  id: string;
  name: string;
  description: string;
  category: string;
  is_active: boolean;
  items?: KitItem[];
}

const CricketKitManager = () => {
  const [kits, setKits] = useState<CricketKit[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKit, setSelectedKit] = useState<CricketKit | null>(null);
  const [newKitName, setNewKitName] = useState('');
  const [newKitDescription, setNewKitDescription] = useState('');
  const [newKitCategory, setNewKitCategory] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [itemQty, setItemQty] = useState(1);
  const [itemDiscount, setItemDiscount] = useState(0);
  const [itemGst, setItemGst] = useState(0);

  useEffect(() => {
    fetchKits();
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      let allProducts: Product[] = [];
      let offset = 0;

      while (true) {
        const { data, error } = await supabase
          .from('products')
          .select('id, name, code, dp, gst')
          .order('name')
          .range(offset, offset + 999);

        if (error) throw error;
        if (!data || data.length === 0) break;

        allProducts = [...allProducts, ...data];
        if (data.length < 1000) break;
        offset += 1000;
      }

      setProducts(allProducts);
    } catch (err) {
      console.error('Failed to fetch products:', err);
    }
  };

  const fetchKits = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cricket_kits')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      // Fetch items for each kit
      const kitsWithItems = await Promise.all(
        (data || []).map(async (kit) => {
          const { data: itemsData } = await supabase
            .rpc('get_cricket_kit_details', { kit_id_param: kit.id });
          return {
            ...kit,
            items: itemsData || []
          };
        })
      );

      setKits(kitsWithItems);
    } catch (err) {
      console.error('Failed to fetch kits:', err);
    } finally {
      setLoading(false);
    }
  };

  const createKit = async () => {
    if (!newKitName.trim()) {
      alert('Kit name required');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('cricket_kits')
        .insert({
          name: newKitName,
          description: newKitDescription,
          category: newKitCategory || 'General'
        })
        .select()
        .single();

      if (error) throw error;

      setNewKitName('');
      setNewKitDescription('');
      setNewKitCategory('');
      setSelectedKit(data);
      fetchKits();
    } catch (err) {
      console.error('Failed to create kit:', err);
      alert('Failed to create kit');
    }
  };

  const addItemToKit = async () => {
    if (!selectedKit || !selectedProduct) {
      alert('Select kit and product');
      return;
    }

    try {
      const { error } = await supabase
        .from('cricket_kit_items')
        .insert({
          kit_id: selectedKit.id,
          product_id: selectedProduct,
          quantity: itemQty,
          discount_percent: itemDiscount,
          gst_percent: itemGst
        });

      if (error) throw error;

      setSelectedProduct('');
      setItemQty(1);
      setItemDiscount(0);
      setItemGst(0);
      fetchKits();
    } catch (err) {
      console.error('Failed to add item:', err);
      alert('Failed to add item to kit');
    }
  };

  const removeItemFromKit = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('cricket_kit_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
      fetchKits();
    } catch (err) {
      console.error('Failed to remove item:', err);
    }
  };

  const deleteKit = async (kit: CricketKit) => {
    if (!confirm(`Delete kit "${kit.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('cricket_kits')
        .update({ is_active: false })
        .eq('id', kit.id);

      if (error) throw error;
      fetchKits();
      setSelectedKit(null);
    } catch (err) {
      console.error('Failed to delete kit:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-4xl font-bold">🏏 Cricket Kit Manager</h1>
          <Button onClick={fetchKits} className="bg-blue-600">Refresh</Button>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Left Panel - Create/Manage Kits */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="bg-blue-600 text-white">
                <CardTitle>Create New Kit</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <Input
                  placeholder="Kit Name (e.g., Complete Batsman Kit)"
                  value={newKitName}
                  onChange={(e) => setNewKitName(e.target.value)}
                />
                <Input
                  placeholder="Description"
                  value={newKitDescription}
                  onChange={(e) => setNewKitDescription(e.target.value)}
                />
                <Input
                  placeholder="Category (e.g., Batsman, Bowler, Wicket Keeper)"
                  value={newKitCategory}
                  onChange={(e) => setNewKitCategory(e.target.value)}
                />
                <Button onClick={createKit} className="w-full bg-green-600">
                  <Plus className="mr-2 h-4 w-4" /> Create Kit
                </Button>
              </CardContent>
            </Card>

            {/* Kits List */}
            <Card>
              <CardHeader className="bg-gray-700 text-white">
                <CardTitle>Available Kits ({kits.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-2">
                  {loading ? (
                    <p>Loading kits...</p>
                  ) : kits.length === 0 ? (
                    <p className="text-gray-500">No kits created yet</p>
                  ) : (
                    kits.map((kit) => (
                      <div
                        key={kit.id}
                        onClick={() => setSelectedKit(kit)}
                        className={`p-3 border rounded cursor-pointer transition ${
                          selectedKit?.id === kit.id
                            ? 'bg-blue-100 border-blue-600'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="font-bold text-gray-800">{kit.name}</div>
                        <div className="text-sm text-gray-600">
                          {kit.items?.length || 0} items
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Add Items to Selected Kit */}
          {selectedKit && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="bg-green-600 text-white">
                  <CardTitle>📦 {selectedKit.name}</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <p className="text-sm text-gray-600">{selectedKit.description}</p>
                  <p className="text-xs text-gray-500">Category: {selectedKit.category}</p>

                  {/* Add Item Form */}
                  <div className="border-t pt-4 space-y-3">
                    <label className="font-semibold text-sm">Add Product to Kit</label>
                    <select
                      value={selectedProduct}
                      onChange={(e) => setSelectedProduct(e.target.value)}
                      className="w-full border rounded p-2 text-sm"
                    >
                      <option value="">Select Product...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.code} - {p.name}
                        </option>
                      ))}
                    </select>

                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        type="number"
                        placeholder="Qty"
                        value={itemQty}
                        onChange={(e) => setItemQty(parseInt(e.target.value) || 1)}
                        min="1"
                      />
                      <Input
                        type="number"
                        placeholder="Discount %"
                        value={itemDiscount}
                        onChange={(e) => setItemDiscount(parseFloat(e.target.value) || 0)}
                        step="0.1"
                      />
                      <Input
                        type="number"
                        placeholder="GST %"
                        value={itemGst}
                        onChange={(e) => setItemGst(parseFloat(e.target.value) || 0)}
                        step="0.1"
                      />
                    </div>

                    <Button onClick={addItemToKit} className="w-full bg-blue-600">
                      <Plus className="mr-2 h-4 w-4" /> Add Item to Kit
                    </Button>
                  </div>

                  {/* Items in Kit */}
                  <div className="border-t pt-4">
                    <label className="font-semibold text-sm">Items in Kit</label>
                    {selectedKit.items && selectedKit.items.length > 0 ? (
                      <div className="overflow-x-auto mt-2">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-2 py-1 text-left">Product</th>
                              <th className="px-2 py-1 text-center">Qty</th>
                              <th className="px-2 py-1 text-center">Disc %</th>
                              <th className="px-2 py-1 text-center">GST %</th>
                              <th className="px-2 py-1">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedKit.items.map((item) => (
                              <tr key={item.id} className="border-b hover:bg-gray-50">
                                <td className="px-2 py-1">
                                  <div className="font-mono text-blue-600">{item.product_code}</div>
                                  <div className="text-gray-700">{item.product_name}</div>
                                </td>
                                <td className="px-2 py-1 text-center font-bold">
                                  {item.quantity}
                                </td>
                                <td className="px-2 py-1 text-center">
                                  {item.discount_percent}%
                                </td>
                                <td className="px-2 py-1 text-center">
                                  {item.gst_percent}%
                                </td>
                                <td className="px-2 py-1 text-center">
                                  <button
                                    onClick={() => removeItemFromKit(item.id)}
                                    className="text-red-600 hover:text-red-800"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm mt-2">No items in kit yet</p>
                    )}
                  </div>

                  <Button
                    onClick={() => deleteKit(selectedKit)}
                    className="w-full bg-red-600 text-white"
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete Kit
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CricketKitManager;
