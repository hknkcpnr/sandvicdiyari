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
import { DEFAULT_PRODUCT_OPTIONS } from '@/lib/productOptionsDefaults';

function extractProductIngredients(product) {
  if (!product) return [];
  if (Array.isArray(product.ingredients) && product.ingredients.length > 0) {
    return product.ingredients.map((s) => String(s).trim()).filter(Boolean);
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

  const [selectedDrink, setSelectedDrink] = useState('Kutu Pepsi (330ml)');
  const [saucesList, setSaucesList] = useState([]);
  const [freeSauceLimit, setFreeSauceLimit] = useState(DEFAULT_PRODUCT_OPTIONS.freeSauceLimit ?? 2);
  const [extraSaucePrice, setExtraSaucePrice] = useState(DEFAULT_PRODUCT_OPTIONS.extraSaucePrice ?? 5);
  const [extras, setExtras] = useState([]);
  const [drinkOptions, setDrinkOptions] = useState(
    DEFAULT_PRODUCT_OPTIONS.drinks.map((d) => (typeof d === 'string' ? d : d.name))
  );
  const [optionsLoaded, setOptionsLoaded] = useState(false);
  const [note, setNote] = useState('');
  const [removedIngredients, setRemovedIngredients] = useState([]);

  useEffect(() => {
    if (isOptionsModalOpen) {
      setRemovedIngredients([]);
    }
  }, [isOptionsModalOpen, selectedProductForOptions?.id]);

  // Fetch dynamic options from backend API on mount and when modal opens
  useEffect(() => {
    let isMounted = true;
    async function fetchDynamicOptions() {
      try {
        const res = await fetch('/api/options', { cache: 'no-store' });
        const json = await res.json();
        if (isMounted && json && json.success && json.data) {
          if (typeof json.data.freeSauceLimit === 'number') {
            setFreeSauceLimit(json.data.freeSauceLimit);
          }
          if (typeof json.data.extraSaucePrice === 'number') {
            setExtraSaucePrice(json.data.extraSaucePrice);
          }
          if (Array.isArray(json.data.sauces)) {
            setSaucesList(json.data.sauces);
          }
          if (Array.isArray(json.data.extras)) {
            setExtras((prev) => {
              const prevCheckedMap = {};
              (prev || []).forEach((p) => {
                if (p.checked) prevCheckedMap[p.id || p.name] = true;
              });
              return json.data.extras.map((e) => ({
                ...e,
                checked: !!prevCheckedMap[e.id || e.name],
              }));
            });
          }
          if (Array.isArray(json.data.drinks)) {
            setDrinkOptions(
              json.data.drinks
                .filter((d) => (typeof d === 'object' ? d.isAvailable !== false : true))
                .map((d) => (typeof d === 'string' ? d : d.name))
            );
          }
          setOptionsLoaded(true);
        }
      } catch (err) {
        console.warn('Options API fetch fallback:', err);
        if (isMounted && !optionsLoaded) {
          setSaucesList(DEFAULT_PRODUCT_OPTIONS.sauces);
          setExtras(DEFAULT_PRODUCT_OPTIONS.extras.map((e) => ({ ...e, checked: false })));
          setOptionsLoaded(true);
        }
      }
    }

    fetchDynamicOptions();

    return () => {
      isMounted = false;
    };
  }, [isOptionsModalOpen]);

  if (!isOptionsModalOpen || !selectedProductForOptions) return null;

  const isMenu = selectedProductForOptions.category === 'menu';

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
    Number(selectedProductForOptions.price || 0) + extrasCost + extraSauceCost;

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
        note,
        removedIngredients,
      })
    );
    dispatch(closeOptionsModal());
    dispatch(
      showMessageModal({
        title: 'Sepete Eklendi! 🥪',
        text: `${selectedProductForOptions.name} sepetinize eklendi!`,
        type: 'success',
      })
    );
    // Reset form state
    setNote('');
    setRemovedIngredients([]);
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
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-stone-900/65 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-3xl max-w-[680px] w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Üst Ürün Özeti: Solda Büyük Görsel, Sağda Başlık & Fiyat */}
        <div className="flex items-center gap-3.5 sm:gap-4 p-3.5 sm:px-5 sm:py-4 bg-gradient-to-br from-stone-50/90 to-white border-b border-stone-200/70 text-left">
          <div className="relative w-24 h-24 sm:w-36 sm:h-28 rounded-2xl overflow-hidden bg-stone-100 border border-stone-200/80 shadow-xs shrink-0">
            <img
              id="opt-modal-img"
              src={selectedProductForOptions.image}
              alt={selectedProductForOptions.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.src =
                  'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=800';
              }}
            />
          </div>

          <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch py-0.5">
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {selectedProductForOptions.badge && (
                    <span className="inline-block bg-brand-50 text-brand-600 border border-brand-200/70 text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md mb-1">
                      {selectedProductForOptions.badge}
                    </span>
                  )}
                  <h4
                    id="opt-modal-title"
                    className="font-extrabold text-base sm:text-xl text-stone-900 leading-snug truncate"
                  >
                    {selectedProductForOptions.name}
                  </h4>
                </div>

                {/* Kapat Butonu */}
                <button
                  type="button"
                  onClick={() => dispatch(closeOptionsModal())}
                  className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 hover:text-stone-800 flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                  title="Kapat"
                >
                  <i className="fa-solid fa-xmark text-sm"></i>
                </button>
              </div>

              {(selectedProductForOptions.description || selectedProductForOptions.desc) && (
                <p className="text-stone-500 text-xs mt-1 line-clamp-2 leading-relaxed">
                  {selectedProductForOptions.description || selectedProductForOptions.desc}
                </p>
              )}
            </div>

            <div className="flex items-baseline gap-2 mt-2">
              <span
                id="opt-modal-price"
                className="text-base sm:text-lg font-black text-brand-600 leading-none"
              >
                ₺{currentTotalPrice.toFixed(2)}
              </span>
              {(extrasCost > 0 || extraSauceCost > 0) && (
                <span className="text-[11px] font-semibold text-stone-400">
                  (Baz fiyat: ₺{Number(selectedProductForOptions.price).toFixed(2)})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tek Ekrana Sığan Düzenli Seçenekler Alanı (Scrollsuz) */}
        <div className="p-3.5 sm:p-4 space-y-2.5 text-left">
          {/* 1. Ürün İçeriği (Çıkarılabilir Etiketler) */}
          {productIngredients.length > 0 && (
            <div className="bg-stone-50/80 border border-stone-200/80 rounded-2xl p-2.5 sm:px-3.5 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="text-[11px] font-extrabold text-stone-800 uppercase flex items-center gap-1.5">
                  <i className="fa-solid fa-layer-group text-brand-500"></i>
                  Ürün İçeriği
                </span>
                <span className="text-[10px] font-medium text-stone-400">
                  Çıkarmak istediğiniz malzemeye dokunun
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
          )}

          {/* 2. Sos Seçimleri & Adetleri */}
          <div className="bg-stone-50/80 border border-stone-200/80 rounded-2xl p-2.5 sm:px-3.5 space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="text-[11px] font-extrabold text-stone-800 uppercase flex items-center gap-1.5">
                <i className="fa-solid fa-bottle-droplet text-amber-500"></i>
                Sos Seçimleri
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  {freeSauceLimit > 0 ? `İlk ${freeSauceLimit} Adet Ücretsiz` : 'Tümü Ücretli'}
                </span>
                {extraSaucePrice > 0 && paidSauceCount > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                    +{paidSauceCount} Ekstra (+₺{extraSauceCost.toFixed(2)})
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5" id="sauces-container">
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

          {/* 3. Ekstra Malzemeler (Ücretli) */}
          <div className="bg-stone-50/80 border border-stone-200/80 rounded-2xl p-2.5 sm:px-3.5 space-y-1.5">
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
          <div className={`grid grid-cols-1 ${isMenu ? 'sm:grid-cols-2' : ''} gap-2`}>
            {isMenu && (
              <div className="bg-stone-50/80 border border-stone-200/80 rounded-2xl p-2.5 sm:px-3.5">
                <label className="block text-[11px] font-extrabold text-stone-800 uppercase mb-1 flex items-center gap-1.5">
                  <i className="fa-solid fa-cup-straw text-brand-500"></i>
                  Menü İçeceği (Dahil)
                </label>
                <select
                  value={selectedDrink}
                  onChange={(e) => setSelectedDrink(e.target.value)}
                  className="app-select w-full bg-white border border-stone-200 hover:border-brand-400 rounded-xl px-3 py-1.5 text-xs text-stone-900 focus:outline-none focus:border-brand-500 font-bold cursor-pointer transition-all"
                >
                  {drinkOptions.map((dr) => (
                    <option key={dr} value={dr}>
                      {dr}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="bg-stone-50/80 border border-stone-200/80 rounded-2xl p-2.5 sm:px-3.5">
              <label className="block text-[11px] font-extrabold text-stone-800 uppercase mb-1 flex items-center gap-1.5">
                <i className="fa-solid fa-pen text-stone-400"></i>
                Sipariş Notu / Özel İstek
              </label>
              <input
                type="text"
                id="opt-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full bg-white border border-stone-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-brand-500 font-medium text-stone-800"
                placeholder="Örn: Ekmeği bol kızarmış olsun..."
              />
            </div>
          </div>

          {/* Alt Sepete Ekle Butonu */}
          <div className="pt-1">
            {selectedProductForOptions.isAvailable !== false ? (
              <button
                type="button"
                onClick={handleConfirm}
                className="w-full bg-brand-500 hover:bg-brand-600 text-white font-black py-3 rounded-2xl shadow-lg shadow-brand-500/25 text-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <i className="fa-solid fa-bag-shopping"></i>
                <span>Sepete Ekle &bull; ₺{currentTotalPrice.toFixed(2)}</span>
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="w-full bg-stone-300 text-stone-600 font-bold py-3 rounded-2xl text-sm flex items-center justify-center gap-2 cursor-not-allowed opacity-80"
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
