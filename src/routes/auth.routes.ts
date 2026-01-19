import { Router } from 'express';
import { ConfigService } from '../services/config-service.js';

/**
 * Create auth status routes
 * These routes are public (no auth required) and provide auth configuration
 */
export function createAuthRoutes(): Router {
  const router = Router();

  /**
   * GET /api/auth/status
   * Returns authentication configuration
   */
  router.get('/status', (_req, res) => {
    const config = ConfigService.getInstance().getConfig();
    const accessCode = config.interface.accessCode;

    res.json({
      // If access code is set, use simple code auth
      useAccessCode: !!accessCode,
      // If no access code is set, this is first time setup
      needsSetup: !accessCode
    });
  });

  /**
   * POST /api/auth/setup
   * Set up initial access code (only works if no code is set yet)
   */
  router.post('/setup', async (req, res) => {
    const { code } = req.body;
    const configService = ConfigService.getInstance();
    const config = configService.getConfig();

    if (config.interface.accessCode) {
      // Already configured, reject
      res.status(400).json({ error: 'Access code already configured' });
      return;
    }

    if (!code || code.length < 4) {
      res.status(400).json({ error: 'Access code must be at least 4 characters' });
      return;
    }

    // Save the access code
    await configService.updateConfig({
      interface: { ...config.interface, accessCode: code }
    });

    // Return the auth token so user can login immediately
    res.json({ token: config.authToken });
  });

  /**
   * POST /api/auth/verify
   * Verify access code and return full auth token
   */
  router.post('/verify', (req, res) => {
    const { code } = req.body;
    const config = ConfigService.getInstance().getConfig();
    const accessCode = config.interface.accessCode;

    if (!accessCode) {
      // No access code configured, reject
      res.status(400).json({ error: 'Access code not configured' });
      return;
    }

    if (code === accessCode) {
      // Code matches, return the real auth token
      res.json({ token: config.authToken });
    } else {
      res.status(401).json({ error: 'Invalid access code' });
    }
  });

  return router;
}
