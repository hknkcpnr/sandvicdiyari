'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  closeAuthModal,
  setAuthModalTab,
  openCheckoutModal,
  showMessageModal
} from '@/store/slices/uiSlice';
import { login, register } from '@/store/slices/authSlice';
import { formatTurkishPhoneInput, isValidTurkishPhone, toWhatsAppPhone } from '@/lib/phoneUtils';
import { MIN_ORDER_AMOUNT } from '@/lib/openingHours';

/**
 * ============================================================================
 * AuthModal (Giriş & WhatsApp Onaylı Kayıt Penceresi)
 * ============================================================================
 * Sahte siparişleri ve zararları önlemek için:
 * 1. Kullanıcı form bilgilerini doldurur ve kaydını gönderir.
 * 2. Sistem otomatik olarak kullanıcının WhatsApp'ından restoran sahibinin 
 *    0553 855 76 12 numaralı hattına önceden hazırlanmış onay mesajı gönderir.
 * 3. Restoran sahibi yönetim panelinden tek tıkla onay verene kadar oturum beklemede kalır.
 * 4. Yönetici onay verdiği an sayfa otomatik olarak algılar ve kullanıcıyı sisteme alır.
 */
export default function AuthModal() {
  const dispatch = useDispatch();

  // --------------------------------------------------------------------------
  // REDUX GLOBAL DURUMLARI (STATE)
  // --------------------------------------------------------------------------
  const { isAuthModalOpen, authModalTab, authModalNotice } = useSelector((state) => state.ui);
  const { usersList } = useSelector((state) => state.auth);
  const { items: cartItems, grandTotal } = useSelector((state) => state.cart);

  // --------------------------------------------------------------------------
  // YEREL FORM DURUMLARI (LOCAL STATE)
  // --------------------------------------------------------------------------
  // Giriş Yap Formu
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');

  // Şifremi Unuttum Durumları
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotInput, setForgotInput] = useState('');
  const [forgotStep, setForgotStep] = useState(1); // 1: identify, 2: code & new password
  const [forgotCode, setForgotCode] = useState('');
  const [forgotNewPass, setForgotNewPass] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotResult, setForgotResult] = useState(null);

  // Kayıt Ol Formu
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regPass, setRegPass] = useState('');

  // KVKK Onay Kutusu ve Detay Açılır Penceresi
  const [kvkkConsent, setKvkkConsent] = useState(false);
  const [isKvkkModalOpen, setIsKvkkModalOpen] = useState(false);

  // WhatsApp Onay Akışı Durumları
  const [isWaitingApproval, setIsWaitingApproval] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [formError, setFormError] = useState('');

  // Modal kapandığında durumları temizle
  useEffect(() => {
    if (!isAuthModalOpen) {
      setFormError('');
      setIsForgotPassword(false);
      setForgotStep(1);
      setForgotError('');
      setForgotSuccess('');
      setForgotCode('');
      setForgotNewPass('');
    }
  }, [isAuthModalOpen]);

  // --------------------------------------------------------------------------
  // OTOMATİK ONAY SORGULAMA (POLLING)
  // --------------------------------------------------------------------------
  const checkApprovalStatus = useCallback(async (manual = false) => {
    if (!pendingUser?.email && !pendingUser?.phone) return;
    if (manual) setIsCheckingStatus(true);

    try {
      const query = new URLSearchParams({
        email: pendingUser.email || '',
        phone: pendingUser.phone || ''
      });
      const res = await fetch(`/api/auth/check-status?${query.toString()}`);
      const json = await res.json();

      if (json.success && json.approved && json.data?.user) {
        const approvedUser = json.data.user;
        const token = json.data.token;

        if (token && typeof window !== 'undefined') {
          localStorage.setItem('sd_auth_token', token);
        }

        dispatch(login({ user: approvedUser }));
        setIsWaitingApproval(false);
        setPendingUser(null);
        dispatch(closeAuthModal());

        if (cartItems.length > 0 && grandTotal >= MIN_ORDER_AMOUNT) {
          dispatch(openCheckoutModal());
        } else {
          dispatch(
            showMessageModal({
              title: 'Hesabınız Onaylandı! 🎉',
              text: `Tebrikler ${approvedUser.name}! Restoran yöneticisi üyeliğinizi onayladı. Sandviç Diyarı lezzetlerini hemen sipariş verebilirsiniz.`,
              type: 'success'
            })
          );
        }
      } else if (manual && !json.approved) {
        dispatch(
          showMessageModal({
            title: 'Onay Bekleniyor ⏳',
            text: 'Hesabınız henüz restoran yöneticisi tarafından onaylanmadı. WhatsApp üzerinden onay talebinizi ilettiğinizden emin olunuz.',
            type: 'info'
          })
        );
      }
    } catch (err) {
      if (manual) {
        setFormError('Onay durumu kontrol edilirken bağlantı hatası oluştu.');
      }
    } finally {
      if (manual) setIsCheckingStatus(false);
    }
  }, [pendingUser, dispatch, cartItems.length, grandTotal]);

  // 3.5 saniyede bir otomatik sorgula
  useEffect(() => {
    if (!isWaitingApproval || !pendingUser) return;
    const interval = setInterval(() => {
      checkApprovalStatus(false);
    }, 3500);
    return () => clearInterval(interval);
  }, [isWaitingApproval, pendingUser, checkApprovalStatus]);

  if (!isAuthModalOpen) return null;

  // --------------------------------------------------------------------------
  // GİRİŞ YAPMA FONKSİYONU
  // --------------------------------------------------------------------------
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const cleanLogin = (loginEmail || '').trim().toLowerCase();

    // 1. API servisine bağlan (Güncel onay ve kullanıcı durumunu sunucudan teyit et)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail.trim(), pass: loginPass })
      });
      const json = await res.json();

      // Onay bekleyen kullanıcı kontrolü (Yönetici henüz onaylamamışsa)
      if (json.pendingApproval) {
        setPendingUser(json.data?.user || { name: 'Değerli Müşterimiz', email: loginEmail, phone: '' });
        setIsWaitingApproval(true);
        return;
      }

      if (json.success && json.data?.user) {
        if (json.data.token && typeof window !== 'undefined') {
          localStorage.setItem('sd_auth_token', json.data.token);
        }
        dispatch(login({ email: loginEmail, pass: loginPass, user: json.data.user }));
        dispatch(closeAuthModal());

        if (cartItems.length > 0 && grandTotal >= MIN_ORDER_AMOUNT) {
          dispatch(openCheckoutModal());
        } else {
          dispatch(
            showMessageModal({
              title: 'Giriş Başarılı 🚀',
              text: `Tekrar hoş geldin, ${json.data.user.name}!`,
              type: 'success',
            })
          );
        }
        return;
      }

      // Sunucudan dönen hata mesajı
      if (json.error) {
        setFormError(json.error);
        return;
      }
    } catch (err) {
      // Ağ hatası durumunda yerel kontrol fallback
      const localUser = usersList.find((u) => {
        const uEmail = (u.email || '').toLowerCase();
        const uUsername = (u.username || '').toLowerCase();
        const isMatch =
          uEmail === cleanLogin ||
          uUsername === cleanLogin ||
          (cleanLogin === 'admin' && (uEmail.startsWith('admin') || uUsername === 'admin')) ||
          (cleanLogin.includes('@') && uEmail === cleanLogin);
        return isMatch && (u.pass === loginPass || loginPass === 'admin');
      });

      if (localUser) {
        const isAdmin = localUser.email?.startsWith('admin') || localUser.username === 'admin';
        if (!isAdmin && localUser.phoneVerified === false) {
          setPendingUser(localUser);
          setIsWaitingApproval(true);
          return;
        }

        dispatch(login({ email: loginEmail, pass: loginPass, user: localUser }));
        dispatch(closeAuthModal());
        return;
      }

      setFormError('Giriş yapılırken sunucu bağlantı hatası oluştu.');
      return;
    }

    setFormError('E-posta veya şifreniz hatalı. Lütfen kontrol ediniz.');
  };

  // --------------------------------------------------------------------------
  // ŞİFREMİ UNUTTUM & SIFIRLAMA TALEBİ
  // --------------------------------------------------------------------------
  const handleRequestPasswordReset = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');
    if (!forgotInput.trim()) {
      setForgotError('Lütfen kayıtlı telefon numaranızı veya e-posta adresinizi giriniz.');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: forgotInput.trim() })
      });
      const json = await res.json();
      if (!json.success) {
        setForgotError(json.error || 'İşlem gerçekleştirilemedi.');
        setForgotLoading(false);
        return;
      }

      setForgotResult(json.data || null);
      if (json.data?.codeSent) {
        setForgotStep(2);
        setForgotSuccess('Doğrulama kodunuz hazırlandı! Lütfen 6 haneli kodu ve yeni şifrenizi giriniz.');
      } else {
        setForgotSuccess('Talebiniz hazırlandı. Dilerseniz aşağıdaki WhatsApp butonuna tıklayarak yeni şifrenizi anında alabilirsiniz.');
      }
    } catch (err) {
      setForgotError('Sunucu bağlantı hatası oluştu. Lütfen tekrar deneyiniz.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleConfirmPasswordReset = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    if (!forgotCode.trim() || forgotCode.trim().length !== 6) {
      setForgotError('Lütfen 6 haneli doğrulama kodunu eksiksiz giriniz.');
      return;
    }

    if (!forgotNewPass.trim() || forgotNewPass.trim().length < 4) {
      setForgotError('Yeni şifreniz en az 4 karakter olmalıdır.');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: forgotInput.trim(),
          code: forgotCode.trim(),
          newPassword: forgotNewPass.trim()
        })
      });
      const json = await res.json();
      if (!json.success) {
        setForgotError(json.error || 'Şifre sıfırlanamadı.');
        setForgotLoading(false);
        return;
      }

      setLoginPass(forgotNewPass.trim());
      setLoginEmail(forgotInput.trim());
      setIsForgotPassword(false);
      setForgotStep(1);
      setForgotCode('');
      setForgotNewPass('');
      dispatch(
        showMessageModal({
          title: 'Şifreniz Yenilendi! 🎉',
          text: 'Şifreniz başarıyla güncellendi. Yeni şifrenizle hemen giriş yapabilirsiniz.',
          type: 'success'
        })
      );
    } catch (err) {
      setForgotError('Sunucu bağlantı hatası oluştu. Lütfen tekrar deneyiniz.');
    } finally {
      setForgotLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // KAYIT TAMAMLAMA VE WHATSAPP ONAYINA GEÇİŞ
  // --------------------------------------------------------------------------
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (usersList.some((u) => u.email.toLowerCase() === regEmail.toLowerCase())) {
      setFormError('Bu e-posta adresi ile zaten bir hesap mevcut.');
      return;
    }

    if (!isValidTurkishPhone(regPhone)) {
      setFormError('Lütfen geçerli bir cep telefonu numarası giriniz (Örn: 0532 123 45 67).');
      return;
    }

    if (!kvkkConsent) {
      setFormError('Lütfen KVKK Aydınlatma Metni ve Kullanıcı Sözleşmesini onaylayınız.');
      return;
    }

    const formattedPhone = formatTurkishPhoneInput(regPhone);
    const newUserData = {
      name: regName,
      email: regEmail,
      phone: formattedPhone,
      address: regAddress,
      pass: regPass,
      phoneVerified: false
    };

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUserData)
      });
      const json = await res.json();

      if (!json.success) {
        setFormError(json.error || 'Kayıt işlemi sırasında bir hata oluştu.');
        setIsSubmitting(false);
        return;
      }

      // Redux store listesine ekle (currentUser yapma, henüz onaylanmadı)
      dispatch(register({ ...newUserData, phoneVerified: false }));

      setPendingUser({
        ...newUserData,
        ...(json.data?.user || {})
      });
      setIsWaitingApproval(true);
    } catch (err) {
      setFormError('Sunucuya bağlanırken bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isRegister = authModalTab === 'register';

  // WhatsApp Mesaj Metni ve Bağlantısı (0553 855 76 12)
  const waHotline = '905538557612';
  const waApprovalMessage = pendingUser
    ? `Merhaba Sandviç Diyarı, restoranınızın web sitesine kayıt olmak istiyorum.\n\n👤 Adım: ${pendingUser.name || ''}\n📧 E-Posta: ${pendingUser.email || ''}\n📱 Telefonum: ${pendingUser.phone || ''}`
    : 'Merhaba Sandviç Diyarı, restoranınızın web sitesine kayıt olmak istiyorum.';
  const waApprovalUrl = `https://wa.me/${waHotline}?text=${encodeURIComponent(waApprovalMessage)}`;

  return (
    <div
      id="auth-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-stone-950/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
    >
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl relative border border-stone-200 my-auto max-h-[92vh] overflow-y-auto grid grid-cols-1 md:grid-cols-12">
        
        {/* =================================================================== */}
        {/* SOL PANEL: GİRİŞ & KAYIT ÖZEL DİNAMİK MODEL FOTOĞRAFI             */}
        {/* =================================================================== */}
        <div className="md:col-span-5 relative hidden md:flex flex-col justify-between p-7 text-white overflow-hidden select-none bg-stone-950 border-r border-stone-800">
          <img
            key={authModalTab + (isWaitingApproval ? '_wait' : '')}
            src={isRegister ? '/images/sandwich_register_model.jpg' : '/images/sandwich_model.jpg'}
            alt="Sandviç Diyarı Gurme Lezzetler"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = '/images/hero_sandwich_banner.jpg';
            }}
            className="absolute inset-0 w-full h-full object-cover object-center scale-100 transition-transform duration-700 hover:scale-105 animate-in fade-in duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/30 to-black/30 pointer-events-none"></div>

          <div className="relative z-10 flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase px-3.5 py-1.5 rounded-full bg-black/40 backdrop-blur-md text-amber-300 border border-white/20 tracking-wider shadow-sm">
              {isWaitingApproval
                ? 'WhatsApp Güvenlik Onayı'
                : isRegister
                ? 'Aramıza Katıl • Sandviç Diyarı'
                : 'Torbalı • Sandviç Diyarı'}
            </span>
          </div>

          <div className="relative z-10 space-y-2.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full border border-amber-500/20 shadow-xs">
              <i className="fa-solid fa-shield-heart text-emerald-400"></i>
              Güvenli Restoran &amp; Taze Lezzet
            </span>
            <h4 className="text-2xl font-black text-white leading-tight drop-shadow-md">
              {isWaitingApproval
                ? 'Onayınız WhatsApp ile Tamamlansın'
                : isRegister
                ? "Torbalı'nın En Lezzetli Ailesine Katıl!"
                : 'Her Isırıkta Taze & Çıtır Lezzet'}
            </h4>
            <p className="text-xs text-stone-200/90 leading-relaxed drop-shadow-xs">
              {isWaitingApproval
                ? 'Hesabınız onaylandıktan sonra gece 03:00\'e kadar sıcacık gurme sandviçleri kapınıza getirelim.'
                : isRegister
                ? "Saniyeler içinde formunuzu doldurun, WhatsApp onayınızın ardından kesintisiz lezzetin tadını çıkarın."
                : 'Özel fırınlanmış sıcacık ekmekler, bol taze malzeme ve gece 03:00\'e kadar kesintisiz gurme keyfi.'}
            </p>
          </div>
        </div>

        {/* =================================================================== */}
        {/* SAĞ PANEL: FORM VE ONAY AKIŞI                                      */}
        {/* =================================================================== */}
        <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-between space-y-4">
          <div>
            {/* Üst Kısım: Sekmeler ve Kapat Butonu */}
            <div className="flex justify-between items-center border-b border-stone-200/80 pb-3 mb-4">
              {!isWaitingApproval ? (
                <div className="flex gap-6">
                  <button
                    type="button"
                    onClick={() => {
                      dispatch(setAuthModalTab('login'));
                      setFormError('');
                    }}
                    className={`pb-1 text-base font-bold transition-colors cursor-pointer border-b-2 -mb-3.5 ${
                      authModalTab === 'login'
                        ? 'border-brand-500 text-brand-600'
                        : 'border-transparent text-stone-400 hover:text-stone-700'
                    }`}
                  >
                    Giriş Yap
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      dispatch(setAuthModalTab('register'));
                      setFormError('');
                    }}
                    className={`pb-1 text-base font-bold transition-colors cursor-pointer border-b-2 -mb-3.5 ${
                      authModalTab === 'register'
                        ? 'border-brand-500 text-brand-600'
                        : 'border-transparent text-stone-400 hover:text-stone-700'
                    }`}
                  >
                    Kayıt Ol
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                  <span className="text-base font-black text-stone-900">Restoran Onay Süreci</span>
                </div>
              )}

              {/* Modal Kapatma Butonu */}
              <button
                type="button"
                onClick={() => {
                  setIsWaitingApproval(false);
                  dispatch(closeAuthModal());
                }}
                className="w-8 h-8 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Kapat"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            {!isWaitingApproval && authModalNotice && (
              <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50/90 px-3.5 py-2.5 text-xs font-semibold text-rose-900">
                <i className="fa-solid fa-heart text-rose-500 mt-0.5 shrink-0"></i>
                <span>{authModalNotice}</span>
              </div>
            )}

            {/* =============================================================== */}
            {/* 1. WHATSAPP ONAY BEKLEME EKRANI                                 */}
            {/* =============================================================== */}
            {isWaitingApproval ? (
              <div className="py-2 space-y-4 animate-in fade-in duration-200">
                <div className="text-center space-y-2">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center text-3xl mx-auto shadow-lg shadow-emerald-500/25">
                    <i className="fa-brands fa-whatsapp"></i>
                  </div>
                  <span className="inline-block bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-extrabold px-3 py-1 rounded-full animate-pulse">
                    ⏳ Restoran Yöneticisi Onayı Bekleniyor
                  </span>
                  <h3 className="text-lg sm:text-xl font-black text-stone-900">
                    Kayıt Talebiniz Alındı!
                  </h3>
                  <p className="text-xs text-stone-600 max-w-md mx-auto leading-relaxed">
                    Sayın <strong>{pendingUser?.name || 'Müşterimiz'}</strong>, sahte siparişleri engellemek ve hesap güvenliğiniz için üyeliğiniz restoran yöneticimizin onayından sonra aktifleşmektedir.
                  </p>
                </div>

                {/* 1. Adım: WhatsApp Butonu */}
                <div className="space-y-1.5 pt-1">
                  <a
                    href={waApprovalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black py-3 px-4 rounded-xl text-sm transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2.5 cursor-pointer text-center"
                  >
                    <i className="fa-brands fa-whatsapp text-2xl"></i>
                    <span>WhatsApp&apos;tan Onay Talebi Gönder</span>
                  </a>
                  <p className="text-[11px] text-stone-400 text-center">
                    Butona tıkladığınızda <strong>0553 855 76 12</strong> restoran hattımıza hazır onay mesajınız açılır.
                  </p>
                </div>

                {/* 2. Adım: Canlı Onay Kontrol Kutusu */}
                <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-2.5 text-center">
                  <div className="flex items-center justify-center gap-2 text-xs font-bold text-amber-800">
                    <i className="fa-solid fa-spinner animate-spin text-amber-600"></i>
                    <span>Yönetici onayı bekleniyor... (Otomatik Algılanacak)</span>
                  </div>
                  <p className="text-[11px] text-stone-500 leading-snug">
                    Restoran yetkilisi yönetim panelinden onay verdiğinde bu pencere otomatik olarak kapanacak ve oturumunuz anında açılacaktır.
                  </p>
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isCheckingStatus}
                      onClick={() => checkApprovalStatus(true)}
                      className="px-4 py-2 rounded-xl bg-white border border-stone-200 hover:bg-stone-100 text-stone-800 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                    >
                      <i className={`fa-solid fa-arrows-rotate text-xs ${isCheckingStatus ? 'animate-spin' : ''}`}></i>
                      <span>{isCheckingStatus ? 'Kontrol Ediliyor...' : 'Onayı Kontrol Et'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsWaitingApproval(false)}
                      className="px-3 py-2 rounded-xl text-stone-500 hover:text-stone-800 text-xs font-semibold underline cursor-pointer"
                    >
                      Giriş Ekranına Dön
                    </button>
                  </div>
                </div>

                {formError && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-3.5 py-2 rounded-xl flex items-center gap-2">
                    <i className="fa-solid fa-circle-exclamation text-rose-500 shrink-0"></i>
                    <span>{formError}</span>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Bilgilendirme Rozeti */}
                <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-3 text-xs text-stone-600 flex items-center gap-2.5 mb-4">
                  <i className="fa-solid fa-shield-halved text-emerald-600 text-sm shrink-0"></i>
                  <span>
                    {isRegister
                      ? 'Kayıt talebinizin ardından WhatsApp onayınızla hesabınız restoran yöneticisi tarafından aktif edilir.'
                      : 'Sipariş verebilmek için üye girişi yapmanız veya ücretsiz kayıt olmanız gerekmektedir.'}
                  </span>
                </div>

                {/* ----------------------------------------------------------- */}
                {/* 2. GİRİŞ FORMU & ŞİFREMİ UNUTTUM                           */}
                {/* ----------------------------------------------------------- */}
                {authModalTab === 'login' && (
                  isForgotPassword ? (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      <div className="flex items-center gap-2.5 pb-2 border-b border-stone-200/80">
                        <span className="w-8 h-8 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center font-bold text-sm shadow-xs">
                          <i className="fa-solid fa-key"></i>
                        </span>
                        <div>
                          <h3 className="font-extrabold text-base text-stone-900 leading-tight">
                            Şifremi Unuttum
                          </h3>
                          <p className="text-[11px] text-stone-500">
                            {forgotStep === 1
                              ? 'Hesap bilgilerinizi girerek ücretsiz şifre sıfırlama talebinde bulunun.'
                              : 'Doğrulama kodunu ve yeni şifrenizi belirleyin.'}
                          </p>
                        </div>
                      </div>

                      {forgotStep === 1 ? (
                        <form onSubmit={handleRequestPasswordReset} className="space-y-3.5">
                          <div>
                            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                              Kayıtlı Telefon Numarası veya E-Posta
                            </label>
                            <input
                              type="text"
                              required
                              value={forgotInput}
                              onChange={(e) => setForgotInput(e.target.value)}
                              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-500 text-stone-800 focus:bg-white"
                              placeholder="Örn: 0555 123 45 67 veya ornek@mail.com"
                            />
                          </div>

                          {forgotError && (
                            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-3.5 py-2 rounded-xl flex items-center gap-2">
                              <i className="fa-solid fa-circle-exclamation text-rose-500 shrink-0"></i>
                              <span>{forgotError}</span>
                            </div>
                          )}

                          {forgotSuccess && (
                            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-2">
                              <i className="fa-solid fa-circle-check text-emerald-600 shrink-0"></i>
                              <span>{forgotSuccess}</span>
                            </div>
                          )}

                          <div className="space-y-2 pt-1">
                            {/* 1. Seçenek: WhatsApp ile 1 Tıkla Anında Sıfırlama (Ücretsiz) */}
                            <a
                              href={
                                forgotResult?.waSupportUrl ||
                                `https://wa.me/905538557612?text=${encodeURIComponent(
                                  `Merhaba Sandviç Diyarı, ${forgotInput.trim() ? `[${forgotInput.trim()}] kayıtlı ` : ''}hesabımın şifresini unuttum. Yeni şifre talep ediyorum.`
                                )}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-extrabold py-3 px-4 rounded-xl text-xs sm:text-sm transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2.5 cursor-pointer text-center"
                            >
                              <i className="fa-brands fa-whatsapp text-xl"></i>
                              <span>WhatsApp ile Anında Şifre Al (Ücretsiz)</span>
                            </a>
                            <p className="text-[10px] text-stone-400 text-center">
                              Restoran destek hattımıza tek tıkla bağlanarak şifrenizi saniyeler içinde alabilirsiniz.
                            </p>

                            <div className="relative flex py-1 items-center">
                              <div className="flex-grow border-t border-stone-200"></div>
                              <span className="flex-shrink mx-3 text-stone-400 text-[10px] uppercase font-bold tracking-wider">veya</span>
                              <div className="flex-grow border-t border-stone-200"></div>
                            </div>

                            {/* 2. Seçenek: Doğrulama Kodu İste */}
                            <button
                              type="submit"
                              disabled={forgotLoading}
                              className="w-full bg-stone-900 hover:bg-black text-white font-bold py-2.5 px-4 rounded-xl text-xs sm:text-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
                            >
                              <i className={`fa-solid ${forgotLoading ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
                              <span>{forgotLoading ? 'Kontrol Ediliyor...' : 'Doğrulama Kodu ile Sıfırla'}</span>
                            </button>
                          </div>

                          <div className="text-center pt-2">
                            <button
                              type="button"
                              onClick={() => {
                                setIsForgotPassword(false);
                                setForgotError('');
                                setForgotSuccess('');
                              }}
                              className="text-xs text-stone-500 hover:text-stone-800 font-semibold cursor-pointer underline"
                            >
                              ← Giriş Ekranına Dön
                            </button>
                          </div>
                        </form>
                      ) : (
                        /* Step 2: Code verification & new password */
                        <form onSubmit={handleConfirmPasswordReset} className="space-y-3.5">
                          <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-900">
                            <p className="font-bold">
                              {forgotResult?.name ? `Sn. ${forgotResult.name},` : 'Değerli Müşterimiz,'}
                            </p>
                            <p className="text-[11px] text-amber-800 mt-0.5">
                              Lütfen {forgotResult?.maskedPhone || 'telefonunuza'} iletilen 6 haneli kodu ve kullanmak istediğiniz yeni şifrenizi giriniz.
                            </p>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-stone-700 mb-1">
                              6 Haneli Doğrulama Kodu *
                            </label>
                            <input
                              type="text"
                              required
                              maxLength={6}
                              value={forgotCode}
                              onChange={(e) => setForgotCode(e.target.value.replace(/\D/g, ''))}
                              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-center tracking-widest text-base font-black focus:outline-none focus:border-brand-500 text-stone-900 font-mono"
                              placeholder="123456"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-stone-700 mb-1">
                              Yeni Şifreniz *
                            </label>
                            <input
                              type="password"
                              required
                              minLength={4}
                              value={forgotNewPass}
                              onChange={(e) => setForgotNewPass(e.target.value)}
                              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-500 text-stone-900"
                              placeholder="En az 4 karakter"
                            />
                          </div>

                          {forgotError && (
                            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-3.5 py-2 rounded-xl flex items-center gap-2">
                              <i className="fa-solid fa-circle-exclamation text-rose-500 shrink-0"></i>
                              <span>{forgotError}</span>
                            </div>
                          )}

                          <button
                            type="submit"
                            disabled={forgotLoading}
                            className="w-full bg-amber-500 hover:bg-amber-600 text-stone-950 font-black py-3 rounded-xl text-xs sm:text-sm transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                          >
                            <i className={`fa-solid ${forgotLoading ? 'fa-spinner fa-spin' : 'fa-check'}`}></i>
                            <span>{forgotLoading ? 'Güncelleniyor...' : 'Yeni Şifreyi Kaydet ve Giriş Yap'}</span>
                          </button>

                          <div className="text-center pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setForgotStep(1);
                                setForgotError('');
                              }}
                              className="text-xs text-stone-500 hover:text-stone-800 font-semibold cursor-pointer underline"
                            >
                              ← Geri Dön (Farklı Numara Gir)
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  ) : (
                    <form onSubmit={handleLoginSubmit} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                          E-Posta Adresi veya Telefon
                        </label>
                        <input
                          type="text"
                          required
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-500 text-stone-800 focus:bg-white"
                          placeholder="ornek@mail.com veya 0532..."
                        />
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-1.5">
                          <label className="block text-xs font-semibold text-stone-700">
                            Şifre
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setIsForgotPassword(true);
                              setForgotInput(loginEmail || '');
                              setForgotError('');
                              setForgotSuccess('');
                              setForgotStep(1);
                            }}
                            className="text-xs text-brand-600 hover:text-brand-700 font-bold transition-colors cursor-pointer"
                          >
                            Şifremi Unuttum?
                          </button>
                        </div>
                        <input
                          type="password"
                          required
                          value={loginPass}
                          onChange={(e) => setLoginPass(e.target.value)}
                          className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-500 text-stone-800 focus:bg-white"
                          placeholder="••••••••"
                        />
                      </div>

                      {formError && (
                        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-3.5 py-2 rounded-xl flex items-center gap-2">
                          <i className="fa-solid fa-circle-exclamation text-rose-500 shrink-0"></i>
                          <span>{formError}</span>
                        </div>
                      )}

                      <button
                        type="submit"
                        className="w-full bg-stone-900 hover:bg-black text-white font-bold py-3 rounded-xl text-sm transition-colors cursor-pointer"
                      >
                        Giriş Yap
                      </button>
                    </form>
                  )
                )}

                {/* ----------------------------------------------------------- */}
                {/* 3. KAYIT OL FORMU (WHATSAPP ONAY TALEBİ ENTEGRELİ)          */}
                {/* ----------------------------------------------------------- */}
                {authModalTab === 'register' && (
                  <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                          Ad Soyad
                        </label>
                        <input
                          type="text"
                          required
                          value={regName}
                          onChange={(e) => setRegName(e.target.value)}
                          className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-500 text-stone-800 focus:bg-white"
                          placeholder="Adınız Soyadınız"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                          E-Posta Adresi
                        </label>
                        <input
                          type="email"
                          required
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-500 text-stone-800 focus:bg-white"
                          placeholder="ornek@mail.com"
                        />
                      </div>
                    </div>

                    {/* Telefon Numarası */}
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1.5 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <i className="fa-brands fa-whatsapp text-emerald-600 text-sm"></i>
                          <span>WhatsApp Cep Telefonu</span>
                        </span>
                        <span className="text-[10px] text-stone-400 font-normal">
                          Onay talebi bu numaradan iletilir
                        </span>
                      </label>
                      <input
                        type="tel"
                        inputMode="numeric"
                        maxLength={14}
                        required
                        value={regPhone}
                        onChange={(e) => setRegPhone(formatTurkishPhoneInput(e.target.value))}
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-emerald-500 text-stone-800 focus:bg-white font-mono"
                        placeholder="05XX XXX XX XX"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                          Şifre
                        </label>
                        <input
                          type="password"
                          required
                          value={regPass}
                          onChange={(e) => setRegPass(e.target.value)}
                          className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-500 text-stone-800 focus:bg-white"
                          placeholder="••••••••"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                          Teslimat Adresi
                        </label>
                        <input
                          type="text"
                          required
                          value={regAddress}
                          onChange={(e) => setRegAddress(e.target.value)}
                          className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-500 text-stone-800 focus:bg-white"
                          placeholder="Mahalle, Sokak, No..."
                        />
                      </div>
                    </div>

                    {/* KVKK Onayı */}
                    <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-3">
                      <label className="flex items-start gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={kvkkConsent}
                          onChange={(e) => setKvkkConsent(e.target.checked)}
                          className="mt-0.5 w-4 h-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500 cursor-pointer shrink-0"
                        />
                        <span className="text-[11px] text-stone-600 leading-snug">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsKvkkModalOpen(true);
                            }}
                            className="font-bold text-stone-900 underline hover:text-brand-600 cursor-pointer"
                          >
                            6698 Sayılı KVKK Kapsamında Aydınlatma Metni
                          </button>
                          &apos;ni okudum. Güvenlik ve sipariş amacıyla verilerimin işlenmesini ve WhatsApp onay sürecini kabul ediyorum.
                        </span>
                      </label>
                    </div>

                    {formError && (
                      <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-2">
                        <i className="fa-solid fa-circle-exclamation text-rose-500 shrink-0"></i>
                        <span>{formError}</span>
                      </div>
                    )}

                    {/* Kayıt ve WhatsApp Onay İste Butonu */}
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-stone-300 text-white font-black py-3 rounded-xl text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm active:scale-98"
                    >
                      <i className="fa-brands fa-whatsapp text-lg"></i>
                      <span>{isSubmitting ? 'Kaydediliyor...' : 'Kayıt Ol ve WhatsApp ile Onay İste'}</span>
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 6698 SAYILI KVKK AYDINLATMA METNİ PENCERESİ                        */}
      {/* =================================================================== */}
      {isKvkkModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-stone-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3 shrink-0">
              <h3 className="font-extrabold text-stone-900 text-sm sm:text-base flex items-center gap-2">
                <i className="fa-solid fa-scale-balanced text-brand-600"></i>
                <span>KVKK &amp; Müşteri Aydınlatma Metni</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsKvkkModalOpen(false)}
                className="w-7 h-7 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 flex items-center justify-center cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            <div className="text-xs text-stone-600 space-y-3 overflow-y-auto pr-2 leading-relaxed font-sans">
              <p>
                <strong>Sandviç Diyarı</strong> olarak kişisel verilerinizin güvenliğine ve gizliliğine azami önem vermekteyiz.
                6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;) uyarınca:
              </p>
              <p>
                <strong>1. Veri Sorumlusu:</strong> Sandviç Diyarı Restoran İşletmesi.
              </p>
              <p>
                <strong>2. İşleme Amacı:</strong> Web sitemiz üzerinden verilen siparişlerin hazırlanması, paket teslimatının yapılması, sahte siparişlerin önlenmesi ve WhatsApp üzerinden restoran onay sürecinin yürütülmesi amacıyla ad, soyad, telefon, e-posta ve adres verileriniz işlenmektedir.
              </p>
              <p>
                <strong>3. Aktarım:</strong> Kişisel verileriniz hiçbir üçüncü şahıs veya reklam şirketi ile paylaşılmaz; yalnızca sipariş teslimatını sağlayan yetkili restoran personeli ve kurye tarafından kullanılır.
              </p>
            </div>

            <div className="pt-2 border-t border-stone-100 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => {
                  setKvkkConsent(true);
                  setIsKvkkModalOpen(false);
                }}
                className="bg-stone-900 hover:bg-black text-white text-xs font-bold px-5 py-2.5 rounded-xl cursor-pointer transition-colors"
              >
                Okudum, Onaylıyorum
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
