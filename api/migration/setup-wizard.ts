/**
 * Migration Setup Helper
 * Prompts user for migration configuration and runs the migration
 */

import * as readline from 'readline';
import { SupabaseAutoMigration } from './supabase-auto-migration.js';
import type { MigrationConfig } from './migration-types.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(question, resolve);
  });
}

async function setupAndMigrate() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   SUPABASE MIGRATION SETUP WIZARD       ║');
  console.log('╚════════════════════════════════════════╝\n');

  console.log('📝 Enter your source Supabase credentials:');
  const sourceProjectId = await prompt('Source Project ID: ');
  const sourceApiKey = await prompt('Source API Key (Service Role): ');

  console.log('\n📝 Enter your target Supabase credentials:');
  const targetProjectId = await prompt('Target Project ID: ');
  const targetApiKey = await prompt('Target API Key (Service Role): ');

  const sourceConfig: MigrationConfig = {
    projectId: sourceProjectId.trim(),
    apiKey: sourceApiKey.trim(),
  };

  const targetConfig: MigrationConfig = {
    projectId: targetProjectId.trim(),
    apiKey: targetApiKey.trim(),
  };

  console.log('\n🚀 Starting migration...\n');

  try {
    const migration = new SupabaseAutoMigration(sourceConfig, targetConfig);
    const result = await migration.migrate();

    console.log('\n════════════════════════════════════════');
    console.log('📊 MIGRATION REPORT');
    console.log('════════════════════════════════════════');
    console.log(`Status: ${result.status.toUpperCase()}`);
    console.log(`Started: ${result.timestamp}`);
    console.log(`\nSteps Completed: ${result.steps.length}`);

    for (const step of result.steps) {
      const icon = step.status === 'completed' ? '✅' : '❌';
      console.log(`${icon} ${step.name}: ${step.details || ''}`);
    }

    if (result.errors.length > 0) {
      console.log(`\n⚠️ Errors (${result.errors.length}):`);
      for (const error of result.errors) {
        console.log(`  - ${error}`);
      }
    }

    console.log('════════════════════════════════════════\n');

    if (result.status === 'completed') {
      console.log('🎉 Migration completed successfully!\n');
    } else {
      console.log('❌ Migration encountered issues. Check above for details.\n');
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error instanceof Error ? error.message : String(error));
  } finally {
    rl.close();
  }
}

setupAndMigrate();
