export const TRUSTED_EMAIL_DOMAINS = [
  'gmail.com',
  'hotmail.com',
  'outlook.com',
  'yahoo.com',
  'icloud.com',
  'yandex.com',
  'live.com',
  'hotmail.com.tr',
  'outlook.com.tr',
  'yahoo.com.tr',
  'windowslive.com',
  'msn.com',
  'proton.me',
  'protonmail.com'
];

export const DOMAIN_TYPO_MAP = {
  // Gmail
  'gmial.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gimail.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'gmail.om': 'gmail.com',
  'gmail.vom': 'gmail.com',
  'gmail.xom': 'gmail.com',
  'gmail.com.tr': 'gmail.com',

  // Hotmail
  'hotmial.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'hotamil.com': 'hotmail.com',
  'hotmaill.com': 'hotmail.com',
  'hotmali.com': 'hotmail.com',
  'homtail.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'hotmail.cm': 'hotmail.com',

  // Outlook
  'outlok.com': 'outlook.com',
  'outllook.com': 'outlook.com',
  'outloook.com': 'outlook.com',
  'outluk.com': 'outlook.com',
  'otlook.com': 'outlook.com',
  'oulook.com': 'outlook.com',
  'outlook.con': 'outlook.com',
  'outlook.co': 'outlook.com',
  'outlook.cm': 'outlook.com',

  // Yahoo
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yhoo.com': 'yahoo.com',
  'yahoo.con': 'yahoo.com',

  // iCloud
  'icoud.com': 'icloud.com',
  'iclod.com': 'icloud.com',
  'icluod.com': 'icloud.com',
  'icloud.con': 'icloud.com',

  // Yandex
  'yndex.com': 'yandex.com',
  'yandx.com': 'yandex.com',
  'yandex.con': 'yandex.com',

  // Live
  'live.con': 'live.com',
  'windowslive.con': 'windowslive.com'
};

export const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'tempmail.com',
  'temp-mail.org',
  'temp-mail.io',
  '10minutemail.com',
  '10minutemail.net',
  'guerrillamail.com',
  'guerrillamail.org',
  'sharklasers.com',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
  'mailinator.com',
  'trashmail.com',
  'trashmail.me',
  'getnada.com',
  'nada.email',
  'maildrop.cc',
  'dispostable.com',
  'mohmal.com',
  'fakeinbox.com',
  'throwawaymail.com',
  'minutemail.com',
  'tempinbox.com',
  'emailondeck.com',
  'burnermail.io',
  'mailnesia.com',
  'inboxkitten.com',
  'mailcatch.com',
  'mintemail.com',
  'mytemp.email',
  'tempr.email',
  'discard.email',
  'spamgourmet.com',
  'getairmail.com',
  'harakirimail.com',
  'dropmail.me',
  'moakt.com',
  'luxusmail.org',
  'crazymailing.com',
  'emailfake.com',
  'generator.email',
  'tmpmail.org',
  'tmpmail.net',
  'tempmailo.com',
  'tempail.com',
  'mailpoof.com',
  'fakemail.net',
  'mail-temp.com',
  'mailsac.com',
  'linshi-email.com',
  'internxt.com',
  'guerrillamailblock.com',
  'pokemail.net',
  'spam4.me',
  'grr.la'
]);

const TYPO_CANDIDATE_DOMAINS = [
  'gmail.com',
  'hotmail.com',
  'outlook.com',
  'yahoo.com',
  'icloud.com',
  'yandex.com',
  'live.com'
];

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let curr = new Array(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

export function isValidEmailSyntax(email) {
  const clean = String(email || '').trim().toLowerCase();
  if (!clean || clean.length > 254) return false;

  const atIndex = clean.indexOf('@');
  if (atIndex <= 0 || atIndex !== clean.lastIndexOf('@')) return false;

  const local = clean.slice(0, atIndex);
  const domain = clean.slice(atIndex + 1);

  if (!local || local.length > 64) return false;
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local)) return false;

  if (!domain || domain.length > 253 || !domain.includes('.')) return false;
  const labels = domain.split('.');
  if (labels.some((lbl) => !lbl || lbl.length > 63 || lbl.startsWith('-') || lbl.endsWith('-'))) {
    return false;
  }
  if (labels.some((lbl) => !/^[a-z0-9-]+$/i.test(lbl))) return false;

  const tld = labels[labels.length - 1];
  if (!/^[a-z]{2,24}$/i.test(tld)) return false;

  return true;
}

export function suggestEmailCorrection(email) {
  const clean = String(email || '').trim().toLowerCase();
  const atIndex = clean.indexOf('@');
  if (atIndex <= 0 || atIndex !== clean.lastIndexOf('@')) return null;

  const local = clean.slice(0, atIndex);
  const domain = clean.slice(atIndex + 1);
  if (!local || !domain) return null;

  if (DOMAIN_TYPO_MAP[domain]) {
    return `${local}@${DOMAIN_TYPO_MAP[domain]}`;
  }

  if (TRUSTED_EMAIL_DOMAINS.includes(domain) || DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return null;
  }

  for (const target of TYPO_CANDIDATE_DOMAINS) {
    const dist = levenshtein(domain, target);
    if (dist === 1 || (dist === 2 && domain.length >= 9 && domain[0] === target[0])) {
      return `${local}@${target}`;
    }
  }

  return null;
}

export function isDisposableEmail(email) {
  const clean = String(email || '').trim().toLowerCase();
  const atIndex = clean.lastIndexOf('@');
  if (atIndex < 0) return false;
  const domain = clean.slice(atIndex + 1);
  if (!domain) return false;

  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) return true;

  const parts = domain.split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    const parent = parts.slice(i).join('.');
    if (DISPOSABLE_EMAIL_DOMAINS.has(parent)) return true;
  }
  return false;
}

export function validateEmailClient(rawEmail) {
  const clean = String(rawEmail || '').trim().toLowerCase();

  if (!clean) {
    return {
      valid: false,
      code: 'EMPTY',
      error: 'Lütfen e-posta adresinizi giriniz.',
      suggestion: null,
      domain: ''
    };
  }

  if (!isValidEmailSyntax(clean)) {
    return {
      valid: false,
      code: 'INVALID_SYNTAX',
      error: 'Lütfen geçerli bir e-posta adresi giriniz (Örn: adiniz@gmail.com).',
      suggestion: null,
      domain: ''
    };
  }

  const domain = clean.slice(clean.indexOf('@') + 1);
  const suggestion = suggestEmailCorrection(clean);

  if (suggestion) {
    return {
      valid: false,
      code: 'TYPO',
      error: `E-posta adresinde yazım hatası olabilir. Bunu mu demek istediniz: ${suggestion}?`,
      suggestion,
      domain
    };
  }

  if (isDisposableEmail(clean)) {
    return {
      valid: false,
      code: 'DISPOSABLE',
      error:
        'Geçici / tek kullanımlık e-posta adresleri kabul edilmemektedir. Lütfen Gmail, Hotmail, Outlook veya gerçek bir e-posta adresi giriniz.',
      suggestion: null,
      domain
    };
  }

  return {
    valid: true,
    code: 'OK',
    error: '',
    suggestion: null,
    domain
  };
}
