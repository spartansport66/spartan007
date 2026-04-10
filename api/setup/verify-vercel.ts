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
    const { token, teamId } = req.body;

    if (!token || token.trim() === '') {
      return res.status(400).json({ 
        success: false,
        error: 'Vercel token is required' 
      });
    }

    const cleanToken = token.trim();
    console.log('Verifying Vercel token...');

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
      console.error('Fetch error:', fetchError);
      
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
    console.error('Verification error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Server error during verification',
      message: error.message || 'Unknown error',
    });
  }
};
