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

    const salespersonName = `${order.profiles.first_name} ${order.profiles.last_name}`.trim();
    const dealerName = order.dealers.name;

    // 2. Fetch Notification Email List
    const { data: notificationEmails, error: emailError } = await supabaseAdmin
      .from('notification_emails')
      .select('email_address, department_name');

    if (emailError) throw new Error('Failed to fetch notification email list.');

    const recipientSet = new Set<string>();
    (notificationEmails || []).forEach((e: any) => recipientSet.add(e.email_address));
    if (order.dealers?.email) recipientSet.add(order.dealers.email);

    const recipientEmails = Array.from(recipientSet);

    if (recipientEmails.length === 0) {
      return new Response(JSON.stringify({ message: 'No recipients found.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Construct Email
    const emailSubject = `New Order: #${order.order_number} - ${salespersonName} - ${dealerName}`;
    const itemsList = (order.sales || []).map((s: any) => 
      `<li><strong>${s.products.name} (${s.products.code})</strong>: ${s.quantity} units (₹${s.total_price.toFixed(2)})</li>`
    ).join('');

    const htmlContent = `
      <h2>New Order Notification</h2>
      <p>A new order has been placed and requires processing.</p>
      <hr/>
      <p><strong>Order Number:</strong> #${order.order_number}</p>
      <p><strong>Sales Person:</strong> ${salespersonName}</p>
      <p><strong>Dealer:</strong> ${dealerName} (${order.dealers.phone || 'N/A'})</p>
      <p><strong>Date:</strong> ${new Date(order.order_date).toLocaleString()}</p>
      <p><strong>Total Amount:</strong> ₹${order.total_amount.toFixed(2)}</p>
      <h3>Items:</h3>
      <ul>${itemsList}</ul>
      <hr/>
      <p><small>This is an automated notification sent to configured departments.</small></p>
    `;

    // 4. Send via Resend API
    // @ts-ignore
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    
    if (!resendApiKey) {
      console.error("[send-order-notification] RESEND_API_KEY not set in Supabase Secrets.");
      return new Response(JSON.stringify({ error: 'Email service not configured.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: 'Orders <onboarding@resend.dev>', // Replace with your verified domain later
        to: recipientEmails,
        subject: emailSubject,
        html: htmlContent,
      }),
    });

    const resData = await res.json();
    console.log("[send-order-notification] Resend Response:", resData);

    return new Response(JSON.stringify({ message: 'Email sent successfully', data: resData }), {
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