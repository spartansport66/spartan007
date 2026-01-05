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

    // Fetch payment details (payment_method, cheque_dd_date)
    const { data: paymentData, error: paymentError } = await supabaseAdmin
      .from('payments')
      .select('payment_method, cheque_dd_date')
      .eq('id', paymentId)
      .single();

    if (paymentError) {
      throw new Error(`Failed to fetch payment details: ${paymentError.message}`);
    }

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
    today.setHours(0, 0, 0, 0); // Normalize today to start of day UTC

    let effectiveDueDate: Date | null = null;

    // Determine the effective due date for approval
    if (paymentData.payment_method === 'Cheque/DD' && paymentData.cheque_dd_date) {
      // For Cheque/DD, prioritize the cheque_dd_date
      effectiveDueDate = new Date(paymentData.cheque_dd_date);
      effectiveDueDate.setHours(0, 0, 0, 0); // Normalize to start of day UTC
    } else if (orderData.payment_due_date) {
      // For other payment methods, use the order's payment_due_date
      effectiveDueDate = new Date(orderData.payment_due_date);
      effectiveDueDate.setHours(0, 0, 0, 0); // Normalize to start of day UTC
    }

    // Apply the due date check if an effective due date exists and action is 'approve'
    if (action === 'approve' && effectiveDueDate && effectiveDueDate > today) {
      return new Response(JSON.stringify({ error: 'Payment cannot be approved before its due date.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'approve') {
      // 1. Update payment status to 'completed' and set approved_at timestamp
      const { error: paymentUpdateError } = await supabaseAdmin
        .from('payments')
        .update({ status: 'completed', approved_at: new Date().toISOString() }) // Set approved_at here
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