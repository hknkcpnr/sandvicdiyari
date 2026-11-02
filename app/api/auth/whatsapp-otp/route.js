import crypto from 'crypto';
import {
  ValidationError,
  handleApiError,
  jsonSuccess,
  parseJsonBody
} from '@/lib/security/errors';
import { checkRateLimit } from '@/lib/security/auth';
import { sanitizeText } from '@/lib/security/validation';
import { isValidTurkishPhone, toWhatsAppPhone } from '@/lib/phoneUtils';

// Bellek içi güvenli OTP saklama alanı (Telefon -> { code, expiresAt, name, attempts })
const otpStore = new Map();
const MAX_OTP_ATTEMPTS = 5;

export async function POST(request) {
  try {
    checkRateLimit(request, {
      keyPrefix: 'POST:/api/auth/whatsapp-otp',
      maxRequests: 15,
      windowMs: 60 * 1000
    });

    const body = await parseJsonBody(request);
    const action = sanitizeText(body.action || 'send', 16, 'action', '/api/auth/whatsapp-otp');
    const name = sanitizeText(body.name || 'Müşterimiz', 100, 'Ad Soyad', '/api/auth/whatsapp-otp');

    if (!isValidTurkishPhone(body.phone)) {
      throw new ValidationError('Lütfen geçerli bir telefon numarası giriniz (Örn: 0532 123 45 67).');
    }
    const normalizedPhone = toWhatsAppPhone(body.phone);

    // KOD DOĞRULAMA İŞLEMİ
    if (action === 'verify') {
      const record = otpStore.get(normalizedPhone);
      if (!record) {
        throw new ValidationError('Bu numara için aktif bir doğrulama kodu bulunamadı. Lütfen yeni kod isteyin.');
      }

      if (Date.now() > record.expiresAt) {
        otpStore.delete(normalizedPhone);
        throw new ValidationError('Doğrulama kodunun süresi dolmuş. Lütfen yeni kod gönderin.');
      }

      record.attempts = (record.attempts || 0) + 1;
      if (record.attempts > MAX_OTP_ATTEMPTS) {
        otpStore.delete(normalizedPhone);
        throw new ValidationError('Çok fazla hatalı kod denemesi yapıldı. Güvenlik için lütfen yeni kod isteyin.');
      }

      const providedCode = String(body.code || '').trim();
      const expectedCode = String(record.code).trim();

      if (providedCode !== expectedCode) {
        throw new ValidationError(
          `Girdiğiniz WhatsApp doğrulama kodu hatalı! (Kalan hak: ${MAX_OTP_ATTEMPTS - record.attempts + 1})`
        );
      }

      otpStore.delete(normalizedPhone);
      return jsonSuccess({
        message: 'Telefon numarası WhatsApp ile doğrulandı.'
      });
    }

    // KRİPTOGRAFİK OLARAK GÜVENLİ 6 HANELİ KOD OLUŞTURMA (CSPRNG)
    const generatedCode = String(crypto.randomInt(100000, 1000000));
    const expiresAt = Date.now() + 3 * 60 * 1000;

    otpStore.set(normalizedPhone, {
      code: generatedCode,
      expiresAt,
      name,
      attempts: 0
    });

    const whatsappMessage = `🥪 *Sandwich Diyarı - Üyelik Doğrulama*\n\nMerhaba *${name}*,\nKayıt işlemini tamamlamak için WhatsApp doğrulama kodunuz:\n\n🔑 *${generatedCode}*\n\n_Bu kod 3 dakika boyunca geçerlidir._`;

    let apiSent = false;
    if (process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
      try {
        const waRes = await fetch(
          `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: normalizedPhone,
              type: 'text',
              text: { body: whatsappMessage }
            })
          }
        );
        apiSent = waRes.ok;
      } catch (err) {
        console.error('WhatsApp Cloud API gönderim hatası:', err);
      }
    }

    const whatsappUrl = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(whatsappMessage)}`;

    return jsonSuccess({
      message: 'WhatsApp doğrulama kodu telefonunuza gönderildi.',
      data: {
        phone: normalizedPhone,
        code: generatedCode,
        whatsappMessage,
        whatsappUrl,
        apiSent,
        expiresInSeconds: 180
      }
    });
  } catch (error) {
    return handleApiError(error, '/api/auth/whatsapp-otp', request);
  }
}
