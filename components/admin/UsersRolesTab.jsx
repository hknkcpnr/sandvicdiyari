'use client';

import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { showMessageModal } from '@/store/slices/uiSlice';
import { formatTurkishPhoneInput } from '@/lib/phoneUtils';

// Sistemde tanımlı tüm yetki modülleri
export const AVAILABLE_PERMISSIONS = [
  { id: 'view_revenue', label: 'Ciro & Finansal Tutarları Görme', icon: 'fa-solid fa-coins', desc: 'Ciro, toplam kazanç ve sipariş tutarlarını net görüntüleme yetkisi' },
  { id: 'overview', label: 'Genel Bakış Sayfası', icon: 'fa-solid fa-chart-pie', desc: 'Finansal özet ve operasyon kontrol paneli' },
  { id: 'orders', label: 'Sipariş Yönetimi', icon: 'fa-solid fa-list-check', desc: 'Sipariş durumları ve fiş yazdırma' },
  { id: 'inventory', label: 'Stok Yönetimi', icon: 'fa-solid fa-boxes-stacked', desc: 'Ürün stok kontrolü ve satış açma/kapama' },
  { id: 'members', label: 'Üye Yönetimi', icon: 'fa-solid fa-users', desc: 'Kayıtlı müşteriler, engelleme ve bildirimler' },
  { id: 'products', label: 'Menü & Ürünler', icon: 'fa-solid fa-burger', desc: 'Ürün ekleme, düzenleme ve katalog' },
  { id: 'users', label: 'Kullanıcı & Rol Yönetimi', icon: 'fa-solid fa-user-shield', desc: 'Personel ve yetki modelleri' },
  { id: 'reviews', label: 'Geri Bildirimler', icon: 'fa-regular fa-star', desc: 'Müşteri yorumlarını inceleme' },
  { id: 'api', label: 'Mobil REST API', icon: 'fa-solid fa-code', desc: 'Entegrasyon ve API uç noktaları' },
  { id: 'delete_order', label: 'Sipariş Silme', icon: 'fa-solid fa-trash-can', desc: 'Siparişleri kalıcı silme yetkisi' },
  { id: 'manage_prices', label: 'Fiyat Güncelleme', icon: 'fa-solid fa-tags', desc: 'Ürün fiyatlarını değiştirme yetkisi' },
  { id: 'settings', label: 'Sistem & Panel Ayarları', icon: 'fa-solid fa-sliders', desc: 'Arayüz font boyutu, ses, fiş ve sistem ayarları' },
  { id: 'site_content', label: 'Müşteri Sayfası Tasarım & İçerik', icon: 'fa-solid fa-paintbrush', desc: 'Vitrin başlıkları, banner, görseller ve kampanya bölümlerini düzenleme' },
  { id: 'courier_delivery', label: 'Kurye Portalı & Teslimat', icon: 'fa-solid fa-motorcycle', desc: 'Kurye teslimat portalına giriş, üzerine atanan siparişleri görme, yol tarifi alma ve teslimat tamamlama yetkisi' },
];

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
  const [subTab, setSubTab] = useState('staff'); // 'staff' | 'roles' | 'customers'
  const [adminUsers, setAdminUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Kullanıcı Modal Durumları
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
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

  // API'den verileri getir
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const json = await res.json();
      if (json.success && json.data) {
        setAdminUsers(json.data.adminUsers || []);
        setRoles(json.data.roles || []);
        setCustomers(json.data.customers || []);
        if (!userRoleId && json.data.roles?.length > 0) {
          setUserRoleId(json.data.roles[0].id);
        }
      }
    } catch (err) {
      console.error('Kullanıcı ve rol verileri alınamadı:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Kullanıcı Modalı Açma
  const handleOpenAddUser = () => {
    setEditingUser(null);
    setUserName('');
    setUserEmail('');
    setUserPhone('');
    setUserPass('');
    setUserRoleId(roles[0]?.id || 'role_super_admin');
    setUserIsActive(true);
    setUserFormError('');
    setIsUserModalOpen(true);
  };

  const handleOpenEditUser = (user) => {
    setEditingUser(user);
    setUserName(user.name || '');
    setUserEmail(user.email || '');
    setUserPhone(user.phone || '');
    setUserPass('');
    setUserRoleId(user.roleId || roles[0]?.id || '');
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
      const payload = {
        entityType: 'user',
        id: editingUser?.id,
        name: userName.trim(),
        email: userEmail.trim(),
        phone: userPhone.trim(),
        roleId: userRoleId,
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
      if (onRolesOrUsersUpdated) onRolesOrUsersUpdated(json.data);

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
        if (onRolesOrUsersUpdated) onRolesOrUsersUpdated(json.data);
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
        if (onRolesOrUsersUpdated) onRolesOrUsersUpdated(json.data);
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
    setRolePermissions((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  };

  // Rol Kaydet
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
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'role',
          id: editingRole?.id,
          name: roleName.trim(),
          color: roleColor,
          description: roleDesc.trim(),
          permissions: rolePermissions,
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
      if (onRolesOrUsersUpdated) onRolesOrUsersUpdated(json.data);

      dispatch(
        showMessageModal({
          title: editingRole ? 'Rol Güncellendi' : 'Yeni Rol Oluşturuldu',
          text: `"${roleName}" rolü kaydedildi.`,
          type: 'success',
        })
      );
    } catch (err) {
      setRoleFormError('Sunucu hatası oluştu.');
    }
  };

  // Rol Sil
  const handleDeleteRole = async (role) => {
    if (role.code === 'super_admin' || role.id === 'role_super_admin') {
      alert('Süper Yönetici rolü silinemez.');
      return;
    }
    if (!confirm(`"${role.name}" rolünü silmek istediğinize emin misiniz?`)) return;

    try {
      const res = await fetch(`/api/admin/users?type=role&id=${encodeURIComponent(role.id)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        setRoles(json.data.roles || []);
        setAdminUsers(json.data.adminUsers || []);
        if (onRolesOrUsersUpdated) onRolesOrUsersUpdated(json.data);
      } else {
        alert(json.error || 'Rol silinemedi.');
      }
    } catch (err) {
      alert('Bağlantı hatası.');
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
      } else {
        await fetchData();
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
        setCustomers(Array.isArray(json.data?.customers) ? json.data.customers : []);

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

  const filteredStaff = adminUsers.filter(
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

  return (
    <div className="space-y-4 w-full min-w-0">
      {/* SEKME, ARAMA ÇUBUĞU VE HIZLI İŞLEM BUTONLARI */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-stone-200/90 shadow-2xs">
        <div className="grid grid-cols-3 gap-1 sm:flex sm:items-center w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setSubTab('staff')}
            className={`px-2.5 sm:px-3.5 py-2 rounded-xl font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
              subTab === 'staff' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <i className="fa-solid fa-users-gear text-[10px] sm:text-[11px]"></i>
            <span className="truncate">Personel</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] font-bold ${
              subTab === 'staff' ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-700'
            }`}>
              {adminUsers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('roles')}
            className={`px-2.5 sm:px-3.5 py-2 rounded-xl font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
              subTab === 'roles' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <i className="fa-solid fa-shield-halved text-[10px] sm:text-[11px]"></i>
            <span className="truncate">Roller</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] font-bold ${
              subTab === 'roles' ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-700'
            }`}>
              {roles.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('customers')}
            className={`px-2.5 sm:px-3.5 py-2 rounded-xl font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
              subTab === 'customers' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <i className="fa-solid fa-address-book text-[10px] sm:text-[11px]"></i>
            <span className="truncate">Müşteriler</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] font-bold ${
              subTab === 'customers' ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-700'
            }`}>
              {customers.length}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={fetchData}
            title="Verileri Yenile"
            className="p-2 rounded-xl text-stone-500 hover:text-stone-900 hover:bg-stone-100 border border-stone-200 transition-colors cursor-pointer shrink-0"
          >
            <i className={`fa-solid fa-arrows-rotate text-xs ${loading ? 'fa-spin' : ''}`}></i>
          </button>

          <div className="relative w-full sm:w-56">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                subTab === 'staff'
                  ? 'Personel ara...'
                  : subTab === 'roles'
                  ? 'Rol modellerinde ara...'
                  : 'Müşteri ara...'
              }
              className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-stone-400 font-medium"
            />
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs"></i>
          </div>

          {subTab === 'roles' ? (
            <button
              type="button"
              onClick={handleOpenAddRole}
              className="bg-stone-900 hover:bg-black text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-2xs"
            >
              <i className="fa-solid fa-shield-halved text-indigo-400"></i>
              <span>+ Rol Ekle</span>
            </button>
          ) : subTab === 'staff' ? (
            <button
              type="button"
              onClick={handleOpenAddUser}
              className="bg-stone-900 hover:bg-black text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-2xs"
            >
              <i className="fa-solid fa-user-plus text-amber-300"></i>
              <span>+ Kullanıcı Ekle</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleOpenAddCustomer}
              className="bg-stone-900 hover:bg-black text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-2xs"
            >
              <i className="fa-solid fa-user-plus text-emerald-400"></i>
              <span>+ Müşteri Ekle</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. İÇERİK: PERSONEL LİSTESİ */}
      {subTab === 'staff' && (
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs overflow-hidden">
          {filteredStaff.length === 0 ? (
            <div className="p-8 text-center text-stone-400 text-xs">Kayıtlı personel bulunamadı.</div>
          ) : (
            <div className="divide-y divide-stone-100">
              {filteredStaff.map((user) => {
                const roleObj = roles.find((r) => String(r.id) === String(user.roleId)) || roles[0];
                const colorTheme = ROLE_COLORS[roleObj?.color] || ROLE_COLORS.blue;
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
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-stone-900 truncate">{user.name}</h4>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${colorTheme.bg} ${colorTheme.text} ${colorTheme.border}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${colorTheme.dot}`}></span>
                            {roleObj?.name || user.roleName}
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
                        {role.code !== 'super_admin' && role.id !== 'role_super_admin' && (
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="font-bold text-base text-stone-900">
                {editingUser ? 'Personeli Düzenle' : 'Yeni Personel Ekle'}
              </h3>
              <button
                type="button"
                onClick={() => setIsUserModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 p-1.5 rounded-lg hover:bg-stone-100 cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4">
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
                  <label className="block text-xs font-bold text-stone-700 mb-1">Rol Modeli</label>
                  <select
                    value={userRoleId}
                    onChange={(e) => setUserRoleId(e.target.value)}
                    className="app-select w-full bg-stone-50 hover:bg-stone-100/60 border border-stone-200 hover:border-brand-400 rounded-2xl px-4 py-3 text-xs sm:text-sm font-bold text-stone-900 focus:outline-none focus:border-brand-500 cursor-pointer shadow-2xs transition-all"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="font-bold text-base text-stone-900">
                {editingRole ? `"${editingRole.name}" Rolünü Düzenle` : 'Yeni Rol Modeli'}
              </h3>
              <button
                type="button"
                onClick={() => setIsRoleModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 p-1.5 rounded-lg hover:bg-stone-100 cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <form onSubmit={handleSaveRole} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-6">
                  <label className="block text-xs font-bold text-stone-700 mb-1">Rol Adı</label>
                  <input
                    type="text"
                    required
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                    placeholder="Örn: Kurye, Kasiyer..."
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-stone-400"
                  />
                </div>

                <div className="sm:col-span-6">
                  <label className="block text-xs font-bold text-stone-700 mb-1">Rozet Rengi</label>
                  <select
                    value={roleColor}
                    onChange={(e) => setRoleColor(e.target.value)}
                    className="app-select w-full bg-stone-50 hover:bg-stone-100/60 border border-stone-200 hover:border-brand-400 rounded-2xl px-4 py-3 text-xs sm:text-sm font-bold text-stone-900 focus:outline-none focus:border-brand-500 cursor-pointer shadow-2xs transition-all"
                  >
                    {Object.entries(ROLE_COLORS).map(([key, val]) => (
                      <option key={key} value={key}>
                        {val.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-12">
                  <label className="block text-xs font-bold text-stone-700 mb-1">Açıklama</label>
                  <input
                    type="text"
                    value={roleDesc}
                    onChange={(e) => setRoleDesc(e.target.value)}
                    placeholder="Yetki ve görev özeti..."
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-stone-800 focus:outline-none focus:border-stone-400"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-stone-700">
                    Erişilebilir Modüller ({rolePermissions.length} / {AVAILABLE_PERMISSIONS.length})
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setRolePermissions(
                        rolePermissions.length === AVAILABLE_PERMISSIONS.length
                          ? ['orders']
                          : AVAILABLE_PERMISSIONS.map((p) => p.id)
                      )
                    }
                    className="text-[11px] font-bold text-brand-600 hover:underline cursor-pointer"
                  >
                    {rolePermissions.length === AVAILABLE_PERMISSIONS.length ? 'Temizle' : 'Tümünü Seç'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {AVAILABLE_PERMISSIONS.map((perm) => {
                    const checked = rolePermissions.includes(perm.id);
                    return (
                      <label
                        key={perm.id}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                          checked
                            ? 'bg-emerald-50 border-emerald-300 text-stone-900 font-bold'
                            : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePermission(perm.id)}
                          className="w-3.5 h-3.5 accent-emerald-600 rounded shrink-0"
                        />
                        <span className="text-xs truncate">{perm.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {roleFormError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3.5 py-2 rounded-xl text-xs font-semibold">
                  {roleFormError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsRoleModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs cursor-pointer transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
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
