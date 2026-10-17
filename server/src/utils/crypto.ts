import argon2, { type HashOptions } from 'argon2';
import crypto from 'node:crypto';

// OWASP Recommended Argon2id profile (optimized for Laptop and Raspberry Pi 4/5)
export const ARGON2_CONFIG: HashOptions & { raw?: false } = {
  type: 2, // argon2id
  memoryCost: 65536, // 64 MB
  timeCost: 3,
  parallelism: 1,
  raw: false,
};

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_CONFIG);
}


export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

export function generateSecureToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function timingSafeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, 'utf-8');
    const bufB = Buffer.from(b, 'utf-8');
    if (bufA.length !== bufB.length) {
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}
