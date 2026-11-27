'use client';

import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  closeOptionsModal,
  openAuthModal,
  adjustSauceCount,
  showMessageModal
} from '@/store/slices/uiSlice';
import { addToCart } from '@/store/slices/cartSlice';
import {
  DEFAULT_PRODUCT_OPTIONS,
  DEFAULT_MENU_DRINK_GROUPS,
  getMenuSizeTier,
  normalizeMenuDrinkGroups
} from '@/lib/productOptionsDefaults';
import {
  getBrowserCache,
  invalidateBrowserCache,
  isBrowserCacheStale,
  fetchWithBrowserCache,
  CACHE_TTL_LONG
} from '@/lib/browserDataCache';

function extractProductIngredients(product) {
  if (!product) return [];
  if (Array.isArray(product.ingredients) && product.ingredients.length > 0) {
    return product.ingredients.map((s) => String(s).trim()).filter(Boolean);
  }
  if (
    Array.isArray(product.options) &&
    product.options.length > 0 &&
    product.options.every((s) => typeof s === 'string')
  ) {
    return product.options.map((s) => String(s).trim()).filter(Boolean);
  }
  const nameLower = String(product.name || '').toLocaleLowerCase('tr-TR');
  const rawDesc = String(product.description || product.desc || '').trim();
  const descLower = rawDesc.toLocaleLowerCase('tr-TR');

  // Menü ürünlerinde açıklama sadece "Maxi Karışık Sandviç + Patates + İçecek" şeklindeyse
  // sandviçin içindekilerini de çıkarılabilir etiket olarak sun
  if (
    (nameLower.includes('maxi karışık') || descLower.includes('maxi karışık')) &&
    !descLower.includes('sosis') &&
    !descLower.includes('sucuk')
  ) {
    return ['Sosis', 'Salam', 'Sucuk', 'Kaşar', 'Domates', 'Ketçap', 'Mayonez', 'Kornişon turşu'];
  }

  if (!rawDesc) {
    if (product.category === 'sandwich' || product.category === 'menu') {
      return ['Sosis', 'Sucuk', 'Kaşar', 'Domates', 'Turşu', 'Ketçap', 'Mayonez'];
    }
    return [];
  }

  const cleaned = rawDesc
    .replace(/\.+$/, '')
    .replace(/^.*ekmeğinde\s+/i, '')
    .replace(/\s+ziyafeti$/i, '');
  return cleaned
    .split(/(?:,|\+|\s+ve\s+)/i)
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && p.length <= 60)
    .map((p) => p.charAt(0).toLocaleUpperCase('tr-TR') + p.slice(1));
}

export default function OptionsModal() {
  const dispatch = useDispatch();
  const { isOptionsModalOpen, selectedProductForOptions, sauceCounts } = useSelector(
    (state) => state.ui
  );
  const { currentUser } = useSelector((state) => state.auth);
  const allProducts = useSelector((state) => state.product.items);

  const [selectedDrink, setSelectedDrink] = useState('Ayran');
  const [selectedSuggestedDrinkIds, setSelectedSuggestedDrinkIds] = useState([]);
  const [saucesList, setSaucesList] = useState([]);
  const [freeSauceLimit, setFreeSauceLimit] = useState(DEFAULT_PRODUCT_OPTIONS.freeSauceLimit ?? 2);
  const [extraSaucePrice, setExtraSaucePrice] = useState(DEFAULT_PRODUCT_OPTIONS.extraSaucePrice ?? 5);
  const [extras, setExtras] = useState([]);
  const [drinkOptions, setDrinkOptions] = useState(
    DEFAULT_PRODUCT_OPTIONS.drinks.map((d) => (typeof d === 'string' ? d : d.name))
  );
  const [menuDrinkGroups, setMenuDrinkGroups] = useState(DEFAULT_MENU_DRINK_GROUPS);
  const [optionsLoaded, setOptionsLoaded] = useState(false);
  const [note, setNote] = useState('');
  const [removedIngredients, setRemovedIngredients] = useState([]);

  useEffect(() => {
    if (isOptionsModalOpen) {
      setRemovedIngredients([]);
      setSelectedSuggestedDrinkIds([]);
      if (selectedProductForOptions?.category === 'menu') {
        const tier = getMenuSizeTier(selectedProductForOptions);
        const tierDrinks = (menuDrinkGroups?.[tier] || []).filter((d) => d.isAvailable !== false);
        setSelectedDrink(tierDrinks[0]?.name || 'Ayran');
      }
    }
  }, [isOptionsModalOpen, selectedProductForOptions?.id]);

  // Fetch dynamic options using browser cache (instant open, syncs on updates or >2 min stale)
  useEffect(() => {
    let isMounted = true;

    const applyOptionsData = (data) => {
      if (!isMounted || !data) return;
      if (typeof data.freeSauceLimit === 'number') {
        setFreeSauceLimit(data.freeSauceLimit);
      }
      if (typeof data.extraSaucePrice === 'number') {
        setExtraSaucePrice(data.extraSaucePrice);
      }
      if (Array.isArray(data.sauces)) {
        setSaucesList(data.sauces);
      }
      if (Array.isArray(data.extras)) {
        setExtras((prev) => {
          const prevCheckedMap = {};
          (prev || []).forEach((p) => {
            if (p.checked) prevCheckedMap[p.id || p.name] = true;
          });
          return data.extras.map((e) => ({
            ...e,
            checked: !!prevCheckedMap[e.id || e.name],
          }));
        });
      }
      if (Array.isArray(data.drinks)) {
        setDrinkOptions(
          data.drinks
            .filter((d) => (typeof d === 'object' ? d.isAvailable !== false : true))
            .map((d) => (typeof d === 'string' ? d : d.name))
        );
      }
      if (data.menuDrinkGroups && typeof data.menuDrinkGroups === 'object') {
        setMenuDrinkGroups(normalizeMenuDrinkGroups(data.menuDrinkGroups));
      }
      setOptionsLoaded(true);
    };

    async function fetchDynamicOptions(force = false) {
      const cached = getBrowserCache('options_all');
      if (!force && cached?.data) {
        applyOptionsData(cached.data);
        if (!isBrowserCacheStale('options_all', CACHE_TTL_LONG)) return;
      }

      try {
        const res = await fetchWithBrowserCache('options_all', '/api/options', {
          force: force === true,
          maxAgeMs: CACHE_TTL_LONG,
          persist: true,
          extract: (json) => json.data
        });
        if (isMounted && res.ok && res.data) {
          applyOptionsData(res.data);
        } else if (isMounted && !optionsLoaded && !cached?.data) {
          setSaucesList(DEFAULT_PRODUCT_OPTIONS.sauces);
          setExtras(DEFAULT_PRODUCT_OPTIONS.extras.map((e) => ({ ...e, checked: false })));
          setOptionsLoaded(true);
        }
      } catch (err) {
        console.warn('Options API fetch fallback:', err);
        if (isMounted && !optionsLoaded && !cached?.data) {
          setSaucesList(DEFAULT_PRODUCT_OPTIONS.sauces);
          setExtras(DEFAULT_PRODUCT_OPTIONS.extras.map((e) => ({ ...e, checked: false })));
          setOptionsLoaded(true);
        }
      }
    }

    fetchDynamicOptions(false);

    const handleOptionsUpdated = (e) => {
      if (e?.detail) {
        applyOptionsData(e.detail);
      } else {
        invalidateBrowserCache('options_all');
        fetchDynamicOptions(true);
      }
    };
    const handleStorage = (e) => {
      if (e.key === 'sandwich_options_updated') {
        invalidateBrowserCache('options_all');
        fetchDynamicOptions(true);
      }
    };

    window.addEventListener('sandwich_options_updated', handleOptionsUpdated);
    window.addEventListener('storage', handleStorage);

    return () => {
      isMounted = false;
      window.removeEventListener('sandwich_options_updated', handleOptionsUpdated);
      window.removeEventListener('storage', handleStorage);
    };
  }, [isOptionsModalOpen]);

  // Menü boyutu değiştiğinde (1/2/3/4 kişilik) ilgili menünün ilk içeceğini otomatik seç
  useEffect(() => {
    if (!isOptionsModalOpen || !selectedProductForOptions || selectedProductForOptions.category !== 'menu') return;
    const tier = getMenuSizeTier(selectedProductForOptions);
    const tierList = (menuDrinkGroups?.[tier] || [])
      .filter((d) => d.isAvailable !== false)
      .map((d) => d.name);
    const fallbackList = tierList.length > 0 ? tierList : drinkOptions;
    if (fallbackList.length > 0 && !fallbackList.includes(selectedDrink)) {
      setSelectedDrink(fallbackList[0]);
    }
  }, [isOptionsModalOpen, selectedProductForOptions, menuDrinkGroups, drinkOptions, selectedDrink]);

  if (!isOptionsModalOpen || !selectedProductForOptions) return null;

  const isMenu = selectedProductForOptions.category === 'menu';
  const isDrink = selectedProductForOptions.category === 'drink';
  const menuTier = isMenu ? getMenuSizeTier(selectedProductForOptions) : '1';
  const activeMenuDrinkItems = isMenu
    ? (() => {
        const tierList = (menuDrinkGroups?.[menuTier] || []).filter((d) => d.isAvailable !== false);
        if (tierList.length > 0) return tierList;
        return drinkOptions.map((name, i) => ({ id: `dr-${i}`, name, price: 0, isAvailable: true }));
      })()
    : [];
  const selectedMenuDrinkObj = isMenu
    ? activeMenuDrinkItems.find((d) => d.name === selectedDrink) || activeMenuDrinkItems[0] || null
    : null;
  const drinkExtraCost = isMenu ? Math.max(0, Number(selectedMenuDrinkObj?.price) || 0) : 0;

  // Tekli ürünler için altta önerilecek soğuk içecekler
  const suggestedDrinks = (!isMenu && !isDrink)
    ? (allProducts || []).filter((p) => p.category === 'drink' && p.isAvailable !== false)
    : [];

  const selectedSuggestedDrinks = suggestedDrinks.filter((d) =>
    selectedSuggestedDrinkIds.includes(d.id)
  );
  const suggestedDrinksCost = selectedSuggestedDrinks.reduce(
    (sum, d) => sum + (Number(d.price) || 0),
    0
  );

  const handleToggleSuggestedDrink = (drinkId) => {
    setSelectedSuggestedDrinkIds((prev) =>
      prev.includes(drinkId) ? prev.filter((id) => id !== drinkId) : [...prev, drinkId]
    );
  };

  // Only show available sauces and extras to the customer
  const availableSauces = (saucesList || []).filter((s) => s.isAvailable !== false);
  const availableExtras = (extras || []).filter((e) => e.isAvailable !== false);

  const totalSauceCount = Object.values(sauceCounts || {}).reduce(
    (sum, c) => sum + (Number(c) || 0),
    0
  );
  const paidSauceCount = Math.max(0, totalSauceCount - freeSauceLimit);
  const extraSauceCost = paidSauceCount * extraSaucePrice;

  const extrasCost = extras
    .filter((e) => e.checked && e.isAvailable !== false)
    .reduce((sum, e) => sum + (Number(e.price) || 0), 0);

  const currentTotalPrice =
    Number(selectedProductForOptions.price || 0) +
    extrasCost +
    extraSauceCost +
    suggestedDrinksCost +
    drinkExtraCost;

  const handleToggleExtra = (index) => {
    setExtras((prev) =>
      prev.map((extra, i) =>
        i === index ? { ...extra, checked: !extra.checked } : extra
      )
    );
  };

  const productIngredients = extractProductIngredients(selectedProductForOptions);

  const handleToggleIngredient = (ingredient) => {
    setRemovedIngredients((prev) =>
      prev.includes(ingredient)
        ? prev.filter((item) => item !== ingredient)
        : [...prev, ingredient]
    );
  };

  const handleConfirm = () => {
    const selectedExtras = extras.filter((e) => e.checked && e.isAvailable !== false);

    // Build sauceLabels map for dynamic cart and adisyon display
    const sauceLabels = {};
    (saucesList || []).forEach((s) => {
      const key = s.id || s.key || s.name;
      sauceLabels[key] = s.name || s.label;
    });

    dispatch(
      addToCart({
        product: selectedProductForOptions,
        sauces: sauceCounts,
        sauceLabels,
        freeSauceLimit,
        extraSaucePrice,
        extras: selectedExtras,
        drink: isMenu ? selectedDrink : null,
        drinkPrice: drinkExtraCost,
        note,
        removedIngredients,
      })
    );

    // Tekli üründe seçilen öneri içecekleri de sepete ekle
    selectedSuggestedDrinks.forEach((drinkProd) => {
      dispatch(
        addToCart({
          product: drinkProd,
          sauces: {},
          extras: [],
          note: '',
          drink: null,
          removedIngredients: [],
        })
      );
    });

    dispatch(closeOptionsModal());
    dispatch(
      showMessageModal({
        title: 'Sepete Eklendi! 🥪',
        text:
          selectedSuggestedDrinks.length > 0
            ? `${selectedProductForOptions.name} ve ${selectedSuggestedDrinks.length} adet içecek sepetinize eklendi!`
            : `${selectedProductForOptions.name} sepetinize eklendi!`,
        type: 'success',
      })
    );
    // Reset form state
    setNote('');
    setRemovedIngredients([]);
    setSelectedSuggestedDrinkIds([]);
    if (drinkOptions.length > 0) {
      setSelectedDrink(drinkOptions[0]);
    }
    setExtras((prev) => prev.map((e) => ({ ...e, checked: false })));
  };

  return (
    <div
      id="options-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) dispatch(closeOptionsModal());
      }}
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 bg-stone-900/65 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200"
    >
      <div className="bg-stone-50 rounded-2xl sm:rounded-3xl max-w-[680px] lg:max-w-5xl xl:max-w-6xl w-full shadow-2xl my-auto sm:my-4 flex flex-col lg:flex-row max-h-[94vh] lg:max-h-none overflow-hidden border border-stone-200/90 relative">
        {/* SOL VİTRİN PANELİ: TAM BOY BÜYÜK GÖRSEL & EDITORIAL KART */}
        <div className="shrink-0 lg:w-[360px] xl:w-[400px] bg-stone-950 relative overflow-hidden flex flex-col justify-between text-left min-h-[210px] sm:min-h-[235px] lg:min-h-[500px]">
          {/* Tam Arka Plan Ürün Fotoğrafı */}
          <img
            id="opt-modal-img"
            src={selectedProductForOptions.image}
            alt={selectedProductForOptions.name}
            className="absolute inset-0 w-full h-full object-cover object-center scale-[1.01] hover:scale-105 transition-transform duration-700"
            onError={(e) => {
              e.currentTarget.src =
                'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=800';
            }}
          />

          {/* Sinematik Gradient Katmanı (Üstten hafif, alttan derin okunabilirlik) */}
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/65 to-stone-950/15 pointer-events-none" />

          {/* Üst Satır: Rozet & Mobil Kapat Butonu */}
          <div className="relative z-10 flex items-center justify-between gap-2 p-3.5 sm:p-4 lg:p-5">
            <div className="flex flex-wrap items-center gap-1.5">
              {selectedProductForOptions.badge && (
                <span className="inline-flex items-center gap-1 bg-brand-500 text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full shadow-lg shadow-brand-500/30">
                  <i className="fa-solid fa-fire text-[9px]"></i>
                  {selectedProductForOptions.badge}
                </span>
              )}
              {selectedProductForOptions.prepTime && (
                <span className="inline-flex items-center gap-1 bg-black/55 backdrop-blur-md text-white/95 text-[10px] font-bold px-2.5 py-1 rounded-full border border-white/15">
                  <i className="fa-regular fa-clock text-amber-400"></i>
                  {selectedProductForOptions.prepTime}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => dispatch(closeOptionsModal())}
              className="lg:hidden w-8 h-8 rounded-full bg-black/50 backdrop-blur-md hover:bg-black/75 text-white border border-white/20 flex items-center justify-center shadow-md cursor-pointer transition-colors"
              title="Kapat"
            >
              <i className="fa-solid fa-xmark text-sm"></i>
            </button>
          </div>

          {/* Alt Satır: Başlık, Açıklama, Etiketler & Canlı Fiyat */}
          <div className="relative z-10 p-4 sm:p-5 lg:p-6 pt-12 space-y-3 mt-auto">
            <div className="space-y-1.5">
              <h4
                id="opt-modal-title"
                className="font-black text-lg sm:text-xl lg:text-2xl text-white leading-tight drop-shadow-sm"
              >
                {selectedProductForOptions.name}
              </h4>

              {(selectedProductForOptions.description || selectedProductForOptions.desc) && (
                <p className="text-stone-200/90 text-xs lg:text-[13px] leading-relaxed line-clamp-3">
                  {selectedProductForOptions.description || selectedProductForOptions.desc}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-white/15">
              <div className="flex items-baseline gap-2">
                <span
                  id="opt-modal-price"
                  className="text-2xl sm:text-3xl font-black text-amber-400 leading-none tracking-tight drop-shadow"
                >
                  ₺{currentTotalPrice.toFixed(2)}
                </span>
                {(extrasCost > 0 || extraSauceCost > 0 || suggestedDrinksCost > 0 || drinkExtraCost > 0) && (
                  <span className="text-xs font-bold text-stone-300/80 line-through">
                    ₺{Number(selectedProductForOptions.price).toFixed(2)}
                  </span>
                )}
              </div>

              <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold text-emerald-300 bg-emerald-500/20 backdrop-blur-xs border border-emerald-400/30 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Taze &amp; Sıcak
              </span>
            </div>
          </div>
        </div>

        {/* SAĞ ÖZELLEŞTİRME PANELİ */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-stone-50/80">
          {/* Masaüstü Sağ Üst Başlık & Kapat */}
          <div className="hidden lg:flex items-center justify-between px-5 py-3.5 border-b border-stone-200/80 bg-white shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-amber-500 text-white flex items-center justify-center text-xs shadow-xs">
                <i className="fa-solid fa-sliders"></i>
              </span>
              <div>
                <h5 className="text-xs font-black text-stone-900 uppercase tracking-wider">
                  Siparişini Özelleştir
                </h5>
                <p className="text-[11px] text-stone-500 font-medium">
                  İçerik, sos, ekstra ve içecek tercihlerini tek ekranda seç
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => dispatch(closeOptionsModal())}
              className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 hover:text-stone-900 flex items-center justify-center shrink-0 cursor-pointer transition-colors"
              title="Kapat"
            >
              <i className="fa-solid fa-xmark text-sm"></i>
            </button>
          </div>

          {/* Seçenekler Alanı (Masaüstünde Scroll Yok, Mobilde Akıcı) */}
          <div className="flex-1 overflow-y-auto lg:overflow-visible overscroll-contain p-3 sm:p-4 lg:p-5 text-left touch-pan-y">
            <div className="space-y-3">
              {/* 1 & 2. Ürün İçeriği ve Sos Seçimleri Yan Yana */}
          <div
            className={`grid grid-cols-1 ${
              productIngredients.length > 0 ? 'sm:grid-cols-2' : ''
            } gap-3 items-stretch`}
          >
            {/* 1. Ürün İçeriği (Çıkarılabilir Etiketler) */}
            {productIngredients.length > 0 && (
              <div className="bg-white border border-stone-200/90 shadow-2xs rounded-2xl p-3 sm:px-4 flex flex-col justify-between gap-2">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-extrabold text-stone-800 uppercase flex items-center gap-1.5">
                      <i className="fa-solid fa-layer-group text-brand-500"></i>
                      Ürün İçeriği
                    </span>
                    <span className="text-[10px] font-medium text-stone-400">
                      Çıkarmak için dokunun
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {productIngredients.map((ing) => {
                      const isRemoved = removedIngredients.includes(ing);
                      return (
                        <button
                          key={ing}
                          type="button"
                          onClick={() => handleToggleIngredient(ing)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                            isRemoved
                              ? 'bg-rose-50 border-rose-200 text-rose-600 line-through opacity-80 hover:opacity-100'
                              : 'bg-white border-stone-200 text-stone-800 hover:border-rose-300 hover:bg-rose-50/40'
                          }`}
                          title={isRemoved ? 'Tekrar eklemek için tıklayın' : 'Çıkarmak için tıklayın'}
                        >
                          <i
                            className={`fa-solid ${
                              isRemoved
                                ? 'fa-rotate-left text-[9px] text-rose-500'
                                : 'fa-check text-[9px] text-emerald-600'
                            }`}
                          ></i>
                          <span>{ing}</span>
                          {!isRemoved && (
                            <i className="fa-solid fa-xmark text-[9px] text-stone-400 ml-0.5"></i>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 2. Sos Seçimleri & Adetleri */}
            <div className="bg-white border border-stone-200/90 shadow-2xs rounded-2xl p-3 sm:px-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="text-[11px] font-extrabold text-stone-800 uppercase flex items-center gap-1.5">
                  <i className="fa-solid fa-bottle-droplet text-amber-500"></i>
                  Sos Seçimleri
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    {freeSauceLimit > 0 ? `İlk ${freeSauceLimit} Adet Ücretsiz` : 'Tümü Ücretli'}
                  </span>
                  {extraSaucePrice > 0 && paidSauceCount > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                      +{paidSauceCount} (+₺{extraSauceCost.toFixed(2)})
                    </span>
                  )}
                </div>
              </div>

              <div
                className={`grid grid-cols-1 ${
                  productIngredients.length > 0 ? '' : 'sm:grid-cols-3'
                } gap-1.5`}
                id="sauces-container"
              >
                {!optionsLoaded ? (
                  <div className="col-span-full text-center py-2 text-xs text-stone-400 bg-white rounded-xl border border-dashed border-stone-200">
                    Soslar yükleniyor...
                  </div>
                ) : availableSauces.length === 0 ? (
                  <div className="col-span-full text-center py-2 text-xs text-stone-400 bg-white rounded-xl border border-dashed border-stone-200">
                    Şu an için seçilebilir sos bulunmuyor.
                  </div>
                ) : (
                  availableSauces.map((s) => {
                    const sKey = s.id || s.key || s.name;
                    const label = s.name || s.label;
                    const count = sauceCounts[sKey] || 0;
                    return (
                      <div
                        key={sKey}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl border transition-all ${
                          count > 0
                            ? 'bg-amber-50/60 border-amber-300'
                            : 'bg-white border-stone-200'
                        }`}
                      >
                        <span className="text-xs font-semibold text-stone-800 truncate pr-1" title={label}>
                          {label}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => dispatch(adjustSauceCount({ sauceKey: sKey, delta: -1 }))}
                            className="w-5 h-5 bg-stone-100 hover:bg-stone-200 rounded-md flex items-center justify-center text-xs font-bold text-stone-700 transition-colors cursor-pointer"
                          >
                            -
                          </button>
                          <span className="text-xs font-black text-stone-900 w-4 text-center">
                            {count}
                          </span>
                          <button
                            type="button"
                            onClick={() => dispatch(adjustSauceCount({ sauceKey: sKey, delta: 1 }))}
                            className="w-5 h-5 bg-stone-100 hover:bg-stone-200 rounded-md flex items-center justify-center text-xs font-bold text-stone-700 transition-colors cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* 3. Ekstra Malzemeler (Ücretli) */}
          <div className="bg-white border border-stone-200/90 shadow-2xs rounded-2xl p-3 sm:px-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-stone-800 uppercase flex items-center gap-1.5">
                <i className="fa-solid fa-cheese text-orange-500"></i>
                Ekstra Lezzetler
              </span>
              <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                İsteğe Bağlı &bull; Ek Ücretli
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5" id="extras-container">
              {!optionsLoaded ? (
                <div className="col-span-full text-center py-2 text-xs text-stone-400 bg-white rounded-xl border border-dashed border-stone-200">
                  Ekstralar yükleniyor...
                </div>
              ) : availableExtras.length === 0 ? (
                <div className="col-span-full text-center py-2 text-xs text-stone-400 bg-white rounded-xl border border-dashed border-stone-200">
                  Şu an için seçilebilir ekstra malzeme bulunmuyor.
                </div>
              ) : (
                availableExtras.map((extra) => {
                  const extraKey = extra.id || extra.name;
                  return (
                    <label
                      key={extraKey}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl border transition-all text-xs font-medium cursor-pointer ${
                        extra.checked
                          ? 'border-brand-500 bg-brand-50/60 text-brand-900 font-bold'
                          : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={!!extra.checked}
                          onChange={() => {
                            setExtras((prev) =>
                              prev.map((e) =>
                                (e.id && e.id === extra.id) || e.name === extra.name
                                  ? { ...e, checked: !e.checked }
                                  : e
                              )
                            );
                          }}
                          className="text-brand-600 rounded focus:ring-brand-500 shrink-0"
                        />
                        <span className="truncate">{extra.name}</span>
                      </div>
                      <span className="text-brand-600 font-black shrink-0 ml-1">+₺{extra.price}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* 4. Menü İçecek Seçimi & Sipariş Notu */}
          <div className={`grid grid-cols-1 ${isMenu ? 'sm:grid-cols-2' : ''} gap-3`}>
            {isMenu && (
              <div className="bg-white border border-stone-200/90 shadow-2xs rounded-2xl p-3 sm:px-4">
                <label className="block text-[11px] font-extrabold text-stone-800 uppercase mb-1.5 flex items-center justify-between gap-1.5">
                  <span className="flex items-center gap-1.5">
                    <i className="fa-solid fa-cup-straw text-brand-500"></i>
                    Menü İçeceği ({menuTier} Kişilik • Dahil)
                  </span>
                </label>
                {activeMenuDrinkItems.length <= 3 ? (
                  <div className="grid grid-cols-2 gap-1.5">
                    {activeMenuDrinkItems.map((dr) => {
                      const isSelected = selectedDrink === dr.name;
                      const drPrice = Math.max(0, Number(dr.price) || 0);
                      return (
                        <button
                          key={dr.id || dr.name}
                          type="button"
                          onClick={() => setSelectedDrink(dr.name)}
                          className={`px-2.5 py-2 rounded-xl border text-xs font-extrabold transition-all cursor-pointer flex items-center justify-between gap-1.5 ${
                            isSelected
                              ? 'bg-brand-500 border-brand-600 text-white shadow-xs'
                              : 'bg-white border-stone-200 text-stone-800 hover:border-brand-400'
                          }`}
                        >
                          <span className="flex items-center gap-1.5 min-w-0">
                            <i className={`fa-solid ${isSelected ? 'fa-circle-check' : 'fa-circle text-stone-300'} text-[11px] shrink-0`}></i>
                            <span className="truncate">{dr.name}</span>
                          </span>
                          <span
                            className={`text-[10px] font-black px-1.5 py-0.5 rounded-md shrink-0 ${
                              drPrice > 0
                                ? isSelected
                                  ? 'bg-white/25 text-white'
                                  : 'bg-amber-100 text-amber-800'
                                : isSelected
                                ? 'bg-white/20 text-white'
                                : 'bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            {drPrice > 0 ? `+₺${drPrice}` : 'Dahil'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <select
                    value={selectedDrink}
                    onChange={(e) => setSelectedDrink(e.target.value)}
                    className="app-select w-full bg-white border border-stone-200 hover:border-brand-400 rounded-xl px-3 py-1.5 text-xs text-stone-900 focus:outline-none focus:border-brand-500 font-bold cursor-pointer transition-all"
                  >
                    {activeMenuDrinkItems.map((dr) => {
                      const drPrice = Math.max(0, Number(dr.price) || 0);
                      return (
                        <option key={dr.id || dr.name} value={dr.name}>
                          {drPrice > 0 ? `${dr.name} (+₺${drPrice})` : `${dr.name} (Dahil)`}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>
            )}

            <div className="bg-white border border-stone-200/90 shadow-2xs rounded-2xl p-3 sm:px-4">
              <label className="block text-[11px] font-extrabold text-stone-800 uppercase mb-1.5 flex items-center gap-1.5">
                <i className="fa-solid fa-pen text-stone-400"></i>
                Sipariş Notu / Özel İstek
              </label>
              <input
                type="text"
                id="opt-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full bg-stone-50 focus:bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500 font-medium text-stone-800 transition-colors"
                placeholder="Örn: Ekmeği bol kızarmış olsun..."
              />
            </div>
          </div>

          {/* 5. Tekli Ürünler İçin İçecek Önerileri (3 Sütunlu Kompakt Izgara - Scroll Yok) */}
          {!isMenu && !isDrink && suggestedDrinks.length > 0 && (
            <div className="bg-sky-50/60 border border-sky-200/80 rounded-2xl p-2.5 sm:px-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[11px] font-extrabold text-stone-900 uppercase flex items-center gap-1.5">
                  <i className="fa-solid fa-bottle-water text-sky-600"></i>
                  Yanına Soğuk İçecek İster misiniz?
                </label>
                {selectedSuggestedDrinks.length > 0 ? (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-sky-600 text-white shrink-0">
                    {selectedSuggestedDrinks.length} Seçildi (+₺{suggestedDrinksCost.toFixed(0)})
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-sky-700 shrink-0">İsteğe Bağlı</span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5">
                {suggestedDrinks.map((drinkProd) => {
                  const isSelected = selectedSuggestedDrinkIds.includes(drinkProd.id);
                  return (
                    <button
                      key={drinkProd.id}
                      type="button"
                      onClick={() => handleToggleSuggestedDrink(drinkProd.id)}
                      className={`flex items-center justify-between gap-1.5 p-1.5 rounded-xl border text-left transition-all cursor-pointer active:scale-[0.98] ${
                        isSelected
                          ? 'bg-sky-100/90 border-sky-500 ring-1 ring-sky-400/40 shadow-2xs'
                          : 'bg-white border-stone-200/90 hover:border-sky-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg overflow-hidden bg-stone-100 border border-stone-200/70 shrink-0">
                          <img
                            src={drinkProd.image || '/images/hero_banner.jpg'}
                            alt={drinkProd.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src = '/images/hero_banner.jpg';
                            }}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-stone-800 truncate">
                          {drinkProd.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[11px] font-black text-sky-700">
                          +₺{Number(drinkProd.price || 0).toFixed(0)}
                        </span>
                        <span
                          className={`w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] transition-colors ${
                            isSelected
                              ? 'bg-sky-600 text-white'
                              : 'bg-stone-100 text-stone-400 border border-stone-200'
                          }`}
                        >
                          <i className={`fa-solid ${isSelected ? 'fa-check' : 'fa-plus'}`}></i>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
            </div>
          </div>

          {/* Sabit Alt Bar (Sepete Ekle Butonu) */}
          <div className="shrink-0 p-3 sm:px-5 sm:py-3.5 bg-white border-t border-stone-200/80 shadow-[0_-4px_16px_rgba(0,0,0,0.04)] z-10 flex items-center justify-between gap-3">
            <div className="hidden sm:flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                Toplam Tutar
              </span>
              <span className="text-lg font-black text-stone-900 leading-tight">
                ₺{currentTotalPrice.toFixed(2)}
              </span>
            </div>
            {selectedProductForOptions.isAvailable !== false ? (
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 bg-gradient-to-r from-brand-500 to-amber-500 hover:from-brand-600 hover:to-amber-600 text-white font-black py-3 sm:py-3.5 px-5 rounded-2xl shadow-lg shadow-brand-500/25 text-sm sm:text-base transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <i className="fa-solid fa-bag-shopping"></i>
                <span>Sepete Ekle &bull; ₺{currentTotalPrice.toFixed(2)}</span>
                <i className="fa-solid fa-arrow-right text-xs opacity-80 hidden sm:inline"></i>
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="flex-1 bg-stone-300 text-stone-600 font-bold py-3 sm:py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 cursor-not-allowed opacity-80"
              >
                <i className="fa-solid fa-ban text-rose-500"></i> Bu Ürün Tükendi
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
