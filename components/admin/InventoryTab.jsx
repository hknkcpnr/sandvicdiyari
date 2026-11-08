'use client';

import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { setProducts } from '@/store/slices/productSlice';
import { showMessageModal } from '@/store/slices/uiSlice';

export default function InventoryTab({ products = [], onRefreshProducts }) {
  const dispatch = useDispatch();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'in_stock' | 'low_stock' | 'out_of_stock'
  const [addAmounts, setAddAmounts] = useState({});

  // Summary counts
  const [summary, setSummary] = useState({
    total: 0,
    inStock: 0,
    lowStock: 0,
    outOfStock: 0,
    activeCount: 0,
    closedCount: 0,
  });

  // Fetch inventory (products with stock & status)
  const fetchInventory = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/inventory');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setItems(json.data);
        if (json.summary) setSummary(json.summary);
      }
    } catch (err) {
      console.error('Stok bilgileri alınamadı:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  // Sync to customer window & Redux
  const triggerSync = (updatedProducts) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('sandwich_inventory_updated', Date.now().toString());
      } catch (e) {}
    }
    if (updatedProducts && Array.isArray(updatedProducts)) {
      dispatch(setProducts(updatedProducts));
    }
    if (onRefreshProducts) onRefreshProducts();
  };

  // 1. One-click Toggle Availability (Satışta / Tükendi)
  const handleToggleAvailability = async (product) => {
    const newAvailable = !(product.isAvailable !== false);
    setUpdatingId(product.id);
    try {
      const res = await fetch('/api/inventory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: product.id,
          isAvailable: newAvailable,
          // if opening an item with 0 stock, give it 15 stock automatically
          ...(newAvailable && (Number(product.stock) <= 0) ? { stock: 15 } : {})
        }),
      });

      const json = await res.json();
      if (json.success) {
        triggerSync(json.products);
        fetchInventory();
        dispatch(
          showMessageModal({
            title: newAvailable ? 'Satışa Açıldı 🟢' : 'Siparişe Kapatıldı 🔴',
            text: `"${product.name}" müşteriler için ${newAvailable ? 'satışa açıldı' : 'tükendi olarak işaretlendi'}.`,
            type: newAvailable ? 'success' : 'info',
          })
        );
      } else {
        alert(json.error || 'İşlem başarısız oldu.');
      }
    } catch (err) {
      console.error('Stok aç/kapa hatası:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  // 2. Adjust Stock (+/- delta or set direct number)
  const handleStockUpdate = async (id, delta, directStock = null) => {
    setUpdatingId(id);
    try {
      const payload = { id };
      if (directStock !== null) {
        payload.stock = Math.max(0, Number(directStock) || 0);
      } else {
        payload.delta = delta;
      }

      const res = await fetch('/api/inventory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        triggerSync(json.products);
        fetchInventory();
      } else {
        alert(json.error || 'Stok güncellenemedi.');
      }
    } catch (err) {
      console.error('Stok güncelleme hatası:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  // 3. Toggle Sınırsız / Adetli Takip
  const handleToggleTrackStock = async (product) => {
    const isCurrentlyTracked = product.trackStock !== false;
    setUpdatingId(product.id);
    try {
      const res = await fetch('/api/inventory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: product.id,
          trackStock: !isCurrentlyTracked,
          stock: !isCurrentlyTracked ? 25 : null,
          isAvailable: true,
        }),
      });
      const json = await res.json();
      if (json.success) {
        triggerSync(json.products);
        fetchInventory();
      }
    } catch (err) {
      console.error('Takip türü değiştirilemedi:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  // 4. Bulk Actions (Tümünü Satışa Aç, Hepsine +20 Ekle, vb.)
  const handleBulkAction = async (action, amount = 20) => {
    const actionNames = {
      set_all_available: 'Tüm ürünler satışa açılacak',
      refill_all: 'Tüm ürünlerin stoğuna +20 eklenecek',
      reset_all: 'Tüm ürünler 25 adet olarak sıfırlanacak',
    };

    if (!confirm(`${actionNames[action] || 'Toplu işlem'} emin misiniz?`)) return;

    try {
      setLoading(true);
      const res = await fetch('/api/inventory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bulkAction: action, amount }),
      });
      const json = await res.json();
      if (json.success) {
        triggerSync(json.products);
        fetchInventory();
        dispatch(
          showMessageModal({
            title: 'Toplu İşlem Tamamlandı',
            text: json.message || 'Ürün stokları toplu olarak güncellendi.',
            type: 'success',
          })
        );
      } else {
        alert(json.error || 'Toplu işlem başarısız oldu.');
      }
    } catch (err) {
      console.error('Toplu işlem hatası:', err);
    } finally {
      setLoading(false);
    }
  };

  // Stok ekleme ve çıkarma: yazılan adet (boşsa 1) mevcut stoğa eklenir veya düşülür
  const handleAddAmountChange = (id, val) => {
    setAddAmounts((prev) => ({ ...prev, [id]: val }));
  };

  const handleAddStock = async (id) => {
    const raw = addAmounts[id];
    const amount = raw ? Math.floor(Number(raw)) : 1;
    if (!amount || amount <= 0) return;
    await handleStockUpdate(id, amount);
    setAddAmounts((prev) => ({ ...prev, [id]: '' }));
  };

  const handleRemoveStock = async (id) => {
    const raw = addAmounts[id];
    const amount = raw ? Math.floor(Number(raw)) : 1;
    if (!amount || amount <= 0) return;
    await handleStockUpdate(id, -amount);
    setAddAmounts((prev) => ({ ...prev, [id]: '' }));
  };

  // Filter items
  const filteredItems = items.filter((p) => {
    // Category filter
    if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;

    // Status filter
    if (statusFilter === 'in_stock' && p.status !== 'in_stock') return false;
    if (statusFilter === 'low_stock' && p.status !== 'low_stock') return false;
    if (statusFilter === 'out_of_stock' && p.status !== 'out_of_stock') return false;
    if (statusFilter === 'alerts' && p.status === 'in_stock') return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = p.name?.toLowerCase().includes(q);
      const matchCat = p.category?.toLowerCase().includes(q);
      const matchBadge = p.badge?.toLowerCase().includes(q);
      if (!matchName && !matchCat && !matchBadge) return false;
    }

    return true;
  });

  const categories = [
    { id: 'all', label: 'Tüm Kategoriler' },
    { id: 'menu', label: '🍱 Menüler' },
    { id: 'sandwich', label: '🥪 Sandviçler' },
    { id: 'snack', label: '🍟 Atıştırmalıklar' },
    { id: 'drink', label: '🥤 İçecekler' },
  ];

  return (
    <div className="p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 w-full min-w-0 font-poppins">
      {/* 1. BAŞLIK VE HIZLI EYLEMLER (Sade & Doğal) */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-stone-900 truncate">
              Stok &amp; Satış Yönetimi
            </h2>
            {summary.closedCount > 0 ? (
              <span className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full shrink-0">
                {summary.closedCount} Ürün Tükendi
              </span>
            ) : (
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full shrink-0">
                Tüm Ürünler Satışta
              </span>
            )}
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            Ürün stok durumlarını inceleyebilir, satışa açma/kapatma işlemlerini yönetebilirsiniz.
          </p>
        </div>

        {/* Quick Bulk Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => handleBulkAction('set_all_available')}
            className="bg-stone-900 hover:bg-stone-800 text-white font-medium px-3.5 py-2 rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-2xs"
            title="Tüm ürünleri satışa açar"
          >
            <i className="fa-solid fa-circle-check text-emerald-400"></i>
            <span>Tümünü Aç</span>
          </button>
          <button
            type="button"
            onClick={() => handleBulkAction('refill_all', 20)}
            className="bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium px-3.5 py-2 rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1.5 border border-stone-200 active:scale-95"
            title="Tüm ürünlerin stoğuna +20 adet ekler"
          >
            <i className="fa-solid fa-plus text-stone-500"></i>
            <span>Hepsine +20</span>
          </button>
          <button
            type="button"
            onClick={fetchInventory}
            className="w-8 h-8 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 border border-stone-200 flex items-center justify-center text-xs transition-colors cursor-pointer"
            title="Listeyi Yenile"
          >
            <i className={`fa-solid fa-rotate-right ${loading ? 'fa-spin text-stone-900' : ''}`}></i>
          </button>
        </div>
      </div>

      {/* 2. KPI METRICS (4 SADE KART) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Toplam Ürün */}
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Toplam Menü / Ürün</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-stone-100 flex items-center justify-center text-stone-700 text-xs font-bold">
              <i className="fa-solid fa-burger"></i>
            </div>
          </div>
          <div className="mt-2.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-3xl font-black text-stone-900">{summary.total}</span>
              <span className="text-xs text-stone-500 font-medium">Çeşit</span>
            </div>
            <span className="text-[10px] sm:text-[11px] text-stone-400 block mt-0.5">Kayıtlı ürün sayısı</span>
          </div>
        </div>

        {/* Satışta Olanlar */}
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Satışta Açık</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs font-bold">
              <i className="fa-solid fa-circle-check"></i>
            </div>
          </div>
          <div className="mt-2.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-3xl font-black text-emerald-600">{summary.inStock}</span>
              <span className="text-xs text-emerald-600 font-medium">Ürün</span>
            </div>
            <span className="text-[10px] sm:text-[11px] text-stone-400 block mt-0.5">Sipariş verilebilir</span>
          </div>
        </div>

        {/* Kritik Seviye */}
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Kritik Seviye</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xs font-bold">
              <i className="fa-solid fa-triangle-exclamation"></i>
            </div>
          </div>
          <div className="mt-2.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-3xl font-black text-amber-600">{summary.lowStock}</span>
              <span className="text-xs text-amber-600 font-medium">Ürün</span>
            </div>
            <span className="text-[10px] sm:text-[11px] text-stone-400 block mt-0.5">&le; 5 adet kalanlar</span>
          </div>
        </div>

        {/* Tükendi / Kapalı */}
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Tükendi / Kapalı</span>
            <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center text-xs font-bold ${
              summary.outOfStock > 0 ? 'bg-rose-100 text-rose-600 animate-pulse' : 'bg-stone-100 text-stone-500'
            }`}>
              <i className="fa-solid fa-ban"></i>
            </div>
          </div>
          <div className="mt-2.5">
            <div className="flex items-baseline gap-1.5">
              <span className={`text-xl sm:text-3xl font-black ${
                summary.outOfStock > 0 ? 'text-rose-600' : 'text-stone-900'
              }`}>
                {summary.outOfStock}
              </span>
              <span className="text-xs text-rose-600 font-medium">Ürün</span>
            </div>
            <span className="text-[10px] sm:text-[11px] text-stone-400 block mt-0.5">Siparişe kapalı olanlar</span>
          </div>
        </div>
      </div>

      {/* 3. FILTERS & SEARCH */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-stone-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs"></i>
            <input
              type="text"
              placeholder="Ürün adı veya etiket ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-stone-400 font-medium text-stone-800"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs cursor-pointer"
              >
                <i className="fa-solid fa-circle-xmark"></i>
              </button>
            )}
          </div>

          {/* Status Filter Buttons (Mobile Select / Desktop Pills) */}
          <div className="w-full md:w-auto">
            <div className="sm:hidden w-full">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="app-select w-full bg-stone-50 hover:bg-white border border-stone-300 hover:border-brand-500 text-stone-900 text-xs font-bold rounded-2xl px-4 py-2.5 cursor-pointer shadow-xs focus:ring-3 focus:ring-brand-500/15"
              >
                <option value="all">Tüm Durumlar</option>
                <option value="in_stock">🟢 Satışta Olanlar</option>
                <option value="low_stock">⚠️ Kritik Azalanlar ({summary.lowStock})</option>
                <option value="out_of_stock">🔴 Tükendi / Kapalı ({summary.outOfStock})</option>
              </select>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 justify-start md:justify-end overflow-x-auto no-scrollbar pb-1 md:pb-0">
              {[
                { id: 'all', label: 'Tümü' },
                { id: 'in_stock', label: '🟢 Satışta Olanlar' },
                { id: 'low_stock', label: '⚠️ Kritik Azalanlar', count: summary.lowStock },
                { id: 'out_of_stock', label: '🔴 Tükendi / Kapalı', count: summary.outOfStock },
              ].map((st) => (
                <button
                  key={st.id}
                  onClick={() => setStatusFilter(st.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
                    statusFilter === st.id
                      ? 'bg-stone-900 text-white shadow-xs'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200/80'
                  }`}
                >
                  <span>{st.label}</span>
                  {typeof st.count !== 'undefined' && st.count > 0 && (
                    <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                      {st.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Category Filter (Mobile Select / Desktop Pills) */}
        <div className="border-t border-stone-100 pt-1.5">
          <div className="sm:hidden w-full">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="app-select w-full bg-stone-50 hover:bg-white border border-stone-300 hover:border-brand-500 text-stone-900 text-xs font-bold rounded-2xl px-4 py-2.5 cursor-pointer shadow-xs focus:ring-3 focus:ring-brand-500/15"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  Kategori: {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 pt-0.5">
            <span className="text-stone-400 text-[11px] font-semibold uppercase tracking-wider mr-1 shrink-0">
              Kategori:
            </span>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategoryFilter(c.id)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  categoryFilter === c.id
                    ? 'bg-amber-500 text-stone-950 font-bold shadow-xs'
                    : 'bg-stone-50 text-stone-600 hover:bg-stone-100 border border-stone-200/60'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. PRODUCT STOCK CARDS (MİNİMAL KUTU GÖRÜNÜMÜ) */}
      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs py-14 text-center text-stone-400">
          <div className="space-y-2">
            <i className="fa-solid fa-boxes-stacked text-3xl text-stone-300"></i>
            <p className="font-semibold text-stone-500">Aramanıza uygun ürün bulunamadı.</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setCategoryFilter('all');
                setStatusFilter('all');
              }}
              className="text-xs text-brand-600 hover:underline font-bold cursor-pointer"
            >
              Filtreleri Temizle
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* MASAÜSTÜ: SATIR SATIR GÖRÜNÜM (lg ve üzeri ekranlar) */}
          <div className="hidden lg:block bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
            <div className="grid grid-cols-12 gap-3 px-5 py-3.5 bg-stone-50/90 border-b border-stone-200 text-[11px] font-bold text-stone-500 uppercase tracking-wider items-center">
              <div className="col-span-4">Ürün Bilgisi</div>
              <div className="col-span-2 text-center">Kategori & Durum</div>
              <div className="col-span-2 text-center">Mevcut Stok</div>
              <div className="col-span-2 text-center">Hızlı Stok Düzenleme</div>
              <div className="col-span-2 text-right">Satış & Takip</div>
            </div>
            <div className="divide-y divide-stone-100">
              {filteredItems.map((product) => {
                const isAvailable = product.isAvailable !== false;
                const isTracked = product.trackStock !== false;
                const stockNum = typeof product.stock === 'number' ? product.stock : 25;
                const threshold = Number(product.criticalThreshold) || 5;
                const isLow = isTracked && isAvailable && stockNum <= threshold && stockNum > 0;
                const isOut = !isAvailable || (isTracked && stockNum === 0);
                const isBusy = updatingId === product.id;

                const categoryLabel =
                  product.category === 'menu'
                    ? 'Menü'
                    : product.category === 'sandwich'
                    ? 'Sandviç'
                    : product.category === 'snack'
                    ? 'Atıştırmalık'
                    : 'İçecek';

                return (
                  <div
                    key={`desk-${product.id}`}
                    id={`inventory-row-${product.id}`}
                    className={`grid grid-cols-12 gap-3 px-5 py-3 items-center transition-colors hover:bg-stone-50/70 relative ${
                      isOut ? 'bg-rose-50/15' : isLow ? 'bg-amber-50/10' : ''
                    } ${isBusy ? 'opacity-60 pointer-events-none' : ''}`}
                  >
                    {/* 1. Ürün Bilgisi */}
                    <div className="col-span-4 flex items-center gap-3 min-w-0">
                      <div className="relative w-11 h-11 rounded-xl bg-stone-100 overflow-hidden shrink-0 border border-stone-200">
                        <img
                          src={product.image}
                          alt={product.name}
                          className={`w-full h-full object-cover ${isOut ? 'grayscale opacity-60' : ''}`}
                          onError={(e) => {
                            e.currentTarget.src =
                              'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=400';
                          }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-stone-900 text-sm truncate" title={product.name}>
                          {product.name}
                        </h3>
                        <span className="text-[11px] text-stone-400 block font-medium">
                          ₺{Number(product.price || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* 2. Kategori & Durum Rozeti */}
                    <div className="col-span-2 flex flex-col items-center justify-center gap-1">
                      <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                        {categoryLabel}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isOut
                            ? 'bg-rose-100 text-rose-700 border border-rose-200'
                            : isLow
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                        {isOut ? 'Tükendi' : isLow ? 'Kritik' : 'Satışta'}
                      </span>
                    </div>

                    {/* 3. Kalan Stok */}
                    <div className="col-span-2 text-center">
                      {isTracked ? (
                        <div className="inline-flex items-baseline gap-1">
                          <span
                            className={`text-lg font-black ${
                              isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-stone-900'
                            }`}
                          >
                            {stockNum}
                          </span>
                          <span className="text-[11px] font-medium text-stone-400">Adet</span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100 text-[11px] font-bold">
                          <i className="fa-solid fa-infinity text-[10px]"></i> Sınırsız
                        </span>
                      )}
                    </div>

                    {/* 4. Hızlı Stok Ekle/Çıkar */}
                    <div className="col-span-2 flex items-center justify-center gap-1.5">
                      {isTracked ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleRemoveStock(product.id)}
                            disabled={stockNum <= 0}
                            title="Yazılan adedi (veya 1) stoktan düşer"
                            className="w-8 h-8 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                          >
                            <i className="fa-solid fa-minus text-[10px]"></i>
                          </button>
                          <input
                            id={`stock-add-desk-${product.id}`}
                            type="number"
                            min="1"
                            step="1"
                            inputMode="numeric"
                            placeholder="1"
                            value={addAmounts[product.id] ?? ''}
                            onChange={(e) => handleAddAmountChange(product.id, e.target.value)}
                            className="w-14 h-8 px-1 text-center font-bold text-xs bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400 focus:bg-white placeholder:font-normal placeholder:text-stone-400"
                            aria-label={`${product.name} için stok miktarı`}
                          />
                          <button
                            type="button"
                            onClick={() => handleAddStock(product.id)}
                            title="Yazılan adedi (veya 1) stoğa ekler"
                            className="w-8 h-8 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer active:scale-95 shrink-0"
                          >
                            <i className="fa-solid fa-plus text-[10px]"></i>
                          </button>
                        </>
                      ) : (
                        <span className="text-[11px] text-stone-400 italic">Takip Kapalı</span>
                      )}
                    </div>

                    {/* 5. Satış Durumu & Takip Türü Aksiyonları */}
                    <div className="col-span-2 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleAvailability(product)}
                        disabled={isBusy}
                        className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                          isAvailable
                            ? 'bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200'
                            : 'bg-rose-600 hover:bg-rose-500 text-white shadow-xs'
                        }`}
                        title={isAvailable ? 'Siparişe Kapat' : 'Satışa Aç'}
                      >
                        <i className={`fa-solid ${isAvailable ? 'fa-toggle-on text-emerald-600' : 'fa-toggle-off text-white'} text-sm`}></i>
                        <span>{isAvailable ? 'Satışta' : 'Kapalı'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleTrackStock(product)}
                        className="h-8 px-2.5 text-xs font-medium text-stone-500 hover:text-stone-900 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-lg transition-colors cursor-pointer shrink-0"
                        title={isTracked ? 'Sınırsız stoğa çevir' : 'Adetli takibe çevir'}
                      >
                        <i className={`fa-solid ${isTracked ? 'fa-calculator' : 'fa-infinity'} mr-1 text-[10px]`}></i>
                        {isTracked ? 'Adetli' : 'Sınırsız'}
                      </button>
                    </div>

                    {isBusy && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                        <i className="fa-solid fa-spinner fa-spin text-stone-600 text-sm"></i>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* MOBİL & TABLET: KUTU KUTU GÖRÜNÜM (lg altı ekranlar) */}
          <div id="inventory-card-grid-mobile" className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {filteredItems.map((product) => {
              const isAvailable = product.isAvailable !== false;
              const isTracked = product.trackStock !== false;
              const stockNum = typeof product.stock === 'number' ? product.stock : 25;
              const threshold = Number(product.criticalThreshold) || 5;
              const isLow = isTracked && isAvailable && stockNum <= threshold && stockNum > 0;
              const isOut = !isAvailable || (isTracked && stockNum === 0);
              const isBusy = updatingId === product.id;

              const categoryLabel =
                product.category === 'menu'
                  ? 'Menü'
                  : product.category === 'sandwich'
                  ? 'Sandviç'
                  : product.category === 'snack'
                  ? 'Atıştırmalık'
                  : 'İçecek';

              return (
                <article
                  key={`mob-${product.id}`}
                  id={`inventory-card-mob-${product.id}`}
                  className={`group relative flex flex-col bg-white rounded-2xl border p-3.5 gap-2.5 shadow-2xs transition-all duration-150 hover:shadow-md ${
                    isOut
                      ? 'border-rose-200 bg-rose-50/10'
                      : isLow
                      ? 'border-amber-200'
                      : 'border-stone-200/90'
                  } ${isBusy ? 'opacity-60 pointer-events-none' : ''}`}
                >
                  {/* 1. Üst Başlık & Yuvarlak Görsel */}
                  <div className="flex items-center gap-3">
                    <div className="relative w-11 h-11 rounded-full bg-stone-100 overflow-hidden shrink-0 border border-stone-200">
                      <img
                        src={product.image}
                        alt={product.name}
                        className={`w-full h-full object-cover ${
                          isOut ? 'grayscale opacity-60' : ''
                        }`}
                        onError={(e) => {
                          e.currentTarget.src =
                            'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=400';
                        }}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider truncate">
                          {categoryLabel}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                            isOut
                              ? 'bg-rose-100 text-rose-700'
                              : isLow
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                          {isOut ? 'Tükendi' : isLow ? 'Kritik' : 'Satışta'}
                        </span>
                      </div>
                      <h3 className="font-bold text-stone-900 text-xs sm:text-sm truncate mt-0.5" title={product.name}>
                        {product.name}
                      </h3>
                    </div>
                  </div>

                  {/* 2. Minimal Stok Göstergesi & Ekle/Çıkar Kontrolleri */}
                  {isTracked ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-stone-50 border border-stone-100">
                        <span className="text-[11px] font-semibold text-stone-500">Kalan Stok</span>
                        <div className="flex items-baseline gap-1">
                          <span
                            className={`text-lg font-black leading-none ${
                              isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-stone-900'
                            }`}
                          >
                            {stockNum}
                          </span>
                          <span className="text-[10px] font-semibold text-stone-400">Adet</span>
                        </div>
                      </div>

                      {/* Stok Ekle & Çıkar Satırı */}
                      <div className="flex items-center gap-1.5">
                        <input
                          id={`stock-add-mob-${product.id}`}
                          type="number"
                          min="1"
                          step="1"
                          inputMode="numeric"
                          placeholder="Adet (1)"
                          value={addAmounts[product.id] ?? ''}
                          onChange={(e) => handleAddAmountChange(product.id, e.target.value)}
                          className="w-full min-w-0 h-8 px-2.5 font-semibold text-xs bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400 focus:bg-white placeholder:font-normal placeholder:text-stone-400"
                          aria-label={`${product.name} için stok miktarı`}
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveStock(product.id)}
                          disabled={stockNum <= 0}
                          title="Yazılan adedi (boşsa 1 adet) stoktan düşer"
                          className="h-8 px-2.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                        >
                          <i className="fa-solid fa-minus text-[10px]"></i>
                          <span>Çıkar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddStock(product.id)}
                          title="Yazılan adedi (boşsa 1 adet) stoğa ekler"
                          className="h-8 px-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors active:scale-95 shrink-0"
                        >
                          <i className="fa-solid fa-plus text-[10px]"></i>
                          <span>Ekle</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-blue-50/60 border border-blue-100">
                      <span className="text-[11px] font-semibold text-blue-700">Stok Takibi</span>
                      <span className="inline-flex items-center gap-1 text-blue-700 text-xs font-bold">
                        <i className="fa-solid fa-infinity text-[10px]"></i> Sınırsız
                      </span>
                    </div>
                  )}

                  {/* 3. Alt Aksiyonlar (Minimal) */}
                  <div className="mt-auto pt-2 border-t border-stone-100 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleToggleAvailability(product)}
                      disabled={isBusy}
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-lg text-[11px] font-bold transition-all cursor-pointer active:scale-95 ${
                        isAvailable
                          ? 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                          : 'bg-rose-600 hover:bg-rose-500 text-white'
                      }`}
                    >
                      <i className={`fa-solid ${isAvailable ? 'fa-toggle-on text-emerald-600' : 'fa-toggle-off text-white'} text-sm`}></i>
                      <span>{isAvailable ? 'Satışta' : 'Kapalı (Aç)'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleTrackStock(product)}
                      className="h-8 px-2.5 text-[11px] font-semibold text-stone-500 hover:text-stone-900 bg-stone-50 hover:bg-stone-100 border border-stone-200/70 rounded-lg transition-colors cursor-pointer shrink-0"
                      title={isTracked ? 'Sınırsız stoğa çevir' : 'Adetli takibe çevir'}
                    >
                      <i className={`fa-solid ${isTracked ? 'fa-calculator' : 'fa-infinity'} mr-1 text-[10px]`}></i>
                      {isTracked ? 'Adetli' : 'Sınırsız'}
                    </button>
                  </div>

                  {isBusy && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/50 rounded-2xl">
                      <i className="fa-solid fa-spinner fa-spin text-stone-500 text-base"></i>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
