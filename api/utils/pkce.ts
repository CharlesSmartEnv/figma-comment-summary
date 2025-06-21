import crypto from 'crypto';

export async function generatePKCEChallenge(verifier: string): Promise<string> {
  const hash = crypto.createHash('sha256')
    .update(verifier)
    .digest();
  
  return Buffer.from(hash).toString('base64url');
} 