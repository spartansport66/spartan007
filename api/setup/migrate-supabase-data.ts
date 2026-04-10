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
    const supabase = createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY || '');

    // Read migration files
    const migrationDir = path.join(process.cwd(), 'database-backup');
    const files = [
      { file: 'export_users_auth.sql', name: 'users/auth' },
      { file: 'export_application_data.sql', name: 'application data' },
    ];

    for (const { file, name } of files) {
      const filePath = path.join(migrationDir, file);

      if (!fs.existsSync(filePath)) {
        continue; // Skip if file doesn't exist
      }

      const sql = fs.readFileSync(filePath, 'utf-8');

      const { error } = await supabase.rpc('exec_sql', {
        sql: sql,
      });

      if (error) {
        throw new Error(`Failed to migrate ${name}: ${error.message}`);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Data migrated successfully',
      projectId,
    });
  } catch (error: any) {
    res.status(400).json({
      error: error.message || 'Failed to migrate Supabase data',
    });
  }
};
