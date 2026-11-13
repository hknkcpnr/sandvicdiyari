import { db } from '@/lib/db';
import { rawPrisma } from '@/lib/prisma';
import {
  ValidationError,
  handleApiError,
  jsonSuccess,
  parseJsonBody
} from '@/lib/security/errors';
import { checkRateLimit, hashPassword } from '@/lib/security/auth';
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
    const email = String(body.email || body.identifier || '').trim().toLowerCase();
    const code = String(body.code || '').trim();
    const newPassword = String(body.newPassword || body.password || '').trim();

    if (!email || !email.includes('@')) {
      throw new ValidationError('Lütfen geçerli bir e-posta adresi giriniz.');
    }

    if (!code || code.length !== 6) {
      throw new ValidationError('Lütfen 6 haneli doğrulama kodunu eksiksiz giriniz.');
    }

    if (!newPassword || newPassword.length < 4) {
      throw new ValidationError('Yeni şifreniz en az 4 karakterden oluşmalıdır.');
    }

    // 2. Doğrulama Kodunu Kontrol Et (Önce PostgreSQL, sonra Yerel DB)
    let otpValid = false;

    // A) PostgreSQL (Prisma) Kontrolü
    try {
      if (rawPrisma && rawPrisma.phoneOtp) {
        const pgRecords = await rawPrisma.phoneOtp.findMany({
          where: {
            phone: email,
            usedAt: null
          },
          orderBy: { createdAt: 'desc' },
          take: 5
        });

        for (const rec of pgRecords) {
          const expiresAtMs = new Date(rec.expiresAt).getTime();
          // 60 saniyelik tolerans payı ile süre kontrolü
          if (Date.now() <= expiresAtMs + 60 * 1000) {
            if (verifyOtpHash(email, code, rec.otpHash)) {
              otpValid = true;
              await rawPrisma.phoneOtp.update({
                where: { id: rec.id },
                data: { usedAt: new Date() }
              });
              break;
            }
          }
        }
      }
    } catch (pgOtpErr) {
      console.warn('[PostgreSQL PhoneOtp Verify Warning]', pgOtpErr.message);
    }

    // B) Yerel DB Kontrolü
    if (!otpValid) {
      const record = db.getLatestPhoneOtp(email);
      if (record && !record.usedAt) {
        const expiresAtMs = new Date(record.expiresAt).getTime();
        if (Date.now() <= expiresAtMs + 60 * 1000) {
          if (verifyOtpHash(email, code, record.otpHash)) {
            otpValid = true;
            record.usedAt = new Date().toISOString();
          }
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
        const res = await rawPrisma.user.updateMany({
          where: {
            OR: [
              { email: { equals: email, mode: 'insensitive' } },
              { email: { equals: `${email}@sandwichdiyari.com`, mode: 'insensitive' } }
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
    const localUpdated = db.updateUserPassword(email, newPassword);
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

