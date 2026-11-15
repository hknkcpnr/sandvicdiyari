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
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-5 bg-stone-900/65 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Üst Büyük Ürün Görseli ve Başlık Alanı */}
        <div className="relative h-48 sm:h-60 w-full bg-stone-900 shrink-0 overflow-hidden">
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
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/35 to-black/10"></div>

          {/* Kapat Butonu */}
          <button
            type="button"
            onClick={() => dispatch(closeOptionsModal())}
            className="absolute top-3.5 right-3.5 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-stone-800 flex items-center justify-center shadow-md cursor-pointer transition-transform active:scale-95"
            title="Kapat"
          >
            <i className="fa-solid fa-xmark text-base"></i>
          </button>

          {selectedProductForOptions.badge && (
            <span className="absolute top-3.5 left-3.5 bg-brand-500 text-white text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">
              {selectedProductForOptions.badge}
            </span>
          )}

          {/* Görsel Üzeri Alt Bilgi: Ürün Adı & Fiyat */}
          <div className="absolute bottom-0 inset-x-0 p-4 sm:p-5 flex items-end justify-between gap-3 text-left">
            <div className="min-w-0">
              <h4
                id="opt-modal-title"
                className="font-extrabold text-lg sm:text-2xl text-white leading-tight drop-shadow-xs truncate"
              >
                {selectedProductForOptions.name}
              </h4>
              {(selectedProductForOptions.description || selectedProductForOptions.desc) && (
                <p className="text-stone-300 text-xs mt-1 line-clamp-1">
                  {selectedProductForOptions.description || selectedProductForOptions.desc}
                </p>
              )}
            </div>
            <div className="text-right shrink-0 bg-white/95 backdrop-blur-xs px-3.5 py-1.5 rounded-2xl shadow-sm">
              <span id="opt-modal-price" className="text-base sm:text-lg font-black text-brand-600 block leading-none">
                ₺{currentTotalPrice.toFixed(2)}
              </span>
              {(extrasCost > 0 || extraSauceCost > 0) && (
                <span className="text-[10px] font-semibold text-stone-400 block mt-0.5">
                  Baz: ₺{Number(selectedProductForOptions.price).toFixed(2)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Kaydırılabilir Düzenli Seçenekler Alanı */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto text-left flex-1">
          {/* 1. Ürün İçeriği (Çıkarılabilir Etiketler) */}
          {productIngredients.length > 0 && (
            <div className="bg-stone-50/80 border border-stone-200/80 rounded-2xl p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <span className="text-xs font-extrabold text-stone-800 uppercase flex items-center gap-1.5">
                  <i className="fa-solid fa-layer-group text-brand-500"></i>
                  Ürün İçeriği
                </span>
                <span className="text-[11px] font-medium text-stone-500">
                  İstemediğiniz malzemeye dokunup çıkarabilirsiniz
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {productIngredients.map((ing) => {
                  const isRemoved = removedIngredients.includes(ing);
                  return (
                    <button
                      key={ing}
                      type="button"
                      onClick={() => handleToggleIngredient(ing)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        isRemoved
                          ? 'bg-rose-50 border-rose-200 text-rose-600 line-through opacity-80 hover:opacity-100'
                          : 'bg-white border-stone-200 text-stone-800 hover:border-rose-300 hover:bg-rose-50/40 shadow-2xs'
                      }`}
                      title={isRemoved ? 'Tekrar eklemek için tıklayın' : 'Çıkarmak için tıklayın'}
                    >
                      <i
                        className={`fa-solid ${
                          isRemoved
                            ? 'fa-rotate-left text-[10px] text-rose-500'
                            : 'fa-check text-[10px] text-emerald-600'
                        }`}
                      ></i>
                      <span>{ing}</span>
                      {!isRemoved && (
                        <i className="fa-solid fa-xmark text-[10px] text-stone-400 ml-0.5"></i>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. Sos Seçimleri & Adetleri */}
          <div className="bg-stone-50/80 border border-stone-200/80 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <span className="text-xs font-extrabold text-stone-800 uppercase flex items-center gap-1.5">
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" id="sauces-container">
              {!optionsLoaded ? (
                <div className="col-span-full text-center py-3 text-xs text-stone-400 bg-white rounded-xl border border-dashed border-stone-200">
                  Soslar yükleniyor...
                </div>
              ) : availableSauces.length === 0 ? (
                <div className="col-span-full text-center py-3 text-xs text-stone-400 bg-white rounded-xl border border-dashed border-stone-200">
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
                      className={`flex items-center justify-between px-3 py-2 rounded-xl border transition-all ${
                        count > 0
                          ? 'bg-amber-50/60 border-amber-300'
                          : 'bg-white border-stone-200'
                      }`}
                    >
                      <span className="text-xs font-semibold text-stone-800 truncate pr-1.5" title={label}>
                        {label}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => dispatch(adjustSauceCount({ sauceKey: sKey, delta: -1 }))}
                          className="w-6 h-6 bg-stone-100 hover:bg-stone-200 rounded-lg flex items-center justify-center text-xs font-bold text-stone-700 transition-colors cursor-pointer"
                        >
                          -
                        </button>
                        <span className="text-xs font-black text-stone-900 w-4 text-center">
                          {count}
                        </span>
                        <button
                          type="button"
                          onClick={() => dispatch(adjustSauceCount({ sauceKey: sKey, delta: 1 }))}
                          className="w-6 h-6 bg-stone-100 hover:bg-stone-200 rounded-lg flex items-center justify-center text-xs font-bold text-stone-700 transition-colors cursor-pointer"
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
          <div className="bg-stone-50/80 border border-stone-200/80 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-stone-800 uppercase flex items-center gap-1.5">
                <i className="fa-solid fa-cheese text-orange-500"></i>
                Ekstra Lezzetler
              </span>
              <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                İsteğe Bağlı &bull; Ek Ücretli
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" id="extras-container">
              {!optionsLoaded ? (
                <div className="col-span-full text-center py-3 text-xs text-stone-400 bg-white rounded-xl border border-dashed border-stone-200">
                  Ekstralar yükleniyor...
                </div>
              ) : availableExtras.length === 0 ? (
                <div className="col-span-full text-center py-3 text-xs text-stone-400 bg-white rounded-xl border border-dashed border-stone-200">
                  Şu an için seçilebilir ekstra malzeme bulunmuyor.
                </div>
              ) : (
                availableExtras.map((extra) => {
                  const extraKey = extra.id || extra.name;
                  return (
                    <label
                      key={extraKey}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-xs font-medium cursor-pointer ${
                        extra.checked
                          ? 'border-brand-500 bg-brand-50/60 text-brand-900 font-bold'
                          : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
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
              <div className="bg-stone-50/80 border border-stone-200/80 rounded-2xl p-3.5">
                <label className="block text-xs font-extrabold text-stone-800 uppercase mb-1.5 flex items-center gap-1.5">
                  <i className="fa-solid fa-cup-straw text-brand-500"></i>
                  Menü İçeceği (Dahil)
                </label>
                <select
                  value={selectedDrink}
                  onChange={(e) => setSelectedDrink(e.target.value)}
                  className="app-select w-full bg-white border border-stone-200 hover:border-brand-400 rounded-xl px-3.5 py-2.5 text-xs text-stone-900 focus:outline-none focus:border-brand-500 font-bold cursor-pointer transition-all"
                >
                  {drinkOptions.map((dr) => (
                    <option key={dr} value={dr}>
                      {dr}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="bg-stone-50/80 border border-stone-200/80 rounded-2xl p-3.5">
              <label className="block text-xs font-extrabold text-stone-800 uppercase mb-1.5 flex items-center gap-1.5">
                <i className="fa-solid fa-pen text-stone-400"></i>
                Sipariş Notu / Özel İstek
              </label>
              <input
                type="text"
                id="opt-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full bg-white border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-brand-500 font-medium text-stone-800"
                placeholder="Örn: Ekmeği bol kızarmış olsun..."
              />
            </div>
          </div>
        </div>

        {/* Alt Sabit Sepete Ekle Butonu */}
        <div className="p-4 sm:px-6 bg-white border-t border-stone-100 shrink-0">
          {selectedProductForOptions.isAvailable !== false ? (
            <button
              type="button"
              onClick={handleConfirm}
              className="w-full bg-brand-500 hover:bg-brand-600 text-white font-black py-3.5 rounded-2xl shadow-lg shadow-brand-500/25 text-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <i className="fa-solid fa-bag-shopping"></i>
              <span>Sepete Ekle &bull; ₺{currentTotalPrice.toFixed(2)}</span>
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="w-full bg-stone-300 text-stone-600 font-bold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 cursor-not-allowed opacity-80"
            >
              <i className="fa-solid fa-ban text-rose-500"></i> Bu Ürün Tükendi
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
