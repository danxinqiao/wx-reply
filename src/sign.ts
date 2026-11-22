import { md5Hex } from './md5';

export const SIGN_WINDOW_MS = 60_000;
export const TIMESTAMP_HEADER = 'X-Sign-Timestamp';
export const SIGNATURE_HEADER = 'X-Signature';

export interface SignaturePair {
  timestamp: string;
  signature: string;
}

export type VerifyReason = 'missing' | 'bad_timestamp' | 'expired' | 'bad_signature';

export interface VerifyResult {
  valid: boolean;
  reason?: VerifyReason;
}

export function createSignature(timestamp: string, secret: string): string {
  return md5Hex(`${timestamp}${secret}`);
}

export function signNow(secret: string): SignaturePair {
  const timestamp = String(Date.now());
  return { timestamp, signature: createSignature(timestamp, secret) };
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function verifySignature(
  timestamp: string,
  signature: string,
  secret: string,
  now = Date.now(),
): VerifyResult {
  if (!timestamp || !signature) return { valid: false, reason: 'missing' };
  const parsed = Number(timestamp);
  if (!Number.isFinite(parsed)) return { valid: false, reason: 'bad_timestamp' };
  if (Math.abs(now - parsed) > SIGN_WINDOW_MS) return { valid: false, reason: 'expired' };
  const expected = createSignature(timestamp, secret);
  if (!safeEqual(expected, signature.toLowerCase())) {
    return { valid: false, reason: 'bad_signature' };
  }
  return { valid: true };
}

export function signedHeaders(secret: string): Record<string, string> {
  const pair = signNow(secret);
  return {
    [TIMESTAMP_HEADER]: pair.timestamp,
    [SIGNATURE_HEADER]: pair.signature,
  };
}
