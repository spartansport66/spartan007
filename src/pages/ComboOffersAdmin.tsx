import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { showSuccess, showError } from '@/utils/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Plus, Trash2, Edit2, Save, X } from 'lucide-react';
import { MadeWithDyad } from '@/components/made-with-dyad';

interface Product {
  id: string;
  name: string;
  code: string;
  size: string;
  dp: number;
  gst: number;
}

interface ComboItem {
  id: string;
  product_id: string;
  product_name: string;
  product_code: string;
  quantity: number;
  discount_percent: number;
  gst_percent: number;
  unit_price: number;
}

interface Combo {
  combo_id: string;
  combo_code?: string;
  combo_name: string;
  combo_description: string;
  combo_category: string;
  combo_dp: number;
  combo_gst: number;
  is_active: boolean;
  item_count?: number;
  items?: ComboItem[];
}

const ComboOffersAdmin = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading: sessionLoading } = useSession();

  // State for combo management
  const [combos, setCombos] = useState<Combo[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCombo, setSelectedCombo] = useState<Combo | null>(null);
  const [isCreatingCombo, setIsCreatingCombo] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Form state for combo creation
  const [newCombo, setNewCombo] = useState({
    code: '',
    name: '',
    description: '',
    category: '',
    combo_dp: 0,
    combo_gst: 0,
  });

  // Form state for adding items to combo
  const [selectedProductId, setSelectedProductId] = useState('');
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemDiscount, setItemDiscount] = useState(0);
  const [itemGst, setItemGst] = useState(18);
  const [productSearch, setProductSearch] = useState('');

  const [isEditingCombo, setIsEditingCombo] = useState(false);

  // Check authorization
  useEffect(() => {
    if (!sessionLoading && !isAdmin) {
      showError('Access Denied. Admin only.');
      navigate('/dashboard');
    }
  }, [sessionLoading, isAdmin, navigate]);

  // Fetch combos
  const fetchCombos = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .rpc('get_all_active_combos_with_items');
      
      if (error) {
        console.error('Combo fetch error:', error);
        throw error;
      }
      console.log('Combos fetched:', data);
      setCombos(data || []);
      return data || [];
    } catch (error: any) {
      showError(`Failed to fetch combos: ${error.message}`);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh selected combo with fresh data
  const refreshSelectedCombo = async () => {
    if (!selectedCombo) return;
    
    try {
      const { data, error } = await supabase
        .rpc('get_all_active_combos_with_items');
      
      if (error) throw error;
      
      const updatedCombo = data?.find((c: Combo) => c.combo_id === selectedCombo.combo_id);
      if (updatedCombo) {
        setSelectedCombo(updatedCombo);
      }
    } catch (error: any) {
      showError(`Failed to refresh combo: ${error.message}`);
    }
  };

  // Fetch products
  const fetchProducts = async () => {
    try {
      const allProducts: Product[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('products')
          .select('id, name, code, size, dp, gst')
          .range(offset, offset + 999)
          .order('name');

        if (error) throw error;
        if (!data?.length) {
          hasMore = false;
        } else {
          allProducts.push(...data);
          offset += 1000;
        }
      }

      setProducts(allProducts);
    } catch (error: any) {
      showError(`Failed to fetch products: ${error.message}`);
    }
  };

  // Filter products based on search input (name and code)
  const filteredProducts = products.filter((product) =>
    product.code.toLowerCase().includes(productSearch.toLowerCase()) ||
    product.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  useEffect(() => {
    if (!sessionLoading && isAdmin) {
      fetchCombos();
      fetchProducts();
    }
  }, [sessionLoading, isAdmin]);

  // Create new combo
  const handleCreateCombo = async () => {
    try {
      if (!newCombo.name.trim()) {
        showError('Combo name is required');
        return;
      }
      if (!newCombo.code.trim()) {
        showError('Combo code is required');
        return;
      }

      const { data, error } = await supabase
        .from('product_combos')
        .insert([
          {
            code: newCombo.code,
            name: newCombo.name,
            description: newCombo.description,
            category: newCombo.category,
            combo_dp: newCombo.combo_dp,
            combo_gst: newCombo.combo_gst,
            is_active: true,
          },
        ])
        .select();

      if (error) throw error;

      showSuccess(`Combo "${newCombo.name}" created successfully`);
      setNewCombo({ code: '', name: '', description: '', category: '', combo_dp: 0, combo_gst: 0 });
      setIsCreatingCombo(false);
      fetchCombos();
    } catch (error: any) {
      showError(`Failed to create combo: ${error.message}`);
    }
  };

  // Add item to combo
  const handleAddItemToCombo = async () => {
    try {
      if (!selectedCombo || !selectedProductId) {
        showError('Please select a product');
        return;
      }

      const { error } = await supabase
        .from('product_combo_items')
        .insert([
          {
            combo_id: selectedCombo.combo_id,
            product_id: selectedProductId,
            quantity: itemQuantity,
            discount_percent: itemDiscount,
            gst_percent: itemGst,
          },
        ]);

      if (error) throw error;

      showSuccess('Item added to combo');
      setSelectedProductId('');
      setProductSearch('');
      setItemQuantity(1);
      setItemDiscount(0);
      setItemGst(18);
      await fetchCombos();
      await refreshSelectedCombo();
    } catch (error: any) {
      showError(`Failed to add item: ${error.message}`);
    }
  };

  // Handle product selection and auto-fill GST
  const handleProductSelection = (productId: string) => {
    setSelectedProductId(productId);
    
    // Find the selected product and auto-fill its GST
    const selectedProduct = products.find(p => p.id === productId);
    if (selectedProduct) {
      const gstValue = parseFloat(selectedProduct.gst as any) || 18;
      const gstDisplay = gstValue > 0 && gstValue <= 1 ? gstValue * 100 : gstValue;
      setItemGst(parseFloat(gstDisplay.toString()) || 18);
      console.log(`[DEBUG] Selected product: ${selectedProduct.name}, GST: ${gstDisplay}`);
    }
  };

  // Remove item from combo
  const handleRemoveItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('product_combo_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      showSuccess('Item removed from combo');
      await fetchCombos();
      await refreshSelectedCombo();
    } catch (error: any) {
      showError(`Failed to remove item: ${error.message}`);
    }
  };

  // Update combo
  const handleUpdateCombo = async () => {
    try {
      if (!selectedCombo) return;

      const { error } = await supabase
        .from('product_combos')
        .update({
          code: selectedCombo.combo_code,
          name: selectedCombo.combo_name,
          description: selectedCombo.combo_description,
          category: selectedCombo.combo_category,
          combo_dp: selectedCombo.combo_dp,
          combo_gst: selectedCombo.combo_gst,
        })
        .eq('id', selectedCombo.combo_id);

      if (error) throw error;

      showSuccess('Combo updated successfully');
      setIsEditingCombo(false);
      fetchCombos();
    } catch (error: any) {
      showError(`Failed to update combo: ${error.message}`);
    }
  };

  // Delete combo
  const handleDeleteCombo = async (comboId: string) => {
    if (!window.confirm('Are you sure you want to delete this combo?')) return;

    try {
      const { error } = await supabase
        .from('product_combos')
        .delete()
        .eq('id', comboId);

      if (error) throw error;

      showSuccess('Combo deleted successfully');
      setSelectedCombo(null);
      fetchCombos();
    } catch (error: any) {
      showError(`Failed to delete combo: ${error.message}`);
    }
  };

  if (sessionLoading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-4xl font-bold">🏏 Combo Offers Management</h1>
            <p className="text-gray-600 mt-2">
              Create product bundles that customers can select as single items in orders
            </p>
          </div>
        </div>

        <Tabs defaultValue="combos" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="combos">All Combos ({combos.length})</TabsTrigger>
            <TabsTrigger value="create">Create New</TabsTrigger>
          </TabsList>

          {/* Tab: All Combos */}
          <TabsContent value="combos" className="space-y-4">
            {isLoading ? (
              <p className="text-center text-gray-500">Loading combos...</p>
            ) : combos.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-gray-500">No combos created yet</p>
                  <p className="text-xs text-gray-400 mt-2">Click "Create New" tab to add your first combo</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-3 gap-6">
                {/* Combo List */}
                <div className="col-span-1">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Combos ({combos.length})</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 max-h-96 overflow-y-auto">
                      {combos.map((combo) => (
                        <div
                          key={combo.combo_id}
                          className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                            selectedCombo?.combo_id === combo.combo_id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <button
                            onClick={() => {
                              setSelectedCombo(combo);
                              setIsEditingCombo(false);
                            }}
                            className="flex-1 text-left"
                          >
                            <div className="font-mono font-bold text-sm">({combo.combo_code || 'N/A'})</div>
                            <div className="font-bold text-sm">{combo.combo_name}</div>
                            <div className="text-xs text-gray-600">
                              {combo.item_count} items
                            </div>
                          </button>
                          <div className="flex gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCombo(combo);
                                setIsEditingCombo(true);
                              }}
                              className="p-1 text-blue-600 hover:bg-blue-200 rounded"
                              title="Edit combo"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteCombo(combo.combo_id);
                              }}
                              className="p-1 text-red-600 hover:bg-red-200 rounded"
                              title="Delete combo"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>

                {/* Combo Details */}
                <div className="col-span-2">
                  {selectedCombo ? (
                    <Card>
                      <CardHeader className="bg-blue-600 text-white">
                        <div className="flex justify-between items-center">
                          <CardTitle>{selectedCombo.combo_name}</CardTitle>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setIsEditingCombo(!isEditingCombo)}
                            className="bg-white text-blue-600 hover:bg-gray-100"
                          >
                            {isEditingCombo ? <X className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-6 p-6">
                        {/* Combo Info */}
                        {isEditingCombo ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label>Code</Label>
                                <Input
                                  value={selectedCombo.combo_code || ''}
                                  onChange={(e) =>
                                    setSelectedCombo({
                                      ...selectedCombo,
                                      combo_code: e.target.value,
                                    })
                                  }
                                />
                              </div>
                              <div>
                                <Label>Name</Label>
                                <Input
                                  value={selectedCombo.combo_name}
                                  onChange={(e) =>
                                    setSelectedCombo({
                                      ...selectedCombo,
                                      combo_name: e.target.value,
                                    })
                                  }
                                />
                              </div>
                            </div>
                            <div>
                              <Label>Description</Label>
                              <Textarea
                                value={selectedCombo.combo_description || ''}
                                onChange={(e) =>
                                  setSelectedCombo({
                                    ...selectedCombo,
                                    combo_description: e.target.value,
                                  })
                                }
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label>Category</Label>
                                <Input
                                  value={selectedCombo.combo_category || ''}
                                  onChange={(e) =>
                                    setSelectedCombo({
                                      ...selectedCombo,
                                      combo_category: e.target.value,
                                    })
                                  }
                                />
                              </div>
                              <div>
                                <Label>Combo Price (DP)</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={selectedCombo.combo_dp}
                                  onChange={(e) =>
                                    setSelectedCombo({
                                      ...selectedCombo,
                                      combo_dp: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label>Combo GST %</Label>
                                <Input
                                  type="number"
                                  value={selectedCombo.combo_gst}
                                  onChange={(e) =>
                                    setSelectedCombo({
                                      ...selectedCombo,
                                      combo_gst: parseFloat(e.target.value),
                                    })
                                  }
                                />
                              </div>
                            </div>
                            <Button
                              onClick={handleUpdateCombo}
                              className="w-full bg-green-600 hover:bg-green-700"
                            >
                              <Save className="h-4 w-4 mr-2" />
                              Save Changes
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-sm text-gray-600">
                              {selectedCombo.combo_description}
                            </p>
                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <span className="text-xs text-gray-500">Code</span>
                                <p className="font-mono font-bold">{selectedCombo.combo_code || '—'}</p>
                              </div>
                              <div>
                                <span className="text-xs text-gray-500">Category</span>
                                <p className="font-bold">{selectedCombo.combo_category || '—'}</p>
                              </div>
                              <div>
                                <span className="text-xs text-gray-500">Combo GST %</span>
                                <p className="font-bold">{selectedCombo.combo_gst}%</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {!isEditingCombo && (
                          <>
                            {/* Items in Combo */}
                            <div>
                              <h3 className="font-bold text-lg mb-4">Items in Combo</h3>
                              {selectedCombo.items && selectedCombo.items.length > 0 ? (
                                <div className="overflow-x-auto border rounded-lg">
                                  <table className="w-full text-sm">
                                    <thead className="bg-gray-100">
                                      <tr>
                                        <th className="px-3 py-2 text-left font-bold">Product</th>
                                        <th className="px-3 py-2 text-center font-bold">Qty</th>
                                        <th className="px-3 py-2 text-center font-bold">Disc %</th>
                                        <th className="px-3 py-2 text-center font-bold">GST %</th>
                                        <th className="px-3 py-2 text-right font-bold">Price</th>
                                        <th className="px-3 py-2"></th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {selectedCombo.items && selectedCombo.items.filter(item => item && item.id).map((item) => (
                                        <tr key={item.id} className="border-b">
                                          <td className="px-3 py-2">
                                            <div className="font-mono text-blue-600 font-bold">
                                              {item.product_code}
                                            </div>
                                            <div className="text-xs text-gray-600">
                                              {item.product_name}
                                            </div>
                                          </td>
                                          <td className="px-3 py-2 text-center font-bold">
                                            {item.quantity}
                                          </td>
                                          <td className="px-3 py-2 text-center">
                                            {item.discount_percent}%
                                          </td>
                                          <td className="px-3 py-2 text-center">
                                            {item.gst_percent}%
                                          </td>
                                          <td className="px-3 py-2 text-right font-bold">
                                            ₹{item.unit_price ? item.unit_price.toFixed(2) : '0.00'}
                                          </td>
                                          <td className="px-3 py-2 text-center">
                                            <button
                                              onClick={() => handleRemoveItem(item.id)}
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
                                <p className="text-gray-500 text-sm">No items in this combo yet</p>
                              )}
                              {selectedCombo.items && selectedCombo.items.filter(item => item && item.id).length > 0 && (
                                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                  <div className="grid grid-cols-3 gap-4">
                                    <div>
                                      <span className="text-xs text-gray-500">Total Items</span>
                                      <p className="text-2xl font-bold text-blue-600">
                                        {selectedCombo.items.filter(item => item && item.id).length}
                                      </p>
                                    </div>
                                    <div>
                                      <span className="text-xs text-gray-500">Total Quantity</span>
                                      <p className="text-2xl font-bold text-green-600">
                                        {selectedCombo.items
                                          .filter(item => item && item.id)
                                          .reduce((sum, item) => sum + item.quantity, 0)}
                                      </p>
                                    </div>
                                    <div>
                                      <span className="text-xs text-gray-500">Total Product Price</span>
                                      <p className="text-2xl font-bold text-purple-600">
                                        ₹{selectedCombo.items
                                          .filter(item => item && item.id)
                                          .reduce((sum, item) => sum + (item.unit_price || 0) * item.quantity, 0)
                                          .toFixed(2)}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Add Item Section */}
                            <Card className="bg-gray-50 border-gray-300">
                              <CardHeader className="pb-3">
                                <CardTitle className="text-base">Add Product to Combo</CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                <div>
                                  <Label>Product</Label>
                                  <Select value={selectedProductId} onValueChange={handleProductSelection}>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select a product" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-96">
                                      <div className="p-2">
                                        <Input
                                          placeholder="Search by code or name..."
                                          value={productSearch}
                                          onChange={(e) => setProductSearch(e.target.value)}
                                          className="h-8 text-sm"
                                        />
                                      </div>
                                      {filteredProducts.map((product) => (
                                        <SelectItem key={product.id} value={product.id}>
                                          {product.code} - {product.name}
                                        </SelectItem>
                                      ))}
                                      {filteredProducts.length === 0 && (
                                        <div className="p-2 text-sm text-gray-500 text-center">
                                          No products found
                                        </div>
                                      )}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label>Quantity</Label>
                                    <Input
                                      type="number"
                                      min="1"
                                      value={itemQuantity}
                                      onChange={(e) => setItemQuantity(parseInt(e.target.value) || 1)}
                                    />
                                  </div>
                                  <div>
                                    <Label>Discount %</Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="0.01"
                                      value={itemDiscount}
                                      onChange={(e) => setItemDiscount(parseFloat(e.target.value) || 0)}
                                    />
                                  </div>
                                </div>

                                <div>
                                  <Label>GST % (Auto-filled from Product)</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    value={itemGst}
                                    onChange={(e) => setItemGst(parseFloat(e.target.value) || 18)}
                                    placeholder="Auto-filled when product is selected"
                                  />
                                  <p className="text-xs text-gray-500 mt-1">GST is automatically filled from the product database. You can manually override if needed.</p>
                                </div>

                                <Button
                                  onClick={handleAddItemToCombo}
                                  className="w-full bg-green-600 hover:bg-green-700"
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Add Item to Combo
                                </Button>
                              </CardContent>
                            </Card>

                            {/* Delete Combo Button */}
                            <Button
                              onClick={() => handleDeleteCombo(selectedCombo.combo_id)}
                              className="w-full bg-red-600 hover:bg-red-700"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Combo
                            </Button>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="pt-6 text-center">
                        <p className="text-gray-500">Select a combo from the list to view details</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Tab: Create New Combo */}
          <TabsContent value="create">
            <Card>
              <CardHeader>
                <CardTitle>Create New Combo Offer</CardTitle>
                <CardDescription>Bundle multiple products into a single combo item</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Combo Code *</Label>
                      <Input
                        placeholder="e.g., CB001, BUNDLE-KIT"
                        value={newCombo.code}
                        onChange={(e) => setNewCombo({ ...newCombo, code: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Combo Name *</Label>
                      <Input
                        placeholder="e.g., Beginner Cricket Kit, Professional Bundle"
                        value={newCombo.name}
                        onChange={(e) => setNewCombo({ ...newCombo, name: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Description</Label>
                    <Textarea
                      placeholder="Describe what's included in this combo"
                      value={newCombo.description}
                      onChange={(e) => setNewCombo({ ...newCombo, description: e.target.value })}
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Category</Label>
                      <Input
                        placeholder="e.g., Bundles, Offers"
                        value={newCombo.category}
                        onChange={(e) => setNewCombo({ ...newCombo, category: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Combo GST %</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={newCombo.combo_gst}
                        onChange={(e) =>
                          setNewCombo({ ...newCombo, combo_gst: parseFloat(e.target.value) || 0 })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Combo DP (Price)</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={newCombo.combo_dp}
                      onChange={(e) =>
                        setNewCombo({ ...newCombo, combo_dp: parseFloat(e.target.value) || 0 })
                      }
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={handleCreateCombo}
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Combo
                    </Button>
                    <Button
                      onClick={() => setIsCreatingCombo(false)}
                      variant="outline"
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <MadeWithDyad />
    </div>
  );
};

export default ComboOffersAdmin;
