import { db, type Platform } from "./db";

/**
 * Errors that a retry can't fix but a fresh login can: missing scopes
 * (e.g. after we started asking for video.publish / youtube.upload),
 * revoked or expired tokens.
 */
const AUTH_ERROR =
  /scope_not_authorized|access_token_invalid|access_token_expired|insufficient.?(permission|scope)|ACCESS_TOKEN_SCOPE_INSUFFICIENT|invalid_grant|UNAUTHENTICATED|"code":\s*401|token expired; reconnect|Instagram API error \((190|10|200)\)/i;

export function needsReconnect(error: string | null) {
  return !!error && AUTH_ERROR.test(error);
}

/** After reconnecting, put this platform's unfinished jobs back in the queue. */
export function resumeJobs(accountId: number, platform: Platform) {
  db.prepare(
    `UPDATE jobs SET status = 'pending', attempts = 0, error = NULL, updated_at = datetime('now')
     WHERE status IN ('pending', 'failed')
       AND target_connection_id IN (SELECT id FROM connections WHERE account_id = ? AND platform = ?)`,
  ).run(accountId, platform);
}
