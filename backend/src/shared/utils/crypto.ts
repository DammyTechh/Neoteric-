import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { env } from '@shared/config/env';

/** Password hashing. Cost factor comes from BCRYPT_ROUNDS. */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** A URL-safe random token, returned raw. Store only its hash. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/**
 * Hash for opaque tokens (refresh tokens, reset links).
 *
 * SHA-256 rather than bcrypt: these are already 256 bits of entropy, so there
 * is nothing to brute-force, and lookups happen on every refresh.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Checksum used to spot a re-upload of a file already in the media library. */
export function checksum(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}
