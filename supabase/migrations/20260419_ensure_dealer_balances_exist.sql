-- Ensure all dealers have opening_balance records
-- This migration creates missing dealer_balances records with opening_balance = 0

INSERT INTO public.dealer_balances (dealer_id, opening_balance)
SELECT d.id, 0
FROM public.dealers d
WHERE d.id NOT IN (
  SELECT dealer_id FROM public.dealer_balances
)
ON CONFLICT (dealer_id) DO NOTHING;

-- If the specific Demo dealer needs a specific opening balance, update it:
-- UPDATE public.dealer_balances 
-- SET opening_balance = 50000 
-- WHERE dealer_id = 'bbae747b-c708-4c79-ba43-c9469f114dea';
