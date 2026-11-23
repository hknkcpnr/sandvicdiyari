/**
 * In-Memory Cache Engine
 * Ürünler, Seçenekler/Soslar ve Müşteri Yorumları için yüksek hızlı RAM önbelleği.
 * Veritabanı havuzunu (connection pool) korur, aşırı trafikte sorguları mikrosaniyelerde karşılar.
 */

const productCacheStore = new Map();
const optionsCacheStore = new Map();
const reviewsCacheStore = new Map();
const siteContentCacheStore = new Map();
const adminSettingsCacheStore = new Map();

const DEFAULT_TTL_MS = 20000; // 20 saniye
const SITE_CONTENT_TTL_MS = 60000; // 60 saniye
const ADMIN_SETTINGS_TTL_MS = 15000; // 15 saniye
const MAX_CACHE_ENTRIES = 100;

function setBoundedCache(store, key, data, ttlMs = DEFAULT_TTL_MS) {
  const now = Date.now();
  if (store.size >= MAX_CACHE_ENTRIES) {
    for (const [k, entry] of store.entries()) {
      if (now - entry.timestamp >= ttlMs) {
        store.delete(k);
      }
    }
    if (store.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = store.keys().next().value;
      if (oldestKey !== undefined) store.delete(oldestKey);
    }
  }
  store.set(key, { data, timestamp: now });
}

// --- ÜRÜN ÖNBELLEĞİ ---
export function getCachedProducts(categoryKey = 'all') {
  const cached = productCacheStore.get(categoryKey);
  if (cached && Date.now() - cached.timestamp < DEFAULT_TTL_MS) {
    return cached.data;
  }
  if (cached) productCacheStore.delete(categoryKey);
  return null;
}

export function setCachedProducts(categoryKey = 'all', data = []) {
  setBoundedCache(productCacheStore, categoryKey, data);
}

export function invalidateProductCache() {
  productCacheStore.clear();
}

// --- SEÇENEKLER & SOSLAR ÖNBELLEĞİ (/api/options) ---
export function getCachedOptions() {
  const cached = optionsCacheStore.get('options_all');
  if (cached && Date.now() - cached.timestamp < DEFAULT_TTL_MS) {
    return cached.data;
  }
  if (cached) optionsCacheStore.delete('options_all');
  return null;
}

export function setCachedOptions(data = []) {
  setBoundedCache(optionsCacheStore, 'options_all', data);
}

export function invalidateOptionsCache() {
  optionsCacheStore.clear();
}

// --- YORUMLAR & DEĞERLENDİRMELER ÖNBELLEĞİ (/api/reviews) ---
export function getCachedReviews(key = 'approved') {
  const cached = reviewsCacheStore.get(key);
  if (cached && Date.now() - cached.timestamp < DEFAULT_TTL_MS) {
    return cached.data;
  }
  if (cached) reviewsCacheStore.delete(key);
  return null;
}

export function setCachedReviews(key = 'approved', data = []) {
  setBoundedCache(reviewsCacheStore, key, data);
}

export function invalidateReviewsCache() {
  reviewsCacheStore.clear();
}

// --- SİTE İÇERİĞİ ÖNBELLEĞİ (/api/site-content) ---
export function getCachedSiteContent(key = 'full') {
  const cached = siteContentCacheStore.get(key);
  if (cached && Date.now() - cached.timestamp < SITE_CONTENT_TTL_MS) {
    return cached.data;
  }
  if (cached) siteContentCacheStore.delete(key);
  return null;
}

export function setCachedSiteContent(key = 'full', data = null) {
  setBoundedCache(siteContentCacheStore, key, data, SITE_CONTENT_TTL_MS);
}

export function invalidateSiteContentCache() {
  siteContentCacheStore.clear();
}

// --- YÖNETİCİ SİSTEM AYARLARI ÖNBELLEĞİ (/api/admin/settings) ---
export function getCachedAdminSettings() {
  const cached = adminSettingsCacheStore.get('settings');
  if (cached && Date.now() - cached.timestamp < ADMIN_SETTINGS_TTL_MS) {
    return cached.data;
  }
  if (cached) adminSettingsCacheStore.delete('settings');
  return null;
}

export function setCachedAdminSettings(data = null) {
  setBoundedCache(adminSettingsCacheStore, 'settings', data, ADMIN_SETTINGS_TTL_MS);
}

export function invalidateAdminSettingsCache() {
  adminSettingsCacheStore.clear();
}
