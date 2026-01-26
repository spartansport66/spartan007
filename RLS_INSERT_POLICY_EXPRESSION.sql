(
  (bucket_id = 'visit-photos') AND
  (auth.role() = 'authenticated') AND
  ((SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'sales_person')
)