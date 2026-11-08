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
import { checkRateLimit, signJwtToken, verifyPassword } from '@/lib/security/auth';
import { sanitizeEmailOrUsername } from '@/lib/security/validation';

export async function POST(request) {
  try {
    checkRateLimit(request, {
      keyPrefix: 'POST:/api/auth/login',
      maxRequests: 20,
      windowMs: 60 * 1000
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

        if (pgUser) {
          const passOk =
            verifyPassword(pass, pgUser.passHash) ||
            pgUser.passHash === pass;

          if (passOk) {
            const localUser = db.findUserByEmail(pgUser.email) || {};
            user = {
              ...localUser,
              id: pgUser.id,
              name: pgUser.name,
              email: pgUser.email,
              phone: pgUser.phone,
              address: pgUser.address,
              phoneVerified: Boolean(pgUser.phoneVerified ?? localUser.phoneVerified),
              phoneVerifiedAt: pgUser.phoneVerifiedAt || localUser.phoneVerifiedAt,
              isBlocked: Boolean(localUser.isBlocked),
              blockReason: localUser.blockReason
            };
          }
        }
      }
    } catch (pgErr) {
      // Fallback
    }

    // 2. Yerel DB müşteri sorgusu
    if (!user) {
      user = orm.executePrepared(
        'User',
        'SELECT',
        'SELECT * FROM "users" WHERE "email" = $1 OR "email" = $2 LIMIT 1',
        [email, identifier],
        () => db.authenticateUser(rawInput, pass) || db.authenticateUser(identifier, pass) || db.authenticateUser(email, pass)
      );
    }

    // 3. Müşteri olarak bulunamadıysa: Yönetici / Personel hesaplarını da kontrol et!
    // (Yöneticiler veya personel ana siteden oturum açmak istediğinde sorunsuz giriş yapabilsin)
    if (!user) {
      // Prisma Admin sorgusu
      try {
        if (rawPrisma && rawPrisma.adminUser) {
          const cleanDigits = rawInput.replace(/\D/g, '');
          const pgAdmin = await rawPrisma.adminUser.findFirst({
            where: {
              OR: [
                { email: { equals: identifier, mode: 'insensitive' } },
                { email: { startsWith: identifier, mode: 'insensitive' } },
                { name: { equals: rawInput, mode: 'insensitive' } },
                ...(cleanDigits.length >= 10 ? [{ phone: { contains: cleanDigits.slice(-10) } }] : [])
              ]
            },
            include: { role: true }
          });

          if (pgAdmin && (verifyPassword(pass, pgAdmin.passHash) || pgAdmin.passHash === pass)) {
            if (pgAdmin.isActive === false) {
              throw new AuthenticationError('Bu kullanıcı hesabı pasif durumdadır.');
            }
            user = {
              id: pgAdmin.id,
              name: pgAdmin.name,
              email: pgAdmin.email,
              phone: pgAdmin.phone,
              role: pgAdmin.role?.name || pgAdmin.roleName,
              roleId: pgAdmin.roleId,
              permissions: pgAdmin.role?.permissions || [],
              phoneVerified: true,
              type: 'admin'
            };
          }
        }
      } catch (err) {
        if (err instanceof AuthenticationError) throw err;
      }

      // Yerel DB Admin kontrolü
      if (!user) {
        const adminAuth = db.authenticateAdmin(rawInput, pass) || db.authenticateAdmin(identifier, pass) || db.authenticateAdmin(email, pass);
        if (adminAuth) {
          user = {
            id: adminAuth.id,
            name: adminAuth.name,
            email: adminAuth.email,
            phone: adminAuth.phone || '',
            role: adminAuth.role,
            roleId: adminAuth.roleId,
            permissions: adminAuth.permissions || [],
            phoneVerified: true,
            type: 'admin'
          };
        }
      }
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
