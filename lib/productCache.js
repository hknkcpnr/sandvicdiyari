/**
 * In-Memory Cache Engine
 * Ürünler, Seçenekler/Soslar ve Müşteri Yorumları için yüksek hızlı RAM önbelleği.
 * Veritabanı havuzunu (connection pool) korur, aşırı trafikte sorguları mikrosaniyelerde karşılar.
 */

const productCacheStore = new Map();
const optionsCacheStore = new Map();
const reviewsCacheStore = new Map();

const DEFAULT_TTL_MS = 20000; // 20 saniye
const MAX_CACHE_ENTRIES = 100;

function setBoundedCache(store, key, data) {
  const now = Date.now();
  if (store.size >= MAX_CACHE_ENTRIES) {
    for (const [k, entry] of store.entries()) {
      if (now - entry.timestamp >= DEFAULT_TTL_MS) {
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
