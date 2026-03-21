import React, { useState } from 'react';
import CricketKitSelector from '@/components/CricketKitSelector';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

interface OrderLineItem {
  id: string;
  kit_id?: string;
  kit_name?: string;
  product_id: string;
  product_name: string;
  product_code: string;
  quantity: number;
  discount_percent: number;
  gst_percent: number;
  unit_price: number;
}

const CricketKitOrderDemo = () => {
  const [orderItems, setOrderItems] = useState<OrderLineItem[]>([]);

  const handleAddItemsFromKit = (items: any[]) => {
    const newItems: OrderLineItem[] = items.map((item, idx) => ({
      id: `${Date.now()}_${idx}`,
      ...item
    }));
    setOrderItems((prev) => [...prev, ...newItems]);
  };

  const removeItem = (id: string) => {
    setOrderItems((prev) => prev.filter((item) => item.id !== id));
  };

  const calculateTotal = (item: OrderLineItem) => {
    const subtotal = item.unit_price * item.quantity;
    const discountAmount = subtotal * (item.discount_percent / 100);
    const afterDiscount = subtotal - discountAmount;
    const gstAmount = afterDiscount * (item.gst_percent / 100);
    return afterDiscount + gstAmount;
  };

  const calculateOrderTotal = () => {
    return orderItems.reduce((sum, item) => sum + calculateTotal(item), 0);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-4xl font-bold">🏏 Order with Cricket Kits</h1>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Left: Kit Selector */}
          <div>
            <CricketKitSelector onItemsAdded={handleAddItemsFromKit} />
          </div>

          {/* Right: Order Summary */}
          <div className="col-span-2">
            <Card>
              <CardHeader className="bg-blue-600 text-white">
                <CardTitle>📋 Order Items ({orderItems.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {orderItems.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    👈 Select a cricket kit to add items to your order
                  </p>
                ) : (
                  <div className="space-y-4">
                    {/* Items Table */}
                    <div className="overflow-x-auto border rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-4 py-2 text-left font-bold">Kit / Product</th>
                            <th className="px-4 py-2 text-center font-bold">Qty</th>
                            <th className="px-4 py-2 text-center font-bold">Disc %</th>
                            <th className="px-4 py-2 text-center font-bold">GST %</th>
                            <th className="px-4 py-2 text-right font-bold">Unit Price</th>
                            <th className="px-4 py-2 text-right font-bold">Total</th>
                            <th className="px-4 py-2"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {orderItems.map((item) => (
                            <tr
                              key={item.id}
                              className="border-b hover:bg-gray-50"
                            >
                              <td className="px-4 py-2">
                                {item.kit_name && (
                                  <div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded mb-1 inline-block">
                                    KIT: {item.kit_name}
                                  </div>
                                )}
                                <div className="font-mono text-blue-600 font-bold">
                                  {item.product_code}
                                </div>
                                <div className="text-gray-700 text-xs">
                                  {item.product_name}
                                </div>
                              </td>
                              <td className="px-4 py-2 text-center font-bold">
                                {item.quantity}
                              </td>
                              <td className="px-4 py-2 text-center">
                                {item.discount_percent}%
                              </td>
                              <td className="px-4 py-2 text-center">
                                {item.gst_percent}%
                              </td>
                              <td className="px-4 py-2 text-right">
                                ₹{item.unit_price.toFixed(2)}
                              </td>
                              <td className="px-4 py-2 text-right font-bold text-green-700">
                                ₹{calculateTotal(item).toFixed(2)}
                              </td>
                              <td className="px-4 py-2 text-center">
                                <button
                                  onClick={() => removeItem(item.id)}
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

                    {/* Summary */}
                    <div className="bg-gradient-to-r from-green-50 to-blue-50 p-6 rounded-lg border-2 border-green-300">
                      <div className="text-right space-y-2">
                        <p className="text-lg font-bold text-gray-800">
                          Order Total: <span className="text-green-700">₹{calculateOrderTotal().toFixed(2)}</span>
                        </p>
                        <p className="text-sm text-gray-600">
                          {orderItems.length} items from {new Set(orderItems.map(i => i.kit_id)).size} kit(s)
                        </p>
                      </div>
                    </div>

                    {/* Action Button */}
                    <Button className="w-full bg-green-600 text-white hover:bg-green-700 h-12 text-lg">
                      ✅ Save Order
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Instructions */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-900">📖 How to Use</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-blue-900 space-y-2">
            <p>✅ Select a cricket kit from the left panel</p>
            <p>✅ Click on the kit to expand and see all items inside</p>
            <p>✅ Edit quantity, discount %, and GST % for each item if needed</p>
            <p>✅ Click "Add Kit to Order" to add all items at once</p>
            <p>✅ All items from the kit are added with their configured values</p>
            <p>✅ Order total is automatically calculated with discounts and GST</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CricketKitOrderDemo;
