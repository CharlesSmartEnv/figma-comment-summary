import express, { Request, Response } from 'express';
import axios from 'axios';
import { authSessionsStore } from '../utils/authStore';

const router = express.Router();

router.get('/callback', async (req: Request, res: Response) => {
  const { code, state } = req.query;
  const cookieWriteKey = req.cookies?.figma_oauth_write_key;


  // Clear the cookie once read
  res.clearCookie('figma_oauth_write_key', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });

  if (!code || typeof code !== 'string') {
    return res.status(400).send('Missing authorization code from Figma.'); // Send descriptive HTML/text
  }
  if (!state || typeof state !== 'string') {
    return res.status(400).send('Missing state (writeKey) parameter from Figma.');
  }
  if (!cookieWriteKey || typeof cookieWriteKey !== 'string') {
    console.error('Error in /callback: Missing figma_oauth_write_key cookie.');
    return res.status(400).send('Authentication session error. Missing security cookie.');
  }

  // --- CRITICAL SECURITY CHECK ---
  if (state !== cookieWriteKey) {
    console.error(`Error in /callback: State-Cookie mismatch. State: ${state}, Cookie: ${cookieWriteKey}`);
    // Clean up potential session if state is a valid key but cookie wrong
    const sessionWithError = authSessionsStore.get(state);
    if (sessionWithError) {
      sessionWithError.status = 'error';
      sessionWithError.errorMessage = 'State-Cookie mismatch during callback.';
      authSessionsStore.set(state, sessionWithError);
    }
    return res.status(403).send('Invalid state parameter. Authentication failed (CSRF detected or session mismatch).');
  }

  const writeKey = state;
  const session = authSessionsStore.get(writeKey); // Get session from CORRECT store

  if (!session) {
    console.error(`Error in /callback: No session found for validated writeKey: ${writeKey}`);
    return res.status(400).send('Authentication session not found or expired.');
  }

  if (session.status !== 'pending') {
    console.warn(`Warning in /callback: Session for writeKey ${writeKey} is not in 'pending' state. Status: ${session.status}`);
     if (session.status === 'completed') {
         return res.status(200).send('Authentication already completed. You can close this window.');
     }
    return res.status(400).send(`Invalid session state: ${session.status}. Please try authenticating again.`);
  }

  // --- Now use session.pkceVerifier from the CORRECT store ---
  if (!session.pkceVerifier) {
      console.error(`Error in /callback: Session for writeKey ${writeKey} is missing pkceVerifier.`);
      session.status = 'error';
      session.errorMessage = 'Internal error: Missing PKCE verifier in session.';
      authSessionsStore.set(writeKey, session);
      return res.status(500).send('Internal server error during authentication.');
  }

  try {
    const tokenResponse = await axios.post(
      'https://api.figma.com/v1/oauth/token',
      new URLSearchParams({
        client_id: process.env.FIGMA_CLIENT_ID!,
        client_secret: process.env.FIGMA_CLIENT_SECRET!,
        redirect_uri: process.env.FIGMA_REDIRECT_URI!,
        code: code,
        code_verifier: session.pkceVerifier, 
        grant_type: 'authorization_code',
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, refresh_token } = tokenResponse.data;

    if (!access_token) throw new Error('No access_token received from Figma.');

    session.status = 'completed';
    session.accessToken = access_token;
    session.refreshToken = refresh_token;
    authSessionsStore.set(writeKey, session); // Save updated session


    res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Authentication Successful</title>
          <style>
            body {
              font-family: 'SF Pro' -apple-system, BlinkMacSystemFont, sans-serif;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background-color: #ffffff;
              color: #333;
            }
            h1 {
              margin-bottom: 16px;
              color: #000000;
            }
            p {
              margin: 0;
              opacity: 0.8;
            }
          </style>
        </head>
        <body>
          <h1>Success!</h1>
          <p>Please return to the Figma plugin.</p>
        </body>
      </html>
    `);

  } catch (error: any) {
    console.error(`Error in /callback during token exchange for writeKey ${writeKey}:`, error.response?.data || error.message);
    session.status = 'error';
    session.errorMessage = error.response?.data?.error_description || error.response?.data?.message || 'Failed to exchange code for token.';
    authSessionsStore.set(writeKey, session); // Save error state

    res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Authentication Failed</title>
          <style>
            body {
              font-family: 'SF Pro' -apple-system, BlinkMacSystemFont, sans-serif;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background-color: #ffffff;
              color: #333;
            }
            h1 {
              margin-bottom: 16px;
              color: #000000;
            }
            p {
              margin: 0;
              opacity: 0.8;
              text-align: center;
              max-width: 400px;
            }
          </style>
        </head>
        <body>
          <h1>Authentication Failed</h1>
          <p>Details: ${session.errorMessage}</p>
        </body>
      </html>
    `);
  }
});

export default router; 