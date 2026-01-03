// Defines the structure for an authentication session
export interface AuthSession {
  readKey: string;
  writeKey: string;
  pkceVerifier: string;
  status: 'pending' | 'completed' | 'error';
  accessToken?: string;
  errorMessage?: string;
  createdAt: number; // Store as timestamp (Date.now())
}

// In-memory store for active authentication sessions.
// The key for this map will be the `writeKey` for easy lookup during the callback,
// and we'll also need to be able to find a session by `readKey` for polling.
// For simplicity, we can use one map keyed by writeKey and iterate for readKey,
// or use two maps if performance becomes a concern (not an issue for dev).
// Let's start with one map keyed by writeKey.
export const authSessionsStore = new Map<string, AuthSession>();

// Helper function to find a session by readKey (since our map is keyed by writeKey)
export const findSessionByReadKey = (readKeyToFind: string): AuthSession | undefined => {
  for (const session of authSessionsStore.values()) {
    if (session.readKey === readKeyToFind) {
      return session;
    }
  }
  return undefined;
};

// Optional: Basic cleanup for very old sessions (can be improved)
const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
setInterval(() => {
  const now = Date.now();
  authSessionsStore.forEach((session, writeKey) => {
    if (now - session.createdAt > SESSION_TIMEOUT_MS) {
      authSessionsStore.delete(writeKey);
      //Cleaning up expired auth session for this key
    }
  });
}, 5 * 60 * 1000); // Run cleanup every 5 minutes 