'use client';

import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { showMessageModal } from '@/store/slices/uiSlice';
import {
  DEFAULT_PRODUCT_OPTIONS,
  DEFAULT_MENU_DRINK_GROUPS,
  MENU_DRINK_TIER_META,
  normalizeMenuDrinkGroups
} from '@/lib/productOptionsDefaults';
import {
  getBrowserCache,
  setBrowserCache,
  isBrowserCacheStale,
  fetchWithBrowserCache,
  CACHE_TTL_LONG
} from '@/lib/browserDataCache';

export default function OptionsManagementTab() {
  const dispatch = useDispatch();
  const initialCached = getBrowserCache('options_all')?.data;

  const [loading, setLoading] = useState(!initialCached);
  const [saving, setSaving] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('sauces'); // 'sauces' | 'extras' | 'drinks'
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive'

  // Data state
  const [sauces, setSauces] = useState(
    Array.isArray(initialCached?.sauces) ? initialCached.sauces : []
  );
  const [freeSauceLimit, setFreeSauceLimit] = useState(
    typeof initialCached?.freeSauceLimit === 'number'
      ? initialCached.freeSauceLimit
      : DEFAULT_PRODUCT_OPTIONS.freeSauceLimit ?? 20
  );
  const [extraSaucePrice, setExtraSaucePrice] = useState(
    typeof initialCached?.extraSaucePrice === 'number'
      ? initialCached.extraSaucePrice
      : DEFAULT_PRODUCT_OPTIONS.extraSaucePrice ?? 5
  );
  const [extras, setExtras] = useState(
    Array.isArray(initialCached?.extras) ? initialCached.extras : []
  );
  const [drinks, setDrinks] = useState(
    Array.isArray(initialCached?.drinks) ? initialCached.drinks : DEFAULT_PRODUCT_OPTIONS.drinks
  );
  const [menuDrinkGroups, setMenuDrinkGroups] = useState(
    initialCached?.menuDrinkGroups && typeof initialCached.menuDrinkGroups === 'object'
      ? normalizeMenuDrinkGroups(initialCached.menuDrinkGroups)
      : DEFAULT_MENU_DRINK_GROUPS
  );
  const [newTierDrinkInput, setNewTierDrinkInput] = useState({ '1': '', '2': '', '3': '', '4': '' });
  const [newTierDrinkPrice, setNewTierDrinkPrice] = useState({ '1': '0', '2': '0', '3': '0', '4': '0' });

  // Modal states
  const [isAddSauceModalOpen, setIsAddSauceModalOpen] = useState(false);
  const [editingSauce, setEditingSauce] = useState(null);
  const [sauceForm, setSauceForm] = useState({ name: '', isAvailable: true, price: 0 });

  const [isAddExtraModalOpen, setIsAddExtraModalOpen] = useState(false);
  const [editingExtra, setEditingExtra] = useState(null);
  const [extraForm, setExtraForm] = useState({ name: '', price: 20, isAvailable: true });

  const applyOptionsPayload = (data) => {
    if (!data || typeof data !== 'object') return;
    if (typeof data.freeSauceLimit === 'number') setFreeSauceLimit(data.freeSauceLimit);
    if (typeof data.extraSaucePrice === 'number') setExtraSaucePrice(data.extraSaucePrice);
    if (Array.isArray(data.sauces)) setSauces(data.sauces);
    if (Array.isArray(data.extras)) setExtras(data.extras);
    if (Array.isArray(data.drinks)) setDrinks(data.drinks);
    if (data.menuDrinkGroups && typeof data.menuDrinkGroups === 'object') {
      setMenuDrinkGroups(normalizeMenuDrinkGroups(data.menuDrinkGroups));
    }
  };

  // Fetch current options from server (önbellek tazeyse DB'ye gitmeden tarayıcıdan sunar)
  const fetchOptions = async (force = false, { silent = false } = {}) => {
    const cached = getBrowserCache('options_all');
    if (!force && cached?.data && !isBrowserCacheStale('options_all', CACHE_TTL_LONG)) {
      applyOptionsPayload(cached.data);
      setLoading(false);
      return;
    }

    try {
      if (!silent) setLoading(true);
      const res = await fetchWithBrowserCache('options_all', '/api/options', {
        force: force === true,
        maxAgeMs: CACHE_TTL_LONG,
        persist: true,
        extract: (json) => json.data
      });
      if (res.ok && res.data) {
        applyOptionsPayload(res.data);
      }
    } catch (err) {
      console.error('Seçenekler yüklenemedi:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    const cached = getBrowserCache('options_all');
    if (cached?.data) {
      applyOptionsPayload(cached.data);
      setLoading(false);
      if (isBrowserCacheStale('options_all', CACHE_TTL_LONG)) {
        fetchOptions(true, { silent: true });
      }
    } else {
      fetchOptions(false);
    }
  }, []);

  // Save all options to server
  const persistOptions = async (
    updatedSauces,
    updatedExtras,
    updatedDrinks,
    limitOverride,
    priceOverride,
    menuDrinkGroupsOverride
  ) => {
    const nextGroups = menuDrinkGroupsOverride || menuDrinkGroups;
    const payload = {
      freeSauceLimit: typeof limitOverride === 'number' ? limitOverride : freeSauceLimit,
      extraSaucePrice: typeof priceOverride === 'number' ? priceOverride : extraSaucePrice,
      sauces: updatedSauces || sauces,
      extras: updatedExtras || extras,
      drinks: updatedDrinks || nextGroups?.['1'] || drinks,
      menuDrinkGroups: nextGroups,
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
      setBrowserCache('options_all', json.data || payload, {
        persist: true,
        broadcastKey: 'sandwich_options_updated'
      });
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
    setMenuDrinkGroups(DEFAULT_MENU_DRINK_GROUPS);
    const ok = await persistOptions(
      DEFAULT_PRODUCT_OPTIONS.sauces,
      DEFAULT_PRODUCT_OPTIONS.extras,
      DEFAULT_PRODUCT_OPTIONS.drinks,
      DEFAULT_PRODUCT_OPTIONS.freeSauceLimit ?? 2,
      DEFAULT_PRODUCT_OPTIONS.extraSaucePrice ?? 5,
      DEFAULT_MENU_DRINK_GROUPS
    );
    if (ok) {
      dispatch(
        showMessageModal({
          title: 'Varsayılanlara Sıfırlandı',
          text: 'Tüm soslar, ekstra malzemeler ve menü içecekleri fabrika ayarlarına döndürüldü.',
          type: 'success',
        })
      );
    }
  };

  // Menü İçecek Grubu İşlemleri (1, 2, 3, 4 Kişilik)
  const handleAddTierDrink = async (tierKey) => {
    const name = String(newTierDrinkInput[tierKey] || '').trim();
    if (!name) return;
    const price = Math.max(0, Math.min(500, Number(newTierDrinkPrice[tierKey]) || 0));
    const currentList = menuDrinkGroups[tierKey] || [];
    const nextGroups = {
      ...menuDrinkGroups,
      [tierKey]: [
        ...currentList,
        { id: `m${tierKey}-${Date.now()}`, name, price, isAvailable: true },
      ],
    };
    setMenuDrinkGroups(nextGroups);
    setNewTierDrinkInput((prev) => ({ ...prev, [tierKey]: '' }));
    setNewTierDrinkPrice((prev) => ({ ...prev, [tierKey]: '0' }));
    await persistOptions(sauces, extras, nextGroups['1'], freeSauceLimit, extraSaucePrice, nextGroups);
  };

  const handleUpdateTierDrinkPrice = async (tierKey, drinkId, rawPrice) => {
    const cleanPrice = Math.max(0, Math.min(500, Number(rawPrice) || 0));
    const nextGroups = {
      ...menuDrinkGroups,
      [tierKey]: (menuDrinkGroups[tierKey] || []).map((d) =>
        d.id === drinkId ? { ...d, price: cleanPrice } : d
      ),
    };
    setMenuDrinkGroups(nextGroups);
    await persistOptions(sauces, extras, nextGroups['1'], freeSauceLimit, extraSaucePrice, nextGroups);
  };

  const handleMakeDefaultTierDrink = async (tierKey, drinkId) => {
    const list = menuDrinkGroups[tierKey] || [];
    const target = list.find((d) => d.id === drinkId);
    if (!target) return;
    const reordered = [target, ...list.filter((d) => d.id !== drinkId)];
    const nextGroups = {
      ...menuDrinkGroups,
      [tierKey]: reordered,
    };
    setMenuDrinkGroups(nextGroups);
    await persistOptions(sauces, extras, nextGroups['1'], freeSauceLimit, extraSaucePrice, nextGroups);
  };

  const handleToggleTierDrink = async (tierKey, drinkId) => {
    const nextGroups = {
      ...menuDrinkGroups,
      [tierKey]: (menuDrinkGroups[tierKey] || []).map((d) =>
        d.id === drinkId ? { ...d, isAvailable: !d.isAvailable } : d
      ),
    };
    setMenuDrinkGroups(nextGroups);
    await persistOptions(sauces, extras, nextGroups['1'], freeSauceLimit, extraSaucePrice, nextGroups);
  };

  const handleDeleteTierDrink = async (tierKey, drinkId) => {
    const list = menuDrinkGroups[tierKey] || [];
    if (list.length <= 1) {
      dispatch(
        showMessageModal({
          title: 'En Az 1 Seçenek Gerekli',
          text: 'Her menü boyutu için en az 1 içecek seçeneği kalmalıdır.',
          type: 'warning',
        })
      );
      return;
    }
    const nextGroups = {
      ...menuDrinkGroups,
      [tierKey]: list.filter((d) => d.id !== drinkId),
    };
    setMenuDrinkGroups(nextGroups);
    await persistOptions(sauces, extras, nextGroups['1'], freeSauceLimit, extraSaucePrice, nextGroups);
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
    <div className="p-3 sm:p-6 space-y-4 w-full min-w-0 font-poppins animate-in fade-in duration-200">
      {/* 1. MİNİMAL ÜST BAŞLIK & ÖZET */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base sm:text-lg font-extrabold text-stone-900">
            Soslar &amp; Ekstralar
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-stone-500">
            <span className="inline-flex items-center gap-1.5 bg-stone-100 text-stone-700 px-2.5 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Soslar: {activeSaucesCount}/{sauces.length} açık
            </span>
            <span className="inline-flex items-center gap-1.5 bg-stone-100 text-stone-700 px-2.5 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
              Ekstralar: {activeExtrasCount}/{extras.length} açık
            </span>
            <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 border border-amber-200/70 px-2.5 py-0.5 rounded-full">
              Kota:{' '}
              {freeSauceLimit > 0
                ? `${freeSauceLimit} bedava${extraSaucePrice > 0 ? ` (+₺${extraSaucePrice})` : ''}`
                : `Tümü +₺${extraSaucePrice}`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => fetchOptions(true)}
            disabled={loading}
            className="bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer border border-stone-200"
            title="Yenile"
          >
            <i className={`fa-solid fa-arrows-rotate text-xs ${loading ? 'animate-spin' : ''}`}></i>
            <span>Yenile</span>
          </button>
          <button
            type="button"
            onClick={handleResetDefaults}
            disabled={saving}
            className="bg-stone-50 hover:bg-stone-100 text-stone-600 hover:text-stone-900 text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer border border-stone-200"
            title="Varsayılanlara Sıfırla"
          >
            <i className="fa-solid fa-clock-rotate-left text-xs"></i>
            <span className="hidden sm:inline">Varsayılanlar</span>
          </button>
        </div>
      </div>

      {/* 2. KONTROL BARI & SEKMELER */}
      <div className="bg-white p-3 rounded-2xl border border-stone-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
        <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveSubTab('sauces')}
            className={`flex-1 md:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeSubTab === 'sauces'
                ? 'bg-white text-stone-900 shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <i className="fa-solid fa-bottle-droplet text-amber-500"></i>
            <span>Soslar ({sauces.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('extras')}
            className={`flex-1 md:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeSubTab === 'extras'
                ? 'bg-white text-stone-900 shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <i className="fa-solid fa-cheese text-orange-500"></i>
            <span>Ekstra Lezzetler ({extras.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('drinks')}
            className={`flex-1 md:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeSubTab === 'drinks'
                ? 'bg-white text-stone-900 shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <i className="fa-solid fa-cup-straw text-sky-600"></i>
            <span>Menü İçecekleri</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:w-52">
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
            <option value="all">Tümü</option>
            <option value="active">Açık</option>
            <option value="inactive">Kapalı</option>
          </select>

          {activeSubTab === 'sauces' ? (
            <button
              type="button"
              onClick={() => {
                setEditingSauce(null);
                setSauceForm({ name: '', isAvailable: true, price: 0 });
                setIsAddSauceModalOpen(true);
              }}
              className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <i className="fa-solid fa-plus"></i>
              <span>Yeni Sos</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditingExtra(null);
                setExtraForm({ name: '', price: 20, isAvailable: true });
                setIsAddExtraModalOpen(true);
              }}
              className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <i className="fa-solid fa-plus"></i>
              <span>Yeni Ekstra</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. KOMPAKT SOS KOTASI & ÜCRETLENDİRME BARI */}
      {activeSubTab === 'sauces' && (
        <div className="bg-white px-4 py-3 rounded-2xl border border-stone-200 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
              <i className="fa-solid fa-scale-balanced text-amber-500"></i>
              <span>Sos Kotası</span>
            </span>

            <label className="flex items-center gap-1.5 text-xs text-stone-600 font-medium">
              <span>Ücretsiz:</span>
              <input
                type="number"
                min="0"
                max="20"
                value={freeSauceLimit}
                onChange={(e) => setFreeSauceLimit(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-16 bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 text-xs font-bold text-stone-900 text-center focus:outline-none focus:border-brand-500"
              />
              <span className="text-[11px] text-stone-400">adet</span>
            </label>

            <label className="flex items-center gap-1.5 text-xs text-stone-600 font-medium">
              <span>Aşım:</span>
              <span className="text-stone-400 font-bold">+₺</span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={extraSaucePrice}
                onChange={(e) => setExtraSaucePrice(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-16 bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 text-xs font-bold text-brand-600 text-center focus:outline-none focus:border-brand-500"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleSaveSaucePolicy(2, 5)}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-amber-50 text-stone-600 hover:text-amber-800 transition-colors cursor-pointer"
            >
              2 Bedava / +₺5
            </button>
            <button
              type="button"
              onClick={() => handleSaveSaucePolicy(3, 7.5)}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-amber-50 text-stone-600 hover:text-amber-800 transition-colors cursor-pointer"
            >
              3 Bedava / +₺7.5
            </button>
            <button
              type="button"
              onClick={() => handleSaveSaucePolicy(1, 5)}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-amber-50 text-stone-600 hover:text-amber-800 transition-colors cursor-pointer"
            >
              1 Bedava / +₺5
            </button>
            <button
              type="button"
              onClick={() => handleSaveSaucePolicy(99, 0)}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-emerald-50 text-stone-600 hover:text-emerald-800 transition-colors cursor-pointer"
            >
              Hepsi Bedava
            </button>
            <button
              type="button"
              onClick={() => handleSaveSaucePolicy(freeSauceLimit, extraSaucePrice)}
              disabled={saving}
              className="bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors ml-1"
            >
              <i className="fa-solid fa-check text-[11px]"></i>
              <span>{saving ? 'Kaydediliyor...' : 'Kaydet'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. SOS LİSTESİ */}
      {activeSubTab === 'sauces' && (
        <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100 overflow-hidden">
          <div className="hidden sm:flex px-4 py-2.5 bg-stone-50/80 items-center justify-between text-[11px] font-bold uppercase tracking-wider text-stone-500 border-b border-stone-200/80">
            <span>Sos Adı</span>
            <div className="flex items-center gap-6">
              <span>Durum</span>
              <span className="w-16 text-right">İşlem</span>
            </div>
          </div>

          {filteredSauces.length === 0 ? (
            <div className="p-10 text-center text-stone-400 space-y-1.5">
              <i className="fa-solid fa-bottle-droplet text-2xl text-stone-300"></i>
              <p className="text-xs font-medium">Aramanıza uygun sos bulunamadı.</p>
            </div>
          ) : (
            filteredSauces.map((sauce) => {
              const isOpen = sauce.isAvailable !== false;
              return (
                <div
                  key={sauce.id}
                  className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-stone-50/70 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isOpen ? 'bg-emerald-500' : 'bg-stone-300'
                      }`}
                    ></span>
                    <span className="font-semibold text-stone-900 text-sm truncate">
                      {sauce.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleSauce(sauce.id)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer border ${
                        isOpen
                          ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                          : 'bg-stone-100 hover:bg-stone-200 text-stone-500 border-stone-200'
                      }`}
                      title={isOpen ? 'Sos satışta - Kapatmak için tıklayın' : 'Sos kapalı - Açmak için tıklayın'}
                    >
                      <i
                        className={`fa-solid ${
                          isOpen ? 'fa-toggle-on text-emerald-600' : 'fa-toggle-off text-stone-400'
                        }`}
                      ></i>
                      <span>{isOpen ? 'Açık' : 'Kapalı'}</span>
                    </button>

                    <div className="flex items-center gap-1">
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
                        className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg text-xs cursor-pointer transition-colors"
                        title="Düzenle"
                      >
                        <i className="fa-solid fa-pen-to-square"></i>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSauce(sauce)}
                        className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs cursor-pointer transition-colors"
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

      {/* 5. EKSTRA MALZEMELER LİSTESİ */}
      {activeSubTab === 'extras' && (
        <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100 overflow-hidden">
          <div className="hidden sm:flex px-4 py-2.5 bg-stone-50/80 items-center justify-between text-[11px] font-bold uppercase tracking-wider text-stone-500 border-b border-stone-200/80">
            <span>Malzeme Adı</span>
            <div className="flex items-center gap-6">
              <span>Fiyat</span>
              <span>Durum</span>
              <span className="w-16 text-right">İşlem</span>
            </div>
          </div>

          {filteredExtras.length === 0 ? (
            <div className="p-10 text-center text-stone-400 space-y-1.5">
              <i className="fa-solid fa-cheese text-2xl text-stone-300"></i>
              <p className="text-xs font-medium">Aramanıza uygun ekstra malzeme bulunamadı.</p>
            </div>
          ) : (
            filteredExtras.map((extra) => {
              const isOpen = extra.isAvailable !== false;
              return (
                <div
                  key={extra.id}
                  className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-stone-50/70 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isOpen ? 'bg-emerald-500' : 'bg-stone-300'
                      }`}
                    ></span>
                    <span className="font-semibold text-stone-900 text-sm truncate">
                      {extra.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
                    <span className="text-xs font-bold text-brand-600 bg-brand-50 border border-brand-200/70 px-2.5 py-1 rounded-lg">
                      +₺{Number(extra.price || 0).toFixed(2)}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleToggleExtra(extra.id)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer border ${
                        isOpen
                          ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                          : 'bg-stone-100 hover:bg-stone-200 text-stone-500 border-stone-200'
                      }`}
                      title={isOpen ? 'Ekstra satışta - Kapatmak için tıklayın' : 'Ekstra kapalı - Açmak için tıklayın'}
                    >
                      <i
                        className={`fa-solid ${
                          isOpen ? 'fa-toggle-on text-emerald-600' : 'fa-toggle-off text-stone-400'
                        }`}
                      ></i>
                      <span>{isOpen ? 'Açık' : 'Kapalı'}</span>
                    </button>

                    <div className="flex items-center gap-1">
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
                        className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg text-xs cursor-pointer transition-colors"
                        title="Düzenle"
                      >
                        <i className="fa-solid fa-pen-to-square"></i>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteExtra(extra)}
                        className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs cursor-pointer transition-colors"
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

      {/* 3. MENÜ İÇECEKLERİ YÖNETİMİ (1, 2, 3, 4 KİŞİLİK DİNAMİK) */}
      {activeSubTab === 'drinks' && (
        <div className="space-y-4">
          <div className="bg-sky-50/70 border border-sky-200 rounded-2xl p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs text-sky-900">
              <i className="fa-solid fa-circle-info text-sky-600 text-sm"></i>
              <span>
                <strong>Menü boyutuna göre dinamik içecek kuralları:</strong> Müşteriler 1, 2, 3 veya 4 kişilik menü seçtiğinde yalnızca o menü için aşağıda aktif olan içecekleri seçebilir.
              </span>
            </div>
            {saving && (
              <span className="text-[11px] font-bold text-sky-700 shrink-0">Kaydediliyor...</span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MENU_DRINK_TIER_META.map((tier) => {
              const tierDrinks = menuDrinkGroups[tier.key] || [];
              return (
                <div
                  key={tier.key}
                  className="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden flex flex-col"
                >
                  <div className="px-4 py-3 bg-stone-50 border-b border-stone-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-xl bg-sky-100 text-sky-700 font-black text-xs flex items-center justify-center">
                        {tier.key}K
                      </span>
                      <div>
                        <h4 className="text-xs font-extrabold text-stone-900">{tier.label}</h4>
                        <span className="text-[10px] font-medium text-stone-500">
                          {tierDrinks.filter((d) => d.isAvailable !== false).length} aktif seçenek
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-stone-200/80 text-stone-700">
                      {tier.badge}
                    </span>
                  </div>

                  <div className="p-3.5 space-y-2 flex-1">
                    {tierDrinks.map((dr, idx) => {
                      const active = dr.isAvailable !== false;
                      const isDefault = idx === 0;
                      const drPrice = Math.max(0, Number(dr.price) || 0);
                      return (
                        <div
                          key={dr.id}
                          className={`flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs ${
                            active
                              ? isDefault
                                ? 'bg-amber-50/40 border-amber-300/80 text-stone-900'
                                : 'bg-white border-stone-200 text-stone-900'
                              : 'bg-stone-50 border-stone-200/60 text-stone-400 line-through'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => !isDefault && handleMakeDefaultTierDrink(tier.key, dr.id)}
                              title={isDefault ? 'Varsayılan Seçili İçecek' : 'Varsayılan İçecek Yap (1. Sıraya Al)'}
                              className={`shrink-0 text-xs transition-colors ${
                                isDefault
                                  ? 'text-amber-500 cursor-default'
                                  : 'text-stone-300 hover:text-amber-500 cursor-pointer'
                              }`}
                            >
                              <i className="fa-solid fa-star"></i>
                            </button>
                            <span className="font-bold truncate">{dr.name}</span>
                            {isDefault && (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 shrink-0">
                                Varsayılan
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="flex items-center bg-stone-50 border border-stone-200 rounded-lg px-1.5 py-0.5" title="Fiyat Farkı (+₺, 0 = Dahil)">
                              <span className="text-[10px] font-bold text-stone-500 mr-0.5">+₺</span>
                              <input
                                type="number"
                                min={0}
                                max={500}
                                step={1}
                                defaultValue={drPrice}
                                key={`${dr.id}_${drPrice}`}
                                onBlur={(e) => {
                                  const nextVal = Math.max(0, Number(e.target.value) || 0);
                                  if (nextVal !== drPrice) {
                                    handleUpdateTierDrinkPrice(tier.key, dr.id, nextVal);
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') e.currentTarget.blur();
                                }}
                                className="w-11 bg-transparent text-[11px] font-black text-stone-900 focus:outline-none text-right"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleToggleTierDrink(tier.key, dr.id)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-extrabold cursor-pointer transition-colors ${
                                active
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-stone-200 text-stone-600 hover:bg-stone-300'
                              }`}
                            >
                              {active ? 'Açık' : 'Kapalı'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTierDrink(tier.key, dr.id)}
                              className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                              title="Sil"
                            >
                              <i className="fa-solid fa-trash-can text-[11px]"></i>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleAddTierDrink(tier.key);
                    }}
                    className="p-3 bg-stone-50/70 border-t border-stone-100 flex items-center gap-1.5"
                  >
                    <input
                      type="text"
                      value={newTierDrinkInput[tier.key] || ''}
                      onChange={(e) =>
                        setNewTierDrinkInput((prev) => ({ ...prev, [tier.key]: e.target.value }))
                      }
                      placeholder={`Yeni ${tier.key} kişilik içecek...`}
                      className="flex-1 min-w-0 bg-white border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-stone-900 focus:outline-none focus:border-brand-500"
                    />
                    <div className="flex items-center bg-white border border-stone-200 rounded-xl px-2 py-1.5 shrink-0" title="Ek Ücret (+₺, 0 = Dahil)">
                      <span className="text-[10px] font-bold text-stone-400 mr-0.5">+₺</span>
                      <input
                        type="number"
                        min={0}
                        max={500}
                        value={newTierDrinkPrice[tier.key] ?? '0'}
                        onChange={(e) =>
                          setNewTierDrinkPrice((prev) => ({ ...prev, [tier.key]: e.target.value }))
                        }
                        className="w-10 text-xs font-bold text-stone-900 focus:outline-none text-right"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={saving || !(newTierDrinkInput[tier.key] || '').trim()}
                      className="bg-stone-900 hover:bg-black text-white text-xs font-bold px-3 py-1.5 rounded-xl cursor-pointer disabled:opacity-40 shrink-0"
                    >
                      + Ekle
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL 1: SOS EKLE / DÜZENLE */}
      {isAddSauceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl relative space-y-4 my-auto max-h-[92vh] overflow-y-auto overscroll-contain">
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
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl relative space-y-4 my-auto max-h-[92vh] overflow-y-auto overscroll-contain">
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

