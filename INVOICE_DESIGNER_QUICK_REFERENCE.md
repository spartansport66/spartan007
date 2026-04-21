# Invoice Designer - Quick Reference Card

## 🚀 Quick Start (2 Minutes)

```
1. Go to: Admin Dashboard → Billing & Accounts → Invoice Designer (Canvas)
2. Click: "Open Designer" button
3. Select: "Professional GST" template from left sidebar
4. Set: Page Size = "A4", Orientation = "Portrait"
5. Add: Text element with "TAX INVOICE"
6. Add: Field element with "company_name"
7. Drag: Position elements on canvas
8. Click: "Export Design" to save
```

---

## 🎨 Element Types Quick Reference

| Element | Use Case | Default Size | Best For |
|---------|----------|--------------|----------|
| **Text** | Static labels, titles, copy names | 80×20mm | Headers, "Original", "TAX INVOICE" |
| **Field** | Dynamic data from database | 80×20mm | Company name, Bill #, Amount |
| **Line** | Dividers between sections | 170×0mm | Visual separation |
| **Box** | Container with border | 100×50mm | Invoice sections, highlights |
| **Image** | Logos, QR codes | 50×50mm | Company seal, branding |

---

## 📐 Common Dimensions (You Can Copy)

### Header Section (A4 Portrait)
```
Company Name:
  X: 20mm, Y: 10mm, W: 100mm, H: 8mm, F: 16pt Bold

Company GSTIN:
  X: 20mm, Y: 19mm, W: 100mm, H: 5mm, F: 10pt

Divider Line:
  X: 20mm, Y: 26mm, W: 170mm, H: 0mm (border 1mm)

"TAX INVOICE" Title:
  X: 50mm, Y: 30mm, W: 110mm, H: 12mm, F: 20pt Bold, Center
```

### Bill Details (Two Column)
```
LEFT COLUMN:
  Bill Number:
    X: 20mm, Y: 50mm, W: 50mm, H: 6mm, F: 11pt
  Invoice Date:
    X: 20mm, Y: 57mm, W: 50mm, H: 6mm, F: 11pt
  
RIGHT COLUMN:
  Bill To:
    X: 120mm, Y: 50mm, W: 50mm, H: 6mm, F: 11pt
  Ship To:
    X: 120mm, Y: 57mm, W: 50mm, H: 6mm, F: 11pt
```

### Items Table Header
```
S.No:        X: 20mm,  W: 10mm
Description: X: 31mm,  W: 55mm
HSN/SAC:     X: 87mm,  W: 20mm
Qty:         X: 108mm, W: 15mm
Unit:        X: 124mm, W: 15mm
Rate:        X: 140mm, W: 20mm
GST%:        X: 161mm, W: 12mm
Amount:      X: 174mm, W: 16mm

Row Height: 6-8mm each
```

### Totals Section
```
Subtotal:      X: 130mm, Y: 220mm, W: 30mm
Grand Total:   X: 130mm, Y: 235mm, W: 30mm, F: 13pt Bold, Color: #0066cc
```

### Footer (Signature)
```
Authorized By: X: 20mm, Y: 280mm, W: 40mm, H: 15mm (with border box)
Company Seal:  X: 75mm, Y: 280mm, W: 30mm, H: 15mm (centered)
Date:          X: 150mm, Y: 285mm, W: 40mm, H: 5mm
```

---

## ⌨️ Keyboard Shortcuts (Coming Soon)

```
Ctrl+Z       Undo
Ctrl+Y       Redo
Ctrl+A       Select All
Ctrl+D       Duplicate
Delete       Delete Element
Arrow Keys   Move Selected (1mm steps)
+ or -       Zoom In/Out
```

---

## 🎯 Multi-Copy Invoice Layout (A4)

```
┌─────────────────────────────────────────────────────────┐
│ "ORIGINAL" (RED)                                    20×5 │
│ Company Name                                            │
│ GSTIN: 12XXXXX0000Z1                                    │
│ Address                                                 │
├─────────────────────────────────────────────────────────┤
│ TAX INVOICE          Invoice#: ___  Date: ___           │
│                                                         │
│ Bill To:             Ship To:        Dealer GSTIN:      │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ S.No │ Description    │ Qty │ Rate    │ GST% │ Amount  │
│  1   │ Item A         │  10 │ 1000.00 │ 18%  │ 11800.00│
│  2   │ Item B         │   5 │ 500.00  │ 18%  │  2950.00│
├─────────────────────────────────────────────────────────┤
│                  Subtotal:        ₹ 14,750.00          │
│                  Discount:        ₹     0.00           │
│                  Taxable Value:   ₹ 14,750.00          │
│                  Total GST (18%): ₹  2,655.00          │
│                  GRAND TOTAL:     ₹ 17,405.00          │
├─────────────────────────────────────────────────────────┤
│ Payment Terms: Net 30 Days                              │
│ Bank: ABC Bank, Account: 1234567890, IFSC: ABC0001234  │
├─────────────────────────────────────────────────────────┤
│ Authorized By: ___________  Seal: ___________           │
│ Date: ______________                                    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ "DUPLICATE" (BLUE)           [135mm Y position]         │
│ [Same layout repeats]                                   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ "CARBON" (GREEN)            [260mm Y position]          │
│ [Same layout repeats]                                   │
└─────────────────────────────────────────────────────────┘
```

---

## 🎨 Color Specifications

### Standard Colors
```
Black Header:    #000000
Gray Text:       #666666
Light Gray Line: #cccccc
Blue Highlight:  #0066cc
Gold Grand Total: #FF9900
Red Error:       #FF0000
Green Success:   #00AA00
```

### Invoice Copy Labels
- **Original**: #FF0000 (Red) - Top right
- **Duplicate**: #0066CC (Blue) - Top right
- **Carbon**: #00AA00 (Green) - Top right

---

## 📏 Measurement Converter

| Unit | mm | pts | px @72dpi |
|------|----|----|-----------|
| A4 Width | 210 | 595 | 794 |
| A4 Height | 297 | 842 | 1123 |
| Standard Margin | 20 | 57 | 76 |
| Header Font | - | 16 | 21 |
| Body Font | - | 11 | 15 |
| Small Text | - | 9 | 12 |

---

## ✅ Pre-Flight Checklist Before Export

- [ ] All elements positioned correctly
- [ ] Page margins are consistent (20mm standard)
- [ ] Company name and invoice title at top
- [ ] Bill details section properly laid out
- [ ] Item table columns aligned
- [ ] Totals section highlighted
- [ ] Signature section at bottom
- [ ] No elements overlapping unexpectedly
- [ ] Font sizes readable (min 9pt for body text)
- [ ] All field types are valid
- [ ] Page orientation matches content
- [ ] Copy types configured (if multi-copy)

---

## 🔄 Duplication Strategy for Multi-Copy

### Method 1: Template Duplication
1. Design once for Original (Y: 0-132mm)
2. Select all elements from original
3. Duplicate selection (Ctrl+D)
4. Move duplicate down to Y: 133mm for Duplicate copy
5. Repeat for Carbon copy at Y: 266mm

### Method 2: Copy Type Labels
1. Create main design once
2. Add text elements only for copy labels:
   - "ORIGINAL" at Y: 15mm, X: 180mm, Color: #FF0000
   - "DUPLICATE" at Y: 148mm, X: 180mm, Color: #0066CC
   - "CARBON" at Y: 281mm, X: 180mm, Color: #00AA00
3. System handles physical separation during printing

---

## 🖨️ Print Settings

### For Single-Copy Invoice
```
Printer Settings:
- Paper Size: A4
- Orientation: Portrait
- Margins: 0mm (borderless)
- Scaling: 100%
- Color: Full Color (or B&W)
```

### For Multi-Copy Invoice
```
Printer Settings:
- Paper Size: A4 (3-part form)
- Orientation: Portrait
- Margins: 0mm (borderless)
- Scaling: 100%
- Copies: 1 (3 copies on one page)
- Color: As designed
```

---

## 🐛 Common Issues & Fixes

| Problem | Cause | Fix |
|---------|-------|-----|
| Element hidden | High Y value | Reduce Y or increase zoom out |
| Text looks small | Low font size | Increase fontSize in properties |
| Line not visible | 0 border width | Set borderWidth to 1-2mm |
| Field not loading | Wrong field name | Check available fields list |
| Export file too large | Many elements | Simplify design, remove duplicates |
| Positioning off | Unit confusion | Remember: X,Y in millimeters |

---

## 📊 Size Comparison

```
┌──────────────┬─────────────┬──────────────┐
│ Page Size    │ Dimensions  │ Best For     │
├──────────────┼─────────────┼──────────────┤
│ A4 (Default) │ 210×297mm   │ Standard     │
│ Letter       │ 216×279mm   │ US Invoices  │
│ A5           │ 148×210mm   │ Receipts     │
│ Legal        │ 216×356mm   │ Extended     │
└──────────────┴─────────────┴──────────────┘
```

---

## 🎓 Best Practices

1. **Start with Template**: Use "Professional GST" as foundation
2. **Consistent Margins**: Keep 20mm on left/right
3. **Hierarchy**: Large fonts for important (company name, total)
4. **Spacing**: 10-15mm between sections
5. **Lines**: Use to separate major sections
6. **Color**: Minimal (mostly black, accent in one color)
7. **Testing**: Preview with sample data first
8. **Backup**: Export JSON after each major change

---

## 📚 Resources

| Resource | Location |
|----------|----------|
| Full Guide | `INVOICE_DESIGNER_GUIDE.md` |
| Features | `INVOICE_DESIGNER_FEATURES.md` |
| Database Schema | `SQL_COMMAND_CREATE_BILL_DESIGN_TEMPLATES.sql` |
| Component Code | `src/pages/BillDesignCanvasBuilder.tsx` |

---

## 🚀 Pro Tips

### Tip 1: Use Grid
Keep grid visible at 100% zoom to align elements to 10mm increments.

### Tip 2: Start Large
Design at 80-90% zoom for full page view, zoom to 100% for detail work.

### Tip 3: Export Often
Save JSON after each major section (header, details, items, totals).

### Tip 4: Layer Elements
Put background boxes first (lower zIndex), text on top (higher zIndex).

### Tip 5: Field Names
Refer to Available Fields list - exact names must match database fields.

---

**Last Updated**: April 2026  
**Quick Version**: Compressed reference  
**For full details**: See INVOICE_DESIGNER_GUIDE.md
