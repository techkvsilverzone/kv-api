import { Request, Response } from 'express';
import { config } from '../config';

/**
 * Cookie-based JWT helpers. The token is issued in an httpOnly cookie so it is
 * not reachable from JavaScript (XSS-safe). A small manual parser reads it back
 * so we don't need the cookie-parser dependency.
 */

const cookieOptions = () => ({
  httpOnly: true,
  secure: config.cookieSecure,
  sameSite: config.cookieSameSite,
  ...(config.cookieDomain ? { domain: config.cookieDomain } : {}),
  path: '/',
});

export const setAuthCookie = (res: Response, token: string): void => {
  res.cookie(config.authCookieName, token, {
    ...cookieOptions(),
    maxAge: config.cookieMaxAgeDays * 24 * 60 * 60 * 1000,
  });
};

export const clearAuthCookie = (res: Response): void => {
  res.clearCookie(config.authCookieName, cookieOptions());
};

/** Read the JWT from the auth cookie or the `Authorization: Bearer` header. */
export const readTokenFromRequest = (req: Request): string | undefined => {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer')) {
    return header.split(' ')[1];
  }

  const rawCookies = req.headers.cookie;
  if (!rawCookies) return undefined;

  for (const part of rawCookies.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (name === config.authCookieName) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return undefined;
};
