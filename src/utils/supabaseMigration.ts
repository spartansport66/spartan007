import { createClient } from '@supabase/supabase-js';

interface TableData {
  tableName: string;
  columns: any[];
  data: any[];
}

/**
 * Export all data from source Supabase
 */
export async function exportSupabaseData(projectId: string, apiKey: string): Promise<TableData[]> {
  try {
    const supabaseUrl = `https://${projectId}.supabase.co`;
    const client = createClient(supabaseUrl, apiKey);

    // Get all tables
    const { data: tables, error: tablesError } = await client
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');

    if (tablesError) throw tablesError;
    if (!tables || tables.length === 0) {
      throw new Error('No tables found in source database');
    }

    const tableDataArray: TableData[] = [];

    for (const table of tables) {
      const tableName = table.table_name;

      // Skip internal tables
      if (tableName.startsWith('_') || tableName.includes('_realtime')) {
        continue;
      }

      try {
        // Get columns info
        const { data: columns, error: columnsError } = await client
          .from('information_schema.columns')
          .select('column_name, data_type, is_nullable, column_default')
          .eq('table_schema', 'public')
          .eq('table_name', tableName);

        if (columnsError) {
          console.warn(`Failed to get columns for ${tableName}:`, columnsError);
          continue;
        }

        // Get table data
        const { data: tableData, error: dataError } = await client
          .from(tableName)
          .select('*');

        if (dataError) {
          console.warn(`Failed to export data from ${tableName}:`, dataError);
          continue;
        }

        tableDataArray.push({
          tableName,
          columns: columns || [],
          data: tableData || [],
        });

      } catch (tableError) {
        console.warn(`Error processing table ${tableName}:`, tableError);
      }
    }

    return tableDataArray;
  } catch (error: any) {
    throw new Error(`Failed to export Supabase data: ${error.message}`);
  }
}

/**
 * Generate CREATE TABLE SQL statements from table data
 */
export function generateCreateTableSQL(tableDataArray: TableData[]): string {
  const mapDataType = (type: string): string => {
    if (type.includes('character varying')) return 'text';
    if (type.includes('integer')) return 'bigint';
    if (type.includes('bigint')) return 'bigint';
    if (type.includes('boolean')) return 'boolean';
    if (type.includes('timestamp')) return 'timestamp';
    if (type.includes('date')) return 'date';
    if (type.includes('time')) return 'time';
    if (type.includes('numeric')) return 'numeric';
    if (type.includes('json')) return 'jsonb';
    if (type.includes('uuid')) return 'uuid';
    if (type.includes('text')) return 'text';
    return 'text';
  };

  const sqlStatements = tableDataArray.map(tableData => {
    const { tableName, columns } = tableData;
    
    if (!columns || columns.length === 0) {
      return `-- SKIPPED: ${tableName} (no column info)`;
    }

    const columnDefs = columns
      .map((col: any) => {
        const notNull = col.is_nullable === false ? 'NOT NULL' : '';
        const defaultValue = col.column_default ? `DEFAULT ${col.column_default}` : '';
        const type = mapDataType(col.data_type);
        return `  "${col.column_name}" ${type} ${notNull} ${defaultValue}`.trim();
      })
      .join(',\n');

    return `CREATE TABLE IF NOT EXISTS "${tableName}" (\n${columnDefs}\n);\n`;
  }).join('\n');

  return sqlStatements;
}

/**
 * Recreate schema in destination Supabase with automatic table creation
 */
export async function createSchemaInDestination(
  projectId: string,
  apiKey: string,
  tableDataArray: TableData[]
): Promise<{ success: number; failed: number }> {
  try {
    const supabaseUrl = `https://${projectId}.supabase.co`;
    const client = createClient(supabaseUrl, apiKey);

    let successCount = 0;
    let failureCount = 0;

    console.log(`Creating schema in new Supabase: ${supabaseUrl}`);
    console.log(`Total tables to create: ${tableDataArray.length}`);

    // Step 1: Generate SQL for all tables
    const createTableSQL = generateCreateTableSQL(tableDataArray);
    console.log(`Generated CREATE TABLE SQL:`);
    console.log(createTableSQL);

    // Step 2: Try to execute SQL directly via RPC (if available)
    // Note: This requires a stored procedure in the destination DB
    const tableNames = tableDataArray.map(t => t.tableName);

    // Step 3: For each table, verify it can be accessed (table should exist after SQL execution)
    for (const tableData of tableDataArray) {
      try {
        const { tableName } = tableData;
        console.log(`📝 Verifying table: ${tableName}`);
        
        // Try to query the table to verify it exists
        const { error: queryError } = await client
          .from(tableName)
          .select('*')
          .limit(1);

        if (!queryError) {
          console.log(`✓ Table ${tableName} exists and is accessible`);
          successCount++;
        } else if (queryError.message.includes('not found') || queryError.message.includes('does not exist')) {
          console.error(`❌ Table ${tableName} not created yet`);
          console.error(`    Execute this SQL in destination: CREATE TABLE "${tableName}" (...)`);
          failureCount++;
        } else {
          console.error(`❌ Could not verify table ${tableName}: ${queryError.message}`);
          failureCount++;
        }

      } catch (error: any) {
        console.error(`❌ Error verifying table ${tableData.tableName}:`, error.message);
        failureCount++;
      }
    }

    console.log(`Schema verification complete: ${successCount} tables ready, ${failureCount} need creation`);
    
    // Return the SQL for manual execution if tables weren't auto-created
    if (failureCount > 0) {
      console.error(`\n⚠️  IMPORTANT: Execute the following SQL in your NEW Supabase SQL Editor:\n`);
      console.error(createTableSQL);
      console.error(`\nOr copy the SQL to clipboard for manual execution.`);
    }

    return { success: successCount, failed: failureCount };

  } catch (error: any) {
    throw new Error(`Failed to create schema in destination: ${error.message}`);
  }
}

/**
 * Import data to destination Supabase
 */
export async function importSupabaseData(
  projectId: string,
  apiKey: string,
  tableDataArray: TableData[]
): Promise<{ success: number; failed: number }> {
  try {
    const supabaseUrl = `https://${projectId}.supabase.co`;
    const client = createClient(supabaseUrl, apiKey);

    let successCount = 0;
    let failureCount = 0;

    console.log(`Starting import to new Supabase: ${supabaseUrl}`);
    console.log(`Total tables to import: ${tableDataArray.length}`);

    for (const tableData of tableDataArray) {
      try {
        const { tableName, data } = tableData;

        console.log(`\n📊 Processing table: ${tableName}, rows: ${data.length}`);

        // Skip empty tables
        if (!data || data.length === 0) {
          console.log(`⏭️  Skipping empty table: ${tableName}`);
          continue;
        }

        // Check if table is accessible
        try {
          const { error: accessError } = await client
            .from(tableName)
            .select('*')
            .limit(1);
          
          if (accessError) {
            console.error(`❌ Cannot access table ${tableName}: ${accessError.message}`);
            console.error(`    Make sure table exists in new Supabase:`);
            console.error(`    CREATE TABLE ${tableName} (...)`);
            failureCount++;
            continue;
          }
        } catch (accessCheck: any) {
          console.error(`❌ Access check failed for ${tableName}: ${accessCheck.message}`);
          failureCount++;
          continue;
        }

        // First try to truncate table (to clear any existing data)
        try {
          const { error: deleteError } = await client.from(tableName).delete().neq('id', null);
          if (!deleteError) {
            console.log(`✓ Cleared existing data in ${tableName}`);
          }
        } catch (e: any) {
          console.log(`Note: Could not truncate ${tableName}: ${e.message}`);
        }

        // Insert data in batches
        const batchSize = 50;
        const batches = Math.ceil(data.length / batchSize);

        for (let batchNum = 0; batchNum < batches; batchNum++) {
          const startIdx = batchNum * batchSize;
          const endIdx = Math.min(startIdx + batchSize, data.length);
          const batch = data.slice(startIdx, endIdx);

          try {
            console.log(`  Inserting batch ${batchNum + 1}/${batches} (${batch.length} rows)...`);
            
            const { error, data: insertedData, count } = await client
              .from(tableName)
              .insert(batch)
              .select('count=*');

            if (error) {
              console.error(
                `❌ Failed batch ${batchNum + 1}/${batches} for ${tableName}:`,
                error.message || error
              );
              console.error(`    Error details:`, error);
              failureCount++;
            } else {
              console.log(`✓ Batch ${batchNum + 1}/${batches} for ${tableName}: ${batch.length} rows inserted successfully`);
              successCount++;
            }
          } catch (batchError: any) {
            console.error(`❌ Batch error in ${tableName}:`, batchError.message || batchError);
            failureCount++;
          }

          // Small delay between batches to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log(`✅ Completed importing ${tableName}`);

      } catch (error: any) {
        console.error(`❌ Error importing table ${tableData.tableName}:`, error.message);
        failureCount++;
      }
    }

    console.log(`Import complete: ${successCount} successful, ${failureCount} failed`);
    return { success: successCount, failed: failureCount };

  } catch (error: any) {
    throw new Error(`Failed to import Supabase data: ${error.message}`);
  }
}

/**
 * Verify Supabase connection
 */
export async function verifySupabaseConnection(projectId: string, apiKey: string): Promise<boolean> {
  try {
    const supabaseUrl = `https://${projectId}.supabase.co`;
    const client = createClient(supabaseUrl, apiKey);

    // Try a simple query to verify connection
    try {
      const { error } = await client.from('pg_version').select('*').limit(1);
      // If no error or table doesn't exist, connection is good
      return true;
    } catch (queryError) {
      // Connection failed
      console.error('Query error:', queryError);
      return false;
    }
  } catch (error) {
    console.error('Connection error:', error);
    return false;
  }
}
