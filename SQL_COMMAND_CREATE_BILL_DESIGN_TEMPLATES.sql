-- Create bill_design_templates table for storing customizable bill formats
CREATE TABLE IF NOT EXISTS bill_design_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic Info
  name VARCHAR(255) NOT NULL,
  description TEXT,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category VARCHAR(50) DEFAULT 'custom', -- 'blank', 'professional', 'simple', 'custom'
  
  -- Page Settings
  page_size VARCHAR(50) DEFAULT 'A4', -- 'A4', 'Letter', 'A5', 'Legal'
  page_orientation VARCHAR(20) DEFAULT 'portrait', -- 'portrait', 'landscape'
  
  -- Copy Types (for multiple copies on single page)
  copy_types JSONB DEFAULT '["Original", "Duplicate", "Carbon"]',
  
  -- Canvas Design (Full drag-and-drop based with X,Y coordinates)
  -- Stores array of design elements: text, fields, lines, boxes, images
  canvas_design JSONB NOT NULL DEFAULT '{
    "elements": [],
    "page_width": 210,
    "page_height": 297,
    "unit": "mm"
  }',

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_template BOOLEAN NOT NULL DEFAULT false, -- Pre-built template
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  
  CONSTRAINT unique_default_per_company UNIQUE (company_id) WHERE is_default = true

-- Create unique index for one default template per company
CREATE UNIQUE INDEX idx_unique_default_per_company ON bill_design_templates(company_id) WHERE is_default = true;

-- Create index for faster queries
CREATE INDEX idx_bill_design_templates_company_id ON bill_design_templates(company_id);
CREATE INDEX idx_bill_design_templates_active ON bill_design_templates(company_id, is_active);
CREATE INDEX idx_bill_design_templates_default ON bill_design_templates(company_id, is_default);
CREATE INDEX idx_bill_design_templates_is_template ON bill_design_templates(is_template);

-- Create RLS policies for bill_design_templates
ALTER TABLE bill_design_templates ENABLE ROW LEVEL SECURITY;

-- Policy: Admins and billing users can view all templates
CREATE POLICY bill_design_templates_view ON bill_design_templates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (profiles.user_type = 'admin' OR profiles.user_type = 'billing')
    )
  );

-- Policy: Only admins can insert templates
CREATE POLICY bill_design_templates_insert ON bill_design_templates
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.user_type = 'admin'
    )
  );

-- Policy: Only admins can update templates
CREATE POLICY bill_design_templates_update ON bill_design_templates
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.user_type = 'admin'
    )
  );

-- Policy: Only admins can delete templates
CREATE POLICY bill_design_templates_delete ON bill_design_templates
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.user_type = 'admin'
    )
  );

-- Create bill_design_fields table for available dynamic fields reference
CREATE TABLE IF NOT EXISTS bill_design_available_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  field_type VARCHAR(100) NOT NULL UNIQUE, -- e.g., 'company_name', 'bill_number', 'invoice_date', etc.
  field_label VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL, -- 'header', 'bill_details', 'items_table', 'totals', 'terms', 'signature'
  description TEXT,
  
  -- Default styling
  default_style JSONB DEFAULT '{
    "fontSize": 12,
    "fontWeight": "normal",
    "color": "#000000",
    "alignment": "left"
  }',
  
  is_required BOOLEAN DEFAULT false,
  display_order INT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_field_type UNIQUE (field_type)
);

-- Insert available dynamic fields for Header
INSERT INTO bill_design_available_fields (field_type, field_label, category, description, default_style, is_required, display_order) VALUES
('company_name', 'Company Name', 'header', 'Company/Warehouse name', '{"fontSize": 18, "fontWeight": "bold", "color": "#000000"}', true, 1),
('company_gstin', 'Company GSTIN', 'header', 'Company GST Identification Number', '{"fontSize": 11, "color": "#666666"}', false, 2),
('company_address', 'Company Address', 'header', 'Full company address', '{"fontSize": 10, "color": "#666666"}', false, 3),
('company_phone', 'Company Phone', 'header', 'Company contact number', '{"fontSize": 10, "color": "#666666"}', false, 4),
('company_email', 'Company Email', 'header', 'Company email address', '{"fontSize": 10, "color": "#666666"}', false, 5),
('bill_title', 'Bill Title', 'header', '"TAX INVOICE" or similar', '{"fontSize": 16, "fontWeight": "bold", "alignment": "center"}', true, 6);

-- Insert available fields for Bill Details
INSERT INTO bill_design_available_fields (field_type, field_label, category, description, default_style, is_required, display_order) VALUES
('bill_number', 'Bill Number', 'bill_details', 'Unique bill/invoice number', '{"fontSize": 12, "fontWeight": "bold"}', true, 1),
('invoice_date', 'Invoice Date', 'bill_details', 'Date of invoice', '{"fontSize": 11}', true, 2),
('order_reference', 'Order Reference', 'bill_details', 'Reference to original order', '{"fontSize": 11}', false, 3),
('financial_year', 'Financial Year', 'bill_details', 'Billing financial year', '{"fontSize": 11}', false, 4),
('bill_to', 'BILL TO (Dealer)', 'bill_details', 'Dealer/customer details', '{"fontSize": 11, "fontWeight": "bold"}', true, 5),
('ship_to', 'SHIP TO', 'bill_details', 'Shipping address details', '{"fontSize": 11, "fontWeight": "bold"}', false, 6),
('dealer_gst', 'Dealer GST', 'bill_details', 'Dealer GST number', '{"fontSize": 10}', false, 7);

-- Insert available fields for Items Table
INSERT INTO bill_design_available_fields (field_type, field_label, category, description, default_style, is_required, display_order) VALUES
('item_sno', 'S.No', 'items_table', 'Serial number', '{"fontSize": 10, "alignment": "center"}', true, 1),
('item_description', 'Description', 'items_table', 'Product description', '{"fontSize": 10}', true, 2),
('item_hsn_sac', 'HSN/SAC', 'items_table', 'HSN or SAC code', '{"fontSize": 10, "alignment": "center"}', false, 3),
('item_quantity', 'Quantity', 'items_table', 'Item quantity', '{"fontSize": 10, "alignment": "center"}', true, 4),
('item_unit', 'Unit', 'items_table', 'Unit of measurement', '{"fontSize": 10, "alignment": "center"}', false, 5),
('item_rate', 'Rate', 'items_table', 'Unit rate/price', '{"fontSize": 10, "alignment": "right"}', true, 6),
('item_discount', 'Discount %', 'items_table', 'Discount percentage', '{"fontSize": 10, "alignment": "right"}', false, 7),
('item_gst', 'GST %', 'items_table', 'GST percentage', '{"fontSize": 10, "alignment": "right"}', true, 8),
('item_amount', 'Amount', 'items_table', 'Total amount (after discount & tax)', '{"fontSize": 10, "alignment": "right"}', true, 9);

-- Insert available fields for Totals
INSERT INTO bill_design_available_fields (field_type, field_label, category, description, default_style, is_required, display_order) VALUES
('subtotal', 'Subtotal', 'totals', 'Sum of all items before tax', '{"fontSize": 11}', true, 1),
('total_discount', 'Total Discount', 'totals', 'Sum of all discounts', '{"fontSize": 11}', false, 2),
('taxable_value', 'Taxable Value', 'totals', 'Value subject to tax', '{"fontSize": 11}', true, 3),
('total_gst', 'Total GST', 'totals', 'Total GST amount', '{"fontSize": 11}', true, 4),
('freight_charges', 'Freight Charges', 'totals', 'Shipping/freight charges', '{"fontSize": 11}', false, 5),
('round_off', 'Round Off', 'totals', 'Round off adjustment', '{"fontSize": 11}', false, 6),
('grand_total', 'Grand Total', 'totals', 'Final invoice total', '{"fontSize": 13, "fontWeight": "bold", "color": "#0066cc"}', true, 7),
('amount_in_words', 'Amount in Words', 'totals', 'Invoice total amount written in words', '{"fontSize": 10, "fontStyle": "italic"}', false, 8);

-- Insert available fields for Terms
INSERT INTO bill_design_available_fields (field_type, field_label, category, description, default_style, is_required, display_order) VALUES
('custom_text', 'Custom Text', 'terms', 'Custom terms and conditions text', '{"fontSize": 9}', false, 1),
('payment_terms', 'Payment Terms', 'terms', 'Payment terms and conditions', '{"fontSize": 9}', false, 2),
('bank_details', 'Bank Details', 'terms', 'Bank account information', '{"fontSize": 9}', false, 3),
('note', 'Note', 'terms', 'Additional notes or remarks', '{"fontSize": 9}', false, 4);

-- Insert available fields for Signature
INSERT INTO bill_design_available_fields (field_type, field_label, category, description, default_style, is_required, display_order) VALUES
('terms_heading', 'Terms Label', 'signature', 'Label for terms and conditions', '{"fontSize": 10, "fontWeight": "bold"}', false, 1),
('authorized_by', 'Authorized By', 'signature', 'Authorized person signature line', '{"fontSize": 10}', false, 2),
('company_seal', 'Company Seal', 'signature', 'Company seal/stamp line', '{"fontSize": 10}', false, 3),
('date_line', 'Date Line', 'signature', 'Date signature line', '{"fontSize": 10}', false, 4);

-- Create index on available fields
CREATE INDEX idx_available_fields_category ON bill_design_available_fields(category);

-- Grant permissions
GRANT ALL ON bill_design_templates TO authenticated;
GRANT SELECT ON bill_design_available_fields TO authenticated;

-- Add comments
COMMENT ON TABLE bill_design_templates IS 
  'Stores customizable bill/invoice design templates with canvas-based layout (full drag-and-drop positioning)';
COMMENT ON TABLE bill_design_available_fields IS 
  'Reference table for all available dynamic fields that can be added to bill designs';
COMMENT ON COLUMN bill_design_templates.canvas_design IS 
  'Canvas design with elements array containing: text, fields, lines, boxes, images with X,Y positioning and styling';
COMMENT ON COLUMN bill_design_templates.copy_types IS 
  'Invoice copy types: Original, Duplicate, Carbon Copy, etc. for multi-part printing';
