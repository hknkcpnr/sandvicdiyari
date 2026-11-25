export const DEFAULT_MENU_DRINK_GROUPS = {
  '1': [
    { id: 'm1-ayran', name: 'Ayran', price: 0, isAvailable: true },
    { id: 'm1-kutu-kola', name: 'Kutu Kola', price: 20, isAvailable: true },
  ],
  '2': [
    { id: 'm2-ayran-2', name: '2 Ayran', price: 0, isAvailable: true },
    { id: 'm2-kola-1l', name: '1 Litre Kola', price: 20, isAvailable: true },
  ],
  '3': [
    { id: 'm3-ayran-3', name: '3 Ayran', price: 0, isAvailable: true },
    { id: 'm3-kola-1l', name: '1 Litre Kola', price: 20, isAvailable: true },
  ],
  '4': [
    { id: 'm4-ayran-4', name: '4 Ayran', price: 0, isAvailable: true },
    { id: 'm4-kola-25l', name: '2.5 Litre Kola', price: 20, isAvailable: true },
  ],
};

export const MENU_DRINK_TIER_META = [
  { key: '1', label: '1 Kişilik Menüler', badge: 'Tek Kişilik' },
  { key: '2', label: '2 Kişilik Menüler', badge: '2 Kişilik' },
  { key: '3', label: '3 Kişilik Menüler', badge: '3 Kişilik' },
  { key: '4', label: '4 Kişilik Menüler', badge: '4 Kişilik / Aile' },
];

export function getMenuSizeTier(product) {
  const name = String(product?.name || '').toLocaleLowerCase('tr-TR');
  if (/\b4\s*kişilik\b|aile/i.test(name)) return '4';
  if (/\b3\s*kişilik\b/i.test(name)) return '3';
  if (/\b2\s*kişilik\b/i.test(name)) return '2';
  return '1';
}

export function normalizeMenuDrinkGroups(raw) {
  const result = {};
  ['1', '2', '3', '4'].forEach((tier) => {
    const arr = raw && Array.isArray(raw[tier]) ? raw[tier] : DEFAULT_MENU_DRINK_GROUPS[tier];
    result[tier] = arr
      .map((d, idx) => ({
        id: d?.id ? String(d.id).trim().slice(0, 50) : `m${tier}-${Date.now()}-${idx}`,
        name: typeof d === 'string' ? d.trim() : String(d?.name || '').trim(),
        price: typeof d === 'object' ? Math.max(0, Math.min(500, Number(d?.price) || 0)) : 0,
        isAvailable: typeof d === 'object' && d?.isAvailable === false ? false : true,
      }))
      .filter((d) => d.name.length > 0);
  });
  return result;
}

export const DEFAULT_PRODUCT_OPTIONS = {
  freeSauceLimit: 20,
  extraSaucePrice: 5,
  sauces: [
    { id: 'ketcap', name: 'Ketçap', isAvailable: true, price: 0 },
    { id: 'mayonez', name: 'Mayonez', isAvailable: true, price: 0 },
    { id: 'sarimsakli', name: 'Sarımsaklı Mayonez', isAvailable: true, price: 0 },
  ],
  extras: [
    { id: 'extra-kasar', name: 'Ekstra Kaşar Peyniri', price: 20, isAvailable: true },
    { id: 'extra-sogan', name: 'Karamelize Soğan', price: 15, isAvailable: true },
    { id: 'extra-patates', name: 'Ekstra Çıtır Patates', price: 50, isAvailable: true },
  ],
  drinks: DEFAULT_MENU_DRINK_GROUPS['1'],
  menuDrinkGroups: DEFAULT_MENU_DRINK_GROUPS,
};
