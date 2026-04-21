# Invoice Designer - New Features Summary

## 🎨 What's New

### Canvas-Based Drag-and-Drop Design System
Instead of the previous section-based approach, the new Invoice Designer uses a **free-form canvas** like professional accounting software (QuickBooks, Tally, Wave).

---

## ✨ Key Features Implemented

### 1. ✅ Free-Form Positioning
- **Drag any element anywhere** on the page
- **Grid-based**: 10mm snap-to-grid for precise alignment
- **Visual feedback**: Blue ring shows selected elements
- **Real-time movement**: Instant updates as you drag

### 2. ✅ Multiple Design Elements
- **Text**: Static content (titles, labels, "Original Copy", etc.)
- **Fields**: Dynamic data linked to your invoice data
- **Lines**: Dividers and borders  
- **Boxes**: Bordered containers for sections
- **[Future] Images**: Logo and company seal placement

### 3. ✅ Page Configuration
- **4 Page Sizes**: A4, Letter, A5, Legal
- **2 Orientations**: Portrait & Landscape
- **Copy Types**: Original, Duplicate, Carbon (for multi-part printing)

### 4. ✅ Pre-Built Blank Templates
1. **Simple A4** - Clean minimal design with title and divider
2. **Professional GST** - Company name + GSTIN at top (GST-ready)
3. **Multi-Copy** - Pre-setup for 3-part invoice forms
4. **Landscape A4** - Wide format for detailed tables

### 5. ✅ Element Property Editor
For each selected element, configure:
- **Label**: Element name (for reference)
- **Position**: Exact X, Y coordinates in millimeters
- **Size**: Width and height
- **Text Content**: For text elements
- **Field Type**: For dynamic data elements
- **Typography**: Font size (6-48pt), color picker, alignment
- **Actions**: Duplicate with one click, Delete element

### 6. ✅ Advanced Controls
- **Full Zoom**: 50% to 200% zoom levels with +/- buttons
- **Real-time Preview**: Canvas updates as you edit
- **Elements List**: Sidebar showing all elements with quick select
- **Style Customization**: Font size, color, weight, alignment
- **Export to JSON**: Download design for backup/sharing

### 7. ✅ User-Friendly Interface
- **Left Sidebar**: Templates + Page Settings
- **Center Canvas**: Visual design workspace
- **Right Sidebar**: Add Elements + Properties + Elements List
- **Grid Background**: Optional 10mm grid for alignment
- **Professional Layout**: Similar to Adobe/Figma/Canva

---

## 🎯 Use Cases

### Case 1: Multi-Copy Invoice (Original, Duplicate, Carbon)
```
Step 1: Load "Multi-Copy" template
Step 2: Set page size to A4
Step 3: Add 3 text elements:
   - "Original" at Y: 10mm (red, top-right)
   - "Duplicate" at Y: 135mm (blue, top-right)  
   - "Carbon" at Y: 260mm (green, top-right)
Step 4: Add company details fields
Step 5: Export and save
```

### Case 2: GST-Compliant Invoice
```
Step 1: Load "Professional GST" template
Step 2: Drag company_name field to top-left
Step 3: Add company_gstin field below it
Step 4: Add divider line for separation
Step 5: Arrange bill details fields in 2 columns
Step 6: Configure items table section
Step 7: Add totals at bottom
Step 8: Add signature section at footer
```

### Case 3: Compact Invoice (A5 Size)
```
Step 1: Start blank
Step 2: Change page size to A5
Step 3: Compact layout fits narrow format
Step 4: Add minimal fields
Step 5: Perfect for receipt/small invoice
```

---

## 📊 Comparison: Old vs New

| Feature | Old System | New System |
|---------|-----------|-----------|
| Layout Type | Fixed Sections | Free-Form Canvas |
| Element Positioning | Auto (section-based) | Manual (exact X,Y mm) |
| Customization | Limited | Unlimited |
| Drag-and-Drop | ❌ No | ✅ Full Support |
| Element Types | 3 (Text, Field, Visibility) | 5+ (Text, Field, Line, Box, Image) |
| Page Sizes | 1 (A4 implicit) | 4 (A4, Letter, A5, Legal) |
| Orientations | 1 (Portrait) | 2 (Portrait, Landscape) |
| Copy Types | ❌ No | ✅ Yes (Original/Duplicate/Carbon) |
| Pre-Built Templates | ❌ No | ✅ 4 Blank Templates |
| Visual Grid | ❌ No | ✅ 10mm Grid |
| Zoom Control | ❌ No | ✅ 50-200% |
| Elements List | ❌ Simple | ✅ Full Sidebar |
| Import/Export | ❌ No | ✅ JSON Export |
| Accounting Software Parity | ❌ No | ✅ Yes (Like QB/Tally) |

---

## 🚀 Getting Started

### Route to Canvas Designer
```
🏠 Admin Dashboard
  ↓
📋 Billing & Accounts (dropdown)
  ↓
✏️ Invoice Designer (Canvas)  [NEW]
```

### Basic Workflow
1. Click "Open Designer" button
2. Choose a blank template (or start empty)
3. Select page size and orientation
4. Add elements (Text, Fields, Lines, Boxes)
5. Drag elements to desired positions
6. Configure properties (font, color, size)
7. Export design to JSON
8. Save to database

---

## 🎨 Design Elements Cheat Sheet

### Text Element
```javascript
{
  type: "text",
  content: "TAX INVOICE",
  style: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#000000",
    alignment: "center"
  }
}
```

### Field Element
```javascript
{
  type: "field",
  content: "company_name",  // Or any field from available list
  style: {
    fontSize: 14,
    fontWeight: "normal",
    color: "#000000"
  }
}
```

### Line Element
```javascript
{
  type: "line",
  width: 180,  // Length of line
  style: {
    borderWidth: 2,
    borderColor: "#cccccc"
  }
}
```

### Box Element
```javascript
{
  type: "box",
  width: 100,
  height: 50,
  style: {
    borderWidth: 2,
    borderColor: "#000000"
  }
}
```

---

## 📐 Measurement Guide

### Common Distances (A4: 210 × 297 mm)
- **Page Margins**: ~20mm left/right, ~15mm top/bottom
- **Section Spacing**: 10-15mm between sections
- **Element Padding**: 2-5mm within boxes
- **Line Length**: 170mm (full width minus margins)
- **Column Width**: 25-35mm per column

### Example Layout (A4 Portrait)
```
Y: 10-20mm   → Header section (Company name, GSTIN)
Y: 22-25mm   → Divider line
Y: 27-45mm   → Bill details (dates, bill to/ship to)
Y: 47-60mm   → Divider line
Y: 62-220mm  → Items table (variable rows)
Y: 222-250mm → Totals section
Y: 252-275mm → Terms & Conditions
Y: 277-295mm → Signature section

X: 20-190mm  → Main content area
```

---

## 🔗 Database Integration

### Stored in bill_design_templates table
```sql
{
  id: UUID,
  name: "My Invoice Design",
  canvas_design: {
    "elements": [ /* 5+ elements */ ],
    "page_width": 210,
    "page_height": 297,
    "unit": "mm"
  },
  page_size: "A4",
  page_orientation: "portrait",
  copy_types: ["Original", "Duplicate", "Carbon"],
  category: "custom",
  is_template: false,
  is_default: false
}
```

### JSON Export Format
```json
{
  "name": "Professional GST Invoice",
  "description": "GST-compliant invoice design",
  "page_size": "A4",
  "page_orientation": "portrait",
  "copy_types": ["Original", "Duplicate"],
  "canvas_design": {
    "elements": [],
    "page_width": 210,
    "page_height": 297,
    "unit": "mm"
  }
}
```

---

## 🎯 Next Steps (After Canvas Designer Launch)

1. **Save Designs**: Store exported JSON to database
2. **Template Library**: Manage multiple designs
3. **Set As Default**: Select which design for each company
4. **Bill Generation**: Use selected template during bill creation
5. **Dynamic Rendering**: Populate fields with actual data
6. **Print Preview**: Full WYSIWYG preview
7. **Multi-Part Printing**: Handle Original/Duplicate/Carbon

---

## 📱 Responsive Features

- **Canvas scales** with zoom (50-200%)
- **Properties update** in real-time
- **Grid helps alignment** at any zoom level
- **Touch-friendly** controls (buttons, inputs)
- **Keyboard support** (coming soon)

---

## 🔐 Security & Permissions

- **Admin Only**: Only admins can design/edit templates
- **Company-Scoped**: Templates per company
- **Default Per Company**: One default template per company (enforced via UNIQUE INDEX)
- **Audit Trail**: created_at, updated_at, created_by tracked

---

## 📝 Available Field Types

### Header Fields
- company_name
- company_gstin
- company_address
- company_phone
- company_email
- bill_title

### Bill Details Fields
- bill_number
- invoice_date
- order_reference
- financial_year
- bill_to
- ship_to
- dealer_gst

### Items Table Fields
- item_sno
- item_description
- item_hsn_sac
- item_quantity
- item_unit
- item_rate
- item_discount
- item_gst
- item_amount

### Totals Fields
- subtotal
- total_discount
- taxable_value
- total_gst
- freight_charges
- round_off
- grand_total
- amount_in_words

### Terms Fields
- custom_text
- payment_terms
- bank_details
- note

### Signature Fields
- terms_heading
- authorized_by
- company_seal
- date_line

---

## 🎓 Tips for Best Results

1. ✅ Use the pre-built templates as a starting point
2. ✅ Keep margins consistent (20mm left/right standard)
3. ✅ Test multipart printing with Original/Duplicate/Carbon
4. ✅ Use lines to separate sections clearly
5. ✅ Bold company name and grand total for emphasis
6. ✅ Export regularly as backup
7. ✅ Test with sample data before going live
8. ✅ Document your layout in template name/description

---

## 📞 Support

- **Documentation**: See [INVOICE_DESIGNER_GUIDE.md](./INVOICE_DESIGNER_GUIDE.md)
- **Schema**: `SQL_COMMAND_CREATE_BILL_DESIGN_TEMPLATES.sql`
- **Component**: `src/pages/BillDesignCanvasBuilder.tsx`
- **Database**: `bill_design_templates`, `bill_design_available_fields`

---

**Last Updated**: April 2026  
**Version**: 1.0 Canvas-Based Designer  
**Status**: ✅ Ready for Testing
