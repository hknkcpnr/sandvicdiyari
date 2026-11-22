'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

const CATEGORY_TABS = [
  { id: 'ALL', label: 'Tüm İşlemler', icon: 'fa-solid fa-list-ul' },
  { id: 'ORDER', label: 'Sipariş & Operasyon', icon: 'fa-solid fa-bell-concierge' },
  { id: 'MENU', label: 'Menü & Ürünler', icon: 'fa-solid fa-burger' },
  { id: 'USER', label: 'Kullanıcı & Yetkiler', icon: 'fa-solid fa-user-shield' },
  { id: 'SYSTEM', label: 'Sistem & Giriş', icon: 'fa-solid fa-shield-halved' },
];

const LEVEL_STYLES = {
  INFO: {
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
    icon: 'fa-solid fa-check text-emerald-600',
  },
  WARN: {
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
    icon: 'fa-solid fa-triangle-exclamation text-amber-600',
  },
  CRITICAL: {
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-500',
    icon: 'fa-solid fa-skull-crossbones text-rose-600',
  },
  ERROR: {
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-500',
    icon: 'fa-solid fa-circle-xmark text-rose-600',
  },
};

function formatRelativeTime(isoString) {
  try {
    const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diff < 5) return 'Az önce';
    if (diff < 60) return `${diff} sn önce`;
    const mins = Math.floor(diff / 60);
    if (mins < 60) return `${mins} dk önce`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} sa önce`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} gün önce`;
    return new Date(isoString).toLocaleDateString('tr-TR');
  } catch {
    return 'Bilinmiyor';
  }
}

export default function ActivityLogsTab({ showToast, currentAdmin }) {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ total: 0, orders: 0, menu: 0, users: 0, system: 0 });
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [isClearing, setIsClearing] = useState(false);

  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (activeCategory !== 'ALL') params.set('category', activeCategory);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      params.set('limit', '200');

      const res = await fetch(`/api/admin/logs?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success && json.data) {
        setLogs(json.data.logs || []);
        if (json.data.stats) setStats(json.data.stats);
      }
    } catch (err) {
      console.warn('Log verisi alınamadı:', err);
    } finally {
      setLoading(false);
    }
  }, [activeCategory, searchQuery]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Canlı Otomatik Yenileme (15 saniyede bir)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchLogs();
    }, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  // Logları Temizle
  const handleClearLogs = async () => {
    if (!confirm('Tüm kullanıcı işlem geçmişi silinecektir. Devam etmek istiyor musunuz?')) return;
    setIsClearing(true);
    try {
      const res = await fetch('/api/admin/logs', { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setLogs([]);
        setStats({ total: 0, orders: 0, menu: 0, users: 0, system: 0 });
        if (showToast) showToast('İşlem logları temizlendi.', 'success');
      } else {
        if (showToast) showToast(json.error || 'Temizlenemedi.', 'error');
      }
    } catch {
      if (showToast) showToast('Bağlantı hatası oluştu.', 'error');
    } finally {
      setIsClearing(false);
    }
  };

  // Dışa Aktar (JSON İndir)
  const handleExportJson = () => {
    try {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `islem_loglari_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      if (showToast) showToast('İşlem logları JSON olarak indirildi.', 'success');
    } catch {
      if (showToast) showToast('Dışa aktarma başarısız.', 'error');
    }
  };

  return (
    <div className="space-y-4 w-full min-w-0 font-poppins">
      {/* 1. ÜST İSTATİSTİK KARTLARI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Toplam İşlem */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-stone-400">
            <span className="text-xs font-semibold">Toplam İşlem</span>
            <span className="w-7 h-7 rounded-lg bg-stone-100 flex items-center justify-center text-xs text-stone-700">
              <i className="fa-solid fa-clock-rotate-left"></i>
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-stone-900">{stats.total || logs.length}</p>
          <span className="text-[10px] text-stone-500 font-medium block">Sistem genelindeki kayıtlar</span>
        </div>

        {/* Sipariş & İptal */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-amber-500">
            <span className="text-xs font-semibold text-stone-600">Sipariş & Operasyon</span>
            <span className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200/60 flex items-center justify-center text-xs text-amber-700">
              <i className="fa-solid fa-bell-concierge"></i>
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-stone-900">{stats.orders || 0}</p>
          <span className="text-[10px] text-amber-700/80 font-medium block">Onay, durum ve silmeler</span>
        </div>

        {/* Menü & Fiyat */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-rose-500">
            <span className="text-xs font-semibold text-stone-600">Menü & Fiyatlar</span>
            <span className="w-7 h-7 rounded-lg bg-rose-50 border border-rose-200/60 flex items-center justify-center text-xs text-rose-700">
              <i className="fa-solid fa-burger"></i>
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-stone-900">{stats.menu || 0}</p>
          <span className="text-[10px] text-rose-700/80 font-medium block">Ürün & fiyat güncellemeleri</span>
        </div>

        {/* Kullanıcı & Yetki */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-indigo-500">
            <span className="text-xs font-semibold text-stone-600">Kullanıcı & Güvenlik</span>
            <span className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200/60 flex items-center justify-center text-xs text-indigo-700">
              <i className="fa-solid fa-user-shield"></i>
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-stone-900">{(stats.users || 0) + (stats.system || 0)}</p>
          <span className="text-[10px] text-indigo-700/80 font-medium block">Girişler ve yetki atamaları</span>
        </div>
      </div>

      {/* 2. EYLEM & FİLTRELEME ÇUBUĞU */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-stone-200/90 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Sol: Kategori Hap Butonları */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 lg:pb-0">
            {CATEGORY_TABS.map((tab) => {
              const isActive = activeCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveCategory(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-stone-900 text-white shadow-2xs'
                      : 'text-stone-600 hover:text-stone-950 bg-stone-100 hover:bg-stone-200'
                  }`}
                >
                  <i className={`${tab.icon} ${isActive ? 'text-amber-400' : 'text-stone-400'}`}></i>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Sağ: Arama, Yenile, İndir, Temizle */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Arama Inputu */}
            <div className="relative w-full sm:w-56">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Kullanıcı, işlem veya sipariş ara..."
                className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-8 pr-7 py-2 text-xs focus:outline-none focus:border-stone-900 focus:bg-white font-medium transition-all"
              />
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs"></i>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              )}
            </div>

            {/* Yenile */}
            <button
              type="button"
              onClick={fetchLogs}
              title="Listeyi Yenile"
              className="p-2 rounded-xl text-stone-600 hover:text-stone-900 bg-stone-50 hover:bg-stone-100 border border-stone-200 transition-colors cursor-pointer"
            >
              <i className={`fa-solid fa-arrows-rotate text-xs ${loading ? 'fa-spin' : ''}`}></i>
            </button>

            {/* Otomatik Yenileme Toggle */}
            <button
              type="button"
              onClick={() => setAutoRefresh(!autoRefresh)}
              title={autoRefresh ? 'Canlı Takip Aktif (15 sn)' : 'Canlı Takip Kapalı'}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center gap-1.5 ${
                autoRefresh
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-stone-50 text-stone-500 border-stone-200'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-stone-400'}`}></span>
              <span className="hidden sm:inline">{autoRefresh ? 'Canlı Akış' : 'Statik'}</span>
            </button>

            {/* Dışa Aktar */}
            <button
              type="button"
              onClick={handleExportJson}
              title="JSON İndir"
              className="px-3 py-2 rounded-xl text-xs font-bold text-stone-700 bg-stone-50 hover:bg-stone-100 border border-stone-200 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <i className="fa-solid fa-download text-stone-500"></i>
              <span className="hidden sm:inline">Dışa Aktar</span>
            </button>

            {/* Logları Temizle */}
            <button
              type="button"
              disabled={isClearing || logs.length === 0}
              onClick={handleClearLogs}
              title="Tüm Logları Temizle"
              className="px-3 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <i className="fa-solid fa-trash-can text-rose-600"></i>
              <span className="hidden sm:inline">Temizle</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. LOG LİSTESİ */}
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs overflow-hidden">
        <div className="px-4 sm:px-5 py-3 bg-stone-50/80 border-b border-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold text-stone-900">İşlem Günlüğü</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-200 text-stone-700">
              {logs.length} Kayıt
            </span>
          </div>
          <span className="text-[11px] text-stone-500 hidden sm:inline">
            Kim, ne zaman, hangi işlemi gerçekleştirdi
          </span>
        </div>

        {logs.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-stone-100 text-stone-400 flex items-center justify-center text-2xl mx-auto shadow-2xs">
              <i className="fa-solid fa-clipboard-list"></i>
            </div>
            <h4 className="text-sm font-extrabold text-stone-900">Henüz Kayıtlı İşlem Bulunmuyor</h4>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              Personeller sipariş sildiğinde, durumu güncellediğinde, ürün veya fiyat değiştirdiğinde tüm hareketler burada canlı listelenecektir.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {logs.map((log) => {
              const level = LEVEL_STYLES[log.level] || LEVEL_STYLES.INFO;
              const isExpanded = expandedLogId === log.id;
              const hasDetails = log.details && Object.keys(log.details).length > 0;

              return (
                <div
                  key={log.id}
                  className="p-3.5 sm:p-4 hover:bg-stone-50/70 transition-colors flex flex-col gap-2"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    {/* Sol: İkon + Kullanıcı + Mesaj */}
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {/* Seviye & Kategori Rozeti */}
                      <div className="w-8 h-8 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center text-xs shrink-0 mt-0.5 shadow-2xs">
                        <i
                          className={
                            log.category === 'ORDER'
                              ? 'fa-solid fa-bell-concierge text-amber-600'
                              : log.category === 'MENU'
                              ? 'fa-solid fa-burger text-rose-600'
                              : log.category === 'USER'
                              ? 'fa-solid fa-user-shield text-indigo-600'
                              : 'fa-solid fa-shield-halved text-stone-700'
                          }
                        ></i>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                          {/* Kullanıcı Adı */}
                          <span className="font-extrabold text-xs text-stone-900">
                            {log.user?.name || 'Sistem'}
                          </span>

                          {/* Rol Rozeti */}
                          {log.user?.role && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 border border-stone-200/60">
                              {log.user.role}
                            </span>
                          )}

                          {/* Kategori Rozeti */}
                          <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded border ${level.badge}`}>
                            {log.category}
                          </span>

                          {/* Action Etiketi */}
                          {log.action && (
                            <span className="text-[10px] font-mono text-stone-400">
                              #{log.action}
                            </span>
                          )}
                        </div>

                        {/* Açıklama Metni */}
                        <p className="text-xs text-stone-800 font-medium leading-relaxed">
                          {log.message}
                        </p>
                      </div>
                    </div>

                    {/* Sağ: Zaman & IP */}
                    <div className="flex items-center gap-2 self-start sm:self-center shrink-0 text-right">
                      <div className="text-[11px] text-stone-500 font-medium">
                        <span className="font-bold text-stone-700">{formatRelativeTime(log.timestamp)}</span>
                        <span className="block text-[10px] text-stone-400 font-mono">
                          {new Date(log.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>

                      {hasDetails && (
                        <button
                          type="button"
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200/50 cursor-pointer text-xs"
                          title="Detayları Göster / Gizle"
                        >
                          <i className={`fa-solid ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Genişletilebilir Detay Paneli */}
                  {isExpanded && hasDetails && (
                    <div className="mt-2 bg-stone-900 text-emerald-400 font-mono text-[11px] p-3 rounded-xl overflow-x-auto shadow-inner border border-stone-800">
                      <pre>{JSON.stringify(log.details, null, 2)}</pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
