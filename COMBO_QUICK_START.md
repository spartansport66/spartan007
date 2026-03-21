# ⚡ COMBO SYSTEM - QUICK START

## What Was Created?

### 1. **Database Schema** (`SQL_COMMAND_CREATE_COMBO_SCHEMA.sql`)
   - `product_combos` table - stores product bundles
   - `product_combo_items` table - links products to combos
   - RLS policies for security
   - RPC functions for fast queries

### 2. **Admin Interface** (`/combo-offers-admin`)
   - Create new combo offers
   - Add/remove products from combos
   - Edit combo details
   - Delete combos

### 3. **Component** (`ComboSelector.tsx`)
   - Reusable component for selecting combos
   - Can be added to any order form
   - Editable item quantities and discounts

### 4. **Order Form** (`/multi-order-form`)
   - Complete order creation system
   - Add individual products
   - Select pre-configured combos
   - Calculate totals automatically

## 5-Step Setup

### Step 1️⃣: Deploy Database Schema
1. Open Supabase SQL Editor
2. Copy entire content of `SQL_COMMAND_CREATE_COMBO_SCHEMA.sql`
3. Paste into SQL editor
4. Execute (run)
5. You'll see "CREATE TABLE" confirmations

### Step 2️⃣: Test Routes Are Working
1. Hard refresh browser: **Ctrl+Shift+R**
2. Visit `/combo-offers-admin` - Should load
3. Visit `/multi-order-form` - Should load

### Step 3️⃣: Create Your First Combo
1. Go to `/combo-offers-admin`
2. Click "Create New" tab
3. Enter combo name: "Beginner Cricket Kit"
4. Add description: "Perfect starter bundle"
5. Click "Create Combo"
6. Select the combo from left list
7. Add products:
   - Select product from dropdown
   - Set quantity (e.g., 1)
   - Set discount % (e.g., 10)
   - Set GST % (usually 18)
   - Click "Add Item to Combo"
8. Repeat for 2-3 more products
9. You should see them in the items table

### Step 4️⃣: Create Test Order
1. Go to `/multi-order-form`
2. Select a customer from dropdown
3. Click the combo name on left
4. Click "Add Combo to Order"
5. All combo items appear in order table on right
6. Verify quantities and prices look correct
7. Add order notes if desired
8. Click "Save Order"

### Step 5️⃣: Add to Admin Panel (Optional)
Add navigation link in your admin menu to `/combo-offers-admin`

## Key Routes

```
/combo-offers-admin     ← Admin creates/manages combos
/multi-order-form       ← Users create orders with products & combos
```

## How Users Will Use It

### Order Creation Flow:

1. **User enters `/multi-order-form`**
   ```
   Select Customer ↓
   Add Products OR Select Combo ↓
   Review Order ↓
   Save Order
   ```

2. **Selecting a Combo:**
   - Combo appears on left with item count
   - Click to expand and see all items
   - Can edit qty/discount for each item
   - Click "Add Combo to Order"
   - All items added automatically to right panel

3. **Editing Order Items:**
   - Change quantity in table
   - Change discount % in table
   - Change GST % in table
   - Total updates automatically

4. **Example Order:**
   ```
   Beginner Cricket Bundle (3 items)
   ├─ Cricket Bat × 1 (qty editable)
   ├─ Cricket Ball × 3 (qty editable)  
   └─ Gloves × 1 (qty editable)
   
   + Add Individual Products option
   
   Total: ₹2,150.00
   ```

## Database Info

### Combo Fields:
- `name` - Combo name (required, unique)
- `description` - What's in it
- `category` - For organizing (Bundles, Offers, etc)
- `combo_gst` - Default GST % for whole combo
- `is_active` - True = shows in ordering

### Item Fields (in combo):
- `quantity` - How many of product to include
- `discount_percent` - Default discount for this item
- `gst_percent` - Tax rate for this item

## Testing - Verify Everything Works

After running SQL, test these:

```bash
# In Supabase SQL Editor:

# Check table exists
SELECT COUNT(*) FROM product_combos;  → Should show 0 (empty table)

# Check RPC works
SELECT * FROM rpc('get_all_active_combos_with_items');  → Should show []

# Try inserting test combo
INSERT INTO product_combos (name, description, is_active)
VALUES ('Test Combo', 'Test Description', true)
RETURNING *;
```

## Error Troubleshooting

| Error | Solution |
|-------|----------|
| "Table product_combos does not exist" | Run SQL schema in Supabase |
| "RLS policy denies access" | User must be logged in as authenticated role |
| "No combos appear in selector" | Go to `/combo-offers-admin` and create a combo first |
| "Combos don't show in form" | Do hard refresh (Ctrl+Shift+R) |
| "Products won't load" | Check products table exists with 1000+ items |

## Important Code Locations

```
SQL_COMMAND_CREATE_COMBO_SCHEMA.sql     ← Run this first!
src/pages/ComboOffersAdmin.tsx          ← Admin interface
src/components/ComboSelector.tsx        ← Component to reuse
src/pages/MultiOrderForm.tsx            ← Main order form
src/App.tsx                              ← Routes updated
```

## What Happens When User Adds Combo

```javascript
1. User clicks "Add Combo to Order"
2. Component maps combo items to OrderLineItem format:
   {
     combo_id: "uuid",
     combo_name: "Beginner Kit",
     product_id: "uuid",
     product_name: "Cricket Bat",
     product_code: "CB-100",
     quantity: 1,           ← User can edit before adding
     discount_percent: 10,  ← User can edit before adding
     gst_percent: 18,       ← User can edit before adding
     unit_price: 500        ← From products table
   }
3. All items added to order table
4. Totals calculated automatically
```

## Integration into Existing Forms

If you have existing order forms and want to add combo support:

```tsx
import ComboSelector from '@/components/ComboSelector';

// In your form:
<ComboSelector 
  onItemsAdded={(items) => {
    // items = array of order line items from combo
    setOrderItems(prev => [...prev, ...items]);
  }} 
/>
```

## Next Steps

1. ✅ Run SQL schema in Supabase
2. ✅ Visit `/combo-offers-admin` and create 1st combo
3. ✅ Visit `/multi-order-form` and test order creation
4. ✅ Add combo admin link to your admin dashboard menu
5. ✅ Integrate into existing order forms if needed

## Support Info

→ Full details in `COMBO_SYSTEM_GUIDE.md`
→ Code examples in this file show exact implementation
→ All components fully commented for customization
