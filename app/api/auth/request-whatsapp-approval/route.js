import { db } from '@/lib/db';
import { rawPrisma } from '@/lib/prisma';
import { invalidateAdminUsersServerCache } from '@/lib/productCache';
import {
  ValidationError,
  handleApiError,
  jsonSuccess,
  parseJsonBody
} from '@/lib/security/errors';
import { checkRateLimit } from '@/lib/security/auth';
import { verifyPendingRegistration } from '@/lib/pendingRegistration';

export async function POST(request) {
  try {
    // Sıkı IP rate limit: DB'nin sahte WhatsApp onay talepleriyle doldurulmasını engeller
    checkRateLimit(request, {
      keyPrefix: 'POST:/api/auth/request-whatsapp-approval',
      maxRequests: 3,
      windowMs: 15 * 60 * 1000
    });

    const body = await parseJsonBody(request);
    const pendingToken = typeof body.pendingToken === 'string' ? body.pendingToken.trim() : '';

    const pending = verifyPendingRegistration(pendingToken);
    if (!pending) {
      throw new ValidationError('Kayıt oturumunuzun süresi dolmuş. Lütfen kayıt formunu tekrar doldurunuz.');
    }

    const cleanEmail = pending.email;
    let pgConnected = false;
    let existingPg = null;

    try {
      if (rawPrisma && rawPrisma.user) {
        existingPg = await rawPrisma.user.findFirst({
          where: {
            email: { equals: cleanEmail, mode: 'insensitive' }
          }
        });
        pgConnected = true;
      }
    } catch (pgErr) {
      console.warn('[Prisma RequestWhatsappApproval Lookup Warning]', pgErr.message);
    }

    if (pgConnected && existingPg) {
      if (existingPg.phoneVerified) {
        return jsonSuccess({
          alreadyVerified: true,
          message: 'Hesabınız zaten onaylı! Giriş yapabilirsiniz.'
        });
      }
      return jsonSuccess({
        created: false,
        pendingApproval: true,
        message: 'WhatsApp onay talebiniz zaten yöneticiye iletildi.'
      });
    }

    const existingLocal = !pgConnected ? db.findUserByEmail(cleanEmail) : null;
    if (existingLocal) {
      if (existingLocal.phoneVerified) {
        return jsonSuccess({
          alreadyVerified: true,
          message: 'Hesabınız zaten onaylı! Giriş yapabilirsiniz.'
        });
      }
      return jsonSuccess({
        created: false,
        pendingApproval: true,
        message: 'WhatsApp onay talebiniz zaten yöneticiye iletildi.'
      });
    }

    // Kullanıcı WhatsApp butonuna gerçekten tıkladığı anda yönetici onayı için bekleme kaydı oluşturulur
    if (pgConnected && rawPrisma && rawPrisma.user) {
      await rawPrisma.user.create({
        data: {
          id: `u_${Date.now()}`,
          name: pending.name,
          email: cleanEmail,
          phone: pending.phone || '',
          address: pending.address || '',
          passHash: pending.passHash,
          phoneVerified: false,
          phoneVerifiedAt: null,
          isBlocked: false,
          blockReason: '',
          notifications: []
        }
      });
    }

    try {
      if (!db.findUserByEmail(cleanEmail)) {
        db.createUser({
          name: pending.name,
          email: cleanEmail,
          phone: pending.phone || '',
          phoneVerified: false,
          address: pending.address || '',
          pass: pending.passHash
        });
      }
    } catch {}

    invalidateAdminUsersServerCache();

    return jsonSuccess(
      {
        created: true,
        pendingApproval: true,
        message: 'WhatsApp onay talebiniz yönetici paneline iletildi!'
      },
      201
    );
  } catch (error) {
    return handleApiError(error, '/api/auth/request-whatsapp-approval', request);
  }
}
