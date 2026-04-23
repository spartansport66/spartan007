-- Bill Number Sequence Gap - Diagnostic Tool
-- Use this script to analyze and understand the bill sequence issues in your database
-- Execute sections one at a time to troubleshoot

-- ============================================================================
-- SECTION 1: Quick Status Check
-- ============================================================================
-- Run this first to get an overview of the problem
SELECT 
  '📊 QUICK STATUS CHECK' as section,
  NOW() as checked_at;

SELECT 
  c.name as company_name,
  bs.series_prefix,
  bs.series_separator,
  bs.current_sequence_number as declared_next_seq,
  COUNT(i.id) as total_bills_issued,
  MAX(
    CASE 
      WHEN i.bill_number ~ '([0-9]+)$' 
      THEN CAST(SUBSTRING(i.bill_number, '([0-9]+)$') AS INTEGER)
      ELSE 0
    END
  ) as max_bill_sequence,
  CASE 
    WHEN COUNT(i.id) = 0 THEN '✅ OK - No bills issued'
    WHEN bs.current_sequence_number = 
      MAX(
        CASE 
          WHEN i.bill_number ~ '([0-9]+)$' 
          THEN CAST(SUBSTRING(i.bill_number, '([0-9]+)$') AS INTEGER)
          ELSE 0
        END
      ) + 1 
    THEN '✅ OK - Sequence correct'
    WHEN bs.current_sequence_number > 
      MAX(
        CASE 
          WHEN i.bill_number ~ '([0-9]+)$' 
          THEN CAST(SUBSTRING(i.bill_number, '([0-9]+)$') AS INTEGER)
          ELSE 0
        END
      ) + 1
    THEN '🔴 ERROR - Gap detected'
    ELSE '🟡 WARNING - Mismatch'
  END as status,
  CASE WHEN COUNT(i.id) = 0 THEN 0 ELSE bs.current_sequence_number - (
    MAX(
      CASE 
        WHEN i.bill_number ~ '([0-9]+)$' 
        THEN CAST(SUBSTRING(i.bill_number, '([0-9]+)$') AS INTEGER)
        ELSE 0
      END
    ) + 1
  ) END as gap_size
FROM public.bill_series bs
LEFT JOIN public.companies c ON bs.company_id = c.id
LEFT JOIN public.invoices i ON i.company_id = bs.company_id 
WHERE bs.is_active = true
GROUP BY bs.id, c.name, bs.series_prefix, bs.series_separator, bs.current_sequence_number
ORDER BY gap_size DESC NULLS LAST;

-- ============================================================================
-- SECTION 2: Detailed Bill Series Analysis
-- ============================================================================
-- Examine specific companies and their bill series
SELECT 
  '📋 DETAILED BILL SERIES ANALYSIS' as section;

SELECT 
  bs.id,
  bs.company_id,
  c.name as company_name,
  fy.year_name,
  bs.series_prefix,
  bs.series_separator,
  bs.current_sequence_number,
  bs.is_active,
  bs.created_at,
  bs.updated_at
FROM public.bill_series bs
LEFT JOIN public.companies c ON bs.company_id = c.id
LEFT JOIN public.financial_years fy ON bs.financial_year_id = fy.id
ORDER BY c.name, bs.created_at DESC;

-- ============================================================================
-- SECTION 3: Invoice Analysis - Bill Numbers Issued
-- ============================================================================
-- See what bill numbers have actually been issued
SELECT 
  '📄 INVOICE ANALYSIS' as section;

SELECT 
  c.name as company_name,
  COUNT(DISTINCT i.id) as total_invoices,
  COUNT(DISTINCT i.bill_number) as unique_bill_numbers,
  MIN(i.bill_number) as first_bill,
  MAX(i.bill_number) as latest_bill,
  STRING_AGG(DISTINCT i.bill_number, ', ' ORDER BY i.bill_number DESC) as recent_bills
FROM public.invoices i
LEFT JOIN public.companies c ON i.company_id = c.id
WHERE i.bill_number IS NOT NULL
GROUP BY c.name
ORDER BY c.name;

-- ============================================================================
-- SECTION 4: Bill Number Sequence Pattern Analysis
-- ============================================================================
-- Extract numeric sequences from bill numbers to find patterns
SELECT 
  '🔢 BILL NUMBER SEQUENCE PATTERN' as section;

WITH bill_numbers AS (
  SELECT 
    c.name as company_name,
    i.bill_number,
    CAST(SUBSTRING(i.bill_number, '([0-9]+)$') AS INTEGER) as sequence_number,
    ROW_NUMBER() OVER (
      PARTITION BY c.name 
      ORDER BY CAST(SUBSTRING(i.bill_number, '([0-9]+)$') AS INTEGER) ASC
    ) as row_num,
    LAG(CAST(SUBSTRING(i.bill_number, '([0-9]+)$') AS INTEGER)) OVER (
      PARTITION BY c.name 
      ORDER BY CAST(SUBSTRING(i.bill_number, '([0-9]+)$') AS INTEGER) ASC
    ) as prev_sequence
  FROM public.invoices i
  LEFT JOIN public.companies c ON i.company_id = c.id
  WHERE i.bill_number IS NOT NULL
)
SELECT 
  company_name,
  sequence_number,
  prev_sequence,
  CASE 
    WHEN prev_sequence IS NULL THEN 0
    ELSE sequence_number - prev_sequence - 1
  END as gap_from_previous,
  bill_number
FROM bill_numbers
ORDER BY company_name, sequence_number ASC;

-- ============================================================================
-- SECTION 5: Gap Analysis - Find All Gaps
-- ============================================================================
-- Identify all gaps in bill sequences
SELECT 
  '⚠️ GAP ANALYSIS' as section;

WITH numbered_bills AS (
  SELECT 
    c.name as company_name,
    i.bill_number,
    CAST(SUBSTRING(i.bill_number, '([0-9]+)$') AS INTEGER) as seq,
    ROW_NUMBER() OVER (
      PARTITION BY c.name 
      ORDER BY CAST(SUBSTRING(i.bill_number, '([0-9]+)$') AS INTEGER)
    ) as rn
  FROM public.invoices i
  LEFT JOIN public.companies c ON i.company_id = c.id
  WHERE i.bill_number IS NOT NULL
)
SELECT 
  company_name,
  (rn - 1) as expected_seq,
  seq as actual_seq,
  seq - (rn - 1) as gap
FROM numbered_bills
WHERE seq != (rn - 1)
ORDER BY company_name, seq;

-- ============================================================================
-- SECTION 6: Mismatch Detection - bill_series vs actual bills
-- ============================================================================
-- Find companies where declared_next doesn't match actual max + 1
SELECT 
  '🔴 MISMATCH DETECTION' as section;

WITH analysis AS (
  SELECT 
    c.name as company_name,
    bs.series_prefix,
    bs.current_sequence_number as declared_next,
    MAX(CAST(SUBSTRING(i.bill_number, '([0-9]+)$') AS INTEGER)) as max_issued,
    CASE WHEN MAX(CAST(SUBSTRING(i.bill_number, '([0-9]+)$') AS INTEGER)) IS NULL
      THEN bs.current_sequence_number
      ELSE MAX(CAST(SUBSTRING(i.bill_number, '([0-9]+)$') AS INTEGER)) + 1
    END as should_be_next,
    bs.current_sequence_number - (
      CASE WHEN MAX(CAST(SUBSTRING(i.bill_number, '([0-9]+)$') AS INTEGER)) IS NULL
        THEN bs.current_sequence_number
        ELSE MAX(CAST(SUBSTRING(i.bill_number, '([0-9]+)$') AS INTEGER)) + 1
      END
    ) as mismatch
  FROM public.bill_series bs
  LEFT JOIN public.companies c ON bs.company_id = c.id
  LEFT JOIN public.invoices i ON i.company_id = bs.company_id
  WHERE bs.is_active = true
  GROUP BY c.name, bs.series_prefix, bs.current_sequence_number
)
SELECT 
  company_name,
  series_prefix,
  declared_next,
  max_issued,
  should_be_next,
  mismatch,
  CASE 
    WHEN mismatch = 0 THEN '✅ MATCH'
    WHEN mismatch > 0 THEN '❌ AHEAD BY ' || mismatch || ' (gap)'
    ELSE '⚠️ BEHIND BY ' || ABS(mismatch)
  END as status
FROM analysis
WHERE mismatch != 0
ORDER BY ABS(mismatch) DESC;

-- ============================================================================
-- SECTION 7: Company-wise Issue Summary
-- ============================================================================
-- Summary of issues by company
SELECT 
  '📊 COMPANY-WISE SUMMARY' as section;

WITH max_seq_per_series AS (
  SELECT 
    bs.id as bill_series_id,
    bs.company_id,
    c.name as company_name,
    MAX(CAST(SUBSTRING(i.bill_number, '([0-9]+)$') AS INTEGER)) as max_bill_seq
  FROM public.bill_series bs
  LEFT JOIN public.companies c ON bs.company_id = c.id
  LEFT JOIN public.invoices i ON i.company_id = bs.company_id AND i.financial_year_id = bs.financial_year_id
  WHERE bs.is_active = true
  GROUP BY bs.id, bs.company_id, c.name
)
SELECT 
  c.name as company_name,
  COUNT(DISTINCT bs.id) as active_bill_series,
  COUNT(DISTINCT i.id) as total_invoices,
  COUNT(DISTINCT CASE WHEN bs.current_sequence_number > COALESCE(ms.max_bill_seq, bs.current_sequence_number - 1) + 1 THEN bs.id END) as series_with_gaps,
  SUM(
    CASE WHEN bs.current_sequence_number > COALESCE(ms.max_bill_seq, bs.current_sequence_number - 1) + 1 
      THEN bs.current_sequence_number - (COALESCE(ms.max_bill_seq, bs.current_sequence_number - 1) + 1)
      ELSE 0 END
  ) as total_gap_count
FROM public.bill_series bs
LEFT JOIN public.companies c ON bs.company_id = c.id
LEFT JOIN max_seq_per_series ms ON ms.bill_series_id = bs.id
LEFT JOIN public.invoices i ON i.company_id = bs.company_id AND i.financial_year_id = bs.financial_year_id
WHERE bs.is_active = true
GROUP BY c.name
HAVING COUNT(DISTINCT CASE WHEN bs.current_sequence_number > COALESCE(ms.max_bill_seq, 0) + 1 THEN bs.id END) > 0
ORDER BY total_gap_count DESC NULLS LAST;

-- ============================================================================
-- SECTION 8: Invoice Audit Trail
-- ============================================================================
-- Recent bills created to understand the pattern
SELECT 
  '⏱️ INVOICE AUDIT TRAIL' as section;

SELECT 
  c.name as company_name,
  i.bill_number,
  i.created_at,
  i.updated_at,
  CAST(SUBSTRING(i.bill_number, '([0-9]+)$') AS INTEGER) as sequence,
  LEAD(CAST(SUBSTRING(i.bill_number, '([0-9]+)$') AS INTEGER)) OVER (
    PARTITION BY c.name 
    ORDER BY i.created_at DESC
  ) as next_older_sequence,
  CAST(SUBSTRING(i.bill_number, '([0-9]+)$') AS INTEGER) - 
  LEAD(CAST(SUBSTRING(i.bill_number, '([0-9]+)$') AS INTEGER)) OVER (
    PARTITION BY c.name 
    ORDER BY i.created_at DESC
  ) as increment_size
FROM public.invoices i
LEFT JOIN public.companies c ON i.company_id = c.id
WHERE i.bill_number IS NOT NULL
ORDER BY c.name, i.created_at DESC
LIMIT 50;

-- ============================================================================
-- SECTION 9: Statistical Summary
-- ============================================================================
-- Overall database health check
SELECT 
  '📈 STATISTICAL SUMMARY' as section;

WITH max_seq_per_series AS (
  SELECT 
    bs.id as bill_series_id,
    MAX(CAST(SUBSTRING(i.bill_number, '([0-9]+)$') AS INTEGER)) as max_bill_seq
  FROM public.bill_series bs
  LEFT JOIN public.invoices i ON i.company_id = bs.company_id AND i.financial_year_id = bs.financial_year_id
  WHERE bs.is_active = true
  GROUP BY bs.id
)
SELECT 
  COUNT(DISTINCT bs.id) as total_active_bill_series,
  COUNT(DISTINCT i.id) as total_invoices,
  COUNT(DISTINCT CASE WHEN bs.current_sequence_number > 1 THEN bs.id END) as series_with_activity,
  COUNT(DISTINCT CASE WHEN bs.current_sequence_number > COALESCE(ms.max_bill_seq, bs.current_sequence_number - 1) + 1 THEN bs.id END) as series_with_gaps,
  SUM(
    CASE WHEN bs.current_sequence_number > COALESCE(ms.max_bill_seq, bs.current_sequence_number - 1) + 1 
      THEN bs.current_sequence_number - (COALESCE(ms.max_bill_seq, bs.current_sequence_number - 1) + 1)
      ELSE 0 END
  ) as total_missing_sequences
FROM public.bill_series bs
LEFT JOIN max_seq_per_series ms ON ms.bill_series_id = bs.id
LEFT JOIN public.invoices i ON i.company_id = bs.company_id AND i.financial_year_id = bs.financial_year_id
WHERE bs.is_active = true;

-- ============================================================================
-- SECTION 10: Recommendations
-- ============================================================================
-- Actions to take based on findings
SELECT 
  '💡 RECOMMENDATIONS' as section
UNION ALL
SELECT '1. Run the diagnostic above to identify all gaps'
UNION ALL
SELECT '2. Back up database: pg_dump > backup.sql'
UNION ALL
SELECT '3. Apply migration: 20260423_improved_fix_bill_sequence_gap.sql'
UNION ALL
SELECT '4. Verify with this query again'
UNION ALL
SELECT '5. Clear frontend cache and test bill creation'
UNION ALL
SELECT '6. Monitor for new gaps with automated alerts';
