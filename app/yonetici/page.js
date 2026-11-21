'use client';

import { useState, useEffect, useMemo } from 'react';
import UsersRolesTab from '@/components/admin/UsersRolesTab';
import SiteContentEditorTab from '@/components/admin/SiteContentEditorTab';
import SettingsTab from '@/components/admin/SettingsTab';

const ADMIN_SESSION_KEY = 'sandwich_admin_session';
const ADMIN_SETTINGS_KEY = 'sandwich_admin_settings';

const EXPENSE_CATEGORIES = [
  'Malzeme & Tedarik',
  'Personel Maaşı / Avans',
  'Kurye & Yakıt',
  'Kira & Fatura',
  'Bakım & Onarım',
  'Diğer Gider'
];

const INCOME_CATEGORIES = [
  'Kasa Açılış / Nakit Girişi',
  'Ek Gelir',
  'Tedarik İadesi',
  'Diğer Gelir'
];

export default function YoneticiPage() {
  const [adminUser, setAdminUser] = useState(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'finance' | 'users' | 'site_content' | 'settings'
  const [selectedSettingsSubTab, setSelectedSettingsSubTab] = useState('appearance');
  const [settingsExpanded, setSettingsExpanded] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [toast, setToast] = useState(null);

  // Finance & Overview states
  const [orders, setOrders] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [staffUsers, setStaffUsers] = useState([]);
  const [visitorStats, setVisitorStats] = useState({
    todayCount: 0,
    yesterdayCount: 0,
    last7DaysCount: 0,
    last30DaysCount: 0,
    totalCount: 0
  });
  const [loadingFinance, setLoadingFinance] = useState(false);
  const [dateFilter, setDateFilter] = useState('today'); // 'today' | 'week' | 'month' | 'all'
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'in' | 'out'
  const [chartPeriod, setChartPeriod] = useState('daily'); // 'daily' | 'weekly' | 'monthly'
  const [chartMetric, setChartMetric] = useState('count'); // 'count' | 'revenue'
  const [hoveredBar, setHoveredBar] = useState(null);

  // New transaction form
  const [txType, setTxType] = useState('out');
  const [txAmount, setTxAmount] = useState('');
  const [txCategory, setTxCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [txPaymentSource, setTxPaymentSource] = useState('Nakit Kasa');
  const [txDate, setTxDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [txDescription, setTxDescription] = useState('');
  const [savingTx, setSavingTx] = useState(false);

  // System settings (synced with /panel)
  const [adminSettings, setAdminSettings] = useState({
    soundEnabled: true,
    fontSize: 'normal',
    autoPrintReceipt: false,
    receiptFooterNote: 'Afiyet olsun! Bizi tercih ettiğiniz için teşekkürler.'
  });

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem(ADMIN_SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const isSuperAdmin =
          parsed &&
          (parsed.roleId === 'role_super_admin' ||
            parsed.role === 'Süper Yönetici' ||
            String(parsed.email || '').toLowerCase() === 'admin' ||
            String(parsed.email || '').toLowerCase() === 'admin@sandwichdiyari.com' ||
            String(parsed.email || '').toLowerCase().includes('hknkcpnr'));
        if (parsed && parsed.name && isSuperAdmin) {
          setAdminUser(parsed);
        } else {
          localStorage.removeItem(ADMIN_SESSION_KEY);
        }
      }
      const savedSettings = localStorage.getItem(ADMIN_SETTINGS_KEY);
      if (savedSettings) {
        setAdminSettings((prev) => ({ ...prev, ...JSON.parse(savedSettings) }));
      }
    } catch {}
  }, []);

  const fetchFinanceData = async () => {
    setLoadingFinance(true);
    try {
      const [ordersRes, finRes, usersRes, visitorsRes] = await Promise.all([
        fetch('/api/orders', { cache: 'no-store' }),
        fetch('/api/finance', { cache: 'no-store' }),
        fetch('/api/admin/users', { cache: 'no-store' }),
        fetch('/api/visitors', { cache: 'no-store' })
      ]);
      const ordersJson = await ordersRes.json();
      const finJson = await finRes.json();
      const usersJson = await usersRes.json();
      const visitorsJson = await visitorsRes.json().catch(() => ({}));
      if (ordersJson.success && Array.isArray(ordersJson.data)) {
        setOrders(ordersJson.data);
      }
      if (finJson.success && Array.isArray(finJson.data)) {
        setTransactions(finJson.data);
      }
      if (usersJson.success && Array.isArray(usersJson.data?.adminUsers)) {
        setStaffUsers(usersJson.data.adminUsers);
      }
      if (visitorsJson?.success && visitorsJson.data) {
        setVisitorStats(visitorsJson.data);
      }
    } catch (e) {
      console.error('Finans verileri alınamadı:', e);
    } finally {
      setLoadingFinance(false);
    }
  };

  useEffect(() => {
    if (!adminUser) return;
    fetchFinanceData();
    const timer = setInterval(fetchFinanceData, 15000);
    return () => clearInterval(timer);
  }, [adminUser]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUsername.trim(),
          password: loginPassword,
          portal: 'yonetici'
        })
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setLoginError(json.error || 'Giriş bilgileri hatalı.');
        return;
      }
      const userObj = json.data?.admin || json.data?.user || json.data || json.user;
      const isSuperAdmin =
        userObj?.roleId === 'role_super_admin' ||
        userObj?.role === 'Süper Yönetici' ||
        String(userObj?.email || '').toLowerCase() === 'admin' ||
        String(userObj?.email || '').toLowerCase() === 'admin@sandwichdiyari.com' ||
        String(userObj?.email || '').toLowerCase().includes('hknkcpnr');

      if (!isSuperAdmin) {
        setLoginError('Bu panel yalnızca Süper Yönetici (/yonetici) hesapları içindir. Restoran paneli için /panel adresini kullanın.');
        return;
      }

      localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(userObj));
      setAdminUser(userObj);
      setLoginPassword('');
    } catch {
      setLoginError('Sunucuya bağlanılamadı.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    setAdminUser(null);
  };

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (!txAmount || Number(txAmount) <= 0 || !txDescription.trim()) {
      showToast('Lütfen geçerli bir tutar ve açıklama giriniz.', 'error');
      return;
    }
    setSavingTx(true);
    try {
      const res = await fetch('/api/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: txType,
          amount: Number(txAmount),
          category: txCategory,
          paymentSource: txPaymentSource,
          date: txDate,
          description: txDescription.trim(),
          createdBy: adminUser?.name || 'Yönetici'
        })
      });
      const json = await res.json();
      if (json.success && json.data) {
        setTransactions((prev) => [json.data, ...prev]);
        setTxAmount('');
        setTxDescription('');
        showToast(json.message || 'Kasa işlemi kaydedildi.');
      } else {
        showToast(json.error || 'İşlem kaydedilemedi.', 'error');
      }
    } catch {
      showToast('Bağlantı hatası oluştu.', 'error');
    } finally {
      setSavingTx(false);
    }
  };

  const handleDeleteTransaction = async (id) => {
    if (!confirm('Bu kasa kaydını silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`/api/finance?id=${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      const json = await res.json();
      if (json.success) {
        setTransactions((prev) => prev.filter((item) => String(item.id) !== String(id)));
        showToast('Kasa kaydı silindi.');
      } else {
        showToast(json.error || 'Kayıt silinemedi.', 'error');
      }
    } catch {
      showToast('Silme sırasında bağlantı hatası oluştu.', 'error');
    }
  };

  const matchesDateRange = (isoOrDateStr) => {
    if (dateFilter === 'all') return true;
    const raw = String(isoOrDateStr || '').slice(0, 10);
    if (!raw) return false;
    const target = new Date(`${raw}T00:00:00`);
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    if (dateFilter === 'today') return raw === todayStr;
    const diffDays = (new Date(`${todayStr}T00:00:00`) - target) / (1000 * 60 * 60 * 24);
    if (dateFilter === 'week') return diffDays >= 0 && diffDays <= 7;
    if (dateFilter === 'month') return diffDays >= 0 && diffDays <= 30;
    return true;
  };

  const financeSummary = useMemo(() => {
    const deliveredOrders = orders.filter(
      (o) => o.status === 'Teslim Edildi' && matchesDateRange(o.deliveredAt || o.createdAt)
    );
    const orderRevenueTotal = deliveredOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const cashOrdersRevenue = deliveredOrders
      .filter((o) => (o.paymentMethod || '').toLowerCase().includes('nakit'))
      .reduce((s, o) => s + (Number(o.total) || 0), 0);
    const cardOrdersRevenue = deliveredOrders
      .filter((o) => {
        const m = (o.paymentMethod || '').toLowerCase();
        return m.includes('kart') || m.includes('pos');
      })
      .reduce((s, o) => s + (Number(o.total) || 0), 0);

    const rangeTx = transactions.filter((t) => matchesDateRange(t.date || t.createdAt));
    const manualIn = rangeTx
      .filter((t) => t.type === 'in')
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const manualOut = rangeTx
      .filter((t) => t.type === 'out')
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);

    const totalIn = orderRevenueTotal + manualIn;
    const totalOut = manualOut;
    const netCash = totalIn - totalOut;
    const filteredTx = rangeTx.filter((t) => (typeFilter === 'all' ? true : t.type === typeFilter));

    return {
      deliveredCount: deliveredOrders.length,
      orderRevenueTotal,
      cashOrdersRevenue,
      cardOrdersRevenue,
      manualIn,
      manualOut,
      totalIn,
      totalOut,
      netCash,
      filteredTx
    };
  }, [orders, transactions, dateFilter, typeFilter]);

  const overviewData = useMemo(() => {
    const now = new Date();
    const toLocalDateStr = (d) => {
      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const da = String(d.getDate()).padStart(2, '0');
      return `${yr}-${mo}-${da}`;
    };
    const todayStr = toLocalDateStr(now);

    const validOrders = orders.filter((o) => o.status !== 'İptal');
    const isSameDay = (iso, targetStr) => {
      if (!iso) return false;
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10) === targetStr;
      return toLocalDateStr(d) === targetStr;
    };

    const todayOrders = validOrders.filter((o) => isSameDay(o.createdAt, todayStr));
    const deliveredTodayOrders = validOrders.filter(
      (o) => o.status === 'Teslim Edildi' && isSameDay(o.deliveredAt || o.createdAt, todayStr)
    );
    const onRoadOrders = validOrders.filter((o) => o.status === 'Yolda');
    const kitchenOrders = validOrders.filter(
      (o) => o.status === 'Yeni' || o.status === 'Hazırlanıyor'
    );
    const dispatchedTodayCount = onRoadOrders.length + deliveredTodayOrders.length;
    const todayRevenue = deliveredTodayOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);

    // Kuryeler & anlık sipariş ilişkileri
    const courierMap = new Map();
    staffUsers.forEach((u) => {
      const perms = Array.isArray(u.permissions) ? u.permissions : [];
      const isCourier =
        u.roleId === 'role_courier' ||
        perms.includes('courier_delivery') ||
        (u.role || '').toLowerCase().includes('kurye');
      if (isCourier && u.name) {
        courierMap.set(u.name, {
          name: u.name,
          activeOrders: [],
          deliveredToday: [],
          deliveredTodayRevenue: 0
        });
      }
    });

    onRoadOrders.forEach((o) => {
      const cName = (o.courierName || '').trim();
      if (!cName) return;
      if (!courierMap.has(cName)) {
        courierMap.set(cName, {
          name: cName,
          activeOrders: [],
          deliveredToday: [],
          deliveredTodayRevenue: 0
        });
      }
      courierMap.get(cName).activeOrders.push(o);
    });

    deliveredTodayOrders.forEach((o) => {
      const cName = (o.deliveredBy || o.courierName || '').trim();
      if (!cName) return;
      if (!courierMap.has(cName)) {
        courierMap.set(cName, {
          name: cName,
          activeOrders: [],
          deliveredToday: [],
          deliveredTodayRevenue: 0
        });
      }
      const entry = courierMap.get(cName);
      entry.deliveredToday.push(o);
      entry.deliveredTodayRevenue += Number(o.total) || 0;
    });

    const couriers = Array.from(courierMap.values()).sort(
      (a, b) => b.activeOrders.length - a.activeOrders.length || b.deliveredToday.length - a.deliveredToday.length
    );
    const activeCouriersCount = couriers.filter((c) => c.activeOrders.length > 0).length;
    const unassignedOrders = validOrders.filter(
      (o) => (o.status === 'Yeni' || o.status === 'Hazırlanıyor' || o.status === 'Yolda') && !(o.courierName || '').trim()
    );

    // Grafiksel veriler: Günlük (Saatlik), Haftalık (7 gün), Aylık (30 gün)
    let chartBars = [];
    if (chartPeriod === 'daily') {
      const hours = Array.from({ length: 24 }, (_, h) => ({
        label: `${String(h).padStart(2, '0')}:00`,
        shortLabel: `${String(h).padStart(2, '0')}`,
        count: 0,
        delivered: 0,
        revenue: 0
      }));
      todayOrders.forEach((o) => {
        const d = new Date(o.createdAt);
        if (!Number.isNaN(d.getTime())) {
          const h = d.getHours();
          hours[h].count += 1;
          if (o.status === 'Teslim Edildi') {
            hours[h].delivered += 1;
            hours[h].revenue += Number(o.total) || 0;
          }
        }
      });
      // Aktif çalışma saatlerini (09:00-23:00) veya sipariş olan saatleri göster
      chartBars = hours.filter((h, idx) => (idx >= 9 && idx <= 23) || h.count > 0);
    } else {
      const daysCount = chartPeriod === 'weekly' ? 7 : 30;
      const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
      const buckets = [];
      const bucketByKey = new Map();
      for (let i = daysCount - 1; i >= 0; i -= 1) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const key = toLocalDateStr(d);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const bar = {
          key,
          label: chartPeriod === 'weekly' ? `${dayNames[d.getDay()]} (${dd}.${mm})` : `${dd}.${mm}`,
          shortLabel: chartPeriod === 'weekly' ? dayNames[d.getDay()] : dd,
          count: 0,
          delivered: 0,
          revenue: 0
        };
        buckets.push(bar);
        bucketByKey.set(key, bar);
      }
      validOrders.forEach((o) => {
        const d = new Date(o.createdAt);
        const key = Number.isNaN(d.getTime()) ? String(o.createdAt || '').slice(0, 10) : toLocalDateStr(d);
        const bucket = bucketByKey.get(key);
        if (bucket) {
          bucket.count += 1;
          if (o.status === 'Teslim Edildi') {
            bucket.delivered += 1;
            bucket.revenue += Number(o.total) || 0;
          }
        }
      });
      chartBars = buckets;
    }

    const maxBarValue = Math.max(
      ...chartBars.map((b) => (chartMetric === 'revenue' ? b.revenue : b.count)),
      chartMetric === 'revenue' ? 100 : 4
    );
    const periodTotalOrders = chartBars.reduce((s, b) => s + b.count, 0);
    const periodDeliveredOrders = chartBars.reduce((s, b) => s + b.delivered, 0);
    const periodRevenue = chartBars.reduce((s, b) => s + b.revenue, 0);

    return {
      todayOrdersCount: todayOrders.length,
      dispatchedTodayCount,
      deliveredTodayCount: deliveredTodayOrders.length,
      onRoadOrdersCount: onRoadOrders.length,
      kitchenOrdersCount: kitchenOrders.length,
      todayRevenue,
      couriers,
      activeCouriersCount,
      unassignedOrders,
      chartBars,
      maxBarValue,
      periodTotalOrders,
      periodDeliveredOrders,
      periodRevenue
    };
  }, [orders, staffUsers, chartPeriod, chartMetric]);

  // ----------------------------------------------------
  // LOGIN SCREEN (/panel ile birebir aynı tasarım)
  // ----------------------------------------------------
  if (!adminUser) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4 font-poppins text-stone-800">
        <div className="w-full max-w-sm bg-white rounded-2xl border border-stone-200 p-8 shadow-sm space-y-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <img
                src="/logo.png?v=2"
                alt="Sandviç Diyarı Logo"
                className="h-9 w-auto object-contain drop-shadow-sm shrink-0"
              />
              <div>
                <h1 className="font-extrabold text-stone-900 text-base leading-tight">Sandviç Diyarı</h1>
                <span className="text-[11px] text-stone-500 font-medium block">Yönetici Merkezi Portalı</span>
              </div>
            </div>
          </div>

          {loginError && (
            <div className="bg-red-50 text-red-600 text-xs p-3 rounded-xl border border-red-100 flex items-center gap-2">
              <i className="fa-solid fa-circle-exclamation shrink-0"></i>
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-semibold text-stone-500 uppercase mb-1">
                Kullanıcı Adı, E-Posta veya Telefon
              </label>
              <input
                type="text"
                required
                autoComplete="username"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="admin, e-posta veya telefon"
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs text-stone-900 focus:outline-none focus:border-stone-400 font-medium"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-stone-500 uppercase mb-1">
                Şifre
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="•••••"
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs text-stone-900 focus:outline-none focus:border-stone-400 font-medium"
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-stone-900 hover:bg-black text-white text-xs font-semibold py-3 rounded-xl transition-colors cursor-pointer mt-2"
            >
              {loginLoading ? 'Giriş Yapılıyor...' : 'Yönetime Giriş Yap'}
            </button>
          </form>

          <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs">
            <a href="/panel" className="text-stone-400 hover:text-stone-700 transition-colors">
              &larr; Operasyon Paneli
            </a>
            <a href="/" className="text-stone-400 hover:text-stone-700 transition-colors">
              Müşteri Sitesi &rarr;
            </a>
          </div>
        </div>
      </div>
    );
  }

  const fontSizeClass =
    adminSettings?.fontSize === 'large'
      ? 'text-sm [&_.text-xs]:text-[13px] [&_.text-\\[10px\\]]:text-xs [&_.text-\\[11px\\]]:text-xs'
      : '';

  const settingsSubItems = [
    { id: 'appearance', label: 'Arayüz', icon: 'fa-solid fa-text-height' },
    { id: 'users', label: 'Kullanıcılar', icon: 'fa-solid fa-user-shield' },
    { id: 'sound', label: 'Ses', icon: 'fa-solid fa-volume-high' },
    { id: 'receipt', label: 'Fiş Baskı', icon: 'fa-solid fa-receipt' },
    { id: 'system', label: 'Yedekleme', icon: 'fa-solid fa-box-archive' },
    { id: 'api', label: 'Veritabanı', icon: 'fa-solid fa-database' }
  ];

  return (
    <div className={`min-h-screen bg-stone-50 text-stone-800 font-poppins flex flex-col md:flex-row ${fontSizeClass}`}>
      {/* Mobile Sidebar Backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR (/panel ile birebir aynı beyaz/taş arayüz) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-stone-200 flex flex-col justify-between shrink-0 transition-all duration-300 ease-in-out md:sticky md:top-0 md:h-screen md:translate-x-0 md:z-auto ${
          mobileSidebarOpen ? 'translate-x-0 w-72 shadow-2xl' : '-translate-x-full'
        } ${sidebarCollapsed ? 'md:w-20' : 'md:w-64'}`}
      >
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {/* Brand Header */}
          <div className={`p-5 border-b border-stone-100 flex items-center ${sidebarCollapsed ? 'md:justify-center md:px-3 justify-between' : 'justify-between'}`}>
            <div className={`flex items-center gap-2.5 min-w-0 ${sidebarCollapsed ? 'md:justify-center' : ''}`}>
              <img
                src="/logo.png?v=2"
                alt="Sandviç Diyarı Logo"
                className="h-9 w-auto object-contain drop-shadow-sm shrink-0"
              />
              <div className={`min-w-0 ${sidebarCollapsed ? 'md:hidden block' : 'block'}`}>
                <h1 className="font-extrabold text-stone-900 text-sm leading-tight truncate">Sandviç Diyarı</h1>
                <span className="text-[11px] text-indigo-600 font-bold block truncate">Yönetici Merkezi</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              className="hidden md:flex w-7 h-7 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 items-center justify-center text-xs transition-colors cursor-pointer shrink-0"
              title={sidebarCollapsed ? 'Menüyü Genişlet' : 'Menüyü Daralt'}
            >
              <i className={`fa-solid ${sidebarCollapsed ? 'fa-angles-right' : 'fa-angles-left'}`}></i>
            </button>

            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              className="md:hidden w-8 h-8 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center text-sm cursor-pointer"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          {/* Navigation Items */}
          <nav className={`p-3 space-y-1 ${sidebarCollapsed ? 'md:px-2' : ''}`}>
            <button
              type="button"
              onClick={() => {
                setActiveTab('overview');
                setMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center ${
                sidebarCollapsed ? 'md:justify-center md:h-11 md:px-0 justify-between px-3 py-2.5' : 'justify-between px-3 py-2.5'
              } rounded-xl font-medium transition-colors cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-stone-900 text-white font-semibold shadow-xs'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
              }`}
            >
              <div className={`flex items-center ${sidebarCollapsed ? 'md:justify-center gap-2.5' : 'gap-2.5 min-w-0'}`}>
                <i className="fa-solid fa-chart-pie text-sm w-4 text-center"></i>
                <span className={`truncate text-xs ${sidebarCollapsed ? 'md:hidden inline' : ''}`}>Genel Bakış</span>
              </div>
              {overviewData.onRoadOrdersCount > 0 && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 bg-amber-100 text-amber-800 ${sidebarCollapsed ? 'md:hidden inline' : ''}`}>
                  {overviewData.onRoadOrdersCount} Yolda
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('finance');
                setMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center ${
                sidebarCollapsed ? 'md:justify-center md:h-11 md:px-0 justify-between px-3 py-2.5' : 'justify-between px-3 py-2.5'
              } rounded-xl font-medium transition-colors cursor-pointer ${
                activeTab === 'finance'
                  ? 'bg-stone-900 text-white font-semibold shadow-xs'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
              }`}
            >
              <div className={`flex items-center ${sidebarCollapsed ? 'md:justify-center gap-2.5' : 'gap-2.5 min-w-0'}`}>
                <i className="fa-solid fa-wallet text-sm w-4 text-center"></i>
                <span className={`truncate text-xs ${sidebarCollapsed ? 'md:hidden inline' : ''}`}>Kasa &amp; Giren-Çıkan</span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 bg-emerald-50 text-emerald-700 ${sidebarCollapsed ? 'md:hidden inline' : ''}`}>
                Finans
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('users');
                setMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center ${
                sidebarCollapsed ? 'md:justify-center md:h-11 md:px-0 justify-between px-3 py-2.5' : 'justify-between px-3 py-2.5'
              } rounded-xl font-medium transition-colors cursor-pointer ${
                activeTab === 'users'
                  ? 'bg-stone-900 text-white font-semibold shadow-xs'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
              }`}
            >
              <div className={`flex items-center ${sidebarCollapsed ? 'md:justify-center gap-2.5' : 'gap-2.5 min-w-0'}`}>
                <i className="fa-solid fa-user-shield text-sm w-4 text-center"></i>
                <span className={`truncate text-xs ${sidebarCollapsed ? 'md:hidden inline' : ''}`}>Kullanıcılar &amp; Roller</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('site_content');
                setMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center ${
                sidebarCollapsed ? 'md:justify-center md:h-11 md:px-0 justify-between px-3 py-2.5' : 'justify-between px-3 py-2.5'
              } rounded-xl font-medium transition-colors cursor-pointer ${
                activeTab === 'site_content'
                  ? 'bg-stone-900 text-white font-semibold shadow-xs'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
              }`}
            >
              <div className={`flex items-center ${sidebarCollapsed ? 'md:justify-center gap-2.5' : 'gap-2.5 min-w-0'}`}>
                <i className="fa-solid fa-paintbrush text-sm w-4 text-center"></i>
                <span className={`truncate text-xs ${sidebarCollapsed ? 'md:hidden inline' : ''}`}>Sayfa Düzenleri</span>
              </div>
            </button>

            {/* Sistem Ayarları (Alt Menülü - /panel'den taşındı) */}
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('settings');
                  setSettingsExpanded((prev) => !prev);
                  if (sidebarCollapsed) setSidebarCollapsed(false);
                }}
                className={`w-full flex items-center ${
                  sidebarCollapsed ? 'md:justify-center md:h-11 md:px-0 justify-between px-3 py-2.5' : 'justify-between px-3 py-2.5'
                } rounded-xl font-medium transition-colors cursor-pointer ${
                  activeTab === 'settings'
                    ? 'bg-stone-900 text-white font-semibold shadow-xs'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                }`}
              >
                <div className={`flex items-center ${sidebarCollapsed ? 'md:justify-center gap-2.5' : 'gap-2.5 min-w-0'}`}>
                  <i className="fa-solid fa-sliders text-sm w-4 text-center"></i>
                  <span className={`truncate text-xs ${sidebarCollapsed ? 'md:hidden inline' : ''}`}>Sistem Ayarları</span>
                </div>
                <i
                  className={`fa-solid fa-chevron-down text-[10px] transition-transform duration-300 ${
                    settingsExpanded ? 'rotate-180' : ''
                  } ${sidebarCollapsed ? 'md:hidden inline' : ''}`}
                ></i>
              </button>

              {settingsExpanded && !sidebarCollapsed && (
                <div className="pl-2 pr-1">
                  <div className="bg-stone-100/90 border border-stone-200/80 rounded-2xl p-1.5 space-y-0.5">
                    {settingsSubItems.map((sub) => {
                      const isSubActive = activeTab === 'settings' && selectedSettingsSubTab === sub.id;
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => {
                            setActiveTab('settings');
                            setSelectedSettingsSubTab(sub.id);
                            setMobileSidebarOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition-all cursor-pointer ${
                            isSubActive
                              ? 'bg-amber-400 text-stone-950 font-bold shadow-xs'
                              : 'text-stone-600 hover:text-stone-950 hover:bg-white'
                          }`}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <i className={`${sub.icon} text-xs w-4 text-center shrink-0`}></i>
                            <span className="truncate font-medium text-[11px]">{sub.label}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </nav>
        </div>

        {/* Footer Controls */}
        <div className={`p-3 pb-8 border-t border-stone-100 space-y-1.5 ${sidebarCollapsed ? 'md:px-2 md:flex md:flex-col md:items-center' : ''}`}>
          <div className="space-y-1.5 w-full">
            <div className={`px-3 py-1.5 text-[11px] text-stone-400 truncate ${sidebarCollapsed ? 'md:hidden' : ''}`}>
              <div>
                Yetkili: <strong className="text-stone-700">{adminUser?.name || 'Yönetici'}</strong>
              </div>
              <span className="inline-block mt-0.5 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/70 px-2 py-0.2 rounded-md">
                {adminUser?.role || 'Süper Yönetici'}
              </span>
            </div>

            <a
              href="/panel"
              onClick={() => setMobileSidebarOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-stone-700 bg-stone-100 hover:bg-stone-200 font-bold transition-colors text-xs ${
                sidebarCollapsed ? 'md:w-10 md:h-10 md:justify-center md:px-0' : ''
              }`}
              title="Operasyon Paneline Geç (/panel)"
            >
              <i className="fa-solid fa-kitchen-set text-xs w-4 text-center text-brand-600"></i>
              <span className={`truncate ${sidebarCollapsed ? 'md:hidden' : ''}`}>Operasyon Paneli (/panel)</span>
            </a>

            <a
              href="/kurye"
              target="_blank"
              rel="noreferrer"
              onClick={() => setMobileSidebarOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-amber-700 bg-amber-50/70 hover:bg-amber-100/80 font-bold transition-colors text-xs ${
                sidebarCollapsed ? 'md:w-10 md:h-10 md:justify-center md:px-0' : ''
              }`}
              title="Kurye Panelini Aç"
            >
              <i className="fa-solid fa-motorcycle text-xs w-4 text-center text-amber-600"></i>
              <span className={`truncate ${sidebarCollapsed ? 'md:hidden' : ''}`}>Kurye Paneli (/kurye)</span>
            </a>

            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              onClick={() => setMobileSidebarOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors text-xs ${
                sidebarCollapsed ? 'md:w-10 md:h-10 md:justify-center md:px-0' : ''
              }`}
              title="Müşteri Sitesi"
            >
              <i className="fa-solid fa-arrow-up-right-from-square text-xs w-4 text-center"></i>
              <span className={`truncate ${sidebarCollapsed ? 'md:hidden' : ''}`}>Müşteri Sitesi</span>
            </a>

            <button
              type="button"
              onClick={handleLogout}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 font-semibold transition-colors text-xs cursor-pointer ${
                sidebarCollapsed ? 'md:w-10 md:h-10 md:justify-center md:px-0' : ''
              }`}
              title="Çıkış Yap"
            >
              <i className="fa-solid fa-arrow-right-from-bracket text-xs w-4 text-center"></i>
              <span className={`truncate ${sidebarCollapsed ? 'md:hidden' : ''}`}>Çıkış Yap</span>
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA (/panel ile aynı topbar & container) */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-stone-200 px-3 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden h-9 px-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-stone-900 flex items-center gap-1.5 text-xs font-extrabold cursor-pointer shrink-0 shadow-2xs"
            >
              <i className="fa-solid fa-bars"></i>
              <span>Menü</span>
            </button>
            <h2 className="font-bold text-stone-800 text-sm sm:text-base truncate">
              {activeTab === 'overview' && 'Yönetim Genel Bakış'}
              {activeTab === 'finance' && 'Kasa & Giren-Çıkan Paralar'}
              {activeTab === 'users' && 'Kullanıcılar & Rol Modelleri Yönetimi'}
              {activeTab === 'site_content' && 'Sayfa Düzenleri & Vitrin Stüdyosu'}
              {activeTab === 'settings' && 'Sistem & Panel Ayarları'}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={fetchFinanceData}
              className="w-8 h-8 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center text-xs cursor-pointer"
              title="Verileri Yenile"
            >
              <i className={`fa-solid fa-rotate-right ${loadingFinance ? 'animate-spin' : ''}`}></i>
            </button>
          </div>
        </header>

        {/* TAB 0: GENEL BAKIŞ */}
        {activeTab === 'overview' && (
          <div className="p-3 sm:p-6 space-y-4 w-full min-w-0">
            {/* 1. Gün İçi Özet Şeridi */}
            <div className="bg-white rounded-2xl border border-stone-200 grid grid-cols-2 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-stone-100">
              <div className="p-4">
                <span className="text-[11px] font-semibold text-stone-500 flex items-center justify-between">
                  <span>Bugünkü Site Ziyaretçisi</span>
                  <i className="fa-solid fa-users-viewfinder text-indigo-500 text-xs"></i>
                </span>
                <p className="text-2xl font-extrabold text-indigo-600 mt-0.5">
                  {visitorStats.todayCount}
                </p>
                <span className="text-[11px] text-stone-400">
                  7 Gün: {visitorStats.last7DaysCount} &bull; Toplam: {visitorStats.totalCount}
                </span>
              </div>

              <div className="p-4">
                <span className="text-[11px] font-semibold text-stone-500 block">
                  Gün İçi Giden Sipariş
                </span>
                <p className="text-2xl font-extrabold text-stone-900 mt-0.5">
                  {overviewData.dispatchedTodayCount}
                </p>
                <span className="text-[11px] text-stone-400">
                  {overviewData.onRoadOrdersCount} yolda &bull; {overviewData.deliveredTodayCount} teslim
                </span>
              </div>

              <div className="p-4">
                <span className="text-[11px] font-semibold text-stone-500 block">
                  Bugünkü Sipariş &amp; Ciro
                </span>
                <p className="text-2xl font-extrabold text-emerald-600 mt-0.5">
                  ₺{overviewData.todayRevenue.toFixed(2)}
                </p>
                <span className="text-[11px] text-stone-400">
                  Toplam {overviewData.todayOrdersCount} sipariş
                </span>
              </div>

              <div className="p-4">
                <span className="text-[11px] font-semibold text-stone-500 block">
                  Aktif Kurye &amp; Yolda
                </span>
                <p className="text-2xl font-extrabold text-amber-600 mt-0.5">
                  {overviewData.activeCouriersCount} / {overviewData.couriers.length}
                </p>
                <span className="text-[11px] text-stone-400">
                  Sahada aktif kurye
                </span>
              </div>

              <div className="p-4">
                <span className="text-[11px] font-semibold text-stone-500 block">
                  Mutfak / Bekleyen
                </span>
                <p className="text-2xl font-extrabold text-stone-900 mt-0.5">
                  {overviewData.kitchenOrdersCount}
                </p>
                <span className="text-[11px] text-stone-400">
                  {overviewData.unassignedOrders.length} kurye atanmamış
                </span>
              </div>
            </div>

            {/* 2. Grafiksel Günlük / Haftalık / Aylık Veriler */}
            <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-sm text-stone-900">
                    Sipariş &amp; Ciro Grafiği
                  </h3>
                  <p className="text-[11px] text-stone-400">
                    Dönem toplamı: <strong className="text-stone-700">{overviewData.periodTotalOrders}</strong> sipariş ({overviewData.periodDeliveredOrders} teslim) &bull;{' '}
                    <strong className="text-emerald-600">₺{overviewData.periodRevenue.toFixed(2)}</strong>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-1 bg-stone-100 p-1 rounded-xl">
                    {[
                      { id: 'daily', label: 'Günlük' },
                      { id: 'weekly', label: 'Haftalık' },
                      { id: 'monthly', label: 'Aylık' }
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setChartPeriod(p.id);
                          setHoveredBar(null);
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          chartPeriod === p.id
                            ? 'bg-stone-900 text-white'
                            : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  <div className="inline-flex items-center gap-1 bg-stone-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setChartMetric('count')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        chartMetric === 'count'
                          ? 'bg-white text-stone-900 shadow-2xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      Adet
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartMetric('revenue')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        chartMetric === 'revenue'
                          ? 'bg-white text-stone-900 shadow-2xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      Ciro (₺)
                    </button>
                  </div>
                </div>
              </div>

              {/* Bar Chart */}
              <div className="relative pt-8 pb-2">
                {hoveredBar !== null && overviewData.chartBars[hoveredBar] && (
                  <div className="absolute top-0 left-0 z-10 pointer-events-none inline-flex items-center gap-2 bg-stone-900 text-white text-[11px] font-semibold px-3 py-1 rounded-lg shadow-xs">
                    <span>{overviewData.chartBars[hoveredBar].label}</span>
                    <span>&bull;</span>
                    <span>{overviewData.chartBars[hoveredBar].count} sipariş</span>
                    <span>&bull;</span>
                    <span className="text-emerald-400">
                      ₺{overviewData.chartBars[hoveredBar].revenue.toFixed(2)}
                    </span>
                  </div>
                )}

                <div className="flex items-end gap-1 sm:gap-1.5 h-44 border-b border-stone-200 pb-1">
                  {overviewData.chartBars.map((bar, idx) => {
                    const val = chartMetric === 'revenue' ? bar.revenue : bar.count;
                    const heightPct = val > 0 ? Math.max(8, Math.round((val / overviewData.maxBarValue) * 100)) : 3;
                    return (
                      <div
                        key={bar.label + idx}
                        onMouseEnter={() => setHoveredBar(idx)}
                        onMouseLeave={() => setHoveredBar(null)}
                        className="flex-1 h-full flex flex-col items-center justify-end group cursor-pointer min-w-0"
                      >
                        <div className="w-full flex items-end justify-center h-full">
                          <div
                            style={{ height: `${heightPct}%` }}
                            className={`w-full max-w-[26px] rounded-t-md transition-all ${
                              val > 0
                                ? chartMetric === 'revenue'
                                  ? 'bg-emerald-500 group-hover:bg-emerald-600'
                                  : 'bg-stone-800 group-hover:bg-amber-500'
                                : 'bg-stone-100'
                            }`}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5 pt-1.5">
                  {overviewData.chartBars.map((bar, idx) => (
                    <span
                      key={bar.label + '_lbl_' + idx}
                      className={`flex-1 text-center text-[10px] text-stone-400 truncate ${
                        chartPeriod === 'monthly' && idx % 3 !== 0 ? 'hidden sm:block' : ''
                      }`}
                    >
                      {bar.shortLabel}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. Anlık Kurye ve Sipariş İlişkileri */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              <div className="lg:col-span-7 bg-white rounded-2xl border border-stone-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
                  <h3 className="font-bold text-sm text-stone-900 flex items-center gap-2">
                    <i className="fa-solid fa-motorcycle text-amber-500"></i>
                    <span>Anlık Kurye &amp; Sipariş İlişkisi</span>
                  </h3>
                  <span className="text-[11px] font-semibold text-stone-400">
                    {overviewData.couriers.length} kurye
                  </span>
                </div>

                {overviewData.couriers.length === 0 ? (
                  <div className="p-8 text-center text-stone-400 text-xs">
                    Henüz kayıtlı kurye bulunmuyor.
                  </div>
                ) : (
                  <div className="divide-y divide-stone-100">
                    {overviewData.couriers.map((courier) => {
                      const isBusy = courier.activeOrders.length > 0;
                      return (
                        <div key={courier.name} className="p-3.5 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${
                                  isBusy ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
                                }`}
                              ></span>
                              <span className="font-bold text-xs sm:text-sm text-stone-900 truncate">
                                {courier.name}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  isBusy
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-stone-100 text-stone-500'
                                }`}
                              >
                                {isBusy ? `${courier.activeOrders.length} Paket Yolda` : 'Müsait'}
                              </span>
                            </div>

                            <span className="text-[11px] font-semibold text-stone-500 shrink-0">
                              Bugün Teslim: <strong className="text-stone-800">{courier.deliveredToday.length}</strong> (₺{courier.deliveredTodayRevenue.toFixed(0)})
                            </span>
                          </div>

                          {isBusy && (
                            <div className="pl-4 space-y-1.5">
                              {courier.activeOrders.map((ord) => (
                                <div
                                  key={ord.id}
                                  className="bg-stone-50 border border-stone-200/80 rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-xs"
                                >
                                  <div className="min-w-0">
                                    <span className="font-bold text-stone-900">
                                      #{ord.orderNumber || ord.id}
                                    </span>
                                    <span className="text-stone-500 mx-1.5">&bull;</span>
                                    <span className="font-medium text-stone-700 truncate">
                                      {ord.customerName || 'Müşteri'}
                                    </span>
                                    {ord.address && (
                                      <p className="text-[11px] text-stone-400 truncate">
                                        {ord.address}
                                      </p>
                                    )}
                                  </div>
                                  <div className="text-right shrink-0">
                                    <span className="font-bold text-stone-900 block">
                                      ₺{Number(ord.total || 0).toFixed(2)}
                                    </span>
                                    <span className="text-[10px] text-stone-400">
                                      {ord.paymentMethod || 'Nakit'}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Atanmamış / Bekleyen Siparişler */}
              <div className="lg:col-span-5 bg-white rounded-2xl border border-stone-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
                  <h3 className="font-bold text-sm text-stone-900 flex items-center gap-2">
                    <i className="fa-solid fa-clock text-stone-400"></i>
                    <span>Kurye Bekleyen Siparişler</span>
                  </h3>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
                    {overviewData.unassignedOrders.length}
                  </span>
                </div>

                {overviewData.unassignedOrders.length === 0 ? (
                  <div className="p-8 text-center text-stone-400 text-xs">
                    Kurye bekleyen sipariş yok.
                  </div>
                ) : (
                  <div className="divide-y divide-stone-100">
                    {overviewData.unassignedOrders.slice(0, 8).map((ord) => (
                      <div
                        key={ord.id}
                        className="px-4 py-2.5 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-stone-900">
                              #{ord.orderNumber || ord.id}
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                              {ord.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-stone-500 truncate mt-0.5">
                            {ord.customerName || 'Müşteri'} {ord.address ? `• ${ord.address}` : ''}
                          </p>
                        </div>
                        <span className="font-bold text-stone-900 shrink-0">
                          ₺{Number(ord.total || 0).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: KASA & GİREN-ÇIKAN PARALAR */}
        {activeTab === 'finance' && (
          <div className="p-3 sm:p-6 space-y-4 w-full min-w-0">
            {/* Tarih Filtresi */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex flex-wrap items-center gap-1 bg-white p-1 rounded-xl border border-stone-200">
                {[
                  { id: 'today', label: 'Bugün' },
                  { id: 'week', label: 'Son 7 Gün' },
                  { id: 'month', label: 'Son 30 Gün' },
                  { id: 'all', label: 'Tümü' }
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setDateFilter(f.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      dateFilter === f.id
                        ? 'bg-stone-900 text-white'
                        : 'text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Minimal Özet Şeridi */}
            <div className="bg-white rounded-2xl border border-stone-200 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-stone-100">
              <div className="p-4 flex items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] font-semibold text-stone-500 block">Giren Para</span>
                  <p className="text-xl font-extrabold text-emerald-600 mt-0.5">
                    ₺{financeSummary.totalIn.toFixed(2)}
                  </p>
                  <span className="text-[11px] text-stone-400">
                    Sipariş: ₺{financeSummary.orderRevenueTotal.toFixed(2)} &bull; Ek: ₺{financeSummary.manualIn.toFixed(2)}
                  </span>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
              </div>

              <div className="p-4 flex items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] font-semibold text-stone-500 block">Çıkan Para</span>
                  <p className="text-xl font-extrabold text-rose-600 mt-0.5">
                    ₺{financeSummary.totalOut.toFixed(2)}
                  </p>
                  <span className="text-[11px] text-stone-400">
                    Nakit: ₺{financeSummary.cashOrdersRevenue.toFixed(2)} &bull; POS: ₺{financeSummary.cardOrdersRevenue.toFixed(2)}
                  </span>
                </div>
                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
              </div>

              <div className="p-4 flex items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] font-semibold text-stone-500 block">Net Kasa</span>
                  <p
                    className={`text-xl font-extrabold mt-0.5 ${
                      financeSummary.netCash >= 0 ? 'text-stone-900' : 'text-rose-600'
                    }`}
                  >
                    ₺{financeSummary.netCash.toFixed(2)}
                  </p>
                  <span className="text-[11px] text-stone-400">
                    {financeSummary.deliveredCount} teslim sipariş dahil
                  </span>
                </div>
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    financeSummary.netCash >= 0 ? 'bg-stone-900' : 'bg-rose-500'
                  }`}
                ></span>
              </div>
            </div>

            {/* Form + Liste */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              <div className="lg:col-span-4 bg-white p-4 rounded-2xl border border-stone-200 space-y-3.5">
                <h3 className="font-bold text-sm text-stone-900">Kasa Hareketi Ekle</h3>

                <div className="grid grid-cols-2 gap-1 bg-stone-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setTxType('out');
                      setTxCategory(EXPENSE_CATEGORIES[0]);
                    }}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      txType === 'out'
                        ? 'bg-rose-600 text-white'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    Çıkan (Gider)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTxType('in');
                      setTxCategory(INCOME_CATEGORIES[0]);
                    }}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      txType === 'in'
                        ? 'bg-emerald-600 text-white'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    Giren (Gelir)
                  </button>
                </div>

                <form onSubmit={handleAddTransaction} className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-500 mb-1">
                        Tutar (₺) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        value={txAmount}
                        onChange={(e) => setTxAmount(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-stone-400"
                        placeholder="450.00"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-500 mb-1">
                        Tarih
                      </label>
                      <input
                        type="date"
                        value={txDate}
                        onChange={(e) => setTxDate(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-2 text-xs font-semibold focus:outline-none focus:border-stone-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-500 mb-1">
                        Kategori
                      </label>
                      <select
                        value={txCategory}
                        onChange={(e) => setTxCategory(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-2 text-xs font-semibold focus:outline-none focus:border-stone-400"
                      >
                        {(txType === 'out' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-500 mb-1">
                        Kaynak
                      </label>
                      <select
                        value={txPaymentSource}
                        onChange={(e) => setTxPaymentSource(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-2 text-xs font-semibold focus:outline-none focus:border-stone-400"
                      >
                        <option value="Nakit Kasa">Nakit Kasa</option>
                        <option value="Banka / POS">Banka / POS</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-stone-500 mb-1">
                      Açıklama *
                    </label>
                    <input
                      type="text"
                      required
                      value={txDescription}
                      onChange={(e) => setTxDescription(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-stone-400"
                      placeholder="Örn: Kasap et alımı, kurye yakıtı..."
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={savingTx}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer ${
                      txType === 'out'
                        ? 'bg-rose-600 hover:bg-rose-700'
                        : 'bg-emerald-600 hover:bg-emerald-700'
                    }`}
                  >
                    {savingTx
                      ? 'Kaydediliyor...'
                      : txType === 'out'
                      ? 'Gider Kaydet'
                      : 'Gelir Kaydet'}
                  </button>
                </form>
              </div>

              <div className="lg:col-span-8 bg-white rounded-2xl border border-stone-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-stone-100 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-bold text-sm text-stone-900">
                    Hareketler ({financeSummary.filteredTx.length})
                  </h3>

                  <div className="flex items-center gap-1 bg-stone-100 p-0.5 rounded-lg">
                    {[
                      { id: 'all', label: 'Tümü' },
                      { id: 'in', label: 'Giren' },
                      { id: 'out', label: 'Çıkan' }
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTypeFilter(t.id)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition-colors ${
                          typeFilter === t.id
                            ? 'bg-white text-stone-900 shadow-2xs'
                            : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {financeSummary.filteredTx.length === 0 ? (
                  <div className="py-10 text-center text-stone-400 text-xs space-y-1.5">
                    <i className="fa-solid fa-receipt text-xl text-stone-300"></i>
                    <p>Seçili aralıkta kasa hareketi bulunmuyor.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-stone-100">
                    {financeSummary.filteredTx.map((tx) => (
                      <div
                        key={tx.id}
                        className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-stone-50/70 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              tx.type === 'in' ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                          ></span>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-semibold text-stone-900 truncate">
                              {tx.description}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-stone-400">
                              <span>{tx.category}</span>
                              <span>&bull;</span>
                              <span>{tx.paymentSource}</span>
                              <span>&bull;</span>
                              <span>{tx.date}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <span
                            className={`font-bold text-xs sm:text-sm ${
                              tx.type === 'in' ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {tx.type === 'in' ? '+' : '-'}₺{Number(tx.amount).toFixed(2)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteTransaction(tx.id)}
                            className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Kaydı Sil"
                          >
                            <i className="fa-solid fa-trash-can text-xs"></i>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: KULLANICILAR & ROLLER */}
        {activeTab === 'users' && (
          <div className="p-3 sm:p-6 lg:p-8 w-full min-w-0">
            <UsersRolesTab adminUser={adminUser} onNotify={showToast} />
          </div>
        )}

        {/* TAB 3: SAYFA DÜZENLERİ & VİTRİN */}
        {activeTab === 'site_content' && (
          <div className="p-3 sm:p-6 lg:p-8 w-full min-w-0">
            <SiteContentEditorTab />
          </div>
        )}

        {/* TAB 4: TÜM SİSTEM AYARLARI (/panel'deki SettingsTab'ın tamamı) */}
        {activeTab === 'settings' && (
          <SettingsTab
            currentSettings={adminSettings}
            currentAdmin={adminUser}
            initialSubTab={selectedSettingsSubTab}
            onSubTabChange={setSelectedSettingsSubTab}
            showToast={showToast}
            onSaveSettings={(newSettings) => {
              setAdminSettings(newSettings);
              try {
                localStorage.setItem(ADMIN_SETTINGS_KEY, JSON.stringify(newSettings));
              } catch {}
              showToast('Sistem ayarları başarıyla güncellendi.', 'success');
            }}
          />
        )}
      </div>

      {/* GLOBAL TOAST */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl text-xs font-bold text-white flex items-center gap-2 ${
              toast.type === 'error' ? 'bg-rose-700' : 'bg-emerald-700'
            }`}
          >
            <i
              className={`fa-solid ${
                toast.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'
              }`}
            ></i>
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
