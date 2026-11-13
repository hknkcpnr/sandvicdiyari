import { db } from '@/lib/db';
import { rawPrisma } from '@/lib/prisma';
import {
  ValidationError,
  handleApiError,
  jsonSuccess,
  parseJsonBody
} from '@/lib/security/errors';
import { checkRateLimit, hashPassword } from '@/lib/security/auth';
import { toWhatsAppPhone } from '@/lib/phoneUtils';
import { verifyOtpHash } from '@/lib/security/whatsapp';

export async function POST(request) {
  try {
    // 1. IP bazlı Rate Limit kontrolü (1 dakikada maks 10 istek)
    checkRateLimit(request, {
      keyPrefix: 'POST:/api/auth/reset-password',
      maxRequests: 10,
      windowMs: 60 * 1000
    });

    const body = await parseJsonBody(request);
    const identifier = String(body.identifier || body.phone || body.email || '').trim();
    const code = String(body.code || '').trim();
    const newPassword = String(body.newPassword || body.password || '').trim();

    if (!identifier) {
      throw new ValidationError('Telefon veya e-posta adresi zorunludur.');
    }

    if (!code || code.length !== 6) {
      throw new ValidationError('Lütfen 6 haneli doğrulama kodunu eksiksiz giriniz.');
    }

    if (!newPassword || newPassword.length < 4) {
      throw new ValidationError('Yeni şifreniz en az 4 karakterden oluşmalıdır.');
    }

    const cleanDigits = identifier.replace(/\D/g, '');
    const normalizedPhone = cleanDigits.length >= 10 ? toWhatsAppPhone(identifier) : '';

    // 2. Doğrulama Kodunu Kontrol Et (Hem telefon hem e-posta destekli)
    let otpValid = false;
    const targetKey = normalizedPhone || identifier.toLowerCase();
    const record = db.getLatestPhoneOtp(targetKey);
    if (record && !record.usedAt) {
      const expiresAtMs = new Date(record.expiresAt).getTime();
      if (Date.now() <= expiresAtMs) {
        if (verifyOtpHash(targetKey, code, record.otpHash)) {
          otpValid = true;
          record.usedAt = new Date().toISOString();
        }
      }
    }

    if (!otpValid) {
      throw new ValidationError('Girdiğiniz doğrulama kodu geçersiz veya süresi dolmuş. Lütfen tekrar deneyiniz.');
    }

    // 3. Şifreyi Hash'le ve Kaydet
    const passHash = hashPassword(newPassword);
    let updated = false;

    // A) PostgreSQL / Prisma Güncelleme
    try {
      if (rawPrisma && rawPrisma.user) {
        const cleanLower = identifier.toLowerCase();
        const res = await rawPrisma.user.updateMany({
          where: {
            OR: [
              { email: { equals: cleanLower, mode: 'insensitive' } },
              { email: { equals: `${cleanLower}@sandwichdiyari.com`, mode: 'insensitive' } },
              ...(cleanDigits.length >= 10 ? [{ phone: { contains: cleanDigits.slice(-10) } }] : [])
            ]
          },
          data: {
            passHash,
            updatedAt: new Date()
          }
        });
        if (res.count > 0) updated = true;
      }
    } catch (pgErr) {
      console.warn('Prisma reset-password update warning:', pgErr.message);
    }

    // B) Yerel DB Güncelleme (Her iki ortamla tam senkronize)
    const localUpdated = db.updateUserPassword(identifier, newPassword);
    if (localUpdated) updated = true;

    if (!updated) {
      throw new ValidationError('Kullanıcı hesabı bulunamadı veya güncellenemedi.');
    }

    return jsonSuccess({
      message: 'Şifreniz başarıyla yenilendi! Yeni şifrenizle giriş yapabilirsiniz.',
      data: {
        success: true
      }
    });
  } catch (error) {
    return handleApiError(error, '/api/auth/reset-password', request);
  }
}

