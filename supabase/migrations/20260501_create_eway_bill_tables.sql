-- Create e-way bill configuration and upload history tables

CREATE TABLE IF NOT EXISTS public.eway_bill_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_company_id uuid REFERENCES public.companies(id),
  api_key text,
  api_url text DEFAULT 'https://api.ewaybill.gov.in/v1/ewaybill',
  sender_gstin text,
  sender_legal_name text,
  sender_address text,
  sender_place text,
  sender_pincode text,
  sender_state_code text,
  recipient_gstin text,
  recipient_legal_name text,
  recipient_address text,
  recipient_place text,
  recipient_pincode text,
  recipient_state_code text,
  supply_type text,
  transport_mode text,
  transport_distance text,
  vehicle_number text,
  vehicle_type text,
  transporter_id text,
  transporter_name text,
  transport_document_number text,
  transport_document_date date,
  transaction_type text,
  sub_supply_type integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.eway_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid,
  bill_number text,
  source_table text,
  eway_bill_no text,
  eway_bill_date date,
  valid_upto date,
  grand_total numeric,
  dealer_name text,
  dealer_gst text,
  company_name text,
  company_gst text,
  status text,
  request_payload jsonb,
  response_payload jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eway_bill_settings_api_url ON public.eway_bill_settings (api_url);
CREATE INDEX IF NOT EXISTS idx_eway_bill_settings_sender_company_id ON public.eway_bill_settings (sender_company_id);
CREATE INDEX IF NOT EXISTS idx_eway_bills_order_id ON public.eway_bills (order_id);
CREATE INDEX IF NOT EXISTS idx_eway_bills_bill_number ON public.eway_bills (bill_number);
CREATE INDEX IF NOT EXISTS idx_eway_bills_eway_bill_no ON public.eway_bills (eway_bill_no);
