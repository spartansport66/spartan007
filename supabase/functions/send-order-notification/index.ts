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

  const functionName = "send-order-notification";

  try {
    const { orderId } = await req.json();
    console.log(`[${functionName}] Processing order:`, orderId);

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

    if (orderError || !order) {
      console.error(`[${functionName}] Error fetching order:`, orderError);
      throw new Error('Failed to fetch order details.');
    }

    const salespersonName = `${order.profiles.first_name} ${order.profiles.last_name}`.trim();
    const dealerName = order.dealers.name;

    // 2. Fetch Notification Email List
    const { data: notificationEmails } = await supabaseAdmin
      .from('notification_emails')
      .select('email_address');

    const recipientSet = new Set<string>();
    (notificationEmails || []).forEach((e: any) => {
      if (e.email_address) recipientSet.add(e.email_address.trim().toLowerCase());
    });
    
    if (order.dealers?.email) {
      recipientSet.add(order.dealers.email.trim().toLowerCase());
    }

    const recipientEmails = Array.from(recipientSet).map(email => ({ email }));
    
    if (recipientEmails.length === 0) {
      console.warn(`[${functionName}] No recipients found. Skipping email.`);
      return new Response(JSON.stringify({ message: 'No recipients found. Add emails in Notification Settings.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Check Brevo API Key
    // @ts-ignore
    const brevoApiKey = Deno.env.get('BREVO_API_KEY');
    if (!brevoApiKey) {
      console.error(`[${functionName}] CRITICAL: BREVO_API_KEY is missing.`);
      throw new Error('Email service API key is missing.');
    }

    // 4. Construct Email Content
    const emailSubject = `New Order: #${order.order_number} - ${salespersonName} - ${dealerName}`;
    const itemsList = (order.sales || []).map((s: any) => 
      `<li><strong>${s.products.name} (${s.products.code})</strong>: ${s.quantity} units (₹${s.total_price.toFixed(2)})</li>`
    ).join('');

    const htmlContent = `
      <h2>New Order Notification</h2>
      <p>A new order has been placed.</p>
      <hr/>
      <p><strong>Order Number:</strong> #${order.order_number}</p>
      <p><strong>Sales Person:</strong> ${salespersonName}</p>
      <p><strong>Dealer:</strong> ${dealerName}</p>
      <p><strong>Total Amount:</strong> ₹${order.total_amount.toFixed(2)}</p>
      <h3>Items:</h3>
      <ul>${itemsList}</ul>
    `;

    // 5. Send via Brevo API
    console.log(`[${functionName}] Sending to:`, recipientEmails);
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': brevoApiKey,
      },
      body: JSON.stringify({
        sender: { name: "Spartan Orders", email: "paramcomputerzone@gmail.com" }, // Must be your verified Brevo email
        to: recipientEmails,
        subject: emailSubject,
        htmlContent: htmlContent,
      }),
    });

    const resData = await res.json();

    if (!res.ok) {
      console.error(`[${functionName}] Brevo API Error:`, resData);
      throw new Error(resData.message || 'Brevo API error');
    }

    console.log(`[${functionName}] Email sent successfully via Brevo!`);
    return new Response(JSON.stringify({ message: 'Email sent successfully', id: resData.messageId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error(`[${functionName}] Error:`, error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})