import crypto from 'crypto';
import {
  AuthenticationError,
  AuthorizationError,
  RateLimitError,
  getClientIp,
  logSecurityEvent
} from '@/lib/security/errors';
import type { PermissionCode } from '@/types/database';

const JWT_SECRET =
  process.env.JWT_SECRET ||
  'sd_prod_hmac_sha256_secret_key_2026_sandwich_diyari_secure_998877';

const SCRYPT_PREFIX = 'scrypt$';

// ============================================================================
// 1. CRYPTOGRAPHIC PASSWORD HASHING (Scrypt + Timing-Safe Verification)
// ============================================================================

export function isPasswordHashed(value: string): boolean {
  return typeof value === 'string' && value.startsWith(SCRYPT_PREFIX);
}

/**
 * Hashes a plaintext password using Node.js native crypto.scryptSync with a 16-byte salt
 */
export function hashPassword(plainPassword: string): string {
  const clean = String(plainPassword || '');
  if (isPasswordHashed(clean)) return clean;
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(clean, salt, 64).toString('hex');
  return `${SCRYPT_PREFIX}${salt}$${derivedKey}`;
}

/**
 * Verifies a plaintext password against either a scrypt hash or a legacy demo password
 * using constant-time comparison (crypto.timingSafeEqual) to prevent timing attacks.
 */
export function verifyPassword(plainPassword: string, storedPasswordOrHash: string): boolean {
  if (!plainPassword || !storedPasswordOrHash) return false;

  try {
    if (isPasswordHashed(storedPasswordOrHash)) {
      const parts = storedPasswordOrHash.split('$');
      if (parts.length !== 3) return false;
      const salt = parts[1];
      const storedHex = parts[2];
      const derivedBuf = crypto.scryptSync(String(plainPassword), salt, 64);
      const storedBuf = Buffer.from(storedHex, 'hex');
      if (derivedBuf.length !== storedBuf.length) return false;
      return crypto.timingSafeEqual(derivedBuf, storedBuf);
    }

    // Constant-time comparison for legacy demo passwords (e.g., admin123, mutfak123)
    const a = crypto.createHash('sha256').update(String(plainPassword)).digest();
    const b = crypto.createHash('sha256').update(String(storedPasswordOrHash)).digest();
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ============================================================================
// 2. HMAC-SHA256 SIGNED JWT TOKENS
// ============================================================================

export interface JwtPayload {
  sub: string;
  email: string;
  name?: string;
  type: 'customer' | 'admin';
  role?: string;
  roleId?: string;
  permissions?: PermissionCode[];
  iat: number;
  exp: number;
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input: string): string {
  let str = input.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64').toString('utf8');
}

/**
 * Generates an HMAC-SHA256 signed JWT token
 */
export function signJwtToken(
  claims: Omit<JwtPayload, 'iat' | 'exp'>,
  expiresInHours = 24
): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const nowSec = Math.floor(Date.now() / 1000);
  const payload: JwtPayload = {
    ...claims,
    iat: nowSec,
    exp: nowSec + expiresInHours * 3600
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(signingInput)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${signingInput}.${signature}`;
}

/**
 * Verifies an HMAC-SHA256 JWT token and checks expiration
 */
export function verifyJwtToken(token: string): JwtPayload | null {
  if (!token || typeof token !== 'string') return null;

  const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
  const parts = cleanToken.split('.');
  if (parts.length !== 3) return null;

  try {
    const [encodedHeader, encodedPayload, providedSignature] = parts;
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(signingInput)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    const sigA = Buffer.from(providedSignature);
    const sigB = Buffer.from(expectedSignature);
    if (sigA.length !== sigB.length || !crypto.timingSafeEqual(sigA, sigB)) {
      return null;
    }

    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as JwtPayload;
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp && nowSec > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Extracts a named cookie value from the Cookie header
 */
export function getCookieValue(request: Request, name: string): string | null {
  const cookieHeader = request.headers?.get('cookie');
  if (!cookieHeader) return null;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const k = pair.slice(0, idx).trim();
    if (k === name) {
      return decodeURIComponent(pair.slice(idx + 1).trim());
    }
  }
  return null;
}

/**
 * Builds an HttpOnly, SameSite=Lax cookie header string for auth tokens
 */
export function buildAuthCookieHeader(
  token: string,
  cookieName = 'sd_admin_token',
  maxAgeSeconds = 7 * 24 * 3600
): string {
  const isProd = process.env.NODE_ENV === 'production';
  return `${cookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${
    isProd ? '; Secure' : ''
  }`;
}

/**
 * Extracts and verifies a JWT token from Authorization header or HttpOnly cookies
 */
export function getOptionalAuthFromRequest(request: Request): JwtPayload | null {
  const authHeader = request.headers?.get('authorization');
  if (authHeader) {
    const verified = verifyJwtToken(authHeader);
    if (verified) return verified;
  }
  const adminCookie = getCookieValue(request, 'sd_admin_token');
  if (adminCookie) {
    const verified = verifyJwtToken(adminCookie);
    if (verified) return verified;
  }
  const userCookie = getCookieValue(request, 'sd_auth_token');
  if (userCookie) {
    const verified = verifyJwtToken(userCookie);
    if (verified) return verified;
  }
  return null;
}

/**
 * Protects sensitive API endpoints (/api/orders, /api/admin/users, /api/finance)
 * against direct browser address-bar access, external scrapers, and unauthorized requests.
 */
export function assertProtectedApiAccess(
  request: Request,
  options: { allowCustomerScoped?: boolean; endpoint?: string } = {}
): JwtPayload | null {
  const secFetchDest = (request.headers?.get('sec-fetch-dest') || '').toLowerCase();
  const secFetchMode = (request.headers?.get('sec-fetch-mode') || '').toLowerCase();

  // 1. Block direct browser address bar navigation (e.g. typing site.com/api/orders in URL bar)
  if (secFetchDest === 'document' || secFetchMode === 'navigate') {
    throw new AuthorizationError(
      'Güvenlik Politikası (KVKK): Bu veri adresine tarayıcı çubuğundan doğrudan erişim engellenmiştir.'
    );
  }

  // 2. Check signed JWT token (from Authorization header or HttpOnly cookie)
  const payload = getOptionalAuthFromRequest(request);
  if (payload?.type === 'admin') {
    return payload;
  }
  if (options.allowCustomerScoped && payload) {
    return payload;
  }

  // 3. Verify same-origin internal application context for active panel/customer sessions
  const secFetchSite = (request.headers?.get('sec-fetch-site') || '').toLowerCase();
  const referer = request.headers?.get('referer') || '';

  let refererPath = '';
  try {
    if (referer) {
      refererPath = new URL(referer).pathname.toLowerCase();
    }
  } catch {
    refererPath = '';
  }

  const isSameOrigin = secFetchSite === 'same-origin' || Boolean(refererPath);
  const isAdminPanelReferer =
    refererPath.startsWith('/panel') ||
    refererPath.startsWith('/yonetici') ||
    refererPath.startsWith('/kurye');

  if (isSameOrigin && isAdminPanelReferer) {
    return null;
  }

  if (options.allowCustomerScoped && isSameOrigin && refererPath.startsWith('/')) {
    return null;
  }

  throw new AuthenticationError(
    'Yetkisiz erişim: Müşteri ve sipariş verilerine erişmek için yetkili oturum gereklidir.'
  );
}

/**
 * Requires an authenticated admin token (or throws AuthenticationError / AuthorizationError)
 */
export function requireAdminPermission(
  request: Request,
  requiredPermission?: PermissionCode
): JwtPayload {
  const payload = getOptionalAuthFromRequest(request);
  if (!payload || payload.type !== 'admin') {
    throw new AuthenticationError('Yönetici oturumu doğrulanamadı. Lütfen tekrar giriş yapın.');
  }
  if (
    requiredPermission &&
    Array.isArray(payload.permissions) &&
    !payload.permissions.includes(requiredPermission)
  ) {
    throw new AuthorizationError(`Bu işlem için "${requiredPermission}" yetkisi gereklidir.`);
  }
  return payload;
}

// ============================================================================
// 3. SLIDING-WINDOW RATE LIMITER (Brute-Force & Flood Protection)
// ============================================================================

interface RateBucket {
  timestamps: number[];
  blockedUntil?: number;
}

const MAX_RATE_BUCKETS = 2000;
const rateBuckets = new Map<string, RateBucket>();
let lastRatePruneAt = 0;

function pruneRateBuckets(now: number, maxWindowMs: number): void {
  if (rateBuckets.size < MAX_RATE_BUCKETS && now - lastRatePruneAt < 60_000) {
    return;
  }
  lastRatePruneAt = now;
  const staleCutoff = now - Math.max(maxWindowMs, 5 * 60_000);
  for (const [key, b] of rateBuckets.entries()) {
    const blockedActive = Boolean(b.blockedUntil && now < b.blockedUntil);
    const hasRecent = b.timestamps.length > 0 && b.timestamps[b.timestamps.length - 1] > staleCutoff;
    if (!blockedActive && !hasRecent) {
      rateBuckets.delete(key);
    }
  }
  // Hard cap: en eski girişleri temizleyerek bellek sızıntısını önle
  if (rateBuckets.size > MAX_RATE_BUCKETS) {
    const excess = rateBuckets.size - MAX_RATE_BUCKETS;
    let removed = 0;
    for (const key of rateBuckets.keys()) {
      rateBuckets.delete(key);
      removed += 1;
      if (removed >= excess) break;
    }
  }
}

export interface RateLimitConfig {
  keyPrefix: string;
  maxRequests: number;
  windowMs: number;
  blockDurationMs?: number;
}

export function checkRateLimit(request: Request, config: RateLimitConfig): void {
  const ip = getClientIp(request);
  const bucketKey = `${config.keyPrefix}:${ip}`;
  const now = Date.now();
  pruneRateBuckets(now, config.windowMs);

  let bucket = rateBuckets.get(bucketKey);
  if (!bucket) {
    bucket = { timestamps: [] };
    rateBuckets.set(bucketKey, bucket);
  }

  if (bucket.blockedUntil && now < bucket.blockedUntil) {
    const retrySec = Math.ceil((bucket.blockedUntil - now) / 1000);
    logSecurityEvent({
      level: 'WARN',
      category: 'RATE_LIMIT',
      endpoint: config.keyPrefix,
      ip,
      message: `Hız sınırı (Rate Limit) aşıldı. ${retrySec} sn engellendi.`
    });
    throw new RateLimitError(
      `Çok fazla deneme yaptınız. Lütfen ${retrySec} saniye sonra tekrar deneyin.`,
      retrySec
    );
  }

  // Keep only timestamps within the active window
  const cutoff = now - config.windowMs;
  bucket.timestamps = bucket.timestamps.filter(ts => ts > cutoff);

  if (bucket.timestamps.length >= config.maxRequests) {
    const blockMs = config.blockDurationMs || config.windowMs;
    bucket.blockedUntil = now + blockMs;
    const retrySec = Math.ceil(blockMs / 1000);
    logSecurityEvent({
      level: 'WARN',
      category: 'RATE_LIMIT',
      endpoint: config.keyPrefix,
      ip,
      message: `Maksimum istek sınırı (${config.maxRequests}) aşıldı.`
    });
    throw new RateLimitError(
      `İstek limiti aşıldı (${config.maxRequests} istek). Lütfen ${retrySec} saniye bekleyin.`,
      retrySec
    );
  }

  bucket.timestamps.push(now);
}

