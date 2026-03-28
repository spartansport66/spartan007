# Combo Support Implementation Guide

## Overview
This guide explains how to add combo kit support to order extraction pages and forms throughout the system.

## Files Created/Updated

### 1. **Combo Utilities** (`src/utils/comboHelpers.ts`)
Helper functions for working with combos:
- `fetchAllCombos()` - Fetches all active combos from database
- `expandComboToItems()` - Converts a combo into individual order items
- `formatComboDisplay()` - Formats combo display string for UI

### 2. **Editable Order Items Table** (`src/components/EditableOrderItemsTable.tsx`)
Reusable table component with inline editing for order items:
- Click Edit button to modify qty, price, discount, GST
- Shows combo indicator for items added from combos
- Calculates totals automatically

### 3. **Edit Order Dialog** (`src/components/EditOrderDialog.tsx`)
**Already Updated** - Fully supports combos:
- Combo Kits tab with full combo list
- Shows code, price, and discount
- Allows editing qty and prices before adding
- Auto-expands combos into individual items

## How to Add Combo Support to Other Pages

### Pattern for Order Forms (MultiOrderForm, PromotionalOrderForm)

1. **Import utilities and combos**
```typescript
import { fetchAllCombos, expandComboToItems, Combo } from '@/utils/comboHelpers';

// In component state:
const [combos, setCombos] = useState<Combo[]>([]);

// In fetch effect:
const combosData = await fetchAllCombos();
setCombos(combosData);
```

2. **Add combo selection UI** (use Tabs for Products vs Combos)
```typescript
<TabsContent value="combos">
  <Select onValueChange={setNewItemComboId}>
    <SelectTrigger>
      <SelectValue placeholder="Select combo..." />
    </SelectTrigger>
    <SelectContent>
      {combos.map(combo => (
        <SelectItem key={combo.combo_id} value={combo.combo_id}>
          {combo.combo_name} ({combo.combo_code}) • {combo.item_count} items • ₹{combo.combo_dp}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</TabsContent>
```

3. **Handle combo adding**
```typescript
const addCombo = () => {
  const selectedCombo = combos.find(c => c.combo_id === newItemComboId);
  if (!selectedCombo) return;
  
  const items = expandComboToItems(
    selectedCombo,
    quantity, // multiplier
    discount, // optional override
    gst       // optional override
  );
  
  setOrderItems(prev => [...prev, ...items]);
};
```

### Pattern for Product Extractors (SpartanOrderExtractor, FlipkartOrderExtractor, etc.)

1. **Fetch combos alongside products**
```typescript
const [combos, setCombos] = useState<Combo[]>([]);

useEffect(() => {
  const fetchData = async () => {
    const productsData = await fetchAllProducts();
    const combosData = await fetchAllCombos();
    setProducts(productsData);
    setCombos(combosData);
  };
  fetchData();
}, []);
```

2. **In product mapping dropdown, show combos as special options**
```typescript
// After showing matching products, add:
{combos.length > 0 && (
  <>
    <Separator className="my-2" />
    <div className="px-2 py-1 text-sm font-semibold text-blue-600">📦 Combo Kits</div>
    {combos.map(combo => (
      <Button
        key={`combo-${combo.combo_id}`}
        variant="ghost"
        className="w-full justify-start text-blue-600 hover:bg-blue-50"
        onClick={() => {
          // When combo is selected, expand it
          const items = expandComboToItems(combo, 1);
          items.forEach((item, idx) => {
            // Store the mapping - similar to product mapping
            setProductMapping(prev => ({
              ...prev,
              [orderIndex]: {
                ...(prev[orderIndex] || {}),
                [itemIndex]: item.product_id, // Can extend to store full item data
              }
            }));
          });
        }}
      >
        <Check className="mr-2 h-4 w-4 opacity-0" />
        {combo.combo_name} ({combo.combo_code}) • {combo.item_count} items
      </Button>
    ))}
  </>
)}
```

3. **Use EditableOrderItemsTable instead of plain table**
```typescript
import EditableOrderItemsTable from '@/components/EditableOrderItemsTable';

// In render:
<EditableOrderItemsTable
  items={orderItems}
  isSubmitting={isSubmitting}
  onUpdateItem={(id, field, value) => {
    setOrderItems(prev => 
      prev.map(item => 
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  }}
  onRemoveItem={(id) => {
    setOrderItems(prev => prev.filter(item => item.id !== id));
  }}
/>
```

## Features Now Available

### ✅ Already Implemented
- **EditOrderDialog**: Full combo support with editing
- **ComboSelector**: Component for selecting combos with editable items
- **MultiOrderForm**: Has ComboSelector but can be enhanced with direct tabs
- **Combo Helpers**: Utility functions for all components

### 📋 To Implement (Use Pattern Above)
1. **PromotionalOrderForm** - Add combo tab
2. **SpartanOrderExtractor** - Add combos to product mapping
3. **FlipkartOrderExtractor** - Add combos to product mapping
4. **AmazonOrderExtractor** - Add combos to product mapping
5. **ProcessOnlineOrders** - Add combo indicators and editing
6. **All existing forms** - Replace order item tables with `EditableOrderItemsTable`

## Integration Steps

1. **For each page needing combo support:**
   - Import: `fetchAllCombos`, `expandComboToItems`, `Combo` type
   - Fetch combos on load
   - Add combo selection UI (tab or section)
   - Handle combo selection with `expandComboToItems()`

2. **Replace static order item tables:**
   - Replace `<Table>` with `<EditableOrderItemsTable>`
   - Connect `onUpdateItem` and `onRemoveItem` handlers
   - Items now support inline editing of qty, price, discounts

3. **Update order saving logic:**
   - Combo-sourced items already have `combo_id` field
   - Store as-is or flatten for your data structure
   - Items expanded from combos are just regular products with combo reference

## Example: Quick Add to PromotionalOrderForm

Replace the product-only section with combo+product tabs for complete coverage.

## Notes
- Combos auto-expand into their constituent products
- Combo items can have qty and pricing overridden at add-time or edit-time
- All edits in table update state immediately
- Totals recalculate on each change (qty, price, discount, GST)
- Works with any number of items

