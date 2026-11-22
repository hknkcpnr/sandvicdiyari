import { db } from '@/lib/db';
import { rawPrisma } from '@/lib/prisma';
import { orm } from '@/lib/orm/postgresEngine';
import {
  AuthenticationError,
  AuthorizationError,
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
      keyPrefix: 'POST:/api/admin/login',
      maxRequests: 8,
      windowMs: 60 * 1000,
      blockDurationMs: 60 * 1000
    });

    const body = await parseJsonBody(request);
    const rawIdentifier = String(body.username || body.email || '').trim();
    const pass = String(body.pass || body.password || '');
    const portal = String(body.portal || '').trim().toLowerCase(); // 'yonetici' | 'panel' | 'kurye'

    if (!rawIdentifier || !pass) {
      throw new ValidationError('Kullanıcı adı / e-posta ve şifre zorunludur.');
    }

    const email = sanitizeEmailOrUsername(rawIdentifier, true, '/api/admin/login');

    let authenticatedAdmin = null;

    // 1. Prisma (PostgreSQL / Supabase) kontrolü
    try {
      if (rawPrisma && rawPrisma.adminUser) {
        const cleanInput = rawIdentifier.toLowerCase();
        const cleanWithDomain = cleanInput.includes('@')
          ? cleanInput
          : `${cleanInput}@sandwichdiyari.com`;
        const cleanDigits = rawIdentifier.replace(/\D/g, '');
        const pgUser = await rawPrisma.adminUser.findFirst({
          where: {
            OR: [
              { email: { equals: cleanInput, mode: 'insensitive' } },
              { email: { equals: cleanWithDomain, mode: 'insensitive' } },
              { name: { equals: rawIdentifier, mode: 'insensitive' } },
              ...(cleanDigits.length >= 10 ? [{ phone: { contains: cleanDigits.slice(-10) } }] : [])
            ]
          },
          include: { role: true }
        });

        if (pgUser) {
          const lowerEmail = String(pgUser.email || '').toLowerCase();
          const isOwner =
            lowerEmail.includes('hknkcpnr') ||
            lowerEmail === 'admin' ||
            lowerEmail === 'admin@sandwichdiyari.com' ||
            pgUser.roleId === 'role_super_admin' ||
            pgUser.role?.code === 'super_admin';

          // Güvenli şifre doğrulaması (Zamanlama saldırılarına karşı korumalı scrypt doğrulaması)
          const passOk = verifyPassword(pass, pgUser.passHash);

          if (passOk) {
            if (pgUser.isActive === false) {
              throw new AuthorizationError('Bu kullanıcı hesabı pasif durumdadır. Yönetici ile iletişime geçin.');
            }
            authenticatedAdmin = {
              id: pgUser.id,
              name: pgUser.name,
              email: pgUser.email,
              phone: pgUser.phone,
              role: isOwner ? 'Süper Yönetici' : (pgUser.role?.name || pgUser.roleName || 'Yetkili'),
              roleId: isOwner ? 'role_super_admin' : pgUser.roleId,
              roleColor: isOwner ? 'rose' : (pgUser.role?.color || 'rose'),
              permissions: isOwner
                ? ['overview', 'orders', 'delete_order', 'inventory', 'stock_update', 'products', 'product_add', 'product_edit', 'product_delete', 'options_manage', 'manage_prices', 'members', 'users', 'reviews', 'api', 'view_revenue', 'settings', 'site_content', 'courier_delivery']
                : (pgUser.role?.permissions || ['overview', 'orders', 'inventory', 'stock_update'])
            };
          }
        }
      }
    } catch (pgErr) {
      if (pgErr instanceof AuthorizationError) throw pgErr;
    }

    // 2. Yerel DB / Memory Cache kontrolü
    if (!authenticatedAdmin) {
      try {
        authenticatedAdmin = orm.executePrepared(
          'AdminUser',
          'SELECT',
          'SELECT "admin_users".*, "roles"."permissions", "roles"."color" FROM "admin_users" INNER JOIN "roles" ON "admin_users"."role_id" = "roles"."id" WHERE "email" = $1 LIMIT 1',
          [email],
          () => db.authenticateAdmin(rawIdentifier, pass) || db.authenticateAdmin(email, pass)
        );
      } catch (authErr) {
        throw new AuthorizationError(authErr.message);
      }
    }

    if (!authenticatedAdmin) {
      throw new AuthenticationError(
        'Geçersiz kullanıcı adı veya şifre!'
      );
    }

    // 3. PORTAL BAZLI YETKİ AYRIMI (/yonetici vs /panel vs /kurye)
    const perms = Array.isArray(authenticatedAdmin.permissions) ? authenticatedAdmin.permissions : [];
    const isSuperAdmin =
      authenticatedAdmin.roleId === 'role_super_admin' ||
      authenticatedAdmin.role === 'Süper Yönetici';
    const isCourierAccount =
      authenticatedAdmin.roleId === 'role_courier' ||
      (!isSuperAdmin &&
        (String(authenticatedAdmin.role || '').toLowerCase().includes('kurye') ||
          (perms.includes('courier_delivery') && !perms.includes('orders'))));

    if (portal === 'yonetici' && !isSuperAdmin) {
      throw new AuthorizationError(
        'Bu panel yalnızca Süper Yönetici (/yonetici) hesapları içindir. Restoran paneli için /panel, kurye paneli için /kurye adresini kullanınız.'
      );
    }

    if (portal === 'panel' && isCourierAccount) {
      throw new AuthorizationError(
        'Bu hesap Kurye Paneli (/kurye) kullanıcısıdır. Restoran Paneline (/panel) giriş yetkisi bulunmamaktadır.'
      );
    }

    if (
      portal === 'kurye' &&
      !isSuperAdmin &&
      !isCourierAccount &&
      !perms.includes('courier_delivery')
    ) {
      throw new AuthorizationError(
        'Bu hesap Restoran Paneli (/panel) kullanıcısıdır. Kurye Paneline (/kurye) giriş yetkisi bulunmamaktadır.'
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

    const response = jsonSuccess({
      message: 'Yönetim paneline giriş başarılı!',
      data: {
        admin: authenticatedAdmin,
        token
      }
    });
    response.headers.append('Set-Cookie', buildAuthCookieHeader(token, 'sd_admin_token'));
    return response;
  } catch (error) {
    return handleApiError(error, '/api/admin/login', request);
  }
}
