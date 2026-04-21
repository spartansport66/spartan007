# Company Logo Upload & Display Integration

## Overview
Successfully integrated company logo upload functionality in Admin Dashboard's Company Information section and integrated logo display in bill print dialogs.

## Changes Made

### 1. Database Migration
**File:** `supabase/migrations/20260416_add_logo_url_to_company_info.sql`

Added new column to `company_info` table:
- `logo_url` (TEXT, nullable) - Stores the URL to the company logo image in Supabase storage

### 2. CompanyInfoDialog.tsx Updates

#### New Imports
Added icons for logo management:
- `Upload` - For upload button
- `X` - For remove button

#### Enhanced Interface
- Added `logo_url: string | null` to CompanyInfo interface
- Added `logoUrl` optional field to form schema

#### New State Variables
- `uploading` - Tracks logo upload status
- `logoPreview` - Displays uploaded logo preview

#### New Functions

**`handleLogoUpload(event)`**
- Accepts image files (PNG, JPG, WebP)
- Validates file type and size (max 2MB)
- Uploads to Supabase `documents` bucket under `company_logos/` folder
- Generates public URL and updates form state
- Shows success/error messages

**`handleRemoveLogo()`**
- Removes logo preview and clears logoUrl field
- Provides feedback to user

#### UI Components
Added new logo upload section with:
- Logo preview display with remove button (X icon)
- Drag-and-drop enabled file input
- File type and size requirements display
- Upload progress indicator with spinner
- Visual feedback on upload status

#### Data Persistence
- Logo URL fetched on component load
- Logo URL saved to database with company info
- Preview displays previously uploaded logo

### 3. PrintBillDialog.tsx Updates

#### New Interface
Added `CompanyInfo` interface:
```typescript
interface CompanyInfo {
  logo_url: string | null;
}
```

#### Enhanced Data Fetching
- Now fetches both order details and company info in parallel
- Uses `Promise.all()` for efficient concurrent requests
- Handles both requests independently

#### Logo Display in Print Template
HTML header section now displays:
- Company logo image if URL is available
- Falls back to "QR Code" placeholder if no logo
- Logo is centered and responsive with `object-fit: contain`

#### Logo Display in React Preview
- Logo displayed in top-right of bill header
- 80x80px size with proper aspect ratio maintenance
- Only shows if logo URL exists
- Maintains header layout alignment

### 4. Supabase Storage Configuration

**Required Setup:**
```
Bucket: documents
Folder: company_logos/
Access: Public (for displaying logos in bills)
```

## File Structure

```
company_info
├── company_name (TEXT)
├── address (TEXT)
├── city (TEXT)
├── state (TEXT)
├── country (TEXT)
├── email (TEXT)
├── phone (TEXT)
└── logo_url (TEXT) ← NEW
```

## User Workflow

### Admin: Upload Logo
1. Navigate to Admin Dashboard → Company Information
2. Click "Click to upload logo" area or drag-drop image
3. System validates file type (PNG/JPG/WebP) and size (≤2MB)
4. Logo uploads to Supabase storage
5. Public URL stored in database
6. Preview displays immediately
7. Click X to remove logo if needed
8. Save Company Information

### Billing: View Logo in Print
1. Open an order's print bill dialog
2. Logo appears in top-right of bill header
3. Logo displays in both:
   - Print HTML (when printed to PDF)
   - React preview (in browser)
4. Falls back gracefully if no logo is set

## Technical Details

### Upload Storage Path
```
documents/company_logos/{timestamp}_{original_filename}
```

Example: `documents/company_logos/1713350400000_spartan_logo.png`

### Logo Display Sizes
- **Print Template:** Dynamic, fitted to 80x80px container with `object-fit: contain`
- **Preview:** 80x80 with Tailwind classes
- **Responsive:** Maintains aspect ratio on all screen sizes

### Data Validation

**File Type:** 
- Accepted: image/png, image/jpeg, image/webp, etc.
- Rejected: Non-image files

**File Size:**
- Maximum: 2MB (2097152 bytes)
- Error: User-friendly message if exceeded

### RLS Permissions

Created migration adds:
- `UPDATE` permission on `company_info` for authenticated users
- Allows billing users, admins to update logo_url field

## Error Handling

- Invalid file type: "Please upload a valid image file."
- File too large: "Logo file size must be less than 2MB."
- Upload failure: Specific error message from Supabase
- No logo: Gracefully falls back to text/placeholder

## Benefits

✅ **Professional Appearance** - Company branding on all bills
✅ **Easy Management** - Admin can change logo anytime
✅ **Flexible Format** - Supports common image formats
✅ **Secure** - Uses Supabase storage with access control
✅ **Responsive** - Works on all screen sizes and devices
✅ **Print-Ready** - Logo appears in both preview and PDF

## Database Migration Command

```bash
# Apply the migration to add logo_url column
supabase migration up 20260416_add_logo_url_to_company_info
```

## Component Dependencies

- `CompanyInfoDialog.tsx` - Handles logo upload in admin panel
- `PrintBillDialog.tsx` - Displays logo in bills
- Supabase Storage - Stores logo images
- Supabase PostgreSQL - Stores logo URL

## Testing Checklist

- [ ] Upload PNG logo (should succeed)
- [ ] Upload JPG logo (should succeed)
- [ ] Upload WebP logo (should succeed)
- [ ] Try uploading >2MB file (should fail)
- [ ] Try uploading non-image file (should fail)
- [ ] Verify logo displays in print preview
- [ ] Verify logo displays in printed PDF
- [ ] Remove logo and verify fallback displays
- [ ] Update logo and verify new logo displays
