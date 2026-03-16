"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Trash2, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { showError, showSuccess } from '@/utils/toast';

interface Dealer {
  id: string;
  name: string;
}

interface SalesPerson {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  code: string;
  dp: number;
}

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  total_price: number;
}

interface PromotionalOrderFormProps {
  onOrderCreated: () => void;
}

// Sports manufacturing promotion types
const PROMOTION_TYPES = [
  'Sports Kit Giveaway',
  'Jersey Samples',
  'Equipment Trial Pack',
  'Seasonal Clearance',
  'Brand Ambassador Event',
  'Tournament Sponsorship',
  'Athlete Endorsement',
  'Training Camp Materials',
  'Retail Display Setup',
  'Wholesale Partner Gift',
  'Loyalty Reward',
  'New Product Launch',
];

const PromotionalOrderForm: React.FC<PromotionalOrderFormProps> = ({ onOrderCreated }) => {
  const { user } = useSession();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [materialOutType, setMaterialOutType] = useState<'returnable' | 'non_returnable'>('returnable');
  const [promotionType, setPromotionType] = useState('Sports Kit Giveaway');
  const [selectedDealer, setSelectedDealer] = useState<string>('');
  const [selectedSalesPerson, setSelectedSalesPerson] = useState<string>('');

  // Data lists
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [salesPersons, setSalesPersons] = useState<SalesPerson[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Order items
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedProductQty, setSelectedProductQty] = useState<number>(1);
  const [selectedProductDiscount, setSelectedProductDiscount] = useState<number>(0);

  // Fetch dealers, sales persons, and products
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch dealers
        const { data: dealersData, error: dealersError } = await supabase
          .from('dealers')
          .select('id, name')
          .order('name');
        if (dealersError) throw dealersError;
        setDealers(dealersData || []);

        // Fetch sales persons
        const { data: spData, error: spError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .eq('user_type', 'sales_person')
          .order('first_name');
        if (spError) throw spError;
        setSalesPersons(
          (spData || []).map(sp => ({
            id: sp.id,
            name: `${sp.first_name || ''} ${sp.last_name || ''}`.trim(),
          }))
        );

        // Fetch products
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('id, name, code, dp')
          .order('name');
        if (productsError) throw productsError;
        setProducts(productsData || []);
      } catch (error: any) {
        showError(`Failed to load form data: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const addItemToOrder = () => {
    if (!selectedProductId) {
      showError('Please select a product');
      return;
    }

    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;

    const newItem: OrderItem = {
      id: Math.random().toString(),
      product_id: selectedProductId,
      product_name: product.name,
      quantity: selectedProductQty,
      unit_price: product.dp,
      discount_percent: selectedProductDiscount,
      total_price: product.dp * selectedProductQty * (1 - selectedProductDiscount / 100),
    };

    setOrderItems([...orderItems, newItem]);
    setSelectedProductId('');
    setSelectedProductQty(1);
    setSelectedProductDiscount(0);
  };

  const removeItemFromOrder = (itemId: string) => {
    setOrderItems(orderItems.filter(item => item.id !== itemId));
  };

  const calculateTotalAmount = () => {
    return orderItems.reduce((sum, item) => sum + item.total_price, 0);
  };

  const generateAuthToken = () => {
    return `AUTH_${Date.now()}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedDealer) {
      showError('Please select a party');
      return;
    }
    if (!selectedSalesPerson) {
      showError('Please select a sales person');
      return;
    }
    if (orderItems.length === 0) {
      showError('Please add items to the order');
      return;
    }

    setSubmitting(true);
    try {
      // Generate order number
      const { count, error: countError } = await supabase
        .from('promotional_orders')
        .select('*', { count: 'exact', head: true });

      if (countError) throw countError;
      const orderNumber = (count || 0) + 1;

      // Generate auth token for all orders (both returnable and non-returnable)
      const authToken = generateAuthToken();
      const authString = `${authToken}`;

      // Create promotional order
      const { data: orderData, error: orderError } = await supabase
        .from('promotional_orders')
        .insert({
          order_number: orderNumber,
          material_out_type: materialOutType,
          promotion_type: promotionType,
          dealer_id: selectedDealer,
          sales_person_id: selectedSalesPerson,
          created_by: user?.id,
          total_amount: calculateTotalAmount(),
          auth_string: authString,
          auth_token: authToken,
          authorization_status: materialOutType === 'non_returnable' ? 'pending' : null,
          status: 'pending',
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const itemsToInsert = orderItems.map(item => ({
        promotional_order_id: orderData.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_percentage: item.discount_percent,
        total_price: item.total_price,
      }));

      const { error: itemsError } = await supabase
        .from('promotional_order_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      showSuccess(`Promotional order #${orderNumber} created successfully!`);
      onOrderCreated();
    } catch (error: any) {
      showError(`Failed to create order: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Order Type and Promotion Type */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-2">Material Out Type</label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={materialOutType === 'returnable' ? 'default' : 'outline'}
              onClick={() => setMaterialOutType('returnable')}
              className={materialOutType === 'returnable' ? 'bg-blue-600 hover:bg-blue-700' : ''}
            >
              ↩️ Returnable
            </Button>
            <Button
              type="button"
              variant={materialOutType === 'non_returnable' ? 'default' : 'outline'}
              onClick={() => setMaterialOutType('non_returnable')}
              className={materialOutType === 'non_returnable' ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              🚫 Non-Returnable
            </Button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold mb-2">Promotion Type</label>
          <select
            value={promotionType}
            onChange={(e) => setPromotionType(e.target.value)}
            className="w-full border rounded px-3 py-2 dark:bg-gray-800"
          >
            {PROMOTION_TYPES.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Party and Sales Person Selection */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-2">Select Party</label>
          <select
            value={selectedDealer}
            onChange={(e) => setSelectedDealer(e.target.value)}
            className="w-full border rounded px-3 py-2 dark:bg-gray-800"
            required
          >
            <option value="">-- Select Party --</option>
            {dealers.map(dealer => (
              <option key={dealer.id} value={dealer.id}>{dealer.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold mb-2">Select Sales Person</label>
          <select
            value={selectedSalesPerson}
            onChange={(e) => setSelectedSalesPerson(e.target.value)}
            className="w-full border rounded px-3 py-2 dark:bg-gray-800"
            required
          >
            <option value="">-- Select Sales Person --</option>
            {salesPersons.map(sp => (
              <option key={sp.id} value={sp.id}>{sp.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Add Items Section */}
      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200">
        <CardHeader>
          <CardTitle className="text-lg">Add Items to Order</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="text-xs font-semibold">Product</label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full text-sm border rounded px-2 py-1 dark:bg-gray-800"
              >
                <option value="">Select...</option>
                {products.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.name} (₹{product.dp})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold">Qty</label>
              <Input
                type="number"
                min="1"
                value={selectedProductQty}
                onChange={(e) => setSelectedProductQty(parseInt(e.target.value) || 1)}
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold">Discount %</label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={selectedProductDiscount}
                onChange={(e) => setSelectedProductDiscount(parseFloat(e.target.value) || 0)}
                className="text-sm"
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                onClick={addItemToOrder}
                className="w-full bg-green-600 hover:bg-green-700 flex items-center justify-center gap-2"
                size="sm"
              >
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Order Items Table */}
      {orderItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Order Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md overflow-x-auto">
              <Table className="text-sm">
                <TableHeader>
                  <TableRow className="bg-muted">
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Discount %</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-10 text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderItems.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.product_name}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">₹{item.unit_price.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{item.discount_percent}%</TableCell>
                      <TableCell className="text-right font-semibold">₹{item.total_price.toFixed(2)}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItemFromOrder(item.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted font-bold">
                    <TableCell colSpan={4} className="text-right">TOTAL AMOUNT:</TableCell>
                    <TableCell className="text-right">₹{calculateTotalAmount().toFixed(2)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submit Button */}
      <div className="flex gap-4 justify-end pt-4">
        <Button type="reset" variant="outline" disabled={submitting}>
          Reset
        </Button>
        <Button
          type="submit"
          disabled={submitting || orderItems.length === 0}
          className="bg-purple-600 hover:bg-purple-700 flex items-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Creating...
            </>
          ) : (
            'Create Order'
          )}
        </Button>
      </div>
    </form>
  );
};

export default PromotionalOrderForm;
