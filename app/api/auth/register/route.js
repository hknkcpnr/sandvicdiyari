import crypto from 'crypto';
import { db } from '@/lib/db';
import { rawPrisma } from '@/lib/prisma';
import { invalidateAdminUsersServerCache } from '@/lib/productCache';
import {
  ConflictError,
  ValidationError,
  handleApiError,
  jsonSuccess,
  parseJsonBody
} from '@/lib/security/errors';
import { checkRateLimit, hashPassword } from '@/lib/security/auth';
import { hashOtp } from '@/lib/security/whatsapp';
import { sendEmailVerificationCode } from '@/lib/email';
import {
  sanitizeEmailOrUsername,
  sanitizePhone,
  sanitizeText
} from '@/lib/security/validation';

export async function POST(request) {
  try {
    checkRateLimit(request, {
      keyPrefix: 'POST:/api/auth/register',
      maxRequests: 10,
      windowMs: 60 * 1000
    });

    const body = await parseJsonBody(request);
    const name = sanitizeText(body.name, 120, 'Ad Soyad', '/api/auth/register');
    const email = sanitizeEmailOrUsername(body.email, false, '/api/auth/register');
    const phone = sanitizePhone(body.phone || '', false);
    const address = sanitizeText(body.address || '', 400, 'Adres', '/api/auth/register');
    const pass = String(body.pass || '');

    if (!name || name.length < 2) {
      throw new ValidationError('Lütfen geçerli bir Ad Soyad giriniz.');
    }
    if (!pass || pass.length < 4) {
      throw new ValidationError('Şifre en az 4 karakter olmalıdır.');
    }

    let pgConnected = false;
    let existingPrisma = null;

    try {
      if (rawPrisma && rawPrisma.user) {
        existingPrisma = await rawPrisma.user.findFirst({
          where: {
            email: { equals: email, mode: 'insensitive' }
          }
        });
        pgConnected = true;
      }
    } catch (e) {
      console.warn('Prisma register lookup warning:', e.message);
    }

    if (pgConnected) {
      if (existingPrisma) {
        throw new ConflictError('Bu e-posta adresi ile zaten bir hesap mevcut.');
      }
    } else {
      const existingLocal = db.findUserByEmail(email);
      if (existingLocal) {
        throw new ConflictError('Bu e-posta adresi ile zaten bir hesap mevcut.');
      }
    }

    // Yeni kayıt: Restoran sahibi yönetim panelinden onaylayana kadar phoneVerified = false
    const phoneVerified = false;
    const newId = `u_${Date.now()}`;
    const passHash = hashPassword(pass);

    let newUser = null;
    try {
      if (rawPrisma && rawPrisma.user) {
        const created = await rawPrisma.user.create({
          data: {
            id: newId,
            name,
            email,
            phone: phone || '',
            address: address || '',
            passHash,
            phoneVerified: false,
            phoneVerifiedAt: null,
            isBlocked: false,
            blockReason: '',
            notifications: []
          }
        });
        newUser = {
          id: created.id,
          name: created.name,
          email: created.email,
          phone: created.phone,
          address: created.address,
          phoneVerified: created.phoneVerified,
          isBlocked: created.isBlocked,
          createdAt: created.createdAt
        };
      }
    } catch (e) {
      console.warn('Prisma register create warning:', e.message);
    }

    // Yerel DB yedeğine de senkronize et (tek kayıt)
    let localCreated = null;
    try {
      const existingLocal = db.findUserByEmail(email);
      if (!existingLocal) {
        localCreated = db.createUser({
          name,
          email,
          phone,
          phoneVerified,
          address,
          pass
        });
      }
    } catch (e) {}

    const finalRecord = newUser || localCreated || {
      id: newId,
      name,
      email,
      phone,
      address,
      phoneVerified: false
    };
    const { pass: _, passHash: __, ...userSafe } = finalRecord;
    invalidateAdminUsersServerCache();

    // 6 Haneli E-Posta Doğrulama Kodu Üret & Gönder
    const targetEmail = String(userSafe.email || email).trim().toLowerCase();
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
      console.warn('[PostgreSQL Register Verify OTP Save Warning]', pgOtpErr.message);
    }

    let emailSent = false;
    try {
      const emailRes = await sendEmailVerificationCode({
        toEmail: targetEmail,
        userName: name,
        verificationCode: otpCode
      });
      emailSent = Boolean(emailRes?.success);
    } catch (mailErr) {
      console.warn('[Register Verification Email Warning]', mailErr.message);
    }

    return jsonSuccess(
      {
        message: emailSent
          ? 'Kaydınız alındı! E-posta adresinize gönderilen 6 haneli doğrulama kodunu giriniz.'
          : 'Kayıt talebiniz alındı! E-posta doğrulaması veya WhatsApp onayı ile hesabınızı aktifleştirebilirsiniz.',
        pendingApproval: true,
        requiresEmailVerification: true,
        emailSent,
        data: {
          user: userSafe
        }
      },
      201
    );
  } catch (error) {
    return handleApiError(error, '/api/auth/register', request);
  }
}
