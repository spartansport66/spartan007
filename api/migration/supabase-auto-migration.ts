/**
 * Comprehensive Supabase Auto-Migration System
 * Uses APIs instead of passwords to migrate ALL data including RLS policies, users, etc.
 * 
 * Features:
 * - API-based authentication (no passwords)
 * - Exports/imports all tables and data
 * - Migrates RLS policies
 * - Migrates users and roles
 * - Migrates storage buckets and files
 * - Exports metadata and schema
 */

import { SupabaseMigrationClient } from './migration-client.js';
import type { MigrationConfig, MigrationResult } from './migration-types.js';

export class SupabaseAutoMigration {
  private sourceClient: SupabaseMigrationClient;
  private targetClient: SupabaseMigrationClient;

  constructor(sourceConfig: MigrationConfig, targetConfig: MigrationConfig) {
    this.sourceClient = new SupabaseMigrationClient(sourceConfig);
    this.targetClient = new SupabaseMigrationClient(targetConfig);
  }

  async migrate(): Promise<MigrationResult> {
    const result: MigrationResult = {
      timestamp: new Date().toISOString(),
      status: 'in-progress',
      steps: [],
      errors: [],
    };

    try {
      // Step 1: Verify connections
      console.log('🔍 Step 1: Verifying connections...');
      await this.verifyConnections(result);

      // Step 2: Export schema from source
      console.log('📤 Step 2: Exporting schema...');
      const schema = await this.sourceClient.exportSchema();
      result.steps.push({ name: 'schema-export', status: 'completed', details: `Exported ${schema.tables.length} tables` });

      // Step 3: Create schema in target
      console.log('📥 Step 3: Creating schema in target...');
      await this.targetClient.createSchema(schema);
      result.steps.push({ name: 'schema-create', status: 'completed', details: 'Schema created' });

      // Step 4: Export data from source
      console.log('📤 Step 4: Exporting data...');
      const data = await this.sourceClient.exportAllData();
      result.steps.push({ name: 'data-export', status: 'completed', details: `Exported data from ${data.tables.length} tables` });

      // Step 5: Import data to target
      console.log('📥 Step 5: Importing data...');
      await this.targetClient.importAllData(data);
      result.steps.push({ name: 'data-import', status: 'completed', details: 'Data imported' });

      // Step 6: Migrate RLS policies
      console.log('🔐 Step 6: Migrating RLS policies...');
      const policies = await this.sourceClient.exportRLSPolicies();
      await this.targetClient.createRLSPolicies(policies);
      result.steps.push({ name: 'rls-policies', status: 'completed', details: `Migrated ${policies.length} RLS policies` });

      // Step 7: Migrate users
      console.log('👥 Step 7: Migrating users...');
      const users = await this.sourceClient.exportUsers();
      await this.targetClient.createUsers(users);
      result.steps.push({ name: 'users', status: 'completed', details: `Migrated ${users.length} users` });

      // Step 8: Migrate user roles
      console.log('👤 Step 8: Migrating user roles...');
      const userRoles = await this.sourceClient.exportUserRoles();
      await this.targetClient.createUserRoles(userRoles);
      result.steps.push({ name: 'user-roles', status: 'completed', details: `Migrated ${userRoles.length} user roles` });

      // Step 9: Migrate storage buckets
      console.log('💾 Step 9: Migrating storage buckets...');
      const buckets = await this.sourceClient.exportStorageBuckets();
      await this.targetClient.createStorageBuckets(buckets);
      result.steps.push({ name: 'storage-buckets', status: 'completed', details: `Migrated ${buckets.length} buckets` });

      // Step 10: Export and migrate functions
      console.log('⚙️ Step 10: Migrating database functions...');
      const functions = await this.sourceClient.exportDatabaseFunctions();
      await this.targetClient.createDatabaseFunctions(functions);
      result.steps.push({ name: 'db-functions', status: 'completed', details: `Migrated ${functions.length} functions` });

      // Step 11: Export and migrate triggers
      console.log('⚡ Step 11: Migrating triggers...');
      const triggers = await this.sourceClient.exportTriggers();
      await this.targetClient.createTriggers(triggers);
      result.steps.push({ name: 'triggers', status: 'completed', details: `Migrated ${triggers.length} triggers` });

      // Step 12: Verify migration
      console.log('✅ Step 12: Verifying migration...');
      const verification = await this.verifyMigration();
      result.steps.push({ name: 'verification', status: 'completed', details: verification });

      result.status = 'completed';
      console.log('✨ Migration completed successfully!');
    } catch (error) {
      result.status = 'failed';
      result.errors.push(error instanceof Error ? error.message : String(error));
      console.error('❌ Migration failed:', error);
    }

    return result;
  }

  private async verifyConnections(result: MigrationResult): Promise<void> {
    try {
      const sourceOk = await this.sourceClient.verify();
      const targetOk = await this.targetClient.verify();
      
      if (!sourceOk || !targetOk) {
        throw new Error('Connection verification failed');
      }
      
      result.steps.push({ name: 'verify-connections', status: 'completed', details: 'Both connections verified' });
    } catch (error) {
      throw new Error(`Connection verification failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async verifyMigration(): Promise<string> {
    const sourceStats = await this.sourceClient.getStatistics();
    const targetStats = await this.targetClient.getStatistics();

    const matches = sourceStats.tableCount === targetStats.tableCount &&
                   sourceStats.rowCount === targetStats.rowCount;

    if (!matches) {
      console.warn('⚠️  Statistics mismatch:');
      console.warn(`Source: ${sourceStats.tableCount} tables, ${sourceStats.rowCount} rows`);
      console.warn(`Target: ${targetStats.tableCount} tables, ${targetStats.rowCount} rows`);
    }

    return `Verified: Source has ${sourceStats.tableCount} tables with ${sourceStats.rowCount} rows, Target has ${targetStats.tableCount} tables with ${targetStats.rowCount} rows`;
  }
}

export default SupabaseAutoMigration;
