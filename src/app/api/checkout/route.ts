import { NextResponse } from 'next/server';
import { supabase } from '@/integrations/supabase/supabaseServer';
import { CartItem } from '@/types/cart';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      userId,
      cartItems,
      customerName,
      customerPhone,
      paymentMethod,
      discount,
      discountType,
    }: {
      userId: string;
      cartItems: CartItem[];
      customerName: string;
      customerPhone: string;
      paymentMethod: string;
      discount: number;
      discountType: 'percentage' | 'fixed';
    } = body;

    // 1. Validate input
    if (!userId || !cartItems || cartItems.length === 0 || !customerName || !customerPhone || !paymentMethod) {
      return NextResponse.json({ error: 'Missing required fields for checkout.' }, { status: 400 });
    }

    // 2. Calculate subtotal from cart items
    const subtotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

    // 3. Calculate discount amount
    let discountAmount = 0;
    if (discount > 0) {
      if (discountType === 'percentage') {
        discountAmount = (subtotal * discount) / 100;
      } else { // 'fixed'
        discountAmount = discount;
      }
    }
    
    // Ensure discount doesn't exceed subtotal
    if (discountAmount > subtotal) {
        discountAmount = subtotal;
    }

    // 4. Calculate the final total amount (post-discount)
    const total_amount = subtotal - discountAmount;

    // 5. Insert the order into the 'orders' table with the CORRECT total
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        customer_name: customerName,
        customer_phone: customerPhone,
        payment_method: paymentMethod,
        subtotal: subtotal,
        discount: discountAmount,
        total_amount: total_amount, // Using the corrected post-discount total
        status: 'Completed', 
      })
      .select()
      .single();

    if (orderError || !orderData) {
      console.error('Supabase order insertion error:', orderError);
      throw new Error(`Failed to create order: ${orderError?.message}`);
    }

    const orderId = orderData.id;

    // 6. Prepare and insert order items
    const orderItems = cartItems.map(item => ({
      order_id: orderId,
      menu_item_id: item.id,
      quantity: item.quantity,
      price: item.price,
    }));

    const { error: itemsError } = await supabase.from('order_items').insert(orderItems);

    if (itemsError) {
      console.error('Supabase order items insertion error:', itemsError);
      // If items fail, we should ideally roll back the order insertion,
      // but for now, we'll log the error and flag the issue.
      throw new Error(`Order created but failed to add items: ${itemsError.message}`);
    }

    // 7. Return success response
    return NextResponse.json({ success: true, orderId: orderId }, { status: 200 });

  } catch (error: any) {
    console.error('Checkout process failed:', error);
    return NextResponse.json({ error: error.message || 'An unexpected error occurred during checkout.' }, { status: 500 });
  }
}