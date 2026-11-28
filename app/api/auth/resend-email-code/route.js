import crypto from 'crypto';
import { db } from '@/lib/db';
import { rawPrisma } from '@/lib/prisma';
import {
  ValidationError,
  handleApiError,
  jsonSuccess,
  parseJsonBody
} from '@/lib/security/errors';
import { checkRateLimit } from '@/lib/security/auth';
import { hashOtp } from '@/lib/security/whatsapp';
import { sendEmailVerificationCode } from '@/lib/email';

export async function POST(request) {
  try {
    checkRateLimit(request, {
      keyPrefix: 'POST:/api/auth/resend-email-code',
      maxRequests: 5,
      windowMs: 60 * 1000
    });

    const body = await parseJsonBody(request);
    const cleanEmail = String(body.email || '').trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new ValidationError('Lütfen geçerli bir e-posta adresi giriniz.');
    }

    let foundUser = null;
    try {
      if (rawPrisma && rawPrisma.user) {
        const pgUser = await rawPrisma.user.findFirst({
          where: {
            email: { equals: cleanEmail, mode: 'insensitive' }
          }
        });
        if (pgUser) {
          foundUser = {
            id: pgUser.id,
            name: pgUser.name,
            email: pgUser.email,
            phoneVerified: Boolean(pgUser.phoneVerified),
            isBlocked: Boolean(pgUser.isBlocked)
          };
        }
      }
    } catch (pgErr) {
      console.warn('[Prisma ResendEmailCode Lookup Warning]', pgErr.message);
    }

    if (!foundUser) {
      foundUser = db.findUserByEmail(cleanEmail);
    }

    if (!foundUser) {
      throw new ValidationError('Bu e-posta adresine kayıtlı bir hesap bulunamadı.');
    }

    if (foundUser.isBlocked) {
      throw new ValidationError('Hesabınız yönetici tarafından engellenmiştir.');
    }

    if (Boolean(foundUser.phoneVerified ?? foundUser.phone_verified)) {
      return jsonSuccess({
        alreadyVerified: true,
        message: 'Hesabınız zaten doğrulanmış! Doğrudan giriş yapabilirsiniz.'
      });
    }

    const targetEmail = String(foundUser.email || cleanEmail).trim().toLowerCase();
    const otpKey = `verify:${targetEmail}`;
    const otpCode = String(crypto.randomInt(100000, 999999));
    const expiresAt = Date.now() + 30 * 60 * 1000;
    const otpHash = hashOtp(otpKey, otpCode);

    try {
      db.savePhoneOtp({
        phone: otpKey,
        otpHash,
        expiresAt
      });
    } catch {}

    try {
      if (rawPrisma && rawPrisma.phoneOtp) {
        await rawPrisma.phoneOtp.create({
          data: {
            phone: otpKey,
            otpHash,
            expiresAt: new Date(expiresAt)
          }
        });
      }
    } catch (pgOtpErr) {
      console.warn('[PostgreSQL ResendEmailCode OTP Save Warning]', pgOtpErr.message);
    }

    const emailRes = await sendEmailVerificationCode({
      toEmail: targetEmail,
      userName: foundUser.name,
      verificationCode: otpCode
    });

    if (!emailRes.success) {
      throw new ValidationError('Doğrulama e-postası gönderilemedi. Lütfen biraz sonra tekrar deneyiniz.');
    }

    return jsonSuccess({
      message: 'Yeni 6 haneli doğrulama kodunuz e-posta adresinize gönderildi!',
      data: {
        email: targetEmail,
        emailSent: true
      }
    });
  } catch (error) {
    return handleApiError(error, '/api/auth/resend-email-code', request);
  }
}
