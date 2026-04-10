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
    const { projectId, password, apiKey } = req.body;

    if (!projectId || projectId.trim() === '') {
      return res.status(400).json({ 
        success: false,
        error: 'Project ID is required' 
      });
    }

    const cleanProjectId = projectId.trim();
    const supabaseUrl = `https://${cleanProjectId}.supabase.co`;

    console.log(`Verifying Supabase project: ${cleanProjectId}`);

    // Try to reach the Supabase project URL with a timeout
    let verified = false;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'GET',
        headers: {
          'apikey': 'anon-key-check',
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Status 200, 401, 403, 404 all indicate the project exists
      verified = response.status !== 0 && response.status < 500;
      
      console.log(`Supabase response status: ${response.status}`);

      if (verified) {
        return res.status(200).json({
          success: true,
          message: 'Supabase project is reachable',
          projectId: cleanProjectId,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (fetchError: any) {
      console.error(`Fetch error: ${fetchError.message}`);
      
      // If it's a timeout or network error, assume project doesn't exist or isn't accessible
      if (fetchError.name === 'AbortError') {
        return res.status(400).json({
          success: false,
          error: 'Request timed out - Supabase project may not be reachable',
          troubleshooting: [
            'Check your Project ID is correct',
            'Verify the project is active in Supabase',
            'Check your internet connection',
            'Try again in a few moments'
          ],
          projectId: cleanProjectId,
        });
      }

      return res.status(400).json({
        success: false,
        error: `Network error: ${fetchError.message}`,
        troubleshooting: [
          'Verify your internet connection',
          'Check if Supabase is accessible from your location',
          'Try disabling VPN if you have one enabled'
        ],
        projectId: cleanProjectId,
      });
    }

    // If we get here, verification failed
    return res.status(400).json({
      success: false,
      error: 'Cannot verify Supabase project',
      troubleshooting: [
        'Ensure Project ID is correct (e.g., qzmwtbbtagktpsckhmcz)',
        'Check that the project is active in Supabase dashboard',
        'Verify your internet connection',
        'Check firewall/VPN settings'
      ],
      projectId: cleanProjectId,
    });

  } catch (error: any) {
    console.error('Verification error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Server error during verification',
      message: error.message || 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
};
