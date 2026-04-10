import { VercelRequest, VercelResponse } from '@vercel/node';

export default async (req: VercelRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: 'Method not allowed' 
    });
  }

  try {
    const { token, org } = req.body;

    if (!token || token.trim() === '') {
      return res.status(400).json({ 
        success: false,
        error: 'GitHub token is required' 
      });
    }

    if (!org || org.trim() === '') {
      return res.status(400).json({ 
        success: false,
        error: 'Organization name is required' 
      });
    }

    const cleanToken = token.trim();
    const cleanOrg = org.trim();
    console.log(`Verifying GitHub token for organization: ${cleanOrg}`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      // Test GitHub API token
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
            error: `No access to organization '${cleanOrg}'. Make sure the organization exists and you have access to it.`,
          });
        }
      } catch (orgCheckError: any) {
        console.error('Organization check error:', orgCheckError);
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
      console.error('Fetch error:', fetchError);
      
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
    console.error('Verification error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Server error during verification',
      message: error.message || 'Unknown error',
    });
  }
};
