import { supabase } from '@/integrations/supabase/client';

/**
 * List of all tables to be included in the backup.
 */
const TABLES_TO_BACKUP = [
  'profiles',
  'dealers',
  'dealer_balances',
  'dealer_monthly_credit_limits',
  'dealer_sales_persons',
  'products',
  'categories',
  'orders',
  'sales',
  'payments',
  'payment_allocations',
  'sales_person_visits',
  'sales_targets',
  'combo_offers',
  'combo_offer_products',
  'combo_offer_dealers',
  'company_info',
  'notification_emails',
  'raw_materials',
  'suppliers',
  'purchase_orders',
  'purchase_order_items',
  'purchase_vouchers',
  'purchase_voucher_items',
  'sales_returns',
  'online_platforms',
  'online_order_staging',
  'online_order_details',
  'login_logs',
  'user_activity_logs',
  'whatsapp_sent_logs',
  'production_orders',
  'production_alerts',
  'bill_of_materials',
  'stock_receipts'
];

export interface BackupData {
  timestamp: string;
  version: string;
  tables: {
    [tableName: string]: any[];
  };
}

/**
 * Fetches all data from the specified tables and returns a structured backup object.
 */
export const generateFullBackup = async (onProgress?: (table: string, index: number, total: number) => void): Promise<BackupData> => {
  const backup: BackupData = {
    timestamp: new Date().toISOString(),
    version: "1.0",
    tables: {}
  };

  for (let i = 0; i < TABLES_TO_BACKUP.length; i++) {
    const tableName = TABLES_TO_BACKUP[i];
    if (onProgress) onProgress(tableName, i, TABLES_TO_BACKUP.length);

    try {
      // Fetch all rows from the table. 
      // Note: For very large tables, this might need pagination, 
      // but for standard ERP usage, a direct select is usually sufficient.
      const { data, error } = await supabase
        .from(tableName)
        .select('*');

      if (error) {
        console.error(`Error backing up table ${tableName}:`, error.message);
        backup.tables[tableName] = []; // Include empty array if error occurs
      } else {
        backup.tables[tableName] = data || [];
      }
    } catch (e) {
      console.error(`Unexpected error backing up table ${tableName}:`, e);
      backup.tables[tableName] = [];
    }
  }

  return backup;
};

/**
 * Triggers a browser download of the backup data as a JSON file.
 */
export const downloadBackupFile = (data: BackupData) => {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  link.href = url;
  link.download = `Spartan_DB_Backup_${dateStr}.json`;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};