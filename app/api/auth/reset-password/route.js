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
    const cleanLower = identifier.toLowerCase();
    const normalizedPhone = cleanDigits.length >= 10 ? toWhatsAppPhone(identifier) : '';

    // Kullanıcı kaydını bularak diğer anahtarları (e-posta veya telefon) da arama listesine ekleyelim
    let matchedUser = null;
    try {
      if (rawPrisma && rawPrisma.user) {
        matchedUser = await rawPrisma.user.findFirst({
          where: {
            OR: [
              { email: { equals: cleanLower, mode: 'insensitive' } },
              { email: { equals: `${cleanLower}@sandwichdiyari.com`, mode: 'insensitive' } },
              ...(cleanDigits.length >= 10 ? [{ phone: { contains: cleanDigits.slice(-10) } }] : [])
            ]
          }
        });
      }
    } catch (e) {}

    if (!matchedUser) {
      matchedUser = db.findUserByEmail(identifier);
    }

    const candidateKeys = Array.from(
      new Set(
        [
          cleanLower,
          normalizedPhone,
          cleanDigits.length >= 10 ? cleanDigits : '',
          matchedUser?.email ? matchedUser.email.toLowerCase() : '',
          matchedUser?.phone ? matchedUser.phone.replace(/\D/g, '') : '',
          matchedUser?.phone ? toWhatsAppPhone(matchedUser.phone) : ''
        ].filter(Boolean)
      )
    );

    // 2. Doğrulama Kodunu Kontrol Et (Önce PostgreSQL, sonra Yerel DB)
    let otpValid = false;

    // A) PostgreSQL (Prisma) Kontrolü
    try {
      if (rawPrisma && rawPrisma.phoneOtp) {
        const pgRecords = await rawPrisma.phoneOtp.findMany({
          where: {
            phone: { in: candidateKeys },
            usedAt: null
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        });

        for (const rec of pgRecords) {
          const expiresAtMs = new Date(rec.expiresAt).getTime();
          // 60 saniyelik tolerans payı ile süre kontrolü
          if (Date.now() <= expiresAtMs + 60 * 1000) {
            if (verifyOtpHash(rec.phone, code, rec.otpHash)) {
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

    // B) Yerel DB Yedek Kontrolü
    if (!otpValid) {
      for (const key of candidateKeys) {
        const record = db.getLatestPhoneOtp(key);
        if (record && !record.usedAt) {
          const expiresAtMs = new Date(record.expiresAt).getTime();
          if (Date.now() <= expiresAtMs + 60 * 1000) {
            if (verifyOtpHash(key, code, record.otpHash)) {
              otpValid = true;
              record.usedAt = new Date().toISOString();
              break;
            }
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

