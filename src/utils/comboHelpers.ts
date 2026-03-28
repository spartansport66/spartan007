import { supabase } from '@/integrations/supabase/client';

export interface ComboItem {
  id: string;
  product_id: string;
  product_name: string;
  product_code: string;
  quantity: number;
  discount_percent: number;
  gst_percent: number;
  unit_price: number;
}

export interface Combo {
  combo_id: string;
  combo_code?: string;
  combo_name: string;
  combo_description: string;
  combo_category: string;
  combo_dp: number;
  combo_gst: number;
  item_count: number;
  items: ComboItem[];
}

export interface Product {
  id: string;
  name: string;
  code?: string;
}

/**
 * Fetch all active combos from the database
 */
export const fetchAllCombos = async (): Promise<Combo[]> => {
  try {
    const { data, error } = await supabase.rpc('get_all_active_combos_with_items');
    if (error) {
      console.error("Error fetching combos:", error);
      throw error;
    }
    return (data || []).map((combo: any) => ({
      combo_id: combo.combo_id,
      combo_code: combo.combo_code,
      combo_name: combo.combo_name,
      combo_description: combo.combo_description,
      combo_category: combo.combo_category,
      combo_dp: combo.combo_dp,
      combo_gst: combo.combo_gst,
      item_count: combo.item_count,
      items: Array.isArray(combo.items) ? combo.items : [],
    }));
  } catch (error) {
    console.error('Error fetching combos:', error);
    return [];
  }
};

/**
 * Convert a combo into individual order items
 * Useful for order extractors where user selects a combo instead of individual products
 */
export const expandComboToItems = (
  combo: Combo,
  multiplier: number = 1,
  overrideDiscount?: number,
  overrideGst?: number
): Array<{
  product_id: string;
  product_name: string;
  product_code: string;
  unit_price: number;
  quantity: number;
  discount_percent: number;
  gst_percent: number;
  combo_id: string;
  combo_name: string;
}> => {
  return combo.items.map((item) => ({
    product_id: item.product_id,
    product_name: item.product_name,
    product_code: item.product_code,
    unit_price: item.unit_price,
    quantity: item.quantity * multiplier,
    discount_percent: overrideDiscount !== undefined ? overrideDiscount : item.discount_percent,
    gst_percent: overrideGst !== undefined ? overrideGst : item.gst_percent,
    combo_id: combo.combo_id,
    combo_name: combo.combo_name,
  }));
};

/**
 * Format combo display string for dropdowns
 */
export const formatComboDisplay = (combo: Combo): string => {
  const code = combo.combo_code ? ` (${combo.combo_code})` : '';
  const items = combo.item_count ? ` • ${combo.item_count} items` : '';
  const price = combo.combo_dp ? ` • ₹${combo.combo_dp.toFixed(2)}` : '';
  return `${combo.combo_name}${code}${items}${price}`;
};
