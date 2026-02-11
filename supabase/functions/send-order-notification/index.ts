// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { orderId } = await req.json();

    if (!orderId) {
      return new Response(JSON.stringify({ error: 'Order ID is required.' }), {
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

    // 1. Fetch Order Details
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select(`
        order_number,
        total_amount,
        order_date,
        dealers (name, email, phone),
        profiles:user_id (first_name, last_name),
        sales (quantity, total_price, products (name, code))
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) throw new Error('Failed to fetch order details for email.');

    // 2. Fetch Notification Email List
    const { data: notificationEmails, error: emailError } = await supabaseAdmin
      .from('notification_emails')
      .select('email_address');

    if (emailError) throw new Error('Failed to fetch notification email list.');

    const recipientEmails = (notificationEmails || []).map((e: any) => e.email_address);
    if (order.dealers?.email) {
      recipientEmails.push(order.dealers.email);
    }

    if (recipientEmails.length === 0) {
      return new Response(JSON.stringify({ message: 'No recipients found. Email skipped.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Construct Email Body (Text version for now)
    const itemsList = (order.sales || []).map((s: any) => 
      `- ${s.products.name} (${s.products.code}): ${s.quantity} units (Total: ₹${s.total_price.toFixed(2)})`
    ).join('\n');

    const emailSubject = `New Order Placed: #${order.order_number} - ${order.dealers.name}`;
    const emailBody = `
      A new order has been placed in the system.

      Order Details:
      --------------
      Order Number: #${order.order_number}
      Date: ${new Date(order.order_date).toLocaleString()}
      Dealer: ${order.dealers.name} (${order.dealers.phone || 'N/A'})
      Sales Person: ${order.profiles.first_name} ${order.profiles.last_name}
      Total Amount: ₹${order.total_amount.toFixed(2)}

      Items:
      ------
      ${itemsList}

      Please log in to the dashboard to process this order.
    `;

    // NOTE: To send real emails, you would integrate with a provider like Resend, SendGrid, or Mailgun here.
    // For now, we log the attempt. You can add your API key to Supabase Secrets to enable real sending.
    console.log(`[send-order-notification] Sending email to: ${recipientEmails.join(', ')}`);
    console.log(`[send-order-notification] Subject: ${emailSubject}`);

    return new Response(JSON.stringify({ 
      message: 'Notification process triggered.',
      recipients: recipientEmails 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("[send-order-notification] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})