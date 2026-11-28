import crypto from 'crypto';
import { db } from '@/lib/db';
import { rawPrisma } from '@/lib/prisma';
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
import { validateEmailAddressServer } from '@/lib/serverEmailVerify';
import { getMailFailureMessage, signPendingRegistration } from '@/lib/pendingRegistration';
import {
  sanitizeEmailOrUsername,
  sanitizePhone,
  sanitizeText
} from '@/lib/security/validation';

export async function POST(request) {
  try {
    checkRateLimit(request, {
      keyPrefix: 'POST:/api/auth/register',
      maxRequests: 6,
      windowMs: 5 * 60 * 1000
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

    const emailValidation = await validateEmailAddressServer(email);
    if (!emailValidation.valid) {
      throw new ValidationError(emailValidation.error);
    }

    const cleanEmail = String(email).trim().toLowerCase();

    let pgConnected = false;
    let existingPrisma = null;

    try {
      if (rawPrisma && rawPrisma.user) {
        existingPrisma = await rawPrisma.user.findFirst({
          where: {
            email: { equals: cleanEmail, mode: 'insensitive' }
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
      const existingLocal = db.findUserByEmail(cleanEmail);
      if (existingLocal) {
        throw new ConflictError('Bu e-posta adresi ile zaten bir hesap mevcut.');
      }
    }

    // GÜVENLİK: Doğrulama tamamlanmadan veritabanına kesinlikle kayıt yazılmaz.
    const passHash = hashPassword(pass);
    const verificationMethod = body.verificationMethod === 'whatsapp' ? 'whatsapp' : 'email';

    if (verificationMethod === 'email') {
      const otpKey = `verify:${cleanEmail}`;
      const otpCode = String(crypto.randomInt(100000, 999999));
      const otpHash = hashOtp(otpKey, otpCode);

      const emailRes = await sendEmailVerificationCode({
        toEmail: cleanEmail,
        userName: name,
        verificationCode: otpCode
      });

      if (!emailRes?.success) {
        throw new ValidationError(getMailFailureMessage(emailRes?.reason));
      }

      const pendingToken = signPendingRegistration({
        name,
        email: cleanEmail,
        phone: phone || '',
        address: address || '',
        passHash,
        otpHash
      });

      return jsonSuccess({
        message: 'Doğrulama kodunuz e-posta adresinize gönderildi! Kodu girerek üyeliğinizi tamamlayabilirsiniz.',
        pendingApproval: true,
        verificationMethod: 'email',
        requiresEmailVerification: true,
        emailSent: true,
        pendingToken,
        data: {
          user: {
            name,
            email: cleanEmail,
            phone: phone || ''
          }
        }
      });
    }

    const pendingToken = signPendingRegistration({
      name,
      email: cleanEmail,
      phone: phone || '',
      address: address || '',
      passHash,
      otpHash: ''
    });

    return jsonSuccess({
      message:
        'Son adım! WhatsApp onay talebi butonuna bastığınızda talebiniz yöneticiye iletilir ve mesajınız açılır.',
      pendingApproval: true,
      verificationMethod: 'whatsapp',
      requiresEmailVerification: false,
      emailSent: false,
      pendingToken,
      data: {
        user: {
          name,
          email: cleanEmail,
          phone: phone || ''
        }
      }
    });
  } catch (error) {
    return handleApiError(error, '/api/auth/register', request);
  }
}
