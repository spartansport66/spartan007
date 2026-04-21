# PDF Bill Analyzer - Feature Guide

## 🎯 Overview

**PDF Bill Analyzer** is an AI-powered feature that automatically extracts invoice data from PDF files and creates editable template designs with one click.

---

## 🚀 How It Works

### Step 1: Upload Your Bill PDF
1. Go to **Invoice Designer (Canvas)**
2. Look for **"Import from PDF"** card on the left sidebar
3. Click the upload area or drag-and-drop a PDF file

### Step 2: AI Analysis
The system analyzes the PDF and automatically detects:
- ✅ Company Name & GSTIN
- ✅ Bill/Invoice Number
- ✅ Invoice Date
- ✅ Bill To / Ship To addresses
- ✅ Item descriptions and quantities
- ✅ Pricing (Rate, GST, Discounts)
- ✅ Grand Total & Amount in Words
- ✅ Payment Terms & Bank Details
- ✅ Signature/Authorized fields

### Step 3: Auto-Generated Template
The system creates:
- **Field Elements**: Automatically positioned with detected data
- **Editable Layout**: Every element can be moved, resized, styled
- **Template Name**: Auto-named from the PDF file
- **Ready to Export**: Save or further customize

---

## 📋 Detected Invoice Fields

| Category | Fields Detected |
|----------|-----------------|
| **Header** | company_name, company_gstin, bill_title |
| **Bill Details** | bill_number, invoice_date, order_reference, financial_year |
| **Addresses** | bill_to, ship_to, dealer_gst |
| **Items** | item_description, item_quantity, item_rate, item_gst, item_amount |
| **Totals** | subtotal, total_gst, grand_total, amount_in_words |
| **Terms & Conditions** | payment_terms, bank_details, custom_text, note |
| **Signature** | authorized_by, company_seal, date_line |

---

## 🎨 Customization After Upload

Once PDF is analyzed and template created:

1. **Reposition Elements**
   - Drag any field on canvas to new location
   - Use +/- buttons to adjust zoom
   - Elements snap to 10mm grid

2. **Resize Elements**
   - Select element
   - Use W (width) and H (height) inputs in properties
   - Measured in millimeters

3. **Edit Styling**
   - Font size (6-48pt)
   - Color picker for text color
   - Font weight (normal/bold)
   - Text alignment (left/center/right)

4. **Add More Elements**
   - Add Text elements for labels
   - Add new Field elements
   - Add Lines for dividers
   - Add Boxes for containers

5. **Delete Unwanted Elements**
   - Click element to select
   - Click "Delete" button
   - Or press Delete key

6. **Arrange by Z-Index**
   - Boxes go behind (lower zIndex)
   - Text/Fields on top (higher zIndex)

---

## 📊 Use Cases

### Use Case 1: Match Your Current Bill Format
```
1. Print/scan your bill
2. Save as PDF
3. Upload to system
4. AI extracts the layout
5. Edit/customize as needed
6. Save as template
7. Use for all future bills
```

### Use Case 2: Create Multi-Copy Invoice
```
1. Upload single-copy bill PDF
2. System creates template for 1 copy
3. Duplicate all elements
4. Move duplicates down (Y: 135mm for 2nd, 260mm for 3rd)
5. Add copy labels (Original/Duplicate/Carbon)
6. Save template
```

### Use Case 3: Update Old Invoice Format
```
1. Have existing invoice PDF from Excel/old system
2. Upload to extract structure
3. Reposition elements to new layout
4. Add missing fields (GST, company seal, etc.)
5. Export as new template
6. Start using immediately
```

---

## 🔍 What Gets Detected

### Strong Detection (High Confidence)
- Company name (usually first large text)
- Invoice/Bill number (keyword matching)
- Invoice date (date pattern matching)
- Grand total (currency + number pattern)
- GSTIN (15-digit alphanumeric pattern)

### Good Detection (Medium Confidence)
- Bill To / Ship To sections
- Item descriptions and quantities
- Payment terms text
- Bank details
- Signature fields

### Requires Manual Verification
- Item HSN/SAC codes
- Discount percentages
- Tax rates
- Custom fields not matching patterns

---

## 📋 Example: Before & After

### Before (Original PDF)
```
┌─────────────────────────────────┐
│ ABC COMPANY PVT LTD             │
│ GSTIN: 12XXXXX0000Z1            │
│ Address: 123 Business St        │
│                                 │
│ TAX INVOICE                     │
│                                 │
│ Invoice #: INV-2024-001243      │
│ Date: 15-Apr-2024               │
│                                 │
│ Bill To: John Doe               │ Ship To: Warehouse
│ Address: Cust Addr              │ Address: WH Address
│                                 │
│ Item    | Qty | Rate  | Amount  │
│ Product A | 10 | 100  | 1000    │
│                                 │
│ Total: ₹ 1,180 (incl. 18% GST)  │
│ Auth: ___________  Date: ___    │
└─────────────────────────────────┘
```

### After (Auto-Generated Template)
```
Canvas Elements Created:
✓ company_name (18pt Bold, X:20, Y:10)
✓ company_gstin (11pt, X:20, Y:20)
✓ company_address (10pt, X:20, Y:27)
✓ bill_title (16pt Bold, X:50, Y:35)
✓ bill_number (12pt Bold, X:20, Y:50)
✓ invoice_date (11pt, X:20, Y:58)
✓ bill_to (11pt Bold, X:20, Y:70)
✓ ship_to (11pt Bold, X:120, Y:70)
✓ item_description (10pt, X:30, Y:90)
✓ item_quantity (10pt, X:90, Y:90)
✓ item_rate (10pt, X:110, Y:90)
✓ item_amount (10pt, X:140, Y:90)
✓ grand_total (13pt Bold Blue, X:130, Y:200)
✓ amount_in_words (10pt Italic, X:20, Y:210)
✓ payment_terms (9pt, X:20, Y:230)
✓ authorized_by (10pt, X:20, Y:270)
✓ date_line (10pt, X:150, Y:270)

Total: 17 elements created automatically!
```

---

## ⚙️ Advanced Features

### 1. Smart Positioning
- Elements auto-positioned top-to-bottom
- Maintains relative spacing
- Can be manually adjusted afterward

### 2. Field Confidence Scoring
- Each detected field has confidence level
- High confidence (80-100%): Accurate detection
- Medium confidence (60-80%): Review recommended
- Low confidence (<60%): Manual verification

### 3. Batch PDF Processing (Future)
- Upload multiple PDFs
- System finds commonality
- Creates master template
- Handles variations

### 4. Template Cloning
- Use extracted PDF as base
- Create variations (Original/Duplicate/Carbon)
- Set as default for company
- Apply to all future bills

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| "No invoice data detected" | Ensure PDF is clear and readable, high contrast |
| Missing fields | Manually add missing elements after import |
| Wrong field positions | Adjust X,Y coordinates in properties panel |
| Fields overlapping | Increase height/spacing or move elements |
| Text too small | Increase font size in properties |
| Layout looks different | Adjust page size (A4/Letter/A5) or orientation |

---

## 🎓 Best Practices

1. **Use Clear PDFs**
   - High resolution scans
   - Good lighting
   - Black text on white background
   - Avoid watermarks

2. **Sample Different Bills**
   - Use representative bill from your system
   - Ensure all sections are visible
   - Include multiple items if possible

3. **Review After Import**
   - Check all fields detected correctly
   - Verify positions and spacing
   - Test with sample data

4. **Customize Intelligently**
   - Keep standard elements
   - Add company-specific fields
   - Use consistent margins (20mm standard)
   - Maintain visual hierarchy

5. **Save Multiple Versions**
   - Original (full details)
   - Compact (key fields only)
   - Multi-copy (for multi-part forms)
   - Digital/Print versions

---

## 📚 Integration with Canvas Designer

### Full Workflow
```
1. Upload Bill PDF
   ↓
2. AI Analyzes & Extracts
   ↓
3. Canvas Elements Created
   ↓
4. Position & Customize on Canvas
   ↓
5. Export to JSON
   ↓
6. Save to Database (Next Phase)
   ↓
7. Use Template for All Bills
```

---

## 🚀 Features Coming Soon

- [ ] Multi-page PDF support
- [ ] Batch PDF processing
- [ ] OCR for handwritten fields
- [ ] Template marketplace (find & use community templates)
- [ ] AI field confidence badges
- [ ] Variation detection (handle different bill formats)
- [ ] Custom field learning

---

## 💡 Pro Tips

### Tip 1: Update Your Invoicing
1. Export your first PDF-generated template
2. Set as default for company
3. All future bills use this format
4. Consistency guaranteed

### Tip 2: Multi-Copy Forms
1. Upload your bill PDF
2. Duplicate all elements
3. Move bottom set down (Y += 135mm)
4. Add copy labels in red text: "DUPLICATE"
5. Perfect for multi-part printing

### Tip 3: Rebranding
1. Have old invoice format as PDF
2. Extract with AI
3. Reposition to match new branding
4. Add new company details
5. Export new template

### Tip 4: Migrate from Excel
1. Generate sample bill in Excel
2. Export as PDF
3. Upload to system
4. Let AI extract structure
5. Clean up and customize
6. Deploy new template

---

## 📊 Supported PDF Types

✅ **Works Well With:**
- Invoices from accounting software
- Tax invoices (GST compliant)
- Pro forma invoices
- Bills/Receipt formats
- Delivery challan
- Purchase order

⚠️ **May Require Manual Adjustment:**
- Hand-written bills (scan first)
- Complex multi-section bills
- Non-standard layouts
- Scanned documents (low quality)

❌ **Not Supported:**
- Image-only PDFs (use OCR first)
- Encrypted PDFs
- Corrupt files

---

## 🔐 Data & Privacy

- PDFs analyzed locally (no upload to servers)
- Text extraction happens in browser
- No data stored permanently
- Only template elements saved to database
- Original PDF not stored

---

## 📞 Support

For issues with PDF analysis:
1. **Check PDF Quality**: Clear, readable, standard layout
2. **Try Sample Invoice**: Use a well-formatted bill
3. **Manual Override**: Create from blank template if needed
4. **Report Issues**: Provide PDF sample for improvement

---

**Status**: ✅ PDF Analysis Ready  
**Version**: 1.0 AI-Powered Extraction  
**Created**: April 2026
