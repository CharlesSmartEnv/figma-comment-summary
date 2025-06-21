import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { authSessionsStore, AuthSession } from '../utils/authStore';
import { generatePKCEChallenge } from '../utils/pkce'; // Assuming you have this from previous PKCE setup

const router = express.Router();

router.post('/initiate', async (req: Request, res: Response) => {
  try {
    const readKey = crypto.randomBytes(32).toString('hex');
    const writeKey = crypto.randomBytes(32).toString('hex'); // This will also be our 'state'

    // Generate PKCE verifier and challenge
    const pkceVerifier = crypto.randomBytes(32).toString('base64url');
    const pkceChallenge = await generatePKCEChallenge(pkceVerifier);

    const session: AuthSession = {
      readKey,
      writeKey,
      pkceVerifier,
      status: 'pending',
      createdAt: Date.now(),
    };

    // Store the session, keyed by writeKey
    authSessionsStore.set(writeKey, session);

    // Construct the URL for the next step on our server.
    // This URL will be opened in the popup by the plugin UI.
    // It needs to carry the writeKey (for cookie setting and state) and pkceChallenge.
    const serverAuthFlowUrl = new URL(`${req.protocol}://${req.get('host')}/api/oauth/start-auth-flow`);
    serverAuthFlowUrl.searchParams.append('write_key', writeKey);
    serverAuthFlowUrl.searchParams.append('pkce_challenge', pkceChallenge);
    // No need to pass code_challenge_method here, it will be added when redirecting to Figma

    res.json({
      readKey: readKey,
      authUrlToOpen: serverAuthFlowUrl.toString(),
    });
  } catch (error) {
    console.error('Error in /api/oauth/initiate:', error);
    res.status(500).json({ error: 'Failed to initiate authentication flow' });
  }
});

export default router; 