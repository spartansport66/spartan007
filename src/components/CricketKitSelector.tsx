import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';

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
  product_gst: string;
  quantity: number;
  discount_percent: number;
  gst_percent: number;
}

interface CricketKit {
  id: string;
  name: string;
  description: string;
  category: string;
  items: KitItem[];
}

interface OrderItem {
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

interface CricketKitSelectorProps {
  onItemsAdded: (items: OrderItem[]) => void;
}

const CricketKitSelector: React.FC<CricketKitSelectorProps> = ({ onItemsAdded }) => {
  const [kits, setKits] = useState<CricketKit[]>([]);
  const [expandedKit, setExpandedKit] = useState<string | null>(null);
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
  const [itemDiscounts, setItemDiscounts] = useState<Record<string, number>>({});
  const [itemGsts, setItemGsts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchKits();
  }, []);

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
          
          // Initialize default quantities and discounts
          const itemsWithDefaults = (itemsData || []).map((item: any) => {
            const keyId = `${kit.id}_${item.product_id}`;
            if (!itemQuantities[keyId]) {
              setItemQuantities((prev) => ({ ...prev, [keyId]: item.kit_item_quantity }));
              setItemDiscounts((prev) => ({ ...prev, [keyId]: item.kit_item_discount_percent }));
              setItemGsts((prev) => ({ ...prev, [keyId]: item.kit_item_gst_percent }));
            }
            return item;
          });

          return {
            ...kit,
            items: itemsWithDefaults
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

  const handleAddKitToOrder = (kit: CricketKit) => {
    if (!kit.items || kit.items.length === 0) {
      alert('Kit has no items');
      return;
    }

    const orderItems: OrderItem[] = kit.items.map((item) => {
      const keyId = `${kit.id}_${item.product_id}`;
      return {
        kit_id: kit.id,
        kit_name: kit.name,
        product_id: item.product_id,
        product_name: item.product_name,
        product_code: item.product_code,
        quantity: itemQuantities[keyId] || item.kit_item_quantity,
        discount_percent: itemDiscounts[keyId] ?? item.kit_item_discount_percent,
        gst_percent: itemGsts[keyId] ?? item.kit_item_gst_percent,
        unit_price: item.product_dp || 0
      };
    });

    onItemsAdded(orderItems);
    alert(`✅ Added "${kit.name}" with ${orderItems.length} items to order!`);
  };

  return (
    <Card className="border-2 border-green-500">
      <CardHeader className="bg-green-600 text-white">
        <CardTitle>🏏 Cricket Kit Selector</CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        {loading ? (
          <p>Loading kits...</p>
        ) : kits.length === 0 ? (
          <p className="text-gray-500">No kits available. Create one in Kit Manager first.</p>
        ) : (
          <div className="space-y-3">
            {kits.map((kit) => (
              <div key={kit.id} className="border rounded-lg overflow-hidden">
                {/* Kit Header */}
                <button
                  onClick={() => setExpandedKit(expandedKit === kit.id ? null : kit.id)}
                  className="w-full p-4 bg-gray-100 hover:bg-gray-200 flex items-center justify-between transition"
                >
                  <div className="flex items-center gap-3 text-left flex-1">
                    {expandedKit === kit.id ? (
                      <ChevronDown className="h-5 w-5" />
                    ) : (
                      <ChevronRight className="h-5 w-5" />
                    )}
                    <div>
                      <div className="font-bold text-gray-800">{kit.name}</div>
                      <div className="text-xs text-gray-600">
                        {kit.items?.length || 0} items • {kit.category}
                      </div>
                    </div>
                  </div>
                </button>

                {/* Kit Items (Expanded) */}
                {expandedKit === kit.id && (
                  <div className="p-4 bg-white border-t space-y-4">
                    {kit.items && kit.items.length > 0 ? (
                      <>
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left font-bold">Product</th>
                              <th className="px-3 py-2 text-center font-bold">Qty</th>
                              <th className="px-3 py-2 text-center font-bold">Disc %</th>
                              <th className="px-3 py-2 text-center font-bold">GST %</th>
                              <th className="px-3 py-2 text-right font-bold">DP</th>
                            </tr>
                          </thead>
                          <tbody>
                            {kit.items.map((item) => {
                              const keyId = `${kit.id}_${item.product_id}`;
                              return (
                                <tr key={item.id} className="border-b hover:bg-blue-50">
                                  <td className="px-3 py-2">
                                    <div className="font-mono text-blue-600 font-bold">
                                      {item.product_code}
                                    </div>
                                    <div className="text-gray-700 text-xs">
                                      {item.product_name}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2">
                                    <input
                                      type="number"
                                      min="1"
                                      value={itemQuantities[keyId] || item.kit_item_quantity}
                                      onChange={(e) =>
                                        setItemQuantities((prev) => ({
                                          ...prev,
                                          [keyId]: parseInt(e.target.value) || 1
                                        }))
                                      }
                                      className="w-16 border rounded px-2 py-1 text-center text-sm"
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.1"
                                      value={itemDiscounts[keyId] ?? item.kit_item_discount_percent}
                                      onChange={(e) =>
                                        setItemDiscounts((prev) => ({
                                          ...prev,
                                          [keyId]: parseFloat(e.target.value) || 0
                                        }))
                                      }
                                      className="w-16 border rounded px-2 py-1 text-center text-sm"
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.1"
                                      value={itemGsts[keyId] ?? item.kit_item_gst_percent}
                                      onChange={(e) =>
                                        setItemGsts((prev) => ({
                                          ...prev,
                                          [keyId]: parseFloat(e.target.value) || 0
                                        }))
                                      }
                                      className="w-16 border rounded px-2 py-1 text-center text-sm"
                                    />
                                  </td>
                                  <td className="px-3 py-2 text-right font-bold text-green-700">
                                    ₹{item.product_dp}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>

                        <Button
                          onClick={() => handleAddKitToOrder(kit)}
                          className="w-full bg-green-600 text-white hover:bg-green-700"
                        >
                          <Plus className="mr-2 h-4 w-4" /> Add "{kit.name}" to Order
                        </Button>
                      </>
                    ) : (
                      <p className="text-gray-500">No items in this kit</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CricketKitSelector;
