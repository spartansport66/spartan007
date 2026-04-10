#!/usr/bin/env node

/**
 * Supabase Auto-Migration CLI
 * 
 * Usage:
 *   npm run migrate:auto -- --source <sourceProjectId> --target <targetProjectId>
 * 
 * Environment variables:
 *   SOURCE_API_KEY - API key for source Supabase project
 *   TARGET_API_KEY - API key for target Supabase project
 * 
 * Example:
 *   SOURCE_API_KEY=your_source_key TARGET_API_KEY=your_target_key npm run migrate:auto -- --source abc123 --target xyz789
 */

import { SupabaseAutoMigration } from './api/migration/supabase-auto-migration.js';
import type { MigrationConfig } from './api/migration/migration-types.js';

const args = process.argv.slice(2);

// Parse command line arguments
const getArgValue = (argName: string): string | null => {
  const index = args.indexOf(`--${argName}`);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
};

async function main() {
  console.log('\n=====================================');
  console.log('  SUPABASE AUTO-MIGRATION v1.0');
  console.log('=====================================\n');

  // Get arguments
  const sourceProjectId = getArgValue('source');
  const targetProjectId = getArgValue('target');
  const includeUsers = !args.includes('--no-users');
  const includeStorage = !args.includes('--no-storage');
  const includeFunctions = !args.includes('--no-functions');

  // Get API keys from environment
  const sourceApiKey = process.env.SOURCE_API_KEY;
  const targetApiKey = process.env.TARGET_API_KEY;

  // Validate inputs
  if (!sourceProjectId || !targetProjectId) {
    console.error('❌ Error: Missing required arguments');
    console.error('\nUsage:');
    console.error('  SOURCE_API_KEY=... TARGET_API_KEY=... npm run migrate:auto -- --source <sourceId> --target <targetId>');
    console.error('\nOptions:');
    console.error('  --source <projectId>      Source Supabase project ID');
    console.error('  --target <projectId>      Target Supabase project ID');
    console.error('  --no-users                Skip user migration');
    console.error('  --no-storage              Skip storage bucket migration');
    console.error('  --no-functions            Skip function migration');
    process.exit(1);
  }

  if (!sourceApiKey || !targetApiKey) {
    console.error('❌ Error: Missing API keys');
    console.error('Set SOURCE_API_KEY and TARGET_API_KEY environment variables');
    console.error('\nExample:');
    console.error('  export SOURCE_API_KEY=your_source_api_key');
    console.error('  export TARGET_API_KEY=your_target_api_key');
    process.exit(1);
  }

  console.log('📋 Migration Configuration:');
  console.log(`  Source: ${sourceProjectId}`);
  console.log(`  Target: ${targetProjectId}`);
  console.log(`  Include Users: ${includeUsers}`);
  console.log(`  Include Storage: ${includeStorage}`);
  console.log(`  Include Functions: ${includeFunctions}`);
  console.log('');

  const sourceConfig: MigrationConfig = {
    projectId: sourceProjectId,
    apiKey: sourceApiKey,
    description: `Source: ${sourceProjectId}`,
  };

  const targetConfig: MigrationConfig = {
    projectId: targetProjectId,
    apiKey: targetApiKey,
    description: `Target: ${targetProjectId}`,
  };

  try {
    const migration = new SupabaseAutoMigration(sourceConfig, targetConfig);
    const result = await migration.migrate();

    console.log('\n✨ Migration Summary:');
    console.log(`Status: ${result.status.toUpperCase()}`);
    console.log(`Completed: ${new Date(result.timestamp).toLocaleString()}`);
    console.log(`\nSteps completed: ${result.steps.length}`);

    for (const step of result.steps) {
      const icon = step.status === 'completed' ? '✅' : '⚠️';
      console.log(`  ${icon} ${step.name}: ${step.details || ''}`);
    }

    if (result.errors.length > 0) {
      console.log('\n⚠️ Errors encountered:');
      for (const error of result.errors) {
        console.log(`  - ${error}`);
      }
    }

    if (result.status === 'completed') {
      console.log('\n🎉 Migration completed successfully!');
      process.exit(0);
    } else {
      console.log('\n❌ Migration failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Fatal error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
