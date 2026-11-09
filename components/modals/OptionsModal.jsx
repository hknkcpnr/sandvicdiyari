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

export default function OptionsModal() {
  const dispatch = useDispatch();
  const { isOptionsModalOpen, selectedProductForOptions, sauceCounts } = useSelector(
    (state) => state.ui
  );
  const { currentUser } = useSelector((state) => state.auth);

  const [selectedDrink, setSelectedDrink] = useState('Kutu Pepsi (330ml)');
  const [saucesList, setSaucesList] = useState(DEFAULT_PRODUCT_OPTIONS.sauces);
  const [freeSauceLimit, setFreeSauceLimit] = useState(DEFAULT_PRODUCT_OPTIONS.freeSauceLimit ?? 2);
  const [extraSaucePrice, setExtraSaucePrice] = useState(DEFAULT_PRODUCT_OPTIONS.extraSaucePrice ?? 5);
  const [extras, setExtras] = useState(
    DEFAULT_PRODUCT_OPTIONS.extras.map((e) => ({ ...e, checked: false }))
  );
  const [drinkOptions, setDrinkOptions] = useState(
    DEFAULT_PRODUCT_OPTIONS.drinks.map((d) => (typeof d === 'string' ? d : d.name))
  );
  const [note, setNote] = useState('');

  // Fetch dynamic options from backend API
  useEffect(() => {
    let isMounted = true;
    async function fetchDynamicOptions() {
      try {
        const res = await fetch('/api/options');
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
        }
      } catch (err) {
        console.warn('Options API fetch fallback:', err);
      }
    }

    if (isOptionsModalOpen) {
      fetchDynamicOptions();
    }

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

  const handleConfirm = () => {
    if (!currentUser || !currentUser.email) {
      dispatch(closeOptionsModal());
      dispatch(openAuthModal('login'));
      return;
    }
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
    if (drinkOptions.length > 0) {
      setSelectedDrink(drinkOptions[0]);
    }
    setExtras((prev) => prev.map((e) => ({ ...e, checked: false })));
  };

  return (
    <div
      id="options-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto"
    >
      <div className="bg-white rounded-3xl max-w-3xl w-full p-5 sm:p-9 shadow-2xl relative space-y-5 my-auto max-h-[92vh] overflow-y-auto">
        {/* Banner: Ekstra Ürünler İçin Ek Ücret Alınır */}
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-2 rounded-2xl text-xs font-black flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <i className="fa-solid fa-circle-exclamation text-rose-600"></i>
            Ekstra Ürünler İçin Ek Ücret Alınır
          </span>
          <span className="text-[10px] bg-rose-200 text-rose-900 px-2.5 py-0.5 rounded-md font-bold uppercase tracking-wider">
            Sandviç Diyarı
          </span>
        </div>

        {/* Ürün Başlığı & Fiyatı */}
        <div className="flex justify-between items-center border-b border-stone-100 pb-4">
          <div className="flex items-center gap-3.5">
            <img
              id="opt-modal-img"
              src={selectedProductForOptions.image}
              alt={selectedProductForOptions.name}
              className="w-16 h-16 rounded-2xl object-cover bg-stone-100 border border-stone-200 shrink-0"
              onError={(e) => {
                e.currentTarget.src =
                  'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=200';
              }}
            />
            <div>
              <h4 id="opt-modal-title" className="font-extrabold text-lg text-stone-900 leading-snug">
                {selectedProductForOptions.name}
              </h4>
              <div className="flex items-baseline gap-2">
                <span id="opt-modal-price" className="text-base font-black text-brand-600">
                  ₺{currentTotalPrice.toFixed(2)}
                </span>
                {(extrasCost > 0 || extraSauceCost > 0) && (
                  <span className="text-[11px] font-semibold text-stone-400">
                    (Baz: ₺{Number(selectedProductForOptions.price).toFixed(2)})
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => dispatch(closeOptionsModal())}
            className="text-stone-400 hover:text-stone-600 p-2 rounded-xl hover:bg-stone-100 cursor-pointer transition-colors"
          >
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        <div className="space-y-5 text-left">
          {/* Sos Seçimleri & Adetleri (Ücretsiz Sınırı) */}
          <div>
            <label className="block text-xs font-bold text-stone-800 uppercase mb-2 flex flex-wrap items-center justify-between gap-1.5">
              <span className="flex items-center gap-1.5">
                <i className="fa-solid fa-bottle-droplet text-amber-500"></i>
                Sos Seçimleri &amp; Adetleri
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  {freeSauceLimit > 0 ? `İlk ${freeSauceLimit} Adet Ücretsiz` : 'Tümü Ücretli'}
                </span>
                {extraSaucePrice > 0 && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition-all ${
                      paidSauceCount > 0
                        ? 'bg-amber-100 text-amber-900 border-amber-300 font-black'
                        : 'bg-stone-50 text-stone-600 border-stone-200'
                    }`}
                  >
                    {paidSauceCount > 0
                      ? `+${paidSauceCount} Adet Ekstra (+₺${extraSauceCost.toFixed(2)})`
                      : `Sonrası +₺${extraSaucePrice} / Adet`}
                  </span>
                )}
              </div>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5" id="sauces-container">
              {availableSauces.length === 0 ? (
                <div className="col-span-full text-center py-3 text-xs text-stone-400 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                  Şu an için seçilebilir sos bulunmuyor.
                </div>
              ) : (
                availableSauces.map((s) => {
                  const sKey = s.id || s.key || s.name;
                  const label = s.name || s.label;
                  return (
                    <div
                      key={sKey}
                      className="flex items-center justify-between p-2.5 rounded-2xl border border-stone-200 bg-stone-50/80"
                    >
                      <span className="text-xs font-semibold text-stone-700 truncate pr-1" title={label}>
                        {label}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => dispatch(adjustSauceCount({ sauceKey: sKey, delta: -1 }))}
                          className="w-6 h-6 bg-white border border-stone-200 rounded-lg flex items-center justify-center text-xs font-bold text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
                        >
                          -
                        </button>
                        <span className="text-xs font-black text-stone-900 w-4 text-center">
                          {sauceCounts[sKey] || 0}
                        </span>
                        <button
                          type="button"
                          onClick={() => dispatch(adjustSauceCount({ sauceKey: sKey, delta: 1 }))}
                          className="w-6 h-6 bg-white border border-stone-200 rounded-lg flex items-center justify-center text-xs font-bold text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
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

          {/* Ekstra Malzemeler (Ücretli) */}
          <div>
            <label className="block text-xs font-bold text-stone-800 uppercase mb-2 flex items-center justify-between">
              <span>Ekstra Lezzetler</span>
              <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-md border border-rose-200">
                Ek Ücretli
              </span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5" id="extras-container">
              {availableExtras.length === 0 ? (
                <div className="col-span-full text-center py-3 text-xs text-stone-400 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                  Şu an için seçilebilir ekstra malzeme bulunmuyor.
                </div>
              ) : (
                availableExtras.map((extra) => {
                  const extraKey = extra.id || extra.name;
                  return (
                    <label
                      key={extraKey}
                      className={`flex items-center justify-between p-3 rounded-2xl border transition-all text-xs font-medium cursor-pointer ${
                        extra.checked
                          ? 'border-brand-500 bg-brand-50/60 text-brand-900 font-bold'
                          : 'border-stone-200 bg-stone-50 text-stone-700 hover:border-stone-300'
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

          {/* Menü İçecek Seçimi & Sipariş Notu Yan Yana */}
          <div className={`grid grid-cols-1 ${isMenu ? 'sm:grid-cols-2' : ''} gap-4`}>
            {isMenu && (
              <div>
                <label className="block text-xs font-bold text-stone-800 uppercase mb-1.5 flex items-center gap-1.5">
                  <i className="fa-solid fa-cup-straw text-brand-500"></i>
                  Menü İçeceği Seçiniz (Dahildir)
                </label>
                <select
                  value={selectedDrink}
                  onChange={(e) => setSelectedDrink(e.target.value)}
                  className="app-select w-full bg-stone-50 hover:bg-white border border-stone-200 hover:border-brand-400 rounded-2xl px-4 py-3 text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-brand-500 font-bold cursor-pointer shadow-2xs transition-all"
                >
                  {drinkOptions.map((dr) => (
                    <option key={dr} value={dr}>
                      {dr}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-stone-800 uppercase mb-1.5">
                Sipariş Notu / Özel İstek
              </label>
              <input
                type="text"
                id="opt-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-xs sm:text-sm focus:outline-none focus:border-brand-500 font-medium text-stone-800"
                placeholder="Örn: Turşusuz olsun, ketçap az olsun..."
              />
            </div>
          </div>
        </div>

        <div className="pt-2">
          {selectedProductForOptions.isAvailable !== false ? (
            <button
              type="button"
              onClick={handleConfirm}
              className="w-full bg-brand-500 hover:bg-brand-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-brand-500/25 text-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <i className="fa-solid fa-bag-shopping"></i>
              <span>Sepete Ekle &bull; ₺{currentTotalPrice.toFixed(2)}</span>
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="w-full bg-stone-300 text-stone-600 font-bold py-4 rounded-2xl text-sm flex items-center justify-center gap-2 cursor-not-allowed opacity-80"
            >
              <i className="fa-solid fa-ban text-rose-500"></i> Bu Ürün Tükendi
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
