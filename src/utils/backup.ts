import { supabase } from '@/integrations/supabase/client';
import { FULL_SCHEMA_SQL } from './schema-dump';

/**
 * List of all tables to be included in the backup, ordered by dependency.
 */
const TABLES_TO_BACKUP = [
  'profiles',
  'categories',
  'suppliers',
  'raw_materials',
  'online_platforms',
  'company_info',
  'notification_emails',
  'dealers',
  'dealer_balances',
  'dealer_sales_persons',
  'dealer_monthly_credit_limits',
  'products',
  'bill_of_materials',
  'orders',
  'online_order_details',
  'sales',
  'payments',
  'payment_allocations',
  'sales_person_visits',
  'sales_targets',
  'combo_offers',
  'combo_offer_products',
  'combo_offer_dealers',
  'purchase_orders',
  'purchase_order_items',
  'purchase_vouchers',
  'purchase_voucher_items',
  'sales_returns',
  'online_order_staging',
  'login_logs',
  'user_activity_logs',
  'whatsapp_sent_logs',
  'production_orders',
  'production_alerts',
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
      const { data, error } = await supabase
        .from(tableName)
        .select('*');

      if (error) {
        console.error(`Error backing up table ${tableName}:`, error.message);
        backup.tables[tableName] = [];
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
 * Generates a full SQL script containing the schema and data inserts.
 */
export const generateSqlDump = async (onProgress?: (table: string, index: number, total: number) => void): Promise<string> => {
  const backup = await generateFullBackup(onProgress);
  let sql = `-- Spartan ERP Full Database Dump\n`;
  sql += `-- Generated on: ${new Date().toLocaleString()}\n\n`;
  
  // 1. Add the Schema
  sql += `-- ==========================================\n`;
  sql += `-- SCHEMA DEFINITION\n`;
  sql += `-- ==========================================\n\n`;
  sql += FULL_SCHEMA_SQL;
  sql += `\n\n`;

  // 2. Add the Data Inserts
  sql += `-- ==========================================\n`;
  sql += `-- DATA INSERTS\n`;
  sql += `-- ==========================================\n\n`;
  sql += `SET session_replication_role = 'replica'; -- Disable triggers/constraints during import\n\n`;

  for (const tableName of TABLES_TO_BACKUP) {
    const rows = backup.tables[tableName];
    if (!rows || rows.length === 0) continue;

    sql += `-- Data for table: ${tableName}\n`;
    
    // Get columns from the first row
    const columns = Object.keys(rows[0]);
    const columnList = columns.join(', ');

    // Process rows in chunks to avoid massive single statements
    const chunkSize = 100;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      sql += `INSERT INTO public.${tableName} (${columnList}) VALUES\n`;
      
      const valuesList = chunk.map(row => {
        const values = columns.map(col => {
          const val = row[col];
          if (val === null || val === undefined) return 'NULL';
          if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
          if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
          return val;
        });
        return `(${values.join(', ')})`;
      }).join(',\n');

      sql += valuesList + `\nON CONFLICT DO NOTHING;\n\n`;
    }
  }

  sql += `SET session_replication_role = 'origin'; -- Re-enable triggers/constraints\n`;
  
  return sql;
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

/**
 * Triggers a browser download of the SQL dump file.
 */
export const downloadSqlDumpFile = (sql: string) => {
  const blob = new Blob([sql], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  link.href = url;
  link.download = `Spartan_Full_Dump_${dateStr}.sql`;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};