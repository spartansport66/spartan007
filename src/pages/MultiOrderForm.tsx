import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { showSuccess, showError } from '@/utils/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ComboSelector from '@/components/ComboSelector';
import { ArrowLeft, Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { MadeWithDyad } from '@/components/made-with-dyad';

interface Product {
  id: string;
  name: string;
  code: string;
  size: string;
  dp: number;
  gst: number;
}

interface OrderItem {
  id: string;
  combo_id?: string;
  combo_name?: string;
  product_id: string;
  product_name: string;
  product_code: string;
  quantity: number;
  discount_percent: number;
  gst_percent: number;
  unit_price: number;
  size?: string;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
}

const MultiOrderForm = () => {
  console.log('🚀 MultiOrderForm component loaded!');
  const navigate = useNavigate();
  const { user, loading: sessionLoading } = useSession();

  // State
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [combos, setCombos] = useState<any[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Form state
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  // Product selection state
  const [selectedProductId, setSelectedProductId] = useState('');
  const [productQty, setProductQty] = useState(1);
  const [productDiscount, setProductDiscount] = useState(0);
  const [productGst, setProductGst] = useState(18);

  // Fetch products
  const fetchProducts = async () => {
    try {
      setIsLoadingProducts(true);
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
    } finally {
      setIsLoadingProducts(false);
    }
  };

  // Fetch combos
  const fetchCombos = async () => {
    try {
      console.log('🔄 Fetching combos...');
      const { data, error } = await supabase
        .rpc('get_all_active_combos_with_items');
      
      if (error) {
        console.error('❌ Combo fetch error:', error);
        throw error;
      }
      console.log('✅ Raw combo data:', data);
      console.log('📊 Combo count:', data?.length);
      if (data && data.length > 0) {
        console.log('📋 First combo:', data[0]);
      }
      setCombos(data || []);
      if (data && data.length > 0) {
        showSuccess(`✓ Loaded ${data.length} combo(s)`);
      } else {
        console.warn('⚠️ No combos returned from RPC');
      }
    } catch (error: any) {
      console.error('❌ Failed to fetch combos:', error.message);
      showError(`Failed to fetch combos: ${error.message}`);
    }
  };

  // Fetch customers
  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, email, phone')
        .order('name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (error: any) {
      showError(`Failed to fetch customers: ${error.message}`);
    }
  };

  useEffect(() => {
    console.log('🔍 useEffect triggered! sessionLoading:', sessionLoading);
    console.log('📱 Component mounted, fetching data...');
    if (!sessionLoading) {
      console.log('✅ sessionLoading is false, calling fetch functions...');
      fetchProducts();
      fetchCombos();
      fetchCustomers();
    } else {
      console.log('⏳ sessionLoading is still true, waiting...');
    }
  }, [sessionLoading]);

  // Add individual product
  const handleAddProduct = () => {
    if (!selectedProductId) {
      showError('Please select a product or combo');
      return;
    }

    // Check if it's a combo selection
    if (selectedProductId.startsWith('combo_')) {
      const comboId = selectedProductId.replace('combo_', '');
      const combo = combos.find((c) => c.combo_id === comboId);
      
      if (!combo || !combo.items) {
        showError('Combo not found or has no items');
        return;
      }

      // Add all items from the combo with qty and discount applied
      const newItems = combo.items.filter((item: any) => item && item.id).map((item: any, idx: number) => ({
        id: `${Date.now()}_${idx}`,
        product_id: item.product_id,
        product_name: item.product_name,
        product_code: item.product_code,
        quantity: item.quantity * productQty,  // Multiply by selected quantity
        discount_percent: productDiscount || item.discount_percent,  // Use selected discount or combo's discount
        gst_percent: item.gst_percent,
        unit_price: item.unit_price,
        size: item.size,
        combo_name: combo.combo_name,
        combo_id: combo.combo_id,
      }));

      setOrderItems((prev) => [...prev, ...newItems]);
      showSuccess(`Added "${combo.combo_name}" combo (${combo.items.length} items) with qty ${productQty}`);
    } else {
      // Regular product selection
      const product = products.find((p) => p.id === selectedProductId);
      if (!product) return;

      const newItem: OrderItem = {
        id: `${Date.now()}_${Math.random()}`,
        product_id: product.id,
        product_name: product.name,
        product_code: product.code,
        quantity: productQty,
        discount_percent: productDiscount,
        gst_percent: productGst,
        unit_price: product.dp,
        size: product.size,
      };

      setOrderItems((prev) => [...prev, newItem]);
    }

    setSelectedProductId('');
    setProductQty(1);
    setProductDiscount(0);
    setProductGst(18);
  };

  // Add items from combo
  const handleAddItemsFromCombo = (items: any[]) => {
    const newItems = items.map((item, idx) => ({
      id: `${Date.now()}_${idx}`,
      ...item,
    }));
    setOrderItems((prev) => [...prev, ...newItems]);
  };

  // Remove item
  const handleRemoveItem = (id: string) => {
    setOrderItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Update item
  const handleUpdateItem = (id: string, field: string, value: any) => {
    setOrderItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  // Calculate totals
  const calculateItemTotal = (item: OrderItem) => {
    const subtotal = item.unit_price * item.quantity;
    const discountAmount = subtotal * (item.discount_percent / 100);
    const afterDiscount = subtotal - discountAmount;
    const gstAmount = afterDiscount * (item.gst_percent / 100);
    return afterDiscount + gstAmount;
  };

  const calculateOrderTotal = () => {
    return orderItems.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  };

  const calculateSubtotal = () => {
    return orderItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  };

  // Submit order
  const handleSubmitOrder = async () => {
    try {
      if (!selectedCustomerId) {
        showError('Please select a customer');
        return;
      }

      if (orderItems.length === 0) {
        showError('Please add at least one item to the order');
        return;
      }

      setIsSubmitting(true);

      // Create order (you may need to adjust this based on your order schema)
      const orderData = {
        customer_id: selectedCustomerId,
        order_date: new Date().toISOString(),
        status: 'pending',
        notes: orderNotes,
        total_amount: calculateOrderTotal(),
        items: orderItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          discount_percent: item.discount_percent,
          gst_percent: item.gst_percent,
          unit_price: item.unit_price,
          combo_id: item.combo_id,
        })),
      };

      // Log order data (replace with actual API call)
      console.log('Order data:', orderData);

      showSuccess('Order created successfully!');
      // Reset form
      setOrderItems([]);
      setSelectedCustomerId('');
      setOrderNotes('');
    } catch (error: any) {
      showError(`Failed to create order: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (sessionLoading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
      </div>
    );
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
            <h1 className="text-4xl font-bold">🏏 Create Multi-Item Order</h1>
            <p className="text-gray-600 mt-2">
              Add products individually or select pre-configured combos
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Left Panel: Add Items */}
          <div className="col-span-1 space-y-6">
            {/* Customer Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">👤 Select Customer</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name} ({customer.phone})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Add Individual Product */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">➕ Add Product</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Product / Combo</Label>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs">
                      {combos.length > 0 && (
                        <p className="text-green-600 font-semibold">✓ {combos.length} combo(s) loaded</p>
                      )}
                      {combos.length === 0 && products.length > 0 && (
                        <p className="text-orange-600">⚠ No active combos found</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        console.log('Refreshing combos...');
                        fetchCombos();
                      }}
                      className="text-xs h-6"
                    >
                      🔄 Refresh
                    </Button>
                  </div>
                  <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select product or combo" />
                    </SelectTrigger>
                    <SelectContent className="max-h-96 w-96">
                      {/* Combos Section */}
                      {combos.length > 0 && combos.map((combo) => (
                        <SelectItem key={`combo_${combo.combo_id}`} value={`combo_${combo.combo_id}`} className="font-semibold text-purple-600">
                          🎁 {combo.combo_name} ({combo.item_count} items)
                        </SelectItem>
                      ))}
                      {/* Products Section */}
                      {products.length > 0 && products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.code} - {product.name}
                        </SelectItem>
                      ))}
                      {/* Empty State */}
                      {combos.length === 0 && products.length === 0 && (
                        <div className="py-2 px-8 text-sm text-gray-500 text-center">
                          No products or combos available
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Qty</Label>
                    <Input
                      type="number"
                      min="1"
                      value={productQty}
                      onChange={(e) => setProductQty(parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Disc %</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={productDiscount}
                      onChange={(e) => setProductDiscount(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">GST %</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={productGst}
                    onChange={(e) => setProductGst(parseFloat(e.target.value) || 18)}
                  />
                </div>

                <Button onClick={handleAddProduct} className="w-full bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </Button>
              </CardContent>
            </Card>

            {/* Add from Combo */}
            <ComboSelector onItemsAdded={handleAddItemsFromCombo} />
          </div>

          {/* Right Panel: Order Summary */}
          <div className="col-span-2">
            <Card className="sticky top-8">
              <CardHeader className="bg-blue-600 text-white">
                <CardTitle>📋 Order Items ({orderItems.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {orderItems.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    👈 Add products or select a combo to start building your order
                  </p>
                ) : (
                  <div className="space-y-4">
                    {/* Items Table */}
                    <div className="overflow-x-auto border rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-3 py-2 text-left font-bold">Product</th>
                            <th className="px-3 py-2 text-center font-bold">Qty</th>
                            <th className="px-3 py-2 text-center font-bold">Disc %</th>
                            <th className="px-3 py-2 text-center font-bold">GST %</th>
                            <th className="px-3 py-2 text-right font-bold">Total</th>
                            <th className="px-3 py-2"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {orderItems.map((item) => (
                            <tr key={item.id} className="border-b hover:bg-gray-50">
                              <td className="px-3 py-2">
                                {item.combo_name && (
                                  <div className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded mb-1 inline-block">
                                    COMBO: {item.combo_name}
                                  </div>
                                )}
                                <div className="font-mono text-blue-600 font-bold">
                                  {item.product_code}
                                </div>
                                <div className="text-gray-700 text-xs">
                                  {item.product_name}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) =>
                                    handleUpdateItem(item.id, 'quantity', parseInt(e.target.value) || 1)
                                  }
                                  className="w-12 text-center border rounded px-1 py-1 text-sm"
                                />
                              </td>
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.discount_percent}
                                  onChange={(e) =>
                                    handleUpdateItem(
                                      item.id,
                                      'discount_percent',
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  className="w-14 text-center border rounded px-1 py-1 text-sm"
                                />
                              </td>
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.gst_percent}
                                  onChange={(e) =>
                                    handleUpdateItem(
                                      item.id,
                                      'gst_percent',
                                      parseFloat(e.target.value) || 18
                                    )
                                  }
                                  className="w-14 text-center border rounded px-1 py-1 text-sm"
                                />
                              </td>
                              <td className="px-3 py-2 text-right font-bold text-green-700">
                                ₹{calculateItemTotal(item).toFixed(2)}
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

                    {/* Order Summary */}
                    <div className="bg-gradient-to-r from-green-50 to-blue-50 p-6 rounded-lg border-2 border-green-300 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Subtotal:</span>
                        <span className="font-bold">₹{calculateSubtotal().toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold text-green-700 border-t pt-2">
                        <span>Order Total:</span>
                        <span>₹{calculateOrderTotal().toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Order Notes */}
                    <div>
                      <Label className="text-sm font-bold">Order Notes</Label>
                      <Textarea
                        placeholder="Add any special instructions or notes..."
                        value={orderNotes}
                        onChange={(e) => setOrderNotes(e.target.value)}
                        rows={3}
                        className="mt-2"
                      />
                    </div>

                    {/* Submit Button */}
                    <Button
                      onClick={handleSubmitOrder}
                      disabled={isSubmitting || orderItems.length === 0 || !selectedCustomerId}
                      className="w-full bg-green-600 hover:bg-green-700 text-white h-12 text-lg font-bold"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save Order
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <MadeWithDyad />
    </div>
  );
};

export default MultiOrderForm;
