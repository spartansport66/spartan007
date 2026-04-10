import { VercelRequest, VercelResponse } from '@vercel/node';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token, teamId, projectId } = req.body;

    if (!token || !projectId) {
      return res.status(400).json({ error: 'Missing Vercel token or project ID' });
    }

    const headers: any = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    if (teamId) {
      headers['x-vercel-team-id'] = teamId;
    }

    // Trigger deployment
    const deployRes = await fetch(
      `https://api.vercel.com/v13/deployments`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          projectId: projectId,
          source: 'cli',
          name: 'Automated Project Setup',
        }),
      }
    );

    if (!deployRes.ok) {
      const errorData = await deployRes.json();
      throw new Error(`Failed to trigger deployment: ${errorData.error?.message || 'Unknown error'}`);
    }

    const deployData = await deployRes.json();

    res.status(200).json({
      success: true,
      message: 'Deployment triggered successfully',
      deploymentId: deployData.id,
      deploymentUrl: deployData.url,
    });
  } catch (error: any) {
    res.status(400).json({
      error: error.message || 'Failed to trigger Vercel deployment',
    });
  }
};
