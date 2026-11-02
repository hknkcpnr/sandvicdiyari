'use client';

import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  closeOptionsModal,
  openAuthModal,
  adjustSauceCount,
  showMessageModal
} from '@/store/slices/uiSlice';
import { addToCart } from '@/store/slices/cartSlice';

export default function OptionsModal() {
  const dispatch = useDispatch();
  const { isOptionsModalOpen, selectedProductForOptions, sauceCounts } = useSelector(
    (state) => state.ui
  );
  const { currentUser } = useSelector((state) => state.auth);

  const [selectedDrink, setSelectedDrink] = useState('Kutu Pepsi (330ml)');
  const [extras, setExtras] = useState([
    { name: 'Ekstra Kaşar Peyniri', price: 20, checked: false },
    { name: 'Ekstra Cheddar Peyniri', price: 25, checked: false },
    { name: 'Ekstra Köfte / Kasap Köfte', price: 40, checked: false },
    { name: 'Jalapeno Acı Biber', price: 15, checked: false },
    { name: 'Karamelize Soğan', price: 15, checked: false },
    { name: 'Ekstra Çıtır Patates', price: 50, checked: false },
  ]);
  const [note, setNote] = useState('');

  if (!isOptionsModalOpen || !selectedProductForOptions) return null;

  const isMenu = selectedProductForOptions.category === 'menu';

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
    const selectedExtras = extras.filter((e) => e.checked);
    dispatch(
      addToCart({
        product: selectedProductForOptions,
        sauces: sauceCounts,
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
    // Reset state
    setNote('');
    setSelectedDrink('Kutu Pepsi (330ml)');
    setExtras([
      { name: 'Ekstra Kaşar Peyniri', price: 20, checked: false },
      { name: 'Ekstra Cheddar Peyniri', price: 25, checked: false },
      { name: 'Ekstra Köfte / Kasap Köfte', price: 40, checked: false },
      { name: 'Jalapeno Acı Biber', price: 15, checked: false },
      { name: 'Karamelize Soğan', price: 15, checked: false },
      { name: 'Ekstra Çıtır Patates', price: 50, checked: false },
    ]);
  };

  const saucesList = [
    { key: 'ketcap', label: 'Ketçap' },
    { key: 'mayonez', label: 'Mayonez' },
    { key: 'sarimsakli', label: 'Sarımsaklı Mayonez' },
    { key: 'acisos', label: 'Özel Acı Sos' },
    { key: 'barbeku', label: 'Barbekü Sos' },
    { key: 'hardal', label: 'Ballı Hardal' },
  ];

  const drinkOptions = [
    'Kutu Pepsi (330ml)',
    'Kutu Pepsi Max (Şekersiz)',
    'Büyük Ayran (300ml)',
    'Küçük Ayran (200ml)',
    'Yedigün Portakal',
    '7Up Gazoz',
    'Şalgam Suyu',
    'Doğal Su'
  ];

  return (
    <div
      id="options-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-9 shadow-2xl relative space-y-5">
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
              <span id="opt-modal-price" className="text-base font-black text-brand-600">
                ₺{Number(selectedProductForOptions.price).toFixed(2)}
              </span>
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
          {/* Sos Seçimleri & Adetleri (Ücretsiz) */}
          <div>
            <label className="block text-xs font-bold text-stone-800 uppercase mb-2 flex items-center justify-between">
              <span>Sos Seçimleri & Adetleri</span>
              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                Ücretsiz
              </span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5" id="sauces-container">
              {saucesList.map((s) => (
                <div
                  key={s.key}
                  className="flex items-center justify-between p-2.5 rounded-2xl border border-stone-200 bg-stone-50/80"
                >
                  <span className="text-xs font-semibold text-stone-700 truncate pr-1">
                    {s.label}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => dispatch(adjustSauceCount({ sauceKey: s.key, delta: -1 }))}
                      className="w-6 h-6 bg-white border border-stone-200 rounded-lg flex items-center justify-center text-xs font-bold text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
                    >
                      -
                    </button>
                    <span className="text-xs font-black text-stone-900 w-4 text-center">
                      {sauceCounts[s.key] || 0}
                    </span>
                    <button
                      type="button"
                      onClick={() => dispatch(adjustSauceCount({ sauceKey: s.key, delta: 1 }))}
                      className="w-6 h-6 bg-white border border-stone-200 rounded-lg flex items-center justify-center text-xs font-bold text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
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
              {extras.map((extra, index) => (
                <label
                  key={extra.name}
                  className={`flex items-center justify-between p-3 rounded-2xl border transition-all text-xs font-medium cursor-pointer ${
                    extra.checked
                      ? 'border-brand-500 bg-brand-50/60 text-brand-900 font-bold'
                      : 'border-stone-200 bg-stone-50 text-stone-700 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <input
                      type="checkbox"
                      checked={extra.checked}
                      onChange={() => handleToggleExtra(index)}
                      className="text-brand-600 rounded focus:ring-brand-500 shrink-0"
                    />
                    <span className="truncate">{extra.name}</span>
                  </div>
                  <span className="text-brand-600 font-black shrink-0 ml-1">+₺{extra.price}</span>
                </label>
              ))}
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
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-brand-500 font-semibold cursor-pointer"
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
              <i className="fa-solid fa-bag-shopping"></i> Sepete Ekle
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
