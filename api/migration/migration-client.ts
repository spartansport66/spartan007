/**
 * Supabase Migration Client
 * Handles all API communication for migration operations
 */

import { createClient } from '@supabase/supabase-js';
import type {
  MigrationConfig,
  TableSchema,
  RLSPolicy,
  User,
  UserRole,
  StorageBucket,
  DatabaseFunction,
  Trigger,
  SchemaExport,
  DataExport,
  Statistics,
} from './migration-types.js';

export class SupabaseMigrationClient {
  private config: MigrationConfig;
  private supabaseUrl: string;
  private supabaseKey: string;

  constructor(config: MigrationConfig) {
    this.config = config;
    this.supabaseUrl = `https://${config.projectId}.supabase.co`;
    this.supabaseKey = config.apiKey;
  }

  async verify(): Promise<boolean> {
    try {
      const response = await fetch(`${this.supabaseUrl}/rest/v1/`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      return response.ok;
    } catch (error) {
      console.error('Verification failed:', error);
      return false;
    }
  }

  async exportSchema(): Promise<SchemaExport> {
    console.log('Exporting schema from source...');
    
    const query = `
      SELECT
        table_name,
        table_schema,
        table_type
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'pgbench')
      ORDER BY table_name;
    `;

    const tables: TableSchema[] = [];
    
    // Query using the REST API to get table definitions
    const response = await fetch(`${this.supabaseUrl}/rest/v1/rpc/get_schema`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({}),
    }).catch(() => null);

    // Fallback: Get tables from information_schema
    const tablesData = await this.executeQuery(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    );

    for (const tableRow of tablesData || []) {
      const tableName = (tableRow as any).table_name;
      const columns = await this.getTableColumns(tableName);
      const indexes = await this.getTableIndexes(tableName);
      
      tables.push({
        name: tableName,
        columns,
        indexes,
      });
    }

    return { tables };
  }

  async createSchema(schema: SchemaExport): Promise<void> {
    console.log('Creating schema in target...');
    
    for (const table of schema.tables) {
      for (const index of table.indexes || []) {
        try {
          await this.executeQuery(index.definition);
        } catch (error) {
          // Index might already exist
          console.warn(`Could not create index ${index.name}:`, error);
        }
      }
    }
  }

  async exportAllData(): Promise<DataExport> {
    console.log('Exporting all data...');
    
    const tablesData: Record<string, any[]> = {};
    
    // Get list of all public tables
    const tablesResult = await this.executeQuery(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
    );

    for (const tableRow of tablesResult || []) {
      const tableName = (tableRow as any).table_name;
      try {
        const response = await fetch(`${this.supabaseUrl}/rest/v1/${tableName}?limit=500000`, {
          method: 'GET',
          headers: this.getHeaders(),
        });
        
        if (response.ok) {
          tablesData[tableName] = await response.json();
        }
      } catch (error) {
        console.error(`Failed to export data from ${tableName}:`, error);
      }
    }

    return { tables: Object.entries(tablesData).map(([name, data]) => ({ name, data })) };
  }

  async importAllData(data: DataExport): Promise<void> {
    console.log('Importing all data...');
    
    for (const table of data.tables) {
      if (table.data.length === 0) continue;
      
      try {
        await fetch(`${this.supabaseUrl}/rest/v1/${table.name}`, {
          method: 'POST',
          headers: { ...this.getHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify(table.data),
        });
      } catch (error) {
        console.error(`Failed to import data to ${table.name}:`, error);
      }
    }
  }

  async exportRLSPolicies(): Promise<RLSPolicy[]> {
    console.log('Exporting RLS policies...');
    
    const query = `
      SELECT
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        qual,
        with_check
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname;
    `;

    const policies: RLSPolicy[] = [];
    const result = await this.executeQuery(query);

    for (const row of result || []) {
      policies.push({
        table: (row as any).tablename,
        name: (row as any).policyname,
        definition: this.generatePolicySQL(row as any),
      });
    }

    return policies;
  }

  async createRLSPolicies(policies: RLSPolicy[]): Promise<void> {
    console.log('Creating RLS policies...');
    
    for (const policy of policies) {
      try {
        // First check if policy exists and delete it
        await this.executeQuery(
          `DROP POLICY IF EXISTS "${policy.name}" ON public.${policy.table};`
        ).catch(() => null);
        
        // Create the policy
        await this.executeQuery(policy.definition);
      } catch (error) {
        console.warn(`Could not create policy ${policy.name}:`, error);
      }
    }
  }

  async exportUsers(): Promise<User[]> {
    console.log('Exporting users...');
    
    const response = await fetch(`${this.supabaseUrl}/auth/v1/admin/users`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.supabaseKey}`,
        'apikey': this.supabaseKey,
      },
    });

    if (!response.ok) {
      console.warn('Could not export users via Admin API');
      return [];
    }

    const { users = [] } = await response.json();
    return users.map((user: any) => ({
      id: user.id,
      email: user.email,
      phone: user.phone,
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at,
      metadata: user.user_metadata,
    }));
  }

  async createUsers(users: User[]): Promise<void> {
    console.log('Creating users...');
    
    for (const user of users) {
      try {
        const response = await fetch(`${this.supabaseUrl}/auth/v1/admin/users`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.supabaseKey}`,
            'apikey': this.supabaseKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: user.email,
            phone: user.phone,
            user_metadata: user.metadata,
            email_confirm: true,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          if (error.code === 'user_already_exists') {
            console.log(`User ${user.email} already exists`);
          } else {
            console.error(`Failed to create user ${user.email}:`, error);
          }
        }
      } catch (error) {
        console.error(`Error creating user ${user.email}:`, error);
      }
    }
  }

  async exportUserRoles(): Promise<UserRole[]> {
    console.log('Exporting user roles...');
    
    try {
      const response = await fetch(`${this.supabaseUrl}/rest/v1/user_roles?limit=500000`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.warn('Could not export user roles:', error);
    }

    return [];
  }

  async createUserRoles(roles: UserRole[]): Promise<void> {
    console.log('Creating user roles...');
    
    if (roles.length === 0) return;

    try {
      await fetch(`${this.supabaseUrl}/rest/v1/user_roles`, {
        method: 'POST',
        headers: { ...this.getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(roles),
      });
    } catch (error) {
      console.error('Failed to create user roles:', error);
    }
  }

  async exportStorageBuckets(): Promise<StorageBucket[]> {
    console.log('Exporting storage buckets...');
    
    const client = createClient(this.supabaseUrl, this.supabaseKey);
    const { data: buckets = [], error } = await client.storage.listBuckets();

    if (error) {
      console.warn('Could not export storage buckets:', error);
      return [];
    }

    return buckets.map(bucket => ({
      name: bucket.name,
      public: bucket.public,
      id: bucket.id,
    }));
  }

  async createStorageBuckets(buckets: StorageBucket[]): Promise<void> {
    console.log('Creating storage buckets...');
    
    const client = createClient(this.supabaseUrl, this.supabaseKey);

    for (const bucket of buckets) {
      try {
        await client.storage.createBucket(bucket.name, {
          public: bucket.public,
        });
      } catch (error) {
        console.warn(`Could not create bucket ${bucket.name}:`, error);
      }
    }
  }

  async exportDatabaseFunctions(): Promise<DatabaseFunction[]> {
    console.log('Exporting database functions...');
    
    const query = `
      SELECT
        routine_name,
        routine_definition,
        routine_type,
        routine_schema
      FROM information_schema.routines
      WHERE routine_schema = 'public'
      ORDER BY routine_name;
    `;

    const functions: DatabaseFunction[] = [];
    const result = await this.executeQuery(query);

    for (const row of result || []) {
      functions.push({
        name: (row as any).routine_name,
        definition: (row as any).routine_definition,
        type: (row as any).routine_type,
      });
    }

    return functions;
  }

  async createDatabaseFunctions(functions: DatabaseFunction[]): Promise<void> {
    console.log('Creating database functions...');
    
    for (const func of functions) {
      try {
        await this.executeQuery(func.definition);
      } catch (error) {
        console.warn(`Could not create function ${func.name}:`, error);
      }
    }
  }

  async exportTriggers(): Promise<Trigger[]> {
    console.log('Exporting triggers...');
    
    const query = `
      SELECT
        trigger_name,
        event_object_table,
        trigger_definition
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
      ORDER BY trigger_name;
    `;

    const triggers: Trigger[] = [];
    const result = await this.executeQuery(query);

    for (const row of result || []) {
      triggers.push({
        name: (row as any).trigger_name,
        table: (row as any).event_object_table,
        definition: (row as any).trigger_definition,
      });
    }

    return triggers;
  }

  async createTriggers(triggers: Trigger[]): Promise<void> {
    console.log('Creating triggers...');
    
    for (const trigger of triggers) {
      try {
        await this.executeQuery(trigger.definition);
      } catch (error) {
        console.warn(`Could not create trigger ${trigger.name}:`, error);
      }
    }
  }

  async getStatistics(): Promise<Statistics> {
    const tablesResult = await this.executeQuery(
      `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
    );
    
    const tableCount = tablesResult?.[0]?.count || 0;

    let rowCount = 0;
    const tables = await this.executeQuery(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
    );

    for (const tableRow of tables || []) {
      const tableName = (tableRow as any).table_name;
      const result = await this.executeQuery(
        `SELECT COUNT(*) as count FROM public."${tableName}"`
      ).catch(() => null);
      rowCount += result?.[0]?.count || 0;
    }

    return { tableCount, rowCount };
  }

  private getHeaders(): HeadersInit {
    return {
      'Authorization': `Bearer ${this.supabaseKey}`,
      'apikey': this.supabaseKey,
      'Content-Type': 'application/json',
    };
  }

  private async executeQuery(query: string): Promise<any[]> {
    try {
      // Try using Supabase client with service role key for raw SQL execution
      const client = createClient(this.supabaseUrl, this.supabaseKey);
      
      // Use the SQL API endpoint directly for raw query execution
      const response = await fetch(`${this.supabaseUrl}/rest/v1/rpc/execute_sql`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ sql: query }),
      });

      if (!response.ok) {
        // If custom RPC fails, try the raw SQL endpoint (for newer Supabase versions)
        try {
          const sqlResponse = await fetch(`${this.supabaseUrl}/rest/v1/__execute_sql`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ query }),
          });
          
          if (sqlResponse.ok) {
            return await sqlResponse.json();
          }
        } catch (altError) {
          // Silently try alternative
        }

        // Fallback: If query seems like a SELECT, use REST API
        if (query.trim().toUpperCase().startsWith('SELECT')) {
          // Can't execute arbitrary SELECT through REST API
          console.error(`❌ Cannot execute SELECT query without SQL API: ${query.substring(0, 50)}...`);
          throw new Error('SQL query execution not available. Please ensure execute_query RPC function exists.');
        }
        
        const errorText = await response.text();
        throw new Error(`Query failed: ${errorText}`);
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [data];
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ Query execution error: ${errorMsg}`);
      console.error(`  Query: ${query.substring(0, 100)}...`);
      
      // Don't silently fail - propagate error so migration knows it failed
      throw new Error(`Query execution failed: ${errorMsg}`);
    }
  }

  private async getTableColumns(tableName: string): Promise<any[]> {
    const query = `
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = '${tableName}'
      ORDER BY ordinal_position;
    `;
    
    return await this.executeQuery(query) || [];
  }

  private async getTableIndexes(tableName: string): Promise<any[]> {
    const query = `
      SELECT
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = '${tableName}';
    `;
    
    const result = await this.executeQuery(query) || [];
    return result.map((idx: any) => ({
      name: idx.indexname,
      definition: idx.indexdef,
    }));
  }

  private generatePolicySQL(policy: any): string {
    let sql = `CREATE POLICY "${policy.policyname}" ON public."${policy.tablename}"`;
    
    if (policy.permissive === false) {
      sql += ' AS RESTRICTIVE';
    } else {
      sql += ' AS PERMISSIVE';
    }

    if (policy.qual) {
      sql += ` USING (${policy.qual})`;
    }

    if (policy.with_check) {
      sql += ` WITH CHECK (${policy.with_check})`;
    }

    sql += ';';
    return sql;
  }
}

export default SupabaseMigrationClient;
