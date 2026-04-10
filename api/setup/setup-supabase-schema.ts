import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { projectId, password } = req.body;

    if (!projectId || !password) {
      return res.status(400).json({ error: 'Missing projectId or password' });
    }

    const supabaseUrl = `https://${projectId}.supabase.co`;
    const supabase = createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY || '', {
      auth: {
        persistSession: false,
      },
    });

    // Read the SQL migration files
    const migrationDir = path.join(process.cwd(), 'database-backup');
    const schemaFile = path.join(migrationDir, 'export_schema_policies.sql');

    if (!fs.existsSync(schemaFile)) {
      throw new Error('Schema migration file not found');
    }

    const schemaSql = fs.readFileSync(schemaFile, 'utf-8');

    // Execute schema migration
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: schemaSql,
    });

    if (error) {
      throw new Error(`Failed to create schema: ${error.message}`);
    }

    res.status(200).json({
      success: true,
      message: 'Supabase schema created successfully',
      projectId,
    });
  } catch (error: any) {
    res.status(400).json({
      error: error.message || 'Failed to setup Supabase schema',
    });
  }
};
