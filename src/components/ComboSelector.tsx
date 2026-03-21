import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronDown, ChevronUp, Plus, Loader2 } from 'lucide-react';

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
  combo_name: string;
  combo_description: string;
  combo_category: string;
  combo_dp: number;
  combo_gst: number;
  item_count: number;
  items: ComboItem[];
}

interface OrderLineItem {
  kit_id?: string;
  kit_name?: string;
  combo_id: string;
  combo_name: string;
  product_id: string;
  product_name: string;
  product_code: string;
  quantity: number;
  discount_percent: number;
  gst_percent: number;
  unit_price: number;
  size?: string;
}

interface ComboSelectorProps {
  onItemsAdded?: (items: OrderLineItem[]) => void;
  compact?: boolean;
}

const ComboSelector: React.FC<ComboSelectorProps> = ({ onItemsAdded, compact = false }) => {
  const [combos, setCombos] = useState<Combo[]>([]);
  const [expandedComboId, setExpandedComboId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingItems, setEditingItems] = useState<{ [key: string]: Partial<ComboItem> }>({});

  const fetchCombos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_all_active_combos_with_items');

      if (error) throw error;
      setCombos(data || []);
    } catch (error: any) {
      showError(`Failed to fetch combos: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCombos();
  }, []);

  const filteredCombos = combos.filter((combo) =>
    combo.combo_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    combo.combo_description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddComboToOrder = (combo: Combo) => {
    if (!onItemsAdded || !combo.items || combo.items.length === 0) {
      return;
    }

    // Create order line items from combo items, using edited values if available
    const orderItems: OrderLineItem[] = combo.items.map((item) => {
      const edited = editingItems[item.id] || {};
      return {
        combo_id: combo.combo_id,
        combo_name: combo.combo_name,
        product_id: item.product_id,
        product_name: item.product_name,
        product_code: item.product_code,
        quantity: edited.quantity !== undefined ? edited.quantity : item.quantity,
        discount_percent:
          edited.discount_percent !== undefined ? edited.discount_percent : item.discount_percent,
        gst_percent: edited.gst_percent !== undefined ? edited.gst_percent : item.gst_percent,
        unit_price: item.unit_price,
      };
    });

    onItemsAdded(orderItems);

    // Clear editing state and close
    setEditingItems({});
    setExpandedComboId(null);
  };

  const updateItemValue = (itemId: string, field: string, value: any) => {
    setEditingItems((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value,
      },
    }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </CardContent>
      </Card>
    );
  }

  if (!compact) {
    return (
      <Card>
        <CardHeader className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
          <CardTitle>📦 Select Product Combo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-6">
          {combos.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No combos available</p>
          ) : (
            <>
              <div>
                <Label className="text-sm font-bold">Search combos</Label>
                <Input
                  placeholder="Search by name or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredCombos.map((combo) => (
                  <div key={combo.combo_id} className="border rounded-lg">
                    {/* Combo Header */}
                    <button
                      onClick={() =>
                        setExpandedComboId(
                          expandedComboId === combo.combo_id ? null : combo.combo_id
                        )
                      }
                      className="w-full p-3 flex justify-between items-center hover:bg-gray-50 transition-colors"
                    >
                      <div className="text-left flex-1">
                        <div className="font-bold text-purple-700">{combo.combo_name}</div>
                        <div className="text-xs text-gray-600">
                          {combo.item_count} items • Category: {combo.combo_category || 'General'}
                        </div>
                        {combo.combo_description && (
                          <div className="text-xs text-gray-500 mt-1">{combo.combo_description}</div>
                        )}
                      </div>
                      {expandedComboId === combo.combo_id ? (
                        <ChevronUp className="h-5 w-5 text-purple-600" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      )}
                    </button>

                    {/* Combo Items - Expanded View */}
                    {expandedComboId === combo.combo_id && combo.items && (
                      <div className="border-t bg-gray-50 p-4 space-y-3">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-white">
                              <tr>
                                <th className="px-2 py-1 text-left font-bold">Product</th>
                                <th className="px-2 py-1 text-center font-bold">Qty</th>
                                <th className="px-2 py-1 text-center font-bold">Disc %</th>
                                <th className="px-2 py-1 text-center font-bold">GST %</th>
                                <th className="px-2 py-1 text-right font-bold">Price</th>
                              </tr>
                            </thead>
                            <tbody>
                              {combo.items.map((item) => {
                                const edited = editingItems[item.id] || {};
                                const displayQty = edited.quantity !== undefined ? edited.quantity : item.quantity;
                                const displayDisc =
                                  edited.discount_percent !== undefined
                                    ? edited.discount_percent
                                    : item.discount_percent;
                                const displayGst =
                                  edited.gst_percent !== undefined
                                    ? edited.gst_percent
                                    : item.gst_percent;

                                return (
                                  <tr key={item.id} className="border-b">
                                    <td className="px-2 py-2">
                                      <div className="font-mono text-blue-600 font-bold text-xs">
                                        {item.product_code}
                                      </div>
                                      <div className="text-xs text-gray-600">{item.product_name}</div>
                                    </td>
                                    <td className="px-2 py-2 text-center">
                                      <input
                                        type="number"
                                        min="1"
                                        value={displayQty}
                                        onChange={(e) =>
                                          updateItemValue(item.id, 'quantity', parseInt(e.target.value) || 1)
                                        }
                                        className="w-12 text-center border rounded px-1 py-1 text-xs"
                                      />
                                    </td>
                                    <td className="px-2 py-2 text-center">
                                      <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.01"
                                        value={displayDisc}
                                        onChange={(e) =>
                                          updateItemValue(item.id, 'discount_percent', parseFloat(e.target.value) || 0)
                                        }
                                        className="w-14 text-center border rounded px-1 py-1 text-xs"
                                      />
                                    </td>
                                    <td className="px-2 py-2 text-center">
                                      <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.01"
                                        value={displayGst}
                                        onChange={(e) =>
                                          updateItemValue(item.id, 'gst_percent', parseFloat(e.target.value) || 18)
                                        }
                                        className="w-14 text-center border rounded px-1 py-1 text-xs"
                                      />
                                    </td>
                                    <td className="px-2 py-2 text-right font-bold text-xs">
                                      ₹{item.unit_price.toFixed(2)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        <Button
                          onClick={() => handleAddComboToOrder(combo)}
                          className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Combo to Order
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {filteredCombos.length === 0 && (
                <p className="text-gray-500 text-center py-4">No combos match your search</p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  // Compact mode for inline use
  return (
    <div className="space-y-2">
      <Label className="text-sm font-bold">📦 Add Items from Combo</Label>
      {filteredCombos.map((combo) => (
        <div key={combo.combo_id} className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setExpandedComboId(expandedComboId === combo.combo_id ? null : combo.combo_id)
            }
            className="flex-1 justify-start"
          >
            {combo.combo_name} ({combo.item_count} items)
          </Button>
          {expandedComboId === combo.combo_id && (
            <Button
              size="sm"
              onClick={() => handleAddComboToOrder(combo)}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Add
            </Button>
          )}
        </div>
      ))}
    </div>
  );
};

export default ComboSelector;
