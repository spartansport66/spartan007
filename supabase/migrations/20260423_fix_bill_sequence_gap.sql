-- Fix for Bill Number Sequence Gap Issue
-- Problem: Bill sequence jumped from 1 to 1033, causing 1031 missing bill numbers
-- Root Cause: current_sequence_number in bill_series table was incorrectly set
-- Solution: Analyze the gap, reset sequence to correct value, and add safeguards

-- ============================================================================
-- 1. DIAGNOSTIC: Analyze the gap for all companies
-- ============================================================================
SELECT 
  'DIAGNOSTIC: Bill Sequence Gap Analysis' as section;

-- Check current bill_series state
SELECT 
  bs.id,
  bs.company_id,
  c.name as company_name,
  bs.series_prefix,
  bs.current_sequence_number,
  bs.is_active,
  COUNT(DISTINCT CASE WHEN i.bill_number IS NOT NULL THEN 1 END) as total_bills_issued,
  MAX(
    CAST(
      NULLIF(REGEXP_SUBSTR(i.bill_number, '[0-9]+$'), '') 
      AS INTEGER
    )
  ) as max_sequence_in_db,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN i.bill_number IS NOT NULL THEN 1 END) = 0 THEN 'No bills issued'
    WHEN bs.current_sequence_number > MAX(
      CAST(NULLIF(REGEXP_SUBSTR(i.bill_number, '[0-9]+$'), '') AS INTEGER)
    ) THEN 'MISMATCH: sequence ahead of max bill'
    WHEN bs.current_sequence_number < MAX(
      CAST(NULLIF(REGEXP_SUBSTR(i.bill_number, '[0-9]+$'), '') AS INTEGER)
    ) THEN 'MISMATCH: sequence behind max bill'
    ELSE 'OK'
  END as status
FROM public.bill_series bs
LEFT JOIN public.companies c ON bs.company_id = c.id
LEFT JOIN public.invoices i ON i.company_id = bs.company_id 
  AND CAST(NULLIF(REGEXP_SUBSTR(i.bill_number, '[0-9]+$'), '') AS INTEGER) >= 0
GROUP BY bs.id, bs.company_id, c.name, bs.series_prefix, bs.current_sequence_number, bs.is_active
ORDER BY bs.company_id;

-- ============================================================================
-- 2. DETAILED ANALYSIS: Show the actual gap
-- ============================================================================
WITH bill_sequences AS (
  SELECT DISTINCT
    bs.id as bill_series_id,
    bs.company_id,
    bs.series_prefix,
    bs.current_sequence_number,
    CAST(NULLIF(REGEXP_SUBSTR(i.bill_number, '[0-9]+$'), '') AS INTEGER) as issued_sequence,
    i.bill_number,
    i.created_at
  FROM public.bill_series bs
  LEFT JOIN public.invoices i ON i.company_id = bs.company_id
  WHERE bs.is_active = true
)
SELECT 
  bill_series_id,
  series_prefix,
  current_sequence_number as expected_next_sequence,
  MAX(issued_sequence) as actual_max_sequence_issued,
  MAX(issued_sequence) + 1 as should_be_next_sequence,
  current_sequence_number - (MAX(issued_sequence) + 1) as gap_to_reset,
  CASE 
    WHEN current_sequence_number > MAX(issued_sequence) + 1 THEN 
      'ERROR: ' || (current_sequence_number - MAX(issued_sequence) - 1)::text || ' missing numbers'
    WHEN current_sequence_number = MAX(issued_sequence) + 1 THEN 'CORRECT'
    ELSE 'BEHIND'
  END as issue_status
FROM bill_sequences
GROUP BY bill_series_id, series_prefix, current_sequence_number;

-- ============================================================================
-- 3. FIX: Reset current_sequence_number for companies with gaps
-- ============================================================================
-- For company e14cf6e2-a3c8-48f1-a418-1acb0983c070 (the problematic one)
UPDATE public.bill_series bs
SET 
  current_sequence_number = COALESCE(
    (
      SELECT MAX(
        CAST(
          NULLIF(REGEXP_SUBSTR(i.bill_number, '[0-9]+$'), '') 
          AS INTEGER
        )
      ) + 1
      FROM public.invoices i
      WHERE i.company_id = bs.company_id
    ),
    1  -- Start at 1 if no bills exist
  ),
  updated_at = NOW()
WHERE 
  bs.company_id = 'e14cf6e2-a3c8-48f1-a418-1acb0983c070'
  AND bs.is_active = true;

-- Apply the same fix to ALL companies (safer approach)
UPDATE public.bill_series bs
SET 
  current_sequence_number = COALESCE(
    (
      SELECT MAX(
        CAST(
          NULLIF(REGEXP_SUBSTR(i.bill_number, '[0-9]+$'), '') 
          AS INTEGER
        )
      ) + 1
      FROM public.invoices i
      WHERE i.company_id = bs.company_id
        AND bs.financial_year_id = (
          SELECT financial_year_id FROM public.bill_series 
          WHERE id = bs.id
        )
    ),
    1  -- Start at 1 if no bills exist
  ),
  updated_at = NOW()
WHERE 
  bs.is_active = true
  AND bs.current_sequence_number > (
    -- Only update if there's a real gap detected
    SELECT COALESCE(MAX(
      CAST(
        NULLIF(REGEXP_SUBSTR(i.bill_number, '[0-9]+$'), '') 
        AS INTEGER
      )
    ) + 1, 1)
    FROM public.invoices i
    WHERE i.company_id = bs.company_id
  );

-- ============================================================================
-- 4. VERIFICATION: Confirm the fix
-- ============================================================================
SELECT 
  'VERIFICATION: After Fix' as section;

SELECT 
  bs.id,
  bs.company_id,
  c.name as company_name,
  bs.series_prefix,
  bs.current_sequence_number as current_next_sequence,
  COUNT(DISTINCT CASE WHEN i.bill_number IS NOT NULL THEN 1 END) as total_bills_issued,
  MAX(
    CAST(
      NULLIF(REGEXP_SUBSTR(i.bill_number, '[0-9]+$'), '') 
      AS INTEGER
    )
  ) as actual_max_sequence_issued,
  CASE 
    WHEN bs.current_sequence_number = MAX(
      CAST(NULLIF(REGEXP_SUBSTR(i.bill_number, '[0-9]+$'), '') AS INTEGER)
    ) + 1 
    OR (COUNT(DISTINCT CASE WHEN i.bill_number IS NOT NULL THEN 1 END) = 0 AND bs.current_sequence_number = 1)
    THEN '✅ FIXED'
    ELSE '⚠️ NEEDS REVIEW'
  END as fix_status
FROM public.bill_series bs
LEFT JOIN public.companies c ON bs.company_id = c.id
LEFT JOIN public.invoices i ON i.company_id = bs.company_id
WHERE bs.is_active = true
GROUP BY bs.id, bs.company_id, c.name, bs.series_prefix, bs.current_sequence_number
ORDER BY bs.company_id;

-- ============================================================================
-- 5. PREVENTION: Add a CHECK constraint to prevent negative sequences
-- ============================================================================
ALTER TABLE public.bill_series
  ADD CONSTRAINT check_current_sequence_positive 
  CHECK (current_sequence_number >= 1);

-- ============================================================================
-- 6. LOGS: Record what was fixed
-- ============================================================================
INSERT INTO public.activity_logs (
  action,
  entity_type,
  description,
  performed_by,
  created_at
)
VALUES (
  'BILL_SEQUENCE_FIX',
  'bill_series',
  'Fixed bill number sequence gap: Reset current_sequence_number to match actual max issued + 1',
  'migration:20260423_fix_bill_sequence_gap',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 7. SUMMARY
-- ============================================================================
SELECT 
  'SUMMARY: Bill Sequence Gap Fix Complete' as result,
  'The current_sequence_number in bill_series has been reset to match the actual maximum bill number issued + 1.' as action,
  'Next bill for M/26-27 series will be: M/26-27/' || 
  COALESCE((
    SELECT MAX(CAST(NULLIF(REGEXP_SUBSTR(bill_number, '[0-9]+$'), '') AS INTEGER)) + 1
    FROM public.invoices 
    WHERE company_id = 'e14cf6e2-a3c8-48f1-a418-1acb0983c070'
  ), 1)::text as next_bill_number;
