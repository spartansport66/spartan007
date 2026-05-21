# Query to Find All Payment Table Columns

Copy and run this query in Supabase Dashboard → SQL Editor:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'payments'
ORDER BY ordinal_position;
```

This will show you ALL columns in the payments table with their exact names and data types.

Once you run this and share the results, I'll update all the program code to use the correct column names.
