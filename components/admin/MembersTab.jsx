'use client';

import { useState, useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { showMessageModal } from '@/store/slices/uiSlice';
import { formatTurkishPhoneInput, toWhatsAppPhone } from '@/lib/phoneUtils';
import AdminPagination from './AdminPagination';

export default function MembersTab({ onCustomerUpdated }) {
  const dispatch = useDispatch();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'active' | 'blocked'
  const [approvingId, setApprovingId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  // Bildirim Modalı Durumları
  const [isNotifyModalOpen, setIsNotifyModalOpen] = useState(false);
  const [selectedMemberForNotify, setSelectedMemberForNotify] = useState(null); // null ise tüm üyeler
  const [notifyTitle, setNotifyTitle] = useState('');
  const [notifyMessage, setNotifyMessage] = useState('');
  const [notifyChannel, setNotifyChannel] = useState('system'); // 'system' | 'whatsapp'
  const [isSendingNotify, setIsSendingNotify] = useState(false);

  // Engelleme Modalı Durumları
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [selectedMemberForBlock, setSelectedMemberForBlock] = useState(null);
  const [blockReason, setBlockReason] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);

  // Müşteri Ekle / Düzenle Modalı Durumları
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [custName, setCustName] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custPass, setCustPass] = useState('');
  const [custVerified, setCustVerified] = useState(true);
  const [custFormError, setCustFormError] = useState('');
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);

  // API'den üyeleri çek
  const fetchMembers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const json = await res.json();
      if (json.success && json.data) {
        setMembers(json.data.customers || []);
      }
    } catch (err) {
      console.error('Üye listesi yüklenemedi:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  // Filtrelenmiş Üyeler
  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return members.filter((m) => {
      const isApproved = m.phoneVerified === true;
      const isBlocked = m.isBlocked === true;

      // Durum Filtresi
      if (statusFilter === 'pending' && (isApproved || isBlocked)) return false;
      if (statusFilter === 'active' && (!isApproved || isBlocked)) return false;
      if (statusFilter === 'blocked' && !isBlocked) return false;

      // Arama Filtresi
      if (!q) return true;
      const name = String(m.name || '').toLowerCase();
      const email = String(m.email || '').toLowerCase();
      const phone = String(m.phone || '').toLowerCase();
      const address = String(m.address || '').toLowerCase();
      return name.includes(q) || email.includes(q) || phone.includes(q) || address.includes(q);
    });
  }, [members, searchQuery, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedMembers = useMemo(() => {
    return filteredMembers.slice(
      (safeCurrentPage - 1) * pageSize,
      safeCurrentPage * pageSize
    );
  }, [filteredMembers, safeCurrentPage, pageSize]);

  // Metrikler
  const stats = useMemo(() => {
    const total = members.length;
    const blocked = members.filter((m) => m.isBlocked === true).length;
    const pending = members.filter((m) => m.phoneVerified !== true && m.isBlocked !== true).length;
    const active = members.filter((m) => m.phoneVerified === true && m.isBlocked !== true).length;
    const totalOrders = members.reduce((sum, m) => sum + (Array.isArray(m.orders) ? m.orders.length : 0), 0);
    return { total, pending, active, blocked, totalOrders };
  }, [members]);

  // Bildirim Modalı Aç
  const handleOpenNotifyModal = (member = null) => {
    setSelectedMemberForNotify(member);
    setNotifyTitle(member ? `Sn. ${member.name}` : 'Özel Fırsat & Duyuru');
    setNotifyMessage('');
    setNotifyChannel('system');
    setIsNotifyModalOpen(true);
  };

  // Bildirim Gönder
  const handleSendNotification = async (e) => {
    e.preventDefault();
    if (!notifyMessage.trim()) {
      alert('Lütfen bildirim mesajını yazınız.');
      return;
    }

    setIsSendingNotify(true);
    try {
      const targetId = selectedMemberForNotify ? selectedMemberForNotify.id : 'all';
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'customer',
          action: 'notify',
          id: targetId,
          title: notifyTitle.trim() || 'Bilgilendirme',
          message: notifyMessage.trim(),
          channel: notifyChannel
        })
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.error || 'Bildirim iletilemedi.');
        setIsSendingNotify(false);
        return;
      }

      // WhatsApp seçildiyse ve tek üyeyse doğrudan WhatsApp uygulamasını/webini aç
      if (notifyChannel === 'whatsapp' && selectedMemberForNotify?.phone) {
        const waPhone = toWhatsAppPhone(selectedMemberForNotify.phone);
        const waText = encodeURIComponent(`🥪 *Sandwich Diyarı*\n\n*${notifyTitle}*\n${notifyMessage}`);
        window.open(`https://wa.me/${waPhone}?text=${waText}`, '_blank');
      }

      setIsNotifyModalOpen(false);
      setMembers(Array.isArray(json.data?.customers) ? json.data.customers : members);
      if (onCustomerUpdated) onCustomerUpdated(json.data?.customers);

      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('sandwich_notifications_updated', String(Date.now()));
        }
      } catch (e) {}

      dispatch(
        showMessageModal({
          title: 'Bildirim İletildi 🚀',
          text: selectedMemberForNotify
            ? `"${selectedMemberForNotify.name}" isimli üyeye bildirim başarıyla kaydedildi.`
            : 'Tüm kayıtlı üyelere bildirim başarıyla iletildi.',
          type: 'success'
        })
      );
    } catch (err) {
      alert('Bildirim gönderilirken bir hata oluştu.');
    } finally {
      setIsSendingNotify(false);
    }
  };

  // Yeni Müşteri Ekle Modalı Aç
  const handleOpenAddCustomer = () => {
    setEditingMember(null);
    setCustName('');
    setCustEmail('');
    setCustPhone('');
    setCustAddress('');
    setCustPass('');
    setCustVerified(true);
    setCustFormError('');
    setIsCustomerModalOpen(true);
  };

  // Müşteri Düzenleme Modalı Aç
  const handleOpenEditCustomer = (member) => {
    setEditingMember(member);
    setCustName(member.name || '');
    setCustEmail(member.email || '');
    setCustPhone(member.phone || '');
    setCustAddress(member.address || '');
    setCustPass('');
    setCustVerified(member.phoneVerified === true);
    setCustFormError('');
    setIsCustomerModalOpen(true);
  };

  // Müşteri Ekle veya Güncelle
  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    setCustFormError('');

    if (!custName.trim() || custName.trim().length < 2) {
      setCustFormError('Lütfen geçerli bir Ad Soyad giriniz.');
      return;
    }

    if (!custEmail.trim() && !custPhone.trim()) {
      setCustFormError('E-posta adresi veya telefon numarasından en az biri zorunludur.');
      return;
    }

    if (!editingMember && (!custPass.trim() || custPass.trim().length < 4)) {
      setCustFormError('Müşteri giriş şifresi en az 4 karakter olmalıdır.');
      return;
    }

    if (editingMember && custPass.trim() && custPass.trim().length < 4) {
      setCustFormError('Yeni şifre en az 4 karakter olmalıdır.');
      return;
    }

    setIsSavingCustomer(true);
    try {
      const payload = {
        entityType: 'customer',
        action: editingMember ? 'update' : 'create',
        ...(editingMember ? { id: editingMember.id || editingMember.email } : {}),
        name: custName.trim(),
        email: custEmail.trim(),
        phone: custPhone.trim(),
        address: custAddress.trim(),
        phoneVerified: custVerified,
        ...(custPass.trim() ? { pass: custPass.trim() } : {})
      };

      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();

      if (!json.success) {
        setCustFormError(json.error || 'Müşteri kaydedilemedi.');
        setIsSavingCustomer(false);
        return;
      }

      if (Array.isArray(json.data?.customers)) {
        setMembers(json.data.customers);
      } else {
        await fetchMembers();
      }
      if (onCustomerUpdated) onCustomerUpdated(json.data?.customers);

      setIsCustomerModalOpen(false);
      dispatch(
        showMessageModal({
          title: editingMember ? 'Müşteri Güncellendi ✅' : 'Yeni Müşteri Eklendi 🎉',
          text: editingMember
            ? `"${custName.trim()}" bilgileri başarıyla güncellendi.`
            : `"${custName.trim()}" sisteme eklendi.${custVerified ? ' Doğrudan giriş yapıp sipariş verebilir.' : ' Onay bekliyor durumunda kaydedildi.'}`,
          type: 'success'
        })
      );
    } catch (err) {
      setCustFormError('Sunucu bağlantı hatası oluştu.');
    } finally {
      setIsSavingCustomer(false);
    }
  };

  // Üyeyi Onayla & Girişe İzin Ver
  const handleApproveMember = async (member) => {
    if (!member) return;
    const targetId = member.id || member.email;
    setApprovingId(targetId);
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
      if (!json.success) {
        alert(json.error || 'Üyelik onaylanamadı.');
        return;
      }

      if (Array.isArray(json.data?.customers)) {
        setMembers(json.data.customers);
      } else {
        setMembers((prev) =>
          prev.map((m) =>
            m.id === member.id || m.email === member.email
              ? { ...m, phoneVerified: true, phoneVerifiedAt: new Date().toISOString(), isBlocked: false }
              : m
          )
        );
      }
      if (onCustomerUpdated) onCustomerUpdated(json.data?.customers);

      dispatch(
        showMessageModal({
          title: 'Üyelik Onaylandı! 🎉',
          text: `"${member.name}" başarıyla onaylandı ve oturum açma yetkisi verildi. Müşteri web sitesinden giriş yapabilir.`,
          type: 'success'
        })
      );
    } catch (err) {
      alert('Onaylama işlemi sırasında bir hata oluştu.');
    } finally {
      setApprovingId(null);
    }
  };

  // Engelleme Modalı Aç
  const handleOpenBlockModal = (member) => {
    setSelectedMemberForBlock(member);
    setBlockReason('');
    setIsBlockModalOpen(true);
  };

  // Üye Engelle
  const handleConfirmBlock = async () => {
    if (!selectedMemberForBlock) return;
    setIsBlocking(true);
    try {
      const targetId = selectedMemberForBlock.id || selectedMemberForBlock.email;
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'customer',
          action: 'block',
          id: targetId,
          reason: blockReason.trim() || 'Kullanım şartları ve sipariş kuralları ihlali'
        })
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.error || 'Üye engellenemedi.');
        setIsBlocking(false);
        return;
      }

      setIsBlockModalOpen(false);
      if (Array.isArray(json.data?.customers)) {
        setMembers(json.data.customers);
      }
      if (onCustomerUpdated) onCustomerUpdated(json.data?.customers);

      // Oturumu anında düşürmek için cross-tab bildirim yayınla
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(
            'sandwich_session_event',
            JSON.stringify({
              action: 'blocked',
              email: selectedMemberForBlock.email,
              id: selectedMemberForBlock.id,
              timestamp: Date.now()
            })
          );
        }
      } catch (e) {}

      dispatch(
        showMessageModal({
          title: 'Üye Engellendi 🚫',
          text: `"${selectedMemberForBlock.name}" hesabı engellendi. Artık sipariş veremez ve açık oturumu sonlandırıldı.`,
          type: 'warning'
        })
      );
    } catch (err) {
      alert('İşlem sırasında hata oluştu.');
    } finally {
      setIsBlocking(false);
    }
  };

  // Engeli Kaldır
  const handleUnblock = async (member) => {
    if (!confirm(`"${member.name}" isimli üyenin engelini kaldırmak istediğinize emin misiniz?`)) return;

    try {
      const targetId = member.id || member.email;
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'customer',
          action: 'unblock',
          id: targetId
        })
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.error || 'Engel kaldırılamadı.');
        return;
      }

      if (Array.isArray(json.data?.customers)) {
        setMembers(json.data.customers);
      }
      if (onCustomerUpdated) onCustomerUpdated(json.data?.customers);

      dispatch(
        showMessageModal({
          title: 'Engel Kaldırıldı 🟢',
          text: `"${member.name}" isimli üyenin engeli kaldırıldı ve hesabı tekrar aktif hale getirildi.`,
          type: 'success'
        })
      );
    } catch (err) {
      alert('Engel kaldırılırken hata oluştu.');
    }
  };

  // Üye Sil
  const handleDeleteMember = async (member) => {
    if (!confirm(`"${member.name}" (${member.email}) isimli üyeyi sistemden kalıcı olarak silmek istediğinize emin misiniz?`)) return;

    try {
      const targetId = member.id || member.email;
      const res = await fetch(`/api/admin/users?type=customer&id=${encodeURIComponent(targetId)}`, {
        method: 'DELETE'
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.error || 'Üye silinemedi.');
        return;
      }

      if (Array.isArray(json.data?.customers)) {
        setMembers(json.data.customers);
      } else {
        setMembers((prev) => prev.filter((m) => m.id !== member.id && m.email !== member.email));
      }
      if (onCustomerUpdated) onCustomerUpdated(json.data?.customers);

      // Oturumu anında kapatmak için cross-tab bildirim yayınla & varsa yerel oturumu sil
      try {
        if (typeof window !== 'undefined') {
          const savedStr = localStorage.getItem('sd_current_user');
          if (savedStr) {
            const parsed = JSON.parse(savedStr);
            if (
              parsed?.id === member.id ||
              parsed?.email?.toLowerCase() === member.email?.toLowerCase()
            ) {
              localStorage.removeItem('sd_current_user');
              localStorage.removeItem('sd_auth_token');
            }
          }
          localStorage.setItem(
            'sandwich_session_event',
            JSON.stringify({
              action: 'deleted',
              email: member.email,
              id: member.id,
              timestamp: Date.now()
            })
          );
        }
      } catch (e) {}

      dispatch(
        showMessageModal({
          title: 'Üye Silindi 🗑️',
          text: `"${member.name}" başarıyla silindi ve açık olan tüm oturumları kapatıldı.`,
          type: 'success'
        })
      );
    } catch (err) {
      alert('Silme işlemi başarısız oldu.');
    }
  };

  return (
    <div className="p-3 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 w-full min-w-0 font-poppins animate-in fade-in duration-200">
      {/* 1. ÜST BAŞLIK VE ÖZET METRİKLER */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-2xs">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-stone-900 flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-sm">
              <i className="fa-solid fa-users"></i>
            </span>
            <span>Kayıtlı Üye & Müşteri Yönetimi</span>
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            Yeni müşteri ekleyin, WhatsApp onay taleplerini tek tıkla onaylayın, düzenleyin veya oturumlarını yönetin.
          </p>
        </div>

        {/* Üst Aksiyon Butonları */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleOpenAddCustomer}
            className="bg-stone-900 hover:bg-black active:scale-98 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <i className="fa-solid fa-user-plus text-emerald-400"></i>
            <span>+ Yeni Müşteri Ekle</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenNotifyModal(null)}
            className="bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <i className="fa-solid fa-bullhorn text-amber-300"></i>
            <span>Tüm Üyelere Bildirim Gönder</span>
          </button>
        </div>
      </div>

      {/* ONAY BEKLEYENLER DİKKAT BANNERI */}
      {stats.pending > 0 && (
        <div className="bg-gradient-to-r from-amber-50 via-amber-100/70 to-emerald-50 border-2 border-amber-300 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center text-lg shrink-0 shadow-xs">
              <i className="fa-brands fa-whatsapp"></i>
            </div>
            <div>
              <h3 className="font-extrabold text-stone-900 text-sm sm:text-base flex items-center gap-2">
                <span>WhatsApp Onayı Bekleyen {stats.pending} Müşteri Var!</span>
                <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">Yeni Talep</span>
              </h3>
              <p className="text-xs text-stone-600 mt-0.5">
                Müşteriler WhatsApp üzerinden kayıt onayı istedi. Aşağıdaki listeden tek tıkla onaylayıp sisteme girmelerine izin verebilirsiniz.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStatusFilter('pending')}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer shrink-0 flex items-center gap-1.5"
          >
            <i className="fa-solid fa-user-clock text-xs"></i>
            <span>Onay Bekleyenleri Göster ({stats.pending})</span>
          </button>
        </div>
      )}

      {/* 2. DÖRT İSTATİSTİK KARTI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-stone-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 block">Toplam Üye</span>
            <span className="text-xl sm:text-2xl font-black text-stone-900 mt-0.5 block">{stats.total}</span>
          </div>
          <span className="w-10 h-10 rounded-xl bg-stone-100 text-stone-600 flex items-center justify-center text-base shrink-0">
            <i className="fa-solid fa-users"></i>
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 block">Onay Bekleyen</span>
            <span className="text-xl sm:text-2xl font-black text-amber-700 mt-0.5 block">{stats.pending}</span>
          </div>
          <span className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-base shrink-0">
            <i className="fa-solid fa-user-clock"></i>
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 block">Aktif Üyeler</span>
            <span className="text-xl sm:text-2xl font-black text-emerald-700 mt-0.5 block">{stats.active}</span>
          </div>
          <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-base shrink-0">
            <i className="fa-solid fa-user-check"></i>
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 block">Engellenenler</span>
            <span className="text-xl sm:text-2xl font-black text-rose-700 mt-0.5 block">{stats.blocked}</span>
          </div>
          <span className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center text-base shrink-0">
            <i className="fa-solid fa-user-slash"></i>
          </span>
        </div>
      </div>

      {/* 3. ARAMA VE FİLTRELEME ÇUBUĞU */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-stone-200/90 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Durum Filtreleme Sekmeleri */}
        <div className="flex items-center gap-1 bg-stone-100/80 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'all' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Tümü ({stats.total})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'pending'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-amber-800 hover:text-amber-950 font-extrabold'
            }`}
          >
            <span>Onay Bekleyenler</span>
            {stats.pending > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                statusFilter === 'pending' ? 'bg-white text-amber-800' : 'bg-amber-200 text-amber-900'
              }`}>
                {stats.pending}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'active' ? 'bg-white text-emerald-800 shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Aktifler ({stats.active})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('blocked')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'blocked' ? 'bg-white text-rose-800 shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Engellenenler ({stats.blocked})
          </button>
        </div>

        {/* Arama Kutusu ve Yenile */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs"></i>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="İsim, e-posta veya telefon ara..."
              className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-8 pr-3 py-2 text-xs focus:outline-none focus:border-stone-400 font-medium"
            />
          </div>

          <button
            type="button"
            onClick={fetchMembers}
            title="Listeyi Yenile"
            className="p-2.5 rounded-xl text-stone-600 hover:text-stone-900 bg-stone-50 hover:bg-stone-100 border border-stone-200 transition-colors cursor-pointer shrink-0"
          >
            <i className={`fa-solid fa-arrows-rotate text-xs ${loading ? 'animate-spin' : ''}`}></i>
          </button>
        </div>
      </div>

      {/* 4. ÜYE LİSTESİ */}
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs overflow-hidden">
        {loading && members.length === 0 ? (
          <div className="p-12 text-center text-stone-400 space-y-2">
            <i className="fa-solid fa-users text-3xl animate-pulse text-indigo-400"></i>
            <p className="text-xs font-semibold text-stone-600">Üye listesi yükleniyor...</p>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="p-12 text-center text-stone-400 space-y-3">
            <i className="fa-solid fa-user-xmark text-3xl text-stone-300"></i>
            <p className="text-xs font-semibold text-stone-600">
              {searchQuery || statusFilter !== 'all' ? 'Arama kriterlerine uygun üye bulunamadı.' : 'Henüz sisteme kayıtlı üye bulunmuyor.'}
            </p>
            {!searchQuery && statusFilter === 'all' && (
              <button
                type="button"
                onClick={handleOpenAddCustomer}
                className="inline-flex items-center gap-2 bg-stone-900 hover:bg-black text-white font-bold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer shadow-xs"
              >
                <i className="fa-solid fa-user-plus text-emerald-400"></i>
                <span>+ İlk Müşteriyi Ekle</span>
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {paginatedMembers.map((member) => {
              const isBlocked = member.isBlocked === true;
              const initials = (member.name || 'Ü')
                .split(' ')
                .filter(Boolean)
                .slice(0, 2)
                .map((n) => n[0]?.toUpperCase())
                .join('');
              const phoneClean = String(member.phone || '').replace(/\D/g, '');
              const waUrl = phoneClean ? `https://wa.me/${toWhatsAppPhone(member.phone)}` : '';

              return (
                <div
                  key={member.id || member.email}
                  className={`p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                    isBlocked ? 'bg-rose-50/40 hover:bg-rose-50/60' : 'hover:bg-stone-50/70'
                  }`}
                >
                  {/* Sol: Avatar + İsim + İletişim Bilgileri */}
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 border ${
                        isBlocked
                          ? 'bg-rose-100 text-rose-700 border-rose-300'
                          : 'bg-indigo-100 text-indigo-700 border-indigo-200'
                      }`}
                    >
                      {initials}
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-extrabold text-stone-900 text-sm sm:text-base leading-tight truncate">
                          {member.name || 'İsimsiz Üye'}
                        </h4>

                        {/* Durum Rozeti */}
                        {isBlocked ? (
                          <span
                            className="bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md inline-flex items-center gap-1 shadow-2xs"
                            title={member.blockReason ? `Sebep: ${member.blockReason}` : 'Yönetici tarafından engellendi'}
                          >
                            <i className="fa-solid fa-ban text-[9px]"></i>
                            <span>Engellendi</span>
                          </span>
                        ) : member.phoneVerified !== true ? (
                          <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold px-2 py-0.5 rounded-md inline-flex items-center gap-1 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            <span>⏳ Onay Bekliyor</span>
                          </span>
                        ) : (
                          <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span>Aktif Üye</span>
                          </span>
                        )}

                        {/* Sipariş Sayısı Rozeti */}
                        <span className="bg-stone-100 text-stone-600 font-bold text-[10px] px-2 py-0.5 rounded-md">
                          {Array.isArray(member.orders) ? member.orders.length : 0} Sipariş
                        </span>
                      </div>

                      {/* İletişim & Adres Satırı */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500 font-medium">
                        <span className="inline-flex items-center gap-1 text-stone-700">
                          <i className="fa-regular fa-envelope text-[11px] text-stone-400"></i>
                          <span>{member.email}</span>
                        </span>

                        {member.phone && (
                          <span className="inline-flex items-center gap-1 font-mono text-stone-700">
                            <i className="fa-solid fa-phone text-[10px] text-stone-400"></i>
                            <span>{member.phone}</span>
                          </span>
                        )}

                        {member.address && (
                          <span className="hidden sm:inline-flex items-center gap-1 text-stone-500 truncate max-w-xs">
                            <i className="fa-solid fa-location-dot text-[10px] text-stone-400"></i>
                            <span className="truncate">{member.address}</span>
                          </span>
                        )}
                      </div>

                      {/* Engelleme Sebebi Varsa Göster */}
                      {isBlocked && member.blockReason && (
                        <p className="text-[11px] font-semibold text-rose-700 pt-0.5">
                          <i className="fa-solid fa-circle-exclamation mr-1 text-[10px]"></i>
                          <strong>Engel Sebebi:</strong> {member.blockReason}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Sağ: Aksiyon Butonları (Onayla, Bildirim, Engelle/Kaldır, WhatsApp, Sil) */}
                  <div className="flex flex-wrap items-center gap-2 self-end sm:self-center shrink-0">
                    {/* ONAY BEKLEYEN ÜYE: ONAYLA VE GİRİŞ İZNİ VER */}
                    {!isBlocked && member.phoneVerified !== true && (
                      <button
                        type="button"
                        disabled={approvingId === (member.id || member.email)}
                        onClick={() => handleApproveMember(member)}
                        className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-stone-300 text-white font-black text-xs px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs active:scale-95"
                        title="Üyeliği Onayla ve Giriş İzni Ver"
                      >
                        <i className={`fa-solid ${approvingId === (member.id || member.email) ? 'fa-spinner animate-spin' : 'fa-check'} text-xs`}></i>
                        <span>{approvingId === (member.id || member.email) ? 'Onaylanıyor...' : 'Onayla & İzin Ver'}</span>
                      </button>
                    )}

                    {/* 1. Bildirim Gönder Butonu */}
                    <button
                      type="button"
                      onClick={() => handleOpenNotifyModal(member)}
                      className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs px-3 py-2 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 border border-indigo-200/80 shadow-2xs"
                      title="Bu üyeye SMS, WhatsApp veya sistem bildirimi ilet"
                    >
                      <i className="fa-solid fa-bell text-xs"></i>
                      <span>Bildirim</span>
                    </button>

                    {/* 2. WhatsApp Butonu */}
                    {waUrl && (
                      <a
                        href={member.phoneVerified !== true
                          ? `https://wa.me/${toWhatsAppPhone(member.phone)}?text=${encodeURIComponent(`Merhaba Sn. ${member.name}, Sandviç Diyarı kaydınız için teşekkür ederiz. Hesabınız inceleniyor / onaylandı.`)}`
                          : waUrl
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs px-3 py-2 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 border border-emerald-200/80 shadow-2xs"
                        title="WhatsApp üzerinden mesaj gönder"
                      >
                        <i className="fa-brands fa-whatsapp text-emerald-600 text-sm"></i>
                        <span className="hidden lg:inline">{member.phoneVerified !== true ? "WhatsApp Yaz" : "WhatsApp"}</span>
                      </a>
                    )}

                    {/* 3. Engelle / Engeli Kaldır Butonu */}
                    {isBlocked ? (
                      <button
                        type="button"
                        onClick={() => handleUnblock(member)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-2 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                        title="Üyenin engelini kaldır ve hesabı aktif et"
                      >
                        <i className="fa-solid fa-lock-open text-xs"></i>
                        <span>Engeli Kaldır</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenBlockModal(member)}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs px-3 py-2 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 border border-rose-200 shadow-2xs"
                        title="Bu üyenin sipariş vermesini ve girişini engelle"
                      >
                        <i className="fa-solid fa-user-slash text-xs"></i>
                        <span>Engelle</span>
                      </button>
                    )}

                    {/* 3.5. Düzenle Butonu */}
                    <button
                      type="button"
                      onClick={() => handleOpenEditCustomer(member)}
                      className="bg-stone-50 hover:bg-stone-100 text-stone-700 font-bold text-xs px-3 py-2 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 border border-stone-200 shadow-2xs"
                      title="Müşteri bilgilerini düzenle"
                    >
                      <i className="fa-solid fa-pen-to-square text-xs"></i>
                      <span className="hidden xl:inline">Düzenle</span>
                    </button>

                    {/* 4. Sil Butonu */}
                    <button
                      type="button"
                      onClick={() => handleDeleteMember(member)}
                      className="text-stone-400 hover:text-rose-600 hover:bg-rose-50 border border-stone-200 p-2 rounded-xl text-xs cursor-pointer transition-colors"
                      title="Üyeyi Sistemden Kalıcı Olarak Sil"
                    >
                      <i className="fa-solid fa-trash-can"></i>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SAYFALAMA KONTROLLERİ */}
      <AdminPagination
        currentPage={safeCurrentPage}
        totalItems={filteredMembers.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        itemLabel="üye"
      />

      {/* 5. BİLDİRİM GÖNDERME MODALI */}
      {isNotifyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-sm">
                  <i className="fa-solid fa-paper-plane"></i>
                </span>
                <div>
                  <h3 className="font-extrabold text-base text-stone-900">
                    {selectedMemberForNotify ? `"${selectedMemberForNotify.name}" Üyesine Bildirim` : 'Tüm Üyelere Toplu Bildirim'}
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    {selectedMemberForNotify
                      ? `${selectedMemberForNotify.email} (${selectedMemberForNotify.phone || 'Telefon yok'})`
                      : `Sistemdeki toplam ${members.length} kayıtlı üyeye iletilir`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNotifyModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 p-1.5 rounded-xl hover:bg-stone-100 cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <form onSubmit={handleSendNotification} className="space-y-4">
              {/* Gönderim Kanalı Seçimi */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">Gönderim Kanalı</label>
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${
                      notifyChannel === 'system'
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-bold'
                        : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="notifyChannel"
                      value="system"
                      checked={notifyChannel === 'system'}
                      onChange={() => setNotifyChannel('system')}
                      className="accent-indigo-600"
                    />
                    <div className="min-w-0">
                      <span className="text-xs block">Sistem Bildirimi</span>
                      <span className="text-[10px] text-stone-400 font-normal">Kullanıcı paneli & bildirim balonu</span>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${
                      notifyChannel === 'whatsapp'
                        ? 'border-emerald-600 bg-emerald-50/50 text-emerald-950 font-bold'
                        : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="notifyChannel"
                      value="whatsapp"
                      checked={notifyChannel === 'whatsapp'}
                      onChange={() => setNotifyChannel('whatsapp')}
                      className="accent-emerald-600"
                    />
                    <div className="min-w-0">
                      <span className="text-xs block flex items-center gap-1">
                        <i className="fa-brands fa-whatsapp text-emerald-600"></i> WhatsApp Mesajı
                      </span>
                      <span className="text-[10px] text-stone-400 font-normal">Doğrudan telefonuna iletilir</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Bildirim Başlığı */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Bildirim Başlığı</label>
                <input
                  type="text"
                  required
                  value={notifyTitle}
                  onChange={(e) => setNotifyTitle(e.target.value)}
                  placeholder="Örn: %20 Hafta Sonu İndirimi veya Siparişiniz Hakkında"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-stone-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Bildirim Mesajı */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Bildirim Mesajı</label>
                <textarea
                  required
                  rows={4}
                  value={notifyMessage}
                  onChange={(e) => setNotifyMessage(e.target.value)}
                  placeholder="Üyeye iletmek istediğiniz bilgilendirme, kampanya veya uyarı mesajını buraya yazınız..."
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-indigo-500 resize-none font-normal"
                />
              </div>

              {/* Hızlı Şablon Butonları */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Hızlı Şablonlar</span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setNotifyTitle('🎉 Sandviç Diyarı Özel İndirim Kuponu');
                      setNotifyMessage('Merhaba! Bu haftaya özel tüm maxi sandviçlerde %15 indirim hesabınıza tanımlandı. Afiyet olsun!');
                    }}
                    className="bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    🏷️ İndirim Kuponu
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNotifyTitle('🛵 Siparişiniz Hakkında Bilgilendirme');
                      setNotifyMessage('Merhaba! Siparişiniz özenle hazırlanıyor, kuryemiz birazdan yola çıkacaktır.');
                    }}
                    className="bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    📦 Sipariş Durumu
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNotifyTitle('⚠️ Önemli Hesap Bilgilendirmesi');
                      setNotifyMessage('Lütfen teslimat adresinizi ve iletişim numaranızı güncel tutunuz.');
                    }}
                    className="bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    ⚠️ Hesap Uyarısı
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsNotifyModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs cursor-pointer transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isSendingNotify}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer shadow-sm transition-all flex items-center gap-1.5"
                >
                  <i className={`fa-solid fa-paper-plane ${isSendingNotify ? 'animate-bounce' : ''}`}></i>
                  <span>{isSendingNotify ? 'Gönderiliyor...' : 'Bildirimi Gönder'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. ENGELLEME ONAY MODALI */}
      {isBlockModalOpen && selectedMemberForBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <span className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center text-lg shrink-0">
                <i className="fa-solid fa-user-slash"></i>
              </span>
              <div>
                <h3 className="font-extrabold text-base text-stone-900">Üyeyi Engelle</h3>
                <p className="text-xs text-stone-500">{selectedMemberForBlock.name} ({selectedMemberForBlock.email})</p>
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800">
              <p className="font-bold flex items-center gap-1 mb-1">
                <i className="fa-solid fa-triangle-exclamation"></i>
                <span>Dikkat Edilmesi Gerekenler:</span>
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] opacity-90">
                <li>Üyenin yeni sipariş vermesi engellenir.</li>
                <li>Mevcut oturumu sonlandırılır ve tekrar giriş yapamaz.</li>
                <li>Dilediğiniz an bu ekrandan engeli kaldırabilirsiniz.</li>
              </ul>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Engelleme Sebebi</label>
              <select
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                className="app-select w-full bg-stone-50 hover:bg-stone-100/60 border border-stone-200 hover:border-rose-400 rounded-2xl px-4 py-3 text-xs text-stone-900 focus:outline-none focus:border-rose-500 font-bold mb-2 cursor-pointer shadow-2xs transition-all"
              >
                <option value="">Sebep seçin (veya aşağıya yazın)...</option>
                <option value="Hatalı / Asılsız Siparişler">🚫 Hatalı / Asılsız Siparişler</option>
                <option value="Kapıda Ödeme Yapılmaması">💳 Kapıda Ödeme Yapılmaması</option>
                <option value="Kuryeye Teslimat Problemi">🛵 Kuryeye Teslimat Problemi</option>
                <option value="Sistem Kötüye Kullanımı">⚠️ Sistem Kötüye Kullanımı</option>
                <option value="Müşteri İsteği ile Hesap Kapatma">🔒 Müşteri İsteği ile Hesap Kapatma</option>
              </select>

              <input
                type="text"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Özel sebep belirtin (örn: 3 kez adreste bulunamadı)"
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2 text-xs text-stone-900 focus:outline-none focus:border-rose-400"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setIsBlockModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs cursor-pointer transition-colors"
              >
                İptal
              </button>
              <button
                type="button"
                disabled={isBlocking}
                onClick={handleConfirmBlock}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer shadow-sm transition-all flex items-center gap-1.5"
              >
                <i className={`fa-solid fa-ban ${isBlocking ? 'animate-spin' : ''}`}></i>
                <span>{isBlocking ? 'İşleniyor...' : 'Hesabı Engelle'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. YENİ MÜŞTERİ EKLE / DÜZENLE MODALI */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm">
                  <i className={`fa-solid ${editingMember ? 'fa-user-pen' : 'fa-user-plus'}`}></i>
                </span>
                <div>
                  <h3 className="font-extrabold text-base text-stone-900">
                    {editingMember ? 'Müşteri Bilgilerini Düzenle' : 'Yeni Müşteri Ekle'}
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    {editingMember
                      ? `${editingMember.name} hesabını güncelleyin`
                      : 'Sisteme doğrudan kayıtlı müşteri oluşturun'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 p-1.5 rounded-xl hover:bg-stone-100 cursor-pointer"
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
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-stone-400 font-semibold"
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
                <textarea
                  rows={2}
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                  placeholder="Mahalle, sokak, bina ve daire bilgisi..."
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-stone-400 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Giriş Şifresi {editingMember ? '(Opsiyonel)' : '*'}
                </label>
                <input
                  type="text"
                  required={!editingMember}
                  value={custPass}
                  onChange={(e) => setCustPass(e.target.value)}
                  placeholder={
                    editingMember
                      ? 'Şifreyi değiştirmek istemiyorsanız boş bırakın'
                      : 'En az 4 karakter şifre belirleyin (Örn: 123456)'
                  }
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-stone-400"
                />
              </div>

              <label className="flex items-center gap-2.5 bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={custVerified}
                  onChange={(e) => setCustVerified(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded"
                />
                <div>
                  <span className="text-xs font-bold text-stone-900 block">
                    Onaylı / Aktif Üye (Giriş İzni Açık)
                  </span>
                  <span className="text-[11px] text-stone-500">
                    İşaretli olduğunda müşteri WhatsApp onayı beklemeden hemen giriş yapabilir.
                  </span>
                </div>
              </label>

              {custFormError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3.5 py-2.5 rounded-xl text-xs font-semibold">
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
                  disabled={isSavingCustomer}
                  className="px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-black text-white font-bold text-xs cursor-pointer shadow-xs transition-all flex items-center gap-1.5"
                >
                  <i className={`fa-solid ${isSavingCustomer ? 'fa-spinner animate-spin' : 'fa-check'}`}></i>
                  <span>{isSavingCustomer ? 'Kaydediliyor...' : editingMember ? 'Değişiklikleri Kaydet' : 'Müşteriyi Oluştur'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

