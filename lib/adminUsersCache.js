'use client';

/**
 * Tarayıcı İçi Üye, Personel & Rol Önbelleği (RAM + sessionStorage)
 * - Sekme/sayfa geçişlerinde DB'ye tekrar istek atmadan tarayıcıdan anında yükler.
 * - Ekleme, güncelleme, onay/engelleme, silme ve manuel "Yenile" ile anında güncellenir.
 * - Sekme açılışında 2 dk, WhatsApp / başka sekmeden dönüşte 60 sn tazelik kontrolü ile arka planda sessiz yeniler.
 * - Çıkış yapıldığında veya tarayıcı sekmesi kapatıldığında kişisel veriler otomatik silinir.
 */

const STORAGE_KEY = 'sd_admin_users_cache_v1';

export const DEFAULT_STALE_MS = 2 * 60 * 1000; // 2 dakika
export const FOCUS_STALE_MS = 60 * 1000; // 60 saniye

let memoryCache = null;
const inFlightRequests = new Map();

function readFromSessionStorage() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeToSessionStorage(cacheObj) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cacheObj));
  } catch {
    // sessionStorage quota or private mode fallback: keep in-memory cache
  }
}

function emptyCache() {
  return {
    customers: null,
    adminUsers: null,
    roles: null,
    loadedScopes: { customers: false, staff: false },
    scopeUpdatedAt: { customers: 0, staff: 0 },
    updatedAt: 0,
  };
}

export function getCachedAdminUsersData() {
  if (memoryCache) return memoryCache;
  const fromStorage = readFromSessionStorage();
  if (fromStorage) {
    const fallbackTs = Number(fromStorage.updatedAt || 0);
    memoryCache = {
      customers: Array.isArray(fromStorage.customers) ? fromStorage.customers : null,
      adminUsers: Array.isArray(fromStorage.adminUsers) ? fromStorage.adminUsers : null,
      roles: Array.isArray(fromStorage.roles) ? fromStorage.roles : null,
      loadedScopes: {
        customers: Boolean(fromStorage.loadedScopes?.customers),
        staff: Boolean(fromStorage.loadedScopes?.staff),
      },
      scopeUpdatedAt: {
        customers: Number(fromStorage.scopeUpdatedAt?.customers || (fromStorage.loadedScopes?.customers ? fallbackTs : 0)),
        staff: Number(fromStorage.scopeUpdatedAt?.staff || (fromStorage.loadedScopes?.staff ? fallbackTs : 0)),
      },
      updatedAt: fallbackTs,
    };
    return memoryCache;
  }
  return null;
}

export function setCachedAdminUsersData(partialData = {}, { broadcast = false } = {}) {
  const prev = getCachedAdminUsersData() || emptyCache();
  const now = Date.now();
  const hasCustomers = Array.isArray(partialData?.customers);
  const hasStaff = Array.isArray(partialData?.adminUsers) || Array.isArray(partialData?.roles);
  const hasFullStaff = Array.isArray(partialData?.adminUsers) && Array.isArray(partialData?.roles);

  const next = {
    customers: hasCustomers ? partialData.customers : prev.customers,
    adminUsers: Array.isArray(partialData?.adminUsers) ? partialData.adminUsers : prev.adminUsers,
    roles: Array.isArray(partialData?.roles) ? partialData.roles : prev.roles,
    loadedScopes: {
      customers: prev.loadedScopes.customers || hasCustomers,
      staff: prev.loadedScopes.staff || hasFullStaff || hasStaff,
    },
    scopeUpdatedAt: {
      customers: hasCustomers ? now : Number(prev.scopeUpdatedAt?.customers || 0),
      staff: hasStaff ? now : Number(prev.scopeUpdatedAt?.staff || 0),
    },
    updatedAt: now,
  };

  memoryCache = next;
  writeToSessionStorage(next);

  if (broadcast && typeof window !== 'undefined') {
    try {
      localStorage.setItem('sandwich_users_updated', String(now));
      window.dispatchEvent(new CustomEvent('sandwich_users_updated', { detail: next }));
    } catch {}
  }

  return next;
}

export function invalidateAdminUsersCache({ broadcast = false } = {}) {
  memoryCache = null;
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      if (broadcast) {
        localStorage.setItem('sandwich_users_updated', String(Date.now()));
      }
    } catch {}
  }
}

function cacheSatisfiesScope(cache, scope) {
  if (!cache || !cache.loadedScopes) return false;
  if (scope === 'staff') {
    return Boolean(cache.loadedScopes.staff && Array.isArray(cache.adminUsers) && Array.isArray(cache.roles));
  }
  if (scope === 'customers') {
    return Boolean(cache.loadedScopes.customers && Array.isArray(cache.customers));
  }
  return Boolean(
    cache.loadedScopes.staff &&
      cache.loadedScopes.customers &&
      Array.isArray(cache.adminUsers) &&
      Array.isArray(cache.roles) &&
      Array.isArray(cache.customers)
  );
}

export function isAdminUsersCacheStale(scope = 'all', maxAgeMs = DEFAULT_STALE_MS) {
  const cached = getCachedAdminUsersData();
  if (!cacheSatisfiesScope(cached, scope)) return true;

  const customersTs = Number(cached.scopeUpdatedAt?.customers || 0);
  const staffTs = Number(cached.scopeUpdatedAt?.staff || 0);
  const ageRef =
    scope === 'customers'
      ? customersTs
      : scope === 'staff'
      ? staffTs
      : Math.min(customersTs, staffTs);

  if (!ageRef) return true;
  return Date.now() - ageRef >= maxAgeMs;
}

export async function fetchAdminUsersCached({ force = false, scope = 'all', maxAgeMs = null } = {}) {
  if (!force) {
    const cached = getCachedAdminUsersData();
    const freshEnough = maxAgeMs === null ? true : !isAdminUsersCacheStale(scope, maxAgeMs);
    if (cacheSatisfiesScope(cached, scope) && freshEnough) {
      return { success: true, data: cached, fromBrowserCache: true };
    }
  }

  const dedupKey = force ? `force:${scope}` : inFlightRequests.has('all') ? 'all' : scope;
  if (!force && inFlightRequests.has(dedupKey)) {
    return inFlightRequests.get(dedupKey);
  }

  const url = scope && scope !== 'all' ? `/api/admin/users?scope=${encodeURIComponent(scope)}` : '/api/admin/users';
  const reqPromise = (async () => {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        return { success: false, error: json?.error || 'Kullanıcı verileri alınamadı.' };
      }
      const merged = setCachedAdminUsersData(json.data || {}, { broadcast: false });
      return { success: true, data: merged, fromBrowserCache: false };
    } finally {
      inFlightRequests.delete(dedupKey);
    }
  })();

  if (!force) {
    inFlightRequests.set(dedupKey, reqPromise);
  }
  return reqPromise;
}
