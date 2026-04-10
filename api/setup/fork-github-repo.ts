import { VercelRequest, VercelResponse } from '@vercel/node';

// Source repository - this should be your main repo
const SOURCE_REPO = 'dyad-apps/spartan'; // Change this to your actual org/repo

export default async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token, org } = req.body;

    if (!token || !org) {
      return res.status(400).json({ error: 'Missing GitHub token or organization' });
    }

    // Fork the repository to the specified organization
    const forkRes = await fetch(`https://api.github.com/repos/${SOURCE_REPO}/forks`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        owner: org,
        name: 'spartan-copy', // You can customize this
      }),
    });

    if (!forkRes.ok) {
      const errorData = await forkRes.json();
      throw new Error(`Failed to fork repository: ${errorData.message}`);
    }

    const repoData = await forkRes.json();

    res.status(200).json({
      success: true,
      message: 'Repository forked successfully',
      repo: repoData.name,
      repoUrl: repoData.html_url,
      cloneUrl: repoData.clone_url,
    });
  } catch (error: any) {
    res.status(400).json({
      error: error.message || 'Failed to fork GitHub repository',
    });
  }
};
