'use client';

import { useState, useMemo, useEffect } from 'react';
import BlurredAmount from './BlurredAmount';

// Status color and Turkish label helper
const STATUS_STYLES = {
  'Yeni': { label: 'Yeni Sipariş', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500 animate-ping' },
  'Görüntülendi': { label: 'Görüntülendi', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-400' },
  'Onaylandı': { label: 'Onaylandı', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  'Hazırlanıyor': { label: 'Hazırlanıyor', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
  'Hazır': { label: 'Sipariş Hazır', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500' },
  'Kurye Teslim Aldı': { label: 'Kurye Aldı', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500' },
  'Yolda': { label: 'Yolda', bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', dot: 'bg-sky-500' },
  'Teslim Edildi': { label: 'Teslim Edildi', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', dot: 'bg-green-500' },
  'İptal Edildi': { label: 'İptal Edildi', bg: 'bg-stone-100', text: 'text-stone-500', border: 'border-stone-200', dot: 'bg-stone-400' },
};

function formatElapsedTime(isoString) {
  if (!isoString) return '';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Az önce';
  if (diffMins < 60) return `${diffMins} dk önce`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} saat önce`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} gün önce`;
}

export default function OverviewDashboard({
  orders = [],
  products = [],
  onOpenOrderDetail,
  onAcceptOrder,
  onNavigateToOrders,
  onRefresh,
  onExportCsv,
  onPrintZReport,
  loading = false,
  canViewRevenue = false,
  isCourierEnabled: propCourierEnabled,
}) {
  const [localCourierEnabled, setLocalCourierEnabled] = useState(true);

  useEffect(() => {
    try {
      const sdCourier = localStorage.getItem('sd_courier_module_enabled');
      if (sdCourier !== null) {
        setLocalCourierEnabled(sdCourier !== 'false');
      }
    } catch {}
    const handleStorage = () => {
      try {
        const sdCourier = localStorage.getItem('sd_courier_module_enabled');
        if (sdCourier !== null) {
          setLocalCourierEnabled(sdCourier !== 'false');
        }
      } catch {}
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('sd_courier_module_updated', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('sd_courier_module_updated', handleStorage);
    };
  }, []);

  const isCourierEnabled = typeof propCourierEnabled === 'boolean' ? propCourierEnabled : localCourierEnabled;

  // Date filter state: 'today' | 'yesterday' | 'last7' | 'last30' | 'all' | 'custom'
  const [dateFilter, setDateFilter] = useState('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Chart Metric: Operasyonel görünümde yalnızca sipariş adedi gösterilir
  const [chartMetric, setChartMetric] = useState('count');
  const [hoveredBar, setHoveredBar] = useState(null);
  const [visitorStats, setVisitorStats] = useState({
    todayCount: 0,
    yesterdayCount: 0,
    last7DaysCount: 0,
    last30DaysCount: 0,
    totalCount: 0,
    dailyCounts: {}
  });

  useEffect(() => {
    let active = true;
    const loadVisitors = () => {
      fetch('/api/visitors', { cache: 'no-store' })
        .then((r) => r.json())
        .then((j) => {
          if (active && j?.success && j.data) {
            setVisitorStats(j.data);
          }
        })
        .catch(() => {});
    };
    loadVisitors();
    const timer = setInterval(loadVisitors, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const periodVisitorCount = useMemo(() => {
    if (dateFilter === 'today') return visitorStats.todayCount || 0;
    if (dateFilter === 'yesterday') return visitorStats.yesterdayCount || 0;
    if (dateFilter === 'last7') return visitorStats.last7DaysCount || 0;
    if (dateFilter === 'last30') return visitorStats.last30DaysCount || 0;
    if (dateFilter === 'custom') {
      const map = visitorStats.dailyCounts || {};
      let sum = 0;
      for (const [dKey, c] of Object.entries(map)) {
        if ((!customStart || dKey >= customStart) && (!customEnd || dKey <= customEnd)) {
          sum += Number(c || 0);
        }
      }
      return sum;
    }
    return visitorStats.totalCount || 0;
  }, [dateFilter, visitorStats, customStart, customEnd]);

  // Filter orders by date range
  const filteredOrders = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayEnd = new Date(todayEnd.getTime() - 24 * 60 * 60 * 1000);

    const sevenDaysAgo = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(todayStart.getTime() - 29 * 24 * 60 * 60 * 1000);

    return orders.filter((o) => {
      if (!o.createdAt) return false;
      const oDate = new Date(o.createdAt);
      if (isNaN(oDate.getTime())) return false;

      if (dateFilter === 'today') {
        return oDate >= todayStart && oDate <= todayEnd;
      }
      if (dateFilter === 'yesterday') {
        return oDate >= yesterdayStart && oDate <= yesterdayEnd;
      }
      if (dateFilter === 'last7') {
        return oDate >= sevenDaysAgo && oDate <= todayEnd;
      }
      if (dateFilter === 'last30') {
        return oDate >= thirtyDaysAgo && oDate <= todayEnd;
      }
      if (dateFilter === 'custom') {
        if (!customStart && !customEnd) return true;
        const start = customStart ? new Date(customStart + 'T00:00:00') : new Date(0);
        const end = customEnd ? new Date(customEnd + 'T23:59:59') : new Date(9999999999999);
        return oDate >= start && oDate <= end;
      }
      return true; // 'all'
    });
  }, [orders, dateFilter, customStart, customEnd]);

  // Financial Metrics
  const metrics = useMemo(() => {
    // Kesinleşmiş Ciro: Yalnızca teslim edilen ve elden tahsil edilenler
    const confirmedRevenue = filteredOrders
      .filter((o) => o.status === 'Teslim Edildi' && o.paymentStatus === 'Ödendi')
      .reduce((sum, o) => sum + (Number(o.total) || Number(o.subtotal) || 0), 0);

    // Beklenen Ciro: Aktif mutfakta/yoldaki siparişler
    const pendingRevenue = filteredOrders
      .filter((o) => o.status !== 'Teslim Edildi' && o.status !== 'İptal Edildi')
      .reduce((sum, o) => sum + (Number(o.total) || Number(o.subtotal) || 0), 0);

    const totalCount = filteredOrders.length;
    const deliveredCount = filteredOrders.filter((o) => o.status === 'Teslim Edildi').length;
    const cancelledCount = filteredOrders.filter((o) => o.status === 'İptal Edildi').length;
    const activeCount = filteredOrders.filter((o) => o.status !== 'Teslim Edildi' && o.status !== 'İptal Edildi').length;

    // Ortalama sepet tutarı (AOV)
    const avgOrderValue = deliveredCount > 0 ? confirmedRevenue / deliveredCount : 0;

    // Tahsilat Yöntemi Dağılımı (Nakit vs POS)
    const validOrders = filteredOrders.filter((o) => o.status !== 'İptal Edildi');
    const cashTotal = validOrders
      .filter((o) => (o.paymentMethod || '').toLowerCase().includes('nakit'))
      .reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const posTotal = validOrders
      .filter((o) => !(o.paymentMethod || '').toLowerCase().includes('nakit'))
      .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    const validRevenueTotal = cashTotal + posTotal;
    const cashPercent = validRevenueTotal > 0 ? Math.round((cashTotal / validRevenueTotal) * 100) : 0;
    const posPercent = validRevenueTotal > 0 ? Math.round((posTotal / validRevenueTotal) * 100) : 0;

    return {
      confirmedRevenue,
      pendingRevenue,
      totalCount,
      deliveredCount,
      cancelledCount,
      activeCount,
      avgOrderValue,
      cashTotal,
      posTotal,
      cashPercent,
      posPercent,
    };
  }, [filteredOrders]);

  // Status Breakdown
  const statusCounts = useMemo(() => {
    const counts = {
      newAndViews: 0,
      kitchen: 0,
      courier: 0,
      delivered: 0,
      cancelled: 0,
    };

    filteredOrders.forEach((o) => {
      if (o.status === 'Yeni' || o.status === 'Görüntülendi') counts.newAndViews++;
      else if (o.status === 'Onaylandı' || o.status === 'Hazırlanıyor') counts.kitchen++;
      else if (o.status === 'Hazır' || o.status === 'Kurye Teslim Aldı' || o.status === 'Yolda') counts.courier++;
      else if (o.status === 'Teslim Edildi') counts.delivered++;
      else if (o.status === 'İptal Edildi') counts.cancelled++;
    });

    const total = filteredOrders.length || 1;
    return {
      ...counts,
      newPercent: Math.round((counts.newAndViews / total) * 100),
      kitchenPercent: Math.round((counts.kitchen / total) * 100),
      courierPercent: Math.round((counts.courier / total) * 100),
      deliveredPercent: Math.round((counts.delivered / total) * 100),
      cancelledPercent: Math.round((counts.cancelled / total) * 100),
    };
  }, [filteredOrders]);

  // Chart Data: Hourly for Today/Yesterday, Daily for 7/30 days and All
  const chartData = useMemo(() => {
    if (dateFilter === 'today' || dateFilter === 'yesterday') {
      // 2-hour slots across daytime
      const slots = [
        { label: '10:00 - 12:00', startH: 10, endH: 12 },
        { label: '12:00 - 14:00', startH: 12, endH: 14 },
        { label: '14:00 - 16:00', startH: 14, endH: 16 },
        { label: '16:00 - 18:00', startH: 16, endH: 18 },
        { label: '18:00 - 20:00', startH: 18, endH: 20 },
        { label: '20:00 - 22:00', startH: 20, endH: 22 },
        { label: '22:00 - 00:00', startH: 22, endH: 24 },
        { label: 'Gece / Diğer', startH: 0, endH: 10 },
      ];

      return slots.map((s) => {
        const slotOrders = filteredOrders.filter((o) => {
          const d = new Date(o.createdAt);
          const h = d.getHours();
          return h >= s.startH && h < s.endH;
        });

        const rev = slotOrders
          .filter((o) => o.status !== 'İptal Edildi')
          .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

        return {
          label: s.label,
          revenue: rev,
          count: slotOrders.length,
          delivered: slotOrders.filter((o) => o.status === 'Teslim Edildi').length,
        };
      });
    }

    // Default: Group by Days (Last 7 Days or matched dates)
    const daysCount = dateFilter === 'last7' ? 7 : dateFilter === 'last30' ? 14 : 7;
    const now = new Date();
    const days = [];

    for (let i = daysCount - 1; i >= 0; i--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0);
      const dayEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);

      const dayOrders = filteredOrders.filter((o) => {
        const d = new Date(o.createdAt);
        return d >= dayStart && d <= dayEnd;
      });

      const rev = dayOrders
        .filter((o) => o.status !== 'İptal Edildi')
        .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

      const dayName = targetDate.toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' });

      days.push({
        label: dayName,
        revenue: rev,
        count: dayOrders.length,
        delivered: dayOrders.filter((o) => o.status === 'Teslim Edildi').length,
      });
    }

    return days;
  }, [filteredOrders, dateFilter]);

  // Max value for chart scaling
  const maxChartValue = useMemo(() => {
    if (chartMetric === 'revenue') {
      const max = Math.max(...chartData.map((d) => d.revenue), 100);
      return max * 1.15; // 15% top padding
    } else {
      const max = Math.max(...chartData.map((d) => d.count), 5);
      return max + 1;
    }
  }, [chartData, chartMetric]);

  // Top Selling Products Calculation (Direct from real order items!)
  const topSellingProducts = useMemo(() => {
    const itemMap = {};

    filteredOrders.forEach((o) => {
      if (o.status === 'İptal Edildi') return;
      if (Array.isArray(o.items)) {
        o.items.forEach((item) => {
          const name = item.name || 'Özel Sandviç';
          if (!itemMap[name]) {
            // Find in catalog for image fallback
            const catalogItem = products.find((p) => p.name === name || p.id === item.id);
            itemMap[name] = {
              name,
              image: item.image || catalogItem?.image || '/images/hero_banner.jpg',
              category: item.category || catalogItem?.category || 'menu',
              quantity: 0,
              revenue: 0,
            };
          }
          const qty = Number(item.quantity) || 1;
          const price = Number(item.price) || 0;
          itemMap[name].quantity += qty;
          itemMap[name].revenue += qty * price;
        });
      }
    });

    const list = Object.values(itemMap).sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue);
    return list.slice(0, 5);
  }, [filteredOrders, products]);

  // Recent Orders Feed (Top 5 latest)
  const recentOrders = useMemo(() => {
    return [...filteredOrders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
  }, [filteredOrders]);

  // Live unhandled incoming orders for pulsating alert banner (Yeni or Görüntülendi)
  const newOrders = useMemo(() => {
    return orders.filter((o) => o.status === 'Yeni' || o.status === 'Görüntülendi');
  }, [orders]);
  const newOrdersCount = newOrders.length;
  const latestNewOrder = newOrders[0] || null;

  return (
    <div className="p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 w-full min-w-0 animate-in fade-in duration-200">
      {/* KEYFRAME ANIMASYONLARI: SİPARİŞ GELDİĞİNDE ŞİŞİP KÜÇÜLEN CANLI NABIZ UYARISI */}
      <style jsx>{`
        @keyframes orderInflate {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.6), 0 10px 25px -5px rgba(239, 68, 68, 0.35);
          }
          50% {
            transform: scale(1.02);
            box-shadow: 0 0 0 14px rgba(239, 68, 68, 0), 0 20px 35px -5px rgba(239, 68, 68, 0.55);
          }
        }
        .animate-order-inflate {
          animation: orderInflate 2s infinite ease-in-out;
        }
        @keyframes bellShake {
          0%, 100% { transform: rotate(0deg); }
          15% { transform: rotate(14deg); }
          30% { transform: rotate(-14deg); }
          45% { transform: rotate(10deg); }
          60% { transform: rotate(-10deg); }
          75% { transform: rotate(0deg); }
        }
        .animate-bell-shake {
          animation: bellShake 1.4s infinite ease-in-out;
        }
      `}</style>

      {/* TOP BAR: DATE FILTERS & QUICK ACTIONS */}
      <div className="flex flex-col gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-stone-200 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="min-w-0">
            <h2 className="text-sm sm:text-lg font-bold text-stone-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-500 animate-pulse shrink-0"></span>
              <span className="truncate">Operasyonel Genel Bakış & Sipariş Akışı</span>
            </h2>
            <p className="text-[11px] sm:text-xs text-stone-500 mt-0.5 line-clamp-1">
              Gerçek zamanlı sipariş akışı, teslimat durumu ve ürün hareketleri.
            </p>
          </div>

          {/* Quick Report Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {onExportCsv && (
              <button
                type="button"
                onClick={onExportCsv}
                className="bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                title="Siparişleri Excel / CSV Olarak İndir"
              >
                <i className="fa-solid fa-file-excel text-emerald-600"></i>
                <span>Excel İndir</span>
              </button>
            )}
          </div>
        </div>

        {/* Date Filter Tabs (Mobile Dropdown / Desktop Pills) */}
        {/* MOBİL: Tarih Aralığı Açılır Menü */}
        <div className="sm:hidden w-full">
          <label className="text-[10px] font-extrabold text-stone-500 uppercase tracking-wider block mb-1">
            Zaman Aralığı Filtresi
          </label>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="app-select w-full bg-stone-50 hover:bg-white border border-stone-300 hover:border-brand-500 text-stone-900 text-xs font-bold rounded-2xl px-4 py-3 cursor-pointer shadow-xs focus:ring-3 focus:ring-brand-500/15"
          >
            <option value="today">📅 Bugün</option>
            <option value="yesterday">📅 Dün</option>
            <option value="last7">📅 Son 7 Gün</option>
            <option value="last30">📅 Son 30 Gün</option>
            <option value="all">📅 Tüm Zamanlar</option>
            <option value="custom">📅 Özel Aralık...</option>
          </select>
        </div>

        {/* MASAÜSTÜ: Yatay Buton Sekmeleri */}
        <div className="hidden sm:flex items-center gap-1.5 bg-stone-100 p-1 rounded-xl w-full flex-wrap">
          {[
            { id: 'today', label: 'Bugün' },
            { id: 'yesterday', label: 'Dün' },
            { id: 'last7', label: 'Son 7 Gün' },
            { id: 'last30', label: 'Son 30 Gün' },
            { id: 'all', label: 'Tüm Zamanlar' },
            { id: 'custom', label: 'Özel Aralık' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setDateFilter(tab.id)}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 text-center ${
                dateFilter === tab.id
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* CUSTOM DATE PICKER ROW (CONDITIONAL) */}
      {dateFilter === 'custom' && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 bg-amber-50/60 p-3.5 rounded-xl border border-amber-200/80 animate-in fade-in duration-150">
          <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5 shrink-0">
            <i className="fa-regular fa-calendar-days text-amber-600"></i>
            Özel Tarih Aralığı:
          </span>
          <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="w-full sm:w-auto bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs text-stone-800 focus:outline-none focus:border-brand-500 font-medium"
            />
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="w-full sm:w-auto bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs text-stone-800 focus:outline-none focus:border-brand-500 font-medium"
            />
          </div>
          <span className="text-[11px] text-stone-500">
            ({filteredOrders.length} sipariş bulundu)
          </span>
        </div>
      )}

      {/* OPERATIONAL KPI METRIC CARDS (No Revenue / Sales Amounts) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3.5">
        {/* CARD 0: TEKİL SİTE ZİYARETÇİ SAYISI */}
        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-stone-200 shadow-xs hover:border-stone-300 transition-all flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-stone-500 truncate">
              Site Ziyaretçisi
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs shrink-0">
              <i className="fa-solid fa-users-viewfinder"></i>
            </div>
          </div>
          <div className="mt-2 min-w-0">
            <span className="text-base sm:text-xl xl:text-2xl font-black text-indigo-600 tracking-tight block truncate">
              {periodVisitorCount} Kişi
            </span>
            <span className="block text-[10px] sm:text-[11px] text-stone-600 font-medium mt-0.5 truncate">
              Bugün: {visitorStats.todayCount} &bull; Toplam: {visitorStats.totalCount}
            </span>
          </div>
          <span className="text-[10px] text-stone-400 mt-2 hidden sm:block pt-2 border-t border-stone-100 truncate">
            Her cihaz günde yalnızca 1 kez sayılır
          </span>
        </div>

        {/* CARD 1: TOPLAM SİPARİŞ ADEDİ */}
        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-stone-200 shadow-xs hover:border-stone-300 transition-all flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-stone-500 truncate">
              Toplam Sipariş
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xs shrink-0">
              <i className="fa-solid fa-boxes-stacked"></i>
            </div>
          </div>
          <div className="mt-2 min-w-0">
            <span className="text-base sm:text-xl xl:text-2xl font-black text-stone-900 tracking-tight block truncate">
              {metrics.totalCount} Adet
            </span>
            <span className="block text-[10px] sm:text-[11px] text-stone-600 font-medium mt-0.5 truncate">
              {metrics.cancelledCount > 0 ? `${metrics.cancelledCount} İptal Edildi` : 'İptal bulunmuyor'}
            </span>
          </div>
          <span className="text-[10px] text-stone-400 mt-2 hidden sm:block pt-2 border-t border-stone-100 truncate">
            Seçili zaman aralığındaki tüm kayıtlar
          </span>
        </div>

        {/* CARD 2: TESLİM EDİLEN SİPARİŞLER */}
        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-stone-200 shadow-xs hover:border-stone-300 transition-all flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-stone-500 truncate">
              Teslim Edilen
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs shrink-0">
              <i className="fa-solid fa-circle-check"></i>
            </div>
          </div>
          <div className="mt-2 min-w-0">
            <span className="text-base sm:text-xl xl:text-2xl font-black text-stone-900 tracking-tight block truncate">
              {metrics.deliveredCount} Adet
            </span>
            <span className="block text-[10px] sm:text-[11px] text-emerald-700 font-semibold mt-0.5 truncate">
              Başarıyla tamamlanan sipariş
            </span>
          </div>
          <span className="text-[10px] text-stone-400 mt-2 hidden sm:block pt-2 border-t border-stone-100 truncate">
            Müşteriye ulaştırılan paketler
          </span>
        </div>

        {/* CARD 3: AKTİF İŞLEMDEKİ SİPARİŞLER */}
        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-stone-200 shadow-xs hover:border-stone-300 transition-all flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-stone-500 truncate">
              Aktif İşlemde
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xs shrink-0">
              <i className="fa-solid fa-fire-burner"></i>
            </div>
          </div>
          <div className="mt-2 min-w-0">
            <span className="text-base sm:text-xl xl:text-2xl font-black text-stone-900 tracking-tight block truncate">
              {metrics.activeCount} Sipariş
            </span>
            <span className="block text-[10px] sm:text-[11px] text-amber-700 font-semibold mt-0.5 truncate">
              {isCourierEnabled ? 'Mutfak & kurye aşamasında' : 'Mutfak hazırlık aşamasında'}
            </span>
          </div>
          <span className="text-[10px] text-stone-400 mt-2 hidden sm:block pt-2 border-t border-stone-100 truncate">
            {isCourierEnabled ? 'Hazırlanan ve yoldaki paketler' : 'Mutfakta hazırlanan siparişler'}
          </span>
        </div>

        {/* CARD 4: NAKİT VS POS YÖNTEM ORANI */}
        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-stone-200 shadow-xs hover:border-stone-300 transition-all flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-stone-500 truncate">
              Ödeme Yöntemi Oranı
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center text-xs shrink-0">
              <i className="fa-solid fa-credit-card"></i>
            </div>
          </div>
          <div className="mt-2 space-y-1.5">
            <div className="flex justify-between text-xs font-bold text-stone-800">
              <span>Nakit: %{metrics.cashPercent}</span>
              <span>POS: %{metrics.posPercent}</span>
            </div>
            <div className="w-full h-2 rounded-full bg-stone-100 overflow-hidden flex">
              <div
                style={{ width: `${metrics.cashPercent}%` }}
                className="bg-emerald-500 h-full transition-all"
                title={`Nakit: %${metrics.cashPercent}`}
              ></div>
              <div
                style={{ width: `${metrics.posPercent}%` }}
                className="bg-indigo-500 h-full transition-all"
                title={`POS: %${metrics.posPercent}`}
              ></div>
            </div>
          </div>
          <span className="text-[10px] text-stone-400 mt-2 hidden sm:block pt-2 border-t border-stone-100 truncate">
            Kapıda Nakit vs Kapıda POS tercihi
          </span>
        </div>
      </div>

      {/* SECTION 2: OPERATIONAL ORDER STATUS BREAKDOWN */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs space-y-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <i className="fa-solid fa-list-check text-brand-600"></i>
              Sipariş Durumu & Aşama Dağılımı
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              İşletmedeki siparişlerin güncel operasyonel aşamaları ve oranları.
            </p>
          </div>
          <button
            onClick={() => onNavigateToOrders && onNavigateToOrders('all')}
            className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 cursor-pointer shrink-0"
          >
            <span className="hidden sm:inline">Canlı Sipariş Tablosu</span>
            <span className="sm:hidden">Tümü</span>
            <i className="fa-solid fa-arrow-right text-[10px]"></i>
          </button>
        </div>

        {/* Stacked Progress Bar */}
        <div className="w-full h-3 rounded-full bg-stone-100 overflow-hidden flex gap-0.5 p-0.5">
          {statusCounts.newAndViews > 0 && (
            <div
              style={{ width: `${statusCounts.newPercent}%` }}
              className="bg-red-500 rounded-full h-full transition-all"
              title={`Yeni: ${statusCounts.newAndViews}`}
            ></div>
          )}
          {statusCounts.kitchen > 0 && (
            <div
              style={{ width: `${statusCounts.kitchenPercent}%` }}
              className="bg-orange-500 rounded-full h-full transition-all"
              title={`Mutfakta: ${statusCounts.kitchen}`}
            ></div>
          )}
          {isCourierEnabled && statusCounts.courier > 0 && (
            <div
              style={{ width: `${statusCounts.courierPercent}%` }}
              className="bg-sky-500 rounded-full h-full transition-all"
              title={`Kuryede: ${statusCounts.courier}`}
            ></div>
          )}
          {statusCounts.delivered > 0 && (
            <div
              style={{ width: `${statusCounts.deliveredPercent}%` }}
              className="bg-emerald-500 rounded-full h-full transition-all"
              title={`Teslim Edildi: ${statusCounts.delivered}`}
            ></div>
          )}
          {statusCounts.cancelled > 0 && (
            <div
              style={{ width: `${statusCounts.cancelledPercent}%` }}
              className="bg-stone-300 rounded-full h-full transition-all"
              title={`İptal: ${statusCounts.cancelled}`}
            ></div>
          )}
        </div>

        {/* Status Clickable Cards */}
        <div className={`grid gap-2 sm:gap-2.5 pt-1 ${isCourierEnabled ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4'}`}>
          {/* 1. Yeni & Görüntülendi */}
          <button
            type="button"
            onClick={() => onNavigateToOrders && onNavigateToOrders('new')}
            className="p-3 rounded-xl bg-red-50/50 border border-red-200/80 hover:bg-red-50 hover:border-red-300 text-left transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-red-800">Yeni / Bekleyen</span>
              <span className="w-2 h-2 rounded-full bg-red-500 group-hover:scale-125 transition-transform"></span>
            </div>
            <span className="text-lg sm:text-xl font-black text-red-900 block">{statusCounts.newAndViews}</span>
            <span className="text-[10px] text-red-600 block mt-0.5">%{statusCounts.newPercent} oranında</span>
          </button>

          {/* 2. Mutfakta */}
          <button
            type="button"
            onClick={() => onNavigateToOrders && onNavigateToOrders('kitchen')}
            className="p-3 rounded-xl bg-orange-50/50 border border-orange-200/80 hover:bg-orange-50 hover:border-orange-300 text-left transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-orange-800">Mutfakta</span>
              <i className="fa-solid fa-fire-burner text-orange-500 text-xs"></i>
            </div>
            <span className="text-lg sm:text-xl font-black text-orange-900 block">{statusCounts.kitchen}</span>
            <span className="text-[10px] text-orange-600 block mt-0.5">%{statusCounts.kitchenPercent} oranında</span>
          </button>

          {/* 3. Kuryede (Yalnızca Kurye Modülü Açıkken Gösterilir) */}
          {isCourierEnabled && (
            <button
              type="button"
              onClick={() => onNavigateToOrders && onNavigateToOrders('courier')}
              className="p-3 rounded-xl bg-sky-50/50 border border-sky-200/80 hover:bg-sky-50 hover:border-sky-300 text-left transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-sky-800">Kuryede / Yolda</span>
                <i className="fa-solid fa-person-biking text-sky-500 text-xs"></i>
              </div>
              <span className="text-lg sm:text-xl font-black text-sky-900 block">{statusCounts.courier}</span>
              <span className="text-[10px] text-sky-600 block mt-0.5">%{statusCounts.courierPercent} oranında</span>
            </button>
          )}

          {/* 4. Teslim Edildi */}
          <button
            type="button"
            onClick={() => onNavigateToOrders && onNavigateToOrders('delivered')}
            className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-200/80 hover:bg-emerald-50 hover:border-emerald-300 text-left transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-emerald-800">Teslim Edildi</span>
              <i className="fa-solid fa-circle-check text-emerald-500 text-xs"></i>
            </div>
            <span className="text-lg sm:text-xl font-black text-emerald-900 block">{statusCounts.delivered}</span>
            <span className="text-[10px] text-emerald-600 block mt-0.5">%{statusCounts.deliveredPercent} oranında</span>
          </button>

          {/* 5. İptal Edilen */}
          <button
            type="button"
            onClick={() => onNavigateToOrders && onNavigateToOrders('cancelled')}
            className={`p-3 rounded-xl bg-stone-100/70 border border-stone-200/90 hover:bg-stone-100 text-left transition-all cursor-pointer group ${
              isCourierEnabled ? 'col-span-2 sm:col-span-1' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-stone-700">İptal Edilen</span>
              <i className="fa-solid fa-ban text-stone-400 text-xs"></i>
            </div>
            <span className="text-lg sm:text-xl font-black text-stone-800 block">{statusCounts.cancelled}</span>
            <span className="text-[10px] text-stone-500 block mt-0.5">%{statusCounts.cancelledPercent} oranında</span>
          </button>
        </div>
      </div>

      {/* SECTION 3: ORDER VOLUME CHART (SİPARİŞ YOĞUNLUK GRAFİĞİ) */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <i className="fa-solid fa-chart-column text-brand-600"></i>
              Sipariş Yoğunluk Grafiği
              <span className="text-[11px] font-normal text-stone-400">
                ({dateFilter === 'today' || dateFilter === 'yesterday' ? 'Saatlik Dağılım' : 'Günlük Trend'})
              </span>
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Seçilen periyotta gerçekleşen sipariş adedi ve teslimat yoğunluğu.
            </p>
          </div>

          <div className="inline-flex items-center gap-1.5 bg-stone-100 px-3 py-1.5 rounded-xl text-xs font-semibold text-stone-800">
            <i className="fa-solid fa-basket-shopping text-brand-600"></i>
            <span>Sipariş Adedi</span>
          </div>
        </div>

        {/* Visual Bar Chart */}
        <div className="pt-6 pb-2 w-full">
          {chartData.length === 0 ? (
            <div className="text-center py-12 text-stone-400 text-xs">
              Bu periyotta henüz satış verisi bulunmamaktadır.
            </div>
          ) : (
            <div className="w-full space-y-2">
              <div className="h-44 sm:h-56 flex items-end justify-between gap-1.5 sm:gap-4 px-1 sm:px-2 border-b border-stone-200">
                {chartData.map((d, index) => {
                  const val = chartMetric === 'revenue' ? d.revenue : d.count;
                  const heightPercent = maxChartValue > 0 ? Math.max((val / maxChartValue) * 100, val > 0 ? 8 : 2) : 2;
                  const isHovered = hoveredBar === index;

                  return (
                    <div
                      key={index}
                      onMouseEnter={() => setHoveredBar(index)}
                      onMouseLeave={() => setHoveredBar(null)}
                      onClick={() => setHoveredBar(isHovered ? null : index)}
                      className="flex-1 min-w-0 flex flex-col items-center h-full justify-end group relative cursor-pointer"
                    >
                      {/* Tooltip on Hover / Tap */}
                      {isHovered && (
                        <div className="absolute -top-12 z-30 bg-stone-900 text-white text-[10px] sm:text-[11px] px-2 sm:px-2.5 py-1.5 rounded-xl shadow-xl whitespace-nowrap pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                          <span className="font-bold block">{d.label}</span>
                          <span className="text-amber-400 font-extrabold">
                            {chartMetric === 'revenue' ? (
                              canViewRevenue ? `₺${d.revenue.toFixed(2)}` : '₺••• (Gizli)'
                            ) : `${d.count} Sipariş`}
                          </span>
                          <span className="text-[9px] sm:text-[10px] text-stone-400 block font-normal">
                            ({d.delivered} Teslim)
                          </span>
                        </div>
                      )}

                      {/* Bar Value on top if > 0 */}
                      {val > 0 && (
                        <span className={`text-[9px] sm:text-[10px] font-bold text-stone-700 mb-1 block group-hover:text-brand-600 transition-colors truncate max-w-full ${!canViewRevenue && chartMetric === 'revenue' ? 'filter blur-[3px] select-none opacity-60' : ''}`}>
                          {chartMetric === 'revenue' ? `₺${Math.round(val)}` : val}
                        </span>
                      )}

                      {/* Bar Graphic */}
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full max-w-[44px] rounded-t-lg sm:rounded-t-xl transition-all duration-300 ${
                          val > 0
                            ? isHovered
                              ? 'bg-brand-600 shadow-md ring-2 ring-brand-400/40'
                              : 'bg-gradient-to-t from-brand-600 to-amber-400'
                            : 'bg-stone-100 hover:bg-stone-200'
                        }`}
                      ></div>
                    </div>
                  );
                })}
              </div>

              {/* X Axis Labels */}
              <div className="flex justify-between gap-1 sm:gap-4 px-1 sm:px-2 pt-1">
                {chartData.map((d, index) => (
                  <div key={index} className="flex-1 min-w-0 text-center">
                    <span className="text-[9px] sm:text-[10px] font-medium text-stone-500 block truncate" title={d.label}>
                      {d.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 4: SPLIT GRID - TOP PRODUCTS & RECENT ORDERS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        {/* LEFT COLUMN: EN ÇOK SATAN ÜRÜNLER (TOP SELLING PRODUCTS) */}
        <div className="lg:col-span-5 bg-white p-3.5 sm:p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4 flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div>
                <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                  <i className="fa-solid fa-fire text-brand-600"></i>
                  En Çok Tercih Edilen Ürünler
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Siparişlerde en çok hazırlanan lezzetler.
                </p>
              </div>
              <span className="text-[11px] font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-lg border border-brand-200/60">
                Top 5
              </span>
            </div>

            {/* List */}
            <div className="divide-y divide-stone-100 mt-2">
              {topSellingProducts.length === 0 ? (
                <div className="text-center py-8 text-stone-400 text-xs">
                  Henüz satış yapılan ürün bulunmuyor.
                </div>
              ) : (
                topSellingProducts.map((p, idx) => {
                  const rankColors = [
                    'bg-amber-100 text-amber-800 border-amber-300', // 1st Gold
                    'bg-stone-200 text-stone-700 border-stone-300', // 2nd Silver
                    'bg-orange-100 text-orange-800 border-orange-300', // 3rd Bronze
                    'bg-stone-50 text-stone-500 border-stone-200',
                    'bg-stone-50 text-stone-500 border-stone-200',
                  ];

                  return (
                    <div key={idx} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Rank Badge */}
                        <span
                          className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 border ${
                            rankColors[idx] || 'bg-stone-50 text-stone-500'
                          }`}
                        >
                          {idx + 1}
                        </span>

                        {/* Product Image */}
                        <img
                          src={p.image}
                          alt={p.name}
                          className="w-11 h-11 rounded-xl object-cover bg-stone-100 border border-stone-200 shrink-0"
                          onError={(e) => {
                            e.currentTarget.src = '/images/hero_banner.jpg';
                          }}
                        />

                        {/* Name & Category */}
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-stone-900 block truncate">
                            {p.name}
                          </span>
                          <span className="text-[10px] text-stone-400 block truncate capitalize">
                            {p.category === 'menu' ? '🍱 Menülü Paket' : '🥪 Sandviç / Bireysel'}
                          </span>
                        </div>
                      </div>

                      {/* Quantity Only */}
                      <div className="text-right shrink-0">
                        <span className="text-xs font-extrabold text-stone-900 bg-stone-100 px-2.5 py-1 rounded-lg border border-stone-200 block">
                          {p.quantity} Adet
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-stone-100 text-center">
            <span className="text-[11px] text-stone-400">
              Ürün adetleri gerçek sipariş kalemlerinden hesaplanır.
            </span>
          </div>
        </div>

        {/* RIGHT COLUMN: SON SİPARİŞLER (RECENT ORDERS FEED) */}
        <div className="lg:col-span-7 bg-white p-3.5 sm:p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4 flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div>
                <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                  <i className="fa-solid fa-clock-rotate-left text-brand-600"></i>
                  Son Siparişler
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Sisteme düşen son siparişlerin anlık durumu.
                </p>
              </div>
              <button
                onClick={() => onNavigateToOrders && onNavigateToOrders('all')}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 cursor-pointer"
              >
                <span>Tümünü Gör</span>
                <i className="fa-solid fa-arrow-right text-[10px]"></i>
              </button>
            </div>

            {/* Orders Feed List */}
            <div className="divide-y divide-stone-100 mt-1">
              {recentOrders.length === 0 ? (
                <div className="text-center py-10 text-stone-400 text-xs">
                  Seçilen dönemde henüz sipariş bulunmamaktadır.
                </div>
              ) : (
                recentOrders.map((order) => {
                  const statusStyle = STATUS_STYLES[order.status] || STATUS_STYLES['Yeni'];

                  return (
                    <div
                      key={order.id}
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-stone-50/50 rounded-xl px-2 -mx-2 transition-colors"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-stone-100 border border-stone-200 text-stone-800 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                          #{order.orderNumber ? order.orderNumber.replace('SD-', '') : 'SP'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-stone-900 truncate">
                              {order.customerName}
                            </span>
                            <span className="text-[10px] text-stone-400">
                              &bull; {formatElapsedTime(order.createdAt)}
                            </span>
                          </div>
                          <span className="text-[11px] text-stone-500 block truncate mt-0.5">
                            {Array.isArray(order.items)
                              ? order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')
                              : order.items}
                          </span>
                          <span className="text-[10px] text-stone-400 block mt-0.5">
                            {order.paymentMethod || 'Elden Ödeme'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                        {/* Status Badge */}
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`}></span>
                          {statusStyle.label}
                        </span>

                        {(order.status === 'Yeni' || order.status === 'Görüntülendi') && onAcceptOrder && (
                          <button
                            type="button"
                            onClick={() => onAcceptOrder(order.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-2.5 py-1.5 rounded-lg font-bold cursor-pointer flex items-center gap-1 shadow-xs active:scale-95 transition-all"
                            title="Siparişi Hemen Onayla"
                          >
                            <i className="fa-solid fa-check text-[11px]"></i>
                            <span>Onayla</span>
                          </button>
                        )}

                        {/* Detay & Fiş Button */}
                        <button
                          onClick={() => onOpenOrderDetail && onOpenOrderDetail(order)}
                          className="bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs px-2.5 py-1.5 rounded-lg font-medium cursor-pointer flex items-center gap-1"
                          title="Sipariş Detayı & Adisyon Fişi"
                        >
                          <i className="fa-solid fa-receipt text-[11px]"></i>
                          <span>Fiş</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
            <span className="text-[11px] text-stone-400">
              Her 7 saniyede bir otomatik yenilenir.
            </span>
            <button
              onClick={() => onRefresh && onRefresh()}
              disabled={loading}
              className="text-stone-600 hover:text-stone-900 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <i className={`fa-solid fa-rotate-right ${loading ? 'fa-spin' : ''}`}></i>
              <span>Yenile</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
