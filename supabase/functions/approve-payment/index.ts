/// <reference lib="deno.ns" />
// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { paymentId, orderId, dealerId, amount, action } = await req.json();

    // Detailed validation check
    if (!paymentId) {
      return new Response(JSON.stringify({ error: 'Missing required parameter: paymentId.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!dealerId) {
      return new Response(JSON.stringify({ error: 'Missing required parameter: dealerId.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (typeof amount !== 'number') {
      return new Response(JSON.stringify({ error: `Missing or invalid parameter: amount (received ${amount}).` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!['approve', 'reject'].includes(action)) {
      return new Response(JSON.stringify({ error: `Missing or invalid parameter: action (received ${action}).` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    console.log(`[approve-payment] Processing action: ${action} for paymentId: ${paymentId}, orderId: ${orderId}, dealerId: ${dealerId}, amount: ${amount}`);

    const supabaseAdmin = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // --- Due Date Check (Only relevant for order payments and cheque/DD) ---
    let effectiveDueDate: Date | null = null;
    let paymentData = null;

    if (orderId) {
      // Fetch payment details (payment_method, cheque_dd_date)
      const { data: pd, error: paymentError } = await supabaseAdmin
        .from('payments')
        .select('payment_method, cheque_dd_date')
        .eq('id', paymentId)
        .single();

      if (paymentError) {
        throw new Error(`Failed to fetch payment details: ${paymentError.message}`);
      }
      paymentData = pd;

      // Fetch order details (payment_due_date)
      const { data: orderData, error: orderFetchError } = await supabaseAdmin
        .from('orders')
        .select('payment_due_date')
        .eq('id', orderId)
        .single();

      if (orderFetchError) {
        throw new Error(`Failed to fetch order details: ${orderFetchError.message}`);
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (paymentData.payment_method === 'Cheque/DD' && paymentData.cheque_dd_date) {
        effectiveDueDate = new Date(paymentData.cheque_dd_date);
      } else if (orderData.payment_due_date) {
        effectiveDueDate = new Date(orderData.payment_due_date);
      }

      if (effectiveDueDate) {
        effectiveDueDate.setHours(0, 0, 0, 0);
      }

      if (action === 'approve' && effectiveDueDate && effectiveDueDate > today) {
        return new Response(JSON.stringify({ error: 'Payment cannot be approved before its due date.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    // --- End Due Date Check ---

    if (action === 'approve') {
      // 1. Update payment status to 'completed' and set approved_at timestamp
      const { error: paymentUpdateError } = await supabaseAdmin
        .from('payments')
        .update({ status: 'completed', approved_at: new Date().toISOString() })
        .eq('id', paymentId);

      if (paymentUpdateError) {
        throw new Error(`Failed to update payment status: ${paymentUpdateError.message}`);
      }

      if (orderId) {
        // 2a. Order Payment: Update order payment status to 'paid'
        const { error: orderUpdateError } = await supabaseAdmin
          .from('orders')
          .update({ payment_status: 'paid' })
          .eq('id', orderId);

        if (orderUpdateError) {
          throw new Error(`Failed to update order payment status: ${orderUpdateError.message}`);
        }
        return new Response(JSON.stringify({ message: 'Order payment approved and credit freed up successfully.' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else {
        // 2b. General Payment: Update dealer_balances (reduce opening_balance by amount)
        const { data: currentBalanceData, error: fetchBalanceError } = await supabaseAdmin
          .from('dealer_balances')
          .select('opening_balance')
          .eq('dealer_id', dealerId)
          .single();

        if (fetchBalanceError && fetchBalanceError.code !== 'PGRST116') {
          throw new Error(`Failed to fetch current balance for general payment: ${fetchBalanceError.message}`);
        }

        const currentOpeningBalance = currentBalanceData?.opening_balance || 0;
        const newOpeningBalance = Math.max(0, currentOpeningBalance - amount);

        const { error: balanceUpdateError } = await supabaseAdmin
          .from('dealer_balances')
          .upsert({
            dealer_id: dealerId,
            opening_balance: newOpeningBalance,
          }, { onConflict: 'dealer_id' });

        if (balanceUpdateError) {
          throw new Error(`Failed to update dealer balance after general payment approval: ${balanceUpdateError.message}`);
        }

        return new Response(JSON.stringify({ message: 'General payment approved and dealer balance updated successfully.' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

    } else if (action === 'reject') {
      if (orderId) {
        // 1a. Order Payment: Revert order payment status to 'pending'
        const { error: orderUpdateError } = await supabaseAdmin
          .from('orders')
          .update({ payment_status: 'pending' })
          .eq('id', orderId);

        if (orderUpdateError) {
          throw new Error(`Failed to revert order payment status: ${orderUpdateError.message}`);
        }
      }
      // 2. Delete the payment record (for both order and general payments)
      const { error: paymentDeleteError } = await supabaseAdmin
        .from('payments')
        .delete()
        .eq('id', paymentId);

      if (paymentDeleteError) {
        throw new Error(`Failed to delete payment record: ${paymentDeleteError.message}`);
      }

      return new Response(JSON.stringify({ message: `Payment rejected and record deleted. ${orderId ? 'Order reverted to pending.' : ''}` }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Edge Function error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});