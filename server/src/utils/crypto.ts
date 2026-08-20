import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export function generateClientId(): string {
  const random = crypto.randomBytes(12).toString('hex');
  return `cli_${random}`;
}

export function generateClientSecret(): string {
  const random = crypto.randomBytes(24).toString('hex');
  return `rms_sec_${random}`;
}

export function createCredentialString(clientId: string, clientSecret: string): string {
  return `rms_live_${clientId}.${clientSecret}`;
}

export function parseCredentialString(credential: string): { clientId: string; secret: string } | null {
  if (!credential) return null;

  // Format 1: rms_live_<clientId>.<secret>
  if (credential.startsWith('rms_live_')) {
    const withoutPrefix = credential.slice('rms_live_'.length);
    const dotIndex = withoutPrefix.indexOf('.');
    if (dotIndex > 0) {
      const clientId = withoutPrefix.slice(0, dotIndex);
      const secret = withoutPrefix.slice(dotIndex + 1);
      if (clientId && secret) {
        return { clientId, secret };
      }
    }
  }

  // Format 2: <clientId>:<secret>
  const colonIndex = credential.indexOf(':');
  if (colonIndex > 0) {
    const clientId = credential.slice(0, colonIndex);
    const secret = credential.slice(colonIndex + 1);
    if (clientId && secret) {
      return { clientId, secret };
    }
  }

  return null;
}

export async function hashSecret(secret: string): Promise<string> {
  return bcrypt.hash(secret, SALT_ROUNDS);
}

export async function verifySecret(secret: string, hash: string): Promise<boolean> {
  return bcrypt.compare(secret, hash);
}
