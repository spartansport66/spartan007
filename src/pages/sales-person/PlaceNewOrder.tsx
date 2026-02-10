import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabaseClient';
import { Product, Dealer } from '../../types';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const PlaceNewOrder = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedDealer, setSelectedDealer] = useState<string>('');
  const [orderItems, setOrderItems] = useState<{ product_id: string; quantity: number; name: string; dp: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [comboboxOpen, setComboboxOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setLoading(true);
      try {
        // Fetch assigned dealers
        const { data: assignedDealersData, error: assignedDealersError } = await supabase
          .from('dealer_sales_persons')
          .select('dealers(*)')
          .eq('sales_person_id', user.id);

        if (assignedDealersError) throw new Error(`Error fetching assigned dealers: ${assignedDealersError.message}`);
        
        const formattedDealers = (assignedDealersData || []).map((item: any) => item.dealers);
        setDealers(formattedDealers);

        // Fetch all products
        const { data: productData, error: productError } = await supabase
          .from('products')
          .select('id, code, name, dp, stock')
          .order('name', { ascending: true });

        if (productError) throw new Error(`Error fetching products: ${productError.message}`);
        setProducts(productData || []);

      } catch (error: any) {
        toast.error(error.message);
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const handleAddProduct = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product && !orderItems.some(item => item.product_id === productId)) {
      setOrderItems([...orderItems, { product_id: productId, quantity: 1, name: product.name, dp: product.dp }]);
    }
  };

  const handleQuantityChange = (productId: string, quantity: number) => {
    if (quantity > 0) {
      setOrderItems(orderItems.map(item => item.product_id === productId ? { ...item, quantity } : item));
    }
  };

  const handleRemoveProduct = (productId: string) => {
    setOrderItems(orderItems.filter(item => item.product_id !== productId));
  };

  const calculateTotal = () => {
    return orderItems.reduce((total, item) => total + (item.dp * item.quantity), 0).toFixed(2);
  };

  const handleSubmitOrder = async () => {
    if (!selectedDealer || orderItems.length === 0) {
      toast.error("Please select a dealer and add at least one product.");
      return;
    }
    setIsSubmitting(true);
    try {
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          dealer_id: selectedDealer,
          user_id: user?.id, // Changed from sales_person_id to user_id
          total_amount: parseFloat(calculateTotal()),
          status: 'Pending', // Default status
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItemsData = orderItems.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        total_price: item.dp * item.quantity, // Use total_price
        sale_date: new Date().toISOString(), // Add sale_date
      }));

      const { error: itemsError } = await supabase.from('sales').insert(orderItemsData); // Insert into 'sales' table
      if (itemsError) throw itemsError;

      toast.success("Order placed successfully!");
      navigate('/dashboard'); // Navigate to the main dashboard

    } catch (error: any) {
      toast.error(`Failed to place order: ${error.message}`);
      console.error("Order submission error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  const selectedDealerName = dealers.find(d => d.id === selectedDealer)?.name || "Select dealer...";

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Place New Order</h1>
      
      <div className="mb-4">
        <label htmlFor="dealer" className="block text-sm font-medium text-gray-700">Select Dealer</label>
        <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={comboboxOpen}
              className="w-full md:w-[300px] justify-between"
              disabled={dealers.length === 0}
            >
              {selectedDealerName}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0">
            <Command>
              <CommandInput placeholder="Search dealer..." />
              <CommandList>
                <CommandEmpty>No dealer found.</CommandEmpty>
                <CommandGroup>
                  {dealers.map((dealer) => (
                    <CommandItem
                      key={dealer.id}
                      value={dealer.name}
                      onSelect={() => {
                        setSelectedDealer(dealer.id);
                        setComboboxOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedDealer === dealer.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {dealer.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <div className="mb-4">
        <label htmlFor="product" className="block text-sm font-medium text-gray-700">Add Product</label>
        <select
          id="product"
          onChange={(e) => handleAddProduct(e.target.value)}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          value=""
        >
          <option value="">Select a product to add</option>
          {products.map(product => (
            <option key={product.id} value={product.id}>{product.name} (DP: {product.dp})</option>
          ))}
        </select>
      </div>

      <div className="mt-6">
        <h2 className="text-xl font-semibold">Order Items</h2>
        <div className="mt-2 border rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subtotal</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orderItems.length > 0 ? (
                orderItems.map(item => (
                  <tr key={item.product_id}>
                    <td className="px-6 py-4 whitespace-nowrap">{item.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(item.product_id, parseInt(e.target.value))}
                        className="w-20 border-gray-300 rounded-md"
                        min="1"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">₹{item.dp.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">₹{(item.dp * item.quantity).toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button onClick={() => handleRemoveProduct(item.product_id)} className="text-red-600 hover:text-red-900">Remove</button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">No items added yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 text-right">
        <p className="text-xl font-bold">Total: ₹{calculateTotal()}</p>
        <button
          onClick={handleSubmitOrder}
          disabled={isSubmitting || orderItems.length === 0 || !selectedDealer}
          className="mt-2 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Order'}
        </button>
      </div>
    </div>
  );
};

export default PlaceNewOrder;