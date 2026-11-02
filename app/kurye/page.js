'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';

// Status colors and badges for courier
const COURIER_STATUS_CONFIG = {
  'Hazır': {
    label: 'Paket Hazır (Mutfakta)',
    badgeBg: 'bg-purple-100 text-purple-800 border-purple-300',
    dot: 'bg-purple-600 animate-pulse',
    cardBorder: 'border-purple-300 border-l-4 border-l-purple-600',
  },
  'Kurye Teslim Aldı': {
    label: 'Paketi Aldım',
    badgeBg: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    dot: 'bg-indigo-600',
    cardBorder: 'border-indigo-300 border-l-4 border-l-indigo-600',
  },
  'Yolda': {
    label: 'Müşteriye Gidiyorum',
    badgeBg: 'bg-sky-100 text-sky-800 border-sky-300',
    dot: 'bg-sky-600 animate-ping',
    cardBorder: 'border-sky-300 border-l-4 border-l-sky-500',
  },
  'Teslim Edildi': {
    label: 'Teslim Edildi',
    badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    dot: 'bg-emerald-600',
    cardBorder: 'border-emerald-300 border-l-4 border-l-emerald-600',
  },
  'Onaylandı': {
    label: 'Mutfakta Hazırlanıyor',
    badgeBg: 'bg-amber-100 text-amber-800 border-amber-300',
    dot: 'bg-amber-600',
    cardBorder: 'border-amber-300 border-l-4 border-l-amber-500',
  },
  'Hazırlanıyor': {
    label: 'Mutfakta Hazırlanıyor',
    badgeBg: 'bg-orange-100 text-orange-800 border-orange-300',
    dot: 'bg-orange-600 animate-pulse',
    cardBorder: 'border-orange-300 border-l-4 border-l-orange-500',
  },
};

// Preset courier names
const PRESET_COURIERS = [
  'Kurye 1 (Ali)',
  'Kurye 2 (Mehmet)',
  'Kurye 3 (Hasan)',
  'Dış Kurye',
];

function formatTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function formatElapsedTime(isoString) {
  if (!isoString) return '';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Az önce';
  if (diffMins < 60) return `${diffMins} dk önce`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} sa önce`;
  return `${Math.floor(diffHours / 24)} gün önce`;
}

export default function CourierPortalPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCourier, setActiveCourier] = useState('');
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'completed' | 'all'
  const [updatingId, setUpdatingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const prevCountRef = useRef(0);

  // Load saved courier from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sd_active_courier');
      if (saved) {
        setActiveCourier(saved);
      } else {
        setActiveCourier('Kurye 1 (Ali)');
      }
    } catch {}
  }, []);

  const handleCourierSelect = (name) => {
    setActiveCourier(name);
    try {
      localStorage.setItem('sd_active_courier', name);
    } catch {}
    showToast(`Aktif kurye: ${name || 'Tüm Kuryeler'}`);
  };

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Web Audio alert for new assignments
  const playAlertSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
    } catch {}
  }, [soundEnabled]);

  // Fetch orders from API
  const fetchOrders = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const res = await fetch('/api/orders');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setOrders(json.data);
        // Play sound if new active order assigned
        if (!isInitial && json.data.length > prevCountRef.current) {
          playAlertSound();
        }
        prevCountRef.current = json.data.length;
      }
    } catch (err) {
      console.error('Siparişler yüklenemedi:', err);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [playAlertSound]);

  // Initial fetch and auto-refresh every 15 seconds
  useEffect(() => {
    fetchOrders(true);
    const interval = setInterval(() => {
      fetchOrders(false);
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Update order status action
  const handleUpdateStatus = async (orderId, newStatus, action = null) => {
    setUpdatingId(orderId);
    try {
      const payload = action === 'courier_deliver'
        ? { action: 'courier_deliver', courierName: activeCourier || 'Kurye' }
        : { status: newStatus, courierName: activeCourier || undefined, user: activeCourier || 'Kurye' };

      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (json.success) {
        showToast(
          action === 'courier_deliver'
            ? 'Sipariş teslim edildi ve tahsilat tamamlandı! 🎉'
            : `Sipariş durumu "${newStatus}" yapıldı.`
        );
        // Update local state immediately
        setOrders((prev) =>
          prev.map((o) => {
            if (o.id === orderId) {
              if (action === 'courier_deliver') {
                return {
                  ...o,
                  status: 'Teslim Edildi',
                  paymentStatus: 'Ödendi',
                  deliveredBy: activeCourier || o.courierName,
                  deliveredAt: new Date().toISOString(),
                };
              }
              return {
                ...o,
                status: newStatus,
                courierName: activeCourier || o.courierName,
              };
            }
            return o;
          })
        );
        // Notify admin panel
        if (typeof window !== 'undefined') {
          localStorage.setItem('sandwich_orders_updated', String(Date.now()));
        }
      } else {
        showToast(json.error || 'İşlem gerçekleştirilemedi.', 'error');
      }
    } catch {
      showToast('Bağlantı hatası oluştu.', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  // Self assign courier to an unassigned order
  const handleClaimOrder = async (orderId) => {
    if (!activeCourier) {
      showToast('Lütfen önce yukarıdan adınızı seçin.', 'error');
      return;
    }
    setUpdatingId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courierName: activeCourier, user: activeCourier }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(`Siparişi üzerinize aldınız (${activeCourier}) 👍`);
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, courierName: activeCourier } : o))
        );
      }
    } catch {
      showToast('Atama başarısız oldu.', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  // Filter orders according to selected courier and tab
  const { activeOrders, completedOrders, unassignedReadyOrders, stats } = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);

    // Filter by courier if specific courier selected
    const matchesCourier = (o) => {
      if (!activeCourier || activeCourier === 'all') return true;
      return (o.courierName || '').toLowerCase().trim() === activeCourier.toLowerCase().trim();
    };

    // Active courier deliveries: Hazır, Kurye Teslim Aldı, Yolda, Hazırlanıyor
    const active = orders.filter((o) => {
      const isAssigned = matchesCourier(o);
      const isDeliveryStage =
        o.status === 'Kurye Teslim Aldı' ||
        o.status === 'Yolda' ||
        (o.status === 'Hazır' && isAssigned) ||
        (o.status === 'Hazırlanıyor' && isAssigned);
      return isAssigned && isDeliveryStage;
    });

    // Completed today by this courier
    const completed = orders.filter((o) => {
      const isAssigned = matchesCourier(o) || (o.deliveredBy || '').toLowerCase() === (activeCourier || '').toLowerCase();
      const isDelivered = o.status === 'Teslim Edildi';
      const isToday = (o.deliveredAt || o.createdAt || '').slice(0, 10) === today;
      return isAssigned && isDelivered && isToday;
    });

    // Unassigned ready orders in kitchen
    const unassignedReady = orders.filter(
      (o) => (o.status === 'Hazır' || o.status === 'Hazırlanıyor') && !o.courierName
    );

    // Daily revenue collected by this courier (cash + card)
    const totalCash = completed
      .filter((o) => (o.paymentMethod || '').toLowerCase().includes('nakit'))
      .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    const totalCard = completed
      .filter((o) => (o.paymentMethod || '').toLowerCase().includes('kart') || (o.paymentMethod || '').toLowerCase().includes('pos'))
      .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    const totalRevenue = completed.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    return {
      activeOrders: active,
      completedOrders: completed,
      unassignedReadyOrders: unassignedReady,
      stats: {
        activeCount: active.length,
        completedCount: completed.length,
        unassignedCount: unassignedReady.length,
        totalCash,
        totalCard,
        totalRevenue,
      },
    };
  }, [orders, activeCourier]);

  // Current display list based on active tab
  const displayOrders = useMemo(() => {
    if (activeTab === 'completed') return completedOrders;
    if (activeTab === 'unassigned') return unassignedReadyOrders;
    return activeOrders;
  }, [activeTab, activeOrders, completedOrders, unassignedReadyOrders]);

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 font-poppins pb-24 selection:bg-brand-500 selection:text-white">
      {/* 1. STICKY TOP APP BAR */}
      <header className="sticky top-0 z-30 bg-stone-900 text-white shadow-md border-b border-stone-800">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          {/* Logo & Portal Adı */}
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-amber-500 text-white flex items-center justify-center font-black text-sm shadow-md shrink-0">
              <i className="fa-solid fa-motorcycle text-lg"></i>
            </span>
            <div className="min-w-0">
              <h1 className="font-extrabold text-sm sm:text-base leading-tight truncate">
                Sandviç Diyarı
              </h1>
              <span className="text-[11px] text-amber-400 font-bold block truncate">
                Kurye Teslimat Portalı
              </span>
            </div>
          </div>

          {/* Hızlı Butonlar: Ses, Yenile, Admin Girişi */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSoundEnabled((prev) => !prev)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs transition-colors cursor-pointer border ${
                soundEnabled
                  ? 'bg-stone-800 text-yellow-400 border-stone-700'
                  : 'bg-stone-800/50 text-stone-500 border-stone-700'
              }`}
              title={soundEnabled ? 'Sesli Uyarı Açık' : 'Sesli Uyarı Kapalı'}
            >
              <i className={`fa-solid ${soundEnabled ? 'fa-volume-high' : 'fa-volume-xmark'}`}></i>
            </button>

            <button
              type="button"
              onClick={() => fetchOrders(false)}
              className="bg-brand-600 hover:bg-brand-500 active:scale-95 text-white font-bold text-xs px-3 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
              title="Siparişleri Şimdi Yenile"
            >
              <i className={`fa-solid fa-rotate-right text-xs ${loading ? 'animate-spin' : ''}`}></i>
              <span className="hidden sm:inline">Yenile</span>
            </button>

            <a
              href="/admin"
              className="bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs px-2.5 py-2 rounded-xl transition-colors"
              title="Yönetim Paneline Geç"
            >
              <i className="fa-solid fa-shield-halved"></i>
            </a>
          </div>
        </div>

        {/* 2. AKTİF KURYE SEÇİM BARI */}
        <div className="bg-stone-800/90 px-4 py-2 border-t border-stone-700/60">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
                <i className="fa-solid fa-user-astronaut text-brand-400"></i>
                Kurye:
              </span>
              <select
                value={activeCourier}
                onChange={(e) => handleCourierSelect(e.target.value)}
                className="bg-stone-900 border border-stone-700 text-white font-bold text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-brand-500 cursor-pointer w-full max-w-xs shadow-inner"
              >
                <option value="all">👥 Tüm Kuryeler (Ortak Ekran)</option>
                {PRESET_COURIERS.map((c) => (
                  <option key={c} value={c}>
                    🛵 {c}
                  </option>
                ))}
              </select>
            </div>

            {stats.activeCount > 0 && (
              <span className="bg-red-500 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full animate-pulse shrink-0">
                {stats.activeCount} Aktif Paket
              </span>
            )}
          </div>
        </div>
      </header>

      {/* 3. ANA GÖVDE VE İÇERİK ALANI */}
      <main className="max-w-3xl mx-auto px-3 sm:px-4 pt-4 space-y-4">
        {/* 3.1. BUGÜNKÜ PERFORMANS VE TAHSİLAT KARTLARI */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          <div className="bg-white p-3 rounded-2xl border border-stone-200/90 shadow-xs text-center">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 block">
              Aktif Teslimat
            </span>
            <span className={`text-xl sm:text-2xl font-black block mt-0.5 ${stats.activeCount > 0 ? 'text-brand-600 animate-pulse' : 'text-stone-800'}`}>
              {stats.activeCount}
            </span>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-stone-200/90 shadow-xs text-center">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 block">
              Bugün Teslim
            </span>
            <span className="text-xl sm:text-2xl font-black text-emerald-600 block mt-0.5">
              {stats.completedCount}
            </span>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-stone-200/90 shadow-xs text-center">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 block">
              Tahsil Edilen
            </span>
            <span className="text-base sm:text-xl font-black text-stone-900 block mt-1 truncate">
              ₺{stats.totalRevenue.toFixed(0)}
            </span>
          </div>
        </div>

        {/* 3.2. SEKMELER (AKTİF SİPARİŞLER / MUTFAKTA BOŞTAKİLER / TAMAMLANANLAR) */}
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-2xl border border-stone-200 shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'active'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <i className="fa-solid fa-box-open text-xs"></i>
            <span>Üzerimdekiler</span>
            {stats.activeCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${activeTab === 'active' ? 'bg-brand-500 text-white' : 'bg-red-500 text-white'}`}>
                {stats.activeCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('unassigned')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'unassigned'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <i className="fa-solid fa-fire-burner text-xs"></i>
            <span>Mutfakta Hazır</span>
            {stats.unassignedCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${activeTab === 'unassigned' ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-800'}`}>
                {stats.unassignedCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('completed')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'completed'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <i className="fa-solid fa-circle-check text-xs"></i>
            <span>Teslim Edilen</span>
            <span className="text-[10px] text-stone-400">({stats.completedCount})</span>
          </button>
        </div>

        {/* 3.3. SİPARİŞ LİSTESİ */}
        {loading && orders.length === 0 ? (
          <div className="bg-white rounded-3xl border border-stone-200 p-12 text-center space-y-3 shadow-xs">
            <i className="fa-solid fa-motorcycle text-3xl text-brand-500 animate-bounce"></i>
            <p className="font-bold text-stone-800 text-sm">Siparişler Yükleniyor...</p>
          </div>
        ) : displayOrders.length === 0 ? (
          <div className="bg-white rounded-3xl border border-stone-200 p-10 sm:p-14 text-center space-y-3 shadow-xs">
            <span className="w-16 h-16 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center text-2xl mx-auto">
              <i className="fa-solid fa-mug-hot"></i>
            </span>
            <div className="space-y-1">
              <h3 className="font-extrabold text-stone-800 text-base">
                {activeTab === 'active'
                  ? 'Şu an üzerinizde bekleyen paket bulunmuyor.'
                  : activeTab === 'unassigned'
                  ? 'Mutfakta sahipsiz bekleyen hazır paket yok.'
                  : 'Bugün henüz teslim edilmiş siparişiniz bulunmuyor.'}
              </h3>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                {activeTab === 'active'
                  ? 'Mutfaktan yeni bir paket atandığında anında bu ekrana düşecektir.'
                  : 'Yeni siparişler için sayfayı açık tutun veya yenileyin.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3.5">
            {displayOrders.map((order) => {
              const statusCfg = COURIER_STATUS_CONFIG[order.status] || {
                label: order.status || 'Sipariş',
                badgeBg: 'bg-stone-100 text-stone-700 border-stone-300',
                dot: 'bg-stone-500',
                cardBorder: 'border-stone-200',
              };

              const isUpdating = updatingId === order.id;
              const isDelivered = order.status === 'Teslim Edildi';
              const isPickedUp = order.status === 'Kurye Teslim Aldı' || order.status === 'Yolda';
              const isReady = order.status === 'Hazır';

              const phoneClean = String(order.customerPhone || order.phone || '').replace(/\D/g, '');
              const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                (order.customerAddress || order.address || '') + ' Torbalı İzmir'
              )}`;

              const isCash = (order.paymentMethod || '').toLowerCase().includes('nakit');
              const isCard = (order.paymentMethod || '').toLowerCase().includes('kart') || (order.paymentMethod || '').toLowerCase().includes('pos');
              const isOnline = (order.paymentMethod || '').toLowerCase().includes('online');

              return (
                <div
                  key={order.id}
                  className={`bg-white rounded-2xl sm:rounded-3xl border ${statusCfg.cardBorder} shadow-sm hover:shadow-md transition-all overflow-hidden p-4 sm:p-5 space-y-4`}
                >
                  {/* Kart Üst Başlık: Sipariş No, Saat, Durum */}
                  <div className="flex items-center justify-between gap-2 border-b border-stone-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm sm:text-base text-stone-900 tracking-tight">
                        #{order.orderNumber || order.id}
                      </span>
                      <span className="text-[11px] font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-lg">
                        {formatTime(order.createdAt)} ({formatElapsedTime(order.createdAt)})
                      </span>
                    </div>

                    {/* Durum Rozeti */}
                    <span
                      className={`text-[11px] font-extrabold px-2.5 py-1 rounded-xl border flex items-center gap-1.5 ${statusCfg.badgeBg}`}
                    >
                      <span className={`w-2 h-2 rounded-full ${statusCfg.dot}`}></span>
                      <span>{statusCfg.label}</span>
                    </span>
                  </div>

                  {/* Müşteri ve Adres Bloğu (Kurye İçin En Kritik Alan!) */}
                  <div className="space-y-2.5">
                    {/* Müşteri Adı ve Telefonu */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="text-[10px] font-extrabold text-stone-400 uppercase tracking-wider block">
                          Müşteri
                        </span>
                        <h4 className="font-extrabold text-stone-900 text-sm sm:text-base truncate">
                          {order.customerName || order.name || 'İsimsiz Müşteri'}
                        </h4>
                      </div>

                      {/* Tek Tıkla Telefon Araması */}
                      {phoneClean && (
                        <a
                          href={`tel:${phoneClean}`}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all shrink-0 cursor-pointer"
                        >
                          <i className="fa-solid fa-phone text-xs"></i>
                          <span>Ara ({order.customerPhone || order.phone})</span>
                        </a>
                      )}
                    </div>

                    {/* Teslimat Adresi ve Haritada Aç Butonu */}
                    <div className="bg-stone-50 p-3 rounded-xl border border-stone-200/80 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 space-y-0.5">
                          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                            Teslimat Adresi
                          </span>
                          <p className="text-xs sm:text-sm font-bold text-stone-900 leading-snug">
                            {order.customerAddress || order.address || 'Adres bilgisi girilmedi.'}
                          </p>
                        </div>

                        {/* Google Haritalar / Navigasyon Butonu */}
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all shrink-0 cursor-pointer"
                        >
                          <i className="fa-solid fa-location-arrow text-xs"></i>
                          <span className="hidden sm:inline">Navigasyon</span>
                          <span className="sm:hidden">Harita</span>
                        </a>
                      </div>

                      {/* Varsa Müşteri Notu */}
                      {(order.notes || order.orderNote) && (
                        <div className="bg-amber-50 border border-amber-200 text-amber-900 p-2 rounded-lg text-xs font-semibold flex items-start gap-1.5">
                          <i className="fa-solid fa-triangle-exclamation text-amber-600 mt-0.5 shrink-0"></i>
                          <span><strong>Müşteri Notu:</strong> {order.notes || order.orderNote}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Ödeme Yöntemi ve Tahsil Edilecek Tutar */}
                  <div className="flex items-center justify-between gap-3 bg-stone-900 text-white p-3 sm:p-3.5 rounded-xl">
                    <div>
                      <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                        Ödeme & Tahsilat
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-bold">
                          {order.paymentMethod || 'Kapıda Nakit'}
                        </span>
                        {isCash && (
                          <span className="bg-amber-500 text-stone-900 text-[10px] font-black px-2 py-0.5 rounded-md uppercase">
                            Nakit Al
                          </span>
                        )}
                        {isCard && (
                          <span className="bg-sky-500 text-white text-[10px] font-black px-2 py-0.5 rounded-md uppercase">
                            POS Çek
                          </span>
                        )}
                        {isOnline && (
                          <span className="bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-md uppercase">
                            Ödendi
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                        Toplam Tutar
                      </span>
                      <span className="text-lg sm:text-xl font-black text-amber-400 block leading-tight">
                        ₺{(Number(order.total) || Number(order.subtotal) || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Sipariş Kalemleri Özeti (Kurye Çantayı Kontrol Etsin Diye) */}
                  {order.items && Array.isArray(order.items) && (
                    <div className="pt-2 border-t border-stone-100">
                      <span className="text-[10px] font-extrabold text-stone-400 uppercase tracking-wider block mb-1">
                        Paket İçeriği ({order.items.length} Kalem)
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {order.items.map((item, idx) => (
                          <span
                            key={idx}
                            className="bg-stone-100 text-stone-800 text-xs font-semibold px-2.5 py-1 rounded-lg border border-stone-200/80"
                          >
                            <strong className="text-brand-600 mr-1">{item.quantity || 1}x</strong>
                            {item.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Kurye Bilgisi */}
                  <div className="flex items-center justify-between text-xs text-stone-500 pt-1">
                    <span>
                      Atanan Kurye:{' '}
                      <strong className="text-stone-800 font-bold">
                        {order.courierName || 'Henüz Atanmadı'}
                      </strong>
                    </span>
                    {order.deliveredAt && (
                      <span className="text-emerald-700 font-bold">
                        Teslim: {formatTime(order.deliveredAt)}
                      </span>
                    )}
                  </div>

                  {/* 4. KURYE AKSİYON BUTONLARI (BÜYÜK DOKUNMATİK TUŞLAR) */}
                  <div className="pt-2 border-t border-stone-100 space-y-2">
                    {/* A) Sahipsiz Hazır Siparişi Üzerine Al */}
                    {!order.courierName && !isDelivered && (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleClaimOrder(order.id)}
                        className="w-full bg-stone-900 hover:bg-stone-800 active:scale-98 text-white font-black py-3 rounded-xl text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <i className="fa-solid fa-hand-holding-hand text-amber-400"></i>
                        <span>Bu Siparişi Üzerime Al ({activeCourier || 'Kurye'})</span>
                      </button>
                    )}

                    {/* B) Paketi Mutfaktan Aldım (Kurye Teslim Aldı) */}
                    {(isReady || order.status === 'Onaylandı' || order.status === 'Hazırlanıyor') && !isDelivered && (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleUpdateStatus(order.id, 'Kurye Teslim Aldı')}
                        className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:scale-98 text-white font-black py-3.5 rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <i className="fa-solid fa-box text-base text-yellow-300"></i>
                        <span>
                          {isUpdating ? 'Güncelleniyor...' : '1. Paketi Mutfaktan Teslim Aldım'}
                        </span>
                      </button>
                    )}

                    {/* C) Yola Çıktım (Müşteriye Gidiyorum) */}
                    {order.status === 'Kurye Teslim Aldı' && (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleUpdateStatus(order.id, 'Yolda')}
                        className="w-full bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 active:scale-98 text-white font-black py-3.5 rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <i className="fa-solid fa-motorcycle text-base text-white animate-bounce"></i>
                        <span>
                          {isUpdating ? 'Güncelleniyor...' : '2. Yola Çıktım (Müşteriye Gidiyorum)'}
                        </span>
                      </button>
                    )}

                    {/* D) Müşteriye Teslim Ettim (Teslimat & Tahsilat Onayı) */}
                    {isPickedUp && (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => {
                          if (confirm(`#${order.orderNumber || order.id} numaralı siparişi müşteriye teslim edip tutarı tahsil ettiniz mi?`)) {
                            handleUpdateStatus(order.id, 'Teslim Edildi', 'courier_deliver');
                          }
                        }}
                        className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 active:scale-98 text-white font-black py-4 rounded-xl text-sm sm:text-base transition-all shadow-lg shadow-emerald-950/20 flex items-center justify-center gap-2.5 cursor-pointer ring-2 ring-emerald-400"
                      >
                        <i className="fa-solid fa-circle-check text-lg"></i>
                        <span>
                          {isUpdating ? 'İşleniyor...' : '✅ Müşteriye Teslim Ettim (Tamamla)'}
                        </span>
                      </button>
                    )}

                    {/* E) Teslim Edildiyse Başarı Bildirimi */}
                    {isDelivered && (
                      <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-3 rounded-xl text-xs font-bold text-center flex items-center justify-center gap-2">
                        <i className="fa-solid fa-circle-check text-emerald-600 text-sm"></i>
                        <span>Bu sipariş başarıyla teslim edildi ve kapatıldı.</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 5. TOAST POPUP (MOBİLDE ALTTAN ÇIKAN BİLDİRİM BALONU) */}
      {toast && (
        <div className="fixed bottom-4 inset-x-4 max-w-sm mx-auto z-50 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl text-xs font-bold border ${
              toast.type === 'error'
                ? 'bg-rose-900 text-white border-rose-700'
                : 'bg-stone-900 text-white border-stone-700'
            }`}
          >
            <i
              className={`text-sm ${
                toast.type === 'error'
                  ? 'fa-solid fa-circle-exclamation text-rose-300'
                  : 'fa-solid fa-circle-check text-emerald-300'
              }`}
            ></i>
            <span className="flex-1">{toast.msg}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-stone-400 hover:text-white"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
