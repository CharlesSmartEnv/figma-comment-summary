import express, { Request, Response } from 'express';
import { authSessionsStore, findSessionByReadKey } from '../utils/authStore';

const router = express.Router();

router.get('/poll-status', (req: Request, res: Response) => {
  const { readKey } = req.query;

  if (!readKey || typeof readKey !== 'string') {
    return res.status(400).json({ status: 'error', message: 'Missing readKey parameter.' });
  }

  const session = findSessionByReadKey(readKey);

  if (!session) {
    return res.status(404).json({ status: 'error', message: 'Authentication session not found or expired. Please try again.' });
  }

  switch (session.status) {
    case 'pending':
      return res.status(202).json({ status: 'pending', message: 'Authentication still in progress.' }); // 202 Accepted (but not yet complete)

    case 'completed':
      // CRITICAL: Once tokens are sent, the session (and its keys) should be invalidated/deleted
      // to ensure they are single-use.
      const responsePayload = {
        status: 'completed',
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
      };
      // Remove the session from the store after successful retrieval
      authSessionsStore.delete(session.writeKey); // Assuming writeKey is the primary key of the store
      return res.status(200).json(responsePayload);

    case 'error':
      const errorPayload = {
        status: 'error',
        message: session.errorMessage || 'An unspecified error occurred during authentication.',
      };
      // Also remove errored sessions from the store
      authSessionsStore.delete(session.writeKey);
      return res.status(400).json(errorPayload); // Or another appropriate error code like 500 if it was a server fault

    default:
      // Should not happen if session status is managed correctly
      console.error(`Poll request for readKey ${readKey} encountered an unknown session status: ${session.status}`);
      authSessionsStore.delete(session.writeKey); // Clean up inconsistent state
      return res.status(500).json({ status: 'error', message: 'Internal server error: Unknown session state.' });
  }
});

export default router; 