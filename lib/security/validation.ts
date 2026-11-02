import { AuthenticationError, ValidationError, logSecurityEvent } from '@/lib/security/errors';
import { formatTurkishPhoneInput, isValidTurkishPhone } from '@/lib/phoneUtils';
import type { OrderItem, Product } from '@/types/database';

// ============================================================================
// 1. XSS SANITIZATION & SQL INJECTION DETECTION
// ============================================================================

const SQL_INJECTION_PATTERNS: RegExp[] = [
  /(\b(UNION\s+ALL\s+SELECT|UNION\s+SELECT|DROP\s+TABLE|DROP\s+DATABASE|TRUNCATE\s+TABLE|ALTER\s+TABLE|INSERT\s+INTO\s+\w+\s+VALUES|DELETE\s+FROM\s+\w+\s+WHERE\s+1\s*=\s*1)\b)/i,
  /(--\s|\/\*[\s\S]*?\*\/|;\s*(DROP|ALTER|TRUNCATE|EXEC|SHUTDOWN))/i,
  /(\bOR\b\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?)/i,
  /(SLEEP\s*\(\s*\d+\s*\)|BENCHMARK\s*\()/i
];

const XSS_PATTERNS: RegExp[] = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript\s*:/gi,
  /vbscript\s*:/gi,
  /data\s*:\s*text\/html/gi,
  /on(load|error|click|mouseover|focus|blur|submit|change|keydown|keyup)\s*=/gi,
  /<(iframe|object|embed|applet|meta|link|style|form|base)\b[^>]*>/gi
];

/**
 * Checks input for SQL Injection payloads and logs + blocks if detected
 */
export function assertNoSqlInjection(value: unknown, fieldName = 'input', endpoint = '/api'): void {
  if (typeof value !== 'string' || !value) return;
  for (const regex of SQL_INJECTION_PATTERNS) {
    if (regex.test(value)) {
      logSecurityEvent({
        level: 'CRITICAL',
        category: 'SQL_INJECTION',
        endpoint,
        message: `"${fieldName}" alanında olası SQL Injection girişimi engellendi.`,
        details: { fieldName, sample: value.slice(0, 80) }
      });
      throw new ValidationError(`Güvenlik ihlali: "${fieldName}" alanında geçersiz ifadeler tespit edildi.`);
    }
  }
}

/**
 * Sanitizes string input by stripping dangerous XSS vectors, scripts, and HTML tags
 */
export function sanitizeText(
  input: unknown,
  maxLength = 500,
  fieldName = 'alan',
  endpoint = '/api'
): string {
  if (input === null || typeof input === 'undefined') return '';
  let str = String(input).trim();

  assertNoSqlInjection(str, fieldName, endpoint);

  for (const xssRegex of XSS_PATTERNS) {
    if (xssRegex.test(str)) {
      logSecurityEvent({
        level: 'WARN',
        category: 'XSS',
        endpoint,
        message: `"${fieldName}" alanında XSS script etiketi temizlendi.`,
        details: { fieldName }
      });
      str = str.replace(xssRegex, '');
    }
  }

  // Strip angle brackets to prevent arbitrary HTML injection
  str = str.replace(/[<>]/g, '').trim();

  if (str.length > maxLength) {
    str = str.slice(0, maxLength);
  }
  return str;
}

/**
 * Validates and normalizes an email or staff username
 */
export function sanitizeEmailOrUsername(
  input: unknown,
  allowUsername = false,
  endpoint = '/api/auth'
): string {
  const clean = sanitizeText(input, 191, 'email', endpoint).toLowerCase();
  if (!clean) {
    throw new ValidationError('Kullanıcı adı veya e-posta adresi zorunludur.');
  }
  if (allowUsername && !clean.includes('@')) {
    if (!/^[a-z0-9._-]{3,64}$/i.test(clean)) {
      throw new ValidationError('Geçersiz kullanıcı adı formatı.');
    }
    return clean;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailRegex.test(clean)) {
    throw new ValidationError('Lütfen geçerli bir e-posta adresi giriniz.');
  }
  return clean;
}

/**
 * Validates and cleans a Turkish phone number into "05XX XXX XX XX" format
 */
export function sanitizePhone(input: unknown, required = true): string {
  const raw = sanitizeText(input, 32, 'telefon');
  const digits = raw.replace(/\D/g, '');
  if (!digits) {
    if (required) throw new ValidationError('Telefon numarası zorunludur.');
    return '';
  }
  if (!isValidTurkishPhone(raw)) {
    throw new ValidationError('Lütfen geçerli bir telefon numarası giriniz (Örn: 0532 123 45 67).');
  }
  return formatTurkishPhoneInput(raw);
}

// ============================================================================
// 2. SERVER-SIDE ORDER VALIDATION & PRICE TAMPERING PROTECTION
// ============================================================================

export interface ValidatedOrderInput {
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  orderNote: string;
  paymentMethod: string;
  userEmail: string | null;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
}

/**
 * Parses option price additions like "Çedar Peyniri (+25₺)" or "(+₺25)" if present
 */
function extractOptionExtraPrice(selectedOptions?: string[]): number {
  if (!Array.isArray(selectedOptions)) return 0;
  let extra = 0;
  for (const opt of selectedOptions) {
    const str = String(opt || '');
    const match = str.match(/\+\s*(?:₺\s*)?(\d+(?:[.,]\d+)?)\s*(?:₺|TL)?/i);
    if (match && match[1]) {
      const val = parseFloat(match[1].replace(',', '.'));
      if (!Number.isNaN(val) && val > 0 && val <= 500) {
        extra += val;
      }
    }
  }
  return extra;
}

/**
 * Validates incoming order payload AND recalculates prices from the database
 * so malicious clients cannot manipulate `item.price` or `total`.
 */
export function validateAndPriceOrderPayload(
  body: Record<string, unknown>,
  catalogProducts: Product[],
  endpoint = '/api/orders'
): ValidatedOrderInput {
  const userEmail = body.userEmail
    ? sanitizeText(body.userEmail, 191, 'E-posta', endpoint).toLowerCase()
    : null;

  // STRICT MEMBERSHIP REQUIREMENT: Guests cannot place orders without logging in
  if (!userEmail) {
    throw new AuthenticationError(
      'Üyelik olmadan sipariş verilemez! Lütfen önce üye girişi yapın veya ücretsiz kayıt olun.'
    );
  }

  const customerName = sanitizeText(body.customerName || body.name, 120, 'Ad Soyad', endpoint);
  const customerPhone = sanitizePhone(body.customerPhone || body.phone, true);
  const customerAddress = sanitizeText(
    body.customerAddress || body.address,
    400,
    'Teslimat Adresi',
    endpoint
  );
  const orderNote = sanitizeText(
    body.orderNote || body.notes || '',
    350,
    'Sipariş Notu',
    endpoint
  );
  const paymentMethod = sanitizeText(
    body.paymentMethod || 'Kapıda Nakit',
    64,
    'Ödeme Yöntemi',
    endpoint
  );

  if (!customerName || customerName.length < 2) {
    throw new ValidationError('Lütfen geçerli bir Ad Soyad giriniz.');
  }
  if (!customerAddress || customerAddress.length < 5) {
    throw new ValidationError('Lütfen açık teslimat adresinizi eksiksiz giriniz.');
  }

  const rawItems = body.items;
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new ValidationError('Sipariş sepeti boş olamaz. En az 1 ürün seçilmelidir.');
  }
  if (rawItems.length > 50) {
    throw new ValidationError('Tek seferde en fazla 50 kalem ürün sipariş edilebilir.');
  }

  let calculatedSubtotal = 0;
  const validatedItems: OrderItem[] = [];

  for (const rawItem of rawItems) {
    if (!rawItem || typeof rawItem !== 'object') {
      throw new ValidationError('Geçersiz sipariş kalemi formatı.');
    }
    const itemObj = rawItem as Record<string, unknown>;
    const rawQty = Number(itemObj.quantity);
    if (!Number.isInteger(rawQty) || rawQty < 1 || rawQty > 99) {
      throw new ValidationError('Ürün adedi 1 ile 99 arasında tam sayı olmalıdır.');
    }

    const itemName = sanitizeText(itemObj.name, 191, 'Ürün Adı', endpoint);
    const dbProduct = catalogProducts.find(
      p =>
        (typeof itemObj.id !== 'undefined' && String(p.id) === String(itemObj.id)) ||
        p.name.toLowerCase() === itemName.toLowerCase()
    );

    const sanitizedOptions: string[] = Array.isArray(itemObj.selectedOptions)
      ? itemObj.selectedOptions
        .slice(0, 20)
        .map(opt => sanitizeText(opt, 120, 'Seçenek', endpoint))
        .filter(Boolean)
      : [];

    let authoritativeUnitPrice: number;
    if (dbProduct) {
      const basePrice = Number(dbProduct.price) || 0;
      const optionExtra = extractOptionExtraPrice(sanitizedOptions);
      const clientSentPrice = Number(itemObj.price) || 0;

      // Allow valid option extras or use authoritative basePrice + optionExtra
      const minExpectedPrice = basePrice;
      const maxExpectedPrice = basePrice + optionExtra + 250;

      if (clientSentPrice < minExpectedPrice * 0.95) {
        logSecurityEvent({
          level: 'CRITICAL',
          category: 'PRICE_TAMPER',
          endpoint,
          message: `Fiyat manipülasyonu engellendi! Ürün: "${dbProduct.name}" (İstemci: ₺${clientSentPrice}, Gerçek: ₺${basePrice + optionExtra})`,
          details: {
            productId: dbProduct.id,
            clientSentPrice,
            authoritativePrice: basePrice + optionExtra
          }
        });
        authoritativeUnitPrice = Number((basePrice + optionExtra).toFixed(2));
      } else if (clientSentPrice >= minExpectedPrice && clientSentPrice <= maxExpectedPrice) {
        authoritativeUnitPrice = Number(clientSentPrice.toFixed(2));
      } else {
        authoritativeUnitPrice = Number((basePrice + optionExtra).toFixed(2));
      }
    } else {
      const fallbackPrice = Number(itemObj.price);
      if (Number.isNaN(fallbackPrice) || fallbackPrice <= 0 || fallbackPrice > 10000) {
        throw new ValidationError(`"${itemName || 'Bilinmeyen Ürün'}" için geçersiz ürün fiyatı.`);
      }
      authoritativeUnitPrice = Number(fallbackPrice.toFixed(2));
    }

    calculatedSubtotal += authoritativeUnitPrice * rawQty;

    validatedItems.push({
      id: dbProduct ? dbProduct.id : (itemObj.id as string | number | undefined),
      name: dbProduct ? dbProduct.name : itemName,
      price: authoritativeUnitPrice,
      quantity: rawQty,
      ...(sanitizedOptions.length > 0 ? { selectedOptions: sanitizedOptions } : {})
    });
  }

  const deliveryFee = Math.max(0, Math.min(250, Number(body.deliveryFee) || 0));
  const subtotal = Number(calculatedSubtotal.toFixed(2));
  const total = Number((subtotal + deliveryFee).toFixed(2));

  return {
    customerName,
    customerPhone,
    customerAddress,
    orderNote,
    paymentMethod,
    userEmail,
    items: validatedItems,
    subtotal,
    deliveryFee,
    total
  };
}

// ============================================================================
// 3. BINARY IMAGE MAGIC-BYTE VERIFICATION (UPLOAD SECURITY)
// ============================================================================

/**
 * Verifies that an uploaded image buffer has authentic binary magic bytes
 * (JPEG, PNG, GIF, WEBP) to prevent disguised script/HTML/PHP uploads.
 */
export function validateImageMagicBytes(buffer: Buffer, ext: string): boolean {
  if (!buffer || buffer.length < 12) return false;

  // JPEG: FF D8 FF
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;
  // GIF: 47 49 46 38 ("GIF8")
  const isGif =
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38;
  // WEBP: "RIFF" .... "WEBP"
  const isWebp =
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50;

  if (ext === '.jpg' || ext === '.jpeg') return isJpeg;
  if (ext === '.png') return isPng;
  if (ext === '.gif') return isGif;
  if (ext === '.webp') return isWebp;

  return false;
}

