import { db } from '@/lib/db';
import { prisma } from '@/lib/prisma';
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

    const cleanEmail = rawEmail ? sanitizeEmailOrUsername(rawEmail, false, '/api/auth/check-status') : '';
    const cleanPhoneDigits = rawPhone.replace(/\D/g, '');

    // 1. Prisma / PostgreSQL
    let dbUser = null;
    try {
      if (prisma && prisma.user) {
        dbUser = await prisma.user.findFirst({
          where: {
            OR: [
              ...(cleanEmail ? [{ email: cleanEmail }] : []),
              ...(cleanPhoneDigits ? [{ phone: { contains: cleanPhoneDigits.slice(-10) } }] : [])
            ]
          }
        });
      }
    } catch (e) {}

    // 2. Yerel DB
    const localUser = cleanEmail ? db.findUserByEmail(cleanEmail) : null;
    const user = dbUser || localUser;

    if (!user) {
      return jsonSuccess({
        approved: false,
        notFound: true,
        message: 'Kullanıcı kaydı bulunamadı.'
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

