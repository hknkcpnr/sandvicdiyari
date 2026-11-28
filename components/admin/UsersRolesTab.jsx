'use client';

import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { showMessageModal } from '@/store/slices/uiSlice';
import { formatTurkishPhoneInput } from '@/lib/phoneUtils';
import {
  fetchAdminUsersCached,
  getCachedAdminUsersData,
  setCachedAdminUsersData,
  invalidateAdminUsersCache,
  isAdminUsersCacheStale,
  DEFAULT_STALE_MS,
  FOCUS_STALE_MS
} from '@/lib/adminUsersCache';

// Sistemde kategorize edilmiş tüm yetki modülleri
export const PERMISSION_GROUPS = [
  {
    title: 'Sipariş & Canlı Operasyon',
    icon: 'fa-solid fa-list-check text-amber-500',
    perms: [
      { id: 'overview', label: 'Genel Bakış Sayfası', icon: 'fa-solid fa-chart-pie', desc: 'Operasyon özeti ve sipariş yoğunluk paneli' },
      { id: 'orders', label: 'Sipariş Yönetimi', icon: 'fa-solid fa-list-check', desc: 'Sipariş onaylama, durum ilerletme, kurye atama ve fiş yazdırma' },
      { id: 'delete_order', label: 'Sipariş Silme & İptal', icon: 'fa-solid fa-trash-can', desc: 'Siparişleri iptal etme ve kalıcı silme yetkisi' },
    ]
  },
  {
    title: 'Menü, Ürünler & Soslar',
    icon: 'fa-solid fa-burger text-rose-500',
    perms: [
      { id: 'products', label: 'Menü & Ürünler Sayfası', icon: 'fa-solid fa-burger', desc: 'Menü ve ürün listesini görüntüleme yetkisi' },
      { id: 'product_add', label: 'Menüye Ürün Ekleme', icon: 'fa-solid fa-circle-plus', desc: 'Menüye yeni sandviç, menü veya içecek ekleme yetkisi' },
      { id: 'product_edit', label: 'Menü & Ürün Düzenleme', icon: 'fa-solid fa-pen-to-square', desc: 'Mevcut ürünlerin adını, açıklamasını ve görselini düzenleme yetkisi' },
      { id: 'product_delete', label: 'Menüden Ürün Silme', icon: 'fa-solid fa-trash', desc: 'Menüdeki ürünleri kalıcı olarak kaldırma yetkisi' },
      { id: 'options_manage', label: 'Soslar & Ekstralar Yönetimi', icon: 'fa-solid fa-bottle-droplet', desc: 'Sos ve ekstra malzeme ekleme, düzenleme ve silme yetkisi' },
      { id: 'manage_prices', label: 'Fiyat Güncelleme', icon: 'fa-solid fa-tags', desc: 'Ürün ve ekstra malzeme fiyatlarını değiştirme yetkisi' },
    ]
  },
  {
    title: 'Stok & Envanter',
    icon: 'fa-solid fa-boxes-stacked text-emerald-500',
    perms: [
      { id: 'inventory', label: 'Stok Yönetimi Sayfası', icon: 'fa-solid fa-boxes-stacked', desc: 'Ürün stok tablosunu görüntüleme yetkisi' },
      { id: 'stock_update', label: 'Stok Değişimi & Satış Aç/Kapa', icon: 'fa-solid fa-arrows-rotate', desc: 'Stok adetlerini artırma/azaltma ve ürünü satışa açıp kapatma yetkisi' },
    ]
  },
  {
    title: 'Müşteri, Yorumlar & Vitrin',
    icon: 'fa-solid fa-users text-indigo-500',
    perms: [
      { id: 'members', label: 'Üye Yönetimi', icon: 'fa-solid fa-users', desc: 'Kayıtlı müşteriler, onaylama, engelleme ve bildirimler' },
      { id: 'reviews', label: 'Geri Bildirimler & Yorumlar', icon: 'fa-regular fa-star', desc: 'Müşteri yorumlarını inceleme ve onaylama' },
      { id: 'site_content', label: 'Müşteri Sayfası Tasarım & İçerik', icon: 'fa-solid fa-paintbrush', desc: 'Vitrin başlıkları, banner, görseller ve kampanya bölümlerini düzenleme' },
    ]
  },
  {
    title: 'Yönetim, Finans & Kurye',
    icon: 'fa-solid fa-crown text-purple-500',
    perms: [
      { id: 'view_revenue', label: 'Ciro & Kasa Yönetimi (/yonetici)', icon: 'fa-solid fa-coins', desc: 'Ciro, kasa giriş-çıkış ve finansal tutarları görme yetkisi' },
      { id: 'users', label: 'Kullanıcı & Rol Yönetimi', icon: 'fa-solid fa-user-shield', desc: 'Personel ve yetki modelleri yönetimi' },
      { id: 'settings', label: 'Sistem & Panel Ayarları', icon: 'fa-solid fa-sliders', desc: 'Arayüz, ses, fiş baskı ve sistem ayarları' },
      { id: 'courier_delivery', label: 'Kurye Portalı & Teslimat (/kurye)', icon: 'fa-solid fa-motorcycle', desc: 'Kurye teslimat portalına giriş ve paket teslimat yetkisi' },
    ]
  }
];

export const AVAILABLE_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.perms);

const ROLE_COLORS = {
  rose: { label: 'Kırmızı', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' },
  indigo: { label: 'İndigo', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500' },
  amber: { label: 'Kehribar', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', dot: 'bg-amber-500' },
  emerald: { label: 'Yeşil', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  blue: { label: 'Mavi', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  sky: { label: 'Açık Mavi', bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', dot: 'bg-sky-500' },
  purple: { label: 'Mor', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500' },
};

/**
 * ============================================================================
 * UsersRolesTab: Sadeleştirilmiş Kullanıcı ve Rol Modelleri Yönetimi
 * ============================================================================
 */
export default function UsersRolesTab({ currentAdmin, onRolesOrUsersUpdated }) {
  const dispatch = useDispatch();
  const initialCached = getCachedAdminUsersData();
  const hasFullCache = Boolean(
    initialCached?.loadedScopes?.staff && initialCached?.loadedScopes?.customers
  );
  const [subTab, setSubTab] = useState('panel'); // 'panel' | 'kurye' | 'yonetici' | 'customers' | 'roles'
  const [adminUsers, setAdminUsers] = useState(
    Array.isArray(initialCached?.adminUsers) ? initialCached.adminUsers : []
  );
  const [roles, setRoles] = useState(
    Array.isArray(initialCached?.roles) ? initialCached.roles : []
  );
  const [customers, setCustomers] = useState(
    Array.isArray(initialCached?.customers) ? initialCached.customers : []
  );
  const [loading, setLoading] = useState(!hasFullCache);
  const [searchQuery, setSearchQuery] = useState('');

  // Kullanıcı Modal Durumları
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userPortalTarget, setUserPortalTarget] = useState('panel'); // 'panel' | 'kurye' | 'yonetici'
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userPass, setUserPass] = useState('');
  const [userRoleId, setUserRoleId] = useState('');
  const [userIsActive, setUserIsActive] = useState(true);
  const [userFormError, setUserFormError] = useState('');

  // Rol Modal Durumları
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleName, setRoleName] = useState('');
  const [roleColor, setRoleColor] = useState('blue');
  const [roleDesc, setRoleDesc] = useState('');
  const [rolePermissions, setRolePermissions] = useState(['orders', 'inventory']);
  const [roleFormError, setRoleFormError] = useState('');

  // Müşteri Ekle / Düzenle Modal Durumları
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [custName, setCustName] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custPass, setCustPass] = useState('');
  const [custVerified, setCustVerified] = useState(true);
  const [custFormError, setCustFormError] = useState('');
  const [approvingCustId, setApprovingCustId] = useState(null);
  const [courierModuleEnabled, setCourierModuleEnabled] = useState(false);

  useEffect(() => {
    try {
      const rawAdmin = localStorage.getItem('sandwich_admin_settings');
      if (rawAdmin) {
        const parsed = JSON.parse(rawAdmin);
        if (typeof parsed?.courierModuleEnabled === 'boolean') {
          setCourierModuleEnabled(parsed.courierModuleEnabled);
        }
      }
      const sdCourier = localStorage.getItem('sd_courier_module_enabled');
      if (sdCourier !== null) {
        setCourierModuleEnabled(sdCourier === 'true');
      }
    } catch {}

    const handleStorageChange = () => {
      try {
        const rawAdmin = localStorage.getItem('sandwich_admin_settings');
        if (rawAdmin) {
          const parsed = JSON.parse(rawAdmin);
          if (typeof parsed?.courierModuleEnabled === 'boolean') {
            setCourierModuleEnabled(parsed.courierModuleEnabled);
          }
        }
        const sdCourier = localStorage.getItem('sd_courier_module_enabled');
        if (sdCourier !== null) {
          setCourierModuleEnabled(sdCourier === 'true');
        }
      } catch {}
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('sd_courier_module_updated', handleStorageChange);

    fetch('/api/admin/settings', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (j?.success && j?.data) {
          setCourierModuleEnabled(j.data.courierModuleEnabled === true);
        }
      })
      .catch(() => {});

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('sd_courier_module_updated', handleStorageChange);
    };
  }, []);

  // Helper: Bir personelin veya rolün hangi panele (/yonetici, /panel, /kurye) ait olduğunu belirle
  const getPortalForRoleOrUser = (roleId, roleName = '', roleCode = '') => {
    const rId = String(roleId || '');
    const rName = String(roleName || '').toLowerCase();
    const rCode = String(roleCode || '').toLowerCase();
    if (rId === 'role_super_admin' || rCode === 'super_admin' || rName === 'süper yönetici') return 'yonetici';
    if (rId === 'role_courier' || rCode === 'courier' || rName.includes('kurye')) return 'kurye';
    return 'panel';
  };

  const getDefaultRoleIdForPortal = (portalKey, rolesList = roles) => {
    if (portalKey === 'yonetici') {
      return rolesList.find((r) => r.id === 'role_super_admin' || r.code === 'super_admin')?.id || 'role_super_admin';
    }
    if (portalKey === 'kurye') {
      return (
        rolesList.find(
          (r) => r.id === 'role_courier' || r.code === 'courier' || String(r.name || '').toLowerCase().includes('kurye')
        )?.id || 'role_courier'
      );
    }
    const panelRole = rolesList.find(
      (r) => getPortalForRoleOrUser(r.id, r.name, r.code) === 'panel'
    );
    return panelRole?.id || 'role_cashier';
  };

  useEffect(() => {
    if (!courierModuleEnabled && subTab === 'kurye') {
      setSubTab('panel');
    }
    if (!courierModuleEnabled && userPortalTarget === 'kurye') {
      setUserPortalTarget('panel');
      setUserRoleId(getDefaultRoleIdForPortal('panel'));
    }
  }, [courierModuleEnabled, subTab, userPortalTarget]);

  const notifyUsersChanged = (data) => {
    try {
      localStorage.setItem('sandwich_users_updated', String(Date.now()));
      window.dispatchEvent(new CustomEvent('sandwich_users_updated', { detail: data }));
    } catch (e) {}
  };

  // API'den verileri getir (tarayıcı önbelleği tazeyse DB'ye gitmez, bayatladıysa sessiz yeniler)
  const fetchData = async (force = false, { silent = false } = {}) => {
    const cached = getCachedAdminUsersData();
    const hasFullCache = Boolean(
      cached?.loadedScopes?.staff &&
        cached?.loadedScopes?.customers &&
        Array.isArray(cached.adminUsers) &&
        Array.isArray(cached.roles) &&
        Array.isArray(cached.customers)
    );

    if (!force && hasFullCache && !isAdminUsersCacheStale('all', DEFAULT_STALE_MS)) {
      setAdminUsers(cached.adminUsers);
      setRoles(cached.roles);
      setCustomers(cached.customers);
      if (!userRoleId && cached.roles.length > 0) {
        setUserRoleId(getDefaultRoleIdForPortal(userPortalTarget, cached.roles));
      }
      setLoading(false);
      return;
    }

    if (!silent) {
      setLoading(true);
    }
    try {
      const json = await fetchAdminUsersCached({
        force: force === true,
        scope: 'all',
        maxAgeMs: force ? null : DEFAULT_STALE_MS
      });
      if (json.success && json.data) {
        setAdminUsers(json.data.adminUsers || []);
        setRoles(json.data.roles || []);
        setCustomers(json.data.customers || []);
        if (!userRoleId && json.data.roles?.length > 0) {
          setUserRoleId(getDefaultRoleIdForPortal(userPortalTarget, json.data.roles));
        }
      }
    } catch (err) {
      console.error('Kullanıcı ve rol verileri alınamadı:', err);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const cached = getCachedAdminUsersData();
    const hasFullCache = Boolean(
      cached?.loadedScopes?.staff &&
        cached?.loadedScopes?.customers &&
        Array.isArray(cached.adminUsers) &&
        Array.isArray(cached.roles) &&
        Array.isArray(cached.customers)
    );

    if (hasFullCache) {
      setAdminUsers(cached.adminUsers);
      setRoles(cached.roles);
      setCustomers(cached.customers);
      if (!userRoleId && cached.roles.length > 0) {
        setUserRoleId(getDefaultRoleIdForPortal(userPortalTarget, cached.roles));
      }
      setLoading(false);
      if (isAdminUsersCacheStale('all', DEFAULT_STALE_MS)) {
        fetchData(true, { silent: true });
      }
    } else {
      fetchData(false);
    }

    const handleUsersUpdated = (e) => {
      const detail = e?.detail;
      if (!detail || typeof detail !== 'object') return;
      if (Array.isArray(detail.adminUsers)) setAdminUsers(detail.adminUsers);
      if (Array.isArray(detail.roles)) setRoles(detail.roles);
      if (Array.isArray(detail.customers)) setCustomers(detail.customers);
      setLoading(false);
    };
    const handleStorage = (e) => {
      if (e.key === 'sandwich_users_updated') {
        invalidateAdminUsersCache();
        fetchData(true, { silent: true });
      }
    };
    const handleFocusOrVisible = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (isAdminUsersCacheStale('all', FOCUS_STALE_MS)) {
        fetchData(true, { silent: true });
      }
    };

    window.addEventListener('sandwich_users_updated', handleUsersUpdated);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);
    return () => {
      window.removeEventListener('sandwich_users_updated', handleUsersUpdated);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
    };
  }, []);

  // Kullanıcı Modalı Açma (Seçili panele göre otomatik rol atar)
  const handleOpenAddUser = (targetPortal = 'panel') => {
    const portalKey = ['panel', 'kurye', 'yonetici'].includes(targetPortal) ? targetPortal : 'panel';
    setEditingUser(null);
    setUserPortalTarget(portalKey);
    setUserName('');
    setUserEmail('');
    setUserPhone('');
    setUserPass('');
    setUserRoleId(getDefaultRoleIdForPortal(portalKey));
    setUserIsActive(true);
    setUserFormError('');
    setIsUserModalOpen(true);
  };

  const handleOpenEditUser = (user) => {
    const detectedPortal = getPortalForRoleOrUser(user.roleId, user.roleName || user.role);
    setEditingUser(user);
    setUserPortalTarget(detectedPortal);
    setUserName(user.name || '');
    setUserEmail(user.email || '');
    setUserPhone(user.phone || '');
    setUserPass('');
    setUserRoleId(user.roleId || getDefaultRoleIdForPortal(detectedPortal));
    setUserIsActive(user.isActive !== false);
    setUserFormError('');
    setIsUserModalOpen(true);
  };

  // Korunan Ana Süper Yönetici Kontrolü
  const isProtectedAdmin = (user) => {
    const email = String(user?.email || '').toLowerCase();
    return email === 'admin' || email === 'admin@sandwichdiyari.com';
  };

  // Kullanıcı Kaydet
  const handleSaveUser = async (e) => {
    e.preventDefault();
    setUserFormError('');

    if (!userName.trim() || !userEmail.trim()) {
      setUserFormError('Ad Soyad ve E-Posta / Kullanıcı Adı zorunludur.');
      return;
    }
    if (!editingUser && !userPass.trim()) {
      setUserFormError('Yeni kullanıcı için giriş şifresi belirlemelisiniz.');
      return;
    }

    try {
      const selectedRoleObj = roles.find((r) => String(r.id) === String(userRoleId));
      const isRoleMatchingPortal = selectedRoleObj
        ? getPortalForRoleOrUser(selectedRoleObj.id, selectedRoleObj.name, selectedRoleObj.code) === userPortalTarget
        : Boolean(userRoleId) && getPortalForRoleOrUser(userRoleId) === userPortalTarget;
      const effectiveRoleId = isRoleMatchingPortal
        ? userRoleId
        : getDefaultRoleIdForPortal(userPortalTarget);

      const payload = {
        entityType: 'user',
        id: editingUser?.id,
        name: userName.trim(),
        email: userEmail.trim(),
        phone: userPhone.trim(),
        portalTarget: userPortalTarget,
        roleId: effectiveRoleId,
        isActive: userIsActive,
        ...(userPass.trim() ? { pass: userPass.trim() } : {}),
      };

      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) {
        setUserFormError(json.error || 'Kullanıcı kaydedilemedi.');
        return;
      }

      setAdminUsers(json.data.adminUsers || []);
      setRoles(json.data.roles || []);
      setIsUserModalOpen(false);
      if (['panel', 'kurye', 'yonetici'].includes(userPortalTarget)) {
        setSubTab(userPortalTarget);
      }
      const mergedCache = setCachedAdminUsersData(json.data, { broadcast: true });
      if (onRolesOrUsersUpdated) onRolesOrUsersUpdated(mergedCache);

      dispatch(
        showMessageModal({
          title: editingUser ? 'Kullanıcı Güncellendi' : 'Yeni Kullanıcı Eklendi',
          text: `${userName} başarıyla kaydedildi.`,
          type: 'success',
        })
      );
    } catch (err) {
      setUserFormError('Sunucu bağlantı hatası oluştu.');
    }
  };

  // Kullanıcı Aktif/Pasif Değiştir
  const handleToggleUserStatus = async (user) => {
    if (isProtectedAdmin(user)) {
      alert('Ana Süper Yönetici hesabı pasife alınamaz.');
      return;
    }
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'user',
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          roleId: user.roleId,
          isActive: !(user.isActive !== false),
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setAdminUsers(json.data.adminUsers || []);
        const mergedCache = setCachedAdminUsersData(json.data, { broadcast: true });
        if (onRolesOrUsersUpdated) onRolesOrUsersUpdated(mergedCache);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Kullanıcı Sil
  const handleDeleteUser = async (user) => {
    if (isProtectedAdmin(user)) {
      alert('Ana Süper Yönetici hesabı silinemez.');
      return;
    }
    if (!confirm(`"${user.name}" adlı kullanıcıyı silmek istediğinize emin misiniz?`)) return;

    try {
      const res = await fetch(`/api/admin/users?type=user&id=${encodeURIComponent(user.id)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        setAdminUsers(json.data.adminUsers || []);
        const mergedCache = setCachedAdminUsersData(json.data, { broadcast: true });
        if (onRolesOrUsersUpdated) onRolesOrUsersUpdated(mergedCache);
        dispatch(
          showMessageModal({
            title: 'Kullanıcı Silindi',
            text: `${user.name} sistemden kaldırıldı.`,
            type: 'info',
          })
        );
      } else {
        alert(json.error || 'Silinemedi.');
      }
    } catch (err) {
      alert('Bağlantı hatası oluştu.');
    }
  };

  // Rol Modal Açma
  const handleOpenAddRole = () => {
    setEditingRole(null);
    setRoleName('');
    setRoleColor('blue');
    setRoleDesc('');
    setRolePermissions(['orders', 'inventory']);
    setRoleFormError('');
    setIsRoleModalOpen(true);
  };

  const handleOpenEditRole = (role) => {
    setEditingRole(role);
    setRoleName(role.name || '');
    setRoleColor(role.color || 'blue');
    setRoleDesc(role.description || '');
    setRolePermissions(Array.isArray(role.permissions) ? role.permissions : ['orders']);
    setRoleFormError('');
    setIsRoleModalOpen(true);
  };

  const togglePermission = (permId) => {
    setRolePermissions((prev) => {
      const exists = prev.includes(permId);
      if (exists) {
        return prev.filter((p) => p !== permId);
      } else {
        const next = [...prev, permId];
        if (['product_add', 'product_edit', 'product_delete', 'manage_prices', 'options_manage'].includes(permId)) {
          if (!next.includes('products')) next.push('products');
        }
        if (permId === 'options_manage' && !next.includes('options')) {
          next.push('options');
        }
        if (permId === 'stock_update' && !next.includes('inventory')) {
          next.push('inventory');
        }
        if (permId === 'delete_order' && !next.includes('orders')) {
          next.push('orders');
        }
        return next;
      }
    });
  };

  const toggleGroupPermissions = (groupPermIds) => {
    setRolePermissions((prev) => {
      const allSelected = groupPermIds.every((id) => prev.includes(id));
      if (allSelected) {
        return prev.filter((id) => !groupPermIds.includes(id));
      } else {
        const merged = Array.from(new Set([...prev, ...groupPermIds]));
        if (groupPermIds.includes('options_manage') && !merged.includes('options')) {
          merged.push('options');
        }
        return merged;
      }
    });
  };

  // Rol Kaydet (Yeni veya Düzenleme)
  const handleSaveRole = async (e) => {
    e.preventDefault();
    setRoleFormError('');

    if (!roleName.trim()) {
      setRoleFormError('Lütfen rol adı giriniz.');
      return;
    }
    if (rolePermissions.length === 0) {
      setRoleFormError('En az 1 modül yetkisi seçmelisiniz.');
      return;
    }

    try {
      // Permission senkronizasyonu: options ve options_manage uyumluluğu
      const cleanPerms = Array.from(new Set([
        ...rolePermissions,
        ...(rolePermissions.includes('options_manage') ? ['options'] : []),
        ...(rolePermissions.includes('options') ? ['options_manage'] : [])
      ]));

      // Alt yetki seçildiyse ana sayfa görünürlük yetkilerini de otomatik tamamla
      if (
        (cleanPerms.includes('product_add') || cleanPerms.includes('product_edit') || cleanPerms.includes('product_delete') || cleanPerms.includes('manage_prices')) &&
        !cleanPerms.includes('products')
      ) {
        cleanPerms.push('products');
      }
      if (cleanPerms.includes('stock_update') && !cleanPerms.includes('inventory')) {
        cleanPerms.push('inventory');
      }
      if (cleanPerms.includes('delete_order') && !cleanPerms.includes('orders')) {
        cleanPerms.push('orders');
      }

      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'role',
          id: editingRole?.id,
          name: roleName.trim(),
          color: roleColor,
          description: roleDesc.trim(),
          permissions: cleanPerms,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setRoleFormError(json.error || 'Rol kaydedilemedi.');
        return;
      }

      setRoles(json.data.roles || []);
      setAdminUsers(json.data.adminUsers || []);
      setIsRoleModalOpen(false);
      const mergedCache = setCachedAdminUsersData(json.data, { broadcast: true });
      if (onRolesOrUsersUpdated) onRolesOrUsersUpdated(mergedCache);

      dispatch(
        showMessageModal({
          title: editingRole ? 'Rol Modeli Güncellendi ✨' : 'Yeni Rol Modeli Oluşturuldu 🎉',
          text: `"${roleName.trim()}" yetki rolü başarıyla kaydedildi.`,
          type: 'success',
        })
      );
    } catch (err) {
      setRoleFormError('Sunucu bağlantı hatası oluştu: ' + err.message);
    }
  };

  // Rol Sil
  const handleDeleteRole = async (role) => {
    if (role.code === 'super_admin' || role.id === 'role_super_admin') {
      alert('Süper Yönetici rolü sistem güvenliği için silinemez.');
      return;
    }
    if (role.code === 'courier' || role.id === 'role_courier') {
      alert('Paket Kuryesi rolü sistem modülü için gereklidir ve silinemez.');
      return;
    }

    const assignedCount = adminUsers.filter((u) => String(u.roleId) === String(role.id)).length;
    const confirmMsg = assignedCount > 0
      ? `"${role.name}" rolüne atanmış ${assignedCount} personel bulunmaktadır.\n\nRol silindiğinde bu personeller otomatik olarak "Kasiyer & Salon" rolüne devredilecektir. Silmek istediğinize emin misiniz?`
      : `"${role.name}" rol modelini kalıcı olarak silmek istediğinize emin misiniz?`;

    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/admin/users?type=role&id=${encodeURIComponent(role.id)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        setRoles(json.data.roles || []);
        setAdminUsers(json.data.adminUsers || []);
        const mergedCache = setCachedAdminUsersData(json.data, { broadcast: true });
        if (onRolesOrUsersUpdated) onRolesOrUsersUpdated(mergedCache);

        dispatch(
          showMessageModal({
            title: 'Rol Başarıyla Silindi 🗑️',
            text: `"${role.name}" yetki rolü kaldırıldı.${assignedCount > 0 ? ' İlgili personeller Kasiyer rolüne devredildi.' : ''}`,
            type: 'info',
          })
        );
      } else {
        alert(json.error || 'Rol silinemedi.');
      }
    } catch (err) {
      alert('Bağlantı hatası oluştu: ' + err.message);
    }
  };

  // Müşteri Ekle Modalı Aç
  const handleOpenAddCustomer = () => {
    setEditingCustomer(null);
    setCustName('');
    setCustEmail('');
    setCustPhone('');
    setCustAddress('');
    setCustPass('');
    setCustVerified(true);
    setCustFormError('');
    setIsCustomerModalOpen(true);
  };

  // Müşteri Düzenle Modalı Aç
  const handleOpenEditCustomer = (cust) => {
    setEditingCustomer(cust);
    setCustName(cust.name || '');
    setCustEmail(cust.email || '');
    setCustPhone(cust.phone || '');
    setCustAddress(cust.address || '');
    setCustPass('');
    setCustVerified(cust.phoneVerified === true);
    setCustFormError('');
    setIsCustomerModalOpen(true);
  };

  // Müşteri Kaydet (Yeni Ekle veya Güncelle)
  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    setCustFormError('');

    if (!custName.trim() || custName.trim().length < 2) {
      setCustFormError('Lütfen geçerli bir Ad Soyad giriniz.');
      return;
    }
    if (!custEmail.trim() && !custPhone.trim()) {
      setCustFormError('E-posta veya telefon numarasından en az biri zorunludur.');
      return;
    }
    if (!editingCustomer && (!custPass.trim() || custPass.trim().length < 4)) {
      setCustFormError('Şifre en az 4 karakter olmalıdır.');
      return;
    }

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'customer',
          action: editingCustomer ? 'update' : 'create',
          ...(editingCustomer ? { id: editingCustomer.id || editingCustomer.email } : {}),
          name: custName.trim(),
          email: custEmail.trim(),
          phone: custPhone.trim(),
          address: custAddress.trim(),
          phoneVerified: custVerified,
          ...(custPass.trim() ? { pass: custPass.trim() } : {})
        })
      });
      const json = await res.json();
      if (!json.success) {
        setCustFormError(json.error || 'Müşteri kaydedilemedi.');
        return;
      }

      if (Array.isArray(json.data?.customers)) {
        setCustomers(json.data.customers);
        setCachedAdminUsersData({ customers: json.data.customers }, { broadcast: true });
      } else {
        invalidateAdminUsersCache({ broadcast: true });
        await fetchData(true);
      }
      setIsCustomerModalOpen(false);
      dispatch(
        showMessageModal({
          title: editingCustomer ? 'Müşteri Güncellendi' : 'Yeni Müşteri Eklendi',
          text: `"${custName.trim()}" başarıyla kaydedildi.`,
          type: 'success'
        })
      );
    } catch (err) {
      setCustFormError('Sunucu bağlantı hatası oluştu.');
    }
  };

  // Müşteri Onayla
  const handleApproveCustomer = async (cust) => {
    const targetId = cust.id || cust.email;
    setApprovingCustId(targetId);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'customer',
          action: 'approve',
          id: targetId
        })
      });
      const json = await res.json();
      if (json.success) {
        if (Array.isArray(json.data?.customers)) {
          setCustomers(json.data.customers);
          setCachedAdminUsersData({ customers: json.data.customers }, { broadcast: true });
        } else {
          invalidateAdminUsersCache({ broadcast: true });
        }
        dispatch(
          showMessageModal({
            title: 'Müşteri Onaylandı 🎉',
            text: `"${cust.name || cust.email}" hesabı onaylandı ve giriş izni verildi.`,
            type: 'success'
          })
        );
      } else {
        alert(json.error || 'Müşteri onaylanamadı.');
      }
    } catch (err) {
      alert('Bağlantı hatası oluştu.');
    } finally {
      setApprovingCustId(null);
    }
  };

  // Müşteri Sil
  const handleDeleteCustomer = async (cust) => {
    if (!confirm(`"${cust.name || cust.email}" müşterisini silmek istediğinize emin misiniz?`)) return;
    try {
      const targetId = cust.id || cust.email;
      const res = await fetch(`/api/admin/users?type=customer&id=${encodeURIComponent(targetId)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        const nextCustomers = Array.isArray(json.data?.customers) ? json.data.customers : [];
        setCustomers(nextCustomers);
        setCachedAdminUsersData({ customers: nextCustomers }, { broadcast: true });

        try {
          if (typeof window !== 'undefined') {
            const savedStr = localStorage.getItem('sd_current_user');
            if (savedStr) {
              const parsed = JSON.parse(savedStr);
              if (
                parsed?.id === cust.id ||
                parsed?.email?.toLowerCase() === cust.email?.toLowerCase()
              ) {
                localStorage.removeItem('sd_current_user');
                localStorage.removeItem('sd_auth_token');
              }
            }
            localStorage.setItem(
              'sandwich_session_event',
              JSON.stringify({
                action: 'deleted',
                email: cust.email,
                id: cust.id,
                timestamp: Date.now()
              })
            );
          }
        } catch (e) {}

        dispatch(
          showMessageModal({
            title: 'Müşteri Silindi',
            text: `${cust.name || cust.email} sistemden kaldırıldı ve açık oturumu kapatıldı.`,
            type: 'info',
          })
        );
      } else {
        alert(json.error || 'Müşteri silinemedi.');
      }
    } catch (err) {
      alert('Bağlantı hatası oluştu.');
    }
  };

  const q = searchQuery.toLowerCase().trim();

  const panelUsers = adminUsers.filter(
    (u) => getPortalForRoleOrUser(u.roleId, u.roleName || u.role) === 'panel'
  );
  const courierUsers = adminUsers.filter(
    (u) => getPortalForRoleOrUser(u.roleId, u.roleName || u.role) === 'kurye'
  );
  const superAdminUsers = adminUsers.filter(
    (u) => getPortalForRoleOrUser(u.roleId, u.roleName || u.role) === 'yonetici'
  );

  const activePortalStaffList =
    subTab === 'kurye'
      ? courierUsers
      : subTab === 'yonetici'
      ? superAdminUsers
      : panelUsers;

  const filteredStaff = activePortalStaffList.filter(
    (u) =>
      !q ||
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.phone || '').toLowerCase().includes(q) ||
      (u.roleName || '').toLowerCase().includes(q)
  );

  const filteredRoles = roles.filter(
    (r) =>
      !q ||
      (r.name || '').toLowerCase().includes(q) ||
      (r.description || '').toLowerCase().includes(q)
  );

  const filteredCustomers = customers.filter(
    (c) =>
      !q ||
      (c.name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q)
  );

  const PORTAL_META = {
    panel: {
      badge: '🍽️ Restoran Paneli',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
      title: 'Restoran Personeli',
      desc: 'Mutfak, kasa, sipariş onayı, menü ve stok ekranlarını kullanan restoran personeli.',
      addBtnLabel: '+ Yeni Personel Ekle'
    },
    kurye: {
      badge: '🛵 Kurye Paneli',
      badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
      title: 'Kurye Ekibi',
      desc: 'Yalnızca paket servis ve kurye teslimat portalına giriş yapabilen saha kuryeleri.',
      addBtnLabel: '+ Yeni Kurye Ekle'
    },
    yonetici: {
      badge: '👑 Süper Yönetici',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
      title: 'Süper Yöneticiler',
      desc: 'Kasa, finans, kullanıcı & rol yönetimi, vitrin tasarımı ve sistem ayarlarına tam yetkili yöneticiler.',
      addBtnLabel: '+ Yeni Süper Yönetici Ekle'
    }
  };

  return (
    <div className="space-y-3 w-full min-w-0 font-poppins">
      {/* 1. KOMPAKT GEÇİŞ SEKMELERİ (TEK SATIR PILL MENÜ) */}
      <div className="bg-white p-1.5 rounded-xl border border-stone-200/90 shadow-2xs overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1 min-w-max">
          {[
            { id: 'panel', label: 'Restoran Personeli', icon: 'fa-solid fa-kitchen-set', count: panelUsers.length },
            ...(courierModuleEnabled === true
              ? [{ id: 'kurye', label: 'Kurye Ekibi', icon: 'fa-solid fa-motorcycle', count: courierUsers.length }]
              : []),
            { id: 'yonetici', label: 'Süper Yöneticiler', icon: 'fa-solid fa-crown', count: superAdminUsers.length },
            { id: 'customers', label: 'Müşteri Hesapları', icon: 'fa-solid fa-users', count: customers.length },
            { id: 'roles', label: 'Yetki & Roller', icon: 'fa-solid fa-shield-halved', count: roles.length },
          ].map((t) => {
            const active = subTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSubTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  active
                    ? 'bg-brand-600 text-white shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                }`}
              >
                <i className={`${t.icon} text-[11px] ${active ? 'text-white' : 'text-stone-400'}`}></i>
                <span>{t.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                    active ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600'
                  }`}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. EYLEM & ARAMA ŞERİDİ */}
      <div className="bg-white px-3 py-2 rounded-xl border border-stone-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-2">
        {/* Sol: Kısa Başlık & Rozet */}
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-xs sm:text-sm font-extrabold text-stone-900 truncate">
            {subTab === 'roles'
              ? 'Yetki & Rol Modelleri'
              : subTab === 'customers'
              ? 'Kayıtlı Müşteri & Üye Listesi'
              : PORTAL_META[subTab]?.title}
          </h3>
          <span
            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border shrink-0 ${
              subTab === 'roles'
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                : subTab === 'customers'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : PORTAL_META[subTab]?.badgeClass
            }`}
          >
            {subTab === 'roles'
              ? '🛡️ Yetki Modelleri'
              : subTab === 'customers'
              ? '🛍️ Müşteri Hesapları'
              : PORTAL_META[subTab]?.badge}
          </span>
        </div>

        {/* Sağ: Yenile, Arama ve Ekle Butonları */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {/* Yenile */}
          <button
            type="button"
            onClick={() => fetchData(true)}
            title="Listeyi Yenile"
            className="p-1.5 px-2 rounded-lg text-stone-600 hover:text-stone-900 bg-stone-50 hover:bg-stone-100 border border-stone-200 transition-colors cursor-pointer shrink-0"
          >
            <i className={`fa-solid fa-arrows-rotate text-xs ${loading ? 'fa-spin' : ''}`}></i>
          </button>

          {/* Arama Inputu */}
          <div className="relative w-full sm:w-52">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                subTab === 'roles'
                  ? 'Rol ara...'
                  : subTab === 'customers'
                  ? 'Müşteri ara...'
                  : 'Kullanıcı ara...'
              }
              className="w-full bg-stone-50 border border-stone-200 rounded-lg pl-7 pr-7 py-1.5 text-xs focus:outline-none focus:border-stone-900 focus:bg-white font-medium transition-all"
            />
            <i className="fa-solid fa-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 text-[11px]"></i>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            )}
          </div>

          {/* Ana Ekleme Butonu */}
          {subTab === 'roles' ? (
            <button
              type="button"
              onClick={handleOpenAddRole}
              className="bg-stone-900 hover:bg-black text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0 active:scale-95"
            >
              <i className="fa-solid fa-shield-halved text-amber-400"></i>
              <span>+ Yeni Rol</span>
            </button>
          ) : subTab === 'customers' ? (
            <button
              type="button"
              onClick={handleOpenAddCustomer}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0 active:scale-95"
            >
              <i className="fa-solid fa-user-plus text-white"></i>
              <span>+ Müşteri Ekle</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleOpenAddUser(subTab)}
              className="bg-stone-900 hover:bg-black text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0 active:scale-95"
            >
              <i className="fa-solid fa-user-plus text-amber-400"></i>
              <span>{PORTAL_META[subTab]?.addBtnLabel || '+ Kullanıcı Ekle'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. İÇERİK: PORTAL BAZLI PERSONEL LİSTESİ (/panel, /kurye, /yonetici) */}
      {(subTab === 'panel' || subTab === 'kurye' || subTab === 'yonetici') && (
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs overflow-hidden">
          <div className="px-4 sm:px-5 py-3.5 bg-stone-50/80 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-extrabold text-stone-900">
                  {PORTAL_META[subTab]?.title}
                </h3>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${PORTAL_META[subTab]?.badgeClass}`}>
                  {PORTAL_META[subTab]?.badge}
                </span>
              </div>
              <p className="text-[11px] text-stone-500 mt-0.5">
                {PORTAL_META[subTab]?.desc}
              </p>
            </div>
          </div>

          {filteredStaff.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-4">
              <div
                className={`w-16 h-16 rounded-3xl border flex items-center justify-center text-2xl mx-auto shadow-2xs ${
                  subTab === 'kurye'
                    ? 'bg-sky-50 text-sky-600 border-sky-200/60'
                    : subTab === 'yonetici'
                    ? 'bg-rose-50 text-rose-600 border-rose-200/60'
                    : 'bg-amber-50 text-amber-600 border-amber-200/60'
                }`}
              >
                <i
                  className={
                    subTab === 'kurye'
                      ? 'fa-solid fa-motorcycle'
                      : subTab === 'yonetici'
                      ? 'fa-solid fa-crown'
                      : 'fa-solid fa-kitchen-set'
                  }
                ></i>
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h4 className="text-sm font-extrabold text-stone-900">
                  {subTab === 'kurye'
                    ? 'Henüz Kayıtlı Kurye Bulunmuyor'
                    : subTab === 'yonetici'
                    ? 'Henüz Süper Yönetici Bulunmuyor'
                    : 'Henüz Restoran Paneli Kullanıcısı Bulunmuyor'}
                </h4>
                <p className="text-xs text-stone-500">
                  {subTab === 'kurye'
                    ? 'Paket servis siparişlerini teslim edecek kurye personellerini buradan ekleyebilirsiniz.'
                    : subTab === 'yonetici'
                    ? 'Sistem ayarlarına ve ciro raporlarına erişebilecek yöneticileri buradan tanımlayabilirsiniz.'
                    : 'Mutfak, kasa, sipariş hazırlama ve stok takibi yapacak personelleri buradan sisteme ekleyebilirsiniz.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenAddUser(subTab)}
                className="inline-flex items-center gap-2 bg-stone-900 hover:bg-black text-white font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer shadow-xs transition-all active:scale-95"
              >
                <i className="fa-solid fa-user-plus text-amber-400"></i>
                <span>{PORTAL_META[subTab]?.addBtnLabel || '+ Kullanıcı Ekle'}</span>
              </button>
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {filteredStaff.map((user) => {
                const roleObj = roles.find((r) => String(r.id) === String(user.roleId)) || null;
                const colorTheme = ROLE_COLORS[roleObj?.color || user.roleColor] || ROLE_COLORS.blue;
                const userPortal = getPortalForRoleOrUser(
                  user.roleId,
                  roleObj?.name || user.roleName,
                  roleObj?.code
                );
                const portalMeta = PORTAL_META[userPortal] || PORTAL_META.panel;
                const initials = (user.name || 'P')
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((n) => n[0]?.toUpperCase())
                  .join('');

                const isProtected = isProtectedAdmin(user);

                return (
                  <div
                    key={user.id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-stone-50/60 transition-colors"
                  >
                    {/* Personel Bilgisi */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border ${colorTheme.bg} ${colorTheme.text} ${colorTheme.border}`}
                      >
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-bold text-sm text-stone-900 truncate">{user.name}</h4>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${colorTheme.bg} ${colorTheme.text} ${colorTheme.border}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${colorTheme.dot}`}></span>
                            {roleObj?.name || user.roleName}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${portalMeta.badgeClass}`}
                          >
                            {portalMeta.badge}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-stone-500 mt-0.5">
                          <span className="truncate">{user.email}</span>
                          {user.phone && <span className="text-stone-300">•</span>}
                          {user.phone && <span className="text-stone-400 font-mono text-[11px]">{user.phone}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Durum & Aksiyonlar */}
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      {isProtected ? (
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default inline-flex items-center gap-1">
                          <i className="fa-solid fa-lock text-[9px]"></i> Sistem Yöneticisi
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleToggleUserStatus(user)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider cursor-pointer border transition-colors ${
                            user.isActive !== false
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-stone-100 text-stone-500 border-stone-200 hover:bg-stone-200'
                          }`}
                          title="Durumu Değiştir"
                        >
                          {user.isActive !== false ? '● Aktif' : '○ Pasif'}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleOpenEditUser(user)}
                        className="bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <i className="fa-solid fa-pen-to-square text-[11px]"></i>
                        <span>Düzenle</span>
                      </button>

                      {!isProtected && (
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(user)}
                          className="text-stone-400 hover:text-rose-600 hover:bg-rose-50 border border-stone-200 p-1.5 rounded-lg text-xs cursor-pointer transition-colors"
                          title="Sil"
                        >
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. İÇERİK: ROL MODELLERİ */}
      {subTab === 'roles' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRoles.length === 0 ? (
            <div className="col-span-full p-8 text-center text-stone-400 text-xs bg-white rounded-2xl border border-stone-200/90 shadow-2xs">
              Aradığınız kriterlere uygun rol modeli bulunamadı.
            </div>
          ) : (
            filteredRoles.map((role) => {
              const colorTheme = ROLE_COLORS[role.color] || ROLE_COLORS.blue;
              const assignedCount = adminUsers.filter((u) => String(u.roleId) === String(role.id)).length;
              const permCount = role.permissions?.length || 0;

              return (
                <div
                  key={role.id}
                  className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold border ${colorTheme.bg} ${colorTheme.text} ${colorTheme.border}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${colorTheme.dot}`}></span>
                            {role.name}
                          </span>
                          <span className="text-[11px] font-semibold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-md">
                            {assignedCount} Personel
                          </span>
                        </div>
                        <p className="text-stone-500 text-xs leading-relaxed mt-1.5">
                          {role.description || 'Özel tanımlanmış yetki rolü.'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEditRole(role)}
                          className="bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <i className="fa-solid fa-sliders text-[11px]"></i>
                          <span>Yetkiler</span>
                        </button>
                        {role.code !== 'super_admin' &&
                          role.id !== 'role_super_admin' &&
                          role.code !== 'courier' &&
                          role.id !== 'role_courier' && (
                          <button
                            type="button"
                            onClick={() => handleDeleteRole(role)}
                            className="text-stone-400 hover:text-rose-600 hover:bg-rose-50 border border-stone-200 p-1.5 rounded-lg text-xs cursor-pointer transition-colors"
                            title="Sil"
                          >
                            <i className="fa-solid fa-trash-can"></i>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Tanımlı Yetki Özeti */}
                    <div className="pt-2.5 border-t border-stone-100">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1.5">
                        Yetki Kapsamı ({permCount} / {AVAILABLE_PERMISSIONS.length})
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {permCount === AVAILABLE_PERMISSIONS.length ? (
                          <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5">
                            <i className="fa-solid fa-circle-check text-emerald-600 text-xs"></i>
                            Tüm Sistem Modüllerine Tam Erişim
                          </span>
                        ) : (
                          (role.permissions || []).map((permId) => {
                            const meta = AVAILABLE_PERMISSIONS.find((p) => p.id === permId);
                            if (!meta) return null;
                            return (
                              <span
                                key={permId}
                                className="bg-stone-50 text-stone-700 border border-stone-200/80 px-2 py-0.5 rounded-md text-[10px] font-medium inline-flex items-center gap-1"
                              >
                                <i className={`${meta.icon} text-[9px] text-stone-400`}></i>
                                <span>{meta.label}</span>
                              </span>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 5. İÇERİK: MÜŞTERİ LİSTESİ */}
      {subTab === 'customers' && (
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs overflow-hidden">
          {filteredCustomers.length === 0 ? (
            <div className="p-10 text-center text-stone-400 text-xs space-y-3">
              <i className="fa-solid fa-users text-2xl mb-1 text-stone-300 block"></i>
              <p>{customers.length === 0 ? 'Henüz kayıtlı müşteri hesabı bulunmuyor.' : 'Arama kriterlerine uygun müşteri bulunamadı.'}</p>
              {customers.length === 0 && (
                <button
                  type="button"
                  onClick={handleOpenAddCustomer}
                  className="inline-flex items-center gap-1.5 bg-stone-900 hover:bg-black text-white font-bold text-xs px-3.5 py-2 rounded-xl cursor-pointer transition-colors"
                >
                  <i className="fa-solid fa-user-plus text-emerald-400"></i>
                  <span>+ İlk Müşteriyi Ekle</span>
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {filteredCustomers.map((c) => (
                <div
                  key={c.id || c.email}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-stone-50/60"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-stone-900 text-sm">{c.name}</span>
                      {c.isBlocked ? (
                        <span className="bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <i className="fa-solid fa-ban text-[9px]"></i> Engellendi
                        </span>
                      ) : c.phoneVerified !== true ? (
                        <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 animate-pulse">
                          ⏳ Onay Bekliyor
                        </span>
                      ) : (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <i className="fa-solid fa-circle-check text-emerald-600 text-[10px]"></i> Aktif Üye
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-stone-500 flex flex-wrap items-center gap-2">
                      <span>{c.email}</span>
                      {c.phone && <span className="text-stone-300">•</span>}
                      {c.phone && <span className="text-stone-400 font-mono text-[11px]">{c.phone}</span>}
                      {c.address && <span className="text-stone-300 hidden md:inline">•</span>}
                      {c.address && <span className="text-stone-400 truncate max-w-xs hidden md:inline">{c.address}</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 self-end sm:self-center shrink-0">
                    <span className="bg-stone-100 text-stone-700 px-2.5 py-1 rounded-lg text-xs font-bold">
                      {Array.isArray(c.orders) ? c.orders.length : 0} Sipariş
                    </span>

                    {!c.isBlocked && c.phoneVerified !== true && (
                      <button
                        type="button"
                        disabled={approvingCustId === (c.id || c.email)}
                        onClick={() => handleApproveCustomer(c)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <i className={`fa-solid ${approvingCustId === (c.id || c.email) ? 'fa-spinner animate-spin' : 'fa-check'} text-[11px]`}></i>
                        <span>Onayla</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleOpenEditCustomer(c)}
                      className="bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <i className="fa-solid fa-pen-to-square text-[11px]"></i>
                      <span>Düzenle</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteCustomer(c)}
                      className="text-stone-400 hover:text-rose-600 hover:bg-rose-50 border border-stone-200 p-1.5 rounded-lg text-xs cursor-pointer transition-colors"
                      title="Müşteriyi Sil"
                    >
                      <i className="fa-solid fa-trash-can"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: KULLANICI EKLE / DÜZENLE */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl space-y-4 my-auto max-h-[92vh] overflow-y-auto overscroll-contain">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-stone-900">
                  {editingUser
                    ? 'Kullanıcıyı Düzenle'
                    : userPortalTarget === 'kurye'
                    ? 'Yeni Kurye Ekibi Kullanıcısı Ekle'
                    : userPortalTarget === 'yonetici'
                    ? 'Yeni Süper Yönetici Ekle'
                    : 'Yeni Restoran Personeli Ekle'}
                </h3>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Kullanıcının hangi panele giriş yapacağını ve yetki rolünü seçin
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsUserModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 p-1.5 rounded-lg hover:bg-stone-100 cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-3.5">
              {/* GİRİŞ YAPACAĞI PANEL SEÇİMİ (/panel vs /kurye vs /yonetici) */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  Giriş Yapacağı Panel / Sistem Bölümü
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    {
                      key: 'panel',
                      title: 'Restoran Paneli',
                      url: '/panel',
                      icon: 'fa-solid fa-kitchen-set',
                      activeClass: 'border-amber-500 bg-amber-50/70 text-amber-950 ring-1 ring-amber-500/40'
                    },
                    ...(courierModuleEnabled ? [{
                      key: 'kurye',
                      title: 'Kurye Paneli',
                      url: '/kurye',
                      icon: 'fa-solid fa-motorcycle',
                      activeClass: 'border-sky-500 bg-sky-50/70 text-sky-950 ring-1 ring-sky-500/40'
                    }] : []),
                    {
                      key: 'yonetici',
                      title: 'Süper Yönetici',
                      url: '/yonetici',
                      icon: 'fa-solid fa-crown',
                      activeClass: 'border-rose-500 bg-rose-50/70 text-rose-950 ring-1 ring-rose-500/40'
                    }
                  ].map((p) => {
                    const isSelected = userPortalTarget === p.key;
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => {
                          setUserPortalTarget(p.key);
                          setUserRoleId(getDefaultRoleIdForPortal(p.key));
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                          isSelected
                            ? p.activeClass
                            : 'border-stone-200 hover:border-stone-300 bg-stone-50/60 text-stone-700'
                        }`}
                      >
                        <span className="w-8 h-8 rounded-lg bg-white border border-stone-200/80 flex items-center justify-center text-xs shrink-0 shadow-2xs">
                          <i className={p.icon}></i>
                        </span>
                        <div className="min-w-0">
                          <span className="text-xs font-extrabold block truncate">{p.title}</span>
                          <span className="text-[10px] font-mono opacity-75 block">{p.url}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Ad Soyad</label>
                <input
                  type="text"
                  required
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Örn: Mehmet Yılmaz"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-stone-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">E-Posta / Kullanıcı Adı</label>
                  <input
                    type="text"
                    required
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    placeholder="mehmet@sandwichdiyari.com"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-stone-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Telefon Numarası</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={14}
                    value={userPhone}
                    onChange={(e) => setUserPhone(formatTurkishPhoneInput(e.target.value))}
                    placeholder="0532 123 45 67"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-stone-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Giriş Şifresi</label>
                  <input
                    type="text"
                    required={!editingUser}
                    value={userPass}
                    onChange={(e) => setUserPass(e.target.value)}
                    placeholder={editingUser ? 'Değiştirmek için girin' : 'Şifre belirleyin'}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-stone-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    {userPortalTarget === 'panel'
                      ? 'Restoran Paneli Rolü (/panel)'
                      : userPortalTarget === 'kurye'
                      ? 'Kurye Paneli Rolü (/kurye)'
                      : 'Süper Yönetici Rolü (/yonetici)'}
                  </label>
                  <select
                    value={
                      userRoleId ||
                      (() => {
                        const filtered = roles.filter(
                          (r) => getPortalForRoleOrUser(r.id, r.name, r.code) === userPortalTarget
                        );
                        if (filtered.length > 0) return filtered[0].id;
                        if (userPortalTarget === 'kurye') return 'role_courier';
                        if (userPortalTarget === 'yonetici') return 'role_super_admin';
                        return 'role_cashier';
                      })()
                    }
                    onChange={(e) => setUserRoleId(e.target.value)}
                    className="app-select w-full bg-stone-50 hover:bg-stone-100/60 border border-stone-200 hover:border-brand-400 rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-bold text-stone-900 focus:outline-none focus:border-brand-500 cursor-pointer shadow-2xs transition-all"
                  >
                    {(() => {
                      const filteredRolesForPortal = roles.filter(
                        (r) => getPortalForRoleOrUser(r.id, r.name, r.code) === userPortalTarget
                      );
                      const portalRoleOptions =
                        filteredRolesForPortal.length > 0
                          ? filteredRolesForPortal
                          : userPortalTarget === 'kurye'
                          ? [{ id: 'role_courier', name: 'Paket Kuryesi' }]
                          : userPortalTarget === 'yonetici'
                          ? [{ id: 'role_super_admin', name: 'Süper Yönetici' }]
                          : [{ id: 'role_cashier', name: 'Kasiyer & Sipariş Sorumlusu' }];

                      return portalRoleOptions.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ));
                    })()}
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2.5 bg-stone-50 p-3 rounded-xl border border-stone-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={userIsActive}
                  onChange={(e) => setUserIsActive(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded"
                />
                <span className="text-xs font-bold text-stone-800">
                  Kullanıcı Hesabı Aktif (Giriş yapabilir)
                </span>
              </label>

              {userFormError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3.5 py-2 rounded-xl text-xs font-semibold">
                  {userFormError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs cursor-pointer transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-stone-900 hover:bg-black text-white font-bold text-xs cursor-pointer shadow-xs transition-colors"
                >
                  {editingUser ? 'Kaydet' : 'Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ROL MODELİ EKLE / DÜZENLE */}
      {isRoleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-6xl xl:max-w-7xl w-full shadow-2xl flex flex-col max-h-[96vh] my-auto overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Başlık */}
            <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-stone-100 bg-white shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center text-xs shadow-2xs">
                  <i className="fa-solid fa-shield-halved"></i>
                </span>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-stone-900 leading-tight">
                    {editingRole ? `"${editingRole.name}" Rolünü Düzenle` : 'Yeni Rol Modeli Oluştur'}
                  </h3>
                  <p className="text-[11px] text-stone-500 leading-tight">
                    Personelin erişebileceği modülleri ve yetkileri tek ekrandan belirleyin
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRoleModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 p-1.5 rounded-lg hover:bg-stone-100 cursor-pointer transition-colors"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveRole} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 scrollbar-thin">
                {/* 1. Üst Satır: Rol Adı, Rozet Rengi, Açıklama Tek Satırda */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end bg-stone-50/70 p-3 sm:p-3.5 rounded-2xl border border-stone-200/80">
                  <div className="sm:col-span-4">
                    <label className="block text-xs font-bold text-stone-700 mb-1">Rol Adı</label>
                    <input
                      type="text"
                      required
                      value={roleName}
                      onChange={(e) => setRoleName(e.target.value)}
                      placeholder="Örn: Restoran Müdürü, Şef, Kasiyer..."
                      className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-stone-900 font-medium"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-xs font-bold text-stone-700 mb-1">Rozet Rengi</label>
                    <select
                      value={roleColor}
                      onChange={(e) => setRoleColor(e.target.value)}
                      className="app-select w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-stone-900 focus:outline-none focus:border-stone-900 cursor-pointer"
                    >
                      {Object.entries(ROLE_COLORS).map(([key, val]) => (
                        <option key={key} value={key}>
                          {val.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-5">
                    <label className="block text-xs font-bold text-stone-700 mb-1">Açıklama</label>
                    <input
                      type="text"
                      value={roleDesc}
                      onChange={(e) => setRoleDesc(e.target.value)}
                      placeholder="Yetki ve görev özeti..."
                      className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs sm:text-sm text-stone-800 focus:outline-none focus:border-stone-900"
                    />
                  </div>
                </div>

                {/* 2. Modüller & Yetkiler Başlık & Toplu Seçim */}
                <div className="flex items-center justify-between pb-1 border-b border-stone-100">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-extrabold text-stone-900 block">
                      Erişilebilir Modüller & Yetkiler
                    </label>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-stone-900 text-white">
                      {rolePermissions.length} / {AVAILABLE_PERMISSIONS.length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setRolePermissions(
                        rolePermissions.length === AVAILABLE_PERMISSIONS.length
                          ? ['orders']
                          : AVAILABLE_PERMISSIONS.map((p) => p.id)
                      )
                    }
                    className="text-xs font-bold text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-xl transition-colors cursor-pointer shrink-0"
                  >
                    {rolePermissions.length === AVAILABLE_PERMISSIONS.length ? 'Tümünü Temizle' : 'Tüm Yetkileri Seç'}
                  </button>
                </div>

                {/* 3. İki Sütunlu Dengeli Yetki Grupları (9 Yetki Sol, 9 Yetki Sağ) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                  {/* Sol Kolon: Sipariş & Operasyon (3) + Menü, Ürünler & Soslar (6) = 9 yetki */}
                  <div className="space-y-3">
                    {[PERMISSION_GROUPS[0], PERMISSION_GROUPS[1]].map((group) => {
                      const groupPermIds = group.perms.map((p) => p.id);
                      const selectedCount = group.perms.filter((p) => rolePermissions.includes(p.id)).length;
                      const isAllSelected = selectedCount === group.perms.length;

                      return (
                        <div
                          key={group.title}
                          className="bg-stone-50/70 border border-stone-200/90 rounded-2xl p-3 space-y-2.5 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2 pb-2 border-b border-stone-200/60">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-lg bg-white border border-stone-200 flex items-center justify-center text-xs shadow-2xs">
                                <i className={group.icon}></i>
                              </span>
                              <span className="text-xs font-bold text-stone-900">{group.title}</span>
                              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-stone-200/80 text-stone-700">
                                {selectedCount} / {group.perms.length}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleGroupPermissions(groupPermIds)}
                              className="text-[11px] font-bold text-stone-600 hover:text-stone-900 underline cursor-pointer"
                            >
                              {isAllSelected ? 'Grubu Kaldır' : 'Grubu Seç'}
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {group.perms.map((perm) => {
                              const checked = rolePermissions.includes(perm.id);
                              return (
                                <label
                                  key={perm.id}
                                  className={`p-2 rounded-xl border cursor-pointer transition-all flex items-start gap-2 ${
                                    checked
                                      ? 'bg-emerald-50/80 border-emerald-300 text-stone-900 shadow-2xs'
                                      : 'bg-white border-stone-200/90 hover:border-stone-300 text-stone-600'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => togglePermission(perm.id)}
                                    className="w-4 h-4 mt-0.5 accent-emerald-600 rounded shrink-0 cursor-pointer"
                                  />
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <i className={`${perm.icon} text-[11px] ${checked ? 'text-emerald-600' : 'text-stone-400'}`}></i>
                                      <span className="text-xs font-bold block text-stone-900 leading-snug truncate">
                                        {perm.label}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-stone-500 block leading-tight mt-0.5">
                                      {perm.desc}
                                    </span>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Sağ Kolon: Stok & Envanter (2) + Müşteri & Vitrin (3) + Yönetim, Finans & Kurye (4) = 9 yetki */}
                  <div className="space-y-3">
                    {[PERMISSION_GROUPS[2], PERMISSION_GROUPS[3], PERMISSION_GROUPS[4]].map((group) => {
                      const groupPermIds = group.perms.map((p) => p.id);
                      const selectedCount = group.perms.filter((p) => rolePermissions.includes(p.id)).length;
                      const isAllSelected = selectedCount === group.perms.length;

                      return (
                        <div
                          key={group.title}
                          className="bg-stone-50/70 border border-stone-200/90 rounded-2xl p-3 space-y-2.5 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2 pb-2 border-b border-stone-200/60">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-lg bg-white border border-stone-200 flex items-center justify-center text-xs shadow-2xs">
                                <i className={group.icon}></i>
                              </span>
                              <span className="text-xs font-bold text-stone-900">{group.title}</span>
                              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-stone-200/80 text-stone-700">
                                {selectedCount} / {group.perms.length}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleGroupPermissions(groupPermIds)}
                              className="text-[11px] font-bold text-stone-600 hover:text-stone-900 underline cursor-pointer"
                            >
                              {isAllSelected ? 'Grubu Kaldır' : 'Grubu Seç'}
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {group.perms.map((perm) => {
                              const checked = rolePermissions.includes(perm.id);
                              return (
                                <label
                                  key={perm.id}
                                  className={`p-2 rounded-xl border cursor-pointer transition-all flex items-start gap-2 ${
                                    checked
                                      ? 'bg-emerald-50/80 border-emerald-300 text-stone-900 shadow-2xs'
                                      : 'bg-white border-stone-200/90 hover:border-stone-300 text-stone-600'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => togglePermission(perm.id)}
                                    className="w-4 h-4 mt-0.5 accent-emerald-600 rounded shrink-0 cursor-pointer"
                                  />
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <i className={`${perm.icon} text-[11px] ${checked ? 'text-emerald-600' : 'text-stone-400'}`}></i>
                                      <span className="text-xs font-bold block text-stone-900 leading-snug truncate">
                                        {perm.label}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-stone-500 block leading-tight mt-0.5">
                                      {perm.desc}
                                    </span>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {roleFormError && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3.5 py-2 rounded-xl text-xs font-semibold">
                    {roleFormError}
                  </div>
                )}
              </div>

              {/* Sabit Alt Bar: İptal ve Kaydet Kesinlikle Görünür */}
              <div className="flex items-center justify-end gap-2.5 px-5 sm:px-6 py-3 border-t border-stone-100 bg-stone-50/80 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsRoleModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 font-bold text-xs cursor-pointer transition-colors shadow-2xs"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-stone-900 hover:bg-black text-white font-bold text-xs cursor-pointer shadow-xs transition-colors"
                >
                  {editingRole ? 'Kaydet' : 'Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: MÜŞTERİ EKLE / DÜZENLE */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-5 my-auto max-h-[92vh] overflow-y-auto overscroll-contain">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="font-bold text-base text-stone-900">
                {editingCustomer ? 'Müşteriyi Düzenle' : 'Yeni Müşteri Ekle'}
              </h3>
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 p-1.5 rounded-lg hover:bg-stone-100 cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Ad Soyad *</label>
                <input
                  type="text"
                  required
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  placeholder="Örn: Ahmet Demir"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-stone-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">E-Posta Adresi</label>
                  <input
                    type="text"
                    value={custEmail}
                    onChange={(e) => setCustEmail(e.target.value)}
                    placeholder="ahmet@ornek.com"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-stone-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Telefon Numarası</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={14}
                    value={custPhone}
                    onChange={(e) => setCustPhone(formatTurkishPhoneInput(e.target.value))}
                    placeholder="0532 123 45 67"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-stone-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Teslimat Adresi</label>
                <input
                  type="text"
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                  placeholder="Mahalle, sokak, bina ve daire bilgisi..."
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-stone-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Giriş Şifresi {editingCustomer ? '(Opsiyonel)' : '*'}
                </label>
                <input
                  type="text"
                  required={!editingCustomer}
                  value={custPass}
                  onChange={(e) => setCustPass(e.target.value)}
                  placeholder={editingCustomer ? 'Değiştirmek için girin' : 'En az 4 karakter şifre belirleyin'}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-stone-400"
                />
              </div>

              <label className="flex items-center gap-2.5 bg-stone-50 p-3 rounded-xl border border-stone-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={custVerified}
                  onChange={(e) => setCustVerified(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded"
                />
                <span className="text-xs font-bold text-stone-800">
                  Onaylı / Aktif Müşteri (Anında giriş yapabilir)
                </span>
              </label>

              {custFormError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3.5 py-2 rounded-xl text-xs font-semibold">
                  {custFormError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs cursor-pointer transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-stone-900 hover:bg-black text-white font-bold text-xs cursor-pointer shadow-xs transition-colors"
                >
                  {editingCustomer ? 'Kaydet' : 'Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
