'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setProducts, addProduct, updateProduct, deleteProduct } from '@/store/slices/productSlice';
import { showMessageModal, setReviews, updateReviewStatus, removeReview } from '@/store/slices/uiSlice';
import MessageModal from '@/components/modals/MessageModal';
import OverviewDashboard from '@/components/admin/OverviewDashboard';
import InventoryTab from '@/components/admin/InventoryTab';
import KitchenPosBell from '@/components/admin/KitchenPosBell';
import UsersRolesTab from '@/components/admin/UsersRolesTab';
import MysqlOrmTab from '@/components/admin/MysqlOrmTab';
import BlurredAmount from '@/components/admin/BlurredAmount';
import SettingsTab, { DEFAULT_ADMIN_SETTINGS } from '@/components/admin/SettingsTab';
import SiteContentEditorTab from '@/components/admin/SiteContentEditorTab';
import MembersTab from '@/components/admin/MembersTab';
import OptionsManagementTab from '@/components/admin/OptionsManagementTab';
import AdminPagination from '@/components/admin/AdminPagination';

// Status styling and Turkish badge helpers
const STATUS_CONFIG = {
  'Yeni': {
    label: 'Yeni Sipariş',
    bg: 'bg-red-100',
    text: 'text-red-800',
    border: 'border-red-300',
    dot: 'bg-red-600 animate-ping',
    cardBorder: 'border-red-300 border-l-4 border-l-red-600 bg-red-50/30',
    badgeBg: 'bg-red-600 text-white',
    icon: 'fa-solid fa-bell'
  },
  'Görüntülendi': {
    label: 'Görüntülendi',
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    border: 'border-amber-300',
    dot: 'bg-amber-500',
    cardBorder: 'border-amber-200 border-l-4 border-l-amber-500 bg-amber-50/20',
    badgeBg: 'bg-amber-500 text-stone-950',
    icon: 'fa-solid fa-eye'
  },
  'Onaylandı': {
    label: 'Onaylandı',
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    border: 'border-blue-300',
    dot: 'bg-blue-600',
    cardBorder: 'border-blue-200 border-l-4 border-l-blue-600 bg-blue-50/15',
    badgeBg: 'bg-blue-600 text-white',
    icon: 'fa-solid fa-thumbs-up'
  },
  'Hazırlanıyor': {
    label: 'Mutfakta Hazırlanıyor',
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    border: 'border-orange-300',
    dot: 'bg-orange-500 animate-pulse',
    cardBorder: 'border-orange-200 border-l-4 border-l-orange-500 bg-orange-50/20',
    badgeBg: 'bg-orange-500 text-white',
    icon: 'fa-solid fa-fire-burner'
  },
  'Hazır': {
    label: 'Paketlendi / Hazır',
    bg: 'bg-purple-100',
    text: 'text-purple-800',
    border: 'border-purple-300',
    dot: 'bg-purple-600',
    cardBorder: 'border-purple-200 border-l-4 border-l-purple-600 bg-purple-50/15',
    badgeBg: 'bg-purple-600 text-white',
    icon: 'fa-solid fa-box-open'
  },
  'Kurye Teslim Aldı': {
    label: 'Kurye Teslim Aldı',
    bg: 'bg-indigo-100',
    text: 'text-indigo-800',
    border: 'border-indigo-300',
    dot: 'bg-indigo-600',
    cardBorder: 'border-indigo-200 border-l-4 border-l-indigo-600 bg-indigo-50/15',
    badgeBg: 'bg-indigo-600 text-white',
    icon: 'fa-solid fa-motorcycle'
  },
  'Yolda': {
    label: 'Kuryede (Yolda)',
    bg: 'bg-sky-100',
    text: 'text-sky-800',
    border: 'border-sky-300',
    dot: 'bg-sky-500 animate-pulse',
    cardBorder: 'border-sky-200 border-l-4 border-l-sky-500 bg-sky-50/20',
    badgeBg: 'bg-sky-600 text-white',
    icon: 'fa-solid fa-route'
  },
  'Teslim Edildi': {
    label: 'Teslim Edildi',
    bg: 'bg-emerald-100',
    text: 'text-emerald-800',
    border: 'border-emerald-300',
    dot: 'bg-emerald-600',
    cardBorder: 'border-emerald-200/80 border-l-4 border-l-emerald-500 bg-white',
    badgeBg: 'bg-emerald-600 text-white',
    icon: 'fa-solid fa-circle-check'
  },
  'İptal Edildi': {
    label: 'İptal Edildi',
    bg: 'bg-rose-100',
    text: 'text-rose-700',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
    cardBorder: 'border-stone-200 border-l-4 border-l-rose-400 bg-stone-50/70 opacity-80',
    badgeBg: 'bg-stone-500 text-white',
    icon: 'fa-solid fa-ban'
  },
};

// Next allowed operational step
function getNextStep(status) {
  switch (status) {
    case 'Yeni':
    case 'Görüntülendi':
      return { nextStatus: 'Onaylandı', label: 'Siparişi Onayla', icon: 'fa-solid fa-check', color: 'bg-blue-600 hover:bg-blue-700 text-white' };
    case 'Onaylandı':
      return { nextStatus: 'Hazırlanıyor', label: 'Hazırlamaya Başla', icon: 'fa-solid fa-fire-burner', color: 'bg-orange-600 hover:bg-orange-700 text-white' };
    case 'Hazırlanıyor':
      return { nextStatus: 'Hazır', label: 'Hazır Olarak İşaretle', icon: 'fa-solid fa-box', color: 'bg-purple-600 hover:bg-purple-700 text-white' };
    case 'Hazır':
      return { nextStatus: 'Kurye Teslim Aldı', label: 'Kuryeye Teslim Et', icon: 'fa-solid fa-person-biking', color: 'bg-indigo-600 hover:bg-indigo-700 text-white' };
    case 'Kurye Teslim Aldı':
      return { nextStatus: 'Yolda', label: 'Yola Çıkar', icon: 'fa-solid fa-route', color: 'bg-sky-600 hover:bg-sky-700 text-white' };
    case 'Yolda':
      return { nextStatus: 'Teslim Edildi', label: 'Teslim Edildi Olarak İşaretle', icon: 'fa-solid fa-circle-check', color: 'bg-green-600 hover:bg-green-700 text-white' };
    default:
      return null;
  }
}

// Elapsed time formatter
function formatElapsedTime(isoString) {
  if (!isoString) return '';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Az önce';
  if (diffMins < 60) return `${diffMins} dk önce`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} saat önce`;
  return `${Math.floor(diffHours / 24)} gün önce`;
}

// Üyelere özel canlı renk paletleri (Sipariş yönetiminde her üyeye farklı renk atanır)
const MEMBER_PALETTES = [
  { name: 'indigo', bg: 'bg-indigo-600', text: 'text-white', avatar: 'bg-indigo-600 text-white ring-indigo-200' },
  { name: 'emerald', bg: 'bg-emerald-600', text: 'text-white', avatar: 'bg-emerald-600 text-white ring-emerald-200' },
  { name: 'violet', bg: 'bg-violet-600', text: 'text-white', avatar: 'bg-violet-600 text-white ring-violet-200' },
  { name: 'amber', bg: 'bg-amber-600', text: 'text-white', avatar: 'bg-amber-600 text-white ring-amber-200' },
  { name: 'rose', bg: 'bg-rose-600', text: 'text-white', avatar: 'bg-rose-600 text-white ring-rose-200' },
  { name: 'sky', bg: 'bg-sky-600', text: 'text-white', avatar: 'bg-sky-600 text-white ring-sky-200' },
  { name: 'teal', bg: 'bg-teal-600', text: 'text-white', avatar: 'bg-teal-600 text-white ring-teal-200' },
  { name: 'fuchsia', bg: 'bg-fuchsia-600', text: 'text-white', avatar: 'bg-fuchsia-600 text-white ring-fuchsia-200' },
  { name: 'blue', bg: 'bg-blue-600', text: 'text-white', avatar: 'bg-blue-600 text-white ring-blue-200' },
  { name: 'orange', bg: 'bg-orange-600', text: 'text-white', avatar: 'bg-orange-600 text-white ring-orange-200' },
  { name: 'cyan', bg: 'bg-cyan-700', text: 'text-white', avatar: 'bg-cyan-700 text-white ring-cyan-200' },
  { name: 'purple', bg: 'bg-purple-600', text: 'text-white', avatar: 'bg-purple-600 text-white ring-purple-200' },
  { name: 'lime', bg: 'bg-lime-700', text: 'text-white', avatar: 'bg-lime-700 text-white ring-lime-200' },
  { name: 'pink', bg: 'bg-pink-600', text: 'text-white', avatar: 'bg-pink-600 text-white ring-pink-200' },
];

function getMemberPalette(nameOrKey = '') {
  const str = String(nameOrKey || 'Üye').trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % MEMBER_PALETTES.length;
  return MEMBER_PALETTES[index];
}

// Dikey şeritte harflerin alt alta dizilmesini sağlayan kelime ayrıştırıcı
function getVerticalNameWords(name = '') {
  const parts = String(name || 'ÜYE').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return ['ÜYE'];
  if (parts.length === 1) return [parts[0].slice(0, 10).toUpperCase()];
  const totalLetters = parts.reduce((acc, p) => acc + p.length, 0);
  if (totalLetters <= 11) {
    return parts.map((p) => p.toUpperCase());
  }
  const first = parts[0].toUpperCase();
  const lastInitial = parts[parts.length - 1][0].toUpperCase() + '.';
  return [first.slice(0, 9), lastInitial];
}

export default function AdminDashboardPage() {
  const dispatch = useDispatch();
  const { items: products } = useSelector((state) => state.product);
  const { reviews } = useSelector((state) => state.ui);

  // Authentication
  const [adminUser, setAdminUser] = useState(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Toast Bildirim Sistemi (Kullanıcı Bildirimleri & Başarı Mesajları)
  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  }, []);

  // Navigation & Sidebar Layout
  const [currentTab, setCurrentTab] = useState('overview'); // 'overview' | 'orders' | 'products' | 'reviews' | 'api' | 'settings' | 'site_content'
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [siteEditorDrawerOpen, setSiteEditorDrawerOpen] = useState(false);
  const [siteEditorWide, setSiteEditorWide] = useState(false);
  const [selectedSiteContentSubTab, setSelectedSiteContentSubTab] = useState('hero');
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [selectedSettingsSubTab, setSelectedSettingsSubTab] = useState('appearance');

  // Sistem & Panel Ayarları (Yazı Boyutu, Ses, Fiş, Otomatik Yenileme)
  const [adminSettings, setAdminSettings] = useState(DEFAULT_ADMIN_SETTINGS);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('sandwich_admin_sidebar_collapsed');
      if (saved !== null) {
        setSidebarCollapsed(saved === 'true');
      }
      const savedSettings = localStorage.getItem('sandwich_admin_settings');
      if (savedSettings) {
        setAdminSettings({ ...DEFAULT_ADMIN_SETTINGS, ...JSON.parse(savedSettings) });
      }
    } catch (e) {}
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sandwich_admin_sidebar_collapsed', String(next));
      } catch (e) {}
      return next;
    });
  };

  // Orders State
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Dinamik Kurye Listesi (Admin kullanıcıları & rolleri ile canlı senkronize)
  const [courierOptions, setCourierOptions] = useState([
    'Kurye 1 (Ali)',
    'Kurye 2 (Mehmet)',
    'Kurye 3 (Hasan)',
    'Dış Kurye'
  ]);

  const loadCouriers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (!res.ok) return;
      const json = await res.json();
      const payload = json?.data || json || {};
      const adminUsers = Array.isArray(payload.adminUsers) ? payload.adminUsers : [];
      const roles = Array.isArray(payload.roles) ? payload.roles : [];

      const couriers = adminUsers.filter((u) => {
        if (u.isActive === false) return false;
        const matchedRole = roles.find((r) => r.id === u.roleId || r.code === u.roleId) || {};
        const roleName = String(u.roleName || u.role || matchedRole.name || matchedRole.code || '').toLowerCase();
        const roleId = String(u.roleId || '').toLowerCase();
        const userName = String(u.name || '').toLowerCase();
        const perms = Array.isArray(u.permissions)
          ? u.permissions
          : Array.isArray(matchedRole.permissions)
          ? matchedRole.permissions
          : [];

        return (
          roleId.includes('courier') ||
          roleId.includes('kurye') ||
          roleName.includes('kurye') ||
          roleName.includes('courier') ||
          userName.includes('kurye') ||
          perms.includes('courier_delivery')
        );
      });

      const realNames = couriers.map((c) => c.name?.trim()).filter(Boolean);

      if (realNames.length > 0) {
        // Gerçek kullanıcı kuryeleri mevcutsa, statik hazır kuryeler yerine doğrudan gerçek personelleri göster
        setCourierOptions(Array.from(new Set([...realNames, 'Dış Kurye'])));
      } else {
        // Sistemde henüz kayıtlı kurye yoksa varsayılan hazır seçenekleri göster
        setCourierOptions(['Kurye 1 (Ali)', 'Kurye 2 (Mehmet)', 'Kurye 3 (Hasan)', 'Dış Kurye']);
      }
    } catch (e) {
      console.warn('Dinamik kurye listesi alınamadı:', e);
    }
  }, []);

  useEffect(() => {
    loadCouriers();

    const handleUsersUpdated = () => {
      loadCouriers();
    };

    const handleStorage = (e) => {
      if (e.key === 'sandwich_users_updated') {
        loadCouriers();
      }
    };

    window.addEventListener('sandwich_users_updated', handleUsersUpdated);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleUsersUpdated);

    return () => {
      window.removeEventListener('sandwich_users_updated', handleUsersUpdated);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleUsersUpdated);
    };
  }, [loadCouriers]);
  const [previousOrderCount, setPreviousOrderCount] = useState(0);

  // Filters & Search
  const [orderStageFilter, setOrderStageFilter] = useState('all'); // 'all' | 'kitchen' | 'courier' | 'completed' | 'cancelled'
  const [orderSearch, setOrderSearch] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');

  // Modals
  const [detailOrder, setDetailOrder] = useState(null);
  const [cancelModalOrder, setCancelModalOrder] = useState(null);
  const [cancelReason, setCancelReason] = useState('Müşteri talebi');
  const [customCancelReason, setCustomCancelReason] = useState('');
  const [deleteModalOrder, setDeleteModalOrder] = useState(null);
  const [deleteAdminPassword, setDeleteAdminPassword] = useState('');
  const [deleteRestoreStock, setDeleteRestoreStock] = useState(true);
  const [isDeletingOrder, setIsDeletingOrder] = useState(false);
  const [deleteOrderError, setDeleteOrderError] = useState('');
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  // Product Form State with Image Upload & Presets
  const [prodName, setProdName] = useState('');
  const [prodCategory, setProdCategory] = useState('menu');
  const [prodPrice, setProdPrice] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodBadge, setProdBadge] = useState('Yeni Çıktı');
  const [prodStock, setProdStock] = useState('25');
  const [prodIsAvailable, setProdIsAvailable] = useState(true);
  const [prodImageUrl, setProdImageUrl] = useState('/images/hero_banner.jpg');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [imageInputMode, setImageInputMode] = useState('upload'); // 'upload' | 'presets' | 'url'
  const [dragActive, setDragActive] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  // Quick Preset Food Images
  const PRODUCT_IMAGE_PRESETS = [
    { label: 'Kasap Köfte Ekmek', url: '/images/kasap_kofte_ekmek.jpg', icon: '🥖' },
    { label: 'Megzi Dürüm', url: '/images/megzi_durum.jpg', icon: '🌯' },
    { label: 'Ayvalık Tostu', url: '/images/ayvalik_tostu.jpg', icon: '🥪' },
    { label: 'Kasap Sucuk Sandviç', url: '/images/kasap_sucuk_ekmek.jpg', icon: '🌭' },
    { label: 'Cheeseburger', url: '/images/cheeseburger.jpg', icon: '🍔' },
    { label: 'Sandviç Menü', url: '/images/hero_banner.jpg', icon: '🍱' },
    { label: 'Patates Kızartması', url: '/images/loaded_cheddar_fries.jpg', icon: '🍟' },
    { label: 'Çıtır Tavuk', url: '/images/crispy_chicken_menu.jpg', icon: '🍗' },
    { label: 'Soğuk İçecek', url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=500', icon: '🥤' }
  ];

  // Product Catalog Filters & Pagination States
  const [productFilter, setProductFilter] = useState('all');
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersPageSize, setOrdersPageSize] = useState(6);
  const [productsPage, setProductsPage] = useState(1);
  const [productsPageSize, setProductsPageSize] = useState(6);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [reviewsPageSize, setReviewsPageSize] = useState(6);

  useEffect(() => {
    setOrdersPage(1);
  }, [orderStageFilter, orderSearch, paymentMethodFilter, paymentStatusFilter]);

  useEffect(() => {
    setProductsPage(1);
  }, [productFilter]);

  // Otomatik girişi iptal et: Sayfa ilk açıldığında localStorage oturumunu otomatik yüklemiyoruz
  // Kullanıcı adı ve şifre ile manuel giriş yapılmasını zorunlu kılıyoruz.
  useEffect(() => {
    try {
      localStorage.removeItem('sd_admin_session');
      const sessionSaved = sessionStorage.getItem('sd_admin_session');
      if (sessionSaved) {
        const parsed = JSON.parse(sessionSaved);
        if (
          parsed.roleId === 'role_super_admin' ||
          parsed.email === 'admin' ||
          parsed.email === 'admin@sandwichdiyari.com' ||
          parsed.role === 'Süper Yönetici' ||
          parsed.name === 'Süper Yönetici'
        ) {
          if (!Array.isArray(parsed.permissions)) parsed.permissions = [];
          if (!parsed.permissions.includes('settings')) parsed.permissions.push('settings');
          if (!parsed.permissions.includes('view_revenue')) parsed.permissions.push('view_revenue');
          if (!parsed.permissions.includes('site_content')) parsed.permissions.push('site_content');
        }
        setAdminUser(parsed);
      }
    } catch (e) {
      sessionStorage.removeItem('sd_admin_session');
    }
  }, []);

  // Web Audio chime for new orders
  const playSoundAlert = () => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {}
  };

  // Fetch orders from API
  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      const res = await fetch('/api/orders');
      const json = await res.json();
      if (json.success && json.data) {
        if (previousOrderCount > 0 && json.data.length > previousOrderCount) {
          playSoundAlert();
          const newest = json.data[0];
          showToast(
            `🔔 Yeni Sipariş Geldi! #${newest?.orderNumber || newest?.id} (${newest?.customerName || 'Müşteri'})`,
            'success'
          );
        }
        setPreviousOrderCount(json.data.length);
        setOrders(json.data);

        // Keep modal updated if open
        if (detailOrder) {
          const fresh = json.data.find((o) => o.id === detailOrder.id);
          if (fresh) setDetailOrder(fresh);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingOrders(false);
    }
  };

  // Fetch products from API
  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        dispatch(setProducts(json.data));
      }
    } catch (err) {
      console.error('Ürünler yüklenirken hata:', err);
    }
  };

  // Müşteri Değerlendirmeleri & Onay Yönetimi
  const [adminReviews, setAdminReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [reviewFilter, setReviewFilter] = useState('all'); // 'all' | 'pending' | 'approved'
  const [reviewSearch, setReviewSearch] = useState('');

  useEffect(() => {
    setReviewsPage(1);
  }, [reviewFilter, reviewSearch]);

  const fetchReviews = async () => {
    setLoadingReviews(true);
    try {
      const res = await fetch('/api/reviews?all=true');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setAdminReviews(json.data);
        const approvedOnly = json.data.filter((r) => r.isApproved === true);
        dispatch(setReviews(approvedOnly));
      }
    } catch (err) {
      console.error('Yorumlar yüklenirken hata:', err);
    } finally {
      setLoadingReviews(false);
    }
  };

  const handleToggleReviewApproval = async (reviewId, currentApprovalStatus) => {
    const newStatus = !currentApprovalStatus;
    try {
      const res = await fetch('/api/reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reviewId, isApproved: newStatus }),
      });
      const json = await res.json();
      if (json.success) {
        setAdminReviews((prev) =>
          prev.map((r) => (String(r.id) === String(reviewId) ? { ...r, isApproved: newStatus } : r))
        );
        dispatch(updateReviewStatus({ id: reviewId, isApproved: newStatus }));
        if (typeof window !== 'undefined') {
          localStorage.setItem('sandwich_reviews_updated', String(Date.now()));
        }
        showToast(
          newStatus
            ? 'Değerlendirme onaylandı ve müşteri sitesinde yayına alındı! ⭐'
            : 'Değerlendirme siteden kaldırıldı (gizlendi).',
          'success'
        );
      } else {
        showToast(json.error || 'İşlem gerçekleştirilemedi.', 'error');
      }
    } catch (err) {
      showToast('Bağlantı hatası oluştu.', 'error');
    }
  };

  const handleDeleteReview = async (reviewId) => {
    if (!confirm('Bu değerlendirmeyi kalıcı olarak silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`/api/reviews?id=${encodeURIComponent(reviewId)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        setAdminReviews((prev) => prev.filter((r) => String(r.id) !== String(reviewId)));
        dispatch(removeReview(reviewId));
        if (typeof window !== 'undefined') {
          localStorage.setItem('sandwich_reviews_updated', String(Date.now()));
        }
        showToast('Değerlendirme sistemden silindi.', 'success');
      } else {
        showToast(json.error || 'Silinemedi.', 'error');
      }
    } catch (err) {
      showToast('Bağlantı hatası.', 'error');
    }
  };

  const [reviewsSubTab, setReviewsSubTab] = useState('reviews'); // 'reviews' | 'feedbacks'
  const [adminFeedbacks, setAdminFeedbacks] = useState([]);
  const [loadingFeedbacks, setLoadingFeedbacks] = useState(false);
  const [feedbackSearch, setFeedbackSearch] = useState('');
  const [feedbackTypeFilter, setFeedbackTypeFilter] = useState('all');
  const [feedbacksPage, setFeedbacksPage] = useState(1);
  const [feedbacksPageSize, setFeedbacksPageSize] = useState(6);

  useEffect(() => {
    setFeedbacksPage(1);
  }, [feedbackSearch, feedbackTypeFilter]);

  const fetchFeedbacks = async () => {
    setLoadingFeedbacks(true);
    try {
      const res = await fetch('/api/feedback');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setAdminFeedbacks(json.data);
      }
    } catch (err) {
      console.error('Geri bildirimler yüklenirken hata:', err);
    } finally {
      setLoadingFeedbacks(false);
    }
  };

  const handleDeleteFeedback = async (feedbackId) => {
    if (!confirm('Bu geri bildirim mesajını kalıcı olarak silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`/api/feedback?id=${encodeURIComponent(feedbackId)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        setAdminFeedbacks((prev) => prev.filter((f) => String(f.id) !== String(feedbackId)));
        showToast('Geri bildirim mesajı sistemden silindi.', 'success');
      } else {
        showToast(json.error || 'Silinemedi.', 'error');
      }
    } catch (err) {
      showToast('Bağlantı hatası.', 'error');
    }
  };

  useEffect(() => {
    if (adminUser) {
      fetchOrders();
      fetchProducts();
      fetchReviews();
      fetchFeedbacks();

      // Canlı sipariş dinleyici: Müşteri sipariş verdiğinde anında algıla
      const handleStorageChange = (e) => {
        if (
          e.key === 'sd_new_order_alert' ||
          e.key === 'sd_last_order' ||
          e.key === 'sandwich_orders_updated'
        ) {
          fetchOrders();
        }
      };

      const handleFocus = () => fetchOrders();
      window.addEventListener('storage', handleStorageChange);
      window.addEventListener('focus', handleFocus);

      // Müşteri siparişlerini restoran hızında (5 saniyede bir) kontrol et
      const ordersPollTimer = setInterval(() => {
        fetchOrders();
      }, 5000);

      // İnceleme ve geri bildirimleri kontrol et
      const otherPollTimer = setInterval(() => {
        fetchReviews();
        fetchFeedbacks();
      }, 20000);

      return () => {
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener('focus', handleFocus);
        clearInterval(ordersPollTimer);
        clearInterval(otherPollTimer);
      };
    }
  }, [adminUser, previousOrderCount]);

  // Login handler
  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginEmail, email: loginEmail, pass: loginPass }),
      });
      const json = await res.json();

      if (json.success) {
        const loggedAdmin = json.data.admin;
        setAdminUser(loggedAdmin);
        sessionStorage.setItem('sd_admin_session', JSON.stringify(loggedAdmin));
        localStorage.removeItem('sd_admin_session');
        if (
          Array.isArray(loggedAdmin?.permissions) &&
          loggedAdmin.permissions.length > 0 &&
          !loggedAdmin.permissions.includes(currentTab)
        ) {
          setCurrentTab(loggedAdmin.permissions[0]);
        }
      } else {
        setLoginError(json.error || 'Giriş yapılamadı.');
      }
    } catch (err) {
      setLoginError('Bağlantı hatası oluştu.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setAdminUser(null);
    sessionStorage.removeItem('sd_admin_session');
    localStorage.removeItem('sd_admin_session');
  };

  // Open Order Detail & View Tracker (Mark Viewed, but DO NOT Accept!)
  const handleOpenDetail = async (order) => {
    setDetailOrder(order);

    if (!order.isViewed || order.status === 'Yeni') {
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(order.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'view',
            user: adminUser ? adminUser.name : 'Yönetici',
          }),
        });
        const json = await res.json();
        if (json.success && json.data) {
          setOrders((prev) =>
            prev.map((o) =>
              String(o.id) === String(order.id) || String(o.orderNumber) === String(order.id)
                ? json.data
                : o
            )
          );
          setDetailOrder((prev) =>
            prev && (String(prev.id) === String(order.id) || String(prev.orderNumber) === String(order.id))
              ? json.data
              : prev
          );
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Progress status with validation
  const handleProgressStatus = async (orderId, newStatus) => {
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          user: adminUser ? adminUser.name : 'Yetkili',
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setOrders((prev) =>
          prev.map((o) =>
            String(o.id) === String(orderId) ||
            String(o.id) === String(json.data.id) ||
            (o.orderNumber && String(o.orderNumber) === String(orderId))
              ? json.data
              : o
          )
        );
        if (
          detailOrder &&
          (String(detailOrder.id) === String(orderId) ||
            String(detailOrder.id) === String(json.data.id) ||
            (detailOrder.orderNumber && String(detailOrder.orderNumber) === String(orderId)))
        ) {
          setDetailOrder(json.data);
        }
        showToast(
          newStatus === 'Onaylandı'
            ? `Sipariş #${json.data.orderNumber || orderId} onaylandı ve mutfağa iletildi! ✅`
            : `Sipariş durumu güncellendi: ${newStatus}`,
          'success'
        );
      } else {
        showToast(json.error || 'Durum güncellenemedi.', 'error');
        fetchOrders();
      }
    } catch (err) {
      showToast('Sipariş durumu güncellenirken bağlantı hatası oluştu.', 'error');
    }
  };

  // Confirm Cancellation
  const handleConfirmCancel = async () => {
    if (!cancelModalOrder) return;
    const finalReason = cancelReason === 'Diğer' ? customCancelReason : cancelReason;

    try {
      const res = await fetch(`/api/orders/${cancelModalOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'İptal Edildi',
          user: adminUser ? adminUser.name : 'Yönetici',
          reason: finalReason || 'Gerekçe belirtilmedi',
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setOrders((prev) =>
          prev.map((o) => (o.id === cancelModalOrder.id ? json.data : o))
        );
        if (detailOrder && detailOrder.id === cancelModalOrder.id) {
          setDetailOrder(json.data);
        }
        setCancelModalOrder(null);
      } else {
        alert(json.error || 'İptal işlemi başarısız.');
      }
    } catch (err) {
      alert('İptal işlemi yapılamadı.');
    }
  };

  // Yönetici Onaylı Kalıcı Sipariş Silme
  const handleConfirmDeleteOrder = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!deleteModalOrder) return;
    if (!deleteAdminPassword.trim()) {
      setDeleteOrderError('Lütfen yönetici şifrenizi giriniz.');
      return;
    }

    setIsDeletingOrder(true);
    setDeleteOrderError('');

    try {
      const res = await fetch(`/api/orders/${deleteModalOrder.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: deleteAdminPassword.trim(),
          restoreStock: deleteRestoreStock,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        setDeleteOrderError(json.error || 'Sipariş silinemedi.');
        return;
      }

      setOrders((prev) => prev.filter((o) => o.id !== deleteModalOrder.id));

      if (detailOrder && detailOrder.id === deleteModalOrder.id) {
        setDetailOrder(null);
      }

      setDeleteModalOrder(null);
      setDeleteAdminPassword('');
      dispatch(
        showMessageModal({
          title: 'Sipariş Silindi 🗑️',
          text: json.message || `#${deleteModalOrder.orderNumber || deleteModalOrder.id} numaralı sipariş başarıyla silindi.`,
          type: 'success',
        })
      );
    } catch (err) {
      setDeleteOrderError('Bağlantı hatası oluştu.');
    } finally {
      setIsDeletingOrder(false);
    }
  };

  // Reset Product Form
  const resetProductForm = () => {
    setProdName('');
    setProdCategory('menu');
    setProdPrice('');
    setProdStock('25');
    setProdIsAvailable(true);
    setProdDesc('');
    setProdBadge('Yeni Çıktı');
    setProdImageUrl('/images/hero_banner.jpg');
    setSelectedFileName('');
    setImageInputMode('upload');
    setEditingProduct(null);
  };

  // Open Add Product Modal
  const openAddProductModal = () => {
    resetProductForm();
    setIsAddProductOpen(true);
  };

  // Open Edit Product Modal
  const openEditProductModal = (product) => {
    setEditingProduct(product);
    setProdName(product.name || '');
    setProdCategory(product.category || 'menu');
    setProdPrice(product.price ? String(product.price) : '');
    setProdStock(String(product.stock ?? 25));
    setProdIsAvailable(product.isAvailable !== false);
    setProdDesc(product.description || '');
    setProdBadge(product.badge || '');
    setProdImageUrl(product.image || '/images/hero_banner.jpg');
    setSelectedFileName(product.image?.startsWith('/uploads/') ? 'Yüklenmiş Dosya' : '');
    setImageInputMode(product.image?.startsWith('http') ? 'url' : 'upload');
    setIsAddProductOpen(true);
  };

  // Quick One-click Toggle Availability from Menu & Products list
  const handleQuickToggleAvailability = async (product) => {
    const newAvail = !(product.isAvailable !== false);
    try {
      const res = await fetch('/api/inventory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: product.id,
          isAvailable: newAvail,
          ...(newAvail && Number(product.stock) <= 0 ? { stock: 15 } : {})
        }),
      });
      const json = await res.json();
      if (json.success && json.products) {
        dispatch(setProducts(json.products));
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('sandwich_inventory_updated', Date.now().toString());
          } catch (e) {}
        }
        dispatch(
          showMessageModal({
            title: newAvail ? 'Satışa Açıldı 🟢' : 'Siparişe Kapatıldı 🔴',
            text: `"${product.name}" müşteriler için ${newAvail ? 'satışa açıldı' : 'tükendi olarak işaretlendi'}.`,
            type: newAvail ? 'success' : 'info',
          })
        );
      }
    } catch (err) {
      console.error('Hızlı durum değiştirme hatası:', err);
    }
  };

  // File Upload Helper (Uploads to /api/upload and sets image URL)
  const uploadFile = async (file) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Lütfen yalnızca geçerli bir resim dosyası seçin (PNG, JPG, WEBP, GIF).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Görsel boyutu en fazla 5MB olabilir.');
      return;
    }

    setIsUploadingImage(true);
    setSelectedFileName(file.name);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (json.success && json.url) {
        setProdImageUrl(json.url);
        dispatch(
          showMessageModal({
            title: 'Görsel Yüklendi',
            text: `"${file.name}" görseli başarıyla yüklendi.`,
            type: 'success',
          })
        );
      } else {
        alert(json.error || 'Görsel yüklenemedi.');
      }
    } catch (err) {
      alert('Görsel sunucuya yüklenirken hata oluştu.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Image Upload Input Handler
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile(file);
    }
  };

  // Save Product (Add new or Update existing)
  const handleProductSubmit = async (e) => {
    e.preventDefault();
    if (!prodName.trim()) {
      alert('Lütfen ürün adını giriniz.');
      return;
    }
    if (!prodPrice || isNaN(parseFloat(prodPrice))) {
      alert('Lütfen geçerli bir fiyat giriniz.');
      return;
    }

    const payload = {
      name: prodName.trim(),
      category: prodCategory,
      price: parseFloat(prodPrice),
      stock: prodStock !== '' ? Number(prodStock) : 25,
      isAvailable: prodIsAvailable,
      trackStock: true,
      description: prodDesc.trim(),
      badge: prodBadge.trim(),
      image: prodImageUrl || '/images/hero_banner.jpg',
    };

    if (editingProduct) {
      // Edit existing product
      try {
        const res = await fetch(`/api/products/${editingProduct.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (json.success && json.data) {
          dispatch(updateProduct(json.data));
          fetchProducts();
          if (typeof window !== 'undefined') {
            localStorage.setItem('sandwich_inventory_updated', String(Date.now()));
          }
          setIsAddProductOpen(false);
          resetProductForm();
          showToast(`"${payload.name}" başarıyla güncellendi.`, 'success');
        } else {
          showToast(json.error || 'Ürün güncellenemedi.', 'error');
        }
      } catch (err) {
        showToast('Sunucu bağlantı hatası oluştu.', 'error');
      }
    } else {
      // Add new product
      try {
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (json.success && json.data) {
          dispatch(addProduct(json.data));
          fetchProducts();
          if (typeof window !== 'undefined') {
            localStorage.setItem('sandwich_inventory_updated', String(Date.now()));
          }
          setIsAddProductOpen(false);
          resetProductForm();
          showToast(`"${payload.name}" başarıyla menüye eklendi.`, 'success');
        } else {
          showToast(json.error || 'Ürün eklenirken bir hata oluştu.', 'error');
        }
      } catch (err) {
        showToast('Sunucu bağlantı hatası oluştu.', 'error');
      }
    }
  };

  // Delete product with API synchronization
  const handleDeleteProduct = async (id) => {
    if (confirm('Bu ürünü menüden silmek istediğinize emin misiniz?')) {
      try {
        await fetch(`/api/products/${id}`, { method: 'DELETE' });
      } catch (e) {}
      dispatch(deleteProduct(id));
      dispatch(
        showMessageModal({
          title: 'Ürün Silindi',
          text: 'Ürün menüden kaldırıldı.',
          type: 'success',
        })
      );
    }
  };

  // Kurye Atama İşlemi
  const handleAssignCourier = async (orderId, courierName) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courierName,
          user: adminUser ? adminUser.name : 'Yönetici'
        })
      });
      const json = await res.json();
      if (json.success) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, courierName } : o));
        if (detailOrder && detailOrder.id === orderId) {
          setDetailOrder(prev => ({ ...prev, courierName }));
        }
        showToast(
          courierName
            ? `Sipariş kuryeye (${courierName}) başarıyla atandı! 🛵`
            : `Siparişin kurye ataması kaldırıldı.`,
          'success'
        );
      } else {
        showToast(json.error || 'Kurye ataması yapılamadı.', 'error');
      }
    } catch (e) {
      console.error('Kurye atama hatası:', e);
      showToast('Kurye atanırken bağlantı hatası oluştu.', 'error');
    }
  };

  // Yetki Kontrolleri: Süper Yönetici veya 'view_revenue' iznine sahip personel
  const isSuperAdmin = Boolean(
    adminUser && (
      adminUser.email === 'admin' ||
      adminUser.email === 'admin@sandwichdiyari.com' ||
      adminUser.roleId === 'role_super_admin' ||
      adminUser.role === 'Süper Yönetici' ||
      String(adminUser.email || '').toLowerCase().includes('hknkcpnr')
    )
  );

  const canViewRevenue = Boolean(
    isSuperAdmin ||
    (Array.isArray(adminUser?.permissions) && adminUser.permissions.includes('view_revenue'))
  );

  const canEditSiteContent = Boolean(
    adminUser && (
      isSuperAdmin ||
      !adminUser.permissions ||
      !Array.isArray(adminUser.permissions) ||
      adminUser.permissions.includes('site_content')
    )
  );

  // Excel / CSV Dışa Aktarma
  const exportOrdersToCsv = (orderList) => {
    if (!orderList || orderList.length === 0) {
      alert('Dışa aktarılacak sipariş bulunmuyor.');
      return;
    }
    const headers = ['Siparis No', 'Tarih', 'Musteri', 'Telefon', 'Mahalle / Adres', 'Odeme Yontemi', 'Tutar (TL)', 'Odeme Durumu', 'Siparis Durumu', 'Kurye', 'Notlar'];
    const rows = orderList.map(o => [
      `"${o.orderNumber || o.id}"`,
      `"${o.date || o.createdAt || ''}"`,
      `"${(o.customerName || '').replace(/"/g, '""')}"`,
      `"${(o.phone || '').replace(/"/g, '""')}"`,
      `"${(o.address || '').replace(/"/g, '""')}"`,
      `"${o.paymentMethod || 'Kapıda Nakit'}"`,
      `"${canViewRevenue ? Number(o.total || o.subtotal || 0).toFixed(2) : '***'}"`,
      `"${o.paymentStatus || 'Bekleniyor'}"`,
      `"${o.status || 'Yeni'}"`,
      `"${o.courierName || 'Atanmadı'}"`,
      `"${(o.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Sandvic_Diyari_Siparisler_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Günlük Z Raporu / Kasa Kapanış Çıktısı
  const printZReport = (ordersList) => {
    if (!canViewRevenue) {
      alert('Z Raporu ve ciro detaylarını görüntüleme yetkiniz bulunmamaktadır.');
      return;
    }
    const todayStr = new Date().toLocaleDateString('tr-TR');
    const todayOrders = ordersList.filter(o => o.date === todayStr || (o.createdAt && new Date(o.createdAt).toLocaleDateString('tr-TR') === todayStr));
    const list = todayOrders.length > 0 ? todayOrders : ordersList;

    const totalCount = list.length;
    const completed = list.filter(o => o.status === 'Teslim Edildi');
    const cancelled = list.filter(o => o.status === 'İptal Edildi' || o.status === 'İptal');
    const active = list.filter(o => o.status !== 'Teslim Edildi' && o.status !== 'İptal Edildi' && o.status !== 'İptal');

    const totalRevenue = completed.reduce((sum, o) => sum + Number(o.total || o.subtotal || 0), 0);
    const cashRevenue = completed.filter(o => (o.paymentMethod || '').toLowerCase().includes('nakit')).reduce((sum, o) => sum + Number(o.total || o.subtotal || 0), 0);
    const cardRevenue = completed.filter(o => (o.paymentMethod || '').toLowerCase().includes('kart')).reduce((sum, o) => sum + Number(o.total || o.subtotal || 0), 0);

    const productCounts = {};
    list.forEach(o => {
      if (Array.isArray(o.items)) {
        o.items.forEach(i => {
          const name = typeof i === 'string' ? i : i.name;
          const qty = typeof i === 'object' && i.quantity ? Number(i.quantity) : 1;
          productCounts[name] = (productCounts[name] || 0) + qty;
        });
      }
    });
    const topProducts = Object.entries(productCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const printWindow = window.open('', '_blank', 'width=380,height=600');
    if (!printWindow) {
      alert('Lütfen tarayıcınızın açılır pencerelerine (pop-up) izin veriniz.');
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Günlük Z Raporu - Sandviç Diyarı</title>
        <style>
          body { font-family: 'Courier New', monospace; font-size: 11px; margin: 0; padding: 14px; color: #000; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
          .double-divider { border-top: 2px dashed #000; margin: 8px 0; }
          .row { display: flex; justify-content: space-between; margin: 3px 0; }
          .bold { font-weight: bold; }
          .title { font-size: 15px; font-weight: bold; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="text-center">
          <div class="title">SANDVİÇ DİYARI</div>
          <div>Torbalı Mah. Hüseyin Kurtuldu Sok. No:32 Torbalı/İZMİR</div>
          <div>Tel: 0232 856 81 21 / 0552 104 55 35</div>
          <div class="bold" style="margin-top:6px;">*** GÜNLÜK Z RAPORU / KASA KAPANIŞI ***</div>
          <div>Tarih / Saat: ${new Date().toLocaleString('tr-TR')}</div>
        </div>
        <div class="double-divider"></div>
        <div class="row"><span>Toplam İşlem Adedi:</span><span class="bold">${totalCount} Sipariş</span></div>
        <div class="row"><span>Teslim Edilen:</span><span class="bold">${completed.length} Adet</span></div>
        <div class="row"><span>İptal Edilen:</span><span class="bold">${cancelled.length} Adet</span></div>
        <div class="row"><span>Bekleyen / Yoldaki:</span><span class="bold">${active.length} Adet</span></div>
        <div class="divider"></div>
        <div class="row"><span>Kapıda Nakit Tahsilat:</span><span class="bold">₺${cashRevenue.toFixed(2)}</span></div>
        <div class="row"><span>Kapıda Kart / POS:</span><span class="bold">₺${cardRevenue.toFixed(2)}</span></div>
        <div class="double-divider"></div>
        <div class="row bold" style="font-size:13px;">
          <span>KESİNLEŞEN TOPLAM CİRO:</span>
          <span>₺${totalRevenue.toFixed(2)}</span>
        </div>
        <div class="divider"></div>
        <div class="bold" style="margin-bottom:4px;">GÜNÜN EN ÇOK SATANLARI:</div>
        ${topProducts.map(([name, count]) => `<div class="row"><span>${name}</span><span class="bold">${count} Adet</span></div>`).join('')}
        <div class="double-divider"></div>
        <div class="text-center" style="margin-top:20px;">
          <div>Kasa / Şube Yetkilisi</div>
          <div style="margin-top:25px;">_______________________</div>
        </div>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // --------------------------------------------------------------------------
  // CİRO VE OPERASYONEL HESAPLAMALAR
  // --------------------------------------------------------------------------
  // Kesinleşmiş Ciro: Yalnızca teslim edilen ve elden tahsil edilenler
  const confirmedRevenue = orders
    .filter((o) => o.status === 'Teslim Edildi' && o.paymentStatus === 'Ödendi')
    .reduce((sum, o) => sum + (Number(o.total) || Number(o.subtotal) || 0), 0);

  // Beklenen Ciro: Aktif hazırlıkta/yoldaki siparişler
  const pendingRevenue = orders
    .filter((o) => o.status !== 'Teslim Edildi' && o.status !== 'İptal Edildi')
    .reduce((sum, o) => sum + (Number(o.total) || Number(o.subtotal) || 0), 0);

  const newOrdersCount = orders.filter((o) => o.status === 'Yeni' || o.status === 'Görüntülendi').length;
  const kitchenCount = orders.filter((o) => o.status === 'Onaylandı' || o.status === 'Hazırlanıyor').length;
  const courierCount = orders.filter((o) => o.status === 'Hazır' || o.status === 'Kurye Teslim Aldı' || o.status === 'Yolda').length;
  const completedCount = orders.filter((o) => o.status === 'Teslim Edildi').length;
  const cancelledCount = orders.filter((o) => o.status === 'İptal Edildi').length;

  // Filtered Orders
  const filteredOrders = orders.filter((o) => {
    // Stage Filter
    let stageMatch = true;
    if (orderStageFilter === 'new') stageMatch = o.status === 'Yeni' || o.status === 'Görüntülendi';
    else if (orderStageFilter === 'kitchen') stageMatch = o.status === 'Onaylandı' || o.status === 'Hazırlanıyor';
    else if (orderStageFilter === 'courier') stageMatch = o.status === 'Hazır' || o.status === 'Kurye Teslim Aldı' || o.status === 'Yolda';
    else if (orderStageFilter === 'completed') stageMatch = o.status === 'Teslim Edildi';
    else if (orderStageFilter === 'cancelled') stageMatch = o.status === 'İptal Edildi';

    // Payment Method Filter
    let payMethodMatch = true;
    if (paymentMethodFilter !== 'all') {
      payMethodMatch = o.paymentMethod === paymentMethodFilter;
    }

    // Payment Status Filter
    let payStatusMatch = true;
    if (paymentStatusFilter !== 'all') {
      payStatusMatch = o.paymentStatus === paymentStatusFilter;
    }

    // Text Search
    const q = orderSearch.toLowerCase();
    const searchMatch =
      !q ||
      (o.orderNumber && o.orderNumber.toLowerCase().includes(q)) ||
      (o.customerName && o.customerName.toLowerCase().includes(q)) ||
      (o.phone && o.phone.includes(q)) ||
      (o.address && o.address.toLowerCase().includes(q));

    return stageMatch && payMethodMatch && payStatusMatch && searchMatch;
  });

  // Filtered Products Catalog
  const filteredProducts = products.filter((p) => {
    if (productFilter === 'all') return true;
    return p.category === productFilter;
  });

  const safeOrdersPage = Math.min(
    ordersPage,
    Math.max(1, Math.ceil(filteredOrders.length / ordersPageSize))
  );
  const paginatedOrders = filteredOrders.slice(
    (safeOrdersPage - 1) * ordersPageSize,
    safeOrdersPage * ordersPageSize
  );

  const safeProductsPage = Math.min(
    productsPage,
    Math.max(1, Math.ceil(filteredProducts.length / productsPageSize))
  );
  const paginatedProducts = filteredProducts.slice(
    (safeProductsPage - 1) * productsPageSize,
    safeProductsPage * productsPageSize
  );

  // ----------------------------------------------------
  // LOGIN SCREEN
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
                <span className="text-[11px] text-stone-500 font-medium block">Restoran Yönetim Portalı</span>
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
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
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
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                placeholder="admin"
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs text-stone-900 focus:outline-none focus:border-stone-400 font-medium"
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full bg-stone-900 hover:bg-black text-white text-xs font-semibold py-3 rounded-xl transition-colors cursor-pointer mt-2"
            >
              {isLoggingIn ? 'Giriş Yapılıyor...' : 'Panele Giriş Yap'}
            </button>
          </form>

          <div className="pt-2 border-t border-stone-100 text-center">
            <a href="/" className="text-stone-400 hover:text-stone-700 text-xs transition-colors">
              &larr; Müşteri Sitesine Git
            </a>
          </div>
        </div>

        {/* GLOBAL TOAST POPUP (Geri Bildirim & Durum Bildirimleri) */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl text-xs font-bold border ${
              toast.type === 'error'
                ? 'bg-rose-900 text-white border-rose-700 shadow-rose-950/20'
                : toast.type === 'info'
                ? 'bg-stone-900 text-white border-stone-700 shadow-stone-950/20'
                : 'bg-emerald-800 text-white border-emerald-600 shadow-emerald-950/20'
            }`}
          >
            <i
              className={`text-sm ${
                toast.type === 'error'
                  ? 'fa-solid fa-circle-exclamation text-rose-300'
                  : toast.type === 'info'
                  ? 'fa-solid fa-circle-info text-sky-300'
                  : 'fa-solid fa-circle-check text-emerald-300'
              }`}
            ></i>
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="ml-2 text-stone-400 hover:text-white cursor-pointer"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>
      )}

      <MessageModal />
      </div>
    );
  }

  // ----------------------------------------------------
  // DASHBOARD MAIN VIEW
  // ----------------------------------------------------
  const fontSizeClass =
    adminSettings?.fontSize === 'large'
      ? 'text-sm [&_.text-xs]:text-[13px] [&_.text-\\[10px\\]]:text-xs [&_.text-\\[11px\\]]:text-xs'
      : adminSettings?.fontSize === 'small'
      ? 'text-[11px] [&_.text-xs]:text-[11px]'
      : 'text-xs';

  return (
    <div className={`min-h-screen w-full max-w-full overflow-x-hidden bg-stone-50 text-stone-900 flex font-poppins ${fontSizeClass} selection:bg-brand-500 selection:text-white`}>
      {/* MOBILE BACKDROP OVERLAY */}
      {mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs z-40 md:hidden animate-in fade-in duration-200"
          aria-hidden="true"
        />
      )}

      {/* COLLAPSIBLE SIDEBAR & MOBILE SLIDE-OVER DRAWER */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-stone-200 flex flex-col justify-between transition-all duration-300 ease-in-out
          ${mobileSidebarOpen ? 'translate-x-0 w-80 max-w-[90vw] shadow-2xl' : '-translate-x-full md:translate-x-0'}
          ${sidebarCollapsed ? 'md:w-20' : 'md:w-80'}
        `}
      >
        <div>
          {/* Logo Header */}
          <div className="h-16 px-4 flex items-center justify-between border-b border-stone-100 bg-stone-50/50">
            <div className={`flex items-center gap-2.5 min-w-0 ${sidebarCollapsed ? 'md:justify-center md:w-full' : ''}`}>
              <button
                type="button"
                onClick={sidebarCollapsed ? toggleSidebar : undefined}
                className={`flex items-center justify-center shrink-0 ${
                  sidebarCollapsed ? 'cursor-pointer hover:scale-105 transition-all' : ''
                }`}
                title="Sandviç Diyarı"
              >
                <img
                  src="/logo.png?v=2"
                  alt="Sandviç Diyarı Logo"
                  className="h-8 w-auto object-contain drop-shadow-xs"
                />
              </button>
              <div className={`min-w-0 flex-1 ${sidebarCollapsed ? 'md:hidden' : ''}`}>
                <span className="font-extrabold text-sm block truncate text-stone-900 leading-tight">
                  Sandviç Diyarı
                </span>
                <span className="text-[10px] text-stone-400 block truncate">Sipariş Portalı</span>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              className="md:hidden text-stone-400 hover:text-stone-700 p-2 rounded-xl hover:bg-stone-100 transition-colors cursor-pointer"
              aria-label="Menüyü Kapat"
            >
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>
          </div>

          {/* Navigation Items */}
          <nav className={`p-3 space-y-1 ${sidebarCollapsed ? 'md:px-2' : ''}`}>
            {[
              {
                id: 'overview',
                label: 'Genel Bakış',
                icon: 'fa-solid fa-chart-pie',
                badge: 'Canlı',
                badgeColor: 'bg-emerald-50 text-emerald-700 font-bold',
              },
              {
                id: 'orders',
                label: 'Sipariş Yönetimi',
                icon: 'fa-solid fa-list-check',
                badge: newOrdersCount > 0 ? `${newOrdersCount} Yeni` : orders.length,
                badgeColor: newOrdersCount > 0 ? 'bg-red-500 text-white animate-pulse' : 'bg-stone-100 text-stone-600',
              },
              {
                id: 'members',
                label: 'Üye Yönetimi',
                icon: 'fa-solid fa-users',
                badge: 'Müşteriler',
                badgeColor: 'bg-indigo-50 text-indigo-700 font-bold',
              },
              {
                id: 'products',
                label: 'Menü & Ürünler',
                icon: 'fa-solid fa-burger',
                badge: products.length,
                badgeColor: 'bg-stone-100 text-stone-600',
              },
              {
                id: 'options',
                label: 'Soslar & Ekstralar',
                icon: 'fa-solid fa-bottle-droplet',
                badge: 'Özelleştirme',
                badgeColor: 'bg-amber-50 text-amber-700 font-bold',
              },
              {
                id: 'inventory',
                label: 'Stok Yönetimi',
                icon: 'fa-solid fa-boxes-stacked',
                badge: products.filter(p => p.isAvailable === false).length > 0
                  ? `${products.filter(p => p.isAvailable === false).length} Kapalı`
                  : null,
                badgeColor: 'bg-rose-500 text-white font-bold animate-pulse',
              },
              {
                id: 'reviews',
                label: 'Geri Bildirimler',
                icon: 'fa-regular fa-star',
                badge: adminReviews.filter(r => r.isApproved !== true).length > 0
                  ? `${adminReviews.filter(r => r.isApproved !== true).length} Yeni`
                  : adminFeedbacks.length > 0
                  ? `${adminFeedbacks.length} Mesaj`
                  : adminReviews.length > 0
                  ? adminReviews.length
                  : null,
                badgeColor: adminReviews.filter(r => r.isApproved !== true).length > 0
                  ? 'bg-amber-500 text-white font-bold animate-pulse'
                  : 'bg-stone-100 text-stone-600',
              },
              {
                id: 'settings',
                label: 'Sistem Ayarları',
                icon: 'fa-solid fa-sliders',
                badge: 'Panel',
                badgeColor: 'bg-stone-100 text-stone-600 font-bold',
                hasSubmenu: true,
                subItems: [
                  { id: 'appearance', label: 'Yazı Boyutu & Arayüz', icon: 'fa-solid fa-text-height' },
                  { id: 'users', label: 'Kullanıcılar & Roller', icon: 'fa-solid fa-user-shield' },
                  { id: 'sound', label: 'Ses & Bildirimler', icon: 'fa-solid fa-volume-high' },
                  { id: 'receipt', label: 'Fiş & Adisyon Baskısı', icon: 'fa-solid fa-receipt' },
                  { id: 'system', label: 'Yedekleme & Sistem', icon: 'fa-solid fa-box-archive' },
                  { id: 'api', label: 'PostgreSQL & Güvenlik', icon: 'fa-solid fa-database' },
                ],
              },
            ]
              .filter((item) => {
                if (isSuperAdmin) return true;
                if (!adminUser?.permissions || !Array.isArray(adminUser.permissions)) return true;
                return adminUser.permissions.includes(item.id);
              })
              .map((item) => {
              const active = currentTab === item.id;
              if (item.hasSubmenu) {
                const isExpanded = item.id === 'settings' ? settingsExpanded : false;

                const toggleExpanded = () => {
                  setCurrentTab(item.id);
                  if (item.id === 'settings') {
                    setSettingsExpanded((prev) => !prev);
                  }
                  if (sidebarCollapsed) {
                    setSidebarCollapsed(false);
                  }
                };

                return (
                  <div key={item.id} className="space-y-1">
                    <button
                      type="button"
                      onClick={toggleExpanded}
                      title={item.label}
                      className={`w-full flex items-center ${
                        sidebarCollapsed
                          ? 'md:justify-center md:h-11 md:px-0 justify-between px-3 py-2.5'
                          : 'justify-between px-3.5 py-2.5'
                      } rounded-xl font-semibold text-xs sm:text-sm transition-all duration-200 cursor-pointer relative group ${
                        active
                          ? 'bg-stone-900 text-white shadow-sm'
                          : 'text-stone-600 hover:text-stone-950 hover:bg-stone-100'
                      }`}
                    >
                      <div className={`flex items-center ${sidebarCollapsed ? 'md:justify-center gap-2.5' : 'gap-3 min-w-0'}`}>
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                          active
                            ? 'bg-white/15 text-white'
                            : 'bg-stone-100 text-stone-500 group-hover:bg-amber-100 group-hover:text-amber-800'
                        }`}>
                          <i className={`${item.icon} text-xs`}></i>
                        </div>
                        <span className={`font-semibold tracking-tight whitespace-nowrap ${sidebarCollapsed ? 'md:hidden inline' : ''}`}>
                          {item.label}
                        </span>
                      </div>

                      <div className={`flex items-center gap-2 shrink-0 ${sidebarCollapsed ? 'md:hidden' : ''}`}>
                        {item.badge && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0 ${
                            active
                              ? 'bg-amber-400 text-stone-950'
                              : 'bg-stone-100 text-stone-600'
                          }`}>
                            {item.badge}
                          </span>
                        )}
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-transform duration-200 ${
                          isExpanded ? 'rotate-180 text-white' : 'text-stone-400 group-hover:text-stone-700'
                        }`}>
                          <i className="fa-solid fa-chevron-down text-[10px]"></i>
                        </div>
                      </div>

                      {sidebarCollapsed && item.badge && (
                        <span
                          className="hidden md:block absolute top-2 right-3 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white"
                          title={String(item.badge)}
                        ></span>
                      )}
                    </button>

                    {/* AÇILIR ALT MENÜ (MODERN KART AKORDEON DROPDOWN) */}
                    <div
                      className={`grid transition-all duration-200 ease-in-out ${
                        isExpanded && !sidebarCollapsed
                          ? 'grid-rows-[1fr] opacity-100 mt-1.5'
                          : 'grid-rows-[0fr] opacity-0 pointer-events-none'
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div className="p-1.5 space-y-1 bg-stone-50/95 border border-stone-200/80 rounded-2xl shadow-2xs">
                          {item.subItems.map((sub) => {
                            const isSubActive =
                              (item.id === 'site_content' && currentTab === 'site_content' && selectedSiteContentSubTab === sub.id) ||
                              (item.id === 'settings' && currentTab === 'settings' && selectedSettingsSubTab === sub.id);

                            return (
                              <button
                                key={sub.id}
                                type="button"
                                onClick={() => {
                                  setCurrentTab(item.id);
                                  if (item.id === 'site_content') setSelectedSiteContentSubTab(sub.id);
                                  if (item.id === 'settings') setSelectedSettingsSubTab(sub.id);
                                  setMobileSidebarOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                                  isSubActive
                                    ? 'bg-amber-400 text-stone-950 font-bold shadow-xs'
                                    : 'text-stone-600 hover:text-stone-950 hover:bg-white'
                                }`}
                              >
                                <span className="flex items-center gap-2.5 min-w-0">
                                  <i className={`${sub.icon} text-xs w-4 text-center shrink-0 ${
                                    isSubActive ? 'text-stone-950' : 'text-stone-400'
                                  }`}></i>
                                  <span className="whitespace-nowrap font-medium text-xs">{sub.label}</span>
                                </span>
                                {isSubActive && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-stone-950 shrink-0 ml-1.5"></span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentTab(item.id);
                    setMobileSidebarOpen(false);
                  }}
                  title={item.label}
                  className={`w-full flex items-center ${
                    sidebarCollapsed ? 'md:justify-center md:h-11 md:px-0 justify-between px-3 py-2.5' : 'justify-between px-3 py-2.5'
                  } rounded-xl font-medium transition-colors cursor-pointer relative group ${
                    active
                      ? 'bg-stone-900 text-white font-semibold shadow-xs'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                  }`}
                >
                  <div className={`flex items-center ${sidebarCollapsed ? 'md:justify-center gap-2.5' : 'gap-2.5 min-w-0'}`}>
                    <i className={`${item.icon} ${sidebarCollapsed ? 'md:text-base text-sm w-4 text-center' : 'text-sm w-4 text-center'}`}></i>
                    <span className={`truncate ${sidebarCollapsed ? 'md:hidden inline' : ''}`}>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${sidebarCollapsed ? 'md:hidden inline' : ''} ${item.badgeColor}`}>
                      {item.badge}
                    </span>
                  )}
                  {sidebarCollapsed && item.badge && (
                    <span
                      className="hidden md:block absolute top-2 right-3 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white"
                      title={String(item.badge)}
                    ></span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer controls */}
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
              href="/kurye"
              target="_blank"
              rel="noreferrer"
              onClick={() => setMobileSidebarOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-amber-700 bg-amber-50/70 hover:bg-amber-100/80 font-bold transition-colors ${
                sidebarCollapsed ? 'md:w-10 md:h-10 md:justify-center md:px-0' : ''
              }`}
              title="Kurye Teslimat Panelini Aç"
            >
              <i className="fa-solid fa-motorcycle text-xs w-4 text-center text-amber-600"></i>
              <span className={`truncate ${sidebarCollapsed ? 'md:hidden' : ''}`}>Kurye Paneli (/kurye)</span>
            </a>
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              onClick={() => setMobileSidebarOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors ${
                sidebarCollapsed ? 'md:w-10 md:h-10 md:justify-center md:px-0' : ''
              }`}
              title="Müşteri Sitesini Aç"
            >
              <i className="fa-solid fa-arrow-up-right-from-square text-xs w-4 text-center"></i>
              <span className={`truncate ${sidebarCollapsed ? 'md:hidden' : ''}`}>Müşteri Sitesini Aç</span>
            </a>
            <button
              onClick={() => {
                setMobileSidebarOpen(false);
                handleLogout();
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-red-600 hover:bg-red-50 transition-colors cursor-pointer text-left ${
                sidebarCollapsed ? 'md:w-10 md:h-10 md:justify-center md:px-0' : ''
              }`}
              title="Oturumu Kapat"
            >
              <i className="fa-solid fa-arrow-right-from-bracket text-xs w-4 text-center"></i>
              <span className={`truncate ${sidebarCollapsed ? 'md:hidden' : ''}`}>Oturumu Kapat</span>
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTAINER (Full width on mobile, offset on desktop) */}
      <div className={`flex-1 min-w-0 w-full flex flex-col min-h-screen transition-all duration-300 ease-in-out pb-24 md:pb-6 ${
        sidebarCollapsed ? 'md:ml-20' : 'md:ml-80'
      }`}>
        {/* KITCHEN LOUD CONTINUOUS POS BELL & EMERGENCY VISUAL ALERT */}
        <KitchenPosBell
          orders={orders}
          onOpenOrderDetail={handleOpenDetail}
          onAcceptOrder={(id) => handleProgressStatus(id, 'Onaylandı')}
        />

        {/* TOP BAR & QUICK ACTIONS */}
        <header className="min-h-14 sm:h-16 py-2 bg-white border-b border-stone-200 px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-2 sticky top-0 z-20 shadow-xs">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            {/* Mobile Hamburger Drawer Button */}
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300/80 text-amber-950 font-bold transition-all shadow-2xs cursor-pointer active:scale-95 shrink-0"
              aria-label="Menüyü Aç"
              title="Yönetim Menüsünü Aç"
            >
              <i className="fa-solid fa-bars text-sm text-amber-800"></i>
            </button>

            <img
              src="/logo.png?v=2"
              alt="Sandviç Diyarı"
              className="md:hidden h-7 w-auto object-contain shrink-0 drop-shadow-2xs"
            />

            {/* Desktop Sidebar Toggle Button */}
            <button
              type="button"
              onClick={toggleSidebar}
              className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300/80 text-amber-950 font-bold transition-all shadow-2xs cursor-pointer active:scale-95 group shrink-0"
              title={sidebarCollapsed ? 'Menüyü Genişlet' : 'Menüyü Daralt'}
              aria-label="Menü Aç / Kapat"
            >
              <i className={`fa-solid ${sidebarCollapsed ? 'fa-bars-staggered' : 'fa-bars'} text-sm text-amber-700 group-hover:text-amber-900`}></i>
              <span className="text-xs font-bold text-amber-950">
                {sidebarCollapsed ? 'Menüyü Aç' : 'Menü'}
              </span>
            </button>

            <h2 className="font-bold text-stone-900 text-xs sm:text-sm truncate min-w-0">
              {currentTab === 'overview' && 'Genel Bakış & Performans'}
              {currentTab === 'orders' && 'Sipariş Durumu & Operasyon'}
              {currentTab === 'members' && 'Kayıtlı Üye & Müşteri Yönetimi'}
              {currentTab === 'inventory' && 'Stok & Satış Yönetimi'}
              {currentTab === 'products' && 'Menü & Ürün Yönetimi'}
              {currentTab === 'options' && 'Soslar, Ekstralar & Sepet Seçenekleri'}
              {currentTab === 'users' && 'Kullanıcılar & Rol Modelleri Yönetimi'}
              {currentTab === 'reviews' && 'Müşteri Değerlendirmeleri'}
              {currentTab === 'api' && 'PostgreSQL 16 ORM, TypeScript & Siber Güvenlik Merkezi'}
              {currentTab === 'site_content' && 'Sayfa Düzenleri & Vitrin Stüdyosu'}
              {currentTab === 'settings' && (
                selectedSettingsSubTab === 'users' ? 'Sistem Ayarları • Kullanıcılar & Rol Modelleri' :
                selectedSettingsSubTab === 'sound' ? 'Sistem Ayarları • Ses & Sipariş Bildirimleri' :
                selectedSettingsSubTab === 'receipt' ? 'Sistem Ayarları • Fiş & Adisyon Baskısı' :
                selectedSettingsSubTab === 'system' ? 'Sistem Ayarları • Yedekleme & Sistem' :
                selectedSettingsSubTab === 'api' ? 'Sistem Ayarları • PostgreSQL 16 ORM & Güvenlik' :
                'Sistem Ayarları • Yazı Boyutu & Panel Arayüzü'
              )}
            </h2>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Ciro & Operasyon Ticker (Desktop) */}
            <div className="hidden lg:flex items-center gap-6 text-stone-600 text-xs pr-4 border-r border-stone-200">
              <div>
                <span className="text-stone-400 block text-[10px]">Kesinleşmiş Ciro</span>
                <BlurredAmount
                  canView={canViewRevenue}
                  amount={`₺${confirmedRevenue.toFixed(2)}`}
                  className="font-bold text-green-700"
                />
              </div>
              <div>
                <span className="text-stone-400 block text-[10px]">Beklenen Ciro</span>
                <BlurredAmount
                  canView={canViewRevenue}
                  amount={`₺${pendingRevenue.toFixed(2)}`}
                  className="font-bold text-stone-800"
                />
              </div>
              <div>
                <span className="text-stone-400 block text-[10px]">Mutfak / Kurye</span>
                <span className="font-bold text-amber-600">{kitchenCount} / {courierCount}</span>
              </div>
            </div>

            {/* Live Status Indicator */}
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200/80">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="hidden sm:inline">Canlı</span>
            </span>

            {/* Sound alert switch */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Sesli Uyarı Açık' : 'Sesli Uyarı Kapalı'}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                soundEnabled
                  ? 'bg-amber-50 border-amber-200 text-amber-700'
                  : 'bg-stone-100 border-stone-200 text-stone-400'
              }`}
            >
              <i className={soundEnabled ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark'}></i>
            </button>

            {/* Refresh button */}
            <button
              onClick={fetchOrders}
              className="w-8 h-8 sm:w-9 sm:h-9 text-stone-600 hover:text-stone-900 rounded-xl hover:bg-stone-100 border border-stone-200/80 bg-white transition-colors cursor-pointer flex items-center justify-center shrink-0"
              title="Listeyi Yenile"
            >
              <i className={`fa-solid fa-rotate-right text-xs ${loadingOrders ? 'fa-spin text-amber-500' : ''}`}></i>
            </button>

            {/* Sağ Taraf: Sayfa Düzenleri & Vitrin Stüdyosu Açma Butonu */}
            {canEditSiteContent && (
              <button
                type="button"
                onClick={() => setSiteEditorDrawerOpen(true)}
                className="inline-flex items-center gap-2 px-3 sm:px-3.5 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-amber-500 hover:from-brand-700 hover:to-amber-600 text-white font-extrabold text-xs shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-95 shrink-0"
                title="Sayfa Düzenleri & Vitrin Stüdyosunu Sağ Panelde Aç"
              >
                <i className="fa-solid fa-paintbrush text-xs"></i>
                <span className="hidden sm:inline">Sayfa Düzenleri</span>
                <span className="sm:hidden">Vitrin</span>
              </button>
            )}
          </div>
        </header>

        {/* MOBİL & TABLET ÖZET BAR (Sadece lg altı ekranlarda görünür) */}
        <div className="lg:hidden bg-white border-b border-stone-200 px-3 py-2 grid grid-cols-3 gap-2 text-center">
          <div className="bg-stone-50 rounded-lg py-1 px-2 border border-stone-100 min-w-0">
            <span className="text-stone-400 block text-[9px] uppercase font-semibold truncate">Kesinleşmiş</span>
            <div className="truncate">
              <BlurredAmount
                canView={canViewRevenue}
                amount={`₺${confirmedRevenue.toFixed(2)}`}
                className="font-bold text-green-700 text-[11px] sm:text-xs"
              />
            </div>
          </div>
          <div className="bg-stone-50 rounded-lg py-1 px-2 border border-stone-100 min-w-0">
            <span className="text-stone-400 block text-[9px] uppercase font-semibold truncate">Beklenen</span>
            <div className="truncate">
              <BlurredAmount
                canView={canViewRevenue}
                amount={`₺${pendingRevenue.toFixed(2)}`}
                className="font-bold text-stone-800 text-[11px] sm:text-xs"
              />
            </div>
          </div>
          <div className="bg-stone-50 rounded-lg py-1 px-2 border border-stone-100 min-w-0">
            <span className="text-stone-400 block text-[9px] uppercase font-semibold truncate">Mutfak / Kurye</span>
            <span className="font-bold text-amber-600 text-[11px] sm:text-xs block truncate">{kitchenCount} / {courierCount}</span>
          </div>
        </div>

        {/* TAB 0: GENEL BAKIŞ & İŞLETME PERFORMANSI */}
        {currentTab === 'overview' && (
          <OverviewDashboard
            orders={orders}
            products={products}
            canViewRevenue={canViewRevenue}
            onOpenOrderDetail={handleOpenDetail}
            onAcceptOrder={(id) => handleProgressStatus(id, 'Onaylandı')}
            onNavigateToOrders={(targetStage) => {
              setCurrentTab('orders');
              if (targetStage) {
                if (targetStage === 'new') setOrderStageFilter('new');
                else if (targetStage === 'kitchen') setOrderStageFilter('kitchen');
                else if (targetStage === 'courier') setOrderStageFilter('courier');
                else if (targetStage === 'delivered') setOrderStageFilter('completed');
                else if (targetStage === 'cancelled') setOrderStageFilter('cancelled');
                else setOrderStageFilter('all');
              }
            }}
            onRefresh={fetchOrders}
            onExportCsv={() => exportOrdersToCsv(orders)}
            onPrintZReport={() => printZReport(orders)}
            loading={loadingOrders}
          />
        )}

        {/* TAB 1: SİPARİŞ YÖNETİMİ & OPERASYON */}
        {currentTab === 'orders' && (
          <div className="p-3 sm:p-6 lg:p-8 space-y-3.5 sm:space-y-5 w-full min-w-0">
            {/* Operational Stage Tabs (Mobile Dropdown / Desktop Pills) */}
            <div className="bg-white p-2.5 sm:p-2.5 rounded-2xl border border-stone-200 shadow-xs w-full">
              {/* MOBİL: Ekrana tam oturan Açılır Menü */}
              <div className="sm:hidden">
                <label className="text-[10px] font-extrabold text-stone-500 uppercase tracking-wider block mb-1">
                  Sipariş Durum Filtresi
                </label>
                <select
                  value={orderStageFilter}
                  onChange={(e) => setOrderStageFilter(e.target.value)}
                  className="app-select w-full bg-stone-50 hover:bg-white border border-stone-300 hover:border-brand-500 text-stone-900 text-xs font-bold rounded-2xl px-4 py-3 cursor-pointer shadow-xs focus:ring-3 focus:ring-brand-500/15"
                >
                  <option value="all">📦 Tüm Siparişler ({orders.length})</option>
                  <option value="new">🔔 Yeni &amp; Görüntülenen ({newOrdersCount})</option>
                  <option value="kitchen">🍳 Mutfakta (Hazırlık) ({kitchenCount})</option>
                  <option value="courier">🛵 Kuryede (Yolda) ({courierCount})</option>
                  <option value="completed">✅ Teslim Edilen ({completedCount})</option>
                  <option value="cancelled">❌ İptal Edilen ({cancelledCount})</option>
                </select>
              </div>

              {/* MASAÜSTÜ: Yatay Buton Sekmeleri */}
              <div className="hidden sm:flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 sm:pb-0">
                {[
                  { id: 'all', label: 'Tüm Siparişler', count: orders.length },
                  { id: 'new', label: '🔔 Yeni & Görüntülenen', count: newOrdersCount, alert: newOrdersCount > 0 },
                  { id: 'kitchen', label: '🍳 Mutfakta (Hazırlık)', count: kitchenCount },
                  { id: 'courier', label: '🛵 Kuryede (Yolda)', count: courierCount },
                  { id: 'completed', label: '✅ Teslim Edilen', count: completedCount },
                  { id: 'cancelled', label: '❌ İptal Edilen', count: cancelledCount },
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setOrderStageFilter(st.id)}
                    className={`px-3 py-2 rounded-xl font-medium text-xs transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
                      orderStageFilter === st.id
                        ? 'bg-stone-900 text-white font-semibold shadow-xs'
                        : 'text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    <span>{st.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        st.alert
                          ? 'bg-red-500 text-white animate-pulse'
                          : orderStageFilter === st.id
                          ? 'bg-stone-800 text-stone-200'
                          : 'bg-stone-100 text-stone-500'
                      }`}
                    >
                      {st.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Secondary Multi-Criteria Filter Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white p-3 sm:p-3.5 rounded-2xl border border-stone-200 shadow-xs">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
                {/* Search */}
                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    placeholder="Sipariş no, müşteri adı, telefon..."
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-8 pr-3 py-2 text-xs focus:outline-none focus:border-stone-400 font-medium"
                  />
                  <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs"></i>
                </div>

                {/* Filter dropdowns in 2 columns on mobile */}
                <div className="grid grid-cols-2 sm:flex items-center gap-2">
                  {/* Ödeme Yöntemi Filtresi */}
                  <select
                    value={paymentMethodFilter}
                    onChange={(e) => setPaymentMethodFilter(e.target.value)}
                    className="app-select bg-stone-50 hover:bg-white border border-stone-200 hover:border-stone-300 rounded-xl px-3 py-2 text-xs text-stone-800 font-bold focus:ring-2 focus:ring-brand-500/15 cursor-pointer shadow-2xs truncate"
                  >
                    <option value="all">💳 Tüm Yöntemler</option>
                    <option value="Kapıda Nakit">💵 Kapıda Nakit</option>
                    <option value="Kredi Kartı">💳 Kapıda Kart / POS</option>
                  </select>

                  {/* Ödeme Durumu Filtresi */}
                  <select
                    value={paymentStatusFilter}
                    onChange={(e) => setPaymentStatusFilter(e.target.value)}
                    className="app-select bg-stone-50 hover:bg-white border border-stone-200 hover:border-stone-300 rounded-xl px-3 py-2 text-xs text-stone-800 font-bold focus:ring-2 focus:ring-brand-500/15 cursor-pointer shadow-2xs truncate"
                  >
                    <option value="all">⚡ Tüm Durumlar</option>
                    <option value="Bekleniyor">⏳ Bekleniyor</option>
                    <option value="Ödendi">✅ Ödendi</option>
                    <option value="İade Edildi">↩️ İade</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                <span className="text-[11px] text-stone-400 whitespace-nowrap">
                  <strong>{filteredOrders.length}</strong> sipariş
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => exportOrdersToCsv(filteredOrders)}
                    className="bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    title="Seçili Siparişleri Excel / CSV Olarak İndir"
                  >
                    <i className="fa-solid fa-file-excel text-emerald-600"></i>
                    <span>Excel / CSV</span>
                  </button>

                  {canViewRevenue && (
                    <button
                      type="button"
                      onClick={() => printZReport(orders)}
                      className="bg-brand-50 hover:bg-brand-100 text-brand-800 border border-brand-200 px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                      title="Günlük Kasa Kapanış ve Z Raporu Yazdır"
                    >
                      <i className="fa-solid fa-receipt text-brand-600"></i>
                      <span>Z Raporu</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Orders List */}
            <div className="space-y-4">
              {filteredOrders.length === 0 ? (
                <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center text-stone-400 space-y-2">
                  <i className="fa-solid fa-inbox text-4xl text-stone-300"></i>
                  <p className="font-semibold text-stone-600">Seçili filtrelere uygun sipariş bulunamadı.</p>
                </div>
              ) : (
                paginatedOrders.map((order, idx) => {
                  const statusConf = STATUS_CONFIG[order.status] || STATUS_CONFIG['Yeni'];
                  const nextAction = getNextStep(order.status);
                  const isTerminal = order.status === 'Teslim Edildi' || order.status === 'İptal Edildi';
                  const isNewUnviewed = order.status === 'Yeni' && !order.isViewed;

                  // Üyeye özel benzersiz renk ve dikey isim şeridi paleti
                  const memberPalette = getMemberPalette(order.customerName || order.userEmail || order.userId || order.id);
                  const initials = (order.customerName || 'MŞ')
                    .split(' ')
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((n) => n[0]?.toUpperCase())
                    .join('');

                  // Sipariş kalemlerini ayrıştır (Görsel ürün kutucukları için)
                  const parsedItems = Array.isArray(order.items)
                    ? order.items.map((item) => {
                        if (typeof item === 'string') {
                          const match = item.match(/^(\d+)x\s+(.+)$/i);
                          return match
                            ? { qty: Number(match[1]), name: match[2], details: '' }
                            : { qty: 1, name: item, details: '' };
                        }
                        return {
                          qty: Number(item.quantity || 1),
                          name: item.name || 'Ürün',
                          details: item.details || '',
                        };
                      })
                    : String(order.items || '')
                        .split('|')
                        .map((s) => s.trim())
                        .filter(Boolean)
                        .map((s) => {
                          const match = s.match(/^(\d+)x\s+(.+)$/i);
                          return match
                            ? { qty: Number(match[1]), name: match[2], details: '' }
                            : { qty: 1, name: s, details: '' };
                        });

                  const totalItemCount = parsedItems.reduce((acc, it) => acc + (it.qty || 1), 0);
                  const isPosPayment = (order.paymentMethod || '').toLowerCase().includes('pos') ||
                    (order.paymentMethod || '').toLowerCase().includes('kart');

                  return (
                    <div
                      key={order.id}
                      className={`rounded-2xl border shadow-sm hover:shadow-md transition-all flex flex-row overflow-hidden bg-white ${
                        isNewUnviewed
                          ? 'border-red-500 ring-2 ring-red-400/25 bg-red-50/20'
                          : statusConf.border || 'border-stone-200'
                      }`}
                    >
                      {/* Sol Dikey Üye Şeridi (İşaretlenen Nokta: Harfler Alt Alta Dikey İsim + Üyeye Özel Renk) */}
                      <div
                        className={`w-7 sm:w-8 md:w-9 shrink-0 flex flex-col items-center justify-between py-2.5 px-0.5 select-none transition-colors border-r border-black/10 ${memberPalette.bg} ${memberPalette.text}`}
                        title={`Kayıtlı Üye: ${order.customerName || 'Müşteri'}`}
                      >
                        {/* Üye İkonu */}
                        <div
                          className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[9px] text-white shrink-0 shadow-2xs"
                          title="Kayıtlı Üye"
                        >
                          <i className="fa-solid fa-user"></i>
                        </div>

                        {/* Dikey Yazılan Üye İsmi (Harfler Alt Alta Dizili) */}
                        <div className="flex-1 flex flex-col items-center justify-center my-1.5 overflow-hidden w-full max-h-56">
                          {getVerticalNameWords(order.customerName).map((word, wIdx) => (
                            <div
                              key={wIdx}
                              className={`flex flex-col items-center ${
                                wIdx > 0 ? 'mt-1.5 pt-1 border-t border-white/20 w-3/4' : ''
                              }`}
                            >
                              {word.split('').map((char, cIdx) => (
                                <span
                                  key={cIdx}
                                  className="text-[10px] sm:text-[11px] font-black uppercase text-white leading-[1.12] drop-shadow-xs select-none block text-center"
                                >
                                  {char}
                                </span>
                              ))}
                            </div>
                          ))}
                        </div>

                        {/* Alt Üye Rozeti */}
                        <span className="text-[8px] font-black text-white/90 bg-black/25 px-1 py-0.5 rounded uppercase tracking-tighter shrink-0">
                          ÜYE
                        </span>
                      </div>

                      {/* Kart İçeriği: Sol ve Sağ Alanlar */}
                      <div className="p-3.5 sm:p-5 flex-1 min-w-0 flex flex-col lg:flex-row justify-between gap-4 sm:gap-5">
                        {/* Left: Info, Status & Timers */}
                        <div className="space-y-3.5 flex-1 min-w-0">
                        {/* Üst Başlık: Sıra No, Sipariş Kodu, Durum, Ödeme Rozeti ve Zaman */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-stone-200/60">
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Sipariş Kodu Rozeti */}
                            <span className="bg-stone-900 text-white font-mono font-black text-xs sm:text-sm px-2.5 py-1 rounded-lg tracking-wide shadow-2xs">
                              #{order.orderNumber || order.id}
                            </span>

                            {/* Durum Rozeti */}
                            <div
                              className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-extrabold ${statusConf.bg} ${statusConf.text} ${statusConf.border}`}
                            >
                              <i className={`${statusConf.icon || 'fa-solid fa-circle'} text-[11px]`}></i>
                              <span>{statusConf.label}</span>
                            </div>

                            {/* Ödeme Türü Rozeti (Nakit vs POS Karışıklığını Önler) */}
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold ${
                                isPosPayment
                                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}
                            >
                              <i className={`fa-solid ${isPosPayment ? 'fa-credit-card' : 'fa-money-bill-wave'} text-[10px]`}></i>
                              <span>{order.paymentMethod || 'Kapıda Nakit'}</span>
                              <span
                                className={`ml-0.5 px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase ${
                                  order.paymentStatus === 'Ödendi'
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-stone-200 text-stone-700'
                                }`}
                              >
                                {order.paymentStatus || 'Bekleniyor'}
                              </span>
                            </span>

                            {isNewUnviewed && (
                              <span className="text-[10px] bg-red-600 text-white font-extrabold px-2.5 py-0.5 rounded-full animate-bounce">
                                YENİ SİPARİŞ
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Viewed Badge Indicator */}
                            {order.isViewed && order.status !== 'Teslim Edildi' && (
                              <span className="text-[10px] text-stone-500 bg-stone-100 px-2 py-0.5 rounded-md font-medium">
                                <i className="fa-solid fa-eye mr-1"></i>
                                {order.viewedBy ? `${order.viewedBy} gördü` : 'Görüntülendi'}
                              </span>
                            )}

                            {/* Time Elapsed Counter */}
                            <span className="text-[11px] text-stone-500 bg-stone-100/80 border border-stone-200/60 px-2.5 py-0.5 rounded-lg font-semibold">
                              <i className="fa-regular fa-clock mr-1 text-stone-400"></i>
                              {formatElapsedTime(order.createdAt)}
                            </span>
                          </div>
                        </div>

                        {/* Müşteri, Telefon, Adres ve Kurye Bloğu */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs bg-white p-3.5 rounded-xl border border-stone-200/80 shadow-2xs">
                          {/* Sol: Renkli Müşteri Avatarı + İsim + Telefon */}
                          <div className="md:col-span-5 flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ring-4 ${memberPalette.avatar}`}
                            >
                              {initials}
                            </div>
                            <div className="space-y-1 min-w-0">
                              <span className="font-extrabold text-stone-900 text-sm block truncate">
                                {order.customerName}
                              </span>
                              <a
                                href={`tel:${order.phone}`}
                                className="inline-flex items-center gap-1.5 text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200/80 px-2 py-0.5 rounded-md font-bold text-[11px] transition-colors"
                                title="Müşteriyi Ara"
                              >
                                <i className="fa-solid fa-phone text-[10px]"></i>
                                <span>{order.phone}</span>
                              </a>
                            </div>
                          </div>

                          {/* Orta: Teslimat Adresi & Harita Butonu */}
                          <div className="md:col-span-4 flex items-center justify-between gap-2 md:border-l md:border-r border-stone-100 md:px-3">
                            <div className="space-y-0.5 min-w-0">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                                Teslimat Adresi
                              </span>
                              <span className="text-stone-800 font-semibold block text-xs leading-snug">
                                {order.address}
                              </span>
                            </div>
                            {order.address && (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200/60 w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-xs transition-colors"
                                title="Google Maps Navigasyon"
                              >
                                <i className="fa-solid fa-location-dot"></i>
                              </a>
                            )}
                          </div>

                          {/* Sağ: Kurye Seçimi */}
                          <div className="md:col-span-3 flex flex-col justify-center gap-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                              <i className="fa-solid fa-motorcycle text-brand-600 mr-1"></i>Atanan Kurye
                            </span>
                            <select
                              value={order.courierName || ''}
                              onChange={(e) => handleAssignCourier(order.id, e.target.value)}
                              className={`app-select border rounded-xl px-3 py-2 text-xs font-extrabold focus:outline-none focus:ring-2 focus:ring-brand-500/20 cursor-pointer w-full transition-all shadow-2xs ${
                                order.courierName
                                  ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                                  : 'bg-stone-50 hover:bg-stone-100/80 border-stone-200 text-stone-700'
                              }`}
                            >
                              <option value="">Kurye Seçilmedi</option>
                              {courierOptions.map((cName) => (
                                <option key={cName} value={cName}>
                                  🛵 {cName}
                                </option>
                              ))}
                              {order.courierName && !courierOptions.includes(order.courierName) && (
                                <option value={order.courierName}>🛵 {order.courierName}</option>
                              )}
                            </select>
                          </div>

                          {order.notes && (
                            <div className="md:col-span-12 pt-2 border-t border-amber-200/60 bg-amber-50/70 -mx-3.5 -mb-3.5 px-3.5 py-2 rounded-b-xl text-amber-900 text-[11px] font-bold flex items-center gap-2">
                              <i className="fa-solid fa-comment-dots text-amber-600"></i>
                              <span>Müşteri Notu: &ldquo;{order.notes}&rdquo;</span>
                            </div>
                          )}
                        </div>

                        {/* Sipariş Ürünleri (Net Ayrıştırılmış Ürün Kutucukları) */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-extrabold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                              <i className="fa-solid fa-utensils text-brand-500 text-[10px]"></i>
                              <span>Sipariş İçeriği ({totalItemCount} Adet Ürün)</span>
                            </span>
                            {(order.isScheduled || order.scheduledFor) && (
                              <span className="bg-amber-100 text-amber-900 border border-amber-300 font-bold px-2 py-0.5 rounded-md text-[10px] inline-flex items-center gap-1">
                                <i className="fa-solid fa-clock text-amber-700"></i>
                                {order.scheduledFor || '10:00 Sabah Açılış Siparişi'}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {parsedItems.map((it, itemIdx) => (
                              <div
                                key={itemIdx}
                                className="inline-flex items-center gap-2 bg-stone-50 hover:bg-stone-100 border border-stone-200/90 rounded-xl px-2.5 py-1.5 text-xs shadow-2xs"
                              >
                                <span
                                  className={`px-2 py-0.5 rounded-lg font-black text-xs ${
                                    it.qty > 1
                                      ? 'bg-rose-600 text-white'
                                      : 'bg-brand-500 text-stone-950'
                                  }`}
                                >
                                  {it.qty}x
                                </span>
                                <span className="font-bold text-stone-900">{it.name}</span>
                                {it.details && (
                                  <span className="text-[11px] text-stone-500 font-medium bg-white px-1.5 py-0.5 rounded border border-stone-200">
                                    {it.details}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Right: Total & Operational Next Step Actions (Touch-friendly & stacked on mobile) */}
                      <div className="flex flex-col sm:flex-row lg:flex-col justify-between sm:items-center lg:items-end gap-3 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-stone-100">
                        <div className="flex sm:flex-col justify-between items-center sm:items-end w-full sm:w-auto">
                          <span className="text-[11px] text-stone-400 block sm:text-right">Sipariş Tutarı</span>
                          <BlurredAmount
                            canView={canViewRevenue}
                            amount={`₺${Number(order.total || order.subtotal || 0).toFixed(2)}`}
                            className="text-xl font-black text-stone-900 block sm:text-right"
                          />
                        </div>

                        <div className="flex flex-col sm:flex-row lg:flex-col gap-2 w-full sm:w-auto items-stretch sm:items-end">
                          <div className="flex items-center gap-2">
                            {/* Detail / View Button */}
                            <button
                              onClick={() => handleOpenDetail(order)}
                              className="flex-1 sm:flex-none justify-center bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs px-3 py-2 rounded-xl font-medium cursor-pointer flex items-center gap-1.5 transition-colors"
                              title="Detay & Fiş"
                            >
                              <i className="fa-solid fa-circle-info"></i>
                              <span>Detay & Fiş</span>
                            </button>

                            {/* Cancel Button */}
                            {!isTerminal && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCancelModalOrder(order);
                                  setCancelReason('Müşteri talebi');
                                }}
                                className="text-stone-400 hover:text-amber-600 text-xs p-2 rounded-xl hover:bg-amber-50 border border-stone-200/80 transition-colors cursor-pointer"
                                title="Siparişi İptal Et"
                              >
                                <i className="fa-solid fa-ban"></i>
                              </button>
                            )}

                            {/* Delete Order Button (Admin Approved) */}
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteOrderError('');
                                setDeleteAdminPassword('');
                                setDeleteRestoreStock(order.status !== 'İptal Edildi');
                                setDeleteModalOrder(order);
                              }}
                              className="text-stone-400 hover:text-rose-600 text-xs p-2 rounded-xl hover:bg-rose-50 border border-stone-200/80 transition-colors cursor-pointer"
                              title="Siparişi Kalıcı Olarak Sil (Yönetici Onaylı)"
                            >
                              <i className="fa-solid fa-trash-can"></i>
                            </button>
                          </div>

                          {/* Next Sequential Action Button */}
                          {nextAction && (
                            <button
                              onClick={() => handleProgressStatus(order.id, nextAction.nextStatus)}
                              className={`w-full sm:w-auto justify-center text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer active:scale-95 ${nextAction.color}`}
                            >
                              <i className={nextAction.icon}></i>
                              <span>{nextAction.label}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
                })
              )}
            </div>

            {filteredOrders.length > 0 && (
              <AdminPagination
                currentPage={safeOrdersPage}
                totalItems={filteredOrders.length}
                pageSize={ordersPageSize}
                onPageChange={setOrdersPage}
                onPageSizeChange={setOrdersPageSize}
                itemLabel="sipariş"
              />
            )}
          </div>
        )}

        {/* TAB MEMBERS: ÜYE & MÜŞTERİ YÖNETİMİ (ENGELLEME & BİLDİRİM) */}
        {currentTab === 'members' && (
          <MembersTab />
        )}

        {/* TAB INVENTORY: HAMMADDE STOKLARI & REÇETE YÖNETİMİ */}
        {currentTab === 'inventory' && (
          <InventoryTab
            products={products}
            onRefreshProducts={() => {
              fetch('/api/products')
                .then((r) => r.json())
                .then((j) => {
                  if (j.success && j.data) dispatch(setProducts(j.data));
                });
            }}
          />
        )}

        {/* TAB USERS & ROLES: AYARLAR İÇİNDE YÖNETİLİR */}
        {currentTab === 'users' && (
          <SettingsTab
            currentSettings={adminSettings}
            currentAdmin={adminUser}
            initialSubTab="users"
            onSaveSettings={(newSettings) => {
              setAdminSettings(newSettings);
              showToast('Panel ayarları başarıyla güncellendi.', 'success');
            }}
          />
        )}

        {/* TAB 2: MENÜ & ÜRÜNLER (WITH IMAGE UPLOAD!) */}
        {currentTab === 'products' && (
          <div className="p-3 sm:p-6 lg:p-8 space-y-4 w-full min-w-0">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 sm:p-3.5 rounded-2xl border border-stone-200 shadow-xs w-full">
              {/* MOBİL: Kategori Seçici Açılır Menü */}
              <div className="sm:hidden w-full">
                <select
                  value={productFilter}
                  onChange={(e) => setProductFilter(e.target.value)}
                  className="app-select w-full bg-stone-50 hover:bg-white border border-stone-300 hover:border-brand-500 text-stone-900 text-xs font-bold rounded-2xl px-4 py-3 cursor-pointer shadow-xs focus:ring-3 focus:ring-brand-500/15"
                >
                  <option value="all">Tüm Ürünler ({products.length})</option>
                  <option value="menu">🍱 Menüler (Avantajlı)</option>
                  <option value="sandwich">🥪 Sandviçler (Bireysel)</option>
                  <option value="snack">🍟 Atıştırmalıklar</option>
                  <option value="drink">🥤 İçecekler</option>
                </select>
              </div>

              {/* MASAÜSTÜ: Yatay Buton Sekmeleri */}
              <div className="hidden sm:flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 sm:pb-0">
                {[
                  { id: 'all', label: 'Tüm Ürünler' },
                  { id: 'menu', label: '🍱 Menüler (Avantajlı)' },
                  { id: 'sandwich', label: '🥪 Sandviçler (Bireysel)' },
                  { id: 'snack', label: '🍟 Atıştırmalıklar' },
                  { id: 'drink', label: '🥤 İçecekler' },
                ].map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setProductFilter(c.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      productFilter === c.id
                        ? 'bg-stone-900 text-white font-semibold shadow-xs'
                        : 'bg-stone-50 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setCurrentTab('options')}
                  className="w-full sm:w-auto justify-center bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold px-3.5 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-2xs shrink-0 active:scale-95 transition-all"
                  title="Sosları ve ekstra malzemeleri yönetin"
                >
                  <i className="fa-solid fa-bottle-droplet text-amber-600"></i>
                  <span>Soslar &amp; Ekstralar</span>
                </button>
                <button
                  onClick={openAddProductModal}
                  className="w-full sm:w-auto justify-center bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-xs shrink-0 active:scale-95 transition-all"
                >
                  <i className="fa-solid fa-plus"></i>
                  <span>Yeni Ürün Ekle</span>
                </button>
              </div>
            </div>

            {/* Products List */}
            <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100 overflow-hidden shadow-xs">
              {paginatedProducts.map((p) => (
                <div
                  key={p.id}
                  className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-stone-50/60 transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <img
                      src={p.image}
                      alt={p.name}
                      className="w-12 h-12 rounded-xl object-cover bg-stone-100 border border-stone-200 shrink-0"
                      onError={(e) => {
                        e.currentTarget.src =
                          'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=200';
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-stone-900 block truncate">{p.name}</span>
                        <button
                          type="button"
                          onClick={() => handleQuickToggleAvailability(p)}
                          className={`text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95 ${
                            p.isAvailable === false
                              ? 'bg-rose-100 hover:bg-rose-200 text-rose-700 border border-rose-300'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                          }`}
                          title="Ürünü satışa aç / kapat"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${p.isAvailable === false ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
                          <span>{p.isAvailable === false ? 'Tükendi' : `Satışta (${typeof p.stock === 'number' ? p.stock + ' Adet' : 'Sınırsız'})`}</span>
                          <i className={`fa-solid ${p.isAvailable === false ? 'fa-toggle-off text-rose-500' : 'fa-toggle-on text-emerald-600'} text-xs ml-0.5`}></i>
                        </button>
                        {p.badge && (
                          <span className="text-[10px] bg-brand-50 text-brand-700 font-bold px-2 py-0.2 rounded-md">
                            {p.badge}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-stone-400 capitalize block truncate mt-0.5">
                        {p.category === 'menu' ? '🍱 Menülü Satış' : '🥪 Bireysel Satış'} &bull;{' '}
                        {p.description}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                    <span className="font-bold text-stone-900 text-sm mr-2">₺{p.price.toFixed(2)}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openEditProductModal(p)}
                        className="text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                        title="Ürünü ve Görselini Düzenle"
                      >
                        <i className="fa-solid fa-pen-to-square text-[11px]"></i>
                        <span>Düzenle</span>
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(p.id)}
                        className="text-stone-400 hover:text-red-600 p-2 cursor-pointer transition-colors rounded-lg hover:bg-red-50"
                        title="Sil"
                      >
                        <i className="fa-solid fa-trash-can text-xs"></i>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredProducts.length > 0 && (
              <AdminPagination
                currentPage={safeProductsPage}
                totalItems={filteredProducts.length}
                pageSize={productsPageSize}
                onPageChange={setProductsPage}
                onPageSizeChange={setProductsPageSize}
                itemLabel="ürün"
              />
            )}
          </div>
        )}

        {/* TAB: SOSLAR & EKSTRA MALZEMELER YÖNETİMİ */}
        {currentTab === 'options' && (
          <OptionsManagementTab />
        )}

        {/* TAB 3: GERİ BİLDİRİMLER & MÜŞTERİ DEĞERLENDİRMELERİ ONAY MERKEZİ */}
        {currentTab === 'reviews' && (
          <div className="p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 w-full min-w-0 font-poppins animate-in fade-in duration-150">
            {/* 1. BAŞLIK VE ÖZET METRİKLER */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-stone-900 flex items-center gap-2">
                  <i className="fa-regular fa-star text-amber-500"></i>
                  <span>Müşteri Geri Bildirimleri &amp; Onay Yönetimi</span>
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Müşterilerin web sitesinden gönderdiği değerlendirmeleri onaylayın, yayından kaldırın veya silin.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    fetchReviews();
                    fetchFeedbacks();
                  }}
                  disabled={loadingReviews || loadingFeedbacks}
                  className="bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Yenile"
                >
                  <i className={`fa-solid fa-arrows-rotate text-xs ${loadingReviews || loadingFeedbacks ? 'fa-spin text-brand-600' : ''}`}></i>
                  <span>Yenile</span>
                </button>
              </div>
            </div>

            {/* ALT SEKMELER: Müşteri Değerlendirmeleri & İletişim / Şikayet / Öneri Mesajları */}
            <div className="flex border-b border-stone-200 gap-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => setReviewsSubTab('reviews')}
                className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                  reviewsSubTab === 'reviews'
                    ? 'border-brand-500 text-brand-600'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                <i className="fa-regular fa-star"></i>
                <span>Restoran Yorumları &amp; Puanlar ({adminReviews.length})</span>
                {adminReviews.filter((r) => r.isApproved !== true).length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-white animate-pulse">
                    {adminReviews.filter((r) => r.isApproved !== true).length} Yeni Onay
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setReviewsSubTab('feedbacks')}
                className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                  reviewsSubTab === 'feedbacks'
                    ? 'border-brand-500 text-brand-600'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                <i className="fa-regular fa-envelope"></i>
                <span>İletişim &amp; Öneri Mesajları ({adminFeedbacks.length})</span>
                {adminFeedbacks.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800">
                    {adminFeedbacks.length}
                  </span>
                )}
              </button>
            </div>

            {reviewsSubTab === 'reviews' && (
              <div className="space-y-4 sm:space-y-6">

            {/* 2. DURUM KARTLARI */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Toplam Yorum */}
              <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-stone-200 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Toplam Yorum</span>
                  <span className="w-7 h-7 rounded-lg bg-stone-100 text-stone-600 flex items-center justify-center text-xs">
                    <i className="fa-regular fa-comments"></i>
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-stone-900 mt-1">
                  {adminReviews.length}
                </div>
              </div>

              {/* Onay Bekleyen */}
              <div className={`p-3.5 sm:p-4 rounded-2xl border shadow-xs ${
                adminReviews.filter((r) => r.isApproved !== true).length > 0
                  ? 'bg-amber-50/60 border-amber-300'
                  : 'bg-white border-stone-200'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
                    <span>Onay Bekleyen</span>
                    {adminReviews.filter((r) => r.isApproved !== true).length > 0 && (
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                    )}
                  </span>
                  <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold">
                    <i className="fa-solid fa-clock"></i>
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-amber-900 mt-1">
                  {adminReviews.filter((r) => r.isApproved !== true).length}
                </div>
              </div>

              {/* Sitede Yayında */}
              <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-stone-200 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Sitede Yayında</span>
                  <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs">
                    <i className="fa-solid fa-circle-check"></i>
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-emerald-900 mt-1">
                  {adminReviews.filter((r) => r.isApproved === true).length}
                </div>
              </div>

              {/* Ortalama Puan */}
              <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-stone-200 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Ortalama Puan</span>
                  <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center text-xs">
                    <i className="fa-solid fa-star"></i>
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-stone-900 mt-1 flex items-baseline gap-1">
                  <span>
                    {adminReviews.length > 0
                      ? (
                          adminReviews.reduce((sum, r) => sum + (Number(r.rating) || 5), 0) /
                          adminReviews.length
                        ).toFixed(1)
                      : '5.0'}
                  </span>
                  <span className="text-xs text-stone-400 font-semibold">/ 5.0</span>
                </div>
              </div>
            </div>

            {/* 3. FİLTRE VE ARAMA ÇUBUĞU */}
            <div className="bg-white p-3 sm:p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Filtre Butonları */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setReviewFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    reviewFilter === 'all'
                      ? 'bg-stone-900 text-white shadow-2xs'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  Tümü ({adminReviews.length})
                </button>
                <button
                  type="button"
                  onClick={() => setReviewFilter('pending')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    reviewFilter === 'pending'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                  }`}
                >
                  <span>Onay Bekleyenler</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-900/20">
                    {adminReviews.filter((r) => r.isApproved !== true).length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setReviewFilter('approved')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    reviewFilter === 'approved'
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  }`}
                >
                  <span>Yayında Olanlar</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-900/20">
                    {adminReviews.filter((r) => r.isApproved === true).length}
                  </span>
                </button>
              </div>

              {/* Arama Kutusu */}
              <div className="relative w-full sm:w-64">
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs"></i>
                <input
                  type="text"
                  value={reviewSearch}
                  onChange={(e) => setReviewSearch(e.target.value)}
                  placeholder="İsim, şehir veya yorum ara..."
                  className="w-full pl-8 pr-3 py-1.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-medium focus:outline-none focus:border-stone-900 transition-colors"
                />
                {reviewSearch && (
                  <button
                    type="button"
                    onClick={() => setReviewSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 text-xs"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                )}
              </div>
            </div>

            {/* 4. YORUM LİSTESİ */}
            {(() => {
              const filtered = adminReviews.filter((r) => {
                if (reviewFilter === 'pending' && r.isApproved === true) return false;
                if (reviewFilter === 'approved' && r.isApproved !== true) return false;
                if (reviewSearch.trim()) {
                  const q = reviewSearch.toLowerCase();
                  const matchName = (r.name || '').toLowerCase().includes(q);
                  const matchCity = (r.location || '').toLowerCase().includes(q);
                  const matchComment = (r.comment || '').toLowerCase().includes(q);
                  if (!matchName && !matchCity && !matchComment) return false;
                }
                return true;
              });

              if (filtered.length === 0) {
                return (
                  <div className="bg-white p-12 text-center rounded-2xl border border-stone-200 text-stone-500 shadow-xs">
                    <i className="fa-regular fa-comment-dots text-3xl text-stone-300 mb-2 block"></i>
                    <p className="text-sm font-semibold text-stone-700">Değerlendirme bulunamadı</p>
                    <p className="text-xs text-stone-400 mt-1">
                      {reviewSearch ? 'Arama kriterlerinize uyan yorum yok.' : 'Bu filtrede henüz bir yorum yer almıyor.'}
                    </p>
                  </div>
                );
              }

              const safeReviewsPage = Math.min(
                reviewsPage,
                Math.max(1, Math.ceil(filtered.length / reviewsPageSize))
              );
              const paginatedReviews = filtered.slice(
                (safeReviewsPage - 1) * reviewsPageSize,
                safeReviewsPage * reviewsPageSize
              );

              return (
                <div className="space-y-3">
                  {paginatedReviews.map((r) => {
                    const isApproved = r.isApproved === true;
                    const initials = (r.name || 'Müşteri')
                      .split(' ')
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((n) => n[0].toUpperCase())
                      .join('');

                    return (
                      <div
                        key={r.id}
                        className={`bg-white p-4 sm:p-5 rounded-2xl border shadow-xs transition-all ${
                          isApproved
                            ? 'border-stone-200 hover:border-stone-300'
                            : 'border-amber-300 bg-amber-50/20 hover:border-amber-400'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          {/* Sol Alan: Müşteri Bilgisi & Puan & Yorum */}
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            {/* Avatar */}
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-stone-800 to-stone-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                              {initials}
                            </div>

                            <div className="space-y-1.5 flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-stone-900 text-sm">{r.name}</span>
                                {r.location && (
                                  <span className="text-xs text-stone-500 flex items-center gap-1">
                                    <i className="fa-solid fa-location-dot text-[10px] text-stone-400"></i>
                                    <span>{r.location}</span>
                                  </span>
                                )}
                                {r.date && (
                                  <span className="text-[11px] text-stone-400">&bull; {r.date}</span>
                                )}

                                {/* Yayında / Onay Bekliyor Rozeti */}
                                {isApproved ? (
                                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    <span>Sitede Yayında</span>
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 animate-pulse">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                    <span>Onay Bekliyor</span>
                                  </span>
                                )}
                              </div>

                              {/* Yıldızlar */}
                              <div className="flex items-center gap-1 text-amber-400 text-xs">
                                {[...Array(5)].map((_, i) => (
                                  <i
                                    key={i}
                                    className={`fa-solid fa-star ${
                                      i < (r.rating || 5) ? 'text-amber-400' : 'text-stone-200'
                                    }`}
                                  ></i>
                                ))}
                                <span className="text-stone-400 text-[11px] ml-1 font-semibold">
                                  ({r.rating || 5}/5)
                                </span>
                              </div>

                              {/* Yorum Metni */}
                              <p className="text-stone-700 text-xs sm:text-sm leading-relaxed italic bg-stone-50 p-2.5 rounded-xl border border-stone-100">
                                "{r.comment}"
                              </p>
                            </div>
                          </div>

                          {/* Sağ Alan: Aksiyon Butonları */}
                          <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100 justify-end">
                            {/* Onayla / Yayından Kaldır Butonu */}
                            <button
                              type="button"
                              onClick={() => handleToggleReviewApproval(r.id, isApproved)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-95 ${
                                isApproved
                                  ? 'bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300'
                                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                              }`}
                              title={isApproved ? 'Yayından kaldır (sitede gizle)' : 'Onayla ve sitede yayınla'}
                            >
                              <i
                                className={`fa-solid ${
                                  isApproved ? 'fa-eye-slash text-stone-500' : 'fa-check text-white'
                                }`}
                              ></i>
                              <span>{isApproved ? 'Yayından Kaldır' : 'Onayla & Yayına Al'}</span>
                            </button>

                            {/* Kalıcı Sil Butonu */}
                            <button
                              type="button"
                              onClick={() => handleDeleteReview(r.id)}
                              className="text-stone-400 hover:text-rose-600 hover:bg-rose-50 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                              title="Değerlendirmeyi kalıcı olarak sil"
                            >
                              <i className="fa-regular fa-trash-can text-xs"></i>
                              <span>Sil</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <AdminPagination
                    currentPage={safeReviewsPage}
                    totalItems={filtered.length}
                    pageSize={reviewsPageSize}
                    onPageChange={setReviewsPage}
                    onPageSizeChange={setReviewsPageSize}
                    itemLabel="değerlendirme"
                  />
                </div>
              );
            })()}
            </div>
            )}

            {/* ALT SEKME 2: İLETİŞİM / ŞİKAYET / ÖNERİ GERİ BİLDİRİM MESAJLARI */}
            {reviewsSubTab === 'feedbacks' && (
              <div className="space-y-4 sm:space-y-6">
                {/* 1. ÖZET METRİK KARTLARI */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-stone-200 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Toplam Mesaj</span>
                      <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-xs">
                        <i className="fa-regular fa-envelope"></i>
                      </span>
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-stone-900 mt-1">
                      {adminFeedbacks.length}
                    </div>
                  </div>

                  <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-stone-200 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Öneri &amp; İstek</span>
                      <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs">
                        <i className="fa-solid fa-lightbulb"></i>
                      </span>
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-emerald-900 mt-1">
                      {adminFeedbacks.filter((f) => String(f.type || '').includes('Öneri') || String(f.type || '').includes('İstek')).length}
                    </div>
                  </div>

                  <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-stone-200 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Şikayet / Sorun</span>
                      <span className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center text-xs">
                        <i className="fa-solid fa-triangle-exclamation"></i>
                      </span>
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-rose-900 mt-1">
                      {adminFeedbacks.filter((f) => String(f.type || '').includes('Şikayet')).length}
                    </div>
                  </div>

                  <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-stone-200 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Son 24 Saat</span>
                      <span className="w-7 h-7 rounded-lg bg-stone-100 text-stone-600 flex items-center justify-center text-xs">
                        <i className="fa-solid fa-clock"></i>
                      </span>
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-stone-900 mt-1">
                      {
                        adminFeedbacks.filter((f) => {
                          if (!f.createdAt) return false;
                          const age = Date.now() - new Date(f.createdAt).getTime();
                          return !Number.isNaN(age) && age < 24 * 60 * 60 * 1000;
                        }).length
                      }
                    </div>
                  </div>
                </div>

                {/* 2. FİLTRE VE ARAMA ÇUBUĞU */}
                <div className="bg-white p-3 sm:p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                    <button
                      type="button"
                      onClick={() => setFeedbackTypeFilter('all')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        feedbackTypeFilter === 'all'
                          ? 'bg-stone-900 text-white shadow-2xs'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      Tümü ({adminFeedbacks.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFeedbackTypeFilter('Öneri / İstek')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        feedbackTypeFilter === 'Öneri / İstek'
                          ? 'bg-emerald-700 text-white shadow-2xs'
                          : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                      }`}
                    >
                      Öneri / İstek
                    </button>
                    <button
                      type="button"
                      onClick={() => setFeedbackTypeFilter('Şikayet')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        feedbackTypeFilter === 'Şikayet'
                          ? 'bg-rose-700 text-white shadow-2xs'
                          : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
                      }`}
                    >
                      Şikayetler
                    </button>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs"></i>
                    <input
                      type="text"
                      value={feedbackSearch}
                      onChange={(e) => setFeedbackSearch(e.target.value)}
                      placeholder="İsim, e-posta veya mesaj ara..."
                      className="w-full pl-8 pr-3 py-1.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-medium focus:outline-none focus:border-stone-900 transition-colors"
                    />
                    {feedbackSearch && (
                      <button
                        type="button"
                        onClick={() => setFeedbackSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 text-xs"
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    )}
                  </div>
                </div>

                {/* 3. GERİ BİLDİRİM MESAJ LİSTESİ */}
                {(() => {
                  const filtered = adminFeedbacks.filter((f) => {
                    if (feedbackTypeFilter !== 'all' && !String(f.type || '').includes(feedbackTypeFilter)) {
                      return false;
                    }
                    if (feedbackSearch.trim()) {
                      const q = feedbackSearch.toLowerCase();
                      const matchName = String(f.name || '').toLowerCase().includes(q);
                      const matchEmail = String(f.email || '').toLowerCase().includes(q);
                      const matchMsg = String(f.message || '').toLowerCase().includes(q);
                      if (!matchName && !matchEmail && !matchMsg) return false;
                    }
                    return true;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="bg-white p-10 rounded-2xl border border-stone-200 text-center space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-400 flex items-center justify-center mx-auto text-xl">
                          <i className="fa-regular fa-folder-open"></i>
                        </div>
                        <h4 className="font-bold text-stone-800 text-sm">Geri Bildirim Bulunamadı</h4>
                        <p className="text-xs text-stone-500 max-w-sm mx-auto">
                          {feedbackSearch ? 'Arama kriterlerinize uyan mesaj yok.' : 'Henüz iletişim formundan iletilmiş bir geri bildirim mesajı bulunmuyor.'}
                        </p>
                      </div>
                    );
                  }

                  const safeFeedbacksPage = Math.min(
                    feedbacksPage,
                    Math.max(1, Math.ceil(filtered.length / feedbacksPageSize))
                  );
                  const paginatedFeedbacks = filtered.slice(
                    (safeFeedbacksPage - 1) * feedbacksPageSize,
                    safeFeedbacksPage * feedbacksPageSize
                  );

                  return (
                    <div className="space-y-3">
                      {paginatedFeedbacks.map((fb) => {
                        const initials = (fb.name || 'G')
                          .toString()
                          .trim()
                          .split(/\s+/)
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((n) => n[0]?.toUpperCase())
                          .join('') || 'G';
                        const isComplaint = String(fb.type || '').toLowerCase().includes('şikayet');
                        const isSuggestion = String(fb.type || '').toLowerCase().includes('öneri');

                        return (
                          <div
                            key={fb.id}
                            className={`bg-white p-4 sm:p-5 rounded-2xl border shadow-xs transition-all ${
                              isComplaint
                                ? 'border-rose-300 bg-rose-50/15'
                                : 'border-stone-200 hover:border-stone-300'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                              <div className="flex items-start gap-3.5 flex-1 min-w-0">
                                <div className={`w-10 h-10 rounded-full text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs ${
                                  isComplaint
                                    ? 'bg-rose-600'
                                    : isSuggestion
                                    ? 'bg-emerald-600'
                                    : 'bg-stone-700'
                                }`}>
                                  {initials}
                                </div>

                                <div className="space-y-1.5 flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-bold text-stone-900 text-sm">{fb.name}</span>
                                    {fb.email && (
                                      <a
                                        href={`mailto:${fb.email}`}
                                        className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium"
                                        title="E-posta gönder"
                                      >
                                        <i className="fa-regular fa-envelope text-[10px]"></i>
                                        <span>{fb.email}</span>
                                      </a>
                                    )}
                                    {fb.createdAt && (
                                      <span className="text-[11px] text-stone-400">
                                        &bull; {new Date(fb.createdAt).toLocaleString('tr-TR')}
                                      </span>
                                    )}

                                    <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                                      isComplaint
                                        ? 'bg-rose-100 text-rose-900 border-rose-300'
                                        : isSuggestion
                                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                        : 'bg-stone-100 text-stone-700 border-stone-300'
                                    }`}>
                                      {fb.type || 'Öneri / İstek'}
                                    </span>
                                  </div>

                                  <p className="text-stone-800 text-xs sm:text-sm leading-relaxed bg-stone-50 p-3 rounded-xl border border-stone-100 whitespace-pre-wrap">
                                    {fb.message}
                                  </p>
                                </div>
                              </div>

                              <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100 justify-end">
                                {fb.email && (
                                  <a
                                    href={`mailto:${fb.email}?subject=Sandviç Diyarı - Geri Bildiriminiz Hakkında`}
                                    className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 shadow-2xs"
                                    title="Müşteriye yanıt ver"
                                  >
                                    <i className="fa-solid fa-reply text-xs"></i>
                                    <span>Yanıtla</span>
                                  </a>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleDeleteFeedback(fb.id)}
                                  className="text-stone-400 hover:text-rose-600 hover:bg-rose-50 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                                  title="Geri bildirim mesajını sil"
                                >
                                  <i className="fa-regular fa-trash-can text-xs"></i>
                                  <span>Sil</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      <AdminPagination
                        currentPage={safeFeedbacksPage}
                        totalItems={filtered.length}
                        pageSize={feedbacksPageSize}
                        onPageChange={setFeedbacksPage}
                        onPageSizeChange={setFeedbacksPageSize}
                        itemLabel="mesaj"
                      />
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: POSTGRESQL ORM (SİSTEM AYARLARI İÇİNDE YÖNETİLİR) */}
        {currentTab === 'api' && (
          <SettingsTab
            currentSettings={adminSettings}
            currentAdmin={adminUser}
            initialSubTab="api"
            onSubTabChange={setSelectedSettingsSubTab}
            showToast={showToast}
            onSaveSettings={(newSettings) => {
              setAdminSettings(newSettings);
              showToast('Panel ayarları başarıyla güncellendi.', 'success');
            }}
          />
        )}

        {/* TAB 5: MÜŞTERİ SAYFASI TASARIM & İÇERİK YÖNETİMİ */}
        {currentTab === 'site_content' && (
          <div className="p-3 sm:p-6 lg:p-8 w-full min-w-0">
            <SiteContentEditorTab
              initialSubTab={selectedSiteContentSubTab}
              onSubTabChange={setSelectedSiteContentSubTab}
            />
          </div>
        )}

        {/* TAB 8: SİSTEM & PANEL AYARLARI */}
        {currentTab === 'settings' && (
          <SettingsTab
            currentSettings={adminSettings}
            currentAdmin={adminUser}
            initialSubTab={selectedSettingsSubTab}
            onSubTabChange={setSelectedSettingsSubTab}
            showToast={showToast}
            onSaveSettings={(newSettings) => {
              setAdminSettings(newSettings);
              showToast('Panel ayarları başarıyla güncellendi.', 'success');
            }}
          />
        )}
      </div>

      {/* MOBILE BOTTOM NAVIGATION DOCK (Native App Experience for Smartphone Admin) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200 px-1 py-1.5 pb-2 flex items-center justify-around shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        {/* 1. Siparişler */}
        <button
          type="button"
          onClick={() => {
            setCurrentTab('orders');
            setMobileSidebarOpen(false);
          }}
          className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all cursor-pointer relative ${
            currentTab === 'orders' ? 'text-brand-600 font-bold' : 'text-stone-500 hover:text-stone-900'
          }`}
        >
          <div className="relative">
            <i className="fa-solid fa-list-check text-base"></i>
            {newOrdersCount > 0 && (
              <span className="absolute -top-1 -right-2.5 min-w-[16px] h-4 bg-red-600 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1 animate-pulse">
                {newOrdersCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-0.5 leading-tight">Siparişler</span>
        </button>

        {/* 2. Stok */}
        <button
          type="button"
          onClick={() => {
            setCurrentTab('inventory');
            setMobileSidebarOpen(false);
          }}
          className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all cursor-pointer relative ${
            currentTab === 'inventory' ? 'text-brand-600 font-bold' : 'text-stone-500 hover:text-stone-900'
          }`}
        >
          <div className="relative">
            <i className="fa-solid fa-boxes-stacked text-base"></i>
            {products.filter((p) => p.isAvailable === false).length > 0 && (
              <span className="absolute -top-1 -right-2 w-2 h-2 bg-rose-500 rounded-full animate-pulse"></span>
            )}
          </div>
          <span className="text-[10px] mt-0.5 leading-tight">Stok</span>
        </button>

        {/* 3. Menü & Ürünler */}
        <button
          type="button"
          onClick={() => {
            setCurrentTab('products');
            setMobileSidebarOpen(false);
          }}
          className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all cursor-pointer relative ${
            currentTab === 'products' ? 'text-brand-600 font-bold' : 'text-stone-500 hover:text-stone-900'
          }`}
        >
          <i className="fa-solid fa-burger text-base"></i>
          <span className="text-[10px] mt-0.5 leading-tight">Menü</span>
        </button>

        {/* 4. Genel Bakış */}
        <button
          type="button"
          onClick={() => {
            setCurrentTab('overview');
            setMobileSidebarOpen(false);
          }}
          className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all cursor-pointer relative ${
            currentTab === 'overview' ? 'text-brand-600 font-bold' : 'text-stone-500 hover:text-stone-900'
          }`}
        >
          <i className="fa-solid fa-chart-pie text-base"></i>
          <span className="text-[10px] mt-0.5 leading-tight">Özet</span>
        </button>

        {/* 5. Menüyü Aç (Drawer) */}
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(true)}
          className="flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl text-stone-500 hover:text-stone-900 transition-all cursor-pointer relative"
        >
          <i className="fa-solid fa-bars text-base"></i>
          <span className="text-[10px] mt-0.5 leading-tight">Diğer</span>
        </button>
      </nav>

      {/* MODAL: YENİ ÜRÜN EKLEME / DÜZENLEME (RESİM YÜKLEME VE ŞABLON DESTEĞİ İLE) */}
      {isAddProductOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-4 sm:p-8 border border-stone-200 shadow-2xl space-y-5 my-auto max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-4 border-b border-stone-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center text-base font-bold">
                  <i className={editingProduct ? 'fa-solid fa-pen-to-square' : 'fa-solid fa-plus'}></i>
                </div>
                <div>
                  <h4 className="font-extrabold text-stone-900 text-base sm:text-lg">
                    {editingProduct ? 'Ürünü / Görseli Düzenle' : 'Menüye Yeni Ürün Ekle'}
                  </h4>
                  <p className="text-xs text-stone-500">
                    {editingProduct ? `"${editingProduct.name}" düzenleniyor` : 'Ürün bilgilerini girin ve görseli seçin'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsAddProductOpen(false);
                  resetProductForm();
                }}
                className="text-stone-400 hover:text-stone-700 p-2 rounded-xl hover:bg-stone-100 transition-colors cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <form onSubmit={handleProductSubmit} className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* SOL SÜTUN: ÜRÜN BİLGİLERİ */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Product Name */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wide mb-1.5">
                      Ürün veya Menü Adı <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={prodName}
                      onChange={(e) => setProdName(e.target.value)}
                      placeholder="Örn: Ateşli Mega Menü"
                      className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-sm text-stone-900 focus:outline-none focus:border-brand-500 focus:bg-white font-semibold transition-all"
                    />
                  </div>

                  {/* Category & Price */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wide mb-1.5">
                        Satış Türü <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={prodCategory}
                        onChange={(e) => setProdCategory(e.target.value)}
                        className="app-select w-full bg-stone-50 hover:bg-stone-100/60 border border-stone-200 hover:border-brand-400 rounded-2xl px-4 py-3 text-sm text-stone-900 focus:outline-none focus:border-brand-500 focus:bg-white font-semibold transition-all cursor-pointer shadow-2xs"
                      >
                        <option value="menu">🍱 Menülü (Avantajlı Paket)</option>
                        <option value="sandwich">🥪 Sandviç (Bireysel Satış)</option>
                        <option value="snack">🍟 Atıştırmalık (Bireysel)</option>
                        <option value="drink">🥤 İçecek (Bireysel)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wide mb-1.5">
                        Fiyat (₺) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={prodPrice}
                        onChange={(e) => setProdPrice(e.target.value)}
                        placeholder="199.99"
                        className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-sm text-stone-900 focus:outline-none focus:border-brand-500 focus:bg-white font-semibold transition-all"
                      />
                    </div>
                  </div>

                  {/* STOK ADEDİ, DURUMU VE ROZET */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wide mb-1.5">
                        Stok Adedi
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={prodStock}
                        onChange={(e) => setProdStock(e.target.value)}
                        placeholder="25"
                        className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-sm text-stone-900 focus:outline-none focus:border-brand-500 focus:bg-white font-bold transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wide mb-1.5">
                        Satış Durumu
                      </label>
                      <button
                        type="button"
                        onClick={() => setProdIsAvailable(!prodIsAvailable)}
                        className={`w-full py-3 px-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                          prodIsAvailable
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : 'bg-rose-50 text-rose-800 border-rose-300'
                        }`}
                      >
                        <i className={`fa-solid ${prodIsAvailable ? 'fa-circle-check text-emerald-600' : 'fa-ban text-rose-600'}`}></i>
                        <span>{prodIsAvailable ? 'Satışa Açık' : 'Kapalı'}</span>
                      </button>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wide mb-1.5">
                        Rozet / Etiket
                      </label>
                      <input
                        type="text"
                        value={prodBadge}
                        onChange={(e) => setProdBadge(e.target.value)}
                        placeholder="Örn: Gurme, Fırsat"
                        className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-3.5 py-3 text-sm text-stone-900 focus:outline-none focus:border-brand-500 focus:bg-white font-medium transition-all"
                      />
                    </div>
                  </div>

                  {/* Açıklama */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wide mb-1.5">
                      Açıklama / Malzeme Detayları
                    </label>
                    <textarea
                      rows={3}
                      value={prodDesc}
                      onChange={(e) => setProdDesc(e.target.value)}
                      placeholder="Özel sos, taze yeşillikler, büyük boy patates..."
                      className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-sm text-stone-900 focus:outline-none focus:border-brand-500 focus:bg-white font-medium transition-all resize-none"
                    />
                  </div>
                </div>

                {/* SAĞ SÜTUN: GÖRSEL SEÇİM VE YÜKLEME ALANI */}
                <div className="lg:col-span-5 space-y-3 bg-stone-50/70 p-4 rounded-2xl border border-stone-200/80">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-bold text-stone-700 uppercase tracking-wide flex items-center gap-1.5">
                      <i className="fa-solid fa-image text-brand-600"></i>
                      <span>Ürün Görseli</span>
                    </label>

                    <div className="flex items-center gap-1 bg-stone-200/70 p-0.5 rounded-lg text-[10px]">
                      <button
                        type="button"
                        onClick={() => setImageInputMode('upload')}
                        className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                          imageInputMode === 'upload'
                            ? 'bg-white text-stone-900 shadow-xs'
                            : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        <i className="fa-solid fa-arrow-up-from-bracket mr-1"></i> Yükle
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageInputMode('presets')}
                        className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                          imageInputMode === 'presets'
                            ? 'bg-white text-stone-900 shadow-xs'
                            : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        <i className="fa-solid fa-utensils mr-1"></i> Şablonlar
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageInputMode('url')}
                        className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                          imageInputMode === 'url'
                            ? 'bg-white text-stone-900 shadow-xs'
                            : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        <i className="fa-solid fa-link mr-1"></i> URL
                      </button>
                    </div>
                  </div>

                  {/* Active Image Preview Card */}
                  <div className="flex items-center gap-3.5 p-3 bg-white rounded-2xl border border-stone-200 shadow-2xs">
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-stone-200 border border-stone-300 shrink-0">
                      {isUploadingImage ? (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-stone-900/70 text-white gap-1">
                          <i className="fa-solid fa-spinner fa-spin text-lg text-brand-400"></i>
                          <span className="text-[9px] font-semibold">Yükleniyor</span>
                        </div>
                      ) : (
                        <>
                          <img
                            src={prodImageUrl}
                            alt="Seçili Ürün Görseli"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src = '/images/hero_banner.jpg';
                            }}
                          />
                          <span className="absolute bottom-1 right-1 bg-black/60 backdrop-blur-xs text-white text-[8px] px-1 py-0.5 rounded font-mono">
                            Önizleme
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        <i className="fa-solid fa-circle-check text-[10px]"></i> Görsel Hazır
                      </span>
                      <p className="text-[11px] text-stone-500 truncate font-mono">
                        {selectedFileName || prodImageUrl}
                      </p>
                      <div className="flex items-center gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploadingImage}
                          className="text-[11px] font-semibold text-brand-700 hover:text-brand-800 flex items-center gap-1 cursor-pointer"
                        >
                          <i className="fa-solid fa-arrow-rotate-right"></i> Değiştir
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setProdImageUrl('/images/hero_banner.jpg');
                            setSelectedFileName('Varsayılan Görsel');
                          }}
                          className="text-[11px] text-stone-400 hover:text-stone-600 cursor-pointer ml-auto"
                        >
                          Sıfırla
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* TAB 1: FILE UPLOAD DRAG & DROP */}
                  {imageInputMode === 'upload' && (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragActive(true);
                      }}
                      onDragLeave={() => setDragActive(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragActive(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) uploadFile(file);
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all ${
                        dragActive
                          ? 'border-brand-500 bg-brand-50/70 scale-[1.01]'
                          : 'border-stone-300 hover:border-brand-400 bg-white'
                      }`}
                    >
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageUpload}
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                      />
                      <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center mx-auto mb-2 text-base">
                        <i className="fa-solid fa-cloud-arrow-up"></i>
                      </div>
                      <p className="text-xs font-bold text-stone-800">
                        Görseli buraya sürükleyin veya <span className="text-brand-600 underline">cihazdan seçin</span>
                      </p>
                      <p className="text-[10px] text-stone-400 mt-1">
                        PNG, JPG, WEBP veya GIF (Maksimum 5MB)
                      </p>
                    </div>
                  )}

                  {/* TAB 2: PRESET FOOD IMAGES */}
                  {imageInputMode === 'presets' && (
                    <div className="grid grid-cols-3 gap-2">
                      {PRODUCT_IMAGE_PRESETS.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setProdImageUrl(preset.url);
                            setSelectedFileName(`${preset.label} (Şablon)`);
                          }}
                          className={`p-1.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                            prodImageUrl === preset.url
                              ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/20'
                              : 'border-stone-200 bg-white hover:border-stone-400'
                          }`}
                        >
                          <img
                            src={preset.url}
                            alt={preset.label}
                            className="w-10 h-10 rounded-lg object-cover"
                            onError={(e) => {
                              e.currentTarget.src = '/images/hero_banner.jpg';
                            }}
                          />
                          <span className="text-[10px] font-medium text-stone-700 truncate w-full">
                            {preset.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* TAB 3: IMAGE URL INPUT */}
                  {imageInputMode === 'url' && (
                    <div className="space-y-1.5 bg-white p-3 rounded-2xl border border-stone-200">
                      <label className="text-[10px] font-semibold text-stone-600 uppercase block">
                        Doğrudan Web Görsel Linki (URL)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={prodImageUrl.startsWith('http') ? prodImageUrl : ''}
                          onChange={(e) => {
                            setProdImageUrl(e.target.value);
                            setSelectedFileName('Web Bağlantısı (URL)');
                          }}
                          placeholder="https://images.unsplash.com/photo-..."
                          className="flex-1 bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-brand-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddProductOpen(false);
                    resetProductForm();
                  }}
                  className="px-6 py-3.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-2xl text-sm font-bold cursor-pointer transition-colors"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={isUploadingImage}
                  className="px-8 py-3.5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl text-sm font-bold cursor-pointer transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isUploadingImage ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i>
                      <span>Görsel Yükleniyor...</span>
                    </>
                  ) : editingProduct ? (
                    <>
                      <i className="fa-solid fa-check"></i>
                      <span>Değişiklikleri Kaydet</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-plus"></i>
                      <span>Ürünü Görseliyle Ekle</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SİPARİŞ DETAYI, ADİSYON & DURUM GEÇMİŞİ */}
      {detailOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-stone-900/50 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-4 sm:p-8 border border-stone-200 shadow-2xl space-y-5 my-auto max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-start pb-4 border-b border-stone-100">
              <div>
                <div className="flex items-center gap-2.5">
                  <h4 className="font-extrabold text-stone-900 text-lg">
                    Sipariş #{detailOrder.orderNumber || detailOrder.id}
                  </h4>
                  <span
                    className={`text-xs font-bold px-3 py-0.5 rounded-full border ${
                      (STATUS_CONFIG[detailOrder.status] || STATUS_CONFIG['Yeni']).bg
                    } ${(STATUS_CONFIG[detailOrder.status] || STATUS_CONFIG['Yeni']).text} ${
                      (STATUS_CONFIG[detailOrder.status] || STATUS_CONFIG['Yeni']).border
                    }`}
                  >
                    {(STATUS_CONFIG[detailOrder.status] || STATUS_CONFIG['Yeni']).label}
                  </span>
                </div>
                <span className="text-xs text-stone-400 block mt-0.5">
                  {detailOrder.date} &bull; Oluşturuldu: {formatElapsedTime(detailOrder.createdAt)}
                </span>
              </div>
              <button
                onClick={() => setDetailOrder(null)}
                className="text-stone-400 hover:text-stone-600 cursor-pointer p-2 rounded-xl hover:bg-stone-100"
              >
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Customer & Address */}
              <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100 text-xs space-y-1.5">
                <p>
                  <strong>Müşteri:</strong> {detailOrder.customerName}
                </p>
                <p>
                  <strong>Telefon:</strong>{' '}
                  <a href={`tel:${detailOrder.phone}`} className="text-brand-600 underline font-semibold">
                    {detailOrder.phone}
                  </a>
                </p>
                <p>
                  <strong>Teslimat Adresi:</strong> {detailOrder.address}
                </p>
                {detailOrder.notes && (
                  <p className="text-brand-700 font-medium">
                    <strong>Müşteri Notu:</strong> "{detailOrder.notes}"
                  </p>
                )}
              </div>

              {/* Payment Summary */}
              <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100 text-xs flex flex-col justify-between space-y-2">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-stone-500">
                    <span>Ödeme Yöntemi:</span>
                    <span className="font-bold text-stone-800">{detailOrder.paymentMethod || 'Kapıda Nakit'} (Elden)</span>
                  </div>
                  <div className="flex justify-between text-stone-500">
                    <span>Ödeme Durumu:</span>
                    <span className={`font-bold ${detailOrder.paymentStatus === 'Ödendi' ? 'text-green-700' : 'text-amber-700'}`}>
                      {detailOrder.paymentStatus || 'Bekleniyor'}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between text-base font-black text-stone-900 pt-2 border-t border-stone-200">
                  <span>Toplam Tutar:</span>
                  <BlurredAmount
                    canView={canViewRevenue}
                    amount={`₺${Number(detailOrder.total || 0).toFixed(2)}`}
                    className="text-brand-600 font-black"
                  />
                </div>
              </div>
            </div>

            {/* Courier Assignment & Quick Routing Bar in Detail Modal */}
            <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300/80 p-3.5 sm:p-4 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center font-bold shrink-0 shadow-xs">
                  <i className="fa-solid fa-motorcycle text-base"></i>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 block">
                    Atanan Paket Kuryesi
                  </span>
                  <span className="text-xs sm:text-sm font-extrabold text-stone-900">
                    {detailOrder.courierName ? (
                      <span className="text-emerald-700 flex items-center gap-1.5">
                        <i className="fa-solid fa-circle-check text-xs"></i>
                        {detailOrder.courierName}
                      </span>
                    ) : (
                      <span className="text-stone-500">Henüz Kurye Atanmadı</span>
                    )}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:w-72">
                <select
                  value={detailOrder.courierName || ''}
                  onChange={(e) => handleAssignCourier(detailOrder.id, e.target.value)}
                  className={`app-select border rounded-xl px-3.5 py-2.5 text-xs font-black focus:outline-none focus:ring-2 focus:ring-amber-500/25 cursor-pointer w-full transition-all shadow-xs ${
                    detailOrder.courierName
                      ? 'bg-emerald-600 text-white border-emerald-700'
                      : 'bg-white border-amber-300 text-stone-800'
                  }`}
                >
                  <option value="">🛵 Kurye Seçiniz...</option>
                  {courierOptions.map((cName) => (
                    <option key={cName} value={cName}>
                      🛵 {cName}
                    </option>
                  ))}
                  {detailOrder.courierName && !courierOptions.includes(detailOrder.courierName) && (
                    <option value={detailOrder.courierName}>🛵 {detailOrder.courierName}</option>
                  )}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Products Breakdown */}
              <div className="space-y-2 text-xs">
                <strong className="block text-stone-800">Sipariş Edilen Ürünler:</strong>
                <div className="divide-y divide-stone-100 border border-stone-100 rounded-2xl overflow-hidden">
                  {Array.isArray(detailOrder.items) ? (
                    detailOrder.items.map((it, idx) => (
                      <div key={idx} className="p-3 flex justify-between bg-white">
                        <div>
                          <span className="font-semibold text-stone-900">
                            {it.quantity}x {it.name}
                          </span>
                          {it.details && (
                            <span className="text-[10px] text-stone-500 block">{it.details}</span>
                          )}
                        </div>
                        <BlurredAmount
                          canView={canViewRevenue}
                          amount={`₺${(it.price * it.quantity).toFixed(2)}`}
                          className="font-bold text-stone-800"
                        />
                      </div>
                    ))
                  ) : (
                    <div className="p-3 bg-white">{detailOrder.items}</div>
                  )}
                </div>
              </div>

              {/* Status History (Audit Trail) */}
              <div className="space-y-2">
                <strong className="block text-stone-800 text-xs">Durum Değişikliği Tarihçesi:</strong>
                <div className="space-y-1.5 text-[11px]">
                  {detailOrder.statusHistory && detailOrder.statusHistory.length > 0 ? (
                    detailOrder.statusHistory.slice(-4).map((h, i) => (
                      <div key={i} className="flex items-start gap-2 bg-stone-50 p-2.5 rounded-xl border border-stone-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-stone-400 mt-1.5 shrink-0"></span>
                        <div className="flex-1">
                          <span className="font-bold text-stone-800">{h.status}</span> &bull;{' '}
                          <span className="text-stone-500">{h.user}</span>
                          <p className="text-[10px] text-stone-400">
                            {new Date(h.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} &bull; {h.note}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-stone-400 text-[11px]">Geçmiş kaydı bulunmuyor.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Primary Status Action Bar (Onayla / Hazırlamaya Başla / Kuryeye Ver / İptal Et) */}
            {(() => {
              const modalNextAction = getNextStep(detailOrder.status);
              const modalIsTerminal =
                detailOrder.status === 'Teslim Edildi' || detailOrder.status === 'İptal Edildi';
              if (!modalNextAction && modalIsTerminal) return null;
              return (
                <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                  <div className="text-xs text-stone-600 font-medium">
                    <span className="font-extrabold text-stone-900 block">Hızlı Sipariş İşlemi</span>
                    <span>
                      {detailOrder.status === 'Yeni' || detailOrder.status === 'Görüntülendi'
                        ? 'Bu sipariş onayınızı bekliyor. Onayladığınızda mutfak sırasına alınır.'
                        : 'Siparişi bir sonraki operasyon adımına ilerletebilirsiniz.'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {modalNextAction && (
                      <button
                        type="button"
                        onClick={() => handleProgressStatus(detailOrder.id, modalNextAction.nextStatus)}
                        className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl font-black text-xs sm:text-sm shadow-sm transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2 ${modalNextAction.color}`}
                      >
                        <i className={modalNextAction.icon}></i>
                        <span>{modalNextAction.label}</span>
                      </button>
                    )}
                    {!modalIsTerminal && (
                      <button
                        type="button"
                        onClick={() => setCancelModalOrder(detailOrder)}
                        className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 font-bold text-xs sm:text-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <i className="fa-solid fa-ban"></i>
                        <span>İptal Et</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Modal Footer Controls */}
            <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => window.print()}
                className="bg-brand-50 hover:bg-brand-100 text-brand-800 border border-brand-200 py-3 px-5 rounded-2xl text-xs sm:text-sm font-bold cursor-pointer flex items-center justify-center gap-2 transition-colors"
              >
                <i className="fa-solid fa-print text-brand-600"></i>
                <span>Mutfak / Kurye Fişi Yazdır (80mm)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDeleteOrderError('');
                  setDeleteAdminPassword('');
                  setDeleteRestoreStock(detailOrder.status !== 'İptal Edildi');
                  setDeleteModalOrder(detailOrder);
                }}
                className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 py-3 px-4 rounded-2xl text-xs sm:text-sm font-bold cursor-pointer flex items-center justify-center gap-2 transition-colors"
                title="Siparişi Kalıcı Olarak Sil (Yönetici Onaylı)"
              >
                <i className="fa-solid fa-trash-can text-rose-600"></i>
                <span>Siparişi Sil</span>
              </button>

              <button
                type="button"
                onClick={() => setDetailOrder(null)}
                className="flex-1 bg-stone-900 hover:bg-black text-white py-3 rounded-2xl text-xs sm:text-sm font-bold cursor-pointer transition-colors text-center"
              >
                Kapat
              </button>
            </div>

            {/* Hidden Printable Thermal POS Slip (80mm) */}
            <div id="thermal-receipt" className="hidden">
              <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 2px 0' }}>
                  {(adminSettings?.storeName || 'SANDVİÇ DİYARI').toUpperCase()}
                </h2>
                <p style={{ fontSize: '11px', margin: '0' }}>
                  {adminSettings?.storeAddress || 'Torbalı Mah. Hüseyin Kurtuldu Sk. No:32 Torbalı / İZMİR'}
                </p>
                <p style={{ fontSize: '11px', margin: '0' }}>
                  TEL: {adminSettings?.storePhone || '0 552 104 55 35'}
                </p>
                <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }}></div>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: '2px 0' }}>
                  ADİSYON: #{detailOrder.orderNumber || detailOrder.id}
                </h3>
                <p style={{ fontSize: '10px', margin: '0' }}>
                  Tarih: {detailOrder.date} - {new Date(detailOrder.createdAt || Date.now()).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }}></div>

              <div style={{ fontSize: '11px', marginBottom: '6px' }}>
                <p style={{ margin: '2px 0' }}><strong>MÜŞTERİ:</strong> {detailOrder.customerName}</p>
                <p style={{ margin: '2px 0' }}><strong>TEL:</strong> {detailOrder.phone}</p>
                <p style={{ margin: '2px 0' }}><strong>ADRES:</strong> {detailOrder.address}</p>
                {detailOrder.notes && (
                  <p style={{ margin: '2px 0', fontWeight: 'bold' }}>*** NOT: {detailOrder.notes} ***</p>
                )}
                <p style={{ margin: '2px 0' }}><strong>ÖDEME:</strong> {detailOrder.paymentMethod || 'Kapıda Nakit'} ({detailOrder.paymentStatus || 'Bekleniyor'})</p>
              </div>

              <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }}></div>

              <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #000' }}>
                    <th style={{ padding: '2px 0' }}>Ürün</th>
                    <th style={{ textAlign: 'right', padding: '2px 0' }}>Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(detailOrder.items) ? (
                    detailOrder.items.map((it, idx) => (
                      <tr key={idx} style={{ verticalAlign: 'top' }}>
                        <td style={{ padding: '3px 0' }}>
                          <strong>{it.quantity}x {it.name}</strong>
                          {it.details && <div style={{ fontSize: '9px' }}>{it.details}</div>}
                        </td>
                        <td style={{ textAlign: 'right', padding: '3px 0', whiteSpace: 'nowrap' }}>
                          ₺{(it.price * it.quantity).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="2">{detailOrder.items}</td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }}></div>

              <div style={{ fontSize: '13px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                <span>TOPLAM:</span>
                <span>₺{Number(detailOrder.total || 0).toFixed(2)}</span>
              </div>

              <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '10px' }}>
                <p style={{ margin: '2px 0' }}>{adminSettings?.receiptFooter || 'Bizi Tercih Ettiğiniz İçin Teşekkür Ederiz!'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SİPARİŞ İPTAL ONAY & GEREKÇE */}
      {cancelModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-stone-900/50 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-8 border border-stone-200 shadow-2xl space-y-5 my-auto max-h-[92vh] overflow-y-auto">
            <div>
              <h4 className="font-extrabold text-red-600 text-lg">Siparişi İptal Et</h4>
              <p className="text-xs sm:text-sm text-stone-500 mt-1">
                #{cancelModalOrder.orderNumber || cancelModalOrder.id} numaralı siparişi iptal etmek istediğinize emin misiniz?
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase mb-1.5">
                İptal Gerekçesi
              </label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="app-select w-full bg-stone-50 hover:bg-stone-100/60 border border-stone-200 rounded-2xl px-4 py-3.5 text-sm font-semibold focus:outline-none focus:border-red-500 cursor-pointer shadow-2xs"
              >
                <option value="Müşteri talebi">Müşteri talebi</option>
                <option value="Adres servis alanı dışı">Adres servis alanı dışı</option>
                <option value="Ürün stoğu tükendi">Ürün stoğu tükendi</option>
                <option value="Müşteriye ulaşılamadı">Müşteriye ulaşılamadı</option>
                <option value="Diğer">Diğer (Belirtin)</option>
              </select>
            </div>

            {cancelReason === 'Diğer' && (
              <div>
                <input
                  type="text"
                  value={customCancelReason}
                  onChange={(e) => setCustomCancelReason(e.target.value)}
                  placeholder="Gerekçe yazın..."
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:border-red-500"
                />
              </div>
            )}

            <div className="flex gap-3 pt-3">
              <button
                type="button"
                onClick={() => setCancelModalOrder(null)}
                className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-700 py-3.5 rounded-2xl text-sm font-bold cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3.5 rounded-2xl text-sm font-bold cursor-pointer"
              >
                İptali Onayla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: YÖNETİCİ ONAYLI SİPARİŞ SİLME */}
      {deleteModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-8 border border-rose-200 shadow-2xl space-y-5 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center text-xl shrink-0 shadow-inner">
                <i className="fa-solid fa-shield-halved"></i>
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-extrabold text-stone-900 text-base flex items-center gap-2">
                  <span>Siparişi Kalıcı Olarak Sil</span>
                  <span className="bg-rose-100 text-rose-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                    Yönetici Onaylı
                  </span>
                </h4>
                <p className="text-xs text-stone-500 mt-0.5">
                  #{deleteModalOrder.orderNumber || deleteModalOrder.id} numaralı sipariş kaydı veritabanından kalıcı olarak silinecektir.
                </p>
              </div>
            </div>

            {/* Sipariş Özeti */}
            <div className="bg-stone-50 rounded-2xl p-3.5 border border-stone-200/80 space-y-1.5 text-xs text-stone-700">
              <div className="flex justify-between">
                <span className="text-stone-400">Müşteri:</span>
                <span className="font-bold text-stone-900">{deleteModalOrder.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">Telefon:</span>
                <span className="font-semibold">{deleteModalOrder.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">Tutar & Durum:</span>
                <span className="inline-flex items-center gap-1.5">
                  <BlurredAmount
                    canView={canViewRevenue}
                    amount={`₺${Number(deleteModalOrder.total || deleteModalOrder.subtotal || 0).toFixed(2)}`}
                    className="text-brand-600 font-bold"
                  />
                  <span>&bull; {deleteModalOrder.status}</span>
                </span>
              </div>
            </div>

            {/* Stok İade Opsiyonu */}
            <label className="flex items-center gap-2.5 text-xs text-stone-700 cursor-pointer select-none bg-amber-50/60 p-2.5 rounded-xl border border-amber-200/80">
              <input
                type="checkbox"
                checked={deleteRestoreStock}
                onChange={(e) => setDeleteRestoreStock(e.target.checked)}
                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-stone-300 cursor-pointer"
              />
              <span className="font-medium text-amber-950">
                Bu siparişteki ürünlerin stok adetlerini geri yükle (stok iadesi yap)
              </span>
            </label>

            {/* Hata Mesajı */}
            {deleteOrderError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-center gap-2">
                <i className="fa-solid fa-circle-exclamation shrink-0 text-rose-500"></i>
                <span className="font-medium">{deleteOrderError}</span>
              </div>
            )}

            {/* Şifre Doğrulama Formu */}
            <form onSubmit={handleConfirmDeleteOrder} className="space-y-3.5 pt-1">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wide">
                    Yönetici Onay Şifresi <span className="text-rose-500">*</span>
                  </label>
                </div>
                <input
                  type="password"
                  required
                  autoFocus
                  value={deleteAdminPassword}
                  onChange={(e) => setDeleteAdminPassword(e.target.value)}
                  placeholder="Yönetici şifrenizi giriniz..."
                  className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs text-stone-900 focus:outline-none focus:border-rose-500 focus:bg-white font-medium transition-all"
                />
              </div>

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={isDeletingOrder}
                  onClick={() => {
                    setDeleteModalOrder(null);
                    setDeleteAdminPassword('');
                    setDeleteOrderError('');
                  }}
                  className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-700 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={isDeletingOrder || !deleteAdminPassword}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:bg-stone-300 disabled:cursor-not-allowed text-white py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-2 shadow-md shadow-rose-600/20 active:scale-95"
                >
                  {isDeletingOrder ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i>
                      <span>Siliniyor...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-trash-can"></i>
                      <span>Onayla ve Sil</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SAĞ KENAR HIZLI ERİŞİM KULAKÇIĞI (SAYFA DÜZENLERİ) */}
      {canEditSiteContent && !siteEditorDrawerOpen && (
        <button
          type="button"
          onClick={() => setSiteEditorDrawerOpen(true)}
          title="Sayfa Düzenleri & Vitrin Stüdyosunu Sağda Aç"
          className="hidden lg:flex fixed right-0 top-1/2 -translate-y-1/2 z-30 flex-col items-center gap-2 py-3.5 px-2.5 rounded-l-2xl bg-gradient-to-b from-stone-900 to-stone-800 hover:from-brand-600 hover:to-amber-600 text-white shadow-xl border border-r-0 border-white/15 transition-all duration-200 cursor-pointer group"
        >
          <span className="w-7 h-7 rounded-xl bg-amber-500/20 group-hover:bg-white/20 text-amber-400 group-hover:text-white flex items-center justify-center transition-colors">
            <i className="fa-solid fa-paintbrush text-xs"></i>
          </span>
          <span
            className="text-[10px] font-extrabold uppercase tracking-widest text-stone-200 group-hover:text-white"
            style={{ writingMode: 'vertical-rl' }}
          >
            Sayfa Düzenle
          </span>
        </button>
      )}

      {/* SAĞDAN AÇILIR SAYFA DÜZENLERİ & VİTRİN STÜDYOSU ÇEKMECESİ (DRAWER) */}
      {canEditSiteContent && siteEditorDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Yarı Saydam Arka Plan */}
          <div
            onClick={() => setSiteEditorDrawerOpen(false)}
            className="fixed inset-0 bg-stone-950/50 backdrop-blur-xs animate-in fade-in duration-200"
            aria-hidden="true"
          />

          {/* Sağ Panel Çekmecesi */}
          <aside
            style={{ backgroundColor: '#ffffff' }}
            className={`relative z-10 h-full w-full ${
              siteEditorWide ? 'max-w-5xl' : 'max-w-3xl'
            } bg-white border-l border-stone-200 shadow-[-24px_0_64px_rgba(15,23,42,0.28)] flex flex-col transition-all duration-300 animate-in slide-in-from-right`}
          >
            {/* Sağ Çekmece Üst Başlık ve Hızlı Bölüm Sekmeleri */}
            <div className="bg-white border-b border-stone-200 px-4 sm:px-6 py-3.5 space-y-3 shrink-0">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-600 to-amber-500 text-white flex items-center justify-center shadow-md shrink-0">
                    <i className="fa-solid fa-paintbrush text-sm"></i>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-extrabold text-stone-900 truncate">
                      Sayfa Düzenleri &amp; Vitrin Stüdyosu
                    </h3>
                    <p className="text-[11px] text-stone-500 truncate">
                      Müşteri ana sayfası manşet, kampanya, menü ve iletişim alanlarını sağ panelden yönetin
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSiteEditorWide((prev) => !prev)}
                    className="hidden lg:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs transition-colors cursor-pointer"
                    title={siteEditorWide ? 'Paneli Daralt' : 'Paneli Genişlet'}
                  >
                    <i
                      className={`fa-solid ${
                        siteEditorWide ? 'fa-compress' : 'fa-expand'
                      } text-xs`}
                    ></i>
                    <span>{siteEditorWide ? 'Daralt' : 'Genişlet'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSiteEditorDrawerOpen(false)}
                    className="w-9 h-9 rounded-xl bg-stone-100 hover:bg-rose-50 text-stone-600 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer"
                    aria-label="Sayfa Düzenleme Panelini Kapat"
                    title="Kapat"
                  >
                    <i className="fa-solid fa-xmark text-base"></i>
                  </button>
                </div>
              </div>

              {/* Hızlı Bölüm Geçiş Hapları */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                {[
                  { id: 'hero', label: 'Manşet & Hero', icon: 'fa-solid fa-panorama' },
                  { id: 'campaigns', label: 'Kampanyalar', icon: 'fa-solid fa-fire' },
                  { id: 'newMenus', label: 'Yeni Menüler', icon: 'fa-solid fa-burger' },
                  { id: 'features', label: 'Neden Biz?', icon: 'fa-solid fa-shield-heart' },
                  { id: 'reviews', label: 'Müşteri Yorumları', icon: 'fa-regular fa-star' },
                  { id: 'contact', label: 'İletişim & Şube', icon: 'fa-solid fa-phone' },
                ].map((sec) => {
                  const activeSec = selectedSiteContentSubTab === sec.id;
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => setSelectedSiteContentSubTab(sec.id)}
                      className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        activeSec
                          ? 'bg-gradient-to-r from-brand-600 to-amber-500 text-white shadow-xs'
                          : 'bg-stone-100 hover:bg-stone-200 text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      <i className={`${sec.icon} text-[11px]`}></i>
                      <span>{sec.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sağ Çekmece İçerik Alanı */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-stone-50/80">
              <SiteContentEditorTab
                initialSubTab={selectedSiteContentSubTab}
                onSubTabChange={setSelectedSiteContentSubTab}
              />
            </div>
          </aside>
        </div>
      )}

      {/* GLOBAL TOAST POPUP (Geri Bildirim & Durum Bildirimleri) */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl text-xs font-bold border ${
              toast.type === 'error'
                ? 'bg-rose-900 text-white border-rose-700 shadow-rose-950/20'
                : toast.type === 'info'
                ? 'bg-stone-900 text-white border-stone-700 shadow-stone-950/20'
                : 'bg-emerald-800 text-white border-emerald-600 shadow-emerald-950/20'
            }`}
          >
            <i
              className={`text-sm ${
                toast.type === 'error'
                  ? 'fa-solid fa-circle-exclamation text-rose-300'
                  : toast.type === 'info'
                  ? 'fa-solid fa-circle-info text-sky-300'
                  : 'fa-solid fa-circle-check text-emerald-300'
              }`}
            ></i>
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="ml-2 text-stone-400 hover:text-white cursor-pointer"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>
      )}

      <MessageModal />
    </div>
  );
}
