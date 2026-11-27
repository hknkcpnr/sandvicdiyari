'use client';

/**
 * Tarayıcı İçi Üye, Personel & Rol Önbelleği (RAM + sessionStorage)
 * - İlk yüklemeden sonra sekme veya sayfa geçişlerinde DB'ye tekrar istek atmaz.
 * - Ekleme, güncelleme, onay, engelleme, silme veya manuel "Yenile" ile güncellenir.
 * - Çıkış yapıldığında veya tarayıcı sekmesi kapatıldığında kişisel veriler otomatik silinir.
 */

const STORAGE_KEY = 'sd_admin_users_cache_v1';

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
    updatedAt: 0,
  };
}

export function getCachedAdminUsersData() {
  if (memoryCache) return memoryCache;
  const fromStorage = readFromSessionStorage();
  if (fromStorage) {
    memoryCache = {
      customers: Array.isArray(fromStorage.customers) ? fromStorage.customers : null,
      adminUsers: Array.isArray(fromStorage.adminUsers) ? fromStorage.adminUsers : null,
      roles: Array.isArray(fromStorage.roles) ? fromStorage.roles : null,
      loadedScopes: {
        customers: Boolean(fromStorage.loadedScopes?.customers),
        staff: Boolean(fromStorage.loadedScopes?.staff),
      },
      updatedAt: Number(fromStorage.updatedAt || 0),
    };
    return memoryCache;
  }
  return null;
}

export function setCachedAdminUsersData(partialData = {}, { broadcast = false } = {}) {
  const prev = getCachedAdminUsersData() || emptyCache();
  const hasCustomers = Array.isArray(partialData?.customers);
  const hasStaff = Array.isArray(partialData?.adminUsers) || Array.isArray(partialData?.roles);

  const next = {
    customers: hasCustomers ? partialData.customers : prev.customers,
    adminUsers: Array.isArray(partialData?.adminUsers) ? partialData.adminUsers : prev.adminUsers,
    roles: Array.isArray(partialData?.roles) ? partialData.roles : prev.roles,
    loadedScopes: {
      customers: prev.loadedScopes.customers || hasCustomers,
      staff: prev.loadedScopes.staff || (Array.isArray(partialData?.adminUsers) && Array.isArray(partialData?.roles)) || hasStaff,
    },
    updatedAt: Date.now(),
  };

  memoryCache = next;
  writeToSessionStorage(next);

  if (broadcast && typeof window !== 'undefined') {
    try {
      localStorage.setItem('sandwich_users_updated', String(Date.now()));
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

export async function fetchAdminUsersCached({ force = false, scope = 'all' } = {}) {
  if (!force) {
    const cached = getCachedAdminUsersData();
    if (cacheSatisfiesScope(cached, scope)) {
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
