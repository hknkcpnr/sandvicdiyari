import { db } from '@/lib/db';
import { rawPrisma } from '@/lib/prisma';
import { invalidateAdminUsersServerCache } from '@/lib/productCache';
import {
  AuthenticationError,
  ValidationError,
  handleApiError,
  jsonSuccess,
  parseJsonBody
} from '@/lib/security/errors';
import { buildAuthCookieHeader, checkRateLimit, signJwtToken } from '@/lib/security/auth';
import { verifyOtpHash } from '@/lib/security/whatsapp';

export async function POST(request) {
  try {
    checkRateLimit(request, {
      keyPrefix: 'POST:/api/auth/verify-email',
      maxRequests: 10,
      windowMs: 60 * 1000
    });

    const body = await parseJsonBody(request);
    const cleanEmail = String(body.email || '').trim().toLowerCase();
    const cleanCode = String(body.code || '').replace(/\D/g, '').trim();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new ValidationError('Lütfen geçerli bir e-posta adresi giriniz.');
    }

    if (!cleanCode || cleanCode.length !== 6) {
      throw new ValidationError('Lütfen e-postanıza gelen 6 haneli doğrulama kodunu eksiksiz giriniz.');
    }

    const otpKey = `verify:${cleanEmail}`;
    let otpValid = false;

    // 1. PostgreSQL (Prisma) OTP Kontrolü
    try {
      if (rawPrisma && rawPrisma.phoneOtp) {
        const pgRecords = await rawPrisma.phoneOtp.findMany({
          where: {
            phone: otpKey,
            usedAt: null
          },
          orderBy: { createdAt: 'desc' },
          take: 5
        });

        for (const rec of pgRecords) {
          const expiresAtMs = new Date(rec.expiresAt).getTime();
          if (Date.now() <= expiresAtMs + 60 * 1000) {
            if (verifyOtpHash(otpKey, cleanCode, rec.otpHash)) {
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
      console.warn('[PostgreSQL VerifyEmail OTP Warning]', pgOtpErr.message);
    }

    // 2. Yerel DB OTP Fallback Kontrolü
    if (!otpValid) {
      const record = db.getLatestPhoneOtp(otpKey);
      if (record && !record.usedAt) {
        const expiresAtMs = new Date(record.expiresAt).getTime();
        if (Date.now() <= expiresAtMs + 60 * 1000) {
          if (verifyOtpHash(otpKey, cleanCode, record.otpHash)) {
            otpValid = true;
            db.markOtpUsed(record.id);
          }
        }
      }
    }

    if (!otpValid) {
      throw new ValidationError(
        'Girdiğiniz doğrulama kodu geçersiz veya süresi dolmuş. Lütfen tekrar deneyiniz veya yeni kod isteyiniz.'
      );
    }

    // 3. Kullanıcıyı Doğrulanmış (phoneVerified = true) Olarak İşaretle
    try {
      if (rawPrisma && rawPrisma.user) {
        await rawPrisma.user.updateMany({
          where: {
            email: { equals: cleanEmail, mode: 'insensitive' }
          },
          data: {
            phoneVerified: true,
            phoneVerifiedAt: new Date(),
            updatedAt: new Date()
          }
        });
      }
    } catch (pgUpdateErr) {
      console.warn('[Prisma VerifyEmail User Update Warning]', pgUpdateErr.message);
    }

    try {
      db.updateUserPhoneVerified(cleanEmail, true);
    } catch {}

    // 4. Güncel Kullanıcı Kaydını Al
    let verifiedUser = null;
    try {
      if (rawPrisma && rawPrisma.user) {
        const pgUser = await rawPrisma.user.findFirst({
          where: {
            email: { equals: cleanEmail, mode: 'insensitive' }
          }
        });
        if (pgUser) {
          verifiedUser = {
            id: pgUser.id,
            name: pgUser.name,
            email: pgUser.email,
            phone: pgUser.phone || '',
            address: pgUser.address || '',
            phoneVerified: Boolean(pgUser.phoneVerified),
            phoneVerifiedAt: pgUser.phoneVerifiedAt || null,
            isBlocked: Boolean(pgUser.isBlocked),
            blockReason: pgUser.blockReason || '',
            notifications: Array.isArray(pgUser.notifications) ? pgUser.notifications : []
          };
        }
      }
    } catch {}

    if (!verifiedUser) {
      verifiedUser = db.findUserByEmail(cleanEmail);
    }

    if (!verifiedUser) {
      throw new ValidationError('Kullanıcı hesabı bulunamadı.');
    }

    if (verifiedUser.isBlocked) {
      throw new AuthenticationError(
        `Hesabınız yönetici tarafından engellenmiştir. Sebep: ${verifiedUser.blockReason || 'Kullanım şartları ihlali.'}`
      );
    }

    invalidateAdminUsersServerCache();

    const { pass: _, passHash: __, ...userSafe } = verifiedUser;
    const token = signJwtToken(
      {
        sub: String(verifiedUser.id || verifiedUser.email),
        email: verifiedUser.email,
        name: verifiedUser.name,
        type: 'customer'
      },
      2
    );

    const response = jsonSuccess({
      verified: true,
      message: 'E-posta adresiniz başarıyla doğrulandı! Hoş geldiniz.',
      data: {
        user: userSafe,
        token
      }
    });
    response.headers.append('Set-Cookie', buildAuthCookieHeader(token, 'sd_auth_token', 2 * 3600));
    return response;
  } catch (error) {
    return handleApiError(error, '/api/auth/verify-email', request);
  }
}
