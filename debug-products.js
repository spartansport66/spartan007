import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://hxftiocfihhdutciaisl.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4ZnRpb2NmaWhoZHV0Y2lhaXNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMDM5MDIsImV4cCI6MjA4MjU3OTkwMn0.2DxedsU5prsd9GhFH4dJA2I1HbYhiGLhHBcNOVjjEjk";

console.log('🔗 Connecting to Supabase...\n');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function queryProducts() {
  console.log('📋 RUNNING THIS QUERY:');
  console.log('SELECT id, name, code, size, dp, gst FROM products ORDER BY name LIMIT 50000\n');
  
  try {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, code, size, dp, gst')
      .order('name')
      .limit(50000);
    
    if (error) {
      console.error('❌ QUERY ERROR:', error.message);
      return;
    }
    
    console.log('✅ SUCCESS! Total Products Found:', data?.length);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📌 FIRST 10 PRODUCTS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(JSON.stringify(data?.slice(0, 10), null, 2));
    
    // Search for CTG products
    const ctgProducts = data?.filter(p => (p.code || '').toString().toUpperCase().includes('CTG'));
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 PRODUCTS WITH "CTG" IN CODE');
    console.log('Found:', ctgProducts?.length, 'products');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (ctgProducts?.length > 0) {
      console.log(JSON.stringify(ctgProducts?.slice(0, 10), null, 2));
    }
    
    // Search for CTG 303 specifically
    const ctg303 = data?.filter(p => (p.code || '').toString().toUpperCase() === 'CTG 303');
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 EXACT MATCH FOR "CTG 303"');
    console.log('Found:', ctg303?.length, 'product(s)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (ctg303?.length > 0) {
      console.log(JSON.stringify(ctg303, null, 2));
    } else {
      console.log('❌ CTG 303 NOT FOUND\n');
      
      // Try other variations
      console.log('Searching for variations...');
      const withSpaces = data?.filter(p => (p.code || '').toString().includes('CTG'));
      console.log('- CTG with any spacing:', withSpaces?.length);
      
      const code303 = data?.filter(p => (p.code || '').toString().includes('303'));
      console.log('- Products with 303:', code303?.length);
      if (code303?.length > 0) {
        console.log(JSON.stringify(code303?.slice(0, 5), null, 2));
      }
    }
    
  } catch (err) {
    console.error('❌ ERROR:', err.message);
  }
}

queryProducts();
