import type { AuthError } from '@supabase/supabase-js';

const INVALID_SESSION_CODES = new Set([
  'refresh_token_not_found',
  'invalid_refresh_token',
  'session_not_found',
]);

export function isInvalidSessionError(error: AuthError | null | undefined): boolean {
  if (!error) return false;
  if (error.code && INVALID_SESSION_CODES.has(error.code)) return true;

  const message = error.message.toLowerCase();
  return message.includes('refresh token') || message.includes('invalid refresh');
}
