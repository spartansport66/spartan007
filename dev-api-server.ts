/**
 * Local Development API Server
 * Handles Project Setup Wizard API endpoints during local development
 * Run with: npm run dev:api
 */

import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

// Enhanced CORS for migration console
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:8081', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:8081', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Verify Supabase
app.post('/api/setup/verify-supabase', async (req, res) => {
  try {
    const { projectId } = req.body;

    if (!projectId || projectId.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Project ID is required',
      });
    }

    const cleanProjectId = projectId.trim();
    const supabaseUrl = `https://${cleanProjectId}.supabase.co`;

    console.log(`[DEV] Verifying Supabase project: ${cleanProjectId}`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'GET',
        headers: {
          'apikey': 'anon-key-check',
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log(`[DEV] Supabase response status: ${response.status}`);

      // Any response means the project exists and is reachable
      return res.status(200).json({
        success: true,
        message: 'Supabase project is reachable',
        projectId: cleanProjectId,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error(`[DEV] Supabase fetch error:`, error.message);

      if (error.name === 'AbortError') {
        return res.status(400).json({
          success: false,
          error: 'Request timed out',
          projectId: cleanProjectId,
        });
      }

      return res.status(400).json({
        success: false,
        error: `Network error: ${error.message}`,
        projectId: cleanProjectId,
      });
    }
  } catch (error: any) {
    console.error('[DEV] Verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during verification',
      message: error.message,
    });
  }
});

// Verify Vercel
app.post('/api/setup/verify-vercel', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token || token.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Vercel token is required',
      });
    }

    const cleanToken = token.trim();
    console.log('[DEV] Verifying Vercel token...');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const vercelRes = await fetch('https://api.vercel.com/v2/user', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cleanToken}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!vercelRes.ok) {
        return res.status(400).json({
          success: false,
          error: vercelRes.status === 401 ? 'Invalid Vercel token' : `Vercel API error: ${vercelRes.status}`,
        });
      }

      const userData = await vercelRes.json();

      return res.status(200).json({
        success: true,
        message: 'Vercel token verified',
        user: userData.user?.name || userData.user?.email,
      });
    } catch (fetchError: any) {
      console.error('[DEV] Vercel fetch error:', fetchError);

      if (fetchError.name === 'AbortError') {
        return res.status(400).json({
          success: false,
          error: 'Request timeout - Vercel API unreachable',
        });
      }

      return res.status(400).json({
        success: false,
        error: `Network error: ${fetchError.message}`,
      });
    }
  } catch (error: any) {
    console.error('[DEV] Verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during verification',
      message: error.message,
    });
  }
});

// Verify GitHub
app.post('/api/setup/verify-github', async (req, res) => {
  try {
    const { token, org } = req.body;

    if (!token || token.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'GitHub token is required',
      });
    }

    if (!org || org.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Organization name is required',
      });
    }

    const cleanToken = token.trim();
    const cleanOrg = org.trim();
    console.log(`[DEV] Verifying GitHub token for organization: ${cleanOrg}`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const githubRes = await fetch('https://api.github.com/user', {
        method: 'GET',
        headers: {
          'Authorization': `token ${cleanToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!githubRes.ok) {
        return res.status(400).json({
          success: false,
          error: githubRes.status === 401 ? 'Invalid GitHub token' : `GitHub API error: ${githubRes.status}`,
        });
      }

      const userData = await githubRes.json();

      // Verify organization access
      try {
        const orgRes = await fetch(`https://api.github.com/orgs/${cleanOrg}`, {
          method: 'GET',
          headers: {
            'Authorization': `token ${cleanToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });

        if (!orgRes.ok) {
          return res.status(400).json({
            success: false,
            error: `No access to organization '${cleanOrg}'`,
          });
        }
      } catch (orgCheckError: any) {
        console.error('[DEV] Organization check error:', orgCheckError);
        return res.status(400).json({
          success: false,
          error: 'Failed to verify organization access',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'GitHub token verified',
        user: userData.login,
        org: cleanOrg,
      });
    } catch (fetchError: any) {
      console.error('[DEV] GitHub fetch error:', fetchError);

      if (fetchError.name === 'AbortError') {
        return res.status(400).json({
          success: false,
          error: 'Request timeout - GitHub API unreachable',
        });
      }

      return res.status(400).json({
        success: false,
        error: `Network error: ${fetchError.message}`,
      });
    }
  } catch (error: any) {
    console.error('[DEV] Verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during verification',
      message: error.message,
    });
  }
});

// ============================================================================
// MIGRATION ENDPOINTS
// ============================================================================

// Start auto-migration
app.post('/api/migration/auto-migrate', async (req, res) => {
  try {
    const { sourceProjectId, sourceApiKey, targetProjectId, targetApiKey } = req.body;

    if (!sourceProjectId || !sourceApiKey || !targetProjectId || !targetApiKey) {
      return res.status(400).json({
        success: false,
        error: 'All parameters required: sourceProjectId, sourceApiKey, targetProjectId, targetApiKey',
      });
    }

    console.log(`\n[MIGRATION] Starting auto-migration from ${sourceProjectId} to ${targetProjectId}`);

    // Import migration module dynamically
    const { default: SupabaseAutoMigration } = await import('./api/migration/supabase-auto-migration.js');

    const migration = new SupabaseAutoMigration(
      { projectId: sourceProjectId, apiKey: sourceApiKey },
      { projectId: targetProjectId, apiKey: targetApiKey }
    );

    // Start migration in background
    const migrationPromise = migration
      .migrate()
      .then(result => {
        console.log('[MIGRATION] Completed:', result);
        // Store result for later retrieval
        global.lastMigrationResult = { ...result, id: Date.now() };
      })
      .catch(error => {
        console.error('[MIGRATION] Failed:', error);
        global.lastMigrationResult = {
          timestamp: new Date().toISOString(),
          status: 'failed',
          steps: [],
          errors: [error.message],
          id: Date.now(),
        };
      });

    // Return immediate response
    res.status(202).json({
      success: true,
      message: 'Migration started',
      migrationId: Date.now(),
      timestamp: new Date().toISOString(),
      estimatedDuration: '5-15 minutes depending on data size',
    });

    // Continue migration in background without awaiting
  } catch (error: any) {
    console.error('[MIGRATION] Setup error:', error);
    res.status(500).json({
      success: false,
      error: 'Migration setup failed',
      message: error.message,
    });
  }
});

// Get migration status
app.get('/api/migration/status/:migrationId', (req, res) => {
  const { migrationId } = req.params;

  if (global.lastMigrationResult?.id?.toString() === migrationId) {
    return res.json({
      success: true,
      migration: global.lastMigrationResult,
    });
  }

  res.status(404).json({
    success: false,
    error: 'Migration not found',
  });
});

// Get migration status (latest)
app.get('/api/migration/status', (req, res) => {
  if (global.lastMigrationResult) {
    return res.json({
      success: true,
      migration: global.lastMigrationResult,
    });
  }

  res.status(404).json({
    success: false,
    error: 'No migration in progress or completed',
  });
});

// Export specific data
app.post('/api/migration/export', async (req, res) => {
  try {
    const { projectId, apiKey, dataType } = req.body;

    if (!projectId || !apiKey) {
      return res.status(400).json({
        success: false,
        error: 'projectId and apiKey are required',
      });
    }

    console.log(`[EXPORT] Exporting ${dataType || 'all'} from ${projectId}`);

    const { SupabaseMigrationClient } = await import('./api/migration/migration-client.js');
    const client = new SupabaseMigrationClient({ projectId, apiKey });

    let exportData: any = null;

    switch (dataType) {
      case 'schema':
        exportData = await client.exportSchema();
        break;
      case 'data':
        exportData = await client.exportAllData();
        break;
      case 'policies':
        exportData = await client.exportRLSPolicies();
        break;
      case 'users':
        exportData = await client.exportUsers();
        break;
      case 'storage':
        exportData = await client.exportStorageBuckets();
        break;
      case 'functions':
        exportData = await client.exportDatabaseFunctions();
        break;
      case 'triggers':
        exportData = await client.exportTriggers();
        break;
      default:
        // Export everything
        exportData = {
          schema: await client.exportSchema(),
          policies: await client.exportRLSPolicies(),
          users: await client.exportUsers(),
          storage: await client.exportStorageBuckets(),
          functions: await client.exportDatabaseFunctions(),
          triggers: await client.exportTriggers(),
        };
    }

    res.json({
      success: true,
      dataType,
      timestamp: new Date().toISOString(),
      data: exportData,
    });
  } catch (error: any) {
    console.error('[EXPORT] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Export failed',
      message: error.message,
    });
  }
});

// Import specific data
app.post('/api/migration/import', async (req, res) => {
  try {
    const { projectId, apiKey, dataType, data } = req.body;

    if (!projectId || !apiKey || !dataType || !data) {
      return res.status(400).json({
        success: false,
        error: 'projectId, apiKey, dataType, and data are required',
      });
    }

    console.log(`[IMPORT] Importing ${dataType} to ${projectId}`);

    const { SupabaseMigrationClient } = await import('./api/migration/migration-client.js');
    const client = new SupabaseMigrationClient({ projectId, apiKey });

    switch (dataType) {
      case 'schema':
        await client.createSchema(data);
        break;
      case 'data':
        await client.importAllData(data);
        break;
      case 'policies':
        await client.createRLSPolicies(data);
        break;
      case 'users':
        await client.createUsers(data);
        break;
      case 'storage':
        await client.createStorageBuckets(data);
        break;
      case 'functions':
        await client.createDatabaseFunctions(data);
        break;
      case 'triggers':
        await client.createTriggers(data);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid dataType',
        });
    }

    res.json({
      success: true,
      message: `${dataType} imported successfully`,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[IMPORT] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Import failed',
      message: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`\n✓ Development API Server running on http://localhost:${PORT}`);
  console.log(`✓ API endpoints available at http://localhost:${PORT}/api/setup/*`);
  console.log(`✓ Migration endpoints available at http://localhost:${PORT}/api/migration/*\n`);
});
