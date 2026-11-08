import { db } from '@/lib/db';
import {
  ValidationError,
  handleApiError,
  jsonSuccess,
  parseJsonBody
} from '@/lib/security/errors';
import { checkRateLimit } from '@/lib/security/auth';
import { isValidTurkishPhone, toWhatsAppPhone } from '@/lib/phoneUtils';
import { verifyOtpHash } from '@/lib/security/whatsapp';

export async function POST(request) {
  try {
    // 1. IP bazlı Rate Limit kontrolü (1 dakikada maks 20 doğrulama isteği)
    checkRateLimit(request, {
      keyPrefix: 'POST:/api/auth/verify-whatsapp-otp',
      maxRequests: 20,
      windowMs: 60 * 1000
    });

    const body = await parseJsonBody(request);
    const rawPhone = String(body.phone || '').trim();
    const providedCode = String(body.code || '').trim();

    // 2. Telefon ve Kod formatı kontrolü
    if (!isValidTurkishPhone(rawPhone)) {
      throw new ValidationError(
        'Lütfen geçerli bir cep telefonu numarası giriniz (Örn: 0532 123 45 67).'
      );
    }

    if (!providedCode || providedCode.length !== 6 || !/^\d{6}$/.test(providedCode)) {
      throw new ValidationError('Lütfen 6 haneli doğrulama kodunu eksiksiz giriniz.');
    }

    const normalizedPhone = toWhatsAppPhone(rawPhone);

    // 3. Veritabanından en son oluşturulan OTP kaydını çek
    const record = db.getLatestPhoneOtp(normalizedPhone);
    if (!record) {
      throw new ValidationError(
        'Bu telefon numarası için aktif bir doğrulama kodu bulunamadı. Lütfen yeni kod isteyiniz.'
      );
    }

    // 4. Tek kullanım kontrolü (Daha önce kullanılmış mı?)
    if (record.usedAt) {
      throw new ValidationError(
        'Bu doğrulama kodu daha önce kullanılmıştır. Lütfen yeni bir kod isteyiniz.'
      );
    }

    // 5. 5 Dakikalık süre aşımı kontrolü (Expires At)
    const expiresAtMs = new Date(record.expiresAt).getTime();
    if (Date.now() > expiresAtMs) {
      throw new ValidationError(
        'Doğrulama kodunun 5 dakikalık süresi dolmuş. Lütfen yeni kod isteyiniz.'
      );
    }

    // 6. Hatalı deneme sayısını artır ve 5 deneme sınırını kontrol et
    const currentAttempts = db.incrementOtpAttempts(record.id);
    if (currentAttempts > 5) {
      throw new ValidationError(
        'Çok fazla hatalı kod denemesi yapıldı (5 deneme sınırı aşıldı). Güvenliğiniz için bu kod iptal edildi, lütfen yeni kod isteyiniz.'
      );
    }

    // 7. HMAC-SHA256 Hash doğrulaması (Zamanlama saldırılarına karşı güvenli)
    const isValid = verifyOtpHash(normalizedPhone, providedCode, record.otpHash);
    if (!isValid) {
      const remainingAttempts = Math.max(0, 5 - currentAttempts);
      throw new ValidationError(
        `Girdiğiniz WhatsApp doğrulama kodu hatalı! (Kalan deneme hakkınız: ${remainingAttempts})`
      );
    }

    // 8. Kodu kullanıldı olarak işaretle (Bir daha ASLA kullanılamaz)
    db.markOtpUsed(record.id);

    // 9. Sistemde bu numaraya ait kayıtlı kullanıcı varsa telefonunu verified yap
    db.updateUserPhoneVerified(normalizedPhone, true);

    // 10. Başarılı sonuç dön
    return jsonSuccess({
      message: 'Telefon numaranız başarıyla doğrulandı.',
      data: {
        verified: true,
        phone: normalizedPhone
      }
    });
  } catch (error) {
    return handleApiError(error, '/api/auth/verify-whatsapp-otp', request);
  }
}

