import crypto from 'crypto';

const SIGN_SECRET =
  process.env.JWT_SECRET ||
  'sd_prod_hmac_sha256_secret_key_2026_sandwich_diyari_secure_998877';

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input) {
  let str = String(input || '').replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64').toString('utf8');
}

/**
 * Doğrulanmamış kayıt bilgilerini veritabanına yazmadan HMAC-SHA256 imzalı token olarak paketler.
 */
export function signPendingRegistration({
  name,
  email,
  phone = '',
  address = '',
  passHash,
  otpHash = '',
  expiresInMs = 30 * 60 * 1000
}) {
  const payload = {
    purpose: 'pending_register',
    name: String(name || '').trim(),
    email: String(email || '').trim().toLowerCase(),
    phone: String(phone || '').trim(),
    address: String(address || '').trim(),
    passHash: String(passHash || ''),
    otpHash: String(otpHash || ''),
    exp: Date.now() + expiresInMs
  };

  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', SIGN_SECRET)
    .update(encoded)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${encoded}.${signature}`;
}

/**
 * İmzalı bekleme kayıt token'ını doğrular; süresi dolmuşsa veya kurcalanmışsa null döner.
 */
export function verifyPendingRegistration(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.trim().split('.');
  if (parts.length !== 2) return null;

  const [encoded, providedSig] = parts;
  if (!encoded || !providedSig) return null;

  try {
    const expectedSig = crypto
      .createHmac('sha256', SIGN_SECRET)
      .update(encoded)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    const a = Buffer.from(providedSig, 'utf8');
    const b = Buffer.from(expectedSig, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }

    const parsed = JSON.parse(base64UrlDecode(encoded));
    if (!parsed || parsed.purpose !== 'pending_register') return null;
    if (typeof parsed.exp !== 'number' || Date.now() > parsed.exp + 60 * 1000) {
      return null;
    }
    if (!parsed.email || !parsed.passHash) return null;

    return {
      name: String(parsed.name || ''),
      email: String(parsed.email).trim().toLowerCase(),
      phone: String(parsed.phone || ''),
      address: String(parsed.address || ''),
      passHash: String(parsed.passHash),
      otpHash: String(parsed.otpHash || ''),
      exp: parsed.exp
    };
  } catch {
    return null;
  }
}

export function getMailFailureMessage(reason) {
  if (reason === 'NO_ACTIVE_EMAIL_PROVIDER') {
    return 'Sunucuda e-posta gönderim ayarları (SMTP) henüz aktif değil. Lütfen Vercel Environment Variables ekledikten sonra Redeploy yapınız veya WhatsApp Onayı kullanınız.';
  }
  if (reason === 'SMTP_AUTH_FAILED') {
    return 'E-posta sunucusu şifre doğrulaması başarısız (SMTP_USER / SMTP_PASS kontrol edilmeli). Şimdilik WhatsApp Onayı ile devam edebilirsiniz.';
  }
  return 'Doğrulama e-postası gönderilemedi. Lütfen biraz sonra tekrar deneyiniz veya WhatsApp Onayı kullanınız.';
}
