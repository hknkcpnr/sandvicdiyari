import dns from 'dns/promises';
import { TRUSTED_EMAIL_DOMAINS, validateEmailClient } from './emailValidation.js';

const CACHE_TTL_VALID_MS = 10 * 60 * 1000;
const CACHE_TTL_INVALID_MS = 2 * 60 * 1000;
const mxDomainCache = new Map();

const publicResolver = new dns.Resolver();
publicResolver.setServers(['1.1.1.1', '8.8.8.8', '9.9.9.9']);

function withTimeout(promise, ms, label = 'DNS_TIMEOUT') {
  let timerId;
  const timeoutPromise = new Promise((_, reject) => {
    timerId = setTimeout(() => {
      const err = new Error(label);
      err.code = 'ETIMEOUT';
      reject(err);
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timerId));
}

function cacheAndReturn(domain, res) {
  const entry = { ...res, checkedAt: Date.now() };
  mxDomainCache.set(domain, entry);
  return entry;
}

async function queryDohRecord(domain, type) {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${encodeURIComponent(type)}`,
      { signal: controller.signal, cache: 'no-store' }
    );
    if (!res.ok) return null;
    return await res.json();
  } finally {
    clearTimeout(timerId);
  }
}

async function checkViaDoh(domain) {
  try {
    const mxJson = await queryDohRecord(domain, 'MX');
    if (!mxJson) return null;

    if (mxJson.Status === 3) {
      return cacheAndReturn(domain, { ok: false, code: 'NO_MX_RECORD', doh: true });
    }

    if (mxJson.Status === 0 && Array.isArray(mxJson.Answer)) {
      const mxAnswers = mxJson.Answer.filter((a) => a && a.type === 15 && typeof a.data === 'string');
      if (mxAnswers.length > 0) {
        const validMx = mxAnswers.filter((a) => {
          const clean = a.data.trim();
          return clean && !/^\d+\s+\.?$/.test(clean);
        });
        if (validMx.length > 0) {
          return cacheAndReturn(domain, { ok: true, mxCount: validMx.length, doh: true });
        }
        return cacheAndReturn(domain, { ok: false, code: 'NO_MX_RECORD', doh: true });
      }
    }

    if (mxJson.Status === 0) {
      const aJson = await queryDohRecord(domain, 'A');
      if (aJson && aJson.Status === 0 && Array.isArray(aJson.Answer) && aJson.Answer.some((a) => a?.type === 1)) {
        return cacheAndReturn(domain, { ok: true, dohFallbackA: true });
      }
      if (aJson) {
        return cacheAndReturn(domain, { ok: false, code: 'NO_MX_RECORD', doh: true });
      }
    }
  } catch {}
  return null;
}

async function hasValidMailServer(domain) {
  const cleanDomain = String(domain || '').trim().toLowerCase();
  if (!cleanDomain) return { ok: false, code: 'NO_MX_RECORD' };

  if (TRUSTED_EMAIL_DOMAINS.includes(cleanDomain)) {
    return { ok: true, cached: true, provider: 'trusted' };
  }

  const cached = mxDomainCache.get(cleanDomain);
  if (cached) {
    const ttl = cached.ok ? CACHE_TTL_VALID_MS : CACHE_TTL_INVALID_MS;
    if (Date.now() - cached.checkedAt < ttl) {
      return cached;
    }
    mxDomainCache.delete(cleanDomain);
  }

  let needsDohFallback = false;

  try {
    const mxRecords = await withTimeout(publicResolver.resolveMx(cleanDomain), 3000);
    const validMx = Array.isArray(mxRecords)
      ? mxRecords.filter(
          (rec) => rec && typeof rec.exchange === 'string' && rec.exchange.trim() && rec.exchange.trim() !== '.'
        )
      : [];

    if (validMx.length > 0) {
      return cacheAndReturn(cleanDomain, { ok: true, mxCount: validMx.length });
    }

    const hasNullMx =
      Array.isArray(mxRecords) && mxRecords.some((rec) => rec && (rec.exchange === '' || rec.exchange === '.'));
    if (hasNullMx) {
      return cacheAndReturn(cleanDomain, { ok: false, code: 'NO_MX_RECORD' });
    }
  } catch (err) {
    const code = err?.code || '';
    if (code === 'ENOTFOUND' || code === 'NXDOMAIN') {
      return cacheAndReturn(cleanDomain, { ok: false, code: 'NO_MX_RECORD' });
    }
    if (code !== 'ENODATA' && code !== 'NODATA') {
      needsDohFallback = true;
    }
  }

  if (!needsDohFallback) {
    try {
      const aRecords = await withTimeout(publicResolver.resolve4(cleanDomain), 2000);
      if (Array.isArray(aRecords) && aRecords.length > 0) {
        return cacheAndReturn(cleanDomain, { ok: true, fallbackA: true });
      }
      return cacheAndReturn(cleanDomain, { ok: false, code: 'NO_MX_RECORD' });
    } catch (aErr) {
      const code = aErr?.code || '';
      if (code === 'ENOTFOUND' || code === 'NXDOMAIN' || code === 'ENODATA' || code === 'NODATA') {
        return cacheAndReturn(cleanDomain, { ok: false, code: 'NO_MX_RECORD' });
      }
      needsDohFallback = true;
    }
  }

  if (needsDohFallback) {
    const dohRes = await checkViaDoh(cleanDomain);
    if (dohRes) {
      return dohRes;
    }
  }

  // Geçici ağ kesintisi / çevrimdışı durumda gerçek kullanıcıyı engelleme
  return { ok: true, skippedDueToDnsTimeout: true };
}

export async function validateEmailAddressServer(rawEmail) {
  const clientRes = validateEmailClient(rawEmail);
  if (!clientRes.valid) {
    return clientRes;
  }

  const mx = await hasValidMailServer(clientRes.domain);
  if (!mx.ok) {
    return {
      valid: false,
      code: 'NO_MX_RECORD',
      domain: clientRes.domain,
      suggestion: null,
      error: `"@${clientRes.domain}" alan adı geçersiz veya e-posta almıyor. Lütfen geçerli bir Gmail, Hotmail, Outlook veya kurumsal e-posta adresi giriniz.`
    };
  }

  return {
    valid: true,
    code: 'OK',
    domain: clientRes.domain,
    mxVerified: !mx.skippedDueToDnsTimeout,
    suggestion: null,
    error: ''
  };
}
