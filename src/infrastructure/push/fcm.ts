import crypto from 'crypto';
import fs from 'fs';
import { config } from '../../config';
import Logger from '../../utils/logger';

/**
 * Firebase Cloud Messaging over the HTTP v1 API, without the firebase-admin SDK:
 * a service-account JWT (RS256, Node crypto) is exchanged for an OAuth token,
 * the same no-SDK approach the Razorpay integration takes.
 */
interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
}

export interface PushMessage {
  title: string;
  body: string;
  /** String-only key/values delivered to the app (e.g. the route to open). */
  data?: Record<string, string>;
}

export interface PushResult {
  sent: number;
  /** Tokens FCM reported as no longer valid; the caller should delete them. */
  invalidTokens: string[];
}

const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const b64url = (input: Buffer | string) => Buffer.from(input).toString('base64url');

let cachedAccount: ServiceAccount | null | undefined;
let cachedToken: { value: string; expiresAt: number } | null = null;

export const loadServiceAccount = (): ServiceAccount | null => {
  if (cachedAccount !== undefined) return cachedAccount;
  try {
    const raw = config.fcmServiceAccountJson || (config.fcmServiceAccountFile && fs.readFileSync(config.fcmServiceAccountFile, 'utf8'));
    cachedAccount = raw ? (JSON.parse(raw) as ServiceAccount) : null;
  } catch (error) {
    Logger.error(`[push] could not read the FCM service account: ${String(error)}`);
    cachedAccount = null;
  }
  return cachedAccount;
};

export const isPushConfigured = (): boolean => loadServiceAccount() !== null;

/** Test hook: forget cached credentials and tokens. */
export const resetFcmCache = (): void => {
  cachedAccount = undefined;
  cachedToken = null;
};

export const buildAssertion = (sa: ServiceAccount, nowSeconds: number): string => {
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: SCOPE,
      aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
      iat: nowSeconds,
      exp: nowSeconds + 3600,
    }),
  );
  const signature = crypto.createSign('RSA-SHA256').update(`${header}.${claims}`).sign(sa.private_key);
  return `${header}.${claims}.${b64url(signature)}`;
};

const accessToken = async (sa: ServiceAccount): Promise<string> => {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const res = await fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: buildAssertion(sa, Math.floor(Date.now() / 1000)),
    }),
  });
  const body = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !body.access_token) throw new Error(`FCM auth failed: ${body.error ?? res.status}`);
  cachedToken = { value: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return body.access_token;
};

/** FCM error codes that mean "this token is gone for good". */
const isDeadToken = (status: number, body: unknown): boolean => {
  const details = (body as { error?: { status?: string; details?: Array<{ errorCode?: string }> } })?.error;
  const codes = (details?.details ?? []).map((d) => d.errorCode);
  return status === 404 || codes.includes('UNREGISTERED') || (status === 400 && codes.includes('INVALID_ARGUMENT'));
};

/** Sends to each token; never throws. No credentials = nothing sent. */
export const sendPush = async (tokens: string[], message: PushMessage): Promise<PushResult> => {
  const sa = loadServiceAccount();
  if (!sa || tokens.length === 0) return { sent: 0, invalidTokens: [] };
  let bearer: string;
  try {
    bearer = await accessToken(sa);
  } catch (error) {
    Logger.error(`[push] ${String(error)}`);
    return { sent: 0, invalidTokens: [] };
  }
  const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
  const results = await Promise.all(
    tokens.map(async (token) => {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: {
              token,
              notification: { title: message.title, body: message.body },
              data: message.data ?? {},
              android: { priority: 'high' },
            },
          }),
        });
        if (res.ok) return 'sent' as const;
        const body = await res.json().catch(() => null);
        if (isDeadToken(res.status, body)) return 'dead' as const;
        Logger.warn(`[push] FCM ${res.status} for a token: ${JSON.stringify(body)}`);
        return 'failed' as const;
      } catch (error) {
        Logger.warn(`[push] send failed: ${String(error)}`);
        return 'failed' as const;
      }
    }),
  );
  return {
    sent: results.filter((r) => r === 'sent').length,
    invalidTokens: tokens.filter((_, i) => results[i] === 'dead'),
  };
};
