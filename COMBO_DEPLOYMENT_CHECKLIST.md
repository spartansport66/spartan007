# 📋 COMBO SYSTEM - DEPLOYMENT CHECKLIST

**Date Started:** March 20, 2026

---

## PHASE 1: DATABASE DEPLOYMENT

### ⚪ Step 1.1: Prepare SQL Schema
- [ ] Locate file: `SQL_COMMAND_CREATE_COMBO_SCHEMA.sql` in project root
- [ ] Open file in text editor
- [ ] Verify content includes:
  - [ ] CREATE TABLE product_combos
  - [ ] CREATE TABLE product_combo_items
  - [ ] CREATE FUNCTION get_combo_details
  - [ ] CREATE FUNCTION get_all_active_combos_with_items
  - [ ] RLS policies
  - [ ] GRANT statements

### ⚪ Step 1.2: Deploy to Supabase
- [ ] Open Supabase Dashboard
- [ ] Navigate to: SQL Editor
- [ ] Copy entire SQL_COMMAND_CREATE_COMBO_SCHEMA.sql content
- [ ] Paste into SQL editor
- [ ] Click "RUN" button
- [ ] Wait for completion
- [ ] ✅ Should see success messages for each CREATE statement

### ⚪ Step 1.3: Verify Schema
- [ ] Run this SQL in Supabase:
  ```sql
  SELECT COUNT(*) as combo_count FROM product_combos;
  ```
  Expected: `combo_count = 0`

- [ ] Run this SQL:
  ```sql
  SELECT COUNT(*) as item_count FROM product_combo_items;
  ```
  Expected: `item_count = 0`

- [ ] Test RPC function:
  ```sql
  SELECT * FROM rpc('get_all_active_combos_with_items');
  ```
  Expected: Should return empty array `[]`

---

## PHASE 2: APPLICATION CODE DEPLOYMENT

### ⚪ Step 2.1: Verify Files Exist
- [ ] File exists: `src/pages/ComboOffersAdmin.tsx`
- [ ] File exists: `src/components/ComboSelector.tsx`
- [ ] File exists: `src/pages/MultiOrderForm.tsx`
- [ ] File exists: `src/App.tsx` (check if updated with routes)

### ⚪ Step 2.2: Check Routes in App.tsx
- [ ] Open `src/App.tsx`
- [ ] Verify import: `import ComboOffersAdmin from "./pages/ComboOffersAdmin";`
- [ ] Verify import: `import MultiOrderForm from "./pages/MultiOrderForm";`
- [ ] Verify route: `<Route path="/combo-offers-admin" element={<ComboOffersAdmin />} />`
- [ ] Verify route: `<Route path="/multi-order-form" element={<MultiOrderForm />} />`

### ⚪ Step 2.3: Build Application
- [ ] Run build command (in terminal):
  ```bash
  npm run build
  # OR
  pnpm build
  ```
- [ ] Wait for build to complete
- [ ] Check for errors (should be none)
- [ ] Verify build output contains no TypeScript errors

### ⚪ Step 2.4: Start Development Server
- [ ] Run dev server:
  ```bash
  npm run dev
  # OR
  pnpm dev
  ```
- [ ] Wait for "ready on http://localhost:..."
- [ ] Note the port number

---

## PHASE 3: BROWSER TESTING

### ⚪ Step 3.1: Clear Browser Cache
- [ ] Press: `Ctrl+Shift+R` (hard refresh)
- [ ] Wait for page to reload
- [ ] Close browser console if any errors visible

### ⚪ Step 3.2: Test Combo Offers Admin Route
- [ ] Open browser to: `http://localhost:PORT/combo-offers-admin`
- [ ] Replace PORT with actual port (usually 5173)
- [ ] ✅ Page should load without errors
- [ ] Should see: "🏏 Combo Offers Management" heading
- [ ] Should see: Two tabs "All Combos" and "Create New"
- [ ] Should see: Message "No combos created yet"

### ⚪ Step 3.3: Create First Test Combo
- [ ] Click: "Create New" tab
- [ ] Enter Name: `"Test Cricket Bundle"`
- [ ] Enter Description: `"Testing the combo system"`
- [ ] Enter Category: `"Test"`
- [ ] Leave GST: `18` (default)
- [ ] Click: "Create Combo" button
- [ ] ✅ Should see: "Combo 'Test Cricket Bundle' created successfully"
- [ ] Click: "All Combos" tab
- [ ] ✅ Should see combo in list on left

### ⚪ Step 3.4: Add Products to Combo
- [ ] Click on "Test Cricket Bundle" in list
- [ ] Scroll to "Add Product to Combo" section
- [ ] Click: Product dropdown
- [ ] ✅ Should see product list
- [ ] Select: Any product (e.g., first one)
- [ ] Set Quantity: `2`
- [ ] Set Discount: `5`
- [ ] Set GST: `18`
- [ ] Click: "Add Item to Combo"
- [ ] ✅ Should see success toast
- [ ] ✅ Should see item in table above

### ⚪ Step 3.5: Add More Products (Repeat)
- [ ] Add 2-3 more products to combo
- [ ] ✅ Each should appear in items table
- [ ] ✅ Each should show qty, discount, GST columns

---

## PHASE 4: TEST MULTI-ITEM ORDER FORM

### ⚪ Step 4.1: Access Order Form
- [ ] Open browser to: `http://localhost:PORT/multi-order-form`
- [ ] ✅ Page should load
- [ ] Should see: "🏏 Create Multi-Item Order" heading
- [ ] Should see: Three sections:
  - Left: "👤 Select Customer", "➕ Add Product", "📦 Select Combo"
  - Right: "📋 Order Items (0)"

### ⚪ Step 4.2: Test Customer Selection
- [ ] Click dropdown: "SELECT CUSTOMER"
- [ ] ✅ Should see customer list
- [ ] Select: Any customer
- [ ] ✅ Dropdown should show selected customer

### ⚪ Step 4.3: Test Add Individual Product
- [ ] Click dropdown: "Product"
- [ ] ✅ Should see long product list
- [ ] Select: Any product
- [ ] Change Quantity: `2`
- [ ] Change Discount: `5`
- [ ] Change GST: `18`
- [ ] Click: "Add Product"
- [ ] Wait 1 second
- [ ] ✅ Should see item appear on right in table
- [ ] ✅ Totals should calculate and show at bottom

### ⚪ Step 4.4: Test Combo Selection
- [ ] On left, find: "📦 Select Product Combo" section
- [ ] Search box should be visible
- [ ] ✅ Should see your "Test Cricket Bundle" listed
- [ ] Click on combo name to expand
- [ ] ✅ Should see all items you added
- [ ] Each item should have editable qty/disc/gst
- [ ] Try editing a quantity
- [ ] Click: "Add Combo to Order" button
- [ ] ✅ All combo items should appear on right table
- [ ] Each marked with: "COMBO: Test Cricket Bundle"

### ⚪ Step 4.5: Test Order Total Calculation
- [ ] Verify on right panel:
  - [ ] Subtotal shows
  - [ ] Order Total shows
  - [ ] ✅ Total = Subtotal + GST - Discount (correct math)
- [ ] Try editing an item quantity in table
- [ ] ✅ Total should update immediately
- [ ] Try editing discount
- [ ] ✅ Total should update immediately

### ⚪ Step 4.6: Test Remove Item
- [ ] Click trash icon (🗑️) on any item
- [ ] ✅ Item should disappear
- [ ] ✅ Total should recalculate

### ⚪ Step 4.7: Test Order Notes
- [ ] Click in "Order Notes" textarea
- [ ] Type something: `"Test order - please deliver tomorrow"`
- [ ] ✅ Text should appear

### ⚪ Step 4.8: Test Save Order
- [ ] Click: "Save Order" button
- [ ] ✅ Should see: "Order created successfully!" toast
- [ ] ✅ Order items should clear (reset form)
- [ ] Check browser console (F12) for any errors

---

## PHASE 5: CREATE PRODUCTION COMBOS

Once testing passes, create your actual combos:

### ⚪ Step 5.1: First Real Combo
- [ ] Go to: `/combo-offers-admin`
- [ ] Click: "Create New"
- [ ] Enter: Combo name (e.g., "Beginner Cricket Kit")
- [ ] Enter: Meaningful description
- [ ] Enter: Category
- [ ] Click: "Create Combo"
- [ ] Add 4-6 products with reasonable quantities
- [ ] ✅ Combo is live and ready for orders

### ⚪ Step 5.2: Second Combo (Optional)
- [ ] Create another combo for different use case
- [ ] Add different products
- [ ] Test in order form

### ⚪ Step 5.3: Verify in Order Form
- [ ] Go to: `/multi-order-form`
- [ ] Scroll down to combo selector
- [ ] ✅ Your new combos should appear
- [ ] Try selecting and adding to order

---

## PHASE 6: ADMIN DASHBOARD INTEGRATION (Optional)

### ⚪ Step 6.1: Add Navigation Link
- [ ] Find your admin dashboard component
- [ ] Add navigation link:
  ```tsx
  <Link to="/combo-offers-admin">🏏 Manage Combos</Link>
  ```
- [ ] ✅ Link should appear in admin menu
- [ ] Click link
- [ ] ✅ Should navigate to combo admin page

### ⚪ Step 6.2: Add Multiple Routes (Optional)
- [ ] Consider adding both routes:
  - [ ] `/combo-offers-admin` (Admin creates combos)
  - [ ] `/multi-order-form` (Users create orders)
- [ ] Add both to admin/user dashboards as appropriate

---

## PHASE 7: FINAL VERIFICATION

### ⚪ Step 7.1: Full Workflow Test
- [ ] Start: Admin at `/combo-offers-admin`
- [ ] Create: New combo with 3+ products
- [ ] Switch: To `/multi-order-form`
- [ ] Select: Customer
- [ ] Add: The combo you just created
- [ ] Add: 1-2 individual products
- [ ] Edit: Some quantities
- [ ] Save: Order
- [ ] ✅ Everything works end-to-end

### ⚪ Step 7.2: Error Handling
- [ ] Try: Saving order with NO customer selected
  - [ ] ✅ Should show error toast
- [ ] Try: Selecting combo with no customer selected
  - [ ] ✅ Should work (only needs customer at save time)
- [ ] Try: Removing all items then saving
  - [ ] ✅ Should show error: "Please add at least one item"

### ⚪ Step 7.3: Browser Compatibility
- [ ] Test in: Chrome
  - [ ] ✅ Works
- [ ] Test in: Firefox
  - [ ] ✅ Works
- [ ] Test in: Safari (if using Mac)
  - [ ] ✅ Works
- [ ] Test in: Edge
  - [ ] ✅ Works

### ⚪ Step 7.4: Mobile Responsiveness (Optional)
- [ ] Press: F12 (Dev Tools)
- [ ] Click: Device Toolbar (mobile view)
- [ ] Select: Any phone device
- [ ] ✅ Page should adapt to mobile width
- [ ] Test: Dropdowns work on mobile
- [ ] Test: Buttons clickable
- [ ] Test: Tables scrollable on mobile

---

## PHASE 8: USER TRAINING & DOCUMENTATION

### ⚪ Step 8.1: Document Routes
- [ ] Create internal wiki/docs with:
  - [ ] Admin route: `/combo-offers-admin`
  - [ ] User route: `/multi-order-form`
  - [ ] What each does
  - [ ] How to use each

### ⚪ Step 8.2: Train Admins
- [ ] Show admin how to:
  - [ ] Create combos
  - [ ] Add products
  - [ ] Edit details
  - [ ] Delete if needed

### ⚪ Step 8.3: Train Order Managers
- [ ] Show users how to:
  - [ ] Select customer
  - [ ] Add products
  - [ ] Select combos
  - [ ] Make edits
  - [ ] Save orders

### ⚪ Step 8.4: Create User Guide
- [ ] Document with screenshots
- [ ] Save as: `COMBO_USER_GUIDE.md` in project

---

## PHASE 9: DEPLOYMENT TO PRODUCTION

### ⚪ Step 9.1: Final Code Review
- [ ] Review: `src/pages/ComboOffersAdmin.tsx`
  - [ ] [ ] No console.logs left
  - [ ] [ ] All error handling in place
  - [ ] [ ] Loading states work
- [ ] Review: `src/components/ComboSelector.tsx`
  - [ ] [ ] No console.logs left
  - [ ] [ ] Error boundaries
  - [ ] [ ] Loading states
- [ ] Review: `src/pages/MultiOrderForm.tsx`
  - [ ] [ ] All validation working
  - [ ] [ ] Error messages clear
  - [ ] [ ] Loading states work

### ⚪ Step 9.2: Database Backup
- [ ] In Supabase Dashboard
- [ ] Take backup of database
- [ ] Save backup location for reference

### ⚪ Step 9.3: Deploy to Production
- [ ] Deploy your application (Vercel/your hosting)
- [ ] Wait for deployment to complete
- [ ] Test in production:
  - [ ] Navigate to combo admin
  - [ ] Navigate to order form
  - [ ] Create test combo
  - [ ] Create test order

### ⚪ Step 9.4: Monitor
- [ ] Check browser console for errors
- [ ] Check Supabase logs for DB errors
- [ ] Monitor RPC function calls
- [ ] All should be clean

---

## TROUBLESHOOTING REFERENCE

### Issue: Components not found
**Solution:** Check file paths, verify imports in App.tsx

### Issue: Database table not found
**Solution:** Run SQL schema in Supabase SQL Editor

### Issue: Combos not appearing
**Solution:** 
1. Ensure combo is_active = true
2. Hard refresh browser (Ctrl+Shift+R)
3. Check Supabase for combo records

### Issue: RPC function not found
**Solution:** Re-run SQL schema, check function syntax

### Issue: Products not loading
**Solution:** Check products table exists, verify pagination

### Issue: Calculations wrong
**Solution:** Check formula: `(price × qty) - discount + ((price × qty - discount) × gst%)`

### Issue: Order not saving
**Solution:** Check browser console, verify customer selected

---

## SIGN-OFF CHECKLIST

- [ ] ✅ SQL schema deployed
- [ ] ✅ Components created and in place
- [ ] ✅ Routes configured
- [ ] ✅ Admin combo creation working
- [ ] ✅ Product selection working
- [ ] ✅ Order form working
- [ ] ✅ Calculations correct
- [ ] ✅ Save functionality working
- [ ] ✅ No console errors
- [ ] ✅ No network errors
- [ ] ✅ Admin trained
- [ ] ✅ Users trained
- [ ] ✅ Documentation complete
- [ ] ✅ Deployed to production
- [ ] ✅ Production testing passed

---

**Status:** Ready for deployment

**Deploy Date:** _____________

**Deployed By:** _____________

**Notes:** ___________________________________________________________________

---

**Once this entire checklist is complete, the Combo System is ready for full production use!**
