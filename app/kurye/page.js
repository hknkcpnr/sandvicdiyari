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
    label: 'Paketi Teslim Aldım',
    badgeBg: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    dot: 'bg-indigo-600',
    cardBorder: 'border-indigo-300 border-l-4 border-l-indigo-600',
  },
  'Yolda': {
    label: 'Yoldayım (Müşteriye Gidiyorum)',
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
    label: 'Mutfakta Sıraya Alındı',
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

const ETA_PRESETS = ['10 dk', '15 dk', '20 dk', '25 dk', '30 dk', '40 dk'];

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
  // Session State
  const [courierUser, setCourierUser] = useState(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // Login Form State
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Portal State
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'unassigned' | 'completed'
  const [updatingId, setUpdatingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [etaInputs, setEtaInputs] = useState({}); // { [orderId]: '15 dk' }
  const prevCountRef = useRef(0);

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
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
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
    } catch {}
  }, [soundEnabled]);

  // Check saved session on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sd_courier_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.name) {
          setCourierUser(parsed);
        }
      }
    } catch (e) {
      console.warn('Session load error:', e);
    } finally {
      setIsCheckingSession(false);
    }
  }, []);

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

  // Auto-refresh orders every 10 seconds while logged in
  useEffect(() => {
    if (!courierUser) return;
    fetchOrders(true);
    const interval = setInterval(() => {
      fetchOrders(false);
    }, 10000);
    return () => clearInterval(interval);
  }, [courierUser, fetchOrders]);

  // Handle Courier Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    const id = loginIdentifier.trim();
    const pass = loginPass.trim();

    if (!id || !pass) {
      setLoginError('Lütfen kullanıcı adı / telefon ve şifrenizi girin.');
      return;
    }

    setLoginLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: id, pass }),
      });
      const json = await res.json();

      if (!json.success || !json.data?.admin) {
        setLoginError(json.error || 'Giriş başarısız. Kullanıcı adı veya şifre hatalı.');
        return;
      }

      const admin = json.data.admin;

      // Check if user has courier permission or is staff/admin
      const isCourier =
        admin.roleId === 'role_courier' ||
        (admin.role && admin.role.toLowerCase().includes('kurye')) ||
        (admin.permissions && Array.isArray(admin.permissions) && admin.permissions.includes('courier_delivery')) ||
        admin.roleId === 'role_super_admin' ||
        (admin.permissions && admin.permissions.includes('orders'));

      if (!isCourier) {
        setLoginError('Bu hesap kurye yetkisine sahip değil. Lütfen şube yöneticinize başvurun.');
        return;
      }

      const sessionData = {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone || '',
        role: admin.role,
        roleId: admin.roleId,
        token: json.data.token,
      };

      localStorage.setItem('sd_courier_session', JSON.stringify(sessionData));
      setCourierUser(sessionData);
      showToast(`Hoş geldiniz, ${admin.name}! 🛵`);
    } catch (err) {
      setLoginError('Sunucu bağlantı hatası oluştu. Lütfen tekrar deneyin.');
    } finally {
      setLoginLoading(false);
    }
  };

  // Handle Logout
  const handleLogout = () => {
    if (confirm('Kurye oturumunuzu kapatmak istediğinize emin misiniz?')) {
      try {
        localStorage.removeItem('sd_courier_session');
      } catch {}
      setCourierUser(null);
      setOrders([]);
      showToast('Oturum kapatıldı.');
    }
  };

  // Update order status action
  const handleUpdateStatus = async (orderId, newStatus, action = null) => {
    setUpdatingId(orderId);
    const courierName = courierUser?.name || 'Kurye';
    try {
      const payload =
        action === 'courier_deliver'
          ? { action: 'courier_deliver', courierName }
          : { status: newStatus, courierName, user: courierName };

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
                  deliveredBy: courierName,
                  deliveredAt: new Date().toISOString(),
                };
              }
              return {
                ...o,
                status: newStatus,
                courierName,
              };
            }
            return o;
          })
        );
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

  // Self assign order to this logged-in courier
  const handleClaimOrder = async (orderId) => {
    if (!courierUser) return;
    setUpdatingId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign_courier',
          courierName: courierUser.name,
          user: courierUser.name,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(`Sipariş üzerinize alındı (${courierUser.name}) 👍`);
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, courierName: courierUser.name } : o))
        );
      } else {
        showToast(json.error || 'Atama başarısız oldu.', 'error');
      }
    } catch {
      showToast('Atama başarısız oldu.', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  // Set Estimated Arrival Time (ETA)
  const handleSetEta = async (orderId, etaValue) => {
    const cleanEta = String(etaValue || etaInputs[orderId] || '').trim();
    if (!cleanEta) {
      showToast('Lütfen geçerli bir varış süresi seçin veya yazın.', 'error');
      return;
    }
    setUpdatingId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_eta',
          courierEta: cleanEta,
          courierName: courierUser?.name || 'Kurye',
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(`Müşteriye tahmini varış süresi (${cleanEta}) bildirildi! ⏱️`);
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? { ...o, courierEta: cleanEta, estimatedDeliveryTime: cleanEta }
              : o
          )
        );
      } else {
        showToast(json.error || 'Varış süresi kaydedilemedi.', 'error');
      }
    } catch {
      showToast('Bağlantı hatası oluştu.', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  // Copy address to clipboard
  const handleCopyAddress = (address) => {
    if (!address) return;
    try {
      navigator.clipboard.writeText(address);
      showToast('Adres panoya kopyalandı! 📋');
    } catch {
      showToast('Adres kopyalanamadı.', 'error');
    }
  };

  // Filter orders according to logged-in courier
  const { activeOrders, completedOrders, unassignedReadyOrders, stats } = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const courierName = (courierUser?.name || '').toLowerCase().trim();
    const courierPhoneDigits = (courierUser?.phone || '').replace(/\D/g, '');

    const matchesCourier = (o) => {
      if (!courierName) return false;
      const oName = (o.courierName || '').toLowerCase().trim();
      const oPhoneDigits = (o.courierPhone || '').replace(/\D/g, '');
      const dName = (o.deliveredBy || '').toLowerCase().trim();
      return (
        oName === courierName ||
        dName === courierName ||
        (courierPhoneDigits.length >= 10 && oPhoneDigits.endsWith(courierPhoneDigits.slice(-10)))
      );
    };

    // Active deliveries on this courier
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
      const isAssigned = matchesCourier(o);
      const isDelivered = o.status === 'Teslim Edildi';
      const isToday = (o.deliveredAt || o.createdAt || '').slice(0, 10) === today;
      return isAssigned && isDelivered && isToday;
    });

    // Unassigned ready orders in kitchen
    const unassignedReady = orders.filter(
      (o) => (o.status === 'Hazır' || o.status === 'Hazırlanıyor') && !o.courierName
    );

    // Revenue collected today by this courier
    const totalCash = completed
      .filter((o) => (o.paymentMethod || '').toLowerCase().includes('nakit'))
      .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    const totalCard = completed
      .filter(
        (o) =>
          (o.paymentMethod || '').toLowerCase().includes('kart') ||
          (o.paymentMethod || '').toLowerCase().includes('pos')
      )
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
  }, [orders, courierUser]);

  // Current display list based on active tab
  const displayOrders = useMemo(() => {
    if (activeTab === 'completed') return completedOrders;
    if (activeTab === 'unassigned') return unassignedReadyOrders;
    return activeOrders;
  }, [activeTab, activeOrders, completedOrders, unassignedReadyOrders]);

  // --------------------------------------------------------------------------
  // 1. LOADING SCREEN (Checking Session)
  // --------------------------------------------------------------------------
  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-stone-900 text-white flex items-center justify-center p-4 font-poppins">
        <div className="text-center space-y-3">
          <i className="fa-solid fa-motorcycle text-4xl text-amber-500 animate-bounce"></i>
          <p className="text-xs font-bold text-stone-300">Kurye Portalı Başlatılıyor...</p>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // 2. COURIER LOGIN SCREEN (If not logged in)
  // --------------------------------------------------------------------------
  if (!courierUser) {
    return (
      <div className="min-h-screen bg-stone-950 text-white flex flex-col justify-center items-center p-4 font-poppins relative overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute top-1/4 -left-32 w-80 h-80 rounded-full bg-brand-500/15 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-1/4 -right-32 w-80 h-80 rounded-full bg-amber-500/15 blur-3xl pointer-events-none"></div>

        <div className="w-full max-w-md bg-stone-900/90 backdrop-blur-xl border border-stone-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 space-y-6">
          {/* Logo & Başlık */}
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-brand-600 text-stone-950 flex items-center justify-center text-3xl mx-auto shadow-lg shadow-amber-500/25">
              <i className="fa-solid fa-motorcycle"></i>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Sandviç Diyarı
            </h1>
            <p className="text-xs font-bold text-amber-400 uppercase tracking-widest">
              Kurye Teslimat Portalı
            </p>
          </div>

          {/* Bilgilendirme Notu */}
          <div className="bg-stone-800/80 border border-stone-700/80 rounded-2xl p-3.5 text-xs text-stone-300 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-300">
              <i className="fa-solid fa-shield-halved"></i>
              <span>Yetkili Kurye Girişi</span>
            </div>
            <p className="text-[11px] text-stone-400 leading-relaxed">
              Kurye oturumları restoran yönetim paneli tarafından tanımlanır. Şifrenizi unuttuysanız şube yetkiliniz ile iletişime geçiniz.
            </p>
          </div>

          {/* Hata Mesajı */}
          {loginError && (
            <div className="bg-rose-950/80 border border-rose-800/90 text-rose-300 p-3 rounded-2xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
              <i className="fa-solid fa-circle-exclamation text-rose-400 shrink-0"></i>
              <span>{loginError}</span>
            </div>
          )}

          {/* Giriş Formu */}
          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-stone-300 uppercase mb-1.5">
                Kullanıcı Adı / Telefon / E-posta
              </label>
              <div className="relative">
                <i className="fa-solid fa-user absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 text-xs"></i>
                <input
                  type="text"
                  required
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  placeholder="Örn: 05321234567 veya ahmet"
                  className="w-full bg-stone-950/80 border border-stone-700 text-white rounded-xl pl-9 pr-3.5 py-3 text-xs sm:text-sm font-semibold focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all placeholder:text-stone-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-300 uppercase mb-1.5">
                Kurye Şifresi
              </label>
              <div className="relative">
                <i className="fa-solid fa-lock absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 text-xs"></i>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-stone-950/80 border border-stone-700 text-white rounded-xl pl-9 pr-10 py-3 text-xs sm:text-sm font-semibold focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all placeholder:text-stone-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 cursor-pointer"
                >
                  <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-xs`}></i>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-gradient-to-r from-amber-500 to-brand-600 hover:from-amber-400 hover:to-brand-500 text-stone-950 font-black py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20 active:scale-95 cursor-pointer flex items-center justify-center gap-2 mt-2"
            >
              {loginLoading ? (
                <>
                  <i className="fa-solid fa-circle-notch animate-spin"></i>
                  <span>Giriş Yapılıyor...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-arrow-right-to-bracket"></i>
                  <span>Kurye Girişi Yap</span>
                </>
              )}
            </button>
          </form>

          {/* Alt Yönetim Linki */}
          <div className="text-center pt-2 border-t border-stone-800/80">
            <a
              href="/admin"
              className="text-stone-400 hover:text-amber-400 text-xs font-semibold transition-colors inline-flex items-center gap-1.5"
            >
              <i className="fa-solid fa-shield-halved text-[11px]"></i>
              <span>Restoran Yönetim Paneli Girişi</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // 3. COURIER DASHBOARD VIEW (When logged in)
  // --------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 font-poppins pb-24 selection:bg-brand-500 selection:text-white">
      {/* 1. STICKY TOP APP BAR */}
      <header className="sticky top-0 z-30 bg-stone-900 text-white shadow-md border-b border-stone-800">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          {/* Logo & Portal Adı */}
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/logo.png?v=2"
              alt="Sandviç Diyarı Logo"
              className="h-8 sm:h-9 w-auto object-contain drop-shadow-md shrink-0"
            />
            <div className="min-w-0">
              <h1 className="font-extrabold text-sm sm:text-base leading-tight truncate">
                Sandviç Diyarı
              </h1>
              <span className="text-[11px] text-amber-400 font-bold block truncate">
                Kurye Portalı
              </span>
            </div>
          </div>

          {/* Kurye Profil & Çıkış Butonları */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Ses Toggle */}
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

            {/* Yenile */}
            <button
              type="button"
              onClick={() => fetchOrders(false)}
              className="bg-brand-600 hover:bg-brand-500 active:scale-95 text-white font-bold text-xs px-3 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
              title="Siparişleri Yenile"
            >
              <i className={`fa-solid fa-rotate-right text-xs ${loading ? 'animate-spin' : ''}`}></i>
              <span className="hidden sm:inline">Yenile</span>
            </button>

            {/* Çıkış Yap */}
            <button
              type="button"
              onClick={handleLogout}
              className="bg-stone-800 hover:bg-rose-900/60 text-stone-300 hover:text-rose-200 border border-stone-700 text-xs px-2.5 py-2 rounded-xl transition-colors cursor-pointer"
              title="Oturumu Kapat"
            >
              <i className="fa-solid fa-arrow-right-from-bracket"></i>
            </button>
          </div>
        </div>

        {/* 2. AKTİF OTURUM KARTI */}
        <div className="bg-stone-850 px-4 py-2 border-t border-stone-800">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
              <span className="text-xs font-black text-white truncate flex items-center gap-1.5">
                <i className="fa-solid fa-user-astronaut text-amber-400 text-xs"></i>
                <span>{courierUser.name}</span>
                {courierUser.phone && (
                  <span className="text-[10px] text-stone-400 font-semibold hidden sm:inline">
                    ({courierUser.phone})
                  </span>
                )}
              </span>
            </div>

            {stats.activeCount > 0 ? (
              <span className="bg-red-500 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full animate-pulse shrink-0">
                {stats.activeCount} Aktif Teslimat
              </span>
            ) : (
              <span className="text-[11px] text-stone-400 font-semibold shrink-0">
                Yeni paket bekleniyor
              </span>
            )}
          </div>
        </div>
      </header>

      {/* 3. ANA GÖVDE VE İÇERİK ALANI */}
      <main className="max-w-3xl mx-auto px-3 sm:px-4 pt-4 space-y-4">
        {/* 3.1. BUGÜNKÜ PERFORMANS VE TAHSİLAT KARTLARI */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-stone-200/90 shadow-2xs text-center">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 block">
              Üzerimdeki Paket
            </span>
            <span
              className={`text-xl sm:text-2xl font-black block mt-0.5 ${
                stats.activeCount > 0 ? 'text-brand-600 animate-pulse' : 'text-stone-800'
              }`}
            >
              {stats.activeCount}
            </span>
          </div>

          <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-stone-200/90 shadow-2xs text-center">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 block">
              Bugün Teslim
            </span>
            <span className="text-xl sm:text-2xl font-black text-emerald-600 block mt-0.5">
              {stats.completedCount}
            </span>
          </div>

          <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-stone-200/90 shadow-2xs text-center">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 block">
              Tahsil Edilen
            </span>
            <span className="text-base sm:text-xl font-black text-stone-900 block mt-1 truncate">
              ₺{stats.totalRevenue.toFixed(0)}
            </span>
          </div>
        </div>

        {/* 3.2. SEKMELER (ÜZERİMDEKİLER / MUTFAKTA BOŞTAKİLER / TESLİM EDİLENLER) */}
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-2xl border border-stone-200 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-2.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'active'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <i className="fa-solid fa-box-open text-xs"></i>
            <span>Üzerimdekiler</span>
            {stats.activeCount > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  activeTab === 'active' ? 'bg-brand-500 text-white' : 'bg-red-500 text-white'
                }`}
              >
                {stats.activeCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('unassigned')}
            className={`flex-1 py-2.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'unassigned'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <i className="fa-solid fa-fire-burner text-xs"></i>
            <span>Mutfakta Hazır</span>
            {stats.unassignedCount > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  activeTab === 'unassigned'
                    ? 'bg-purple-600 text-white'
                    : 'bg-purple-100 text-purple-800'
                }`}
              >
                {stats.unassignedCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('completed')}
            className={`flex-1 py-2.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
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
          <div className="bg-white rounded-3xl border border-stone-200 p-12 text-center space-y-3 shadow-2xs">
            <i className="fa-solid fa-motorcycle text-3xl text-brand-500 animate-bounce"></i>
            <p className="font-bold text-stone-800 text-sm">Siparişler Yükleniyor...</p>
          </div>
        ) : displayOrders.length === 0 ? (
          <div className="bg-white rounded-3xl border border-stone-200 p-10 sm:p-14 text-center space-y-3 shadow-2xs">
            <span className="w-16 h-16 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center text-2xl mx-auto">
              <i className="fa-solid fa-mug-hot"></i>
            </span>
            <div className="space-y-1">
              <h3 className="font-extrabold text-stone-800 text-base">
                {activeTab === 'active'
                  ? 'Şu an üzerinize atanan teslimat bulunmuyor.'
                  : activeTab === 'unassigned'
                  ? 'Mutfakta sahipsiz bekleyen hazır paket yok.'
                  : 'Bugün henüz teslim edilmiş siparişiniz bulunmuyor.'}
              </h3>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                {activeTab === 'active'
                  ? 'Restoran yöneticisi size yeni bir sipariş atadığında veya mutfaktan hazır siparişi üzerinize aldığınızda burada listelenecektir.'
                  : 'Yeni siparişler mutfakta hazırlandığında bu sayfaya düşecektir.'}
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

              const phoneClean = String(order.customerPhone || order.phone || '').replace(
                /\D/g,
                ''
              );
              const customerFullAddress =
                (order.customerAddress || order.address || '') + ' Torbalı İzmir';

              // Turn-by-turn navigation URL for Google Maps and Apple Maps
              const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                customerFullAddress
              )}`;

              const isCash = (order.paymentMethod || '').toLowerCase().includes('nakit');
              const isCard =
                (order.paymentMethod || '').toLowerCase().includes('kart') ||
                (order.paymentMethod || '').toLowerCase().includes('pos');
              const isOnline = (order.paymentMethod || '').toLowerCase().includes('online');

              const currentEta = order.courierEta || order.estimatedDeliveryTime || '';

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
                  <div className="space-y-3">
                    {/* Müşteri Adı ve Telefon Arama Butonu */}
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
                          className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-xs transition-all shrink-0 cursor-pointer"
                        >
                          <i className="fa-solid fa-phone text-xs"></i>
                          <span>Ara ({order.customerPhone || order.phone})</span>
                        </a>
                      )}
                    </div>

                    {/* Teslimat Adresi ve Yol Tarifi Butonu */}
                    <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200/90 space-y-2.5">
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="min-w-0 space-y-0.5">
                          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                            Teslimat Adresi
                          </span>
                          <p className="text-xs sm:text-sm font-bold text-stone-900 leading-snug">
                            {order.customerAddress || order.address || 'Adres bilgisi girilmedi.'}
                          </p>
                        </div>

                        {/* Yol Tarifi Al (Google / Apple Maps Navigasyon) */}
                        <div className="flex flex-col gap-1.5 shrink-0">
                          <a
                            href={directionsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-sky-600 hover:bg-sky-500 active:scale-95 text-white font-extrabold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                            title="Haritada Yol Tarifi Başlat"
                          >
                            <i className="fa-solid fa-location-arrow text-xs text-amber-300"></i>
                            <span>Yol Tarifi Al</span>
                          </a>

                          <button
                            type="button"
                            onClick={() =>
                              handleCopyAddress(order.customerAddress || order.address)
                            }
                            className="bg-stone-200/90 hover:bg-stone-300 text-stone-700 font-bold text-[10px] py-1 px-2 rounded-lg text-center cursor-pointer transition-colors"
                            title="Adresi Kopyala"
                          >
                            <i className="fa-solid fa-copy mr-1"></i>Adresi Kopyala
                          </button>
                        </div>
                      </div>

                      {/* Müşteri Notu */}
                      {(order.notes || order.orderNote) && (
                        <div className="bg-amber-50 border border-amber-200 text-amber-900 p-2.5 rounded-xl text-xs font-semibold flex items-start gap-1.5">
                          <i className="fa-solid fa-triangle-exclamation text-amber-600 mt-0.5 shrink-0"></i>
                          <span>
                            <strong>Müşteri Notu:</strong> {order.notes || order.orderNote}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3.4. TAHMİNİ VARIŞ SÜRESİ (ETA) GİRİŞ MODÜLÜ (KURYE MÜŞTERİYE BİLDİRİR) */}
                  {!isDelivered && (
                    <div className="bg-gradient-to-r from-amber-500/10 via-amber-50/50 to-white p-3.5 rounded-2xl border border-amber-200/90 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                          <i className="fa-solid fa-stopwatch text-amber-600"></i>
                          <span>Müşteriye Tahmini Varış Süresi</span>
                        </span>
                        {currentEta && (
                          <span className="text-[11px] font-black bg-amber-500 text-stone-950 px-2.5 py-0.5 rounded-full border border-amber-400">
                            Bildirilen: {currentEta}
                          </span>
                        )}
                      </div>

                      {/* Hızlı Butonlar */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {ETA_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => handleSetEta(order.id, preset)}
                            disabled={isUpdating}
                            className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
                              currentEta === preset
                                ? 'bg-amber-500 text-stone-950 border-amber-600 font-black'
                                : 'bg-white hover:bg-amber-100 text-stone-800 border-amber-200 hover:border-amber-300'
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>

                      {/* Özel Süre Girişi */}
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          value={etaInputs[order.id] || ''}
                          onChange={(e) =>
                            setEtaInputs({ ...etaInputs, [order.id]: e.target.value })
                          }
                          placeholder="Örn: 12 dk veya Saat 14:30"
                          className="bg-white border border-stone-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-stone-800 focus:outline-none focus:border-amber-500 flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => handleSetEta(order.id)}
                          disabled={isUpdating}
                          className="bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all cursor-pointer shrink-0 shadow-2xs"
                        >
                          <i className="fa-solid fa-paper-plane mr-1 text-[10px]"></i>
                          <span>Bildir</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Ödeme Yöntemi ve Tahsil Edilecek Tutar */}
                  <div className="flex items-center justify-between gap-3 bg-stone-900 text-white p-3.5 rounded-2xl">
                    <div>
                      <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                        Ödeme &amp; Tahsilat
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-bold">
                          {order.paymentMethod || 'Kapıda Nakit'}
                        </span>
                        {isCash && (
                          <span className="bg-amber-500 text-stone-950 text-[10px] font-black px-2 py-0.5 rounded-md uppercase">
                            Nakit Tahsil Et
                          </span>
                        )}
                        {isCard && (
                          <span className="bg-sky-500 text-white text-[10px] font-black px-2 py-0.5 rounded-md uppercase">
                            POS Çek
                          </span>
                        )}
                        {isOnline && (
                          <span className="bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-md uppercase">
                            Online Ödendi
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
                            <strong className="text-brand-600 mr-1">
                              {item.quantity || 1}x
                            </strong>
                            {item.name}
                            {item.details && (
                              <span className="text-[10px] text-stone-500 ml-1">
                                ({item.details})
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Kurye Atama Bilgisi */}
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
                    {/* A) Sahipsiz Hazır Siparişi Üzerime Al */}
                    {!order.courierName && !isDelivered && (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleClaimOrder(order.id)}
                        className="w-full bg-stone-900 hover:bg-stone-800 active:scale-98 text-white font-black py-3.5 rounded-2xl text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <i className="fa-solid fa-hand-holding-hand text-amber-400"></i>
                        <span>Bu Siparişi Üzerime Al ({courierUser.name})</span>
                      </button>
                    )}

                    {/* B) Paketi Mutfaktan Teslim Aldım */}
                    {(isReady || order.status === 'Onaylandı' || order.status === 'Hazırlanıyor') &&
                      !isDelivered && (
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleUpdateStatus(order.id, 'Kurye Teslim Aldı')}
                          className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:scale-98 text-white font-black py-3.5 rounded-2xl text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <i className="fa-solid fa-box text-base text-yellow-300"></i>
                          <span>
                            {isUpdating
                              ? 'Güncelleniyor...'
                              : '1. Paketi Mutfaktan Teslim Aldım'}
                          </span>
                        </button>
                      )}

                    {/* C) Yola Çıktım (Müşteriye Gidiyorum) */}
                    {order.status === 'Kurye Teslim Aldı' && (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleUpdateStatus(order.id, 'Yolda')}
                        className="w-full bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 active:scale-98 text-white font-black py-3.5 rounded-2xl text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
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
                          const orderNo = order.orderNumber || order.id;
                          const totalStr = (
                            Number(order.total) ||
                            Number(order.subtotal) ||
                            0
                          ).toFixed(2);
                          if (
                            confirm(
                              `#${orderNo} numaralı siparişi müşteriye teslim edip ₺${totalStr} (${order.paymentMethod || 'Ödeme'}) tahsilatını onaylıyor musunuz?`
                            )
                          ) {
                            handleUpdateStatus(order.id, 'Teslim Edildi', 'courier_deliver');
                          }
                        }}
                        className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 active:scale-98 text-white font-black py-4 rounded-2xl text-sm sm:text-base transition-all shadow-lg shadow-emerald-950/20 flex items-center justify-center gap-2.5 cursor-pointer ring-2 ring-emerald-400"
                      >
                        <i className="fa-solid fa-circle-check text-lg"></i>
                        <span>
                          {isUpdating ? 'İşleniyor...' : '✅ Müşteriye Teslim Ettim (Tamamla)'}
                        </span>
                      </button>
                    )}

                    {/* E) Teslim Edildiyse Bilgilendirme */}
                    {isDelivered && (
                      <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-3 rounded-2xl text-xs font-bold text-center flex items-center justify-center gap-2">
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
              className="text-stone-400 hover:text-white cursor-pointer"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
