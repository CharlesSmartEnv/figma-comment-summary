// Temporary in-memory store for PKCE verifiers
// In production, use a proper database
export const pkceVerifiers = new Map<string, string>(); 