// @ts-ignore
/// <reference lib="deno.ns" />

// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Define Product interface for type safety within the Edge Function
interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { dealerId, userId, orderItems, paymentStatus, paymentDueDate, paymentDetails } = await req.json();

    if (!dealerId || !userId || !orderItems || !Array.isArray(orderItems) || orderItems.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing or invalid order data.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Start a transaction (Supabase client doesn't directly support transactions in Edge Functions,
    // so we'll simulate it by performing checks and then inserts/updates, relying on RLS and database constraints).
    // For true atomicity, a stored procedure would be ideal, but this is a common pattern for simple cases.

    // 1. Fetch product details and check stock
    const productIds = orderItems.map((item: any) => item.product_id);
    const { data: products, error: productsError } = await supabaseAdmin
      .from('products')
      .select('id, name, price, stock')
      .in('id', productIds);

    if (productsError) {
      throw new Error(`Failed to fetch product details: ${productsError.message}`);
    }
    if (!products || products.length !== productIds.length) {
      throw new Error('One or more products not found.');
    }

    const productMap = new Map(products.map(p => [p.id, p]));
    let totalOrderAmount = 0;
    const salesToInsert = [];
    const stockUpdates = [];

    for (const item of orderItems) {
      const product = productMap.get(item.product_id) as Product; // Type assertion
      if (!product) {
        throw new Error(`Product with ID ${item.product_id} not found.`);
      }
      if (item.quantity <= 0) {
        throw new Error(`Invalid quantity for product ${product.name}.`);
      }
      if (item.quantity > product.stock) {
        throw new Error(`Not enough stock for ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`);
      }

      const itemTotalPrice = item.quantity * product.price;
      totalOrderAmount += itemTotalPrice;

      salesToInsert.push({
        product_id: item.product_id,
        quantity: item.quantity,
        total_price: itemTotalPrice,
      });

      stockUpdates.push({
        id: product.id,
        new_stock: product.stock - item.quantity,
      });
    }

    // 2. Fetch dealer credit limit and current balance
    const { data: dealerData, error: dealerError } = await supabaseAdmin
      .from('dealers')
      .select('credit_limit')
      .eq('id', dealerId)
      .single();

    if (dealerError) {
      throw new Error(`Failed to fetch dealer credit limit: ${dealerError.message}`);
    }
    if (!dealerData) {
      throw new Error('Dealer not found.');
    }

    const { data: totalSpentData, error: totalSpentError } = await supabaseAdmin
      .from('orders')
      .select('total_amount')
      .eq('dealer_id', dealerId);

    if (totalSpentError) {
      throw new Error(`Failed to calculate dealer balance: ${totalSpentError.message}`);
    }

    const currentTotalSpent = totalSpentData.reduce((sum, order) => sum + order.total_amount, 0);
    const availableCredit = dealerData.credit_limit - currentTotalSpent;

    if (totalOrderAmount > availableCredit) {
      throw new Error(`Order exceeds dealer's credit limit. Available: ${availableCredit.toFixed(2)}, Order Total: ${totalOrderAmount.toFixed(2)}`);
    }

    // 3. Create the new order
    const { data: newOrder, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        dealer_id: dealerId,
        user_id: userId,
        total_amount: totalOrderAmount,
        status: 'completed', // Assuming all orders created via this function are completed
        payment_status: paymentStatus || 'pending', // New: payment status
        payment_due_date: paymentDueDate, // New: payment due date
      })
      .select('id, order_number') // Select the new order_number
      .single();

    if (orderError) {
      throw new Error(`Failed to create order: ${orderError.message}`);
    }
    if (!newOrder) {
      throw new Error('Order creation failed, no order ID returned.');
    }

    // 4. Insert sales items linked to the new order
    const salesWithOrderId = salesToInsert.map(sale => ({ ...sale, order_id: newOrder.id }));
    const { error: salesInsertError } = await supabaseAdmin
      .from('sales')
      .insert(salesWithOrderId);

    if (salesInsertError) {
      // In a real transaction, we would roll back the order here.
      // For now, we'll just log and return an error.
      console.error('Failed to insert sales items, order might be partially created:', salesInsertError.message);
      throw new Error(`Failed to insert sales items: ${salesInsertError.message}`);
    }

    // 5. If payment was made at order time, insert into payments table
    if (paymentDetails && paymentStatus === 'paid') {
      const { error: paymentInsertError } = await supabaseAdmin
        .from('payments')
        .insert({
          order_id: newOrder.id,
          amount: paymentDetails.amount,
          payment_method: paymentDetails.payment_method,
          cheque_dd_no: paymentDetails.cheque_dd_no,
          cheque_dd_date: paymentDetails.cheque_dd_date,
          status: 'completed', // Payment made at order time is considered completed
        });

      if (paymentInsertError) {
        console.error('Failed to insert payment details:', paymentInsertError.message);
        // Decide if this should roll back the entire order or just log.
        // For now, we'll throw an error to indicate a partial failure.
        throw new Error(`Failed to record payment details: ${paymentInsertError.message}`);
      }
    }

    // 6. Update product stock
    for (const update of stockUpdates) {
      const { error: stockUpdateError } = await supabaseAdmin
        .from('products')
        .update({ stock: update.new_stock })
        .eq('id', update.id);

      if (stockUpdateError) {
        // In a real transaction, we would roll back everything here.
        console.error(`Failed to update stock for product ${update.id}: ${stockUpdateError.message}`);
        throw new Error(`Failed to update stock for product ${update.id}: ${stockUpdateError.message}`);
      }
    }

    return new Response(JSON.stringify({ message: 'Order placed successfully', orderId: newOrder.id, orderNumber: newOrder.order_number }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Edge Function error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});