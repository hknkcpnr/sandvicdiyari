import crypto from 'crypto';
import { db } from '@/lib/db';
import {
  ValidationError,
  handleApiError,
  jsonSuccess,
  parseJsonBody
} from '@/lib/security/errors';
import { checkRateLimit } from '@/lib/security/auth';
import { isValidTurkishPhone, toWhatsAppPhone } from '@/lib/phoneUtils';
import { hashOtp, sendWhatsAppCloudApiMessage } from '@/lib/security/whatsapp';

export async function POST(request) {
  try {
    // 1. IP bazlı Rate Limit kontrolü (1 dakikada maks 10 OTP isteği)
    checkRateLimit(request, {
      keyPrefix: 'POST:/api/auth/send-whatsapp-otp',
      maxRequests: 10,
      windowMs: 60 * 1000
    });

    const body = await parseJsonBody(request);
    const rawPhone = String(body.phone || '').trim();

    // 2. Türkiye telefon formatı kontrolü
    if (!isValidTurkishPhone(rawPhone)) {
      throw new ValidationError(
        'Lütfen geçerli bir cep telefonu numarası giriniz (Örn: 0532 123 45 67 veya 5321234567).'
      );
    }

    // 3. WhatsApp API uluslararası formatına normalize et (905XXXXXXXXX)
    const normalizedPhone = toWhatsAppPhone(rawPhone);

    // 4. 60 saniyelik tekrar gönderme (cooldown) kontrolü
    const cooldownCheck = db.canSendOtp(normalizedPhone);
    if (!cooldownCheck.allowed) {
      throw new ValidationError(
        `Yeni bir doğrulama kodu göndermeden önce lütfen ${cooldownCheck.waitSeconds} saniye bekleyiniz.`
      );
    }

    // 5. Kriptografik olarak güvenli 6 haneli rastgele OTP üret (CSPRNG)
    const otpCode = String(crypto.randomInt(100000, 1000000));

    // 6. OTP'yi HMAC-SHA256 ile hash'le (Açık metin asla veritabanına yazılmaz)
    const otpHash = hashOtp(normalizedPhone, otpCode);

    // 7. 5 Dakikalık geçerlilik süresi (5 * 60 * 1000 ms = 300 saniye)
    const expiresAt = Date.now() + 5 * 60 * 1000;

    // 8. Veritabanına hash'lenmiş OTP kaydını ekle
    db.savePhoneOtp({
      phone: normalizedPhone,
      otpHash,
      expiresAt
    });

    // 9. WhatsApp Cloud API / Meta Business Platform üzerinden gönder
    try {
      await sendWhatsAppCloudApiMessage({
        toPhone: normalizedPhone,
        otpCode
      });
    } catch (err) {
      // Güvenlik: Kullanıcıya teknik Meta hatası yerine anlaşılır hata mesajı dön
      throw new ValidationError(
        'Doğrulama kodu gönderilemedi. Lütfen birkaç dakika sonra tekrar deneyin.'
      );
    }

    // 10. Başarılı yanıt (GÜVENLİK: OTP kodu response içinde KESİNLİKLE yer almaz!)
    return jsonSuccess({
      message: 'WhatsApp doğrulama kodu telefonunuza başarıyla gönderildi.',
      data: {
        phone: normalizedPhone,
        expiresInSeconds: 300,
        cooldownSeconds: 60
      }
    });
  } catch (error) {
    return handleApiError(error, '/api/auth/send-whatsapp-otp', request);
  }
}
