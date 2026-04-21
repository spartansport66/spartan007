# Invoice Designer - Complete Guide

## Overview

The new **Invoice Designer (Canvas)** is a fully professional, drag-and-drop invoice design system similar to QuickBooks, Tally, and other accounting software. It allows you to create custom invoice layouts with complete freedom over element positioning.

---

## Key Features

### 1. **Drag-and-Drop Canvas**
- **Free positioning**: Drag any element anywhere on the page
- **Snap-to-grid**: 10mm grid for precise alignment
- **Real-time preview**: See changes instantly
- **Visual selection**: Blue highlight on selected elements
- **Zoom control**: 50% to 200% zoom levels

### 2. **Design Elements**

#### Text Element
- **Purpose**: Add static text (headers, labels, titles)
- **Features**:
  - Customizable font size (6pt - 48pt)
  - Font weight (normal/bold)
  - Text color picker
  - Alignment (left/center/right)
  - Multi-line support
- **Example**: "TAX INVOICE", "Original Copy", company branding

#### Field Element
- **Purpose**: Link dynamic business data fields
- **Available Fields**:
  - **Header**: Company Name, GSTIN, Address, Phone, Email, Bill Title
  - **Bill Details**: Bill Number, Date, Order Reference, FY, Bill To, Ship To, Dealer GST
  - **Items Table**: S.No, Description, HSN/SAC, Qty, Unit, Rate, Discount%, GST%, Amount
  - **Totals**: Subtotal, Discount, Taxable Value, GST, Freight, Round Off, Grand Total, Amount in Words
  - **Terms**: Custom Text, Payment Terms, Bank Details, Note
  - **Signature**: Terms Label, Authorized By, Company Seal, Date Line
- **Markup**: Shows as `[field_name]` on canvas
- **Real Data**: Replaced with actual values during bill generation

#### Line Element
- **Purpose**: Add dividers and borders
- **Features**:
  - Adjustable border width (0.5mm - 5mm)
  - Custom colors
  - Length control via width parameter

#### Box Element
- **Purpose**: Add borders/containers
- **Features**:
  - Customizable border width and color
  - Can contain multiple elements
  - Perfect for sections

#### Image Element (Future)
- Logo placement
- Company seal images
- QR codes

---

## Page Configurations

### Page Sizes
- **A4** (210 × 297 mm) - Standard invoice
- **Letter** (216 × 279 mm) - US standard
- **A5** (148 × 210 mm) - Compact
- **Legal** (216 × 356 mm) - Extended

### Orientations
- **Portrait** (Default) - Standard
- **Landscape** - Wide format for detailed item tables

---

## Copy Types (Multi-Part Forms)

Perfect for accounting copies:

- **Original** - Customer copy
- **Duplicate** - Your business copy
- **Carbon** - Optional third copy

You can:
1. Add a text element with "[COPY]" label
2. Duplicate the entire design for each copy type
3. Position slightly offset for multi-part printing

---

## Pre-Built Templates

### 1. Simple A4
- Clean, minimal design
- Great starting point
- Header title with divider line

### 2. Professional GST
- Company name and GSTIN at top
- GST-compliant layout
- Ready for Indian invoices

### 3. Multi-Copy
- Pre-positioned "Copy" labels
- Original, Duplicate, Carbon setup
- Multi-part form friendly

### 4. Landscape A4
- Wide format
- Ideal for complex item tables
- Extra columns support

---

## How to Use

### Step 1: Open Invoice Designer
1. Go to **Admin Dashboard**
2. Navigate to **Billing & Accounts** → **Invoice Designer (Canvas)**
3. Click **"Open Designer"** button

### Step 2: Choose Template or Start Blank
- **Select a blank template** from left sidebar:
  - Simple A4
  - Professional GST
  - Multi-Copy
  - Landscape A4
- Or **start completely from scratch**

### Step 3: Configure Page
- **Page Size**: Select from A4, Letter, A5, Legal
- **Orientation**: Portrait or Landscape
- **Zoom**: Adjust to see full page or zoom in for detail work

### Step 4: Add Elements
Click buttons in right sidebar:
- **Text**: Static content (titles, labels)
- **Field**: Dynamic data from your system
- **Box**: Bordered containers
- **Line**: Dividers

### Step 5: Position Elements
1. **Click element** on canvas to select (blue ring appears)
2. **Drag** to move it
3. **Modify properties** in right panel:
   - Label name
   - X, Y coordinates (mm)
   - Width, Height (mm)
   - Font size, color, style

### Step 6: Fine-Tune Properties
For selected element:
- **Position**: Set exact X,Y in millimeters
- **Size**: Set exact width/height
- **Typography**: Font size, color, alignment
- **Actions**: Duplicate, Delete

### Step 7: Export Design
Click **"Export Design"** button:
- Downloads as `.json` file
- Ready to save to database
- Can be imported into other templates

---

## Properties Panel

When an element is selected:

| Property | Options | Notes |
|----------|---------|-------|
| Label | Text | Element identifier |
| Content | Text/Field name | What displays (for Text) or which field (for Field) |
| X Position | 0-210 mm | Left margin |
| Y Position | 0-297 mm | Top margin |
| Width | 0-210 mm | Element width |
| Height | 0-297 mm | Element height |
| Font Size | 6-48 pt | Text size |
| Color | Hex/RGB | Text color |
| Alignment | Left/Center/Right | Horizontal alignment |

---

## Advanced Tips

### 1. Multi-Copy Invoices
```
Original:  Y position = 10mm, Height = 130mm
Duplicate: Y position = 135mm, Height = 130mm
Carbon:    Y position = 260mm, Height = 130mm
```

### 2. Dynamic Tables
Use multiple Field elements in a row pattern:
```
Column 1: S.No        [item_sno]
Column 2: Description [item_description]
Column 3: Qty         [item_quantity]
Column 4: Rate        [item_rate]
Column 5: Amount      [item_amount]
```

### 3. Company Branding
1. Add TEXT element at top for "TAX INVOICE" title
2. Add FIELD element for company_name
3. Add FIELD element for company_gstin
4. Use LINE to create divider

### 4. Alignment Guide
- **Left alignment**: X = 20mm (standard margin)
- **Right alignment**: X = 180mm (for right-aligned data)
- **Center alignment**: X = 105mm (page center for A4)

### 5. Element Layering
Use Z-Index in exported JSON:
```javascript
{
  "zIndex": 1  // Higher numbers appear on top
}
```

---

## Invoice Elements Explained

### Header Section
- Company identity (name, GSTIN, address)
- Invoice title ("TAX INVOICE", "Cost Invoice", etc.)
- Company logo/branding

### Bill Details Section
- Invoice number and date
- Bill To / Ship To sections
- Order reference
- Financial year

### Items Table Section
- Column headers: S.No, Description, HSN/SAC, Qty, Unit, Rate, Discount%, GST%, Amount
- Dynamic rows filled during bill generation
- Support for multiple line items

### Totals Section
- Subtotal
- Discount summary
- Taxable value
- GST total
- Freight charges
- Round-off adjustment
- **Grand Total** (highlighted)
- Amount in words

### Terms & Conditions Section
- Custom terms text
- Payment terms
- Bank details
- Additional notes

### Signature Section
- Terms and conditions heading
- Authorized signature line
- Company seal placeholder
- Date line

---

## Database Integration

### Canvas Design JSON Structure
```javascript
{
  "elements": [
    {
      "id": "unique-id",
      "type": "text|field|line|box|image|table",
      "label": "Element Name",
      "x": 20,           // X position in mm
      "y": 10,           // Y position in mm
      "width": 100,      // Width in mm
      "height": 20,      // Height in mm
      "content": "Text or field_name",
      "style": {
        "fontSize": 12,
        "fontWeight": "normal|bold",
        "color": "#000000",
        "alignment": "left|center|right",
        "borderColor": "#cccccc",
        "borderWidth": 1
      },
      "zIndex": 1
    }
  ],
  "page_width": 210,    // A4 width
  "page_height": 297,   // A4 height
  "unit": "mm"
}
```

### Saved to Database
- Table: `bill_design_templates`
- Column: `canvas_design` (JSONB)
- Stores complete element positioning
- Retrieved during bill generation

---

## Workflow Comparison

### Before (Fixed Sections)
```
Section-Based Layout:
├── Header Section (fixed order)
├── Bill Details (fixed order)
├── Items Table (fixed order)
└── Totals (fixed order)
❌ Limited customization
❌ Can't move header to bottom
❌ Can't resize sections
```

### After (Canvas-Based)
```
Free-Form Canvas:
├── Any element anywhere
├── Overlapping allowed
├── Any order
├── Any size
├── Full visual control
✅ Complete flexibility
✅ Professional designs
✅ Accounting software parity
```

---

## Technical Details

### Browser Compatibility
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Requires HTML Canvas support
- JavaScript drag-and-drop API

### Performance
- Renders on-demand
- Smooth zooming up to 200%
- Grid background optional

### Data Storage
- Canvas design stored as JSONB in PostgreSQL
- Efficient querying by template type
- No external dependencies for design storage

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Element goes off-page | Use X/Y inputs to set exact position |
| Can't see element | Increase zoom level or scroll canvas |
| Field not showing data | Ensure field type matches available fields |
| Design looks different on print | Convert units if using different page sizes |
| Export not working | Clear browser cache, try again |

---

## Future Enhancements

- [ ] Image upload (logos, QR codes)
- [ ] Custom styling (shadows, rounded corners)
- [ ] Table elements (auto-generated item rows)
- [ ] Template categories/favorites
- [ ] Design presets per company
- [ ] Multi-language support
- [ ] Digital signature fields
- [ ] Batch copy generation

---

## File Location
- **Component**: `src/pages/BillDesignCanvasBuilder.tsx`
- **Database**: `bill_design_templates` table
- **Route**: `/bill-design-canvas`
- **Menu**: Admin Dashboard → Billing & Accounts → Invoice Designer (Canvas)

---

## Support

For questions about specific fields or design concepts, refer to:
- [Available Fields Reference](./INVOICE_DESIGNER_FIELDS.md) (to be created)
- Database schema: `SQL_COMMAND_CREATE_BILL_DESIGN_TEMPLATES.sql`
- Demo templates in app
