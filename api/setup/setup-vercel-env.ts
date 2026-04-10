import { VercelRequest, VercelResponse } from '@vercel/node';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token, teamId, projectId, supabaseProjectId } = req.body;

    if (!token || !projectId || !supabaseProjectId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const headers: any = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    if (teamId) {
      headers['x-vercel-team-id'] = teamId;
    }

    // Environment variables to set
    const envVars = [
      {
        key: 'VITE_SUPABASE_URL',
        value: `https://${supabaseProjectId}.supabase.co`,
        target: ['production', 'preview', 'development'],
      },
      {
        key: 'VITE_SUPABASE_ANON_KEY',
        value: process.env.SUPABASE_ANON_KEY || '',
        target: ['production', 'preview', 'development'],
      },
    ];

    // Set each environment variable
    for (const envVar of envVars) {
      const envRes = await fetch(
        `https://api.vercel.com/v10/projects/${projectId}/env`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(envVar),
        }
      );

      if (!envRes.ok) {
        const errorData = await envRes.json();
        throw new Error(`Failed to set ${envVar.key}: ${errorData.error?.message}`);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Environment variables configured successfully',
      projectId,
    });
  } catch (error: any) {
    res.status(400).json({
      error: error.message || 'Failed to setup environment variables',
    });
  }
};
