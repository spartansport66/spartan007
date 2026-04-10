import { VercelRequest, VercelResponse } from '@vercel/node';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token, teamId, projectName, githubRepo } = req.body;

    if (!token || !projectName) {
      return res.status(400).json({ error: 'Missing Vercel token or project name' });
    }

    // Create Vercel project
    const headers: any = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    if (teamId) {
      headers['x-vercel-team-id'] = teamId;
    }

    const projectRes = await fetch('https://api.vercel.com/v10/projects', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: projectName,
        gitRepository: githubRepo ? {
          type: 'github',
          repo: githubRepo,
        } : undefined,
        framework: 'vite',
      }),
    });

    if (!projectRes.ok) {
      const errorData = await projectRes.json();
      throw new Error(`Failed to create Vercel project: ${errorData.error?.message || 'Unknown error'}`);
    }

    const projectData = await projectRes.json();

    res.status(200).json({
      success: true,
      message: 'Vercel project created successfully',
      projectId: projectData.id,
      projectName: projectData.name,
      projectUrl: `https://${projectData.name}.vercel.app`,
    });
  } catch (error: any) {
    res.status(400).json({
      error: error.message || 'Failed to create Vercel project',
    });
  }
};
