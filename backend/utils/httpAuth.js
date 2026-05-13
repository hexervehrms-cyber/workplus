/**
 * Bearer + httpOnly cookie auth helpers (access token in cookie `wp_at`).
 */

export const ACCESS_TOKEN_COOKIE = 'wp_at';

/**
 * @param {string | undefined} cookieHeader
 * @returns {Record<string, string>}
 */
export function parseCookies(cookieHeader) {
  if (!cookieHeader || typeof cookieHeader !== 'string') return {};
  const out = {};
  for (const part of cookieHeader.split(';')) {
    const p = part.trim();
    if (!p) continue;
    const eq = p.indexOf('=');
    if (eq === -1) continue;
    const k = p.slice(0, eq).trim();
    const v = p.slice(eq + 1).trim();
    try {
      out[decodeURIComponent(k)] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Prefer Authorization Bearer; fall back to httpOnly access cookie.
 * @param {import('express').Request} req
 * @returns {string | null}
 */
export function getBearerOrCookieAccessToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const parts = authHeader.trim().split(/\s+/);
    if (parts[0]?.toLowerCase() === 'bearer' && parts[1]) {
      return parts[1];
    }
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies[ACCESS_TOKEN_COOKIE] || null;
}

function normalizeSameSite(val, isProd) {
  const fallback = isProd ? 'None' : 'Lax';
  if (!val || typeof val !== 'string') return fallback;
  const s = val.trim().toLowerCase();
  if (s === 'none') return 'None';
  if (s === 'strict') return 'Strict';
  if (s === 'lax') return 'Lax';
  return fallback;
}

/**
 * @param {import('express').Response} res
 * @param {string} token
 * @param {number} maxAgeSec
 */
export function setAccessTokenCookie(res, token, maxAgeSec = 24 * 60 * 60) {
  const isProd = process.env.NODE_ENV === 'production';
  const sameSite = normalizeSameSite(process.env.AUTH_COOKIE_SAMESITE, isProd);
  const secure =
    process.env.AUTH_COOKIE_SECURE !== 'false' && (isProd || sameSite === 'None');
  const parts = [
    `${ACCESS_TOKEN_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${maxAgeSec}`,
    'HttpOnly',
    `SameSite=${sameSite}`
  ];
  if (secure) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}

/**
 * Clear access cookie (must match Path / SameSite / Secure pattern used when set).
 * @param {import('express').Response} res
 */
export function clearAccessTokenCookie(res) {
  const isProd = process.env.NODE_ENV === 'production';
  const sameSite = normalizeSameSite(process.env.AUTH_COOKIE_SAMESITE, isProd);
  const secure =
    process.env.AUTH_COOKIE_SECURE !== 'false' && (isProd || sameSite === 'None');
  const parts = [
    `${ACCESS_TOKEN_COOKIE}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    `SameSite=${sameSite}`
  ];
  if (secure) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}
