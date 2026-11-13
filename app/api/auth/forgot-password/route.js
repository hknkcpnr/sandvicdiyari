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
import { sendPasswordResetEmail } from '@/lib/email';

function maskEmail(email) {
  if (!email || !email.includes('@')) return email || '';
  const [name, domain] = email.split('@');
  if (name.length <= 2) return `${name[0]}*@${domain}`;
  return `${name.slice(0, 2)}***${name.slice(-1)}@${domain}`;
}

export async function POST(request) {
  try {
    // 1. IP bazlı Rate Limit kontrolü (1 dakikada maks 10 istek)
    checkRateLimit(request, {
      keyPrefix: 'POST:/api/auth/forgot-password',
      maxRequests: 10,
      windowMs: 60 * 1000
    });

    const body = await parseJsonBody(request);
    const rawEmail = String(body.email || body.identifier || '').trim().toLowerCase();

    if (!rawEmail || !rawEmail.includes('@') || !rawEmail.includes('.')) {
      throw new ValidationError('Lütfen geçerli bir e-posta adresi giriniz (Örn: ornek@mail.com).');
    }

    // 2. Kullanıcıyı PostgreSQL (Prisma) veya yerel DB'den sorgula (Sadece e-posta ile)
    let foundUser = null;

    try {
      if (rawPrisma && rawPrisma.user) {
        const pgUser = await rawPrisma.user.findFirst({
          where: {
            OR: [
              { email: { equals: rawEmail, mode: 'insensitive' } },
              { email: { equals: `${rawEmail}@sandwichdiyari.com`, mode: 'insensitive' } }
            ]
          }
        });
        if (pgUser) {
          foundUser = {
            id: pgUser.id,
            name: pgUser.name,
            email: pgUser.email,
            phone: pgUser.phone || ''
          };
        }
      }
    } catch (pgErr) {
      console.warn('Prisma forgot-password lookup fallback:', pgErr.message);
    }

    if (!foundUser) {
      foundUser = db.findUserByEmail(rawEmail);
    }

    if (!foundUser) {
      throw new ValidationError('Girdiğiniz e-posta adresine ait kayıtlı bir kullanıcı bulunamadı.');
    }

    // 3. 6 Haneli Doğrulama Kodu Üret (OTP)
    const targetEmail = (foundUser.email || rawEmail).toLowerCase();
    const otpCode = String(crypto.randomInt(100000, 999999));
    const expiresAt = Date.now() + 30 * 60 * 1000; // 30 dakika geçerli

    // Hash oluştur
    const emailHash = hashOtp(targetEmail, otpCode);

    // Local RAM / JSON DB
    try {
      db.savePhoneOtp({
        phone: targetEmail,
        otpHash: emailHash,
        expiresAt
      });
      if (rawEmail !== targetEmail) {
        db.savePhoneOtp({
          phone: rawEmail,
          otpHash: hashOtp(rawEmail, otpCode),
          expiresAt
        });
      }
    } catch (e) {}

    // PostgreSQL Supabase DB (Kalıcı Vercel Serverless)
    try {
      if (rawPrisma && rawPrisma.phoneOtp) {
        await rawPrisma.phoneOtp.create({
          data: {
            phone: targetEmail,
            otpHash: emailHash,
            expiresAt: new Date(expiresAt)
          }
        });
        if (rawEmail !== targetEmail) {
          await rawPrisma.phoneOtp.create({
            data: {
              phone: rawEmail,
              otpHash: hashOtp(rawEmail, otpCode),
              expiresAt: new Date(expiresAt)
            }
          });
        }
      }
    } catch (pgErr) {
      console.warn('[PostgreSQL PhoneOtp Save Warning]', pgErr.message);
    }

    // 4. E-Posta Gönderimi (Resend / SMTP)
    const emailRes = await sendPasswordResetEmail({
      toEmail: targetEmail,
      userName: foundUser.name,
      resetCode: otpCode
    });

    if (!emailRes.success) {
      throw new ValidationError('E-posta gönderilirken bir hata oluştu. Lütfen e-posta adresinizi kontrol edip tekrar deneyiniz.');
    }

    return jsonSuccess({
      message: 'Şifre sıfırlama kodunuz e-posta adresinize gönderildi! Lütfen gelen kutunuzu kontrol ediniz.',
      data: {
        userFound: true,
        name: foundUser.name,
        email: targetEmail,
        maskedEmail: maskEmail(targetEmail),
        emailSent: true
      }
    });
  } catch (error) {
    return handleApiError(error, '/api/auth/forgot-password', request);
  }
}
