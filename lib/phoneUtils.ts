/**
 * Sandwich Diyarı - Telefon Numarası Formatlama ve Doğrulama Yardımcıları
 * Desteklenen girişler: "0532 123 45 67", "5321234567", "+90 532 123 45 67", "905321234567"
 * Standart Çıktı: "05XX XXX XX XX"
 */

export function normalizeTurkishPhoneDigits(input: string = ''): string {
  let digits = String(input || '').replace(/\D/g, '');
  if (!digits) return '';

  // 0090532... -> 0532...
  if (digits.startsWith('0090') && digits.length >= 14) {
    digits = '0' + digits.slice(4);
  }
  // 90532... -> 0532...
  else if (digits.startsWith('90') && digits.length === 12) {
    digits = '0' + digits.slice(2);
  }
  // 532... (başında 0 olmadan yazıldıysa otomatik 0 ekle)
  else if (!digits.startsWith('0') && digits.length <= 10) {
    digits = '0' + digits;
  }

  return digits.slice(0, 11);
}

/**
 * Kullanıcı yazarken canlı olarak "05XX XXX XX XX" formatına dönüştürür
 */
export function formatTurkishPhoneInput(input: string = ''): string {
  const raw = String(input || '');
  const rawDigits = raw.replace(/\D/g, '');
  if (!rawDigits) return '';

  // Eğer kullanıcı sadece "0" yazdıysa "0" bırak (silme işlemini engellememek için)
  if (rawDigits === '0') return '0';

  const d = normalizeTurkishPhoneDigits(rawDigits);

  if (d.length <= 4) return d;
  if (d.length <= 7) return `${d.slice(0, 4)} ${d.slice(4)}`;
  if (d.length <= 9) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9, 11)}`;
}

/**
 * Telefon numarasının geçerli bir 10/11 haneli Türkiye numarası olup olmadığını kontrol eder
 */
export function isValidTurkishPhone(input: string = ''): boolean {
  const d = normalizeTurkishPhoneDigits(input);
  return d.length === 11 && d.startsWith('0');
}

/**
 * WhatsApp API ve wa.me bağlantıları için "905XXXXXXXXX" (12 hane) formatına çevirir
 */
export function toWhatsAppPhone(input: string = ''): string {
  const d = normalizeTurkishPhoneDigits(input);
  if (d.length === 11 && d.startsWith('0')) {
    return '9' + d; // 905XXXXXXXXX
  }
  const rawDigits = String(input || '').replace(/\D/g, '');
  if (rawDigits.startsWith('90') && rawDigits.length === 12) {
    return rawDigits;
  }
  if (rawDigits.length === 10) {
    return '90' + rawDigits;
  }
  return rawDigits;
}

