import express, { Request, Response } from 'express';
import { authSessionsStore } from '../utils/authStore'; // To verify the session if needed

const router = express.Router();

// This endpoint is hit when the popup window opens the URL from /initiate
router.get('/start-auth-flow', async (req: Request, res: Response) => {
  const { write_key, pkce_challenge } = req.query;

  if (!write_key || typeof write_key !== 'string' || !pkce_challenge || typeof pkce_challenge !== 'string') {
    return res.status(400).send('Missing write_key or pkce_challenge');
  }

  // Optional: Verify if a session with this write_key actually exists and is pending
  const session = authSessionsStore.get(write_key);
  if (!session || session.status !== 'pending') {
    // If session doesn't exist or isn't pending, it might be an invalid/old link
    return res.status(400).send('Invalid or expired authentication session link.');
  }

  try {
    // Set the write_key in a secure, HttpOnly cookie.
    // This cookie will be sent back by the browser on subsequent requests to this domain,
    // including the /api/oauth/callback.
    res.cookie('figma_oauth_write_key', write_key, {
      httpOnly: true, // Prevents client-side JavaScript from accessing the cookie
      secure: process.env.NODE_ENV === 'production', // Send only over HTTPS in production
      sameSite: 'lax', // Or 'strict' if appropriate for your flow. 'lax' is often a good default.
      maxAge: 15 * 60 * 1000, // Cookie expiry: 15 minutes (should match session timeout)
    });

    // Construct Figma OAuth URL
    const figmaAuthUrl = new URL('https://www.figma.com/oauth'); // Official authorization endpoint
    figmaAuthUrl.searchParams.append('client_id', process.env.FIGMA_CLIENT_ID!);
    figmaAuthUrl.searchParams.append('redirect_uri', process.env.FIGMA_REDIRECT_URI!); // Your /api/oauth/callback
    figmaAuthUrl.searchParams.append('scope', 'files:read'); // Or any other scopes you need
    figmaAuthUrl.searchParams.append('state', write_key); // The write_key IS the state parameter
    figmaAuthUrl.searchParams.append('code_challenge', pkce_challenge);
    figmaAuthUrl.searchParams.append('code_challenge_method', 'S256');
    figmaAuthUrl.searchParams.append('response_type', 'code');

    // Redirect the browser (popup window) to Figma's OAuth page
    res.redirect(figmaAuthUrl.toString());

  } catch (error) {
    console.error('Error in /api/oauth/start-auth-flow:', error);
    // Update session status to error if possible
    const sessionToUpdate = authSessionsStore.get(write_key);
    if (sessionToUpdate) {
      sessionToUpdate.status = 'error';
      sessionToUpdate.errorMessage = 'Failed during auth initiation step.';
      authSessionsStore.set(write_key, sessionToUpdate);
    }
    res.status(500).send('Failed to start Figma authentication');
  }
});

export default router; 