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

  // Person details (for promotions)
  const [personName, setPersonName] = useState<string>('');
  const [personAddress, setPersonAddress] = useState<string>('');
  const [personContactNo, setPersonContactNo] = useState<string>('');

  // Data lists
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [salesPersons, setSalesPersons] = useState<SalesPerson[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Order items
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedProductQty, setSelectedProductQty] = useState<number>(1);

  // Search states
  const [dealerSearchInput, setDealerSearchInput] = useState<string>('');
  const [filteredDealers, setFilteredDealers] = useState<Dealer[]>([]);
  const [showDealerDropdown, setShowDealerDropdown] = useState(false);

  const [productSearchInput, setProductSearchInput] = useState<string>('');
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);

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
      discount_percent: 0,
      total_price: product.dp * selectedProductQty,
    };

    setOrderItems([...orderItems, newItem]);
    setSelectedProductId('');
    setSelectedProductQty(1);
    setProductSearchInput('');
    setShowProductDropdown(false);
  };

  const handleDealerSearch = (input: string) => {
    setDealerSearchInput(input);
    
    // Show all dealers if input is empty, otherwise filter
    if (input.length === 0) {
      setFilteredDealers(dealers);
    } else {
      const filtered = dealers.filter(dealer =>
        dealer.name.toLowerCase().includes(input.toLowerCase())
      );
      setFilteredDealers(filtered);
    }
    setShowDealerDropdown(true);
  };

  const handleProductSearch = (input: string) => {
    setProductSearchInput(input);
    
    // Show all products if input is empty, otherwise filter
    if (input.length === 0) {
      setFilteredProducts(products);
    } else {
      const filtered = products.filter(product =>
        product.name.toLowerCase().includes(input.toLowerCase()) ||
        product.code.toLowerCase().includes(input.toLowerCase())
      );
      setFilteredProducts(filtered);
    }
    setShowProductDropdown(true);
  };

  const selectDealer = (dealer: Dealer) => {
    setSelectedDealer(dealer.id);
    setDealerSearchInput(dealer.name);
    setShowDealerDropdown(false);
  };

  const selectProduct = (product: Product) => {
    setSelectedProductId(product.id);
    setProductSearchInput(`${product.name} (${product.code})`);
    setShowProductDropdown(false);
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
    if (!personName.trim()) {
      showError('Please enter person name');
      return;
    }
    if (!personContactNo.trim()) {
      showError('Please enter contact number');
      return;
    }
    if (!personAddress.trim()) {
      showError('Please enter address');
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
          person_name: personName,
          person_contact_no: personContactNo,
          person_address: personAddress,
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
      
      // Reset form
      setSelectedDealer('');
      setPersonName('');
      setPersonContactNo('');
      setPersonAddress('');
      setSelectedSalesPerson('');
      setOrderItems([]);
      setDealerSearchInput('');
      
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
          <div className="relative">
            <Input
              type="text"
              value={dealerSearchInput}
              onChange={(e) => handleDealerSearch(e.target.value)}
              onFocus={() => setShowDealerDropdown(true)}
              placeholder="Search or click to see all parties..."
              className="w-full border-2 border-blue-300"
            />
            {showDealerDropdown && (
              <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border-2 border-blue-300 border-t-0 rounded-b mt-0 z-50">
                <div className="p-2 border-b border-gray-300 dark:border-gray-600">
                  <Input
                    type="text"
                    placeholder="Filter parties..."
                    value={dealerSearchInput}
                    onChange={(e) => handleDealerSearch(e.target.value)}
                    className="w-full text-sm"
                    autoFocus
                  />
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {filteredDealers.length > 0 ? (
                    filteredDealers.map(dealer => (
                      <div
                        key={dealer.id}
                        onClick={() => selectDealer(dealer)}
                        className="px-3 py-2 hover:bg-blue-100 dark:hover:bg-blue-900 cursor-pointer text-sm border-b border-gray-200 dark:border-gray-700 flex justify-between items-center"
                      >
                        <span className="font-medium">{dealer.name}</span>
                        <span className="text-xs text-blue-600 dark:text-blue-400">Select</span>
                      </div>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                      No parties found
                    </div>
                  )}
                </div>
              </div>
            )}
            {selectedDealer && dealers.find(d => d.id === selectedDealer) && (
              <p className="text-xs text-green-600 mt-1">✓ Selected: {dealers.find(d => d.id === selectedDealer)?.name}</p>
            )}
          </div>
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

      {/* Person Details Section (shown when party is selected) */}
      {selectedDealer && (
        <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200">
          <CardHeader>
            <CardTitle className="text-lg">👤 Person Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Person Name</label>
                <Input
                  type="text"
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  placeholder="Enter person name..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Contact Number</label>
                <Input
                  type="tel"
                  value={personContactNo}
                  onChange={(e) => setPersonContactNo(e.target.value)}
                  placeholder="Enter contact number..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Address</label>
                <Input
                  type="text"
                  value={personAddress}
                  onChange={(e) => setPersonAddress(e.target.value)}
                  placeholder="Enter address..."
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Items Section */}
      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200">
        <CardHeader>
          <CardTitle className="text-lg">Add Items to Order</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs font-semibold">Select Product</label>
              <div className="relative">
                <Input
                  type="text"
                  value={productSearchInput}
                  onChange={(e) => handleProductSearch(e.target.value)}
                  onFocus={() => setShowProductDropdown(true)}
                  placeholder="Search or click to see all..."
                  className="text-sm w-full border-2 border-blue-300"
                />
                {showProductDropdown && (
                  <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border-2 border-blue-300 border-t-0 rounded-b mt-0 z-50">
                    <div className="p-2 border-b border-gray-300 dark:border-gray-600">
                      <Input
                        type="text"
                        placeholder="Filter products..."
                        value={productSearchInput}
                        onChange={(e) => handleProductSearch(e.target.value)}
                        className="w-full text-sm"
                        autoFocus
                      />
                    </div>
                    <div className="max-h-40 overflow-y-auto">
                      {filteredProducts.length > 0 ? (
                        filteredProducts.map(product => (
                          <div
                            key={product.id}
                            onClick={() => selectProduct(product)}
                            className="px-3 py-2 hover:bg-blue-100 dark:hover:bg-blue-900 cursor-pointer text-xs border-b border-gray-200 dark:border-gray-700 flex justify-between items-center"
                          >
                            <div>
                              <div className="font-medium">{product.name}</div>
                              <div className="text-gray-600 dark:text-gray-400">Code: {product.code}</div>
                            </div>
                            <span className="text-blue-600 dark:text-blue-400 font-semibold">₹{product.dp}</span>
                          </div>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
                          No products found
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {selectedProductId && products.find(p => p.id === selectedProductId) && (
                  <p className="text-xs text-green-600 mt-1">✓ {products.find(p => p.id === selectedProductId)?.name}</p>
                )}
              </div>
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
                    <TableCell colSpan={3} className="text-right">TOTAL AMOUNT:</TableCell>
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
