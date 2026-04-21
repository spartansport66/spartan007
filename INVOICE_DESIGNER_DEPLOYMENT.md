# Invoice Designer - Deployment Checklist

## ✅ Pre-Deployment Tasks

### Database Setup
- [ ] Run SQL migration: `SQL_COMMAND_CREATE_BILL_DESIGN_TEMPLATES.sql`
  ```sql
  -- Execute in Supabase Dashboard → SQL Editor
  ```
- [ ] Verify tables created:
  - [ ] `bill_design_templates` table exists
  - [ ] `bill_design_available_fields` table exists
  - [ ] 37 fields inserted successfully
- [ ] Check RLS policies:
  - [ ] SELECT policy for admins/billing users ✅
  - [ ] INSERT policy for admins only ✅
  - [ ] UPDATE policy for admins only ✅
  - [ ] DELETE policy for admins only ✅
- [ ] Verify indexes:
  - [ ] `idx_unique_default_per_company` ✅
  - [ ] `idx_bill_design_templates_*` indexes ✅
  - [ ] `idx_available_fields_category` ✅

### Code Changes
- [ ] Component created: `src/pages/BillDesignCanvasBuilder.tsx`
- [ ] Route added: `/bill-design-canvas` in App.tsx
- [ ] Menu item added: AdminSidebar.tsx → "Invoice Designer (Canvas)"
- [ ] Import added: BillDesignCanvasBuilder in App.tsx
- [ ] No TypeScript errors in components
  ```bash
  npm run type-check
  ```

### File Structure
- [ ] `SQL_COMMAND_CREATE_BILL_DESIGN_TEMPLATES.sql` updated ✅
- [ ] `INVOICE_DESIGNER_GUIDE.md` created ✅
- [ ] `INVOICE_DESIGNER_FEATURES.md` created ✅
- [ ] `INVOICE_DESIGNER_QUICK_REFERENCE.md` created ✅
- [ ] `INVOICE_DESIGNER_DEPLOYMENT.md` (this file) ✅

---

## 🧪 Testing Checklist

### Feature Testing
- [ ] Navigate to `/bill-design-canvas` loads correctly
- [ ] "Open Designer" button toggles visibility
- [ ] Select blank template loads without errors try all 4:
  - [ ] Simple A4
  - [ ] Professional GST
  - [ ] Multi-Copy
  - [ ] Landscape A4
- [ ] Page size dropdown works (A4, Letter, A5, Legal)
- [ ] Orientation dropdown works (Portrait, Landscape)

### Canvas Testing
- [ ] Canvas renders with grid background
- [ ] Zoom in/out buttons work (50% to 200%)
- [ ] Zoom percentage displays correctly
- [ ] Add Text button creates element
- [ ] Add Field button creates element
- [ ] Add Line button creates element
- [ ] Add Box button creates element
- [ ] Click element on canvas selects it (blue ring)
- [ ] Drag element moves it on canvas
- [ ] Element stays within page bounds

### Properties Panel Testing
- [ ] Select element shows properties
- [ ] Label input editable
- [ ] X, Y position inputs work (numeric)
- [ ] Width, Height inputs work (numeric)
- [ ] Font size input works (numeric)
- [ ] Color picker opens and selects colors
- [ ] Duplicate button creates copy
- [ ] Delete button removes element
- [ ] Elements list shows all elements

### Element Types Testing
#### Text Element
- [ ] Create text element
- [ ] Edit content in properties
- [ ] Change font size
- [ ] Change color
- [ ] Preview updates

#### Field Element
- [ ] Create field element
- [ ] Shows `[field_name]` on canvas
- [ ] Has blue background indicator
- [ ] Can be positioned

#### Line Element
- [ ] Create line
- [ ] Adjust width (length)
- [ ] Change border color
- [ ] Preview updates

#### Box Element
- [ ] Create box
- [ ] Adjust size
- [ ] Change border color
- [ ] Visible border

### Export Testing
- [ ] "Export Design" button works
- [ ] Downloads JSON file
- [ ] File has correct name format
- [ ] JSON contains all elements
- [ ] JSON valid structure:
  ```json
  {
    "name": "...",
    "canvas_design": {
      "elements": [...],
      "page_width": 210,
      "page_height": 297,
      "unit": "mm"
    }
  }
  ```

### UI/UX Testing
- [ ] Layout responsive on large screens
- [ ] All buttons clickable
- [ ] Hover effects work
- [ ] Sidebar scrolls on small height
- [ ] Canvas scrollable
- [ ] No layout shifts
- [ ] Icons display correctly

---

## 🔐 Security Testing

### Authentication
- [ ] Non-admin users cannot access `/bill-design-canvas`
- [ ] Non-admin users cannot see "Invoice Designer" menu item
- [ ] Only authenticated users can access route

### Authorization
- [ ] Admin users can access and design
- [ ] Billing users can view (read-only in future)
- [ ] Regular users get 403 error if trying direct URL

### Data Entry
- [ ] XSS prevention: Special characters in text don't break
- [ ] Large numbers handled in X,Y positions
- [ ] Negative coordinates clamped to 0
- [ ] Coordinates limited to page bounds

---

## 📱 Browser Compatibility

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

Test:
```
- [ ] Canvas renders
- [ ] Drag works
- [ ] Zoom works
- [ ] Export works
- [ ] No console errors
```

---

## 🚀 Deployment Steps

### Step 1: Database
```bash
# 1. Open Supabase Dashboard
# 2. Go to SQL Editor
# 3. Paste SQL_COMMAND_CREATE_BILL_DESIGN_TEMPLATES.sql
# 4. Run (Ctrl+Enter)
# 5. Check Success message
```

### Step 2: Code Deployment
```bash
# 1. Commit changes
git add .
git commit -m "feat: Add canvas-based invoice designer"

# 2. Push to repository
git push origin main

# 3. Deploy (your deployment platform)
# Example for Vercel:
# - Automatic deployment on push
# - Wait for build to complete
```

### Step 3: Testing After Deployment
```bash
# 1. Clear browser cache (Ctrl+Shift+Delete)
# 2. Go to https://yourapp.com/bill-design-canvas
# 3. Run through testing checklist
# 4. Check browser console for errors (F12)
```

---

## 📊 Rollback Plan

### If Issues Occur

#### Minor Issues (UI/UX)
- Revert only the component file
- Database unaffected

#### Major Issues (Crashes)
- Revert commits
- Database stays intact

#### Database Issues
- Check RLS policies enabled
- Verify constraints
- Restore from backup if needed

---

## 🎯 Success Criteria

✅ All the following must be true before going live:

- [ ] No TypeScript compilation errors
- [ ] All database tables created successfully
- [ ] All database indexes present
- [ ] All RLS policies active
- [ ] Component loads without errors
- [ ] Canvas renders correctly
- [ ] All element types work
- [ ] Drag-and-drop functional
- [ ] Export generates valid JSON
- [ ] Menu item visible to admins
- [ ] Route accessible to admins
- [ ] No console errors (F12)
- [ ] All tests from checklist pass
- [ ] Users can complete basic workflow:
  1. Open designer
  2. Load template
  3. Add element
  4. Position element
  5. Export design

---

## 📈 Post-Launch Monitoring

### Week 1
- [ ] Monitor error logs for crashes
- [ ] Check database for lock issues
- [ ] Confirm users can access feature
- [ ] Gather user feedback

### Ongoing
- [ ] Track feature usage
- [ ] Monitor performance metrics
- [ ] Response time < 1 second for interactions
- [ ] No dropped connections

---

## 🔄 Next Phase Implementation

After Canvas Designer is stable, implement:

1. **Save to Database** (Phase 2)
   - Save exported JSON to bill_design_templates
   - Form: Template name + Description
   - Button: "Save as New Template"

2. **Template Management** (Phase 2)
   - List saved templates
   - Edit existing template
   - Delete templates
   - Set default template

3. **Bill Generation Integration** (Phase 3)
   - Select template when creating bill
   - Dynamically populate fields
   - Render HTML with real data
   - Print/PDF generation

4. **Multi-Copy Handling** (Phase 3)
   - Generate 3 copies on single page
   - Separate by copy_types from template
   - Watermark each copy (Original/Duplicate/Carbon)

5. **Template Library** (Phase 4)
   - Public templates
   - Industry templates
   - Template sharing
   - Template categories

---

## 📞 Support & Documentation

### For Admins
- Direct them to [INVOICE_DESIGNER_QUICK_REFERENCE.md](./INVOICE_DESIGNER_QUICK_REFERENCE.md)
- Key sections: Quick Start, Common Dimensions, Multi-Copy Layout

### For Developers
- Full API in [INVOICE_DESIGNER_GUIDE.md](./INVOICE_DESIGNER_GUIDE.md)
- Database schema in SQL file
- Component code: `src/pages/BillDesignCanvasBuilder.tsx`

### Documentation Files
| File | Purpose | Audience |
|------|---------|----------|
| INVOICE_DESIGNER_GUIDE.md | Complete manual | Developers, Power Users |
| INVOICE_DESIGNER_FEATURES.md | What's new | Product Team |
| INVOICE_DESIGNER_QUICK_REFERENCE.md | Quick tips | End Users |
| SQL_COMMAND_CREATE_BILL_DESIGN_TEMPLATES.sql | DB Schema | DBAs |

---

## ✉️ Communication Template

### For Users
```
Subject: New Invoice Designer is Now Available!

Hi Team,

We're excited to announce the new Canvas-Based Invoice Designer! 🎨

What's New:
✓ Drag-and-drop element positioning (like Adobe/Figma)
✓ 4 pre-built blank templates
✓ Support for multi-copy invoices (Original, Duplicate, Carbon)
✓ 4 page sizes (A4, Letter, A5, Legal)
✓ Free-form design with full customization

How to Access:
1. Go to Admin Dashboard
2. Click: Billing & Accounts → Invoice Designer (Canvas)
3. Choose a template and start designing

Quick Start:
- Load "Professional GST" template (recommended)
- Drag elements to position
- Edit font/color/size in properties panel
- Export design when done

Questions? See: INVOICE_DESIGNER_QUICK_REFERENCE.md

Next Steps:
- Test it out
- Send feedback
- We'll add template saving in next phase

Happy Designing!
```

---

## 📋 Final Checklist Before Go-Live

### Technical
- [ ] All files committed to repository
- [ ] CI/CD pipeline passes
- [ ] No blocking bugs
- [ ] Performance acceptable (< 1s load)
- [ ] Database backups taken

### Documentation
- [ ] User guide published
- [ ] Admin guide available
- [ ] Quick reference distributed
- [ ] FAQ updated

### Team
- [ ] Product owner approved
- [ ] QA sign-off
- [ ] Support team briefed
- [ ] Users notified

### Date: ________________
### Deployed By: _______________
### Sign-off: ____________________

---

**Status**: Ready for Deployment ✅  
**Version**: 1.0 Canvas Designer  
**Created**: April 2026  
**Last Updated**: April 2026
