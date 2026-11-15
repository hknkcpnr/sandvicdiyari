'use client';

import { useState, useEffect, useMemo } from 'react';
import UsersRolesTab from '@/components/admin/UsersRolesTab';
import SiteContentEditorTab from '@/components/admin/SiteContentEditorTab';

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
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [adminUser, setAdminUser] = useState(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [activeTab, setActiveTab] = useState('finance'); // 'finance' | 'users' | 'settings'
  const [settingsSubTab, setSettingsSubTab] = useState('system'); // 'system' | 'site_content'
  const [toast, setToast] = useState(null);

  // Finance states
  const [orders, setOrders] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loadingFinance, setLoadingFinance] = useState(false);
  const [dateFilter, setDateFilter] = useState('today'); // 'today' | 'week' | 'month' | 'all'
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'in' | 'out'

  // New transaction form
  const [txType, setTxType] = useState('out');
  const [txAmount, setTxAmount] = useState('');
  const [txCategory, setTxCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [txPaymentSource, setTxPaymentSource] = useState('Nakit Kasa');
  const [txDate, setTxDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [txDescription, setTxDescription] = useState('');
  const [savingTx, setSavingTx] = useState(false);

  // System settings
  const [adminSettings, setAdminSettings] = useState({
    soundEnabled: true,
    fontSize: 'normal',
    autoPrintReceipt: false,
    receiptFooterNote: 'Afiyet olsun! Bizi tercih ettiğiniz için teşekkürler.'
  });
  const [dbHealth, setDbHealth] = useState(null);
  const [checkingDb, setCheckingDb] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem(ADMIN_SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.name) {
          setAdminUser(parsed);
          setIsLoggedIn(true);
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
      const [ordersRes, finRes] = await Promise.all([
        fetch('/api/orders', { cache: 'no-store' }),
        fetch('/api/finance', { cache: 'no-store' })
      ]);
      const ordersJson = await ordersRes.json();
      const finJson = await finRes.json();
      if (ordersJson.success && Array.isArray(ordersJson.data)) {
        setOrders(ordersJson.data);
      }
      if (finJson.success && Array.isArray(finJson.data)) {
        setTransactions(finJson.data);
      }
    } catch (e) {
      console.error('Finans verileri alınamadı:', e);
    } finally {
      setLoadingFinance(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      fetchFinanceData();
    }
  }, [isLoggedIn]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername.trim(), password: loginPassword })
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setLoginError(json.error || 'Giriş bilgileri hatalı.');
        return;
      }
      const userObj = json.data?.user || json.data || json.user;
      const perms = Array.isArray(userObj?.permissions) ? userObj.permissions : [];
      const isAllowed =
        userObj?.role === 'Süper Yönetici' ||
        perms.includes('users') ||
        perms.includes('settings') ||
        perms.includes('view_revenue');

      if (!isAllowed) {
        setLoginError('Bu alana erişim için Yönetici yetkisi gereklidir.');
        return;
      }

      localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(userObj));
      setAdminUser(userObj);
      setIsLoggedIn(true);
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
    setIsLoggedIn(false);
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

  const saveSystemSettings = (next) => {
    setAdminSettings(next);
    try {
      localStorage.setItem(ADMIN_SETTINGS_KEY, JSON.stringify(next));
      showToast('Sistem ayarları kaydedildi.');
    } catch {
      showToast('Ayarlar kaydedilemedi.', 'error');
    }
  };

  const checkDatabaseHealth = async () => {
    setCheckingDb(true);
    try {
      const res = await fetch('/api/health/db', { cache: 'no-store' });
      const json = await res.json();
      setDbHealth(json);
    } catch {
      setDbHealth({ success: false, error: 'Bağlantı kurulamadı' });
    } finally {
      setCheckingDb(false);
    }
  };

  // Date matching helper
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

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center p-4 font-poppins">
        <div className="w-full max-w-md bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center text-2xl mx-auto">
              <i className="fa-solid fa-crown"></i>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">Yönetici Merkezi</h1>
            <p className="text-xs text-stone-400">
              Kasa (Giren/Çıkan Paralar), Kullanıcı Oluşturma &amp; Sistem Ayarları
            </p>
          </div>

          {loginError && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold p-3 rounded-xl flex items-center gap-2">
              <i className="fa-solid fa-circle-exclamation"></i>
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-stone-400 uppercase mb-1.5">
                Yönetici Kullanıcı Adı / E-posta
              </label>
              <input
                type="text"
                required
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500"
                placeholder="Kullanıcı adı veya e-posta"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-stone-400 uppercase mb-1.5">
                Şifre
              </label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl text-sm transition-all cursor-pointer shadow-lg shadow-indigo-600/20"
            >
              {loginLoading ? 'Giriş Yapılıyor...' : 'Yönetici Girişi Yap'}
            </button>
          </form>

          <div className="pt-2 border-t border-stone-800 flex items-center justify-between text-xs text-stone-400">
            <a href="/panel" className="hover:text-white transition-colors">
              &larr; Operasyon Paneli (/panel)
            </a>
            <a href="/" className="hover:text-white transition-colors">
              Müşteri Sitesi &rarr;
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 font-poppins pb-16">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-stone-950 text-white border-b border-stone-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm">
              <i className="fa-solid fa-crown text-sm"></i>
            </div>
            <div>
              <h1 className="font-black text-sm sm:text-base leading-tight">
                Yönetici Merkezi
              </h1>
              <span className="text-[11px] text-indigo-300 font-semibold block">
                {adminUser?.name} &bull; {adminUser?.role || 'Yönetici'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/panel"
              className="bg-stone-800 hover:bg-stone-700 text-stone-100 text-xs font-bold px-3 py-2 rounded-xl border border-stone-700 transition-colors flex items-center gap-1.5"
            >
              <i className="fa-solid fa-kitchen-set text-amber-400"></i>
              <span>Operasyon Paneli (/panel)</span>
            </a>
            <a
              href="/kurye"
              target="_blank"
              rel="noreferrer"
              className="bg-stone-800 hover:bg-stone-700 text-stone-100 text-xs font-bold px-3 py-2 rounded-xl border border-stone-700 transition-colors flex items-center gap-1.5"
            >
              <i className="fa-solid fa-motorcycle text-sky-400"></i>
              <span className="hidden sm:inline">Kurye</span>
            </a>
            <button
              type="button"
              onClick={handleLogout}
              className="bg-rose-950/70 hover:bg-rose-900 text-rose-200 text-xs font-bold px-3 py-2 rounded-xl border border-rose-800/70 transition-colors cursor-pointer"
              title="Çıkış Yap"
            >
              <i className="fa-solid fa-arrow-right-from-bracket"></i>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {[
            { id: 'finance', label: 'Kasa & Giren-Çıkan Paralar', icon: 'fa-solid fa-wallet' },
            { id: 'users', label: 'Kullanıcı Oluşturma & Roller', icon: 'fa-solid fa-user-shield' },
            { id: 'settings', label: 'Sistem & Site Ayarları', icon: 'fa-solid fa-sliders' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-stone-900 text-stone-400 hover:text-white hover:bg-stone-800'
              }`}
            >
              <i className={tab.icon}></i>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* TAB 1: KASA & GİREN-ÇIKAN PARALAR */}
        {activeTab === 'finance' && (
          <div className="space-y-6">
            {/* Period Filter & Refresh */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-stone-200 shadow-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'today', label: 'Bugün' },
                  { id: 'week', label: 'Son 7 Gün' },
                  { id: 'month', label: 'Son 30 Gün' },
                  { id: 'all', label: 'Tüm Zamanlar' }
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setDateFilter(f.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      dateFilter === f.id
                        ? 'bg-stone-900 text-white'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={fetchFinanceData}
                disabled={loadingFinance}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <i className={`fa-solid fa-rotate-right ${loadingFinance ? 'animate-spin' : ''}`}></i>
                <span>Yenile</span>
              </button>
            </div>

            {/* Summary KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-3xl border border-emerald-200 shadow-xs space-y-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                  <i className="fa-solid fa-arrow-trend-up"></i>
                  Toplam Giren Para
                </span>
                <p className="text-2xl sm:text-3xl font-black text-emerald-700">
                  ₺{financeSummary.totalIn.toFixed(2)}
                </p>
                <p className="text-[11px] text-stone-500">
                  Siparişler ({financeSummary.deliveredCount} adet): <strong>₺{financeSummary.orderRevenueTotal.toFixed(2)}</strong> &bull; Ek Giriş: <strong>₺{financeSummary.manualIn.toFixed(2)}</strong>
                </p>
                <p className="text-[11px] text-stone-400">
                  Nakit: ₺{financeSummary.cashOrdersRevenue.toFixed(2)} &bull; Kart/POS: ₺{financeSummary.cardOrdersRevenue.toFixed(2)}
                </p>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-rose-200 shadow-xs space-y-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                  <i className="fa-solid fa-arrow-trend-down"></i>
                  Toplam Çıkan Para (Gider)
                </span>
                <p className="text-2xl sm:text-3xl font-black text-rose-600">
                  ₺{financeSummary.totalOut.toFixed(2)}
                </p>
                <p className="text-[11px] text-stone-500">
                  Malzeme, personel, kira, yakıt ve diğer kasa çıkışları toplamı.
                </p>
              </div>

              <div className="bg-stone-900 text-white p-5 rounded-3xl border border-stone-800 shadow-md space-y-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <i className="fa-solid fa-scale-balanced"></i>
                  Net Kasa Durumu
                </span>
                <p
                  className={`text-2xl sm:text-3xl font-black ${
                    financeSummary.netCash >= 0 ? 'text-white' : 'text-rose-400'
                  }`}
                >
                  ₺{financeSummary.netCash.toFixed(2)}
                </p>
                <p className="text-[11px] text-stone-400">
                  Seçili dönemdeki net gelir - gider farkı
                </p>
              </div>
            </div>

            {/* Form + Ledger Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left: New Cash Transaction Form */}
              <div className="lg:col-span-4 bg-white p-5 rounded-3xl border border-stone-200 shadow-xs space-y-4">
                <h2 className="font-black text-base text-stone-900 flex items-center gap-2">
                  <i className="fa-solid fa-plus-circle text-indigo-600"></i>
                  <span>Yeni Kasa Hareketi Ekle</span>
                </h2>

                <div className="grid grid-cols-2 gap-2 bg-stone-100 p-1 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => {
                      setTxType('out');
                      setTxCategory(EXPENSE_CATEGORIES[0]);
                    }}
                    className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      txType === 'out'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    Çıkan Para (Gider)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTxType('in');
                      setTxCategory(INCOME_CATEGORIES[0]);
                    }}
                    className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      txType === 'in'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    Giren Para (Gelir)
                  </button>
                </div>

                <form onSubmit={handleAddTransaction} className="space-y-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                      Tutar (₺) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={txAmount}
                      onChange={(e) => setTxAmount(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm font-bold focus:outline-none focus:border-indigo-500"
                      placeholder="Örn: 450.00"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                        Kategori
                      </label>
                      <select
                        value={txCategory}
                        onChange={(e) => setTxCategory(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-indigo-500"
                      >
                        {(txType === 'out' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                        Kasa / Kaynak
                      </label>
                      <select
                        value={txPaymentSource}
                        onChange={(e) => setTxPaymentSource(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-indigo-500"
                      >
                        <option value="Nakit Kasa">Nakit Kasa</option>
                        <option value="Banka / POS">Banka / POS</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                      Tarih
                    </label>
                    <input
                      type="date"
                      value={txDate}
                      onChange={(e) => setTxDate(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs font-bold focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                      Açıklama *
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={txDescription}
                      onChange={(e) => setTxDescription(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:outline-none focus:border-indigo-500"
                      placeholder="Örn: Kasap et alımı, kurye yakıtı..."
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={savingTx}
                    className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-wider text-white shadow-md transition-all cursor-pointer ${
                      txType === 'out'
                        ? 'bg-rose-600 hover:bg-rose-700'
                        : 'bg-emerald-600 hover:bg-emerald-700'
                    }`}
                  >
                    {savingTx
                      ? 'Kaydediliyor...'
                      : txType === 'out'
                      ? 'Gider (Çıkış) Kaydet'
                      : 'Gelir (Giriş) Kaydet'}
                  </button>
                </form>
              </div>

              {/* Right: Transaction Ledger */}
              <div className="lg:col-span-8 bg-white p-5 rounded-3xl border border-stone-200 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-black text-base text-stone-900">
                    Kasa Hareketleri ({financeSummary.filteredTx.length})
                  </h2>

                  <div className="flex items-center gap-1.5">
                    {[
                      { id: 'all', label: 'Tümü' },
                      { id: 'in', label: 'Girenler' },
                      { id: 'out', label: 'Çıkanlar' }
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTypeFilter(t.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                          typeFilter === t.id
                            ? 'bg-stone-900 text-white'
                            : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {financeSummary.filteredTx.length === 0 ? (
                  <div className="py-12 text-center text-stone-400 text-xs space-y-2 border border-dashed border-stone-200 rounded-2xl">
                    <i className="fa-solid fa-receipt text-2xl"></i>
                    <p>Seçili aralıkta manuel kasa hareketi bulunmuyor.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-stone-100">
                    {financeSummary.filteredTx.map((tx) => (
                      <div
                        key={tx.id}
                        className="py-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <span
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-sm ${
                              tx.type === 'in'
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                : 'bg-rose-50 text-rose-600 border border-rose-200'
                            }`}
                          >
                            <i
                              className={`fa-solid ${
                                tx.type === 'in' ? 'fa-arrow-down' : 'fa-arrow-up'
                              }`}
                            ></i>
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-bold text-stone-900 break-words">
                              {tx.description}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-stone-500 mt-0.5">
                              <span className="bg-stone-100 px-2 py-0.5 rounded-md font-semibold">
                                {tx.category}
                              </span>
                              <span>{tx.paymentSource}</span>
                              <span>&bull; {tx.date}</span>
                              {tx.createdBy && <span>&bull; {tx.createdBy}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 ml-auto">
                          <span
                            className={`font-black text-sm sm:text-base ${
                              tx.type === 'in' ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {tx.type === 'in' ? '+' : '-'}₺{Number(tx.amount).toFixed(2)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteTransaction(tx.id)}
                            className="w-8 h-8 rounded-lg bg-stone-100 hover:bg-rose-100 text-stone-400 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer"
                            title="Kaydı Sil"
                          >
                            <i className="fa-solid fa-trash text-xs"></i>
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

        {/* TAB 2: KULLANICI OLUŞTURMA & ROLLER */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-3xl border border-stone-200 p-4 sm:p-6 shadow-xs">
            <UsersRolesTab adminUser={adminUser} onNotify={showToast} />
          </div>
        )}

        {/* TAB 3: SİSTEM & SİTE AYARLARI */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-stone-200 w-fit">
              <button
                type="button"
                onClick={() => setSettingsSubTab('system')}
                className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                  settingsSubTab === 'system'
                    ? 'bg-stone-900 text-white'
                    : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                Sistem, Ses &amp; Veritabanı Ayarları
              </button>
              <button
                type="button"
                onClick={() => setSettingsSubTab('site_content')}
                className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                  settingsSubTab === 'site_content'
                    ? 'bg-stone-900 text-white'
                    : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                Site İçeriği &amp; Vitrin Düzeni
              </button>
            </div>

            {settingsSubTab === 'system' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Panel & Ses Ayarları */}
                <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-xs space-y-5">
                  <h3 className="font-black text-base text-stone-900 flex items-center gap-2">
                    <i className="fa-solid fa-sliders text-indigo-600"></i>
                    <span>Panel &amp; Bildirim Ayarları</span>
                  </h3>

                  <div className="flex items-center justify-between gap-4 py-2 border-b border-stone-100">
                    <div>
                      <p className="text-xs font-bold text-stone-900">Mutfak Zili &amp; Sesli Uyarı</p>
                      <p className="text-[11px] text-stone-500">Yeni siparişlerde sesli alarm çalsın</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        saveSystemSettings({
                          ...adminSettings,
                          soundEnabled: !adminSettings.soundEnabled
                        })
                      }
                      className={`px-4 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                        adminSettings.soundEnabled
                          ? 'bg-emerald-600 text-white'
                          : 'bg-stone-200 text-stone-700'
                      }`}
                    >
                      {adminSettings.soundEnabled ? 'Açık' : 'Kapalı'}
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-4 py-2 border-b border-stone-100">
                    <div>
                      <p className="text-xs font-bold text-stone-900">Panel Yazı Boyutu</p>
                      <p className="text-[11px] text-stone-500">Operasyon paneli okunabilirliği</p>
                    </div>
                    <select
                      value={adminSettings.fontSize || 'normal'}
                      onChange={(e) =>
                        saveSystemSettings({ ...adminSettings, fontSize: e.target.value })
                      }
                      className="bg-stone-50 border border-stone-200 rounded-xl px-3 py-1.5 text-xs font-bold"
                    >
                      <option value="normal">Normal</option>
                      <option value="large">Büyük</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-stone-900">
                      Adisyon / Fiş Alt Notu
                    </label>
                    <input
                      type="text"
                      value={adminSettings.receiptFooterNote || ''}
                      onChange={(e) =>
                        saveSystemSettings({ ...adminSettings, receiptFooterNote: e.target.value })
                      }
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2 text-xs font-medium"
                    />
                  </div>
                </div>

                {/* Veritabanı & Sistem Durumu */}
                <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-xs space-y-5">
                  <h3 className="font-black text-base text-stone-900 flex items-center gap-2">
                    <i className="fa-solid fa-database text-emerald-600"></i>
                    <span>Veritabanı &amp; Sistem Durumu</span>
                  </h3>

                  <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-stone-500 font-semibold">Çalışma Saatleri:</span>
                      <span className="font-bold text-stone-900">10:00 - 03:00</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-stone-500 font-semibold">Operasyon Paneli Yolu:</span>
                      <code className="bg-stone-200/70 px-2 py-0.5 rounded font-bold">/panel</code>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-stone-500 font-semibold">Yönetici Merkezi Yolu:</span>
                      <code className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-bold">/yonetici</code>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={checkDatabaseHealth}
                    disabled={checkingDb}
                    className="w-full bg-stone-900 hover:bg-stone-800 text-white font-bold py-3 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <i className={`fa-solid fa-heart-pulse ${checkingDb ? 'animate-pulse' : ''}`}></i>
                    <span>{checkingDb ? 'Kontrol Ediliyor...' : 'PostgreSQL Bağlantısını Test Et'}</span>
                  </button>

                  {dbHealth && (
                    <div
                      className={`p-3 rounded-xl text-xs font-semibold border ${
                        dbHealth.success
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-rose-50 border-rose-200 text-rose-800'
                      }`}
                    >
                      {dbHealth.success
                        ? 'Veritabanı bağlantısı sağlıklı (Aktif).'
                        : `Bağlantı hatası: ${dbHealth.error || 'Bilinmeyen hata'}`}
                    </div>
                  )}
                </div>
              </div>
            )}

            {settingsSubTab === 'site_content' && (
              <div className="bg-white rounded-3xl border border-stone-200 p-4 sm:p-6 shadow-xs">
                <SiteContentEditorTab onNotify={showToast} />
              </div>
            )}
          </div>
        )}
      </main>

      {/* Toast */}
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
