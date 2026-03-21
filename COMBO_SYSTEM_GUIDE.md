# 🏏 Combo Offers System - Implementation Guide

## Overview
The combo offers system allows admins to create product bundles that customers can select as single items when placing orders. When a combo is selected, all associated items are automatically added to the order with their configured quantities, discounts, and GST values.

## How It Works

### For Admins:
1. **Create Combos** → Navigate to `/combo-offers-admin`
2. **Add Products** → Select products and set quantities, discounts, and GST for each
3. **Manage** → Edit names, descriptions, categories, and delete combos

### For Order Managers:
1. **Create Orders** → Navigate to `/multi-order-form`
2. **Select Customer** → Choose the customer for the order
3. **Add Items** → Either:
   - Add individual products with custom quantities/discounts
   - Select a pre-configured combo to add all items at once
4. **Review** → See all items with calculated totals
5. **Save** → Submit the order

## Database Setup

### Step 1: Run SQL Schema
Copy and paste the entire contents of `SQL_COMMAND_CREATE_COMBO_SCHEMA.sql` into Supabase SQL editor and execute.

This creates:
- `product_combos` table - stores combo definitions
- `product_combo_items` table - junction table linking products to combos
- RLS policies - security rules for data access
- RPC functions - `get_combo_details()` and `get_all_active_combos_with_items()`
- Indexes and triggers for performance

### Step 2: Verify Schema
```sql
-- Check if combos table exists
SELECT * FROM product_combos LIMIT 1;

-- Check if combo items table exists
SELECT * FROM product_combo_items LIMIT 1;

-- Test RPC function
SELECT * FROM rpc('get_all_active_combos_with_items');
```

## Routes

### Admin Routes
- **`/combo-offers-admin`** - Admin panel for creating and managing combos
  - Create new combos
  - Add/remove products from combos
  - Edit combo details
  - Delete combos

### Order Creation Routes
- **`/multi-order-form`** - Main form for creating orders with products and combos
  - Select customer
  - Add individual products
  - Select and add combos
  - Review and submit order

### Demo Routes
- **`/cricket-kit-order-demo`** - Demo page showing how kit selector component works
- **`/test-products`** - Test page for product pagination

## Component Architecture

### ComboSelector.tsx
Reusable component for selecting and adding combos to orders.

**Props:**
- `onItemsAdded`: Callback function when combo items are added to order
- `compact`: Boolean to render in compact or full mode

**Usage:**
```tsx
<ComboSelector 
  onItemsAdded={(items) => {
    // items is an array of OrderLineItem objects
    // containing product_id, quantity, discount_percent, gst_percent, etc.
    console.log(items);
  }} 
/>
```

### MultiOrderForm.tsx
Complete order creation form with product selection and combo integration.

**Features:**
- Customer selection dropdown
- Individual product selection with qty/discount/GST
- Combo selector component
- Live order total calculation
- Item table with editable values
- Order notes field
- Save/submit functionality

## Key Features

### 1. Product Selection
Add individual products with:
- Custom quantity
- Discount percentage
- GST percentage override

### 2. Combo Selection
Select pre-configured combos that automatically:
- Add all associated items with configured quantities
- Apply configured discounts and GST
- Allow last-minute edits before adding to order

### 3. Real-time Calculations
Order totals automatically calculated:
```
Total = (Unit Price × Qty) - Discount + GST
```

### 4. Order Summary
Visual summary showing:
- Individual item totals
- Subtotal
- Final order total
- Items grouped by combo or standalone

## Integration with Existing Order System

To integrate MultiOrderForm with your existing order creation pages:

1. **Import ComboSelector:**
   ```tsx
   import ComboSelector from '@/components/ComboSelector';
   ```

2. **Add to form:**
   ```tsx
   <ComboSelector 
     onItemsAdded={(items) => {
       // Add items to your order state
       setOrderItems(prev => [...prev, ...items]);
     }} 
   />
   ```

3. **Handle item addition:**
   - Items come as arrays with combo context
   - Each item has `combo_id` and `combo_name` if from combo
   - Save these values with order for tracking which items came from combos

## Database Schema Details

### product_combos Table
```
id              UUID (PK)
name            TEXT (unique, required)
description     TEXT
category        TEXT
combo_dp        DECIMAL(12,2) - override DP for combo
combo_gst       DECIMAL(5,2) - override GST for combo
is_active       BOOLEAN
created_by      UUID (FK to auth.users)
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

### product_combo_items Table
```
id                  UUID (PK)
combo_id            UUID (FK)
product_id          UUID (FK)
quantity            INTEGER - qty of product in combo
discount_percent    DECIMAL(5,2) - default discount for item in combo
gst_percent         DECIMAL(5,2) - default GST for item in combo
created_at          TIMESTAMP
```

## RPC Functions

### get_all_active_combos_with_items()
Returns all active combos with their items. Called when loading combo selector.

**Returns:**
```
{
  combo_id,
  combo_name,
  combo_description,
  combo_category,
  combo_dp,
  combo_gst,
  item_count,
  items: [
    {
      id,
      product_id,
      product_name,
      product_code,
      quantity,
      discount_percent,
      gst_percent,
      unit_price
    }
  ]
}
```

### get_combo_details(combo_id UUID)
Returns specific combo with all its items. Used when editing combos.

## Security (RLS Policies)

### product_combos
- **SELECT**: Public (both anon and authenticated)
- **INSERT**: Authenticated users only
- **UPDATE**: Admins or creator only
- **DELETE**: Admins only

### product_combo_items
- **SELECT**: Public
- **INSERT**: Authenticated users
- **UPDATE**: Authenticated users
- **DELETE**: Admins only

## Testing Checklist

- [ ] Run SQL schema in Supabase
- [ ] Navigate to `/combo-offers-admin`
- [ ] Create a test combo with 2-3 products
- [ ] Navigate to `/multi-order-form`
- [ ] Select a customer
- [ ] Add individual product (check quantity, discount, GST editable)
- [ ] Select and expand combo
- [ ] Edit combo item quantities/discounts in dropdown
- [ ] Add combo to order
- [ ] Verify all items appear in order summary
- [ ] Verify totals calculate correctly
- [ ] Edit item values in order table (check real-time calc)
- [ ] Remove items (check total updates)
- [ ] Save order

## Troubleshooting

### Combos not appearing in selector
- Check: Are combos marked as `is_active = TRUE`?
- Check: Did you run the SQL schema?
- Check: Browser console for RPC errors

### RLS policy errors
- Check: Your user role is authenticated
- Check: User profile has proper role set
- Try: Verify RLS policies exist on both tables
- Try: Grant EXECUTE on RPC functions

### Calculations off
- Check: Are discount and GST decimal values (not percentages)?
- Check: GST is applied AFTER discount
- Formula: `(price × qty) - discount + ((price × qty - discount) × gst%)`

### Products not loading
- Check: Database has products
- Check: Pagination working (loads 1000+ items)
- Check: Network tab shows successful queries

## Performance Notes

- Combos loaded via RPC for better performance
- Products paginated in batches of 1000
- Memoization used for component re-renders
- Indexes on combo_id and product_id for fast queries

## Future Enhancements

- [ ] Combo templates with bulk creation
- [ ] Combo variations (beginner/pro/advanced)
- [ ] Seasonal combo scheduling
- [ ] Combo usage analytics
- [ ] Combo discount tiers based on quantity
- [ ] Automatic combo suggestions based on cart
- [ ] Combo expiry dates
- [ ] Multi-language combo names

## API/Database Examples

### Create Combo
```json
{
  "name": "Beginner Cricket Bundle",
  "description": "Perfect starter kit for new players",
  "category": "Bundles",
  "combo_dp": 0,
  "combo_gst": 18,
  "is_active": true
}
```

### Add Item to Combo
```json
{
  "combo_id": "uuid-here",
  "product_id": "uuid-here",
  "quantity": 2,
  "discount_percent": 10,
  "gst_percent": 18
}
```

### Order with Combo
```json
{
  "customer_id": "uuid",
  "items": [
    {
      "product_id": "uuid",
      "quantity": 2,
      "discount_percent": 10,
      "gst_percent": 18,
      "unit_price": 500,
      "combo_id": "uuid",
      "combo_name": "Beginner Cricket Bundle"
    }
  ],
  "total_amount": 1432.80,
  "notes": "Special order for tournament"
}
```

## Files Created

1. **SQL_COMMAND_CREATE_COMBO_SCHEMA.sql** - Database schema
2. **pages/ComboOffersAdmin.tsx** - Admin management interface
3. **components/ComboSelector.tsx** - Reusable combo selector component
4. **pages/MultiOrderForm.tsx** - Multi-item order creation form
5. **App.tsx** - Updated with new routes

## Need Help?

Check the following if something doesn't work:
1. SQL schema executed without errors
2. All files saved and built
3. Browser hard refresh (Ctrl+Shift+R)
4. Check browser console for errors
5. Check Supabase SQL editor for any issues with RPC functions
