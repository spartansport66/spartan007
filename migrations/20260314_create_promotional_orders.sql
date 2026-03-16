-- Create promotional_orders table
CREATE TABLE IF NOT EXISTS public.promotional_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Order identification
  order_number INTEGER NOT NULL,
  order_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Material out type: returnable or non-returnable
  material_out_type VARCHAR(50) NOT NULL CHECK (material_out_type IN ('returnable', 'non_returnable')),
  
  -- Promotion type
  promotion_type VARCHAR(100) NOT NULL,
  
  -- Party and Sales Person
  dealer_id UUID REFERENCES public.dealers(id) ON DELETE SET NULL,
  sales_person_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- User who created the order (HOD)
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Order details
  total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  
  -- Authorization details (for non-returnable)
  auth_string VARCHAR(255) UNIQUE,
  auth_token VARCHAR(255) UNIQUE,
  authorization_status VARCHAR(50) CHECK (authorization_status IN ('pending', 'authorized', 'rejected', NULL)),
  authorization_date TIMESTAMP WITH TIME ZONE,
  authorized_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  authorization_remarks TEXT,
  
  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'dispatched', 'returned')),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create promotional_order_items table
CREATE TABLE IF NOT EXISTS public.promotional_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  promotional_order_id UUID NOT NULL REFERENCES public.promotional_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  
  -- Item details
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(15, 2) NOT NULL,
  discount_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0,
  total_price DECIMAL(15, 2) NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create promotional_authorization_log table for audit trail
CREATE TABLE IF NOT EXISTS public.promotional_authorization_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  promotional_order_id UUID NOT NULL REFERENCES public.promotional_orders(id) ON DELETE CASCADE,
  authorization_person_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  action VARCHAR(50) NOT NULL CHECK (action IN ('authorized', 'rejected')),
  remarks TEXT,
  ip_address VARCHAR(45),
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_promotional_orders_dealer_id ON public.promotional_orders(dealer_id);
CREATE INDEX idx_promotional_orders_sales_person_id ON public.promotional_orders(sales_person_id);
CREATE INDEX idx_promotional_orders_created_by ON public.promotional_orders(created_by);
CREATE INDEX idx_promotional_orders_status ON public.promotional_orders(status);
CREATE INDEX idx_promotional_orders_material_out_type ON public.promotional_orders(material_out_type);
CREATE INDEX idx_promotional_orders_auth_token ON public.promotional_orders(auth_token);
CREATE INDEX idx_promotional_order_items_order_id ON public.promotional_order_items(promotional_order_id);
CREATE INDEX idx_promotional_authorization_log_order_id ON public.promotional_authorization_log(promotional_order_id);

-- Enable RLS
ALTER TABLE public.promotional_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotional_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotional_authorization_log ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies for promotional_orders
-- Allow authenticated users to create their own orders
CREATE POLICY "Users can create promotional orders"
  ON public.promotional_orders
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Allow users to view orders they created or were assigned to
CREATE POLICY "Users can view promotional orders"
  ON public.promotional_orders
  FOR SELECT
  USING (
    auth.uid() = created_by 
    OR auth.uid() = sales_person_id
    OR (SELECT user_type FROM public.profiles WHERE id = auth.uid()) IN ('manager', 'super_admin', 'hod', 'sales_hod', 'warehouse_keeper')
  );

-- Allow users to update their own orders
CREATE POLICY "Users can update promotional orders"
  ON public.promotional_orders
  FOR UPDATE
  USING (auth.uid() = created_by OR (SELECT user_type FROM public.profiles WHERE id = auth.uid()) IN ('manager', 'super_admin', 'hod', 'sales_hod'));

-- Create RLS Policies for promotional_order_items
CREATE POLICY "Users can view order items"
  ON public.promotional_order_items
  FOR SELECT
  USING (
    promotional_order_id IN (
      SELECT id FROM public.promotional_orders 
      WHERE auth.uid() = created_by 
        OR auth.uid() = sales_person_id
        OR (SELECT user_type FROM public.profiles WHERE id = auth.uid()) IN ('manager', 'super_admin', 'hod', 'sales_hod', 'warehouse_keeper')
    )
  );

CREATE POLICY "Users can create order items"
  ON public.promotional_order_items
  FOR INSERT
  WITH CHECK (
    promotional_order_id IN (
      SELECT id FROM public.promotional_orders WHERE auth.uid() = created_by
    )
  );

-- Create RLS Policies for promotional_authorization_log
CREATE POLICY "Users can view authorization logs"
  ON public.promotional_authorization_log
  FOR SELECT
  USING (
    promotional_order_id IN (
      SELECT id FROM public.promotional_orders 
      WHERE auth.uid() = created_by 
        OR auth.uid() = sales_person_id
        OR (SELECT user_type FROM public.profiles WHERE id = auth.uid()) IN ('manager', 'super_admin', 'hod', 'sales_hod')
    )
  );

CREATE POLICY "Users can create authorization logs"
  ON public.promotional_authorization_log
  FOR INSERT
  WITH CHECK (
    promotional_order_id IN (
      SELECT id FROM public.promotional_orders
    )
  );
