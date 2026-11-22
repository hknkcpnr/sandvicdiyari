import { db } from '@/lib/db';
import { rawPrisma } from '@/lib/prisma';
import { orm } from '@/lib/orm/postgresEngine';
import {
  AuthenticationError,
  ValidationError,
  handleApiError,
  jsonSuccess,
  parseJsonBody
} from '@/lib/security/errors';
import { buildAuthCookieHeader, checkRateLimit, signJwtToken, verifyPassword } from '@/lib/security/auth';
import { sanitizeEmailOrUsername } from '@/lib/security/validation';

export async function POST(request) {
  try {
    checkRateLimit(request, {
      keyPrefix: 'POST:/api/auth/login',
      maxRequests: 8,
      windowMs: 60 * 1000,
      blockDurationMs: 60 * 1000
    });

    const body = await parseJsonBody(request);
    const rawInput = String(body.email || body.username || '').trim();
    const identifier = sanitizeEmailOrUsername(rawInput, true, '/api/auth/login');
    const email = identifier.includes('@') ? identifier : `${identifier}@sandwichdiyari.com`;
    const pass = String(body.pass || body.password || '');

    if (!pass) {
      throw new ValidationError('E-posta ve şifre zorunludur.');
    }

    let user = null;
    let pgCustomerChecked = false;

    // 1. Prisma (PostgreSQL / Supabase) müşteri sorgusu
    try {
      if (rawPrisma && rawPrisma.user) {
        const cleanDigits = rawInput.replace(/\D/g, '');
        const pgUser = await rawPrisma.user.findFirst({
          where: {
            OR: [
              { email: { equals: email, mode: 'insensitive' } },
              { email: { equals: identifier, mode: 'insensitive' } },
              { name: { equals: rawInput, mode: 'insensitive' } },
              ...(cleanDigits.length >= 10 ? [{ phone: { contains: cleanDigits.slice(-10) } }] : [])
            ]
          }
        });
        pgCustomerChecked = true;

        if (pgUser) {
          const passOk =
            verifyPassword(pass, pgUser.passHash) ||
            pgUser.passHash === pass;

          if (passOk) {
            user = {
              id: pgUser.id,
              name: pgUser.name,
              email: pgUser.email,
              phone: pgUser.phone || '',
              address: pgUser.address || '',
              phoneVerified: Boolean(pgUser.phoneVerified),
              phoneVerifiedAt: pgUser.phoneVerifiedAt || null,
              isBlocked: Boolean(pgUser.isBlocked),
              blockReason: pgUser.blockReason || '',
              notifications: Array.isArray(pgUser.notifications) ? pgUser.notifications : []
            };
          }
        }
      }
    } catch (pgErr) {
      // Fallback
    }

    // 2. Yerel DB müşteri sorgusu (yalnızca Supabase erişilemezse)
    if (!user && !pgCustomerChecked) {
      user = orm.executePrepared(
        'User',
        'SELECT',
        'SELECT * FROM "users" WHERE "email" = $1 OR "email" = $2 LIMIT 1',
        [email, identifier],
        () => db.authenticateUser(rawInput, pass) || db.authenticateUser(identifier, pass) || db.authenticateUser(email, pass)
      );
    }

    if (!user) {
      throw new AuthenticationError('E-posta veya şifre hatalı.');
    }

    if (user.isBlocked) {
      throw new AuthenticationError(
        `Hesabınız yönetici tarafından engellenmiştir. Sebep: ${user.blockReason || 'Kullanım şartları ihlali.'}`
      );
    }

    const isAdmin =
      user.type === 'admin' ||
      String(user.email || '').toLowerCase().startsWith('admin') ||
      user.username === 'admin';

    const isApproved = Boolean(user.phoneVerified ?? user.phone_verified);

    if (!isAdmin && !isApproved) {
      return jsonSuccess({
        message: 'Hesabınız henüz restoran yöneticisi tarafından onaylanmamıştır. Lütfen WhatsApp üzerinden onay talebinizi iletiniz.',
        pendingApproval: true,
        data: {
          user: {
            name: user.name,
            email: user.email,
            phone: user.phone
          }
        }
      });
    }

    const { pass: _, passHash: __, ...userSafe } = user;
    const token = signJwtToken({
      sub: String(user.id || user.email),
      email: user.email,
      name: user.name,
      type: user.type === 'admin' ? 'admin' : 'customer'
    });

    const response = jsonSuccess({
      message: 'Giriş başarılı!',
      data: {
        user: userSafe,
        token
      }
    });
    response.headers.append('Set-Cookie', buildAuthCookieHeader(token, 'sd_auth_token'));
    if (isAdmin) {
      response.headers.append('Set-Cookie', buildAuthCookieHeader(token, 'sd_admin_token'));
    }
    return response;
  } catch (error) {
    return handleApiError(error, '/api/auth/login', request);
  }
}
