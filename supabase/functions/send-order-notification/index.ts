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

    // 1. Fetch Order Details with Salesperson and Dealer info
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

    // 2. Fetch Notification Email List (All departments including Warehouse / Order Prep)
    const { data: notificationEmails, error: emailError } = await supabaseAdmin
      .from('notification_emails')
      .select('email_address, department_name');

    if (emailError) throw new Error('Failed to fetch notification email list.');

    // Collect all unique recipient emails
    const recipientSet = new Set<string>();
    
    // Add all configured department emails
    (notificationEmails || []).forEach((e: any) => {
      recipientSet.add(e.email_address);
    });

    // Also add dealer email if available
    if (order.dealers?.email) {
      recipientSet.add(order.dealers.email);
    }

    const recipientEmails = Array.from(recipientSet);

    if (recipientEmails.length === 0) {
      console.log("[send-order-notification] No recipients found. Email skipped.");
      return new Response(JSON.stringify({ message: 'No recipients found. Email skipped.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Construct Email Content as requested
    // Subject: Order No, Salesperson Name, Dealer Name
    const emailSubject = `New Order: #${order.order_number} - ${salespersonName} - ${dealerName}`;
    
    const itemsList = (order.sales || []).map((s: any) => 
      `- ${s.products.name} (${s.products.code}): ${s.quantity} units (Total: ₹${s.total_price.toFixed(2)})`
    ).join('\n');

    const emailBody = `
      A new order has been placed and requires processing.

      Order Summary:
      --------------
      Order Number: #${order.order_number}
      Sales Person: ${salespersonName}
      Dealer: ${dealerName} (${order.dealers.phone || 'N/A'})
      Date: ${new Date(order.order_date).toLocaleString()}
      Total Amount: ₹${order.total_amount.toFixed(2)}

      Items:
      ------
      ${itemsList}

      This notification has been sent to the following departments:
      ${[...new Set(notificationEmails.map((e: any) => e.department_name))].join(', ')}

      Please log in to the dashboard to view the full details and generate the official PDF.
    `;

    // Log the attempt (Real sending requires an API key for Resend/SendGrid)
    console.log(`[send-order-notification] Triggering email for Order #${order.order_number}`);
    console.log(`[send-order-notification] Recipients: ${recipientEmails.join(', ')}`);
    console.log(`[send-order-notification] Subject: ${emailSubject}`);

    return new Response(JSON.stringify({ 
      message: 'Notification process triggered.',
      subject: emailSubject,
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