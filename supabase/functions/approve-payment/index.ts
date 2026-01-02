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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { paymentId, orderId, dealerId, amount, action } = await req.json();

    if (!paymentId || !orderId || !dealerId || typeof amount !== 'number' || !['approve', 'reject'].includes(action)) {
      return new Response(JSON.stringify({ error: 'Missing or invalid parameters.' }), {
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

    // Fetch payment details to check for post-dated payments
    const { data: paymentData, error: paymentError } = await supabaseAdmin
      .from('payments')
      .select('payment_method, cheque_dd_date')
      .eq('id', paymentId)
      .single();

    if (paymentError) {
      throw new Error(`Failed to fetch payment details: ${paymentError.message}`);
    }

    // Check if payment is post-dated and if it's due
    if (paymentData.payment_method === 'Cheque/DD' && paymentData.cheque_dd_date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = new Date(paymentData.cheque_dd_date);
      dueDate.setHours(0, 0, 0, 0);

      if (dueDate > today && action === 'approve') {
        return new Response(JSON.stringify({ error: 'Post-dated payment cannot be approved before the due date.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (action === 'approve') {
      // 1. Update payment status to 'completed'
      const { error: paymentUpdateError } = await supabaseAdmin
        .from('payments')
        .update({ status: 'completed' })
        .eq('id', paymentId);

      if (paymentUpdateError) {
        throw new Error(`Failed to update payment status: ${paymentUpdateError.message}`);
      }

      // 2. Update order payment status to 'paid'
      const { error: orderUpdateError } = await supabaseAdmin
        .from('orders')
        .update({ payment_status: 'paid' })
        .eq('id', orderId);

      if (orderUpdateError) {
        throw new Error(`Failed to update order payment status: ${orderUpdateError.message}`);
      }

      // REMOVED: The logic to increase dealer's credit_limit.
      // The credit is freed up implicitly by changing the order's payment_status to 'paid',
      // as the credit calculation only considers 'pending' orders.

      return new Response(JSON.stringify({ message: 'Payment approved and credit freed up successfully.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else if (action === 'reject') {
      // 1. Revert order payment status to 'pending'
      const { error: orderUpdateError } = await supabaseAdmin
        .from('orders')
        .update({ payment_status: 'pending' })
        .eq('id', orderId);

      if (orderUpdateError) {
        throw new Error(`Failed to revert order payment status: ${orderUpdateError.message}`);
      }

      // 2. Delete the payment record
      const { error: paymentDeleteError } = await supabaseAdmin
        .from('payments')
        .delete()
        .eq('id', paymentId);

      if (paymentDeleteError) {
        throw new Error(`Failed to delete payment record: ${paymentDeleteError.message}`);
      }

      return new Response(JSON.stringify({ message: 'Payment rejected and order reverted to pending.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action.' }), {
      status: 400,
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