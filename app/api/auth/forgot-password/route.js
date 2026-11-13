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
import { isValidTurkishPhone, toWhatsAppPhone, formatTurkishPhoneInput } from '@/lib/phoneUtils';
import { hashOtp, sendWhatsAppCloudApiMessage } from '@/lib/security/whatsapp';
import { sendPasswordResetEmail } from '@/lib/email';

function maskPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 10) return phone || '';
  const last4 = digits.slice(-4);
  const first3 = digits.length === 12 ? digits.slice(2, 5) : digits.slice(0, 3);
  return `0${first3} *** ** ${last4.slice(0, 2)} ${last4.slice(2)}`;
}

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
    const rawInput = String(body.identifier || body.phone || body.email || '').trim();

    if (!rawInput) {
      throw new ValidationError('Lütfen kayıtlı telefon numaranızı veya e-posta adresinizi giriniz.');
    }

    const cleanDigits = rawInput.replace(/\D/g, '');
    const cleanLower = rawInput.toLowerCase();

    // 2. Kullanıcıyı PostgreSQL (Prisma) veya yerel DB'den sorgula
    let foundUser = null;

    try {
      if (rawPrisma && rawPrisma.user) {
        const pgUser = await rawPrisma.user.findFirst({
          where: {
            OR: [
              { email: { equals: cleanLower, mode: 'insensitive' } },
              { email: { equals: `${cleanLower}@sandwichdiyari.com`, mode: 'insensitive' } },
              ...(cleanDigits.length >= 10 ? [{ phone: { contains: cleanDigits.slice(-10) } }] : [])
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
      foundUser = db.findUserByEmail(rawInput);
    }

    // 3. Destek WhatsApp Linki Hazırla (Restoran yetkilisine 1-tıkla bağlanır)
    const displayInfo = cleanDigits.length >= 10 ? formatTurkishPhoneInput(rawInput) : rawInput;
    const waText = encodeURIComponent(
      `Merhaba Sandviç Diyarı, ${displayInfo} kayıtlı hesabımın şifresini unuttum. Hesabım için yeni şifre tanımlanmasını rica ediyorum.`
    );
    const waSupportUrl = `https://wa.me/905538557612?text=${waText}`;

    if (!foundUser) {
      // Güvenlik ve kullanıcı kolaylığı: Hesap bulunamadıysa bile WhatsApp destek linkini sun
      return jsonSuccess({
        message: 'Girdiğiniz bilgilere ait bir kullanıcı kaydı arandı.',
        data: {
          userFound: false,
          waSupportUrl,
          supportPhone: '0553 855 76 12'
        }
      });
    }

    // 4. Kullanıcı bulundu: 6 Haneli Doğrulama Kodu Üret (OTP)
    const userPhone = foundUser.phone || (cleanDigits.length >= 10 ? rawInput : '');
    const normalizedPhone = userPhone ? toWhatsAppPhone(userPhone) : '';
    const targetEmail = foundUser.email || (cleanLower.includes('@') ? cleanLower : '');

    const otpCode = String(crypto.randomInt(100000, 999999));
    const expiresAt = Date.now() + 30 * 60 * 1000; // 30 dakika boyunca geçerli

    // Kodu hem telefon hem de e-posta anahtarlarıyla kaydet (Her iki girişle de doğrulansın)
    const candidateKeys = Array.from(
      new Set(
        [
          normalizedPhone,
          cleanDigits.length >= 10 ? cleanDigits : '',
          targetEmail ? targetEmail.toLowerCase() : '',
          cleanLower,
          foundUser.email ? foundUser.email.toLowerCase() : '',
          foundUser.phone ? foundUser.phone.replace(/\D/g, '') : ''
        ].filter(Boolean)
      )
    );

    // A) PostgreSQL (Prisma) Kalıcı Saklama - Vercel Serverless ortamında kaybolmaz!
    for (const key of candidateKeys) {
      const currentHash = hashOtp(key, otpCode);

      // Local RAM/JSON DB
      try {
        db.savePhoneOtp({
          phone: key,
          otpHash: currentHash,
          expiresAt
        });
      } catch (e) {}

      // PostgreSQL Supabase DB
      try {
        if (rawPrisma && rawPrisma.phoneOtp) {
          await rawPrisma.phoneOtp.create({
            data: {
              phone: key,
              otpHash: currentHash,
              expiresAt: new Date(expiresAt)
            }
          });
        }
      } catch (pgErr) {
        console.warn('[PostgreSQL PhoneOtp Save Warning]', pgErr.message);
      }
    }

    // WhatsApp Cloud API / UltraMsg üzerinden göndermeyi dene (varsa)
    if (normalizedPhone) {
      try {
        await sendWhatsAppCloudApiMessage({
          toPhone: normalizedPhone,
          otpCode
        });
      } catch (err) {}
    }

    // 5. Gerçek E-Posta Gönderimini Dene
    let emailSent = false;
    let smtpConfigured = false;

    if (targetEmail && targetEmail.includes('@') && !targetEmail.endsWith('@sandwichdiyari.com')) {
      const emailRes = await sendPasswordResetEmail({
        toEmail: targetEmail,
        userName: foundUser.name,
        resetCode: otpCode
      });

      if (emailRes.success) {
        emailSent = true;
        smtpConfigured = true;
      } else if (emailRes.reason === 'SMTP_NOT_CONFIGURED') {
        smtpConfigured = false;
      }
    }

    return jsonSuccess({
      message: emailSent
        ? 'Şifre sıfırlama kodunuz e-posta adresinize gönderildi! Lütfen gelen kutunuzu kontrol ediniz.'
        : 'Şifre sıfırlama kodunuz hazırlandı.',
      data: {
        userFound: true,
        name: foundUser.name,
        maskedPhone: maskPhone(foundUser.phone || userPhone),
        maskedEmail: maskEmail(targetEmail),
        phone: normalizedPhone,
        email: targetEmail,
        emailSent,
        smtpConfigured,
        codeSent: true,
        waSupportUrl,
        supportPhone: '0553 855 76 12'
      }
    });
  } catch (error) {
    return handleApiError(error, '/api/auth/forgot-password', request);
  }
}
