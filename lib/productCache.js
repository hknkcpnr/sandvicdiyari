/**
 * In-Memory Product Cache
 * Sıkça tekrarlanan GET /api/products sorgularını RAM'den mikro-saniyeler içinde karşılar.
 * Ürün eklendiğinde, güncellendiğinde veya silindiğinde anında geçersiz kılınır (cache invalidation).
 */

const cacheStore = new Map();
const DEFAULT_TTL_MS = 15000; // 15 saniye

export function getCachedProducts(categoryKey = 'all') {
  const cached = cacheStore.get(categoryKey);
  if (cached && Date.now() - cached.timestamp < DEFAULT_TTL_MS) {
    return cached.data;
  }
  return null;
}

export function setCachedProducts(categoryKey = 'all', data = []) {
  cacheStore.set(categoryKey, {
    data,
    timestamp: Date.now(),
  });
}

export function invalidateProductCache() {
  cacheStore.clear();
}
