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

// Define interface for stock update objects
interface ProductStockUpdate {
  id: string;
  stock: number; // The new calculated stock
  previous_stock: number; // The stock before this order
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

    // 1. Fetch product details (stock *before* this order)
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
    const productsToUpdateStock: ProductStockUpdate[] = []; // Explicitly type the array

    // First, calculate total order amount and prepare sales items and stock updates
    for (const item of orderItems) {
      const product = productMap.get(item.product_id) as Product;
      if (!product) {
        throw new Error(`Product with ID ${item.product_id} not found.`);
      }
      if (item.quantity <= 0) {
        throw new Error(`Invalid quantity for product ${product.name}.`);
      }
      const itemTotalPrice = item.quantity * product.price;
      totalOrderAmount += itemTotalPrice;
      salesToInsert.push({
        product_id: item.product_id,
        quantity: item.quantity,
        total_price: itemTotalPrice,
      });

      // Prepare stock update for this product
      productsToUpdateStock.push({
        id: product.id,
        stock: product.stock - item.quantity, // Calculate new stock level
        previous_stock: product.stock // Store previous stock for alert logic
      });
    }

    // 2. Fetch dealer credit limit (monthly or general) and current balance
    const { data: dealerData, error: dealerError } = await supabaseAdmin
      .from('dealers')
      .select('credit_limit') // Fetch general credit limit
      .eq('id', dealerId)
      .single();

    if (dealerError) {
      throw new Error(`Failed to fetch dealer credit limit: ${dealerError.message}`);
    }

    if (!dealerData) {
      throw new Error('Dealer not found.');
    }

    let effectiveCreditLimit = dealerData.credit_limit;
    // Check for month-wise credit limit
    const today = new Date();
    const currentMonthYear = new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1)).toISOString().split('T')[0]; // YYYY-MM-01
    const { data: monthlyLimitData, error: monthlyLimitError } = await supabaseAdmin
      .from('dealer_monthly_credit_limits')
      .select('credit_limit')
      .eq('dealer_id', dealerId)
      .eq('month_year', currentMonthYear)
      .single();

    if (monthlyLimitError && monthlyLimitError.code !== 'PGRST116') { // PGRST116 means "no rows found"
      console.error('Error fetching monthly credit limit in Edge Function:', monthlyLimitError.message);
      // Fallback to general limit if there's an error fetching monthly limit
    } else if (monthlyLimitData) {
      effectiveCreditLimit = monthlyLimitData.credit_limit;
    }
    // If monthlyLimitData is null (no monthly limit set), effectiveCreditLimit remains the general dealerData.credit_limit

    const { data: totalSpentData, error: totalSpentError } = await supabaseAdmin
      .from('orders')
      .select('total_amount')
      .eq('dealer_id', dealerId)
      .in('payment_status', ['pending', 'pending_approval']); // Include pending_approval orders in consumed credit

    if (totalSpentError) {
      throw new Error(`Failed to calculate dealer balance: ${totalSpentError.message}`);
    }

    const currentTotalSpent = totalSpentData.reduce((sum, order) => sum + order.total_amount, 0);
    const availableCredit = effectiveCreditLimit - currentTotalSpent; // Use effectiveCreditLimit

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
    const salesWithOrderId = salesToInsert.map(sale => ({
      ...sale,
      order_id: newOrder.id
    }));

    const { error: salesInsertError } = await supabaseAdmin
      .from('sales')
      .insert(salesWithOrderId);

    if (salesInsertError) {
      // In a real transaction, we would roll back the order here.
      // For now, we'll just log and return an error.
      console.error('Failed to insert sales items, order might be partially created:', salesInsertError.message);
      throw new Error(`Failed to insert sales items: ${salesInsertError.message}`);
    }

    // 5. If payment details are provided, insert into payments table
    if (paymentDetails) {
      const { error: paymentInsertError } = await supabaseAdmin
        .from('payments')
        .insert({
          order_id: newOrder.id,
          amount: totalOrderAmount,
          payment_method: paymentDetails.payment_method,
          cheque_dd_no: paymentDetails.cheque_dd_no,
          cheque_dd_date: paymentDetails.cheque_dd_date,
          card_number: paymentDetails.card_number,
          card_holder_name: paymentDetails.card_holder_name,
          expiry_date: paymentDetails.expiry_date,
          cvv: paymentDetails.cvv,
          bank_name: paymentDetails.bank_name,
          account_number: paymentDetails.account_number,
          ifsc_code: paymentDetails.ifsc_code,
          upi_id: paymentDetails.upi_id,
          transaction_id: paymentDetails.transaction_id,
          status: paymentStatus === 'paid' ? 'completed' : 'pending_approval',
        });

      if (paymentInsertError) {
        console.error('Failed to insert payment details:', paymentInsertError.message);
        throw new Error(`Failed to record payment details: ${paymentInsertError.message}`);
      }
    }

    // 6. Update product stock levels and manage production alerts
    const productionAlertsToUpsert = [];
    const productionAlertsToResolve = [];

    // Perform all stock updates first, and get the *final* stock levels
    const { data: updatedProductsData, error: bulkStockUpdateError } = await supabaseAdmin
      .from('products')
      .upsert(productsToUpdateStock.map(p => ({ id: p.id, stock: p.stock })), { onConflict: 'id' })
      .select('id, stock'); // Select the *final* stock after all updates

    if (bulkStockUpdateError) {
      console.error('Failed to bulk update product stock:', bulkStockUpdateError.message);
      throw new Error(`Failed to update product stock: ${bulkStockUpdateError.message}`);
    }

    const finalStockMap = new Map(updatedProductsData.map(p => [p.id, p.stock]));

    // Now, manage production alerts based on the *final* stock levels
    for (const productUpdate of productsToUpdateStock) {
      const productId = productUpdate.id;
      // Ensure finalStockLevel is treated as a number
      const finalStockLevel = (finalStockMap.get(productId) || 0) as number; 

      if (finalStockLevel < 0) {
        // If final stock is negative, ensure an alert exists and reflects the total deficit
        const { data: existingAlert, error: fetchAlertError } = await supabaseAdmin
          .from('production_alerts')
          .select('id')
          .eq('product_id', productId)
          .eq('resolved', false)
          .single();

        if (fetchAlertError && fetchAlertError.code !== 'PGRST116') { // PGRST116 means "no rows found"
          console.error(`Error fetching existing alert for product ${productId}:`, fetchAlertError.message);
          // Continue, but log the error
        }

        if (existingAlert) {
          // Update existing alert with the new total required quantity
          const { error: updateAlertError } = await supabaseAdmin
            .from('production_alerts')
            .update({
              required_quantity: Math.abs(finalStockLevel),
              created_by: userId, // Update with latest requester
              dealer_id: dealerId, // Update with latest dealer
              created_at: new Date().toISOString(), // Update timestamp
            })
            .eq('id', existingAlert.id);

          if (updateAlertError) {
            console.error(`Failed to update production alert for product ${productId}:`, updateAlertError.message);
          }
        } else {
          // Insert new alert
          const { error: insertAlertError } = await supabaseAdmin
            .from('production_alerts')
            .insert({
              product_id: productId,
              required_quantity: Math.abs(finalStockLevel),
              created_by: userId,
              dealer_id: dealerId,
              resolved: false,
            });

          if (insertAlertError) {
            console.error(`Failed to insert new production alert for product ${productId}:`, insertAlertError.message);
          }
        }
      } else if (productUpdate.previous_stock < 0 && finalStockLevel >= 0) {
        // If stock was negative and is now non-negative, resolve existing alerts
        const { error: resolveAlertsError } = await supabaseAdmin
          .from('production_alerts')
          .update({ resolved: true })
          .eq('product_id', productId)
          .eq('resolved', false);

        if (resolveAlertsError) {
          console.error(`Failed to resolve production alerts for product ${productId}:`, resolveAlertsError.message);
        }
      }
    }

    return new Response(JSON.stringify({
      message: 'Order placed successfully',
      orderId: newOrder.id,
      orderNumber: newOrder.order_number
    }), {
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