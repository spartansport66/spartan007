import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface Product {
  id: string;
  name: string;
  code: string;
  size: string;
  dp: number;
  gst: string;
}

const TestProductDropdown = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      console.log('🚀 Fetching ALL products by paginating...');
      
      let allProducts: Product[] = [];
      let offset = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        console.log(`📄 Fetching page at offset ${offset}...`);
        
        const { data, error: fetchError } = await supabase
          .from('products')
          .select('id, name, code, size, dp, gst')
          .order('name')
          .range(offset, offset + pageSize - 1);
        
        if (fetchError) {
          console.error('❌ Fetch Error:', fetchError);
          setError(`Fetch Error: ${fetchError.message}`);
          return;
        }

        if (!data || data.length === 0) {
          console.log('✅ Reached end of products');
          hasMore = false;
        } else {
          console.log(`✅ Fetched ${data.length} products from offset ${offset}`);
          allProducts = [...allProducts, ...data];
          
          if (data.length < pageSize) {
            hasMore = false;
          } else {
            offset += pageSize;
          }
        }
      }

      console.log('✅ ALL Products fetched successfully:', allProducts.length);
      console.log('📋 First 10 products:', allProducts.slice(0, 10));
      
      // Check for CTG 303
      const ctg303 = allProducts.filter((p: any) => (p.code || '').toString().toUpperCase().includes('CTG 303'));
      console.log('🔍 CTG 303 Products:', ctg303);
      
      setProducts(allProducts);
      setFilteredProducts(allProducts);
      setError('');
    } catch (err: any) {
      console.error('❌ Error:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearchText(value);
    const searchLower = value.toLowerCase().trim();
    
    if (searchLower.length === 0) {
      setFilteredProducts(products);
    } else {
      const filtered = products.filter(p => {
        const name = (p.name || '').toLowerCase().trim();
        const code = (p.code || '').toString().toLowerCase().trim();
        return name.includes(searchLower) || code.includes(searchLower);
      });
      setFilteredProducts(filtered);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader className="bg-blue-600 text-white">
          <CardTitle>🧪 Test Product Dropdown</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {/* Status */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="font-bold text-lg">
              {loading ? '⏳ Loading...' : error ? `❌ ${error}` : `✅ ${products.length} products loaded`}
            </p>
          </div>

          {/* Search Input */}
          {!loading && (
            <div className="space-y-2">
              <label className="block font-semibold">Search Products</label>
              <Input
                placeholder="Type product name or code (e.g., CTG 303, CB 102)..."
                value={searchText}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full"
              />
              <p className="text-sm text-gray-600">
                Found: <span className="font-bold text-blue-600">{filteredProducts.length}</span> products
              </p>
            </div>
          )}

          {/* Dropdown Results */}
          {!loading && filteredProducts.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left font-bold">Code</th>
                      <th className="px-4 py-2 text-left font-bold">Name</th>
                      <th className="px-4 py-2 text-left font-bold">Size</th>
                      <th className="px-4 py-2 text-right font-bold">DP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((prod) => (
                      <tr
                        key={prod.id}
                        className="border-b hover:bg-blue-50 transition"
                      >
                        <td className="px-4 py-2 font-mono font-bold text-blue-600">
                          {prod.code || 'N/A'}
                        </td>
                        <td className="px-4 py-2">{prod.name || 'N/A'}</td>
                        <td className="px-4 py-2">{prod.size || '-'}</td>
                        <td className="px-4 py-2 text-right">₹{prod.dp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* No Results */}
          {!loading && filteredProducts.length === 0 && products.length > 0 && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800">
              ⚠️ No products found matching "{searchText}"
            </div>
          )}

          {/* Debug Info */}
          {!loading && (
            <div className="p-4 bg-gray-100 rounded-lg text-sm font-mono text-gray-700 space-y-2">
              <p>📊 <span className="font-bold">Total Products:</span> {products.length}</p>
              <p>🔎 <span className="font-bold">Search Query:</span> "{searchText}"</p>
              <p>✅ <span className="font-bold">Showing:</span> {filteredProducts.length} results</p>
            </div>
          )}

          {/* Retry Button */}
          {error && (
            <button
              onClick={fetchProducts}
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700"
            >
              🔄 Retry
            </button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TestProductDropdown;
