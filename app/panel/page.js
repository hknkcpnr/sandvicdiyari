'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setProducts, addProduct, updateProduct, deleteProduct } from '@/store/slices/productSlice';
import { showMessageModal, setReviews, updateReviewStatus, removeReview } from '@/store/slices/uiSlice';
import MessageModal from '@/components/modals/MessageModal';
import OverviewDashboard from '@/components/admin/OverviewDashboard';
import InventoryTab from '@/components/admin/InventoryTab';
import KitchenPosBell, { playKitchenBellSound, speakProductPreview } from '@/components/admin/KitchenPosBell';
import UsersRolesTab from '@/components/admin/UsersRolesTab';
import ActivityLogsTab from '@/components/admin/ActivityLogsTab';
import ThemeColorPicker from '@/components/admin/ThemeColorPicker';
import { applyPanelTheme, getSavedTheme } from '@/lib/themeColors';
import BlurredAmount from '@/components/admin/BlurredAmount';
import SettingsTab, { DEFAULT_ADMIN_SETTINGS } from '@/components/admin/SettingsTab';
import SiteContentEditorTab from '@/components/admin/SiteContentEditorTab';
import MembersTab from '@/components/admin/MembersTab';
import OptionsManagementTab from '@/components/admin/OptionsManagementTab';
import AdminPagination from '@/components/admin/AdminPagination';
import { buildWhatsAppOrderConfirmUrl } from '@/lib/phoneUtils';
import { getOrderPauseState } from '@/lib/orderPause';
import { printThermalReceipt, generateReceiptHtml } from '@/lib/thermalReceipt';
import { fetchAdminUsersCached, invalidateAdminUsersCache } from '@/lib/adminUsersCache';
import {
  getBrowserCache,
  setBrowserCache,
  invalidateBrowserCache,
  fetchWithBrowserCache,
  CACHE_TTL_LONG,
} from '@/lib/browserDataCache';
import {
  DEFAULT_MENU_COLA_EXTRA_PRICE,
  DEFAULT_MENU_DRINK_GROUPS,
  normalizeMenuColaExtraPrice,
  normalizeMenuDrinkGroups,
  normalizeProductMenuDrinks,
  getMenuSizeTier,
  getEffectiveMenuDrinks,
} from '@/lib/productOptionsDefaults';

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

// Next allowed operational step (Sadeleştirilmiş 3 adımlı akış: Yeni -> Hazırlanıyor -> Yolda / Teslim Edildi)
function getNextStep(status, isCourierEnabled = true) {
  switch (status) {
    case 'Yeni':
    case 'Görüntülendi':
      return { nextStatus: 'Hazırlanıyor', label: 'Onayla ve Hazırla', icon: 'fa-solid fa-fire-burner', color: 'bg-orange-600 hover:bg-orange-700 text-white' };
    case 'Onaylandı':
    case 'Hazırlanıyor':
      if (!isCourierEnabled) {
        return { nextStatus: 'Teslim Edildi', label: 'Teslim Edildi Olarak İşaretle', icon: 'fa-solid fa-circle-check', color: 'bg-green-600 hover:bg-green-700 text-white' };
      }
      return { nextStatus: 'Yolda', label: 'Kuryeye Ver (Yolda)', icon: 'fa-solid fa-person-biking', color: 'bg-indigo-600 hover:bg-indigo-700 text-white' };
    case 'Hazır':
    case 'Kurye Teslim Aldı':
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
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const [receiptPreviewHtml, setReceiptPreviewHtml] = useState('');
  const [siteEditorDrawerOpen, setSiteEditorDrawerOpen] = useState(false);
  const [siteEditorWide, setSiteEditorWide] = useState(false);
  const [selectedSiteContentSubTab, setSelectedSiteContentSubTab] = useState('hero');
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [selectedSettingsSubTab, setSelectedSettingsSubTab] = useState('appearance');

  // Sistem & Panel Ayarları (Yazı Boyutu, Ses, Fiş, Otomatik Yenileme)
  const [adminSettings, setAdminSettings] = useState({ ...DEFAULT_ADMIN_SETTINGS, courierModuleEnabled: false });
  const isCourierEnabled = adminSettings?.courierModuleEnabled === true;

  // Sipariş Alımını Geçici Durdurma (Yoğunluk / Mola)
  const [orderPause, setOrderPause] = useState({ paused: false });
  const [pauseMenuOpen, setPauseMenuOpen] = useState(false);
  const [pauseSaving, setPauseSaving] = useState(false);

  const refreshOrderPause = () => {
    fetch('/api/admin/settings', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data) setOrderPause(getOrderPauseState(j.data));
      })
      .catch(() => {});
  };

  useEffect(() => {
    refreshOrderPause();
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      refreshOrderPause();
    }, 90000);
    return () => clearInterval(timer);
  }, []);

  const handleSetOrderPause = async (minutes) => {
    // minutes: null => devam ettir, 0 => süresiz durdur, >0 => belirli süre
    setPauseSaving(true);
    setPauseMenuOpen(false);
    const payload =
      minutes === null
        ? { ordersPaused: false }
        : {
            ordersPaused: true,
            ordersPausedUntil: minutes > 0 ? new Date(Date.now() + minutes * 60000).toISOString() : null,
            ordersPausedReason: 'Yoğunluk nedeniyle kısa bir süre sipariş alamıyoruz.'
          };
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const j = await res.json();
      if (!res.ok || !j?.success) throw new Error(j?.error || 'Kaydedilemedi');
      setOrderPause(getOrderPauseState(j.data));
      showToast(
        minutes === null
          ? 'Sipariş alımı tekrar açıldı.'
          : minutes > 0
          ? `Sipariş alımı ${minutes} dakika durduruldu.`
          : 'Sipariş alımı siz açana kadar durduruldu.',
        minutes === null ? 'success' : 'info'
      );
    } catch (err) {
      showToast(`Sipariş alımı ayarı kaydedilemedi: ${err.message}`, 'error');
    } finally {
      setPauseSaving(false);
    }
  };

  useEffect(() => {
    try {
      applyPanelTheme(getSavedTheme());
      const saved = localStorage.getItem('sandwich_admin_sidebar_collapsed');
      if (saved !== null) {
        setSidebarCollapsed(saved === 'true');
      }
      const savedSettings = localStorage.getItem('sandwich_admin_settings');
      if (savedSettings) {
        setAdminSettings({ ...DEFAULT_ADMIN_SETTINGS, ...JSON.parse(savedSettings) });
      }
      const sdCourier = localStorage.getItem('sd_courier_module_enabled');
      if (sdCourier !== null) {
        setAdminSettings((prev) => ({ ...prev, courierModuleEnabled: sdCourier === 'true' }));
      }
    } catch (e) {}

    const handleStorageChange = () => {
      try {
        const fresh = localStorage.getItem('sandwich_admin_settings');
        if (fresh) {
          setAdminSettings({ ...DEFAULT_ADMIN_SETTINGS, ...JSON.parse(fresh) });
        }
        const sdCourier = localStorage.getItem('sd_courier_module_enabled');
        if (sdCourier !== null) {
          setAdminSettings((prev) => ({ ...prev, courierModuleEnabled: sdCourier === 'true' }));
        }
      } catch (e) {}
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('sd_courier_module_updated', handleStorageChange);

    fetch('/api/admin/settings', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (j?.success && j?.data) {
          setAdminSettings((prev) => ({ ...prev, courierModuleEnabled: j.data.courierModuleEnabled === true }));
        }
      })
      .catch(() => {});

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('sd_courier_module_updated', handleStorageChange);
    };
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

  const loadCouriers = useCallback(async (force = false) => {
    try {
      const json = await fetchAdminUsersCached({ force, scope: 'staff' });
      if (!json?.success) return;
      const payload = json?.data || {};
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

      // Sipariş silme yetkisine sahip aktif yöneticileri ve restoran müdürlerini filtrele
      const managers = adminUsers
        .filter((u) => {
          if (u.isActive === false) return false;
          const matchedRole = roles.find((r) => r.id === u.roleId || r.code === u.roleId) || {};
          const roleId = String(u.roleId || '').toLowerCase();
          const roleName = String(u.roleName || u.role || matchedRole.name || '').toLowerCase();
          const isSuper = roleId === 'role_super_admin' || roleName.includes('süper') || String(u.email || '').toLowerCase() === 'admin';
          const perms = Array.isArray(u.permissions)
            ? u.permissions
            : Array.isArray(matchedRole.permissions)
            ? matchedRole.permissions
            : [];
          return isSuper || perms.includes('delete_order');
        })
        .map((u) => {
          const matchedRole = roles.find((r) => r.id === u.roleId || r.code === u.roleId) || {};
          const isSuper = u.roleId === 'role_super_admin' || String(u.email || '').toLowerCase() === 'admin';
          return {
            id: u.id,
            name: u.name || u.email,
            email: u.email,
            roleName: isSuper ? 'Süper Yönetici' : (matchedRole.name || u.roleName || 'Restoran Müdürü'),
          };
        });
      setSupervisors(managers);

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
      loadCouriers(false);
    };

    const handleStorage = (e) => {
      if (e.key === 'sandwich_users_updated') {
        invalidateAdminUsersCache();
        loadCouriers(true);
      }
    };

    window.addEventListener('sandwich_users_updated', handleUsersUpdated);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('sandwich_users_updated', handleUsersUpdated);
      window.removeEventListener('storage', handleStorage);
    };
  }, [loadCouriers]);
  const knownOrderIdsRef = useRef(new Set());
  const ordersInitializedRef = useRef(false);

  // Filters & Search
  const [orderStageFilter, setOrderStageFilter] = useState('all'); // 'all' | 'kitchen' | 'courier' | 'completed' | 'cancelled'
  const [orderSearch, setOrderSearch] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');

  useEffect(() => {
    if (!isCourierEnabled && orderStageFilter === 'courier') {
      setOrderStageFilter('all');
    }
  }, [isCourierEnabled, orderStageFilter]);

  // Modals
  const [detailOrder, setDetailOrder] = useState(null);
  const [cancelModalOrder, setCancelModalOrder] = useState(null);
  const [cancelReason, setCancelReason] = useState('Müşteri talebi');
  const [customCancelReason, setCustomCancelReason] = useState('');
  const [deleteModalOrder, setDeleteModalOrder] = useState(null);
  const [deleteAdminPassword, setDeleteAdminPassword] = useState('');
  const [deleteSupervisorEmail, setDeleteSupervisorEmail] = useState('');
  const [supervisors, setSupervisors] = useState([]);
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
  const [prodIngredients, setProdIngredients] = useState([]);
  const [ingredientInput, setIngredientInput] = useState('');
  const [prodBadge, setProdBadge] = useState('Yeni Çıktı');
  const [prodStock, setProdStock] = useState('25');
  const [prodIsAvailable, setProdIsAvailable] = useState(true);
  const [prodImageUrl, setProdImageUrl] = useState('/images/hero_banner.jpg');
  const [prodAudioUrl, setProdAudioUrl] = useState('');
  const [prodAudioFileName, setProdAudioFileName] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [imageInputMode, setImageInputMode] = useState('upload'); // 'upload' | 'presets' | 'url'
  const [dragActive, setDragActive] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [menuColaExtraPrice, setMenuColaExtraPrice] = useState(DEFAULT_MENU_COLA_EXTRA_PRICE);
  const [menuColaPriceInput, setMenuColaPriceInput] = useState(String(DEFAULT_MENU_COLA_EXTRA_PRICE));
  const [savingColaPrice, setSavingColaPrice] = useState(false);
  const [menuDrinkGroups, setMenuDrinkGroups] = useState(DEFAULT_MENU_DRINK_GROUPS);
  const [productMenuDrinks, setProductMenuDrinks] = useState({});
  const [prodMenuDrinks, setProdMenuDrinks] = useState([]);
  const [prodMenuDrinksCustomized, setProdMenuDrinksCustomized] = useState(false);
  const [newModalDrinkName, setNewModalDrinkName] = useState('');
  const [newModalDrinkPrice, setNewModalDrinkPrice] = useState('0');
  const [savingModalDrinks, setSavingModalDrinks] = useState(false);
  const fileInputRef = useRef(null);
  const prodAudioInputRef = useRef(null);

  const handleProductAudioSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (
      !file.type.startsWith('audio/') &&
      !file.type.startsWith('video/') &&
      !/\.(mp3|wav|ogg|m4a|aac|mp4|webm)$/i.test(file.name)
    ) {
      showToast('Lütfen geçerli bir ses dosyası (.mp3, .wav, .ogg, .m4a) seçin.', 'error');
      return;
    }
    if (file.size > 3.5 * 1024 * 1024) {
      showToast('Ses dosyası en fazla 3.5 MB olabilir.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      if (dataUrl.startsWith('data:')) {
        setProdAudioUrl(dataUrl);
        setProdAudioFileName(file.name);
        speakProductPreview(prodName || file.name, dataUrl, 0.9);
        showToast(`"${file.name}" ürün sesi olarak eklendi! 🔊`, 'success');
      }
    };
    reader.readAsDataURL(file);
  };

  const COMMON_INGREDIENT_TAGS = [
    'Sosis',
    'Sucuk',
    'Salam',
    'Kaşar Peyniri',
    'Domates',
    'Kornişon Turşu',
    'Marul',
    'Ketçap',
    'Mayonez',
    'Rus Salatası',
    'Patates Kızartması',
    'Kasap Köfte',
    'Tavuk',
    'Cheddar',
    'Karamelize Soğan',
  ];

  const extractInitialIngredients = (product) => {
    if (!product) return [];
    if (Array.isArray(product.ingredients) && product.ingredients.length > 0) {
      return product.ingredients.map((s) => String(s).trim()).filter(Boolean);
    }
    if (
      Array.isArray(product.options) &&
      product.options.length > 0 &&
      product.options.every((s) => typeof s === 'string')
    ) {
      return product.options.map((s) => String(s).trim()).filter(Boolean);
    }
    const rawDesc = String(product.description || product.desc || '').trim();
    if (!rawDesc) return [];
    const cleaned = rawDesc
      .replace(/\.+$/, '')
      .replace(/^.*ekmeğinde\s+/i, '')
      .replace(/\s+ziyafeti$/i, '');
    return cleaned
      .split(/(?:,|\+|\s+ve\s+)/i)
      .map((p) => p.trim())
      .filter((p) => p.length > 0 && p.length <= 50)
      .map((p) => p.charAt(0).toLocaleUpperCase('tr-TR') + p.slice(1));
  };

  const handleAddIngredientTag = (rawVal) => {
    const val = String(rawVal ?? ingredientInput ?? '').trim();
    if (!val) return;
    const parts = val
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.charAt(0).toLocaleUpperCase('tr-TR') + s.slice(1));
    if (parts.length === 0) return;
    setProdIngredients((prev) => {
      const next = [...prev];
      for (const p of parts) {
        if (!next.some((existing) => existing.toLocaleLowerCase('tr-TR') === p.toLocaleLowerCase('tr-TR'))) {
          next.push(p);
        }
      }
      return next;
    });
    setIngredientInput('');
  };

  const handleRemoveIngredientTag = (tagToRemove) => {
    setProdIngredients((prev) => prev.filter((t) => t !== tagToRemove));
  };

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

  // Canlı Yetki Senkronizasyonu: Rol yetkileri değiştiğinde yeniden giriş gerekmeden uygulanır
  const adminUserId = adminUser?.id;
  useEffect(() => {
    if (!adminUserId) return;
    let cancelled = false;
    const refreshPermissions = async () => {
      try {
        const res = await fetch('/api/admin/login', { cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.status === 401 || res.status === 403) {
          setAdminUser(null);
          sessionStorage.removeItem('sd_admin_session');
          return;
        }
        const fresh = json?.data?.admin;
        if (json?.success && fresh) {
          setAdminUser((prev) => {
            const merged = { ...(prev || {}), ...fresh };
            try {
              sessionStorage.setItem('sd_admin_session', JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }
      } catch {}
    };
    refreshPermissions();
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      refreshPermissions();
    }, 90000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [adminUserId]);

  // Web Audio & Custom Audio chime for new orders
  const playSoundAlert = () => {
    if (!soundEnabled) return;
    try {
      const preferredSound =
        (typeof window !== 'undefined' && localStorage.getItem('sd_bell_sound')) ||
        adminSettings?.soundType ||
        'pos_bell';
      const preferredVol =
        typeof adminSettings?.soundVolume === 'number'
          ? adminSettings.soundVolume / 100
          : 0.85;
      playKitchenBellSound(preferredSound, preferredVol, adminSettings?.customSounds);
    } catch (e) {}
  };

  // Fetch orders from API
  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      const res = await fetch('/api/orders', { cache: 'no-store' });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const nextIds = new Set(json.data.map((o) => o.id));
        if (!ordersInitializedRef.current) {
          ordersInitializedRef.current = true;
        }
        knownOrderIdsRef.current = nextIds;
        setOrders(json.data);

        // Keep modal updated if open
        if (detailOrder) {
          const fresh = json.data.find((o) => o.id === detailOrder.id);
          if (fresh) setDetailOrder(fresh);
          else setDetailOrder(null);
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
      const res = await fetch('/api/products?includeAudio=1');
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

      const handleFocus = () => {
        if (typeof document !== 'undefined' && document.hidden) return;
        fetchOrders();
      };
      window.addEventListener('storage', handleStorageChange);
      window.addEventListener('focus', handleFocus);
      window.addEventListener('visibilitychange', handleFocus);

      // Restoran hızında sipariş kontrolü: Sekme açıkken 6 saniye, arka plandayken 15 saniyede bir
      let pollCounter = 0;
      const ordersPollTimer = setInterval(() => {
        pollCounter++;
        const isHidden = typeof document !== 'undefined' && document.hidden;
        if (!isHidden || pollCounter % 3 === 0) {
          fetchOrders();
        }
      }, 5000);

      // İnceleme ve geri bildirimleri kontrol et (arka planda değilken)
      const otherPollTimer = setInterval(() => {
        if (typeof document === 'undefined' || !document.hidden) {
          fetchReviews();
          fetchFeedbacks();
        }
      }, 30000);

      return () => {
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener('focus', handleFocus);
        window.removeEventListener('visibilitychange', handleFocus);
        clearInterval(ordersPollTimer);
        clearInterval(otherPollTimer);
      };
    }
  }, [adminUser]);

  // Login handler
  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginEmail,
          email: loginEmail,
          pass: loginPass,
          portal: 'panel'
        }),
      });
      const json = await res.json();

      if (json.success) {
        const loggedAdmin = json.data.admin;
        const isCourierOnly =
          loggedAdmin?.roleId === 'role_courier' ||
          (loggedAdmin?.roleId !== 'role_super_admin' &&
            String(loggedAdmin?.role || '').toLowerCase().includes('kurye') &&
            !(Array.isArray(loggedAdmin?.permissions) && loggedAdmin.permissions.includes('orders')));
        if (isCourierOnly) {
          setLoginError('Bu hesap Kurye Paneli (/kurye) kullanıcısıdır. Restoran Paneline (/panel) giriş yetkisi yoktur.');
          return;
        }
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
    invalidateAdminUsersCache();
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

        // OTOMATİK TERMAL FİŞ BASKI (Xprinter 80mm)
        // Sipariş 'Hazırlanıyor' aşamasına (yani Onaylandı) alındığında otomatik yazıcıya gönderilir.
        let receiptSent = false;
        if (newStatus === 'Hazırlanıyor' && adminSettings?.autoPrintOnApproval !== false) {
          try {
            printThermalReceipt(json.data, adminSettings);
            receiptSent = true;
          } catch (pErr) {
            console.error('Otomatik fiş basma hatası:', pErr);
          }
        }

        showToast(
          newStatus === 'Hazırlanıyor'
            ? `Sipariş #${json.data.orderNumber || orderId} onaylandı! ${receiptSent ? '🧾 Fiş Xprinter yazıcıya gönderildi.' : '🍳 Mutfak hazırlığına alındı.'}`
            : newStatus === 'Yolda'
            ? `Sipariş #${json.data.orderNumber || orderId} kuryeye verildi (yolda)! 🛵`
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

  // Kalıcı Sipariş Silme (Yetkili veya Restoran Müdürü Onaylı)
  const handleConfirmDeleteOrder = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!deleteModalOrder) return;

    // Yetkisi olmayan personeller için müdür/yönetici şifresi zorunludur
    if (!canDeleteOrder && !deleteAdminPassword.trim()) {
      setDeleteOrderError('Yetkiniz bulunmadığı için lütfen bir Restoran Müdürü veya Yönetici şifresi giriniz.');
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
          supervisorEmail: deleteSupervisorEmail || undefined,
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
      setDeleteSupervisorEmail('');
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
    setProdIngredients([]);
    setIngredientInput('');
    setProdBadge('Yeni Çıktı');
    setProdImageUrl('/images/hero_banner.jpg');
    setProdAudioUrl('');
    setProdAudioFileName('');
    setSelectedFileName('');
    setImageInputMode('upload');
    setEditingProduct(null);
  };

  // Open Add Product Modal
  const openAddProductModal = () => {
    if (!canAddProduct) {
      showToast('Bu işlem için "Menüye Ürün Ekleme" yetkiniz bulunmuyor.', 'error');
      return;
    }
    resetProductForm();
    const defaultTierDrinks = (menuDrinkGroups?.['1'] || DEFAULT_MENU_DRINK_GROUPS['1']).map((d) => ({ ...d }));
    setProdMenuDrinks(defaultTierDrinks);
    setProdMenuDrinksCustomized(false);
    setNewModalDrinkName('');
    setNewModalDrinkPrice('0');
    setIsAddProductOpen(true);
  };

  // Open Edit Product Modal
  const openEditProductModal = (product) => {
    if (!canEditProduct) {
      showToast('Bu işlem için "Menü & Ürün Düzenleme" yetkiniz bulunmuyor.', 'error');
      return;
    }
    setEditingProduct(product);
    setProdName(product.name || '');
    setProdCategory(product.category || 'menu');
    setProdPrice(product.price ? String(product.price) : '');
    setProdStock(String(product.stock ?? 25));
    setProdIsAvailable(product.isAvailable !== false);
    setProdDesc(product.description || '');
    setProdIngredients(extractInitialIngredients(product));
    setIngredientInput('');
    setProdBadge(product.badge || '');
    setProdImageUrl(product.image || '/images/hero_banner.jpg');
    setProdAudioUrl(product.audioUrl || '');
    setProdAudioFileName(product.audioUrl ? 'Özel Ürün Sesi' : '');
    setSelectedFileName(product.image?.startsWith('/uploads/') ? 'Yüklenmiş Dosya' : '');
    setImageInputMode(product.image?.startsWith('http') ? 'url' : 'upload');

    const tier = getMenuSizeTier(product);
    const customList = productMenuDrinks?.[String(product.id)];
    const hasCustom = Array.isArray(customList) && customList.length > 0;
    const sourceDrinks = hasCustom
      ? customList
      : menuDrinkGroups?.[tier] || DEFAULT_MENU_DRINK_GROUPS[tier];
    setProdMenuDrinks((sourceDrinks || []).map((d) => ({ ...d })));
    setProdMenuDrinksCustomized(hasCustom);
    setNewModalDrinkName('');
    setNewModalDrinkPrice('0');

    setIsAddProductOpen(true);
  };

  // Quick One-click Toggle Availability from Menu & Products list
  const handleQuickToggleAvailability = async (product) => {
    if (!canUpdateStock) {
      showToast('Bu işlem için "Stok Değişimi & Satış Aç/Kapa" yetkiniz bulunmuyor.', 'error');
      return;
    }
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
        invalidateBrowserCache('products_');
        invalidateBrowserCache('inventory_');
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

    const finalIngredients = [...prodIngredients];
    if (ingredientInput.trim()) {
      const pendingParts = ingredientInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.charAt(0).toLocaleUpperCase('tr-TR') + s.slice(1));
      for (const p of pendingParts) {
        if (!finalIngredients.some((ex) => ex.toLocaleLowerCase('tr-TR') === p.toLocaleLowerCase('tr-TR'))) {
          finalIngredients.push(p);
        }
      }
    }

    const effectiveDesc =
      prodDesc.trim() ||
      (finalIngredients.length > 0 ? finalIngredients.join(', ') : 'Özel şef sandviçimiz.');

    const payload = {
      name: prodName.trim(),
      category: prodCategory,
      price: parseFloat(prodPrice),
      stock: prodStock !== '' ? Number(prodStock) : 25,
      isAvailable: prodIsAvailable,
      trackStock: true,
      description: effectiveDesc,
      options: finalIngredients,
      ingredients: finalIngredients,
      badge: prodBadge.trim(),
      image: prodImageUrl || '/images/hero_banner.jpg',
      audioUrl: prodAudioUrl || '',
    };

    const syncCustomMenuDrinks = async (savedProd) => {
      if (
        savedProd?.id != null &&
        payload.category === 'menu' &&
        prodMenuDrinksCustomized &&
        prodMenuDrinks.length > 0 &&
        (canManagePrices || canManageOptions)
      ) {
        try {
          await saveProductCustomDrinks(savedProd.id, prodMenuDrinks);
        } catch (drinkErr) {
          showToast(
            drinkErr.message || 'Ürün kaydedildi ancak özel içecek fiyatları kaydedilemedi.',
            'error'
          );
        }
      }
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
          await syncCustomMenuDrinks(json.data);
          fetchProducts();
          invalidateBrowserCache('products_');
          invalidateBrowserCache('inventory_');
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
          await syncCustomMenuDrinks(json.data);
          fetchProducts();
          invalidateBrowserCache('products_');
          invalidateBrowserCache('inventory_');
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
    if (!canDeleteProduct) {
      showToast('Bu işlem için "Menüden Ürün Silme" yetkiniz bulunmuyor.', 'error');
      return;
    }
    if (confirm('Bu ürünü menüden silmek istediğinize emin misiniz?')) {
      try {
        await fetch(`/api/products/${id}`, { method: 'DELETE' });
      } catch (e) {}
      dispatch(deleteProduct(id));
      invalidateBrowserCache('products_');
      invalidateBrowserCache('inventory_');
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('sandwich_inventory_updated', String(Date.now()));
        } catch (e) {}
      }
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

  // Yetki Kontrolleri: Süper Yönetici veya ilgili izne sahip personel
  const isSuperAdmin = Boolean(
    adminUser && (
      adminUser.email === 'admin' ||
      adminUser.email === 'admin@sandwichdiyari.com' ||
      adminUser.roleId === 'role_super_admin' ||
      adminUser.role === 'Süper Yönetici'
    )
  );

  const hasPerm = (code) =>
    Boolean(
      isSuperAdmin ||
        (Array.isArray(adminUser?.permissions) && adminUser.permissions.includes(code))
    );

  const canViewRevenue = hasPerm('view_revenue');
  const canAddProduct = hasPerm('product_add');
  const canEditProduct = hasPerm('product_edit');
  const canDeleteProduct = hasPerm('product_delete');
  const canManageOptions = hasPerm('options_manage');
  const canManagePrices = hasPerm('manage_prices');
  const canUpdateStock = hasPerm('stock_update');
  const canDeleteOrder = hasPerm('delete_order');

  const applyPanelOptionsData = (data) => {
    if (!data || typeof data !== 'object') return;
    if (typeof data.menuColaExtraPrice === 'number') {
      const val = normalizeMenuColaExtraPrice(data.menuColaExtraPrice);
      setMenuColaExtraPrice(val);
      setMenuColaPriceInput(String(val));
    }
    if (data.menuDrinkGroups && typeof data.menuDrinkGroups === 'object') {
      setMenuDrinkGroups(normalizeMenuDrinkGroups(data.menuDrinkGroups));
    }
    if (data.productMenuDrinks && typeof data.productMenuDrinks === 'object') {
      setProductMenuDrinks(normalizeProductMenuDrinks(data.productMenuDrinks));
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const cached = getBrowserCache('options_all');
    if (cached?.data) {
      applyPanelOptionsData(cached.data);
    }
    fetchWithBrowserCache('options_all', '/api/options', {
      maxAgeMs: CACHE_TTL_LONG,
      persist: true,
      extract: (json) => json.data,
    })
      .then((res) => {
        if (res?.ok && res.data) applyPanelOptionsData(res.data);
      })
      .catch(() => {});

    const onStorage = (e) => {
      if (e.key === 'sandwich_options_updated') {
        fetchWithBrowserCache('options_all', '/api/options', {
          force: true,
          persist: true,
          extract: (json) => json.data,
        })
          .then((res) => {
            if (res?.ok && res.data) applyPanelOptionsData(res.data);
          })
          .catch(() => {});
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const fresh = getBrowserCache('options_all')?.data;
    if (fresh) {
      applyPanelOptionsData(fresh);
    }
  }, [currentTab, isAddProductOpen]);

  useEffect(() => {
    if (!isAddProductOpen || prodCategory !== 'menu' || prodMenuDrinksCustomized) return;
    const tier = getMenuSizeTier({ name: prodName });
    const tierList = menuDrinkGroups?.[tier] || DEFAULT_MENU_DRINK_GROUPS[tier] || DEFAULT_MENU_DRINK_GROUPS['1'];
    setProdMenuDrinks(tierList.map((d) => ({ ...d })));
  }, [isAddProductOpen, prodCategory, prodName, prodMenuDrinksCustomized, menuDrinkGroups]);

  const handleSaveMenuColaExtraPrice = async (overrideVal) => {
    if (!canManagePrices && !canManageOptions) {
      showToast('Kola farkını değiştirmek için Fiyat Yönetimi veya Sos/Ekstra Yönetimi yetkisi gereklidir.', 'error');
      return;
    }
    const parsed = Number(overrideVal !== undefined ? overrideVal : menuColaPriceInput);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 500) {
      showToast('Lütfen ₺0 ile ₺500 arasında geçerli bir kola farkı girin.', 'error');
      return;
    }
    const cleanPrice = normalizeMenuColaExtraPrice(parsed);
    setSavingColaPrice(true);
    try {
      const res = await fetch('/api/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_menu_cola_price',
          menuColaExtraPrice: cleanPrice,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Kola farkı güncellenemedi.');
      }
      setMenuColaExtraPrice(cleanPrice);
      setMenuColaPriceInput(String(cleanPrice));
      if (json.data) {
        applyPanelOptionsData(json.data);
        setBrowserCache('options_all', json.data, {
          persist: true,
          broadcastKey: 'sandwich_options_updated',
        });
      }
      showToast(
        `Tüm menüler için Kola farkı +₺${cleanPrice.toFixed(2)} olarak güncellendi! (Ayran +₺0.00 dahil)`,
        'success'
      );
    } catch (err) {
      showToast(err.message || 'Kola farkı kaydedilirken hata oluştu.', 'error');
    } finally {
      setSavingColaPrice(false);
    }
  };

  const saveProductCustomDrinks = async (productId, drinksList) => {
    const res = await fetch('/api/options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_product_menu_drinks',
        productId,
        drinks: drinksList,
      }),
    });
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error || 'Menü içecekleri kaydedilemedi.');
    }
    if (json.data) {
      applyPanelOptionsData(json.data);
      setBrowserCache('options_all', json.data, {
        persist: true,
        broadcastKey: 'sandwich_options_updated',
      });
    }
    return json.data;
  };

  const handleAddModalDrink = (customName, customPrice) => {
    if (!canManagePrices && !canManageOptions) {
      showToast('Menü içeceklerini değiştirmek için Fiyat veya Sos/Ekstra Yönetimi yetkisi gereklidir.', 'error');
      return;
    }
    const cleanName = String(customName !== undefined ? customName : newModalDrinkName).trim();
    if (!cleanName) {
      showToast('Lütfen eklenecek içecek adını girin.', 'error');
      return;
    }
    const rawPrice = Number(customPrice !== undefined ? customPrice : newModalDrinkPrice);
    const cleanPrice = Number.isFinite(rawPrice)
      ? Math.round(Math.max(0, Math.min(500, rawPrice)) * 100) / 100
      : 0;
    const exists = prodMenuDrinks.some(
      (d) => (d.name || '').trim().toLocaleLowerCase('tr-TR') === cleanName.toLocaleLowerCase('tr-TR')
    );
    if (exists) {
      showToast(`"${cleanName}" zaten bu menünün içecek listesinde bulunuyor.`, 'error');
      return;
    }
    setProdMenuDrinks((prev) => [
      ...prev,
      {
        id: `md-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: cleanName,
        price: cleanPrice,
        isAvailable: true,
      },
    ]);
    setProdMenuDrinksCustomized(true);
    if (customName === undefined) {
      setNewModalDrinkName('');
      setNewModalDrinkPrice('0');
    }
  };

  const handleUpdateModalDrink = (drinkId, patch) => {
    if (!canManagePrices && !canManageOptions) {
      showToast('Menü içecek fiyatlarını değiştirmek için Fiyat veya Sos/Ekstra Yönetimi yetkisi gereklidir.', 'error');
      return;
    }
    setProdMenuDrinks((prev) =>
      prev.map((d) => {
        if (d.id !== drinkId) return d;
        const next = { ...d, ...patch };
        if (Object.prototype.hasOwnProperty.call(patch, 'price')) {
          const parsed = Number(patch.price);
          next.price = Number.isFinite(parsed)
            ? Math.round(Math.max(0, Math.min(500, parsed)) * 100) / 100
            : 0;
        }
        return next;
      })
    );
    setProdMenuDrinksCustomized(true);
  };

  const handleRemoveModalDrink = (drinkId) => {
    if (!canManagePrices && !canManageOptions) {
      showToast('Menü içeceklerini değiştirmek için Fiyat veya Sos/Ekstra Yönetimi yetkisi gereklidir.', 'error');
      return;
    }
    if (prodMenuDrinks.length <= 1) {
      showToast('Her menüde en az 1 içecek seçeneği kalmalıdır.', 'error');
      return;
    }
    setProdMenuDrinks((prev) => prev.filter((d) => d.id !== drinkId));
    setProdMenuDrinksCustomized(true);
  };

  const handleApplyModalDrinksToTier = async () => {
    if (!canManagePrices && !canManageOptions) {
      showToast('Menü içeceklerini kaydetmek için Fiyat veya Sos/Ekstra Yönetimi yetkisi gereklidir.', 'error');
      return;
    }
    const cleanList = prodMenuDrinks
      .map((d) => ({ ...d, name: String(d.name || '').trim() }))
      .filter((d) => d.name.length > 0);
    if (cleanList.length === 0) {
      showToast('En az 1 geçerli içecek olmalıdır.', 'error');
      return;
    }
    const tier = getMenuSizeTier({ name: prodName });
    setSavingModalDrinks(true);
    try {
      const res = await fetch('/api/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_tier_menu_drinks',
          tier,
          drinks: cleanList,
          clearProductId: editingProduct?.id ?? null,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Menü içecekleri güncellenemedi.');
      }
      if (json.data) {
        applyPanelOptionsData(json.data);
        setBrowserCache('options_all', json.data, {
          persist: true,
          broadcastKey: 'sandwich_options_updated',
        });
      }
      setProdMenuDrinksCustomized(false);
      showToast(`${tier} kişilik tüm menüler için içecekler ve fiyatlar kaydedildi!`, 'success');
    } catch (err) {
      showToast(err.message || 'Menü içecekleri kaydedilirken hata oluştu.', 'error');
    } finally {
      setSavingModalDrinks(false);
    }
  };

  const handleResetModalDrinksToTier = async () => {
    if (!canManagePrices && !canManageOptions) {
      showToast('Yetkiniz bulunmuyor.', 'error');
      return;
    }
    const tier = getMenuSizeTier({ name: prodName });
    if (editingProduct?.id != null && productMenuDrinks?.[String(editingProduct.id)]) {
      setSavingModalDrinks(true);
      try {
        await saveProductCustomDrinks(editingProduct.id, null);
      } catch (err) {
        showToast(err.message || 'Sıfırlama sırasında hata oluştu.', 'error');
        setSavingModalDrinks(false);
        return;
      } finally {
        setSavingModalDrinks(false);
      }
    }
    const baseList = menuDrinkGroups?.[tier] || DEFAULT_MENU_DRINK_GROUPS[tier] || DEFAULT_MENU_DRINK_GROUPS['1'];
    setProdMenuDrinks(baseList.map((d) => ({ ...d })));
    setProdMenuDrinksCustomized(false);
    showToast(`İçecek listesi genel ${tier} kişilik şablona döndürüldü.`, 'info');
  };

  const canEditSiteContent = Boolean(
    adminUser && (
      isSuperAdmin ||
      (Array.isArray(adminUser.permissions) && adminUser.permissions.includes('site_content'))
    )
  );

  // Sekme erişim kontrolü (menüde gizli olan sekme içerikleri de açılamaz)
  const canAccessTab = (tabId) => {
    if (!adminUser) return false;
    if (isSuperAdmin) return true;
    const perms = Array.isArray(adminUser.permissions) ? adminUser.permissions : [];
    if (tabId === 'options') return perms.includes('options') || perms.includes('options_manage');
    if (tabId === 'logs') return perms.includes('settings') || perms.includes('users');
    return perms.includes(tabId);
  };

  useEffect(() => {
    if (!adminUser || isSuperAdmin) return;
    if (!canAccessTab(currentTab)) {
      const order = ['overview', 'orders', 'products', 'options', 'inventory', 'members', 'reviews', 'users', 'logs', 'site_content', 'settings'];
      const firstAllowed = order.find((t) => canAccessTab(t));
      if (firstAllowed && firstAllowed !== currentTab) setCurrentTab(firstAllowed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminUser, currentTab, isSuperAdmin]);

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
  // Kurye modülü kapalıyken kuryeye ait durumlarda kalmış siparişler mutfak sekmesinde görünmeye devam etmeli
  const isKitchenStage = (s) =>
    s === 'Onaylandı' ||
    s === 'Hazırlanıyor' ||
    (!isCourierEnabled && (s === 'Hazır' || s === 'Kurye Teslim Aldı' || s === 'Yolda'));
  const kitchenCount = orders.filter((o) => isKitchenStage(o.status)).length;
  const courierCount = orders.filter((o) => o.status === 'Hazır' || o.status === 'Kurye Teslim Aldı' || o.status === 'Yolda').length;
  const completedCount = orders.filter((o) => o.status === 'Teslim Edildi').length;
  const cancelledCount = orders.filter((o) => o.status === 'İptal Edildi').length;

  // Filtered Orders
  const filteredOrders = orders.filter((o) => {
    // Stage Filter
    let stageMatch = true;
    if (orderStageFilter === 'new') stageMatch = o.status === 'Yeni' || o.status === 'Görüntülendi';
    else if (orderStageFilter === 'kitchen') stageMatch = isKitchenStage(o.status);
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
                <span className="text-[11px] text-amber-700 font-bold block">Restoran Operasyon Paneli (/panel)</span>
              </div>
            </div>
            <p className="text-[11px] text-stone-500 pt-1">
              Mutfak, kasa, sipariş ve stok personeli giriş ekranı
            </p>
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
        className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-stone-200 flex flex-col justify-between transition-all duration-300 ease-in-out overflow-hidden no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden
          ${mobileSidebarOpen ? 'translate-x-0 w-80 max-w-[90vw] shadow-2xl' : '-translate-x-full md:translate-x-0'}
          ${sidebarCollapsed ? 'md:w-20' : 'md:w-80'}
        `}
      >
        <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
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

          {/* Navigation Items (Kategorize Edilmiş Mantıksal Gruplar) */}
          <nav className={`p-3 space-y-3 ${sidebarCollapsed ? 'md:px-2' : ''}`}>
            {[
              {
                category: 'Canlı Operasyon',
                items: [
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
                ],
              },
              {
                category: 'Menü & Mutfak',
                items: [
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
                ],
              },
              {
                category: 'Müşteri & İletişim',
                items: [
                  {
                    id: 'members',
                    label: 'Üye Yönetimi',
                    icon: 'fa-solid fa-users',
                    badge: 'Müşteriler',
                    badgeColor: 'bg-indigo-50 text-indigo-700 font-bold',
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
                ],
              },
              {
                category: 'Yönetim & Sistem',
                items: [
                  {
                    id: 'users',
                    label: 'Kullanıcılar & Roller',
                    icon: 'fa-solid fa-user-shield',
                  },
                  {
                    id: 'logs',
                    label: 'İşlem Logları',
                    icon: 'fa-solid fa-clock-rotate-left',
                    badge: 'Canlı',
                    badgeColor: 'bg-indigo-50 text-indigo-700 font-bold',
                  },
                  {
                    id: 'site_content',
                    label: 'Vitrin & Sayfa Düzeni',
                    icon: 'fa-solid fa-paintbrush',
                  },
                  {
                    id: 'settings',
                    label: 'Sistem Ayarları',
                    icon: 'fa-solid fa-sliders',
                  },
                ],
              },
            ].map((section, sIdx) => {
              // Kullanıcı yetki filtreleme
              const filteredItems = section.items.filter((item) => {
                if (isSuperAdmin) return true;
                if (!adminUser?.permissions || !Array.isArray(adminUser.permissions)) return false;
                if (item.id === 'options') {
                  return adminUser.permissions.includes('options') || adminUser.permissions.includes('options_manage');
                }
                if (item.id === 'logs') {
                  return adminUser.permissions.includes('settings') || adminUser.permissions.includes('users');
                }
                return adminUser.permissions.includes(item.id);
              });

              if (filteredItems.length === 0) return null;

              return (
                <div key={section.category || sIdx} className="space-y-1">
                  {/* Kategori Başlığı */}
                  <div className={`px-2.5 pt-1.5 pb-1 flex items-center justify-between ${sidebarCollapsed ? 'md:hidden' : ''}`}>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 select-none">
                      {section.category}
                    </span>
                  </div>

                  {/* Daraltılmış Sidebar İnce Ayrım Çizgisi */}
                  {sIdx > 0 && sidebarCollapsed && (
                    <div className="hidden md:block my-1.5 mx-2 border-t border-stone-200/70" />
                  )}

                  {/* Menü Elemanları */}
                  <div className="space-y-1">
                    {filteredItems.map((item) => {
                      const active = currentTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setCurrentTab(item.id);
                            setMobileSidebarOpen(false);
                          }}
                          title={item.label}
                          className={`w-full flex items-center ${
                            sidebarCollapsed
                              ? 'md:justify-center md:h-11 md:px-0 justify-between px-3 py-2.5'
                              : 'justify-between px-3 py-2.5'
                          } rounded-xl font-medium transition-all duration-150 cursor-pointer relative group ${
                            active
                              ? 'bg-stone-900 text-white font-semibold shadow-xs'
                              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                          }`}
                        >
                          <div className={`flex items-center ${sidebarCollapsed ? 'md:justify-center gap-2.5' : 'gap-2.5 min-w-0'}`}>
                            <i className={`${item.icon} ${sidebarCollapsed ? 'md:text-base text-sm w-4 text-center' : 'text-sm w-4 text-center'} ${
                              active ? 'text-amber-400' : 'text-stone-500 group-hover:text-stone-800'
                            }`}></i>
                            <span className={`truncate text-xs ${sidebarCollapsed ? 'md:hidden inline' : ''}`}>{item.label}</span>
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
                  </div>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Footer controls */}
        <div className={`p-2.5 pb-4 border-t border-stone-100 space-y-1 ${sidebarCollapsed ? 'md:px-2 md:flex md:flex-col md:items-center' : ''}`}>
          <div className="space-y-1 w-full">
            <div className={`px-2.5 py-1 text-[11px] text-stone-400 truncate ${sidebarCollapsed ? 'md:hidden' : ''}`}>
              <div>
                Yetkili: <strong className="text-stone-700">{adminUser?.name || 'Yönetici'}</strong>
              </div>
              <span className="inline-block mt-0.5 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/70 px-2 py-0.2 rounded-md">
                {adminUser?.role || 'Süper Yönetici'}
              </span>
            </div>
            {(adminUser?.role === 'Süper Yönetici' ||
              canViewRevenue ||
              (Array.isArray(adminUser?.permissions) &&
                (adminUser.permissions.includes('users') || adminUser.permissions.includes('settings')))) && (
              <a
                href="/yonetici"
                onClick={() => setMobileSidebarOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 font-bold transition-colors ${
                  sidebarCollapsed ? 'md:w-10 md:h-10 md:justify-center md:px-0' : ''
                }`}
                title="Yönetici Merkezi (Kasa, Kullanıcılar & Sistem Ayarları)"
              >
                <i className="fa-solid fa-crown text-xs w-4 text-center text-indigo-600"></i>
                <span className={`truncate ${sidebarCollapsed ? 'md:hidden' : ''}`}>Yönetici Merkezi (/yonetici)</span>
              </a>
            )}
            {isCourierEnabled && (
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
            )}
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
          products={products}
          onOpenOrderDetail={handleOpenDetail}
          onAcceptOrder={(id) => handleProgressStatus(id, 'Hazırlanıyor')}
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
              {currentTab === 'logs' && 'Kullanıcı İşlem & Güvenlik Logları'}
              {currentTab === 'site_content' && 'Sayfa Düzenleri & Vitrin Stüdyosu'}
              {currentTab === 'settings' && (
                selectedSettingsSubTab === 'sound' ? 'Sistem Ayarları • Ses & Sipariş Bildirimleri' :
                selectedSettingsSubTab === 'receipt' ? 'Sistem Ayarları • Fiş & Adisyon Baskısı' :
                selectedSettingsSubTab === 'system' ? 'Sistem Ayarları • Yedekleme & Sistem' :
                'Sistem Ayarları • Arayüz & Renk Seçenekleri'
              )}
            </h2>
          </div>

          {/* SAĞ TARAF: MASAÜSTÜ HIZLI ARAÇLAR */}
          <div className="hidden md:flex items-center gap-2 lg:gap-3 shrink-0">
            {/* Operasyon Ticker (Desktop) */}
            <div className="hidden lg:flex items-center gap-6 text-stone-600 text-xs pr-4 border-r border-stone-200">
              <div>
                <span className="text-stone-400 block text-[10px]">Yeni / Bekleyen</span>
                <span className="font-bold text-red-600">{newOrdersCount} Sipariş</span>
              </div>
              <div>
                <span className="text-stone-400 block text-[10px]">{isCourierEnabled ? 'Mutfak / Kurye' : 'Mutfakta'}</span>
                <span className="font-bold text-amber-600">{isCourierEnabled ? `${kitchenCount} / ${courierCount}` : `${kitchenCount} Sipariş`}</span>
              </div>
              <div>
                <span className="text-stone-400 block text-[10px]">Teslim Edilen</span>
                <span className="font-bold text-emerald-700">{completedCount} Adet</span>
              </div>
            </div>

            {/* Live Status Indicator */}
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200/80">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Canlı</span>
            </span>

            {/* Sipariş Alımını Durdur / Aç (Yoğunluk & Mola) */}
            <div className="relative">
              <button
                type="button"
                disabled={pauseSaving}
                onClick={() => (orderPause.paused ? handleSetOrderPause(null) : setPauseMenuOpen((v) => !v))}
                title={orderPause.paused ? 'Sipariş alımını tekrar aç' : 'Sipariş alımını geçici durdur'}
                className={`h-9 px-2.5 rounded-xl border text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs disabled:opacity-60 ${
                  orderPause.paused
                    ? 'bg-rose-600 hover:bg-rose-700 border-rose-700 text-white animate-pulse'
                    : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-800'
                }`}
              >
                <i className={`fa-solid ${orderPause.paused ? 'fa-circle-pause' : 'fa-circle-play text-emerald-600'}`}></i>
                <span>
                  {orderPause.paused
                    ? orderPause.remainingMinutes > 0
                      ? `Durduruldu (${orderPause.remainingMinutes} dk) • Aç`
                      : 'Durduruldu • Aç'
                    : 'Sipariş: Açık'}
                </span>
              </button>

              {pauseMenuOpen && !orderPause.paused && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setPauseMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1.5 z-50 w-56 bg-white border border-stone-200 rounded-2xl shadow-xl p-2 space-y-1">
                    <p className="text-[10px] font-extrabold text-stone-400 uppercase tracking-wider px-2 pt-1 pb-1.5">
                      Sipariş alımını durdur
                    </p>
                    {[
                      { m: 15, label: '15 dakika' },
                      { m: 30, label: '30 dakika' },
                      { m: 60, label: '1 saat' },
                      { m: 0, label: 'Ben açana kadar' }
                    ].map((opt) => (
                      <button
                        key={opt.m}
                        type="button"
                        onClick={() => handleSetOrderPause(opt.m)}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-stone-700 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer flex items-center gap-2"
                      >
                        <i className="fa-solid fa-hourglass-half text-rose-500 text-[11px]"></i>
                        <span>{opt.label}</span>
                      </button>
                    ))}
                    <p className="text-[10px] text-stone-400 px-2 pt-1 leading-snug">
                      Müşteriler bu sürede sipariş veremez; süre bitince otomatik açılır.
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Sound alert switch */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Sesli Uyarı Açık' : 'Sesli Uyarı Kapalı'}
              className={`w-9 h-9 rounded-xl border text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
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
              className="w-9 h-9 text-stone-600 hover:text-stone-900 rounded-xl hover:bg-stone-100 border border-stone-200/80 bg-white transition-colors cursor-pointer flex items-center justify-center shrink-0"
              title="Listeyi Yenile"
            >
              <i className={`fa-solid fa-rotate-right text-xs ${loadingOrders ? 'fa-spin text-amber-500' : ''}`}></i>
            </button>

            {/* Doğrudan Arayüz Renk Paleti Seçici */}
            <ThemeColorPicker
              variant="dropdown"
              onThemeChanged={() => {
                showToast('Arayüz renk teması güncellendi! 🎨', 'success');
              }}
            />

            {/* Sağ Taraf: Sayfa Düzenleri & Vitrin Stüdyosu Açma Butonu */}
            {canEditSiteContent && (
              <button
                type="button"
                onClick={() => setSiteEditorDrawerOpen(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-amber-500 hover:from-brand-700 hover:to-amber-600 text-white font-extrabold text-xs shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-95 shrink-0"
                title="Sayfa Düzenleri & Vitrin Stüdyosunu Sağ Panelde Aç"
              >
                <i className="fa-solid fa-paintbrush text-xs"></i>
                <span>Sayfa Düzenleri</span>
              </button>
            )}
          </div>

          {/* SAĞ TARAF: MOBİL AÇILIR HIZLI ARAÇLAR MENÜSÜ */}
          <div className="md:hidden relative shrink-0">
            <button
              type="button"
              onClick={() => setMobileActionsOpen((v) => !v)}
              className={`h-9 px-3 rounded-xl border text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95 ${
                orderPause.paused
                  ? 'bg-rose-600 border-rose-700 text-white'
                  : mobileActionsOpen
                  ? 'bg-stone-900 border-stone-900 text-white'
                  : 'bg-stone-100 hover:bg-stone-200/80 border-stone-200 text-stone-800'
              }`}
              aria-label="Hızlı Araçlar Menüsü"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  orderPause.paused ? 'bg-white animate-pulse' : 'bg-emerald-500 animate-pulse'
                }`}
              ></span>
              <span>{orderPause.paused ? 'Durduruldu' : 'Araçlar'}</span>
              <i className={`fa-solid fa-chevron-down text-[10px] transition-transform duration-200 ${mobileActionsOpen ? 'rotate-180' : ''}`}></i>
            </button>

            {mobileActionsOpen && (
              <>
                <div className="fixed inset-0 z-40 bg-black/15" onClick={() => setMobileActionsOpen(false)} />
                <div className="absolute right-0 top-full mt-2 z-50 w-72 max-w-[calc(100vw-1.5rem)] bg-white border border-stone-200 rounded-2xl shadow-2xl p-3 space-y-3">
                  {/* 1. Canlı Durum & Yenile */}
                  <div className="flex items-center justify-between pb-2.5 border-b border-stone-100">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200/80">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>Canlı Bağlantı</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        fetchOrders();
                        setMobileActionsOpen(false);
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold cursor-pointer"
                    >
                      <i className={`fa-solid fa-rotate-right text-[11px] ${loadingOrders ? 'fa-spin text-amber-500' : ''}`}></i>
                      <span>Yenile</span>
                    </button>
                  </div>

                  {/* 2. Sipariş Alımı Kontrolü */}
                  <div className="space-y-2 pb-2.5 border-b border-stone-100">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold text-stone-700 flex items-center gap-1.5">
                        <i className={`fa-solid ${orderPause.paused ? 'fa-circle-pause text-rose-500' : 'fa-circle-play text-emerald-600'}`}></i>
                        Sipariş Alımı
                      </span>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${orderPause.paused ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {orderPause.paused
                          ? orderPause.remainingMinutes > 0
                            ? `Durduruldu (${orderPause.remainingMinutes} dk)`
                            : 'Durduruldu'
                          : 'Açık'}
                      </span>
                    </div>

                    {orderPause.paused ? (
                      <button
                        type="button"
                        disabled={pauseSaving}
                        onClick={() => {
                          handleSetOrderPause(null);
                          setMobileActionsOpen(false);
                        }}
                        className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <i className="fa-solid fa-play text-[10px]"></i>
                        <span>Sipariş Alımını Tekrar Aç</span>
                      </button>
                    ) : (
                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          { m: 15, label: '15 dk' },
                          { m: 30, label: '30 dk' },
                          { m: 60, label: '1 sa' },
                          { m: 0, label: 'Süresiz' }
                        ].map((opt) => (
                          <button
                            key={opt.m}
                            type="button"
                            disabled={pauseSaving}
                            onClick={() => {
                              handleSetOrderPause(opt.m);
                              setMobileActionsOpen(false);
                            }}
                            className="py-1.5 px-1 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200/80 text-rose-700 text-[11px] font-bold cursor-pointer text-center"
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 3. Sesli Uyarılar */}
                  <button
                    type="button"
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-stone-50 hover:bg-stone-100 border border-stone-200/70 transition-colors cursor-pointer"
                  >
                    <span className="text-xs font-bold text-stone-700 flex items-center gap-2">
                      <i className={`${soundEnabled ? 'fa-solid fa-volume-high text-amber-600' : 'fa-solid fa-volume-xmark text-stone-400'}`}></i>
                      <span>Sesli Uyarılar</span>
                    </span>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${soundEnabled ? 'bg-amber-100 text-amber-800' : 'bg-stone-200 text-stone-500'}`}>
                      {soundEnabled ? 'Açık' : 'Kapalı'}
                    </span>
                  </button>

                  {/* 4. Arayüz Renk Teması */}
                  <div className="pt-1 pb-1">
                    <ThemeColorPicker
                      variant="inline"
                      onThemeChanged={() => {
                        showToast('Arayüz renk teması güncellendi! 🎨', 'success');
                      }}
                    />
                  </div>

                  {/* 5. Vitrin & Sayfa Düzeni */}
                  {canEditSiteContent && (
                    <button
                      type="button"
                      onClick={() => {
                        setMobileActionsOpen(false);
                        setSiteEditorDrawerOpen(true);
                      }}
                      className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-brand-600 to-amber-500 text-white font-extrabold text-xs shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <i className="fa-solid fa-paintbrush text-xs"></i>
                      <span>Sayfa Düzenleri & Vitrin</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </header>

        {/* MOBİL & TABLET ÖZET BAR (Sadece lg altı ekranlarda görünür) */}
        <div className="lg:hidden bg-white border-b border-stone-200 px-3 py-2 grid grid-cols-3 gap-2 text-center">
          <div className="bg-stone-50 rounded-lg py-1 px-2 border border-stone-100 min-w-0">
            <span className="text-stone-400 block text-[9px] uppercase font-semibold truncate">Yeni Bekleyen</span>
            <span className="font-bold text-red-600 text-[11px] sm:text-xs block truncate">{newOrdersCount} Sipariş</span>
          </div>
          <div className="bg-stone-50 rounded-lg py-1 px-2 border border-stone-100 min-w-0">
            <span className="text-stone-400 block text-[9px] uppercase font-semibold truncate">{isCourierEnabled ? 'Mutfak / Kurye' : 'Mutfakta'}</span>
            <span className="font-bold text-amber-600 text-[11px] sm:text-xs block truncate">{isCourierEnabled ? `${kitchenCount} / ${courierCount}` : `${kitchenCount} Adet`}</span>
          </div>
          <div className="bg-stone-50 rounded-lg py-1 px-2 border border-stone-100 min-w-0">
            <span className="text-stone-400 block text-[9px] uppercase font-semibold truncate">Teslim Edilen</span>
            <span className="font-bold text-emerald-700 text-[11px] sm:text-xs block truncate">{completedCount} Adet</span>
          </div>
        </div>

        {/* TAB 0: GENEL BAKIŞ & İŞLETME PERFORMANSI */}
        {currentTab === 'overview' && (
          <OverviewDashboard
            orders={orders}
            products={products}
            canViewRevenue={canViewRevenue}
            isCourierEnabled={isCourierEnabled}
            onOpenOrderDetail={handleOpenDetail}
            onAcceptOrder={(id) => handleProgressStatus(id, 'Hazırlanıyor')}
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
                  <option value="new">🔔 Yeni ({newOrdersCount})</option>
                  <option value="kitchen">🍳 Hazırlanıyor ({kitchenCount})</option>
                  {isCourierEnabled && <option value="courier">🛵 Kuryede ({courierCount})</option>}
                  <option value="completed">✅ Teslim Edilen ({completedCount})</option>
                  <option value="cancelled">❌ İptal Edilen ({cancelledCount})</option>
                </select>
              </div>

              {/* MASAÜSTÜ: Yatay Buton Sekmeleri */}
              <div className="hidden sm:flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 sm:pb-0">
                {[
                  { id: 'all', label: 'Tüm Siparişler', count: orders.length },
                  { id: 'new', label: '🔔 Yeni', count: newOrdersCount, alert: newOrdersCount > 0 },
                  { id: 'kitchen', label: '🍳 Hazırlanıyor', count: kitchenCount },
                  ...(isCourierEnabled ? [{ id: 'courier', label: '🛵 Kuryede', count: courierCount }] : []),
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
                </div>
              </div>
            </div>

            {/* Orders List */}
            <div className="space-y-2.5">
              {filteredOrders.length === 0 ? (
                <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center text-stone-400 space-y-2">
                  <i className="fa-solid fa-inbox text-4xl text-stone-300"></i>
                  <p className="font-semibold text-stone-600">Seçili filtrelere uygun sipariş bulunamadı.</p>
                </div>
              ) : (
                paginatedOrders.map((order) => {
                  const statusConf = STATUS_CONFIG[order.status] || STATUS_CONFIG['Yeni'];
                  const nextAction = getNextStep(order.status, isCourierEnabled);
                  const isTerminal = order.status === 'Teslim Edildi' || order.status === 'İptal Edildi';
                  const isNewUnviewed = order.status === 'Yeni' && !order.isViewed;

                  const memberPalette = getMemberPalette(order.customerName || order.userEmail || order.userId || order.id);
                  const initials = (order.customerName || 'MŞ')
                    .split(' ')
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((n) => n[0]?.toUpperCase())
                    .join('');

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

                  const isPosPayment =
                    (order.paymentMethod || '').toLowerCase().includes('pos') ||
                    (order.paymentMethod || '').toLowerCase().includes('kart');

                  const rawNotesStr = String(order.notes || order.orderNote || '');
                  const prefersPhoneConfirm = rawNotesStr.includes('TELEFON İLE ARANMAK İSTİYOR');
                  const prefersWhatsappConfirm = rawNotesStr.includes('WHATSAPP İLE ONAY');
                  const cleanCustomerNote = rawNotesStr
                    .replace(/\[ONAY TERCİHİ:[^\]]*\]/gi, '')
                    .trim();

                  return (
                    <div
                      key={order.id}
                      className={`rounded-xl border shadow-2xs hover:shadow-sm transition-all flex flex-row overflow-hidden bg-white ${
                        isNewUnviewed
                          ? 'border-red-500 ring-2 ring-red-400/25 bg-red-50/20'
                          : statusConf.border || 'border-stone-200'
                      }`}
                    >
                      {/* Minimal Sol Renk Şeridi */}
                      <div
                        className={`w-1.5 shrink-0 ${memberPalette.bg}`}
                        title={`Müşteri: ${order.customerName || 'Müşteri'}`}
                      />

                      {/* Kart İçeriği */}
                      <div className="p-2.5 sm:p-3 flex-1 min-w-0 space-y-2">
                        {/* Üst Satır: Kod, Durum, Ödeme, Zaman & Tutar */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-stone-100">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="bg-stone-900 text-white font-mono font-black text-xs px-2 py-0.5 rounded-md tracking-wide">
                              #{order.orderNumber || order.id}
                            </span>

                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${statusConf.bg} ${statusConf.text} ${statusConf.border}`}
                            >
                              <i className={`${statusConf.icon || 'fa-solid fa-circle'} text-[10px]`}></i>
                              <span>{statusConf.label}</span>
                            </span>

                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-bold ${
                                isPosPayment
                                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}
                            >
                              <i className={`fa-solid ${isPosPayment ? 'fa-credit-card' : 'fa-money-bill-wave'} text-[10px]`}></i>
                              <span>{order.paymentMethod || 'Kapıda Nakit'}</span>
                              <span
                                className={`ml-0.5 px-1 rounded text-[9px] font-extrabold uppercase ${
                                  order.paymentStatus === 'Ödendi'
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-stone-200 text-stone-700'
                                }`}
                              >
                                {order.paymentStatus || 'Bekleniyor'}
                              </span>
                            </span>

                            {isNewUnviewed && (
                              <span className="text-[10px] bg-red-600 text-white font-extrabold px-2 py-0.5 rounded-full animate-pulse">
                                YENİ
                              </span>
                            )}

                            {(order.isScheduled || order.scheduledFor) && (
                              <span className="bg-amber-100 text-amber-900 border border-amber-300 font-bold px-2 py-0.5 rounded-md text-[10px] inline-flex items-center gap-1">
                                <i className="fa-solid fa-clock text-amber-700"></i>
                                {order.scheduledFor || '10:00 Açılış'}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 ml-auto">
                            {order.isViewed && order.status !== 'Teslim Edildi' && (
                              <span className="text-[10px] text-stone-400 font-medium hidden sm:inline-flex items-center gap-1">
                                <i className="fa-solid fa-eye"></i>
                                <span>{order.viewedBy ? `${order.viewedBy} gördü` : 'Görüldü'}</span>
                              </span>
                            )}

                            <span className="text-[11px] text-stone-500 font-medium">
                              <i className="fa-regular fa-clock mr-1 text-stone-400"></i>
                              {formatElapsedTime(order.createdAt)}
                            </span>

                            <BlurredAmount
                              canView={canViewRevenue}
                              amount={`₺${Number(order.total || order.subtotal || 0).toFixed(2)}`}
                              className="text-base sm:text-lg font-black text-stone-900 pl-1"
                            />
                          </div>
                        </div>

                        {/* Orta + Sağ Satır: Müşteri, Adres, Ürünler & Aksiyonlar */}
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                          <div className="flex-1 min-w-0 space-y-1.5">
                            {/* Müşteri & Teslimat Tek Satır */}
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                              <div className="inline-flex items-center gap-1.5">
                                <span
                                  className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-[10px] shrink-0 ${memberPalette.avatar}`}
                                >
                                  {initials}
                                </span>
                                <span className="font-bold text-stone-900">{order.customerName}</span>
                              </div>

                              {order.phone && (
                                <a
                                  href={`tel:${order.phone}`}
                                  className="inline-flex items-center gap-1 text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200/70 px-2 py-0.5 rounded-md font-bold text-[11px] transition-colors"
                                  title="Müşteriyi Ara"
                                >
                                  <i className="fa-solid fa-phone text-[9px]"></i>
                                  <span>{order.phone}</span>
                                </a>
                              )}

                              {order.phone && (
                                <a
                                  href={buildWhatsAppOrderConfirmUrl(order)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[11px] transition-colors cursor-pointer ${
                                    prefersWhatsappConfirm
                                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                                      : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                                  }`}
                                  title="WhatsApp ile Sipariş Onay Mesajı Gönder"
                                >
                                  <i className="fa-brands fa-whatsapp text-xs"></i>
                                  <span>{prefersWhatsappConfirm ? 'WhatsApp Onay' : 'WhatsApp'}</span>
                                </a>
                              )}

                              {prefersPhoneConfirm && (
                                <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-md font-bold text-[10px]">
                                  <i className="fa-solid fa-phone-volume text-[9px]"></i>
                                  <span>Aranmak İstiyor</span>
                                </span>
                              )}

                              {order.address && (
                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-stone-600 hover:text-blue-700 text-[11px] font-medium min-w-0 max-w-full"
                                  title={`Haritada Aç: ${order.address}`}
                                >
                                  <i className="fa-solid fa-location-dot text-blue-500 text-[10px] shrink-0"></i>
                                  <span className="truncate max-w-[240px] sm:max-w-md">{order.address}</span>
                                </a>
                              )}

                              {isCourierEnabled && (
                                ['Hazır', 'Kurye Teslim Aldı', 'Yolda', 'Teslim Edildi'].includes(order.status) ? (
                                  <select
                                    value={order.courierName || ''}
                                    onChange={(e) => handleAssignCourier(order.id, e.target.value)}
                                    className={`app-select border rounded-lg px-2 py-0.5 text-[11px] font-bold focus:outline-none cursor-pointer transition-all ${
                                      order.courierName
                                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                                        : 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-700'
                                    }`}
                                  >
                                    <option value="">Kurye Seç</option>
                                    {courierOptions.map((cName) => (
                                      <option key={cName} value={cName}>
                                        🛵 {cName}
                                      </option>
                                    ))}
                                    {order.courierName && !courierOptions.includes(order.courierName) && (
                                      <option value={order.courierName}>🛵 {order.courierName}</option>
                                    )}
                                  </select>
                                ) : (
                                  <span className="text-[10px] font-medium text-stone-400 bg-stone-50 border border-stone-200/80 px-2 py-0.5 rounded-md">
                                    Kurye bekleniyor
                                  </span>
                                )
                              )}
                            </div>

                            {/* Kompakt Sipariş Kalemleri */}
                            <div className="flex flex-wrap items-center gap-1.5">
                              {parsedItems.map((it, itemIdx) => (
                                <span
                                  key={itemIdx}
                                  className="inline-flex items-center gap-1.5 bg-stone-50 border border-stone-200/80 rounded-lg px-2 py-0.5 text-[11px]"
                                >
                                  <span
                                    className={`px-1.5 py-0.2 rounded font-black text-[10px] ${
                                      it.qty > 1
                                        ? 'bg-rose-600 text-white'
                                        : 'bg-brand-500 text-stone-950'
                                    }`}
                                  >
                                    {it.qty}x
                                  </span>
                                  <span className="font-semibold text-stone-900">{it.name}</span>
                                  {it.details && (
                                    <span className="text-[10px] text-stone-500">({it.details})</span>
                                  )}
                                </span>
                              ))}
                            </div>

                            {/* Gerçek Müşteri Notu (Varsa) */}
                            {cleanCustomerNote && (
                              <div className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200/70 rounded-lg px-2.5 py-1 text-[11px] text-amber-900 font-semibold max-w-full">
                                <i className="fa-solid fa-comment-dots text-amber-600 text-[10px] shrink-0"></i>
                                <span className="truncate">{cleanCustomerNote}</span>
                              </div>
                            )}
                          </div>

                          {/* Sağ İşlem Butonları */}
                          <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-stone-100">
                            <button
                              onClick={() => handleOpenDetail(order)}
                              className="bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] px-2.5 py-1.5 rounded-lg font-semibold cursor-pointer flex items-center gap-1 transition-colors"
                              title="Detay & Fiş"
                            >
                              <i className="fa-solid fa-circle-info"></i>
                              <span>Detay</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                printThermalReceipt(order, adminSettings);
                                showToast(`Sipariş #${order.orderNumber || order.id} fişi Xprinter'a gönderildi 🧾`, 'info');
                              }}
                              className="text-stone-600 hover:text-brand-700 text-xs p-1.5 rounded-lg hover:bg-brand-50 border border-stone-200/80 transition-colors cursor-pointer"
                              title="Xprinter 80mm Fiş Yazdır"
                            >
                              <i className="fa-solid fa-print"></i>
                            </button>

                            {!isTerminal && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCancelModalOrder(order);
                                  setCancelReason('Müşteri talebi');
                                }}
                                className="text-stone-400 hover:text-amber-600 text-xs p-1.5 rounded-lg hover:bg-amber-50 border border-stone-200/80 transition-colors cursor-pointer"
                                title="Siparişi İptal Et"
                              >
                                <i className="fa-solid fa-ban"></i>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setDeleteOrderError('');
                                setDeleteAdminPassword('');
                                setDeleteSupervisorEmail('');
                                setDeleteRestoreStock(order.status !== 'İptal Edildi');
                                setDeleteModalOrder(order);
                              }}
                              className="text-stone-400 hover:text-rose-600 text-xs p-1.5 rounded-lg hover:bg-rose-50 border border-stone-200/80 transition-colors cursor-pointer"
                              title="Siparişi Kalıcı Olarak Sil (Yönetici Onaylı)"
                            >
                              <i className="fa-solid fa-trash-can"></i>
                            </button>

                            {nextAction && (
                              <button
                                onClick={() => handleProgressStatus(order.id, nextAction.nextStatus)}
                                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95 ${nextAction.color}`}
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
            canUpdateStock={canUpdateStock}
            onRefreshProducts={() => {
              fetch('/api/products?includeAudio=1')
                .then((r) => r.json())
                .then((j) => {
                  if (j.success && j.data) dispatch(setProducts(j.data));
                });
            }}
          />
        )}

        {/* TAB USERS & ROLES: MÜSTAKİL KULLANICI & ROL YÖNETİMİ */}
        {currentTab === 'users' && (
          <div className="p-3 sm:p-6 lg:p-8 w-full min-w-0">
            <UsersRolesTab adminUser={adminUser} onNotify={showToast} />
          </div>
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
                  onClick={() => {
                    if (!canManageOptions) {
                      showToast('Bu işlem için "Soslar & Ekstralar Yönetimi" yetkiniz bulunmuyor.', 'error');
                      return;
                    }
                    setCurrentTab('options');
                  }}
                  className={`w-full sm:w-auto justify-center border text-xs font-bold px-3.5 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-2xs shrink-0 active:scale-95 transition-all ${
                    canManageOptions
                      ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                      : 'bg-stone-100 text-stone-400 border-stone-200 opacity-75'
                  }`}
                  title="Sosları ve ekstra malzemeleri yönetin"
                >
                  <i className={`fa-solid ${canManageOptions ? 'fa-bottle-droplet text-amber-600' : 'fa-lock text-stone-400'}`}></i>
                  <span>Soslar &amp; Ekstralar</span>
                </button>
                <button
                  onClick={openAddProductModal}
                  className={`w-full sm:w-auto justify-center text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-xs shrink-0 active:scale-95 transition-all ${
                    canAddProduct
                      ? 'bg-brand-600 hover:bg-brand-700 text-white'
                      : 'bg-stone-200 text-stone-500 opacity-80'
                  }`}
                >
                  <i className={`fa-solid ${canAddProduct ? 'fa-plus' : 'fa-lock'}`}></i>
                  <span>Yeni Ürün Ekle</span>
                </button>
              </div>
            </div>

            {/* Menü İçecek Kuralı (Ayran Dahil / Kola Farkı) */}
            <div className="bg-gradient-to-r from-amber-50/90 via-orange-50/60 to-white border border-amber-200/90 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 shadow-2xs">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-7 h-7 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-black">
                    🥤
                  </span>
                  <h4 className="text-xs sm:text-sm font-extrabold text-stone-900">
                    Menü İçecek Fiyat Kuralı (Tüm Menüler İçin Geçerli)
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Ayran: Standart Fiyata Dahil (+₺0)
                  </span>
                </div>
                <p className="text-[11px] text-stone-600 leading-relaxed">
                  Tüm menülerin standart liste fiyatı <strong>Ayran</strong> ile birlikte geçerlidir. Müşteri menüde <strong>Kola</strong> seçerse tüm boyutlarda (1–4 kişilik) şu an{' '}
                  <strong className="text-amber-800">+₺{menuColaExtraPrice.toFixed(2)}</strong> eklenir.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-500">+₺</span>
                  <input
                    type="number"
                    min="0"
                    max="500"
                    step="1"
                    disabled={!canManagePrices && !canManageOptions}
                    value={menuColaPriceInput}
                    onChange={(e) => setMenuColaPriceInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveMenuColaExtraPrice();
                      }
                    }}
                    aria-label="Genel menü kola farkı (TL)"
                    className="w-28 bg-white border border-amber-300 rounded-xl pl-8 pr-2.5 py-2 text-xs sm:text-sm font-extrabold text-stone-900 focus:outline-none focus:border-brand-500 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
                <button
                  type="button"
                  disabled={savingColaPrice || (!canManagePrices && !canManageOptions)}
                  onClick={() => handleSaveMenuColaExtraPrice()}
                  className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer transition-all shadow-2xs active:scale-95 whitespace-nowrap"
                >
                  {savingColaPrice ? 'Kaydediliyor...' : 'Kola Farkını Güncelle'}
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
                        <button
                          type="button"
                          onClick={() => speakProductPreview(p.name, p.audioUrl)}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 cursor-pointer transition-colors ${
                            p.audioUrl
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                              : 'bg-stone-100 text-stone-600 border-stone-200 hover:bg-stone-200'
                          }`}
                          title={p.audioUrl ? 'Özel ürün sesini dinle' : 'Otomatik Türkçe sesli anonsu dinle'}
                        >
                          <i className="fa-solid fa-volume-high text-[9px]"></i>
                          <span>{p.audioUrl ? 'Özel Ses' : 'Sesli Oku'}</span>
                        </button>
                      </div>
                      <span className="text-[11px] text-stone-400 capitalize block truncate mt-0.5">
                        {p.category === 'menu' ? '🍱 Menülü Satış' : '🥪 Bireysel Satış'} &bull;{' '}
                        {p.description}
                      </span>
                      {extractInitialIngredients(p).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {extractInitialIngredients(p).map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-1 bg-stone-100 text-stone-700 border border-stone-200/80 px-2 py-0.5 rounded-md text-[10px] font-semibold"
                            >
                              <i className="fa-solid fa-tag text-[8px] text-brand-500"></i>
                              <span>{tag}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                    {p.category === 'menu' ? (() => {
                      const effectiveDrinks = getEffectiveMenuDrinks(p, menuDrinkGroups, productMenuDrinks);
                      const hasCustomDrinks = Boolean(productMenuDrinks?.[String(p.id)]?.length);
                      return (
                        <div className="text-left sm:text-right mr-2 max-w-[320px]">
                          <div className="flex items-center sm:justify-end gap-1.5">
                            <span className="font-bold text-stone-900 text-sm">₺{p.price.toFixed(2)}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-stone-100 text-stone-600 border border-stone-200">
                              Baz Fiyat
                            </span>
                            {hasCustomDrinks && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                                Özel İçecek
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap sm:justify-end gap-1 mt-1">
                            {effectiveDrinks.map((dr) => {
                              const dPrice = Math.max(0, Number(dr.price) || 0);
                              const extraLabel = Number.isInteger(dPrice) ? dPrice.toFixed(0) : dPrice.toFixed(2);
                              return (
                                <span
                                  key={dr.id || dr.name}
                                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${
                                    dPrice > 0
                                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  }`}
                                >
                                  {dr.name}:{' '}
                                  {dPrice > 0
                                    ? `₺${(Number(p.price) + dPrice).toFixed(2)} (+₺${extraLabel})`
                                    : 'Dahil'}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })() : (
                      <span className="font-bold text-stone-900 text-sm mr-2">₺{p.price.toFixed(2)}</span>
                    )}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openEditProductModal(p)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                          canEditProduct
                            ? 'text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200'
                            : 'text-stone-400 bg-stone-100 opacity-70'
                        }`}
                        title={canEditProduct ? 'Ürünü ve Görselini Düzenle' : 'Menü & Ürün Düzenleme yetkisi gerekli'}
                      >
                        <i className={`fa-solid ${canEditProduct ? 'fa-pen-to-square' : 'fa-lock'} text-[11px]`}></i>
                        <span>Düzenle</span>
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(p.id)}
                        className={`p-2 cursor-pointer transition-colors rounded-lg ${
                          canDeleteProduct
                            ? 'text-stone-400 hover:text-red-600 hover:bg-red-50'
                            : 'text-stone-300 opacity-60'
                        }`}
                        title={canDeleteProduct ? 'Sil' : 'Menüden Ürün Silme yetkisi gerekli'}
                      >
                        <i className={`fa-solid ${canDeleteProduct ? 'fa-trash-can' : 'fa-lock'} text-xs`}></i>
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

        {/* TAB 4: KULLANICI İŞLEM & GÜVENLİK LOGLARI */}
        {currentTab === 'logs' && (
          <div className="p-3 sm:p-6 lg:p-8 w-full min-w-0">
            <ActivityLogsTab showToast={showToast} currentAdmin={adminUser} />
          </div>
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

      {/* MODAL: YENİ ÜRÜN EKLEME / DÜZENLEME (MASAÜSTÜNDE SCROLLSUZ 3 SÜTUN DENGELİ DÜZEN) */}
      {isAddProductOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2 sm:p-3 bg-stone-900/60 backdrop-blur-xs overflow-y-auto lg:overflow-hidden animate-in fade-in duration-150">
          <div
            className={`bg-white rounded-2xl sm:rounded-3xl ${
              prodCategory === 'menu' ? 'max-w-6xl' : 'max-w-5xl'
            } w-full border border-stone-200 shadow-2xl my-auto max-h-[95vh] lg:max-h-none flex flex-col overflow-hidden`}
          >
            {/* Modal Header */}
            <div className="shrink-0 flex justify-between items-center px-4 py-2.5 sm:px-5 sm:py-3 border-b border-stone-150 bg-white z-10">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center text-xs font-bold shrink-0">
                  <i className={editingProduct ? 'fa-solid fa-pen-to-square' : 'fa-solid fa-plus'}></i>
                </div>
                <div className="min-w-0">
                  <h4 className="font-extrabold text-stone-900 text-sm sm:text-base leading-tight truncate">
                    {editingProduct ? 'Ürünü / Görseli Düzenle' : 'Menüye Yeni Ürün Ekle'}
                  </h4>
                  <p className="text-[11px] text-stone-500 truncate">
                    {editingProduct ? `"${editingProduct.name}" düzenleniyor` : 'Ürün bilgilerini, içecekleri, içeriği ve görseli tek ekranda ayarlayın'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddProductOpen(false);
                  resetProductForm();
                }}
                className="text-stone-400 hover:text-stone-700 p-1.5 rounded-xl hover:bg-stone-100 transition-colors cursor-pointer shrink-0"
                title="Kapat"
              >
                <i className="fa-solid fa-xmark text-base"></i>
              </button>
            </div>

            <form onSubmit={handleProductSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto lg:overflow-visible overscroll-contain p-3 sm:p-4 touch-pan-y">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
                  {/* SÜTUN 1: GÖRSEL (ÜSTTE BÜYÜK), TEMEL BİLGİLER, STOK & SES */}
                  <div
                    className={`${
                      prodCategory === 'menu' ? 'lg:col-span-4' : 'lg:col-span-6'
                    } flex flex-col justify-between space-y-2 bg-stone-50/70 p-3 rounded-2xl border border-stone-200/80`}
                  >
                    <div className="space-y-2">
                      {/* Görsel Seçimi (Üstte ve Büyük) */}
                      <div className="space-y-1.5 bg-white p-2.5 rounded-xl border border-stone-200/90">
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-[10px] font-bold text-stone-700 uppercase tracking-wide flex items-center gap-1">
                            <i className="fa-solid fa-image text-brand-600"></i>
                            <span>Ürün Görseli</span>
                          </label>
                          <div className="flex items-center gap-0.5 bg-stone-100 p-0.5 rounded-lg text-[10px]">
                            <button
                              type="button"
                              onClick={() => setImageInputMode('upload')}
                              className={`px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer ${
                                imageInputMode === 'upload'
                                  ? 'bg-white text-stone-900 shadow-2xs'
                                  : 'text-stone-600 hover:text-stone-900'
                              }`}
                            >
                              Yükle
                            </button>
                            <button
                              type="button"
                              onClick={() => setImageInputMode('presets')}
                              className={`px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer ${
                                imageInputMode === 'presets'
                                  ? 'bg-white text-stone-900 shadow-2xs'
                                  : 'text-stone-600 hover:text-stone-900'
                              }`}
                            >
                              Şablon
                            </button>
                            <button
                              type="button"
                              onClick={() => setImageInputMode('url')}
                              className={`px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer ${
                                imageInputMode === 'url'
                                  ? 'bg-white text-stone-900 shadow-2xs'
                                  : 'text-stone-600 hover:text-stone-900'
                              }`}
                            >
                              URL
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="relative w-28 h-28 rounded-2xl overflow-hidden bg-stone-200 border border-stone-300 shadow-sm shrink-0">
                            {isUploadingImage ? (
                              <div className="w-full h-full flex items-center justify-center bg-stone-900/70 text-white">
                                <i className="fa-solid fa-spinner fa-spin text-base text-brand-400"></i>
                              </div>
                            ) : (
                              <img
                                src={prodImageUrl}
                                alt="Seçili Ürün Görseli"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.src = '/images/hero_banner.jpg';
                                }}
                              />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <input
                              type="file"
                              ref={fileInputRef}
                              onChange={handleImageUpload}
                              accept="image/png,image/jpeg,image/webp,image/gif"
                              className="hidden"
                            />
                            {imageInputMode === 'upload' && (
                              <div
                                onClick={() => fileInputRef.current?.click()}
                                className="h-28 border border-dashed border-stone-300 hover:border-brand-400 rounded-xl px-3 flex flex-col items-center justify-center gap-1 text-center cursor-pointer bg-stone-50/70 hover:bg-brand-50/30 transition-all"
                              >
                                <i className="fa-solid fa-cloud-arrow-up text-brand-600 text-base"></i>
                                <p className="text-xs font-bold text-stone-700 leading-tight">
                                  Görsel Seç / Değiştir
                                </p>
                                <span className="text-[10px] text-stone-400 truncate max-w-full">
                                  {selectedFileName || 'PNG, JPG, WEBP'}
                                </span>
                              </div>
                            )}
                            {imageInputMode === 'presets' && (
                              <div className="flex flex-wrap items-center gap-1.5 max-h-28 overflow-y-auto p-1 bg-stone-50 rounded-xl border border-stone-200">
                                {PRODUCT_IMAGE_PRESETS.map((preset, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => {
                                      setProdImageUrl(preset.url);
                                      setSelectedFileName(`${preset.label} (Şablon)`);
                                    }}
                                    className={`p-0.5 rounded-lg border shrink-0 cursor-pointer ${
                                      prodImageUrl === preset.url
                                        ? 'border-brand-500 bg-brand-50'
                                        : 'border-stone-200 bg-white'
                                    }`}
                                    title={preset.label}
                                  >
                                    <img
                                      src={preset.url}
                                      alt={preset.label}
                                      className="w-9 h-9 rounded-md object-cover"
                                    />
                                  </button>
                                ))}
                              </div>
                            )}
                            {imageInputMode === 'url' && (
                              <input
                                type="url"
                                value={prodImageUrl.startsWith('http') ? prodImageUrl : ''}
                                onChange={(e) => {
                                  setProdImageUrl(e.target.value);
                                  setSelectedFileName('Web Bağlantısı (URL)');
                                }}
                                placeholder="https://..."
                                className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-[11px] font-mono focus:outline-none focus:border-brand-500"
                              />
                            )}
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-stone-700 uppercase tracking-wide mb-1">
                          Ürün veya Menü Adı <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={prodName}
                          onChange={(e) => setProdName(e.target.value)}
                          placeholder="Örn: Ateşli Mega Menü"
                          className="w-full bg-white border border-stone-200 rounded-xl px-3 py-1.5 text-xs text-stone-900 focus:outline-none focus:border-brand-500 font-semibold transition-all"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-stone-700 uppercase tracking-wide mb-1">
                            Satış Türü <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={prodCategory}
                            onChange={(e) => setProdCategory(e.target.value)}
                            className="app-select w-full bg-white border border-stone-200 hover:border-brand-400 rounded-xl px-2.5 py-1.5 text-xs text-stone-900 focus:outline-none focus:border-brand-500 font-semibold transition-all cursor-pointer"
                          >
                            <option value="menu">🍱 Menülü</option>
                            <option value="sandwich">🥪 Sandviç</option>
                            <option value="snack">🍟 Atıştırmalık</option>
                            <option value="drink">🥤 İçecek</option>
                          </select>
                        </div>
                        <div>
                          <label
                            className="block text-[10px] font-bold text-stone-700 uppercase tracking-wide mb-1 truncate"
                            title={prodCategory === 'menu' ? 'Ek ücreti +₺0 olan içecekler bu fiyata dahildir' : undefined}
                          >
                            {prodCategory === 'menu' ? 'Baz Fiyat (₺ • +₺0 Dahil)' : 'Fiyat (₺)'}{' '}
                            <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            required
                            disabled={Boolean(editingProduct && !canManagePrices)}
                            value={prodPrice}
                            onChange={(e) => setProdPrice(e.target.value)}
                            placeholder="199.99"
                            className="w-full bg-white border border-stone-200 rounded-xl px-3 py-1.5 text-xs text-stone-900 focus:outline-none focus:border-brand-500 font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-stone-700 uppercase tracking-wide mb-1">
                            Stok
                          </label>
                          <input
                            type="number"
                            min="0"
                            disabled={!canUpdateStock}
                            value={prodStock}
                            onChange={(e) => setProdStock(e.target.value)}
                            placeholder="25"
                            className="w-full bg-white border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs text-stone-900 focus:outline-none focus:border-brand-500 font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-stone-700 uppercase tracking-wide mb-1">
                            Durum
                          </label>
                          <button
                            type="button"
                            disabled={!canUpdateStock}
                            onClick={() => setProdIsAvailable(!prodIsAvailable)}
                            className={`w-full py-1.5 px-2 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                              prodIsAvailable
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : 'bg-rose-50 text-rose-800 border-rose-300'
                            }`}
                          >
                            <i className={`fa-solid ${prodIsAvailable ? 'fa-circle-check text-emerald-600' : 'fa-ban text-rose-600'}`}></i>
                            <span>{prodIsAvailable ? 'Açık' : 'Kapalı'}</span>
                          </button>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-stone-700 uppercase tracking-wide mb-1">
                            Rozet
                          </label>
                          <input
                            type="text"
                            value={prodBadge}
                            onChange={(e) => setProdBadge(e.target.value)}
                            placeholder="Gurme"
                            className="w-full bg-white border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs text-stone-900 focus:outline-none focus:border-brand-500 font-medium transition-all"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-stone-700 uppercase tracking-wide mb-1">
                          Kısa Açıklama (İsteğe Bağlı)
                        </label>
                        <textarea
                          rows={2}
                          value={prodDesc}
                          onChange={(e) => setProdDesc(e.target.value)}
                          placeholder="Özel susamlı sandviç ekmeğinde sıcak servis edilir..."
                          className="w-full bg-white border border-stone-200 rounded-xl px-3 py-1.5 text-xs text-stone-900 focus:outline-none focus:border-brand-500 font-medium transition-all resize-none"
                        />
                      </div>
                    </div>

                    {/* Ürüne Özel Sipariş Sesi */}
                    <div className="bg-white p-2 rounded-xl border border-stone-200/90 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-stone-800 uppercase flex items-center gap-1">
                          <i className="fa-solid fa-volume-high text-indigo-600"></i>
                          <span className="truncate">Sipariş Sesi</span>
                        </span>
                        <span className="text-[10px] text-stone-400 block truncate">
                          {prodAudioUrl ? prodAudioFileName || 'Özel ses aktif' : 'Otomatik Türkçe okuma'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          ref={prodAudioInputRef}
                          type="file"
                          accept="audio/*,.mp3,.wav,.ogg,.m4a"
                          onChange={handleProductAudioSelect}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => speakProductPreview(prodName || 'Örnek Menü', prodAudioUrl)}
                          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                          title="Sesi dinle"
                        >
                          <i className="fa-solid fa-play text-[8px]"></i>
                          <span>Dinle</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => prodAudioInputRef.current?.click()}
                          className="bg-stone-900 hover:bg-black text-white px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                          title="Özel ses (.mp3, .wav) yükle"
                        >
                          <i className="fa-solid fa-upload text-[8px] text-amber-400"></i>
                          <span>{prodAudioUrl ? 'Değiştir' : 'Yükle'}</span>
                        </button>
                        {prodAudioUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              setProdAudioUrl('');
                              setProdAudioFileName('');
                            }}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 p-1 rounded-lg text-[10px] cursor-pointer"
                            title="Özel Sesi Kaldır"
                          >
                            <i className="fa-solid fa-trash-can"></i>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* SÜTUN 2 (ORTA): ÜRÜN İÇERİĞİ (MALZEME ETİKETLERİ) */}
                  <div
                    className={`${
                      prodCategory === 'menu' ? 'lg:col-span-4' : 'lg:col-span-6'
                    } bg-stone-50/80 border border-stone-200 rounded-2xl p-3 flex flex-col justify-between space-y-2.5`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-1">
                        <label className="text-[11px] font-bold text-stone-800 uppercase tracking-wide flex items-center gap-1.5">
                          <i className="fa-solid fa-tags text-brand-600"></i>
                          <span>Ürün İçeriği</span>
                        </label>
                        <span className="text-[10px] text-stone-500 font-medium">
                          Müşteri çıkarabilir
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1 min-h-[48px] p-2 bg-white rounded-xl border border-stone-200">
                        {prodIngredients.length === 0 ? (
                          <span className="text-[11px] text-stone-400 italic px-1">
                            Henüz içerik etiketi eklenmedi...
                          </span>
                        ) : (
                          prodIngredients.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-1 bg-brand-50 text-brand-900 border border-brand-200 px-2 py-0.5 rounded-md text-[11px] font-bold"
                            >
                              <span>{tag}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveIngredientTag(tag)}
                                className="w-3.5 h-3.5 rounded-full bg-brand-200/70 hover:bg-rose-500 hover:text-white text-brand-800 flex items-center justify-center text-[9px] transition-colors cursor-pointer"
                                title="Etiketi Kaldır"
                              >
                                <i className="fa-solid fa-xmark"></i>
                              </button>
                            </span>
                          ))
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={ingredientInput}
                          onChange={(e) => setIngredientInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddIngredientTag();
                            }
                          }}
                          placeholder="Malzeme yazın ve Enter'a basın..."
                          className="flex-1 min-w-0 bg-white border border-stone-200 rounded-xl px-3 py-1.5 text-xs text-stone-900 focus:outline-none focus:border-brand-500 font-semibold"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddIngredientTag()}
                          className="bg-stone-900 hover:bg-black text-white text-[11px] font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
                        >
                          <i className="fa-solid fa-plus text-[9px] text-amber-400"></i>
                          <span>Ekle</span>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1 border-t border-stone-200/70">
                      <span className="text-[10px] font-bold text-stone-400 uppercase block">
                        Hızlı Malzeme Seçimi:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {COMMON_INGREDIENT_TAGS.map((presetTag) => {
                          const isSelected = prodIngredients.some(
                            (t) => t.toLocaleLowerCase('tr-TR') === presetTag.toLocaleLowerCase('tr-TR')
                          );
                          return (
                            <button
                              key={presetTag}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setProdIngredients((prev) =>
                                    prev.filter(
                                      (t) =>
                                        t.toLocaleLowerCase('tr-TR') !==
                                        presetTag.toLocaleLowerCase('tr-TR')
                                    )
                                  );
                                } else {
                                  handleAddIngredientTag(presetTag);
                                }
                              }}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-all cursor-pointer flex items-center gap-1 ${
                                isSelected
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold'
                                  : 'bg-white border-stone-200 text-stone-600 hover:border-brand-300 hover:text-stone-900'
                              }`}
                            >
                              <i
                                className={`fa-solid ${
                                  isSelected ? 'fa-check text-emerald-600' : 'fa-plus text-stone-400'
                                } text-[8px]`}
                              ></i>
                              <span>{presetTag}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* SÜTUN 3 (SAĞ): MENÜ İÇECEK FİYATLANDIRMASI (SADECE MENÜLERDE) */}
                  {prodCategory === 'menu' && (() => {
                    const modalMenuTier = getMenuSizeTier({ name: prodName });
                    const basePriceNum = parseFloat(prodPrice) || 0;
                    const canEditDrinks = canManagePrices || canManageOptions;
                    const existingLower = new Set(
                      prodMenuDrinks.map((d) => String(d.name || '').trim().toLocaleLowerCase('tr-TR'))
                    );
                    const candidateNames = [
                      ...(products || [])
                        .filter((pr) => pr.category === 'drink' && pr.isAvailable !== false)
                        .map((pr) => pr.name),
                      'Ayran',
                      'Kutu Kola',
                      '1 Litre Kola',
                      '2.5 Litre Kola',
                      'Fanta',
                      'Sprite',
                      'Şalgam',
                      'Ice Tea',
                      'Su',
                      'Soda',
                    ];
                    const quickDrinkSuggestions = [];
                    const seenSuggestions = new Set();
                    candidateNames.forEach((rawName) => {
                      const clean = String(rawName || '').trim();
                      const lower = clean.toLocaleLowerCase('tr-TR');
                      if (!clean || existingLower.has(lower) || seenSuggestions.has(lower)) return;
                      seenSuggestions.add(lower);
                      quickDrinkSuggestions.push(clean);
                    });

                    return (
                      <div className="lg:col-span-4 bg-amber-50/70 border border-amber-200 rounded-2xl p-3 flex flex-col justify-between gap-2.5">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-[11px] font-extrabold text-stone-900 truncate">
                                🥤 Menü İçecekleri ({modalMenuTier}K)
                              </span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${
                                  prodMenuDrinksCustomized
                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}
                              >
                                {prodMenuDrinksCustomized ? 'Özel' : `Genel ${modalMenuTier}K`}
                              </span>
                            </div>
                            {prodMenuDrinksCustomized && canEditDrinks && (
                              <button
                                type="button"
                                disabled={savingModalDrinks}
                                onClick={handleResetModalDrinksToTier}
                                className="text-[10px] font-bold text-stone-600 hover:text-stone-900 bg-white border border-stone-200 px-2 py-0.5 rounded-lg cursor-pointer transition-colors shrink-0"
                              >
                                Sıfırla
                              </button>
                            )}
                          </div>

                          {/* İçecek Satırları */}
                          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                            {prodMenuDrinks.map((dr) => {
                              const dPrice = Math.max(0, Number(dr.price) || 0);
                              const isActive = dr.isAvailable !== false;
                              return (
                                <div
                                  key={dr.id || dr.name}
                                  className={`flex items-center gap-1 p-1.5 rounded-xl border transition-colors ${
                                    isActive
                                      ? 'bg-white border-amber-200/80'
                                      : 'bg-stone-100/80 border-stone-200 opacity-75'
                                  }`}
                                >
                                  <button
                                    type="button"
                                    disabled={!canEditDrinks}
                                    onClick={() => handleUpdateModalDrink(dr.id, { isAvailable: !isActive })}
                                    className={`px-1.5 py-1 rounded-md text-[10px] font-bold shrink-0 cursor-pointer border transition-colors ${
                                      isActive
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                        : 'bg-stone-200 text-stone-600 border-stone-300 hover:bg-stone-300'
                                    }`}
                                    title={isActive ? 'Aktif' : 'Pasif'}
                                  >
                                    {isActive ? 'Aktif' : 'Pasif'}
                                  </button>
                                  <input
                                    type="text"
                                    disabled={!canEditDrinks}
                                    value={dr.name}
                                    onChange={(e) => handleUpdateModalDrink(dr.id, { name: e.target.value })}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') e.preventDefault();
                                    }}
                                    placeholder="İçecek"
                                    className="flex-1 min-w-0 bg-stone-50 focus:bg-white border border-stone-200 rounded-md px-2 py-1 text-[11px] font-bold text-stone-900 focus:outline-none focus:border-brand-500 disabled:opacity-60"
                                  />
                                  <div className="relative shrink-0">
                                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-stone-500">
                                      +₺
                                    </span>
                                    <input
                                      type="number"
                                      min="0"
                                      max="500"
                                      step="1"
                                      disabled={!canEditDrinks}
                                      value={dr.price ?? 0}
                                      onChange={(e) => handleUpdateModalDrink(dr.id, { price: e.target.value })}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') e.preventDefault();
                                      }}
                                      aria-label={`${dr.name} ek ücreti`}
                                      className="w-[70px] bg-stone-50 focus:bg-white border border-amber-300 rounded-md pl-6 pr-1.5 py-1 text-[11px] font-extrabold text-stone-900 focus:outline-none focus:border-brand-500 disabled:opacity-60"
                                    />
                                  </div>
                                  <span className="text-[10px] font-extrabold text-stone-700 w-16 text-right shrink-0">
                                    ₺{(basePriceNum + dPrice).toFixed(0)}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={!canEditDrinks}
                                    onClick={() => handleRemoveModalDrink(dr.id)}
                                    className="p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer disabled:opacity-40 shrink-0"
                                    title="Kaldır"
                                  >
                                    <i className="fa-solid fa-trash-can text-[11px]"></i>
                                  </button>
                                </div>
                              );
                            })}
                          </div>

                          {/* Hızlı İçecek Ekleme */}
                          {canEditDrinks && quickDrinkSuggestions.length > 0 && (
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-stone-500 block">Hızlı Ekle:</span>
                              <div className="flex flex-wrap gap-1">
                                {quickDrinkSuggestions.slice(0, 8).map((suggName) => (
                                  <button
                                    key={suggName}
                                    type="button"
                                    onClick={() =>
                                      handleAddModalDrink(
                                        suggName,
                                        /kola|cola/i.test(suggName) ? menuColaExtraPrice : 0
                                      )
                                    }
                                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-white hover:bg-amber-100 text-stone-700 hover:text-amber-900 border border-amber-200 cursor-pointer transition-colors"
                                  >
                                    + {suggName}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="space-y-2 pt-2 border-t border-amber-200/70">
                          {canEditDrinks && (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={newModalDrinkName}
                                onChange={(e) => setNewModalDrinkName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddModalDrink();
                                  }
                                }}
                                placeholder="İçecek adı (Fanta, Şalgam...)"
                                className="flex-1 min-w-0 bg-white border border-stone-200 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-stone-900 focus:outline-none focus:border-brand-500"
                              />
                              <div className="relative shrink-0">
                                <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-stone-500">
                                  +₺
                                </span>
                                <input
                                  type="number"
                                  min="0"
                                  max="500"
                                  step="1"
                                  value={newModalDrinkPrice}
                                  onChange={(e) => setNewModalDrinkPrice(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleAddModalDrink();
                                    }
                                  }}
                                  aria-label="Yeni içecek ek ücreti (TL)"
                                  className="w-[70px] bg-white border border-amber-300 rounded-lg pl-6 pr-1.5 py-1 text-[11px] font-extrabold text-stone-900 focus:outline-none focus:border-brand-500"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => handleAddModalDrink()}
                                className="bg-stone-800 hover:bg-stone-900 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-colors shrink-0"
                              >
                                + Ekle
                              </button>
                            </div>
                          )}

                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] text-stone-500 leading-tight">
                              Kaydedince bu menüye özel olur
                            </span>
                            {canEditDrinks && (
                              <button
                                type="button"
                                disabled={savingModalDrinks}
                                onClick={handleApplyModalDrinksToTier}
                                className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg cursor-pointer transition-all whitespace-nowrap shrink-0"
                              >
                                {savingModalDrinks ? 'Kaydediliyor...' : `Tüm ${modalMenuTier}K Menülere Uygula`}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="shrink-0 flex items-center justify-end gap-2 px-4 py-2.5 sm:px-5 sm:py-3 border-t border-stone-150 bg-stone-50/90 rounded-b-2xl sm:rounded-b-3xl">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddProductOpen(false);
                    resetProductForm();
                  }}
                  className="px-4 py-2 bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={isUploadingImage}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
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
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2.5 sm:p-4 bg-stone-900/50 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-4xl w-full p-4 sm:p-6 border border-stone-200 shadow-2xl space-y-3.5 my-auto max-h-[92vh] overflow-y-auto overscroll-contain">
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
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <p>
                    <strong>Telefon:</strong>{' '}
                    <a href={`tel:${detailOrder.phone}`} className="text-brand-600 underline font-semibold">
                      {detailOrder.phone}
                    </a>
                  </p>
                  {detailOrder.phone && (
                    <a
                      href={buildWhatsAppOrderConfirmUrl(detailOrder)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer shadow-2xs"
                      title="Müşteriye WhatsApp Onay Mesajı Gönder"
                    >
                      <i className="fa-brands fa-whatsapp text-emerald-600 text-sm"></i>
                      <span>WhatsApp'tan Onay İste</span>
                    </a>
                  )}
                </div>
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
            {isCourierEnabled && (
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
                  {['Hazır', 'Kurye Teslim Aldı', 'Yolda', 'Teslim Edildi'].includes(detailOrder.status) ? (
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
                  ) : (
                    <div className="w-full bg-white/80 border border-dashed border-amber-300 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-amber-800 text-center">
                      Kuryeye verildiğinde atama açılır
                    </div>
                  )}
                </div>
              </div>
            )}

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
              const modalNextAction = getNextStep(detailOrder.status, isCourierEnabled);
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
                onClick={() => setReceiptPreviewHtml(generateReceiptHtml(detailOrder, adminSettings))}
                className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 py-3 px-4 rounded-2xl text-xs sm:text-sm font-bold cursor-pointer flex items-center justify-center gap-2 transition-colors active:scale-95 shadow-2xs"
                title="Yazdırmadan önce fiş görünümünü ekranda incele"
              >
                <i className="fa-solid fa-eye text-amber-700"></i>
                <span>Fiş Önizle</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  printThermalReceipt(detailOrder, adminSettings);
                  showToast(`Sipariş #${detailOrder.orderNumber || detailOrder.id} fişi Xprinter yazıcıya gönderildi 🧾`, 'info');
                }}
                className="bg-brand-50 hover:bg-brand-100 text-brand-800 border border-brand-200 py-3 px-5 rounded-2xl text-xs sm:text-sm font-bold cursor-pointer flex items-center justify-center gap-2 transition-colors active:scale-95 shadow-xs"
              >
                <i className="fa-solid fa-print text-brand-600"></i>
                <span>{isCourierEnabled ? 'Mutfak / Kurye Fişi Yazdır (80mm)' : 'Mutfak / Sipariş Fişi Yazdır (80mm)'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDeleteOrderError('');
                  setDeleteAdminPassword('');
                  setDeleteSupervisorEmail('');
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
                    detailOrder.items.flatMap((it, idx) => {
                      const count = Math.max(1, Math.min(100, Math.floor(Number(it.quantity || 1))));
                      const cleanDetails = String(it.details || '')
                        .replace(/\((\d+)\s*adet\)/gi, '($1x)')
                        .replace(/\b(\d+)\s*adet\b/gi, '$1x')
                        .replace(/\badet\b/gi, '')
                        .trim();
                      return Array.from({ length: count }).map((_, copyIdx) => (
                        <tr key={`${idx}_${copyIdx}`} style={{ verticalAlign: 'top', borderBottom: '1px dotted #999' }}>
                          <td style={{ padding: '3px 0' }}>
                            <strong>1x {it.name}</strong>
                            {cleanDetails && (
                              <div style={{ fontSize: '9px' }}>
                                {cleanDetails.split(/\s*\|\s*|\n/).filter(Boolean).map((line, lIdx) => (
                                  <div key={lIdx}>↳ {line}</div>
                                ))}
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', padding: '3px 0', whiteSpace: 'nowrap' }}>
                            ₺{Number(it.price || 0).toFixed(2)}
                          </td>
                        </tr>
                      ));
                    })
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

      {/* MODAL: FİŞ ÖNİZLEME (YAZDIRMADAN ÖNCE EKRANDA GÖR) */}
      {receiptPreviewHtml && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setReceiptPreviewHtml('');
          }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6 bg-stone-900/65 backdrop-blur-xs"
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-4 sm:p-5 border border-stone-200 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-receipt text-amber-600"></i>
                <h4 className="font-extrabold text-stone-900 text-sm">
                  Fiş Önizleme ({adminSettings?.receiptPaperWidth || '80mm'})
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setReceiptPreviewHtml('')}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-xs"></i>
              </button>
            </div>
            <div className="bg-stone-100 rounded-2xl p-3 flex justify-center">
              <div
                className="bg-white shadow-md border border-stone-300 rounded-lg overflow-hidden"
                style={{ width: adminSettings?.receiptPaperWidth === '58mm' ? '260px' : '340px' }}
              >
                <iframe
                  title="Sipariş Fiş Önizleme"
                  srcDoc={receiptPreviewHtml}
                  className="w-full h-[520px] border-0 bg-white"
                />
              </div>
            </div>
            <div className="flex gap-2">
              {detailOrder && (
                <button
                  type="button"
                  onClick={() => {
                    printThermalReceipt(detailOrder, adminSettings);
                    setReceiptPreviewHtml('');
                    showToast(`Sipariş #${detailOrder.orderNumber || detailOrder.id} fişi yazıcıya gönderildi 🧾`, 'info');
                  }}
                  className="flex-1 bg-brand-600 hover:bg-brand-700 text-white py-2.5 rounded-xl text-xs font-extrabold cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <i className="fa-solid fa-print"></i>
                  <span>Yazdır</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setReceiptPreviewHtml('')}
                className="flex-1 bg-stone-900 hover:bg-black text-white py-2.5 rounded-xl text-xs font-extrabold cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SİPARİŞ İPTAL ONAY & GEREKÇE */}
      {cancelModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-stone-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 border border-stone-200 shadow-2xl space-y-4 my-auto max-h-[95vh] overflow-y-auto no-scrollbar">
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

      {/* MODAL: SİPARİŞİ KALICI OLARAK SİL (YETKİ DURUMUNA DUYARLI) */}
      {deleteModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-6 border border-stone-200 shadow-2xl space-y-4 my-auto max-h-[95vh] overflow-y-auto no-scrollbar">
            {/* Modal Üst Başlık & Rozet */}
            <div className="flex items-start gap-3.5">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 shadow-inner ${
                  canDeleteOrder ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-700'
                }`}
              >
                <i className={canDeleteOrder ? 'fa-solid fa-trash-can' : 'fa-solid fa-shield-halved'}></i>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-extrabold text-stone-900 text-base">
                    {canDeleteOrder ? 'Siparişi Kalıcı Olarak Sil' : 'Yönetici / Restoran Müdürü Onayı Gerekli'}
                  </h4>
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      canDeleteOrder
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-amber-100 text-amber-900 border border-amber-300'
                    }`}
                  >
                    {canDeleteOrder ? '✓ Yetkiniz Doğrulandı' : '🔒 Yönetici Onayı Şart'}
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  #{deleteModalOrder.orderNumber || deleteModalOrder.id} numaralı sipariş kaydı veritabanından kalıcı olarak silinecektir.
                </p>
              </div>
            </div>

            {/* Yetki Durumu Bilgi Kartı */}
            {canDeleteOrder ? (
              <div className="bg-emerald-50/80 border border-emerald-200/90 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-emerald-900">
                <i className="fa-solid fa-circle-check text-emerald-600 mt-0.5 shrink-0 text-sm"></i>
                <div className="min-w-0">
                  <span className="font-bold block">
                    Sipariş silme yetkiniz bulunmaktadır ({adminUser?.name || 'Siz'} • {adminUser?.role || 'Yetkili Rol'}).
                  </span>
                  <span className="text-[11px] text-emerald-700 block mt-0.5">
                    Bu işlem geri alınamaz. Siparişi kalıcı olarak kaldırmak için aşağıdaki butona tıklayabilirsiniz.
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-amber-950">
                <i className="fa-solid fa-triangle-exclamation text-amber-600 mt-0.5 shrink-0 text-sm"></i>
                <div className="min-w-0">
                  <span className="font-bold block">
                    Giriş yaptığınız hesapta ({adminUser?.name || 'Mevcut Personel'}) sipariş silme yetkisi bulunmuyor.
                  </span>
                  <span className="text-[11px] text-amber-800 block mt-0.5">
                    Siparişin silinebilmesi için bir <strong>Restoran Müdürü</strong> veya <strong>Süper Yönetici</strong> onay şifresi gereklidir. Rastgele veya hatalı şifrelerle silme işlemi yapılamaz.
                  </span>
                </div>
              </div>
            )}

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
            <label className="flex items-center gap-2.5 text-xs text-stone-700 cursor-pointer select-none bg-stone-50 p-2.5 rounded-xl border border-stone-200">
              <input
                type="checkbox"
                checked={deleteRestoreStock}
                onChange={(e) => setDeleteRestoreStock(e.target.checked)}
                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-stone-300 cursor-pointer"
              />
              <span className="font-medium text-stone-800">
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
              {!canDeleteOrder && (
                <div className="space-y-3 bg-stone-50/80 p-3.5 rounded-2xl border border-stone-200">
                  {/* Yönetici Seçimi */}
                  {supervisors.length > 0 && (
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        Onay Verecek Restoran Müdürü / Yönetici
                      </label>
                      <select
                        value={deleteSupervisorEmail}
                        onChange={(e) => setDeleteSupervisorEmail(e.target.value)}
                        className="app-select w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs font-semibold text-stone-900 focus:outline-none focus:border-amber-500 cursor-pointer"
                      >
                        <option value="">Tüm Yetkili Yöneticiler (Herhangi biri onaylayabilir)</option>
                        {supervisors.map((s) => (
                          <option key={s.id || s.email} value={s.email}>
                            {s.name} ({s.roleName})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Yönetici Şifresi */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Yönetici Onay Şifresi <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="password"
                      required
                      autoFocus
                      value={deleteAdminPassword}
                      onChange={(e) => setDeleteAdminPassword(e.target.value)}
                      placeholder="Müdür / Yönetici şifresini giriniz..."
                      className="w-full bg-white border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs text-stone-900 focus:outline-none focus:border-amber-500 font-medium transition-all"
                    />
                    <span className="text-[11px] text-stone-400 mt-1 block">
                      Yalnızca sipariş silme yetkisine sahip aktif yöneticilerin şifresi kabul edilir.
                    </span>
                  </div>
                </div>
              )}

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={isDeletingOrder}
                  onClick={() => {
                    setDeleteModalOrder(null);
                    setDeleteAdminPassword('');
                    setDeleteSupervisorEmail('');
                    setDeleteOrderError('');
                  }}
                  className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-700 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={isDeletingOrder || (!canDeleteOrder && !deleteAdminPassword.trim())}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:bg-stone-300 disabled:cursor-not-allowed text-white py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-2 shadow-md shadow-rose-600/20 active:scale-95"
                >
                  {isDeletingOrder ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i>
                      <span>Siliniyor...</span>
                    </>
                  ) : canDeleteOrder ? (
                    <>
                      <i className="fa-solid fa-trash-can"></i>
                      <span>Evet, Siparişi Sil</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-shield-halved"></i>
                      <span>Yönetici Onayıyla Sil</span>
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
