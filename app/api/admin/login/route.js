import { db } from '@/lib/db';
import { orm } from '@/lib/orm/postgresEngine';
import {
  AuthenticationError,
  AuthorizationError,
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
      keyPrefix: 'POST:/api/admin/login',
      maxRequests: 15,
      windowMs: 60 * 1000
    });

    const body = await parseJsonBody(request);
    const identifier = body.username || body.email || '';
    const email = sanitizeEmailOrUsername(identifier, true, '/api/admin/login');
    const pass = String(body.pass || body.password || '');

    if (!pass) {
      throw new ValidationError('Kullanıcı adı ve şifre zorunludur.');
    }

    let authenticatedAdmin = null;
    try {
      authenticatedAdmin = orm.executePrepared(
        'AdminUser',
        'SELECT',
        'SELECT "admin_users".*, "roles"."permissions", "roles"."color" FROM "admin_users" INNER JOIN "roles" ON "admin_users"."role_id" = "roles"."id" WHERE "email" = $1 LIMIT 1',
        [email],
        () => db.authenticateAdmin(email, pass)
      );
    } catch (authErr) {
      throw new AuthorizationError(authErr.message);
    }

    if (!authenticatedAdmin) {
      throw new AuthenticationError(
        'Geçersiz kullanıcı adı veya şifre!'
      );
    }

    const token = signJwtToken({
      sub: authenticatedAdmin.id,
      email: authenticatedAdmin.email,
      name: authenticatedAdmin.name,
      type: 'admin',
      role: authenticatedAdmin.role,
      roleId: authenticatedAdmin.roleId,
      permissions: authenticatedAdmin.permissions
    });

    return jsonSuccess({
      message: 'Yönetim paneline giriş başarılı!',
      data: {
        admin: authenticatedAdmin,
        token
      }
    });
  } catch (error) {
    return handleApiError(error, '/api/admin/login', request);
  }
}
