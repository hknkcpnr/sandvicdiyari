'use client';

import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { showMessageModal } from '@/store/slices/uiSlice';
import { DEFAULT_PRODUCT_OPTIONS } from '@/lib/productOptionsDefaults';

export default function OptionsManagementTab() {
  const dispatch = useDispatch();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('sauces'); // 'sauces' | 'extras' | 'drinks'
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive'

  // Data state
  const [sauces, setSauces] = useState(DEFAULT_PRODUCT_OPTIONS.sauces);
  const [freeSauceLimit, setFreeSauceLimit] = useState(DEFAULT_PRODUCT_OPTIONS.freeSauceLimit ?? 2);
  const [extraSaucePrice, setExtraSaucePrice] = useState(DEFAULT_PRODUCT_OPTIONS.extraSaucePrice ?? 5);
  const [extras, setExtras] = useState(DEFAULT_PRODUCT_OPTIONS.extras);
  const [drinks, setDrinks] = useState(DEFAULT_PRODUCT_OPTIONS.drinks);

  // Modal states
  const [isAddSauceModalOpen, setIsAddSauceModalOpen] = useState(false);
  const [editingSauce, setEditingSauce] = useState(null);
  const [sauceForm, setSauceForm] = useState({ name: '', isAvailable: true, price: 0 });

  const [isAddExtraModalOpen, setIsAddExtraModalOpen] = useState(false);
  const [editingExtra, setEditingExtra] = useState(null);
  const [extraForm, setExtraForm] = useState({ name: '', price: 20, isAvailable: true });

  // Fetch current options from server
  const fetchOptions = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/options');
      const json = await res.json();
      if (json.success && json.data) {
        if (typeof json.data.freeSauceLimit === 'number') setFreeSauceLimit(json.data.freeSauceLimit);
        if (typeof json.data.extraSaucePrice === 'number') setExtraSaucePrice(json.data.extraSaucePrice);
        if (Array.isArray(json.data.sauces)) setSauces(json.data.sauces);
        if (Array.isArray(json.data.extras)) setExtras(json.data.extras);
        if (Array.isArray(json.data.drinks)) setDrinks(json.data.drinks);
      }
    } catch (err) {
      console.error('Seçenekler yüklenemedi:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOptions();
  }, []);

  // Save all options to server
  const persistOptions = async (updatedSauces, updatedExtras, updatedDrinks, limitOverride, priceOverride) => {
    const payload = {
      freeSauceLimit: typeof limitOverride === 'number' ? limitOverride : freeSauceLimit,
      extraSaucePrice: typeof priceOverride === 'number' ? priceOverride : extraSaucePrice,
      sauces: updatedSauces || sauces,
      extras: updatedExtras || extras,
      drinks: updatedDrinks || drinks,
    };
    try {
      setSaving(true);
      const res = await fetch('/api/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Kaydedilemedi');
      }
      return true;
    } catch (err) {
      console.error('Kaydetme hatası:', err);
      dispatch(
        showMessageModal({
          title: 'Hata',
          text: err.message || 'Seçenekler kaydedilirken bir hata oluştu.',
          type: 'error',
        })
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Save free sauce quota policy
  const handleSaveSaucePolicy = async (limitVal, priceVal) => {
    const targetLimit = typeof limitVal === 'number' ? limitVal : freeSauceLimit;
    const targetPrice = typeof priceVal === 'number' ? priceVal : extraSaucePrice;

    if (typeof limitVal === 'number') setFreeSauceLimit(limitVal);
    if (typeof priceVal === 'number') setExtraSaucePrice(priceVal);

    const ok = await persistOptions(sauces, extras, drinks, targetLimit, targetPrice);
    if (ok) {
      dispatch(
        showMessageModal({
          title: 'Sos Politikası Kaydedildi! 🥫',
          text: targetLimit > 0
            ? `İlk ${targetLimit} adet sos ücretsiz sunulacak. Kotayı aşan her sos için +₺${Number(targetPrice).toFixed(2)} eklenecektir.`
            : `Tüm soslar adet başına +₺${Number(targetPrice).toFixed(2)} olarak ücretlendirilecek.`,
          type: 'success',
        })
      );
    }
  };

  // Quick toggle sauce availability
  const handleToggleSauce = async (sauceId) => {
    const updated = sauces.map((s) =>
      s.id === sauceId ? { ...s, isAvailable: !s.isAvailable } : s
    );
    setSauces(updated);
    const ok = await persistOptions(updated, extras, drinks);
    if (ok) {
      const item = updated.find((s) => s.id === sauceId);
      dispatch(
        showMessageModal({
          title: item.isAvailable ? 'Sos Satışa Açıldı' : 'Sos Kapatıldı',
          text: `"${item.name}" ${item.isAvailable ? 'artık müşterilere gösteriliyor.' : 'geçici olarak kapatıldı.'}`,
          type: item.isAvailable ? 'success' : 'warning',
        })
      );
    }
  };

  // Quick toggle extra availability
  const handleToggleExtra = async (extraId) => {
    const updated = extras.map((e) =>
      e.id === extraId ? { ...e, isAvailable: !e.isAvailable } : e
    );
    setExtras(updated);
    const ok = await persistOptions(sauces, updated, drinks);
    if (ok) {
      const item = updated.find((e) => e.id === extraId);
      dispatch(
        showMessageModal({
          title: item.isAvailable ? 'Ekstra Satışa Açıldı' : 'Ekstra Kapatıldı',
          text: `"${item.name}" ${item.isAvailable ? 'müşterilerin seçimine açıldı.' : 'seçimlerden kaldırıldı.'}`,
          type: item.isAvailable ? 'success' : 'warning',
        })
      );
    }
  };

  // Save new or edited sauce
  const handleSaveSauce = async (e) => {
    e.preventDefault();
    const cleanName = sauceForm.name.trim();
    if (!cleanName) return;

    let updated;
    if (editingSauce) {
      updated = sauces.map((s) =>
        s.id === editingSauce.id
          ? { ...s, name: cleanName, isAvailable: sauceForm.isAvailable }
          : s
      );
    } else {
      const newSauce = {
        id: `sauce-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: cleanName,
        isAvailable: sauceForm.isAvailable,
        price: 0,
      };
      updated = [...sauces, newSauce];
    }

    setSauces(updated);
    setIsAddSauceModalOpen(false);
    setEditingSauce(null);
    setSauceForm({ name: '', isAvailable: true, price: 0 });

    const ok = await persistOptions(updated, extras, drinks);
    if (ok) {
      dispatch(
        showMessageModal({
          title: editingSauce ? 'Sos Güncellendi' : 'Yeni Sos Eklendi! 🥫',
          text: `"${cleanName}" başarıyla kaydedildi.`,
          type: 'success',
        })
      );
    }
  };

  // Delete sauce
  const handleDeleteSauce = async (sauce) => {
    if (!confirm(`"${sauce.name}" sosunu silmek istediğinizden emin misiniz?`)) return;
    const updated = sauces.filter((s) => s.id !== sauce.id);
    setSauces(updated);
    const ok = await persistOptions(updated, extras, drinks);
    if (ok) {
      dispatch(
        showMessageModal({
          title: 'Sos Silindi',
          text: `"${sauce.name}" menüden silindi.`,
          type: 'success',
        })
      );
    }
  };

  // Save new or edited extra
  const handleSaveExtra = async (e) => {
    e.preventDefault();
    const cleanName = extraForm.name.trim();
    const cleanPrice = Math.max(0, Number(extraForm.price) || 0);
    if (!cleanName) return;

    let updated;
    if (editingExtra) {
      updated = extras.map((item) =>
        item.id === editingExtra.id
          ? { ...item, name: cleanName, price: cleanPrice, isAvailable: extraForm.isAvailable }
          : item
      );
    } else {
      const newExtra = {
        id: `extra-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: cleanName,
        price: cleanPrice,
        isAvailable: extraForm.isAvailable,
      };
      updated = [...extras, newExtra];
    }

    setExtras(updated);
    setIsAddExtraModalOpen(false);
    setEditingExtra(null);
    setExtraForm({ name: '', price: 20, isAvailable: true });

    const ok = await persistOptions(sauces, updated, drinks);
    if (ok) {
      dispatch(
        showMessageModal({
          title: editingExtra ? 'Ekstra Güncellendi' : 'Yeni Ekstra Eklendi! ✨',
          text: `"${cleanName}" (₺${cleanPrice.toFixed(2)}) menüye eklendi.`,
          type: 'success',
        })
      );
    }
  };

  // Delete extra
  const handleDeleteExtra = async (extra) => {
    if (!confirm(`"${extra.name}" ekstra malzemesini silmek istediğinizden emin misiniz?`)) return;
    const updated = extras.filter((e) => e.id !== extra.id);
    setExtras(updated);
    const ok = await persistOptions(sauces, updated, drinks);
    if (ok) {
      dispatch(
        showMessageModal({
          title: 'Ekstra Silindi',
          text: `"${extra.name}" seçeneklerden silindi.`,
          type: 'success',
        })
      );
    }
  };

  // Reset to initial defaults
  const handleResetDefaults = async () => {
    if (!confirm('Tüm sos ve ekstraları varsayılan fabrika ayarlarına sıfırlamak istiyor musunuz?')) return;
    setFreeSauceLimit(DEFAULT_PRODUCT_OPTIONS.freeSauceLimit ?? 2);
    setExtraSaucePrice(DEFAULT_PRODUCT_OPTIONS.extraSaucePrice ?? 5);
    setSauces(DEFAULT_PRODUCT_OPTIONS.sauces);
    setExtras(DEFAULT_PRODUCT_OPTIONS.extras);
    setDrinks(DEFAULT_PRODUCT_OPTIONS.drinks);
    const ok = await persistOptions(
      DEFAULT_PRODUCT_OPTIONS.sauces,
      DEFAULT_PRODUCT_OPTIONS.extras,
      DEFAULT_PRODUCT_OPTIONS.drinks,
      DEFAULT_PRODUCT_OPTIONS.freeSauceLimit ?? 2,
      DEFAULT_PRODUCT_OPTIONS.extraSaucePrice ?? 5
    );
    if (ok) {
      dispatch(
        showMessageModal({
          title: 'Varsayılanlara Sıfırlandı',
          text: 'Tüm soslar ve ekstra malzemeler fabrika ayarlarına döndürüldü.',
          type: 'success',
        })
      );
    }
  };

  // Filtered lists
  const filteredSauces = sauces.filter((s) => {
    const matchSearch = (s.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'active'
        ? s.isAvailable !== false
        : s.isAvailable === false;
    return matchSearch && matchStatus;
  });

  const filteredExtras = extras.filter((e) => {
    const matchSearch = (e.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'active'
        ? e.isAvailable !== false
        : e.isAvailable === false;
    return matchSearch && matchStatus;
  });

  const activeSaucesCount = sauces.filter((s) => s.isAvailable !== false).length;
  const activeExtrasCount = extras.filter((e) => e.isAvailable !== false).length;

  return (
    <div className="p-3 sm:p-6 lg:p-8 space-y-5 w-full min-w-0 font-poppins animate-in fade-in duration-200">
      {/* 1. ÜST BAŞLIK VE ÖZET METRİKLER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-stone-900 via-stone-850 to-stone-900 p-5 sm:p-7 rounded-3xl text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-gradient-to-l from-amber-500/10 to-transparent pointer-events-none"></div>
        <div className="relative z-10 space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold uppercase tracking-wider border border-amber-500/30">
            <i className="fa-solid fa-sliders"></i>
            <span>Dinamik Sepet & Menü Özelleştirme</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
            <span>Soslar & Ekstra Malzemeler Yönetimi</span>
          </h2>
          <p className="text-stone-300 text-xs sm:text-sm max-w-2xl font-normal">
            Müşterilerinizin sandviç ve menü seçimlerinde göreceği sosları ve ekstra lezzetleri buradan açıp kapatabilir, fiyatlarını güncelleyebilir veya anında yeni sos ekleyebilirsiniz.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 relative z-10">
          <button
            type="button"
            onClick={fetchOptions}
            disabled={loading}
            className="bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-3.5 py-2.5 rounded-xl flex items-center gap-2 transition-all cursor-pointer border border-white/10 active:scale-95"
            title="Yenile"
          >
            <i className={`fa-solid fa-arrows-rotate text-xs ${loading ? 'animate-spin' : ''}`}></i>
            <span className="hidden sm:inline">Yenile</span>
          </button>
          <button
            type="button"
            onClick={handleResetDefaults}
            disabled={saving}
            className="bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white text-xs font-semibold px-3.5 py-2.5 rounded-xl flex items-center gap-2 transition-all cursor-pointer border border-stone-700 active:scale-95"
            title="Varsayılanlara Sıfırla"
          >
            <i className="fa-solid fa-clock-rotate-left text-xs"></i>
            <span className="hidden sm:inline">Varsayılanlar</span>
          </button>
        </div>
      </div>

      {/* 2. ÖZET KARTLAR */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-stone-500 font-bold mb-1">
            <span>Toplam Sos</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <i className="fa-solid fa-bottle-droplet text-sm"></i>
            </div>
          </div>
          <div className="text-2xl font-black text-stone-900">{sauces.length}</div>
          <div className="text-[11px] font-semibold text-emerald-600 mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>{activeSaucesCount} Satışa Açık</span>
            <span className="text-stone-400 font-normal">({sauces.length - activeSaucesCount} Kapalı)</span>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-stone-500 font-bold mb-1">
            <span>Ekstra Lezzetler</span>
            <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <i className="fa-solid fa-cheese text-sm"></i>
            </div>
          </div>
          <div className="text-2xl font-black text-stone-900">{extras.length}</div>
          <div className="text-[11px] font-semibold text-emerald-600 mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>{activeExtrasCount} Satışa Açık</span>
            <span className="text-stone-400 font-normal">({extras.length - activeExtrasCount} Kapalı)</span>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-stone-500 font-bold mb-1">
            <span>Sos Kotası & Politika</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <i className="fa-solid fa-scale-balanced text-sm"></i>
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-600">
            {freeSauceLimit > 0 ? `${freeSauceLimit} Adet Bedava` : 'Tümü Ücretli'}
          </div>
          <div className="text-[11px] font-semibold text-stone-500 mt-1">
            {extraSaucePrice > 0 ? `Kota Aşımı: +₺${extraSaucePrice}/Adet` : 'Sınırsız Ücretsiz'}
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-stone-500 font-bold mb-1">
            <span>Ort. Ekstra Fiyatı</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <i className="fa-solid fa-tags text-sm"></i>
            </div>
          </div>
          <div className="text-2xl font-black text-stone-900">
            ₺
            {extras.length > 0
              ? (extras.reduce((acc, e) => acc + (Number(e.price) || 0), 0) / extras.length).toFixed(1)
              : '0'}
          </div>
          <div className="text-[11px] font-semibold text-indigo-600 mt-1">
            Min ₺{Math.min(...extras.map((e) => Number(e.price) || 0), 0)} - Max ₺
            {Math.max(...extras.map((e) => Number(e.price) || 0), 0)}
          </div>
        </div>
      </div>

      {/* 3. KONTROL BARI & SEKMELER */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Sub-tab switcher */}
        <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveSubTab('sauces')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'sauces'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <i className="fa-solid fa-bottle-droplet text-amber-500"></i>
            <span>Soslar ({sauces.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('extras')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'extras'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <i className="fa-solid fa-cheese text-orange-500"></i>
            <span>Ekstra Lezzetler ({extras.length})</span>
          </button>
        </div>

        {/* Search & Status Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 sm:w-60">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs"></i>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ara..."
              className="w-full bg-stone-50 border border-stone-200 text-stone-900 text-xs font-medium rounded-xl pl-8 pr-3 py-2 focus:outline-none focus:border-brand-500 transition-colors"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="app-select bg-stone-50 border border-stone-200 text-stone-800 text-xs font-semibold rounded-xl px-3 py-2 cursor-pointer focus:outline-none focus:border-brand-500"
          >
            <option value="all">Tüm Durumlar</option>
            <option value="active">Sadece Açık (Aktif)</option>
            <option value="inactive">Sadece Kapalı (Tükendi)</option>
          </select>

          {activeSubTab === 'sauces' ? (
            <button
              type="button"
              onClick={() => {
                setEditingSauce(null);
                setSauceForm({ name: '', isAvailable: true, price: 0 });
                setIsAddSauceModalOpen(true);
              }}
              className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 cursor-pointer shadow-xs active:scale-95 transition-all"
            >
              <i className="fa-solid fa-plus"></i>
              <span>Yeni Sos Ekle</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditingExtra(null);
                setExtraForm({ name: '', price: 20, isAvailable: true });
                setIsAddExtraModalOpen(true);
              }}
              className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 cursor-pointer shadow-xs active:scale-95 transition-all"
            >
              <i className="fa-solid fa-plus"></i>
              <span>Yeni Ekstra Ekle</span>
            </button>
          )}
        </div>
      </div>

      {/* 4. SOS KOTASI & ÜCRETLENDİRME POLİTİKASI (YÖNETİCİ BELİRLER) */}
      {activeSubTab === 'sauces' && (
        <div className="bg-gradient-to-br from-amber-500/10 via-amber-50/50 to-white p-4 sm:p-6 rounded-3xl border border-amber-200/90 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/25 shrink-0">
                <i className="fa-solid fa-scale-balanced text-lg"></i>
              </div>
              <div>
                <h3 className="font-extrabold text-stone-900 text-sm sm:text-base flex items-center gap-2">
                  <span>Ücretsiz Sos Kotası &amp; Ekstra Sos Ücretlendirmesi</span>
                  <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
                    Kural
                  </span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Müşteri sandviç veya menü seçerken bu sınıra kadar ücretsiz sos seçebilir; sınır aşıldığında kalan soslar için belirlenen ilave ücret sepete yansıtılır.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleSaveSaucePolicy(freeSauceLimit, extraSaucePrice)}
              disabled={saving}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-95 transition-all shrink-0"
            >
              <i className="fa-solid fa-floppy-disk"></i>
              <span>{saving ? 'Kaydediliyor...' : 'Politikayı Kaydet'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
            <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-2xs">
              <label className="block text-xs font-bold text-stone-800 uppercase mb-1">
                Ücretsiz Sos Sınırı (Adet)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={freeSauceLimit}
                  onChange={(e) => setFreeSauceLimit(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2 text-sm font-extrabold text-stone-900 focus:outline-none focus:border-amber-500"
                />
                <span className="text-xs font-bold text-stone-500 whitespace-nowrap">Adet</span>
              </div>
              <span className="text-[11px] text-stone-400 block mt-1">
                Örn: 2 seçilirse ilk 2 sos tamamen bedavadır.
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-2xs">
              <label className="block text-xs font-bold text-stone-800 uppercase mb-1">
                Kotayı Aşan Her Sosun Ücreti (₺)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={extraSaucePrice}
                  onChange={(e) => setExtraSaucePrice(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2 text-sm font-extrabold text-brand-600 focus:outline-none focus:border-amber-500"
                />
                <span className="text-xs font-bold text-stone-500 whitespace-nowrap">₺ / Adet</span>
              </div>
              <span className="text-[11px] text-stone-400 block mt-1">
                Örn: 5 seçilirse, 3. sostan itibaren tanesi ₺5 eklenir.
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-2xs sm:col-span-2 lg:col-span-1 flex flex-col justify-between">
              <div>
                <label className="block text-xs font-bold text-stone-800 uppercase mb-1.5">
                  Hızlı Hazır Şablonlar
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleSaveSaucePolicy(2, 5)}
                    className="text-[11px] font-bold p-1.5 rounded-lg bg-stone-100 hover:bg-amber-100 text-stone-700 hover:text-amber-900 transition-colors cursor-pointer text-center"
                  >
                    2 Bedava / +₺5
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveSaucePolicy(3, 7.5)}
                    className="text-[11px] font-bold p-1.5 rounded-lg bg-stone-100 hover:bg-amber-100 text-stone-700 hover:text-amber-900 transition-colors cursor-pointer text-center"
                  >
                    3 Bedava / +₺7.5
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveSaucePolicy(1, 5)}
                    className="text-[11px] font-bold p-1.5 rounded-lg bg-stone-100 hover:bg-amber-100 text-stone-700 hover:text-amber-900 transition-colors cursor-pointer text-center"
                  >
                    1 Bedava / +₺5
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveSaucePolicy(99, 0)}
                    className="text-[11px] font-bold p-1.5 rounded-lg bg-stone-100 hover:bg-emerald-100 text-stone-700 hover:text-emerald-900 transition-colors cursor-pointer text-center"
                  >
                    Hepsi Bedava
                  </button>
                </div>
              </div>
              <span className="text-[10px] text-stone-400 mt-2 block">
                Şablona tıkladığınızda kural anında kaydedilir ve yürürlüğe girer.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 5. SOS LİSTESİ BÖLÜMÜ */}
      {activeSubTab === 'sauces' && (
        <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100 overflow-hidden shadow-xs">
          <div className="p-4 bg-stone-50/70 flex items-center justify-between text-xs font-bold text-stone-600 border-b border-stone-200/80">
            <span>Sos Adı & Detay</span>
            <div className="flex items-center gap-6">
              <span>Satış Durumu (Aç / Kapat)</span>
              <span className="w-20 text-right">İşlemler</span>
            </div>
          </div>

          {filteredSauces.length === 0 ? (
            <div className="p-12 text-center text-stone-400 space-y-2">
              <i className="fa-solid fa-bottle-droplet text-3xl text-stone-300"></i>
              <p className="text-xs font-medium">Aramanıza uygun sos bulunamadı.</p>
            </div>
          ) : (
            filteredSauces.map((sauce) => {
              const isOpen = sauce.isAvailable !== false;
              return (
                <div
                  key={sauce.id}
                  className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-stone-50/60 transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
                        isOpen
                          ? 'bg-amber-50 text-amber-600 border-amber-200'
                          : 'bg-stone-100 text-stone-400 border-stone-200'
                      }`}
                    >
                      <i className="fa-solid fa-bottle-droplet text-base"></i>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-900 text-sm">{sauce.name}</span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          Ücretsiz
                        </span>
                      </div>
                      <span className="text-[11px] text-stone-400 block mt-0.5">
                        Müşteriler sepet modalından dilediği adette seçebilir.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                    {/* Durum Aç / Kapat Butonu */}
                    <button
                      type="button"
                      onClick={() => handleToggleSauce(sauce.id)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-2xs active:scale-95 ${
                        isOpen
                          ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                      }`}
                      title={isOpen ? 'Sos satışta - Kapatmak için tıklayın' : 'Sos kapalı - Açmak için tıklayın'}
                    >
                      <span className={`w-2 h-2 rounded-full ${isOpen ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                      <span>{isOpen ? 'Satışta (Açık)' : 'Tükendi (Kapalı)'}</span>
                      <i className={`fa-solid ${isOpen ? 'fa-toggle-on text-emerald-600 text-sm' : 'fa-toggle-off text-rose-500 text-sm'}`}></i>
                    </button>

                    {/* Düzenle & Sil */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSauce(sauce);
                          setSauceForm({
                            name: sauce.name,
                            isAvailable: sauce.isAvailable !== false,
                            price: 0,
                          });
                          setIsAddSauceModalOpen(true);
                        }}
                        className="p-2 text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                        title="Düzenle"
                      >
                        <i className="fa-solid fa-pen-to-square"></i>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSauce(sauce)}
                        className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs cursor-pointer transition-colors"
                        title="Sil"
                      >
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 5. EKSTRA MALZEMELER LİSTESİ BÖLÜMÜ */}
      {activeSubTab === 'extras' && (
        <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100 overflow-hidden shadow-xs">
          <div className="p-4 bg-stone-50/70 flex items-center justify-between text-xs font-bold text-stone-600 border-b border-stone-200/80">
            <span>Malzeme Adı & Detay</span>
            <div className="flex items-center gap-6">
              <span>Ek Fiyat</span>
              <span>Satış Durumu (Aç / Kapat)</span>
              <span className="w-20 text-right">İşlemler</span>
            </div>
          </div>

          {filteredExtras.length === 0 ? (
            <div className="p-12 text-center text-stone-400 space-y-2">
              <i className="fa-solid fa-cheese text-3xl text-stone-300"></i>
              <p className="text-xs font-medium">Aramanıza uygun ekstra malzeme bulunamadı.</p>
            </div>
          ) : (
            filteredExtras.map((extra) => {
              const isOpen = extra.isAvailable !== false;
              return (
                <div
                  key={extra.id}
                  className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-stone-50/60 transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
                        isOpen
                          ? 'bg-orange-50 text-orange-600 border-orange-200'
                          : 'bg-stone-100 text-stone-400 border-stone-200'
                      }`}
                    >
                      <i className="fa-solid fa-cheese text-base"></i>
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-stone-900 text-sm block">{extra.name}</span>
                      <span className="text-[11px] text-stone-400 block mt-0.5">
                        Ürüne ilave edildiğinde sepete otomatik eklenir.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                    {/* Fiyat Göstergesi */}
                    <span className="text-sm font-black text-brand-600 bg-brand-50 border border-brand-200 px-3 py-1 rounded-xl">
                      +₺{Number(extra.price || 0).toFixed(2)}
                    </span>

                    {/* Durum Aç / Kapat Butonu */}
                    <button
                      type="button"
                      onClick={() => handleToggleExtra(extra.id)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-2xs active:scale-95 ${
                        isOpen
                          ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                      }`}
                      title={isOpen ? 'Ekstra satışta - Kapatmak için tıklayın' : 'Ekstra kapalı - Açmak için tıklayın'}
                    >
                      <span className={`w-2 h-2 rounded-full ${isOpen ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                      <span>{isOpen ? 'Satışta (Açık)' : 'Tükendi (Kapalı)'}</span>
                      <i className={`fa-solid ${isOpen ? 'fa-toggle-on text-emerald-600 text-sm' : 'fa-toggle-off text-rose-500 text-sm'}`}></i>
                    </button>

                    {/* Düzenle & Sil */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingExtra(extra);
                          setExtraForm({
                            name: extra.name,
                            price: Number(extra.price) || 0,
                            isAvailable: extra.isAvailable !== false,
                          });
                          setIsAddExtraModalOpen(true);
                        }}
                        className="p-2 text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                        title="Düzenle"
                      >
                        <i className="fa-solid fa-pen-to-square"></i>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteExtra(extra)}
                        className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs cursor-pointer transition-colors"
                        title="Sil"
                      >
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* MODAL 1: SOS EKLE / DÜZENLE */}
      {isAddSauceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="font-extrabold text-base text-stone-900 flex items-center gap-2">
                <i className="fa-solid fa-bottle-droplet text-amber-500"></i>
                <span>{editingSauce ? 'Sosu Düzenle' : 'Yeni Sos Ekle'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddSauceModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 p-1.5 rounded-xl cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <form onSubmit={handleSaveSauce} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                  Sos Adı *
                </label>
                <input
                  type="text"
                  required
                  value={sauceForm.name}
                  onChange={(e) => setSauceForm({ ...sauceForm, name: e.target.value })}
                  placeholder="Örn: Ranch Sos, Trüflü Mayonez, Sweet Chili..."
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-brand-500 text-stone-900"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 border border-stone-200">
                <div>
                  <span className="text-xs font-bold text-stone-800 block">Satış Durumu</span>
                  <span className="text-[11px] text-stone-400 block">Müşterilerin siparişine anında açılsın mı?</span>
                </div>
                <input
                  type="checkbox"
                  checked={sauceForm.isAvailable}
                  onChange={(e) => setSauceForm({ ...sauceForm, isAvailable: e.target.checked })}
                  className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsAddSauceModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl cursor-pointer shadow-xs active:scale-95 transition-all flex items-center gap-2"
                >
                  <i className="fa-solid fa-check"></i>
                  <span>{editingSauce ? 'Güncelle' : 'Kaydet'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EKSTRA EKLE / DÜZENLE */}
      {isAddExtraModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="font-extrabold text-base text-stone-900 flex items-center gap-2">
                <i className="fa-solid fa-cheese text-orange-500"></i>
                <span>{editingExtra ? 'Ekstra Malzemeyi Düzenle' : 'Yeni Ekstra Malzeme Ekle'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddExtraModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 p-1.5 rounded-xl cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <form onSubmit={handleSaveExtra} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                  Malzeme Adı *
                </label>
                <input
                  type="text"
                  required
                  value={extraForm.name}
                  onChange={(e) => setExtraForm({ ...extraForm, name: e.target.value })}
                  placeholder="Örn: Kornişon Turşu, Ekstra Jambon, Mantar..."
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-brand-500 text-stone-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                  İlave Fiyat (₺) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  required
                  value={extraForm.price}
                  onChange={(e) => setExtraForm({ ...extraForm, price: e.target.value })}
                  placeholder="20"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-brand-500 text-stone-900"
                />
                <span className="text-[11px] text-stone-400 block mt-1">
                  Müşteri bu ürünü işaretlediğinde sepete bu tutar ilave edilir.
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 border border-stone-200">
                <div>
                  <span className="text-xs font-bold text-stone-800 block">Satış Durumu</span>
                  <span className="text-[11px] text-stone-400 block">Müşterilerin seçimine anında açılsın mı?</span>
                </div>
                <input
                  type="checkbox"
                  checked={extraForm.isAvailable}
                  onChange={(e) => setExtraForm({ ...extraForm, isAvailable: e.target.checked })}
                  className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsAddExtraModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl cursor-pointer shadow-xs active:scale-95 transition-all flex items-center gap-2"
                >
                  <i className="fa-solid fa-check"></i>
                  <span>{editingExtra ? 'Güncelle' : 'Kaydet'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

