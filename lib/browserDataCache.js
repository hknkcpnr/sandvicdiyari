'use client';

/**
 * Birleşik Tarayıcı Önbelleği (RAM + sessionStorage + In-Flight Deduplication)
 * - Kalabalık mağaza vitrini ve yönetim sekmelerinin her açılışta tekrar yüklenmesini önler.
 * - Ekleme/güncelleme/silme işlemlerinde önbelleği anında tazeler; bayatlayan verileri arka planda sessiz yeniler.
 * - Eşzamanlı aynı endpoint isteklerini (ör. TopBar + DraggableContactButton) tek istekte birleştirir.
 */

const STORAGE_PREFIX = 'sd_bcache_v1:';
const MAX_SESSION_BYTES = 400_000; // 400 KB üstü dev veriler yalnızca RAM'de tutulur

export const CACHE_TTL_SHORT = 30 * 1000; // 30 saniye (işlem kayıtları)
export const CACHE_TTL_MEDIUM = 60 * 1000; // 60 saniye (stok & odaklanma yenilemesi)
export const CACHE_TTL_LONG = 2 * 60 * 1000; // 2 dakika (menü, vitrin, soslar, yorumlar)

const memoryStore = new Map();
const inFlightStore = new Map();

export function getBrowserCache(key) {
  if (!key) return null;
  if (memoryStore.has(key)) {
    return memoryStore.get(key);
  }
  if (typeof window !== 'undefined') {
    try {
      const raw = sessionStorage.getItem(STORAGE_PREFIX + key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && 'data' in parsed) {
          const entry = {
            data: parsed.data,
            updatedAt: Number(parsed.updatedAt || 0),
          };
          memoryStore.set(key, entry);
          return entry;
        }
      }
    } catch {
      // ignore storage errors
    }
  }
  return null;
}

export function isBrowserCacheStale(key, maxAgeMs = CACHE_TTL_LONG) {
  const entry = getBrowserCache(key);
  if (!entry || !entry.updatedAt) return true;
  return Date.now() - entry.updatedAt >= maxAgeMs;
}

export function setBrowserCache(key, data, { persist = true, broadcastKey = null } = {}) {
  if (!key) return null;
  const now = Date.now();
  const entry = { data, updatedAt: now };
  memoryStore.set(key, entry);

  if (persist && typeof window !== 'undefined') {
    try {
      const serialized = JSON.stringify(entry);
      if (serialized.length <= MAX_SESSION_BYTES) {
        sessionStorage.setItem(STORAGE_PREFIX + key, serialized);
      } else {
        sessionStorage.removeItem(STORAGE_PREFIX + key);
      }
    } catch {
      // sessionStorage quota or private mode fallback
    }
  }

  if (broadcastKey && typeof window !== 'undefined') {
    try {
      localStorage.setItem(broadcastKey, String(now));
      window.dispatchEvent(new CustomEvent(broadcastKey, { detail: data }));
    } catch {}
  }

  return entry;
}

export function invalidateBrowserCache(keyOrPrefix) {
  if (!keyOrPrefix) return;
  for (const k of Array.from(memoryStore.keys())) {
    if (k === keyOrPrefix || k.startsWith(keyOrPrefix)) {
      memoryStore.delete(k);
    }
  }
  if (typeof window !== 'undefined') {
    try {
      const toRemove = [];
      for (let i = 0; i < sessionStorage.length; i += 1) {
        const sk = sessionStorage.key(i);
        if (!sk || !sk.startsWith(STORAGE_PREFIX)) continue;
        const cleanKey = sk.slice(STORAGE_PREFIX.length);
        if (cleanKey === keyOrPrefix || cleanKey.startsWith(keyOrPrefix)) {
          toRemove.push(sk);
        }
      }
      toRemove.forEach((sk) => sessionStorage.removeItem(sk));
    } catch {}
  }
}

export async function fetchWithBrowserCache(
  key,
  url,
  { force = false, maxAgeMs = CACHE_TTL_LONG, persist = true, extract = (json) => json } = {}
) {
  if (!force) {
    const entry = getBrowserCache(key);
    if (entry && !isBrowserCacheStale(key, maxAgeMs)) {
      return { ok: true, data: entry.data, fromCache: true };
    }
    if (inFlightStore.has(key)) {
      return inFlightStore.get(key);
    }
  }

  const reqPromise = (async () => {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        return { ok: false, error: json?.error || 'Veri alınamadı.' };
      }
      const extracted = extract(json);
      setBrowserCache(key, extracted, { persist });
      return { ok: true, data: extracted, fromCache: false };
    } catch (err) {
      return { ok: false, error: err?.message || 'Bağlantı hatası.' };
    } finally {
      if (!force) {
        inFlightStore.delete(key);
      }
    }
  })();

  if (!force) {
    inFlightStore.set(key, reqPromise);
  }
  return reqPromise;
}
