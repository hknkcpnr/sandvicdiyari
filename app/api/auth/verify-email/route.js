import { db } from '@/lib/db';
import { rawPrisma } from '@/lib/prisma';
import { invalidateAdminUsersServerCache } from '@/lib/productCache';
import {
  AuthenticationError,
  ConflictError,
  ValidationError,
  handleApiError,
  jsonSuccess,
  parseJsonBody
} from '@/lib/security/errors';
import { buildAuthCookieHeader, checkRateLimit, signJwtToken } from '@/lib/security/auth';
import { verifyOtpHash } from '@/lib/security/whatsapp';
import { verifyPendingRegistration } from '@/lib/pendingRegistration';

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
    const pendingToken = typeof body.pendingToken === 'string' ? body.pendingToken.trim() : '';

    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new ValidationError('Lütfen geçerli bir e-posta adresi giriniz.');
    }

    if (!cleanCode || cleanCode.length !== 6) {
      throw new ValidationError('Lütfen e-postanıza gelen 6 haneli doğrulama kodunu eksiksiz giriniz.');
    }

    const otpKey = `verify:${cleanEmail}`;
    let verifiedUser = null;

    if (pendingToken) {
      // YOL A: Henüz DB'ye kaydedilmemiş imzalı kayıt oturumu -> kodu doğrula ve ŞİMDİ kaydet
      const pending = verifyPendingRegistration(pendingToken);
      if (!pending || pending.email !== cleanEmail) {
        throw new ValidationError('Kayıt oturumunuzun süresi dolmuş. Lütfen kayıt formunu tekrar doldurunuz.');
      }

      if (!pending.otpHash || !verifyOtpHash(otpKey, cleanCode, pending.otpHash)) {
        throw new ValidationError(
          'Girdiğiniz doğrulama kodu geçersiz. Lütfen e-postanızdaki 6 haneli kodu kontrol ediniz.'
        );
      }

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
        console.warn('[Prisma VerifyEmail Lookup Warning]', pgErr.message);
      }

      if (pgConnected) {
        if (existingPg) {
          if (existingPg.isBlocked) {
            throw new AuthenticationError(
              `Hesabınız yönetici tarafından engellenmiştir. Sebep: ${existingPg.blockReason || 'Kullanım şartları ihlali.'}`
            );
          }
          if (existingPg.phoneVerified) {
            throw new ConflictError('Bu e-posta adresi ile zaten doğrulanmış bir hesap mevcut. Doğrudan giriş yapabilirsiniz.');
          }
          const updated = await rawPrisma.user.update({
            where: { id: existingPg.id },
            data: {
              phoneVerified: true,
              phoneVerifiedAt: new Date(),
              updatedAt: new Date()
            }
          });
          verifiedUser = {
            id: updated.id,
            name: updated.name,
            email: updated.email,
            phone: updated.phone || '',
            address: updated.address || '',
            phoneVerified: true,
            phoneVerifiedAt: updated.phoneVerifiedAt,
            isBlocked: Boolean(updated.isBlocked),
            blockReason: updated.blockReason || '',
            notifications: Array.isArray(updated.notifications) ? updated.notifications : []
          };
        } else {
          const created = await rawPrisma.user.create({
            data: {
              id: `u_${Date.now()}`,
              name: pending.name,
              email: cleanEmail,
              phone: pending.phone || '',
              address: pending.address || '',
              passHash: pending.passHash,
              phoneVerified: true,
              phoneVerifiedAt: new Date(),
              isBlocked: false,
              blockReason: '',
              notifications: []
            }
          });
          verifiedUser = {
            id: created.id,
            name: created.name,
            email: created.email,
            phone: created.phone || '',
            address: created.address || '',
            phoneVerified: true,
            phoneVerifiedAt: created.phoneVerifiedAt,
            isBlocked: false,
            blockReason: '',
            notifications: []
          };
        }
      }

      // Yerel DB yedeğine de senkronize et
      try {
        const existingLocal = db.findUserByEmail(cleanEmail);
        if (existingLocal) {
          if (!pgConnected && existingLocal.phoneVerified) {
            throw new ConflictError('Bu e-posta adresi ile zaten doğrulanmış bir hesap mevcut.');
          }
          const updatedLocal = db.updateUserPhoneVerified(cleanEmail, true);
          if (!verifiedUser) verifiedUser = updatedLocal;
        } else {
          const createdLocal = db.createUser({
            name: pending.name,
            email: cleanEmail,
            phone: pending.phone || '',
            phoneVerified: true,
            phoneVerifiedAt: new Date().toISOString(),
            address: pending.address || '',
            pass: pending.passHash
          });
          if (!verifiedUser) verifiedUser = createdLocal;
        }
      } catch (localErr) {
        if (localErr instanceof ConflictError) throw localErr;
      }
    } else {
      // YOL B: Önceden DB'de bekleyen kullanıcı doğrulaması
      let otpValid = false;

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
    }

    if (!verifiedUser) {
      throw new ValidationError('Kullanıcı hesabı oluşturulamadı.');
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
      message: 'E-posta adresiniz doğrulandı ve üyeliğiniz tamamlandı! Hoş geldiniz.',
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
