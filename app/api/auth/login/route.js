import { db } from '@/lib/db';
import { orm } from '@/lib/orm/postgresEngine';
import {
  AuthenticationError,
  ValidationError,
  handleApiError,
  jsonSuccess,
  parseJsonBody
} from '@/lib/security/errors';
import { checkRateLimit, signJwtToken } from '@/lib/security/auth';
import { sanitizeEmailOrUsername } from '@/lib/security/validation';

export async function POST(request) {
  try {
    checkRateLimit(request, {
      keyPrefix: 'POST:/api/auth/login',
      maxRequests: 12,
      windowMs: 60 * 1000
    });

    const body = await parseJsonBody(request);
    const rawInput = body.email || body.username || '';
    const identifier = sanitizeEmailOrUsername(rawInput, true, '/api/auth/login');
    const email = identifier.includes('@') ? identifier : `${identifier}@sandwichdiyari.com`;
    const pass = String(body.pass || body.password || '');

    if (!pass) {
      throw new ValidationError('E-posta ve şifre zorunludur.');
    }

    const user = orm.executePrepared(
      'User',
      'SELECT',
      'SELECT * FROM "users" WHERE "email" = $1 OR "email" = $2 LIMIT 1',
      [email, identifier],
      () => db.authenticateUser(identifier, pass) || db.authenticateUser(email, pass)
    );

    if (!user) {
      throw new AuthenticationError('E-posta veya şifre hatalı.');
    }

    if (user.isBlocked) {
      throw new AuthenticationError(
        `Hesabınız yönetici tarafından engellenmiştir. Sebep: ${user.blockReason || 'Kullanım şartları ihlali.'}`
      );
    }

    const { pass: _, ...userSafe } = user;
    const token = signJwtToken({
      sub: String(user.id || user.email),
      email: user.email,
      name: user.name,
      type: 'customer'
    });

    return jsonSuccess({
      message: 'Giriş başarılı!',
      data: {
        user: userSafe,
        token
      }
    });
  } catch (error) {
    return handleApiError(error, '/api/auth/login', request);
  }
}
