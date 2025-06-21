import { Request, Response, Router } from 'express';
import crypto from 'crypto';
import { generatePKCEChallenge } from '../utils/pkce';
import { pkceVerifiers } from '../utils/store';

const router = Router();

router.post('/authorize', async (_req: Request, res: Response) => {
  try {

    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = await generatePKCEChallenge(verifier);
    
    const state = crypto.randomBytes(16).toString('hex');
    
    pkceVerifiers.set(state, verifier);
    
    const figmaAuthUrl = new URL('https://www.figma.com/oauth');
    figmaAuthUrl.searchParams.append('client_id', process.env.FIGMA_CLIENT_ID!);
    figmaAuthUrl.searchParams.append('redirect_uri', process.env.FIGMA_REDIRECT_URI!);
    figmaAuthUrl.searchParams.append('scope', 'files:read');
    figmaAuthUrl.searchParams.append('state', state);
    figmaAuthUrl.searchParams.append('code_challenge', challenge);
    figmaAuthUrl.searchParams.append('code_challenge_method', 'S256');
    figmaAuthUrl.searchParams.append('response_type', 'code');

    return res.json({ 
      authUrl: figmaAuthUrl.toString(),
      state 
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to initialize authorization' });
  }
});

export default router; 