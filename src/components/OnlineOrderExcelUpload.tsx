"use client";
import React from 'react';
import ExcelUpload from '@/components/ExcelUpload';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { showError, showSuccess } from '@/utils/toast';

interface OnlineOrderExcelUploadProps {
  onUploadComplete: () => void;
}

const onlineOrderSchema = z.object({
  platform_order_number: z.string().min(1, "Order Number is required."),
  customer_name: z.string().min(1, "Customer Name is required."),
  shipping_address: z.string().optional(),
  item_name: z.string().min(1, "Item Name is required."),
  amount: z.preprocess(
    (val) => Number(String(val).replace(/[^0-9.-]+/g, "")),
    z.number().min(0, "Amount cannot be negative.")
  ),
});

const displayHeaders = [
  { key: 'platform_order_number', label: 'Order Number' },
  { key: 'customer_name', label: 'Customer Name' },
  { key: 'shipping_address', label: 'Shipping Address' },
  { key: 'item_name', label: 'Item Name' },
  { key: 'amount', label: 'Amount' },
];

const sampleData = [
  {
    "Order Number": "OD123456789",
    "Customer Name": "John Doe",
    "Shipping Address": "123 Main St, Anytown, USA",
    "Item Name": "Sample Product A",
    "Amount": 199.99,
  },
  {
    "Order Number": "OD987654321",
    "Customer Name": "Jane Smith",
    "Shipping Address": "456 Oak Ave, Otherville, USA",
    "Item Name": "Sample Product B",
    "Amount": 49.50,
  },
];

const OnlineOrderExcelUpload: React.FC<OnlineOrderExcelUploadProps> = ({ onUploadComplete }) => {
  const { user } = useSession();

  const handleUpload = async (orders: z.infer<typeof onlineOrderSchema>[]) => {
    if (!user) {
      showError("You must be logged in.");
      return;
    }

    const stagingData = orders.map(order => ({
      platform_order_number: order.platform_order_number,
      customer_name: order.customer_name,
      shipping_address: order.shipping_address,
      flipkart_item_name: order.item_name, // Map to the existing column name
      amount: order.amount,
      created_by: user.id,
      status: 'pending'
    }));

    const { error } = await supabase
      .from('online_order_staging')
      .upsert(stagingData, { onConflict: 'platform_order_number' });

    if (error) {
      throw new Error(`Failed to save to staging: ${error.message}`);
    }

    showSuccess(`Successfully staged ${orders.length} orders from Excel!`);
    onUploadComplete();
  };

  return (
    <ExcelUpload
      onUpload={handleUpload}
      sampleData={sampleData}
      sampleFileName="sample_online_orders.xlsx"
      uploadButtonText="Stage Orders from Excel"
      displayHeaders={displayHeaders}
      validationSchema={onlineOrderSchema}
    />
  );
};

export default OnlineOrderExcelUpload;