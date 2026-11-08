import crypto from 'crypto';

/**
 * OTP kodunu telefon numarası ve gizli anahtar ile HMAC-SHA256 kullanarak güvenli şekilde hash'ler.
 * Açık OTP metni veritabanında asla saklanmaz.
 */
export function hashOtp(phone, otp) {
  const secret = process.env.JWT_SECRET || 'sd_otp_crypto_salt_2026_sandwich_diyari';
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  const cleanOtp = String(otp || '').trim();
  return crypto.createHmac('sha256', secret).update(`${cleanPhone}:${cleanOtp}`).digest('hex');
}

/**
 * Girilen OTP'yi saklanan hash ile zamanlama saldırılarına (timing attack) karşı güvenli (constant-time) doğrular.
 */
export function verifyOtpHash(phone, providedOtp, expectedHash) {
  if (!providedOtp || !expectedHash) return false;
  const computedHash = hashOtp(phone, providedOtp);
  try {
    const a = Buffer.from(computedHash, 'hex');
    const b = Buffer.from(expectedHash, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (err) {
    return false;
  }
}

/**
 * WhatsApp Mesaj Gönderim Servisi
 * İki yöntemi de tam destekler:
 * 1. UltraMsg (QR Kod ile WhatsApp Web bağlama - Kolay ve Hızlı)
 * 2. Meta WhatsApp Cloud API (Graph API)
 *
 * @param {Object} params
 * @param {string} params.toPhone - 905XXXXXXXXX formatında uluslararası telefon numarası
 * @param {string} params.otpCode - 6 haneli doğrulama kodu
 * @returns {Promise<{ sent: boolean, simulated: boolean, provider?: string }>}
 */
export async function sendWhatsAppCloudApiMessage({ toPhone, otpCode }) {
  // 1. ÖNCELİK: UltraMsg (QR Kod ile Bağlama)
  const ultramsgInstance = process.env.ULTRAMSG_INSTANCE_ID?.trim();
  const ultramsgToken = process.env.ULTRAMSG_TOKEN?.trim();

  if (ultramsgInstance && ultramsgToken) {
    const message = `🥪 *Sandviç Diyarı*\n\nDoğrulama kodunuz: *${otpCode}*\n\n_Bu kod 5 dakika boyunca geçerlidir. Lütfen kimseyle paylaşmayınız._`;
    try {
      const params = new URLSearchParams();
      params.append('token', ultramsgToken);
      params.append('to', toPhone.startsWith('+') ? toPhone : `+${toPhone}`);
      params.append('body', message);

      const res = await fetch(`https://api.ultramsg.com/${ultramsgInstance}/messages/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        console.error('[UltraMsg Error]', { status: res.status, errJson });
        throw new Error('ULTRAMSG_DISPATCH_FAILED');
      }

      return { sent: true, simulated: false, provider: 'ultramsg' };
    } catch (err) {
      console.error('[UltraMsg Network Error]', err.message);
      throw new Error('WHATSAPP_API_DISPATCH_FAILED');
    }
  }

  // 2. ALTERNATİF: Meta WhatsApp Cloud API
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME?.trim();
  const languageCode = process.env.WHATSAPP_LANGUAGE_CODE?.trim() || 'tr';

  // Ortam değişkenleri henüz girilmemişse yerel geliştirme modunda güvenle simüle et
  if (!accessToken || !phoneNumberId) {
    console.info(
      `[WhatsApp OTP] ULTRA_MSG veya META API bilgisi tanımlı değil. (Simülasyon Modu: ${toPhone})`
    );
    return { sent: true, simulated: true };
  }

  // Meta Template veya Doğrudan Metin Gövdesi
  let requestBody;
  if (templateName) {
    requestBody = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toPhone,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: languageCode
        },
        components: [
          {
            type: 'body',
            parameters: [
              {
                type: 'text',
                text: String(otpCode)
              }
            ]
          }
        ]
      }
    };
  } else {
    requestBody = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toPhone,
      type: 'text',
      text: {
        body: `Sandviç Diyarı doğrulama kodunuz: ${otpCode}\n\nBu kod 5 dakika geçerlidir.`
      }
    };
  }

  try {
    const metaResponse = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      }
    );

    if (!metaResponse.ok) {
      const errorJson = await metaResponse.json().catch(() => ({}));
      console.error('[WhatsApp Cloud API Error]', {
        status: metaResponse.status,
        metaError: errorJson?.error?.message || metaResponse.statusText
      });
      throw new Error('WHATSAPP_API_DISPATCH_FAILED');
    }

    return { sent: true, simulated: false, provider: 'meta' };
  } catch (err) {
    if (err.message === 'WHATSAPP_API_DISPATCH_FAILED') {
      throw err;
    }
    console.error('[WhatsApp Cloud API Network Error]', err.message);
    throw new Error('WHATSAPP_API_NETWORK_ERROR');
  }
}
      }
    );

    if (!metaResponse.ok) {
      const errorJson = await metaResponse.json().catch(() => ({}));
      // Güvenlik: Access token ve OTP'yi loglara dökmeden hatanın meta kodunu kaydet
      console.error('[WhatsApp Cloud API Error]', {
        status: metaResponse.status,
        metaError: errorJson?.error?.message || metaResponse.statusText
      });
      throw new Error('WHATSAPP_API_DISPATCH_FAILED');
    }

    return { sent: true, simulated: false };
  } catch (err) {
    if (err.message === 'WHATSAPP_API_DISPATCH_FAILED') {
      throw err;
    }
    console.error('[WhatsApp Cloud API Network Error]', err.message);
    throw new Error('WHATSAPP_API_NETWORK_ERROR');
  }
}

