/**
 * In-Memory Cache Engine
 * Ürünler, Seçenekler/Soslar ve Müşteri Yorumları için yüksek hızlı RAM önbelleği.
 * Veritabanı havuzunu (connection pool) korur, aşırı trafikte sorguları mikrosaniyelerde karşılar.
 */

const productCacheStore = new Map();
const optionsCacheStore = new Map();
const reviewsCacheStore = new Map();

const DEFAULT_TTL_MS = 20000; // 20 saniye

// --- ÜRÜN ÖNBELLEĞİ ---
export function getCachedProducts(categoryKey = 'all') {
  const cached = productCacheStore.get(categoryKey);
  if (cached && Date.now() - cached.timestamp < DEFAULT_TTL_MS) {
    return cached.data;
  }
  return null;
}

export function setCachedProducts(categoryKey = 'all', data = []) {
  productCacheStore.set(categoryKey, {
    data,
    timestamp: Date.now(),
  });
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
  return null;
}

export function setCachedOptions(data = []) {
  optionsCacheStore.set('options_all', {
    data,
    timestamp: Date.now(),
  });
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
  return null;
}

export function setCachedReviews(key = 'approved', data = []) {
  reviewsCacheStore.set(key, {
    data,
    timestamp: Date.now(),
  });
}

export function invalidateReviewsCache() {
  reviewsCacheStore.clear();
}
