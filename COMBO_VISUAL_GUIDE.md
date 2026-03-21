# 🏏 COMBO SYSTEM - VISUAL WORKFLOW

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     COMBO OFFERS SYSTEM                          │
└─────────────────────────────────────────────────────────────────┘

                          DATA FLOW
┌──────────────────────────────────────────────────────────────┐
│  DATABASE (Supabase)                                         │
│  ┌────────────────────────┐  ┌──────────────────────────┐   │
│  │  product_combos        │  │ product_combo_items      │   │
│  ├────────────────────────┤  ├──────────────────────────┤   │
│  │ id                     │  │ id                       │   │
│  │ name                   │  │ combo_id (FK)            │   │
│  │ description            │  │ product_id (FK)          │   │
│  │ category               │  │ quantity                 │   │
│  │ combo_dp               │  │ discount_percent         │   │
│  │ combo_gst              │  │ gst_percent              │   │
│  │ is_active              │  │                          │   │
│  │ timestamps             │  │ timestamps               │   │
│  └────────────────────────┘  └──────────────────────────┘   │
│          ▲                            ▲                       │
│          └────────────────────────────┘                       │
│                  ONE-TO-MANY                                  │
└──────────────────────────────────────────────────────────────┘
              ▲
              │ RPC Functions
              │ get_all_active_combos_with_items()
              │ get_combo_details()
              │
┌─────────────┴────────────────────────────────────────────────┐
│                    FRONTEND COMPONENTS                        │
│                                                               │
│  ┌──────────────────────┐      ┌──────────────────────┐     │
│  │ ComboOffersAdmin     │      │ MultiOrderForm       │     │
│  │ (/combo-offers-admin)│      │ (/multi-order-form)  │     │
│  │                      │      │                      │     │
│  │ ADMIN FUNCTIONS:     │      │ USER FUNCTIONS:      │     │
│  │ • Create combos      │      │ • Select customer    │     │
│  │ • Add items          │      │ • Add products       │     │
│  │ • Edit quantities    │      │ • Select combos      │     │
│  │ • Set discounts      │      │ • Review order       │     │
│  │ • Delete combos      │      │ • Calculate totals   │     │
│  └──────────────────────┘      │ • Save order         │     │
│          │                      │                      │     │
│          │                      │ Uses:               │     │
│          │                      │ ComboSelector       │     │
│          │                      │ Component           │     │
│          │                      │                      │     │
│          └──────────────────────┴──────────────────────┘     │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

## Admin Workflow - Create Combo

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: Admin Opens /combo-offers-admin                      │
├─────────────────────────────────────────────────────────────┤
│ ① Click "Create New" tab                                    │
│ ② Enter combo name: "Beginner Cricket Kit"                  │
│ ③ Enter description: "Perfect for new players"              │
│ ④ Set category: "Bundles"                                   │
│ ⑤ Click "Create Combo"                                      │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: Add Products to Combo                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  SELECT FROM PRODUCTS:                                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Product Dropdown:                                    │  │
│  │ ├─ Cricket Bat CTB-100                              │  │
│  │ ├─ Cricket Ball CB-101                              │  │
│  │ ├─ Cricket Gloves CG-102                            │  │
│  │ └─ Cricket Pads CP-103                              │  │
│  └──────────────────────────────────────────────────────┘  │
│  ① Select: Cricket Bat CTB-100                             │
│  ② Quantity: 1                                             │
│  ③ Discount: 5%                                            │
│  ④ GST: 18%                                                │
│  ⑤ Click "Add Item to Combo"                              │
│                                                             │
│  Repeat for:                                                │
│  • Cricket Ball × 3                                        │
│  • Cricket Gloves × 1                                      │
│  • Cricket Pads × 1                                        │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ RESULT IN DATABASE:                                         │
├─────────────────────────────────────────────────────────────┤
│ product_combos:                                             │
│   id    | name                  | is_active | ...          │
│   ----  | ----                  | --------- | ---          │
│   uuid1 | Beginner Cricket Kit  | true      | ...          │
│                                                             │
│ product_combo_items:                                        │
│   id   | combo_id | product_id | qty | disc | gst | ...   │
│   ---  | -------- | ---------- | --- | ---- | --- | ---   │
│   uuid | uuid1    | prod_bat   | 1   | 5%   | 18% | ...   │
│   uuid | uuid1    | prod_ball  | 3   | 5%   | 18% | ...   │
│   uuid | uuid1    | prod_glove | 1   | 5%   | 18% | ...   │
│   uuid | uuid1    | prod_pads  | 1   | 5%   | 18% | ...   │
└─────────────────────────────────────────────────────────────┘
```

## Order Creation Workflow

```
┌──────────────────────────────────────────────────────────────┐
│ STEP 1: User Opens /multi-order-form                         │
├──────────────────────────────────────────────────────────────┤
│ LEFT PANEL                          RIGHT PANEL              │
│  ┌────────────────────┐           ┌──────────────────────┐  │
│  │ SELECT CUSTOMER    │           │  ORDER SUMMARY       │  │
│  │ ┌──────────────────┤           │  ┌────────────────┐  │  │
│  │ │ Rajesh (Dealer) │           │  │ 0 Items        │  │  │
│  │ │ Priya (Dealer)  │           │  │ Total: ₹0      │  │  │
│  │ │ Amit (Dealer)   │           │  └────────────────┘  │  │
│  │ └──────────────────┤           │  (Empty - Add items)│  │
│  │ ① Select: Rajesh   │           │                      │  │
│  └────────────────────┘           └──────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│ STEP 2A: Add Individual Product (Optional)                   │
├──────────────────────────────────────────────────────────────┤
│ LEFT PANEL:                                                  │
│  ┌──────────────────────────────────────┐                  │
│  │ ADD PRODUCT                          │                  │
│  │ Product: [Select Cricket Bat ✓]      │                  │
│  │ Quantity: [1]                        │                  │
│  │ Discount %: [0]                      │                  │
│  │ GST %: [18]                          │                  │
│  │ [+ Add Product]                      │                  │
│  └──────────────────────────────────────┘                  │
│                                                              │
│ RIGHT PANEL:                                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ PRODUCT CODE      QTY  DISC  GST   TOTAL            │  │
│  │ CTB-100 (Cricket  1    0%    18%   ₹590.00          │  │
│  │  Bat)                                               │  │
│  │ [All item calculations shown]                       │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│ STEP 2B: OR Select Combo Instead                             │
├──────────────────────────────────────────────────────────────┤
│ LEFT PANEL:                                                  │
│  ┌──────────────────────────────────────┐                  │
│  │ SELECT COMBO                         │                  │
│  │ ┌────────────────────────────────┐   │                  │
│  │ │ Beginner Cricket Kit (4 items) │   │ ◄─ Click to      │
│  │ │ ▼ EXPANDED                     │   │    expand        │
│  │ │  Item 1: Cricket Bat QTY [1]   │   │                  │
│  │ │  Item 2: Cricket Ball QTY [3]  │   │                  │
│  │ │  Item 3: Cricket Gloves QTY[1] │   │                  │
│  │ │  Item 4: Cricket Pads QTY [1]  │   │                  │
│  │ │  [+ Add Combo to Order]         │   │                  │
│  │ └────────────────────────────────┘   │                  │
│  └──────────────────────────────────────┘                  │
│                                                              │
│ User can edit quantities/discounts before adding!           │
└──────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│ STEP 3: Combo Items Added to Order                           │
├──────────────────────────────────────────────────────────────┤
│ RIGHT PANEL (Updated):                                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ PRODUCT CODE      QTY  DISC  GST   TOTAL              │ │
│  │ CTB-100          1    5%    18%   ₹589.90            │ │
│  │ (COMBO: Beginner Cricket Kit)                       │ │
│  │ ─────────────────────────────────────────────────    │ │
│  │ CB-101           3    5%    18%   ₹1,859.70          │ │
│  │ (COMBO: Beginner Cricket Kit)                       │ │
│  │ ─────────────────────────────────────────────────    │ │
│  │ CG-102           1    5%    18%   ₹235.18            │ │
│  │ (COMBO: Beginner Cricket Kit)                       │ │
│  │ ─────────────────────────────────────────────────    │ │
│  │ CP-103           1    5%    18%   ₹469.35            │ │
│  │ (COMBO: Beginner Cricket Kit)                       │ │
│  │ ────────────────────────────────────────────────────│ │
│  │ Subtotal:           ₹3,154.13                        │ │
│  │ Order Total:        ₹3,154.13                        │ │
│  │ ────────────────────────────────────────────────────│ │
│  │ Order Notes: [text area]                            │ │
│  │ [✅ Save Order]                                      │ │
│  └────────────────────────────────────────────────────┐ │
│                                                        │ │
│  ✨ All combo items added automatically!              │ │
│  ✨ User can still edit qty/disc/GST before saving    │ │
│  ✨ Totals calculate in real-time                     │ │
└──────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│ STEP 4: Review & Save Order                                  │
├──────────────────────────────────────────────────────────────┤
│ ① Review all items and totals                               │
│ ② Edit quantities/discounts if needed                       │
│ ③ Add order notes (delivery notes, special requests)        │
│ ④ Click "Save Order"                                        │
│ ✅ Order created with combo context saved                   │
└──────────────────────────────────────────────────────────────┘
```

## Total Calculation Example

```
COMBO: Beginner Cricket Kit (4 items)
Modified quantities in order form

Item 1: Cricket Bat
  Unit Price:     ₹500
  Quantity:       1
  Discount:       5%
  GST:            18%
  
  Calculation:
  Subtotal = 500 × 1 = ₹500
  Discount = 500 × 5% = ₹25
  After Disc = 500 - 25 = ₹475
  GST = 475 × 18% = ₹85.50
  TOTAL = ₹475 + ₹85.50 = ₹560.50

Item 2: Cricket Ball
  Unit Price:     ₹220
  Quantity:       3 (default from combo was 3, user can edit)
  Discount:       5%
  GST:            18%
  
  Calculation:
  Subtotal = 220 × 3 = ₹660
  Discount = 660 × 5% = ₹33
  After Disc = 660 - 33 = ₹627
  GST = 627 × 18% = ₹112.86
  TOTAL = ₹627 + ₹112.86 = ₹739.86

[... repeat for other items ...]

FINAL ORDER TOTAL = Sum of all items = ₹XXXX.XX
```

## Database Query Flow

```
┌──────────────────────┐
│ User Page Load       │
│ /combo-offers-admin  │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│ RPC: get_all_active_combos_with_items()     │
└──────┬───────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│ SELECT * FROM product_combos WHERE is_active│
│ + JOIN product_combo_items                   │
│ + JOIN products                              │
│ GROUP BY combo                               │
└──────┬───────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│ RETURNS:                                                     │
│ {                                                            │
│   combo_id: "uuid1",                                         │
│   combo_name: "Beginner Cricket Kit",                        │
│   item_count: 4,                                             │
│   items: [                                                   │
│     { product_id, product_name, quantity, discount, gst },  │
│     { product_id, product_name, quantity, discount, gst },  │
│     ...                                                      │
│   ]                                                          │
│ }                                                            │
└────────────────────────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────────┐
│ Display in ComboSelector Component         │
│ User selects items and edits if needed    │
│ Adds to order with edits applied          │
└────────────────────────────────────────────┘
```

## Component Integration Map

```
                    App.tsx
                      │
         ┌────────────┼────────────┐
         │            │            │
         ▼            ▼            ▼
    Dashboard    /combo-offers  /multi-order
                 -admin         -form
                      │            │
    ┌─────────────────┘            │
    │                              │
    ▼                              ▼
ComboOffersAdmin      MultiOrderForm
    (Admin)               (User)
                            │
                  ┌─────────┘
                  │
                  ▼
            ComboSelector
          (Reusable Component)
                  │
         ┌────────┴────────┐
         │                 │
         ▼                 ▼
    RPC Functions    Order State
    get_combos()     setOrderItems()
```

## State Flow - Order Creation

```
User Selects Combo
        │
        ▼
ComboSelector Component
  • Fetch combo items
  • Allow qty/disc edits
  • Create OrderLineItem[]
        │
        ▼
onItemsAdded() Callback
        │
        ▼
MultiOrderForm.setOrderItems()
        │
        ▼
Order State Updated
  [
    { product_id, quantity, discount, ..., combo_id, combo_name },
    { product_id, quantity, discount, ..., combo_id, combo_name },
    { product_id, quantity, discount, ..., combo_id, combo_name },
    { product_id, quantity, discount, ..., combo_id, combo_name }
  ]
        │
        ▼
Order Table Renders
  • Shows all items
  • Allows inline edits
        │
        ▼
User Clicks "Save Order"
        │
        ▼
Submit with Combo Context
  (combo_id preserved for tracking)
```

## Security & Access Control

```
Supabase RLS

PRODUCTS TABLE
├─ SELECT: ✅ Public (anon + auth)
├─ INSERT: 🔒 Authenticated only
├─ UPDATE: 🔒 Admin only
└─ DELETE: 🔒 Admin only

PRODUCT_COMBOS TABLE
├─ SELECT: ✅ Public (anyone can see active combos)
├─ INSERT: 🔒 Authenticated
├─ UPDATE: 🔒 Admin or creator
└─ DELETE: 🔒 Admin only

PRODUCT_COMBO_ITEMS TABLE
├─ SELECT: ✅ Public (anyone can fetch combo contents)
├─ INSERT: 🔒 Authenticated
├─ UPDATE: 🔒 Authenticated
└─ DELETE: 🔒 Admin only
```

Perfect! I've created a complete combo system for you. Let me create one final summary document:
