import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { supabaseProjectId, vercelProjectUrl } = req.body;

    if (!supabaseProjectId || !vercelProjectUrl) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const results = {
      supabase: false,
      vercel: false,
      connection: false,
    };

    // Test Supabase connection
    try {
      const supabaseUrl = `https://${supabaseProjectId}.supabase.co`;
      const supabase = createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY || '');

      const { data, error } = await supabase.from('users').select('*').limit(1);

      if (!error) {
        results.supabase = true;
      }
    } catch (error) {
      // Supabase test failed
    }

    // Test Vercel deployment
    try {
      const vercelRes = await fetch(vercelProjectUrl, { timeout: 5000 });
      if (vercelRes.ok) {
        results.vercel = true;
      }
    } catch (error) {
      // Vercel test failed
    }

    // Test API connection
    try {
      const apiRes = await fetch(`${vercelProjectUrl}/api/health`, { timeout: 5000 });
      if (apiRes.ok) {
        results.connection = true;
      }
    } catch (error) {
      // API test failed
    }

    const allPassed = results.supabase && results.vercel;

    res.status(allPassed ? 200 : 206).json({
      success: allPassed,
      message: allPassed ? 'All tests passed' : 'Some tests failed',
      results,
    });
  } catch (error: any) {
    res.status(400).json({
      error: error.message || 'Failed to run tests',
    });
  }
};
