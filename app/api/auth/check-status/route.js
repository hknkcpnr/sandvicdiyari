import { db } from '@/lib/db';
import { rawPrisma } from '@/lib/prisma';
import { jsonSuccess, handleApiError, ValidationError } from '@/lib/security/errors';
import { signJwtToken } from '@/lib/security/auth';
import { sanitizeEmailOrUsername } from '@/lib/security/validation';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawEmail = searchParams.get('email') || '';
    const rawPhone = searchParams.get('phone') || '';

    if (!rawEmail && !rawPhone) {
      throw new ValidationError('E-posta veya telefon numarası gereklidir.');
    }

    const cleanEmail = rawEmail ? sanitizeEmailOrUsername(rawEmail, true, '/api/auth/check-status') : '';
    const cleanPhoneDigits = rawPhone.replace(/\D/g, '');

    // 1. Prisma / Supabase PostgreSQL
    let dbUser = null;
    let pgConnected = false;
    try {
      if (rawPrisma && rawPrisma.user) {
        dbUser = await rawPrisma.user.findFirst({
          where: {
            OR: [
              ...(cleanEmail ? [{ email: { equals: cleanEmail, mode: 'insensitive' } }] : []),
              ...(cleanPhoneDigits.length >= 10 ? [{ phone: { contains: cleanPhoneDigits.slice(-10) } }] : [])
            ]
          }
        });
        pgConnected = true;
      }
    } catch (e) {
      console.warn('Prisma check-status warning:', e.message);
    }

    // 2. Yerel DB yedeği (yalnızca Supabase erişilemezse)
    const localUser = !pgConnected && cleanEmail ? db.findUserByEmail(cleanEmail) : null;
    const user = dbUser || localUser;

    if (!user) {
      return jsonSuccess({
        approved: false,
        notFound: true,
        message: 'Kullanıcı kaydı bulunamadı.'
      });
    }

    if (user.isBlocked) {
      return jsonSuccess({
        approved: false,
        blocked: true,
        message: `Hesabınız yönetici tarafından engellenmiştir. Sebep: ${user.blockReason || 'Yönetici kısıtlaması'}`
      });
    }

    const isApproved = Boolean(user.phoneVerified ?? user.phone_verified);

    if (!isApproved) {
      return jsonSuccess({
        approved: false,
        message: 'Restoran yöneticisi onayı bekleniyor.'
      });
    }

    const { pass: _, passHash: __, ...userSafe } = user;
    const token = signJwtToken({
      sub: String(user.id || user.email),
      email: user.email,
      name: user.name,
      type: 'customer'
    });

    return jsonSuccess({
      approved: true,
      message: 'Hesabınız onaylandı! Oturum açılıyor.',
      data: {
        user: userSafe,
        token
      }
    });
  } catch (error) {
    return handleApiError(error, '/api/auth/check-status', request);
  }
}
