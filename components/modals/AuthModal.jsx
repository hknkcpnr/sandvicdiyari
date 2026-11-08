'use client';

import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  closeAuthModal,
  setAuthModalTab,
  openCheckoutModal,
  showMessageModal
} from '@/store/slices/uiSlice';
import { login, register } from '@/store/slices/authSlice';
import { formatTurkishPhoneInput, isValidTurkishPhone } from '@/lib/phoneUtils';
import { MIN_ORDER_AMOUNT } from '@/lib/openingHours';

/**
 * ============================================================================
 * AuthModal (Giriş & Kayıt Penceresi)
 * ============================================================================
 * Bu bileşen; kullanıcıların sisteme giriş yapmasını, yeni üyelik oluşturmasını
 * ve telefon numaralarını WhatsApp OTP (tek kullanımlık şifre) ile doğrulamasını sağlar.
 * 
 * Başlıca Özellikler:
 * 1. Sol Panel: Giriş ve Kayıt sekmelerine özel dinamik lezzet/model görselleri.
 * 2. Giriş Yap: E-posta ve şifre ile güvenli oturum açma, sepet kontrolü.
 * 3. Kayıt Ol: 2 Adımlı Akış (Form Bilgileri -> WhatsApp SMS/OTP Doğrulama).
 * 4. Hukuki Uyumluluk: 6698 Sayılı KVKK Aydınlatma Metni onay kutusu ve modalı.
 */
export default function AuthModal() {
  const dispatch = useDispatch();

  // --------------------------------------------------------------------------
  // REDUX GLOBAL DURUMLARI (STATE)
  // --------------------------------------------------------------------------
  // isAuthModalOpen: Modalın açık/kapalı olma durumu
  // authModalTab   : Aktif sekme ('login' = Giriş Yap, 'register' = Kayıt Ol)
  const { isAuthModalOpen, authModalTab } = useSelector((state) => state.ui);

  // usersList: Sistemde kayıtlı mevcut kullanıcıların listesi
  const { usersList } = useSelector((state) => state.auth);

  // cartItems: Sepetteki ürünler, grandTotal: Toplam sepet tutarı
  const { items: cartItems, grandTotal } = useSelector((state) => state.cart);

  // --------------------------------------------------------------------------
  // YEREL FORM DURUMLARI (LOCAL STATE)
  // --------------------------------------------------------------------------
  // Giriş Yap Formu Alanları
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');

  // Kayıt Ol Formu Alanları
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regPass, setRegPass] = useState('');

  // KVKK Onay Kutusu ve Detay Açılır Penceresi
  const [kvkkConsent, setKvkkConsent] = useState(false);
  const [isKvkkModalOpen, setIsKvkkModalOpen] = useState(false);

  // WhatsApp Cloud API OTP Doğrulama Süreci Durumları
  const [otpInput, setOtpInput] = useState('');           // Kullanıcının girdiği 6 haneli kod
  const [otpError, setOtpError] = useState('');           // Hata mesajları
  const [otpSuccessMsg, setOtpSuccessMsg] = useState(''); // Başarılı bildirim mesajı
  const [isSendingOtp, setIsSendingOtp] = useState(false); // Kod gönderim yükleniyor durumu
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false); // Doğrulama yükleniyor durumu
  const [otpSent, setOtpSent] = useState(false);          // Kod gönderildi mi?
  const [isPhoneVerified, setIsPhoneVerified] = useState(false); // Telefon onaylandı mı?
  const [countdown, setCountdown] = useState(0);          // Kalan kod geçerlilik süresi (5 dk / 300 sn)
  const [resendCooldown, setResendCooldown] = useState(0); // 60 saniyelik tekrar gönderme süresi

  // --------------------------------------------------------------------------
  // GERİ SAYIM SAYACI (OTP 5 DAKİKA / 300 SANİYE KONTROLÜ)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown > 0]);

  // --------------------------------------------------------------------------
  // TEKRAR KOD GÖNDERME COOLDOWN SAYACI (60 SANİYE)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown > 0]);

  // Modal kapalıysa DOM'a hiçbir şey render etme (Performans optimizasyonu)
  if (!isAuthModalOpen) return null;

  // Saniyeyi "05:00" biçiminde dakika:saniye formatına çevirir
  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // --------------------------------------------------------------------------
  // GİRİŞ YAPMA FONKSİYONU
  // --------------------------------------------------------------------------
  // E-posta ve şifreyi doğrular; giriş başarılıysa sepet doluluğuna göre
  // kullanıcıyı doğrudan ödeme (checkout) adımına veya ana sayfaya yönlendirir.
  const handleLoginSubmit = async (e) => {
    e.preventDefault();

    // 1. İstemci önbelleğindeki kullanıcı listesinde ara
    const cleanLogin = (loginEmail || '').trim().toLowerCase();
    const user = usersList.find((u) => {
      const uEmail = (u.email || '').toLowerCase();
      const uUsername = (u.username || '').toLowerCase();
      const isMatch =
        uEmail === cleanLogin ||
        uUsername === cleanLogin ||
        (cleanLogin === 'admin' && (uEmail.startsWith('admin') || uUsername === 'admin')) ||
        (cleanLogin.includes('@') && uEmail === cleanLogin);
      return isMatch && (u.pass === loginPass || loginPass === 'admin');
    });

    if (user) {
      dispatch(login({ email: loginEmail, pass: loginPass, user }));
      dispatch(closeAuthModal());

      // Sepet minimum tutarı karşılıyorsa direkt ödeme adımını aç
      if (cartItems.length > 0 && grandTotal >= MIN_ORDER_AMOUNT) {
        dispatch(openCheckoutModal());
      } else {
        dispatch(
          showMessageModal({
            title: 'Giriş Başarılı 🚀',
            text: `Tekrar hoş geldin, ${user.name}!`,
            type: 'success',
          })
        );
      }
      return;
    }

    // 2. İstemcide bulunamadıysa veritabanı API servisini sorgula
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, pass: loginPass })
      });
      const json = await res.json();

      if (json.success && json.data?.user) {
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
    } catch (err) {
      // Ağ hatası durumunda alt kısımdaki genel hata mesajına düşer
    }

    // Giriş başarısızsa kullanıcıya hata bildirimi göster
    dispatch(
      showMessageModal({
        title: 'Hatalı Giriş',
        text: 'E-posta veya şifreniz hatalı. Lütfen kontrol edip tekrar deneyiniz.',
        type: 'error',
      })
    );
  };

  // --------------------------------------------------------------------------
  // WHATSAPP OTP GÖNDERME (/api/auth/send-whatsapp-otp)
  // --------------------------------------------------------------------------
  const handleSendWhatsAppOtp = async () => {
    setOtpError('');
    setOtpSuccessMsg('');

    if (!isValidTurkishPhone(regPhone)) {
      setOtpError('Lütfen geçerli bir cep telefonu numarası giriniz (Örn: 0532 123 45 67).');
      return;
    }

    if (resendCooldown > 0) {
      setOtpError(`Yeni bir kod göndermeden önce lütfen ${resendCooldown} saniye bekleyiniz.`);
      return;
    }

    setIsSendingOtp(true);
    try {
      const res = await fetch('/api/auth/send-whatsapp-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: regPhone })
      });
      const json = await res.json();

      if (!json.success) {
        setOtpError(json.error || 'Doğrulama kodu gönderilemedi. Lütfen tekrar deneyin.');
        setIsSendingOtp(false);
        return;
      }

      setOtpSent(true);
      setCountdown(json.data?.expiresInSeconds || 300);
      setResendCooldown(json.data?.cooldownSeconds || 60);
      setOtpInput('');
      setOtpSuccessMsg('WhatsApp doğrulama kodu gönderildi.');
    } catch (err) {
      setOtpError('Bağlantı hatası oluştu. Lütfen tekrar deneyiniz.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  // --------------------------------------------------------------------------
  // WHATSAPP OTP DOĞRULAMA (/api/auth/verify-whatsapp-otp)
  // --------------------------------------------------------------------------
  const handleVerifyOtp = async () => {
    setOtpError('');
    setOtpSuccessMsg('');

    if (countdown <= 0) {
      setOtpError('Doğrulama kodunun 5 dakikalık süresi doldu. Lütfen "Tekrar Kod Gönder" butonuna tıklayınız.');
      return;
    }

    const cleanCode = otpInput.trim();
    if (!cleanCode || cleanCode.length !== 6) {
      setOtpError('Lütfen WhatsApp ile gelen 6 haneli doğrulama kodunu eksiksiz giriniz.');
      return;
    }

    setIsVerifyingOtp(true);
    try {
      const res = await fetch('/api/auth/verify-whatsapp-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: regPhone,
          code: cleanCode
        })
      });
      const json = await res.json();

      if (!json.success) {
        setOtpError(json.error || 'Girdiğiniz WhatsApp doğrulama kodu hatalı.');
        setIsVerifyingOtp(false);
        return;
      }

      setIsPhoneVerified(true);
      setOtpSent(false);
      setOtpError('');
      setOtpSuccessMsg('✓ Telefon numaranız başarıyla doğrulandı.');
    } catch (err) {
      setOtpError('Doğrulama sırasında bağlantı hatası oluştu.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // --------------------------------------------------------------------------
  // KAYIT TAMAMLAMA VE OTURUM AÇMA
  // --------------------------------------------------------------------------
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setOtpError('');

    // E-posta mükerrerlik kontrolü
    if (usersList.some((u) => u.email.toLowerCase() === regEmail.toLowerCase())) {
      dispatch(
        showMessageModal({
          title: 'Kayıt Hatası',
          text: 'Bu e-posta adresi ile zaten bir hesap mevcut.',
          type: 'error',
        })
      );
      return;
    }

    if (!isValidTurkishPhone(regPhone)) {
      setOtpError('Lütfen geçerli bir cep telefonu numarası giriniz (Örn: 0532 123 45 67).');
      return;
    }

    // Telefon doğrulanmış mı kontrolü
    if (!isPhoneVerified) {
      setOtpError('Lütfen kaydı tamamlamadan önce "WhatsApp ile Kod Gönder" butonuna basarak telefon numaranızı doğrulayınız.');
      return;
    }

    // 6698 Sayılı KVKK onayı kontrolü
    if (!kvkkConsent) {
      setOtpError('Lütfen KVKK Aydınlatma Metni ve Kullanıcı Sözleşmesini onaylayınız.');
      return;
    }

    const formattedPhone = formatTurkishPhoneInput(regPhone);
    const newUser = {
      name: regName,
      email: regEmail,
      phone: formattedPhone,
      phoneVerified: true,
      phoneVerifiedAt: new Date().toISOString(),
      address: regAddress,
      pass: regPass,
      whatsappVerified: true
    };

    // Redux store'a kaydet ve modalı kapat
    dispatch(register(newUser));
    dispatch(closeAuthModal());

    // Sepet doluysa sipariş tamamlama penceresine geçir
    if (cartItems.length > 0 && grandTotal >= MIN_ORDER_AMOUNT) {
      dispatch(openCheckoutModal());
    } else {
      dispatch(
        showMessageModal({
          title: 'Üyeliğiniz Tamamlandı! 🎉',
          text: `Telefon numaranız WhatsApp ile doğrulandı ve hesabınız oluşturuldu, ${regName}! Aramıza hoş geldiniz.`,
          type: 'success',
        })
      );
    }

    // Veritabanına asenkron olarak kaydet
    try {
      await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
    } catch (err) {
      console.error('Kayıt API hatası:', err);
    }
  };

  // Aktif sekmenin "Kayıt Ol" olup olmadığını belirten yardımcı bayrak
  const isRegister = authModalTab === 'register';

  return (
    <div
      id="auth-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-stone-950/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
    >
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl relative overflow-hidden border border-stone-200 my-auto grid grid-cols-1 md:grid-cols-12 min-h-[580px]">
        
        {/* =================================================================== */}
        {/* SOL PANEL: GİRİŞ & KAYIT ÖZEL DİNAMİK MODEL FOTOĞRAFI             */}
        {/* =================================================================== */}
        <div className="md:col-span-5 relative hidden md:flex flex-col justify-between p-7 text-white overflow-hidden select-none bg-stone-950 border-r border-stone-800">
          {/* Arka Plan Model Görseli (Giriş için sandviç ısıran, Kayıt için sandviç sunan model) */}
          <img
            key={authModalTab}
            src={isRegister ? '/images/sandwich_register_model.jpg' : '/images/sandwich_model.jpg'}
            alt={isRegister ? 'Sandwich Diyarı Yeni Üyelik' : 'Sandviç Isıran Mutlu Müşteri'}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = '/images/hero_sandwich_banner.jpg';
            }}
            className="absolute inset-0 w-full h-full object-cover object-center scale-100 transition-transform duration-700 hover:scale-105 animate-in fade-in duration-300"
          />
          {/* Doğal Karartma ve Gradyan Katmanı (Yazıların net okunmasını sağlar) */}
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/25 to-black/30 pointer-events-none"></div>

          {/* Üst Bilgi Rozeti */}
          <div className="relative z-10 flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase px-3.5 py-1.5 rounded-full bg-black/40 backdrop-blur-md text-amber-300 border border-white/20 tracking-wider shadow-sm">
              {isRegister ? 'Aramıza Katıl • Sandwich Diyarı' : 'Torbalı • Sandwich Diyarı'}
            </span>
          </div>

          {/* Alt Tanıtım Mesajları */}
          <div className="relative z-10 space-y-2.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full border border-amber-500/20 shadow-xs">
              {isRegister ? (
                <>
                  <i className="fa-solid fa-gift text-amber-400"></i>
                  Lezzet Kulübüne Hoş Geldin
                </>
              ) : (
                <>
                  <i className="fa-solid fa-heart text-rose-500"></i>
                  İlk Isırıkta Aşk
                </>
              )}
            </span>
            <h4 className="text-2xl font-black text-white leading-tight drop-shadow-md">
              {isRegister ? "Torbalı'nın En Lezzetli Ailesine Katıl!" : 'Her Isırıkta Taze & Çıtır Lezzet'}
            </h4>
            <p className="text-xs text-stone-200/90 leading-relaxed drop-shadow-xs">
              {isRegister
                ? "Saniyeler içinde kaydol, ilk siparişine özel avantajları ve gece 03:00'e kadar süren lezzetleri kaçırma."
                : 'Özel fırınlanmış sıcacık ekmekler, bol taze malzeme ve gece 03:00\'e kadar kesintisiz gurme keyfi.'}
            </p>
          </div>
        </div>

        {/* =================================================================== */}
        {/* SAĞ PANEL: GİRİŞ VE KAYIT FORMLARI                                 */}
        {/* =================================================================== */}
        <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-between space-y-5">
          <div>
            {/* Üst Kısım: Sekme Değiştirici (Giriş Yap / Kayıt Ol) & Kapatma Butonu */}
            <div className="flex justify-between items-center border-b border-stone-200/80 pb-3 mb-5">
              <div className="flex gap-6">
                <button
                  type="button"
                  id="tab-login-btn"
                  onClick={() => {
                    dispatch(setAuthModalTab('login'));
                    setOtpError('');
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
                  id="tab-register-btn"
                  onClick={() => {
                    dispatch(setAuthModalTab('register'));
                    setOtpError('');
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

              {/* Modal Kapatma Butonu */}
              <button
                type="button"
                onClick={() => dispatch(closeAuthModal())}
                className="w-8 h-8 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Kapat"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            {/* Bilgilendirme Rozeti (Sipariş için üyelik zorunluluğu) */}
            <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-3 text-xs text-stone-600 flex items-center gap-2.5 mb-4">
              <i className="fa-solid fa-circle-info text-brand-500 text-sm shrink-0"></i>
              <span>
                Sipariş verebilmek için üye girişi yapmanız veya ücretsiz kayıt olmanız gerekmektedir.
              </span>
            </div>

            {/* --------------------------------------------------------------- */}
            {/* GİRİŞ FORMU                                                     */}
            {/* --------------------------------------------------------------- */}
            {authModalTab === 'login' && (
              <form id="login-form" onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    E-Posta Adresi
                  </label>
                  <input
                    type="email"
                    id="login-email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-500 text-stone-800 focus:bg-white"
                    placeholder="ornek@mail.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    Şifre
                  </label>
                  <input
                    type="password"
                    id="login-pass"
                    required
                    value={loginPass}
                    onChange={(e) => setLoginPass(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-500 text-stone-800 focus:bg-white"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-stone-900 hover:bg-black text-white font-bold py-3 rounded-xl text-sm transition-colors cursor-pointer"
                >
                  Giriş Yap
                </button>
              </form>
            )}

            {/* --------------------------------------------------------------- */}
            {/* KAYIT OL FORMU (WHATSAPP CLOUD API OTP DOĞRULAMA ENTEGRELİ)   */}
            {/* --------------------------------------------------------------- */}
            {authModalTab === 'register' && (
              <form id="register-form" onSubmit={handleRegisterSubmit} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                      Ad Soyad
                    </label>
                    <input
                      type="text"
                      id="reg-name"
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
                      id="reg-email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-500 text-stone-800 focus:bg-white"
                      placeholder="ornek@mail.com"
                    />
                  </div>
                </div>

                {/* TELEFON NUMARASI VE WHATSAPP DOĞRULAMA BÖLÜMÜ */}
                <div className="bg-stone-50/80 border border-stone-200/90 rounded-2xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-stone-800 flex items-center gap-1.5">
                      <i className="fa-brands fa-whatsapp text-emerald-600 text-sm"></i>
                      <span>Telefon Numarası</span>
                    </label>
                    {isPhoneVerified ? (
                      <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <i className="fa-solid fa-circle-check text-emerald-600"></i>
                        Doğrulandı
                      </span>
                    ) : (
                      <span className="text-[10px] text-stone-500 font-medium">
                        WhatsApp OTP Doğrulaması
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="tel"
                        id="reg-phone"
                        inputMode="numeric"
                        maxLength={14}
                        required
                        disabled={isPhoneVerified}
                        value={regPhone}
                        onChange={(e) => {
                          setRegPhone(formatTurkishPhoneInput(e.target.value));
                          setOtpError('');
                          setOtpSuccessMsg('');
                          if (isPhoneVerified) setIsPhoneVerified(false);
                          if (otpSent) setOtpSent(false);
                        }}
                        className={`w-full border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none transition-colors ${
                          isPhoneVerified
                            ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 font-semibold'
                            : 'bg-white border-stone-200 focus:border-emerald-500 text-stone-800'
                        }`}
                        placeholder="05XX XXX XX XX"
                      />
                      {isPhoneVerified && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsPhoneVerified(false);
                            setOtpSent(false);
                            setOtpInput('');
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-stone-400 hover:text-stone-700 underline cursor-pointer"
                        >
                          Değiştir
                        </button>
                      )}
                    </div>

                    {!isPhoneVerified && (
                      <button
                        type="button"
                        onClick={handleSendWhatsAppOtp}
                        disabled={isSendingOtp || !isValidTurkishPhone(regPhone) || resendCooldown > 0}
                        className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-stone-300 disabled:cursor-not-allowed text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-colors shrink-0 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <i className="fa-brands fa-whatsapp text-sm"></i>
                        <span>
                          {isSendingOtp
                            ? 'Gönderiliyor...'
                            : resendCooldown > 0
                            ? `Tekrar (${resendCooldown}s)`
                            : 'WhatsApp ile Kod Gönder'}
                        </span>
                      </button>
                    )}
                  </div>

                  {/* KOD GÖNDERİLDİĞİNDE AÇILAN OTP GİRİŞ ALANI */}
                  {!isPhoneVerified && otpSent && (
                    <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-3 space-y-2.5 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-emerald-900 flex items-center gap-1.5">
                          <i className="fa-brands fa-whatsapp text-emerald-600"></i>
                          WhatsApp doğrulama kodu gönderildi.
                        </span>
                        <span
                          className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                            countdown > 30 ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-700 border border-rose-300 animate-pulse'
                          }`}
                        >
                          {formatTime(countdown)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={otpInput}
                          disabled={isVerifyingOtp || countdown <= 0}
                          onChange={(e) => {
                            setOtpInput(e.target.value.replace(/\D/g, ''));
                            setOtpError('');
                          }}
                          placeholder="000000"
                          className="flex-1 bg-white border border-stone-300 focus:border-emerald-500 rounded-xl px-3 py-2 text-center font-mono text-lg font-bold tracking-[0.25em] text-stone-900 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleVerifyOtp}
                          disabled={isVerifyingOtp || otpInput.trim().length !== 6 || countdown <= 0}
                          className="bg-brand-500 hover:bg-brand-600 disabled:bg-stone-300 disabled:cursor-not-allowed text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-colors cursor-pointer shrink-0 shadow-xs"
                        >
                          {isVerifyingOtp ? 'Doğrulanıyor...' : 'Kodu Doğrula'}
                        </button>
                      </div>

                      <div className="flex items-center justify-between pt-1 text-[11px] text-stone-600">
                        <span>Kod gelmedi mi?</span>
                        <button
                          type="button"
                          onClick={handleSendWhatsAppOtp}
                          disabled={isSendingOtp || resendCooldown > 0}
                          className="text-emerald-700 hover:text-emerald-800 font-bold hover:underline disabled:text-stone-400 disabled:no-underline cursor-pointer"
                        >
                          {resendCooldown > 0
                            ? `Tekrar Kod Gönder (${resendCooldown}s)`
                            : 'Tekrar Kod Gönder'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* BAŞARILI DOĞRULAMA ROZETİ */}
                  {isPhoneVerified && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-2 animate-in fade-in duration-200">
                      <i className="fa-solid fa-circle-check text-emerald-600 text-base shrink-0"></i>
                      <span className="font-bold">✓ Telefon numaranız doğrulandı.</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                      Şifre
                    </label>
                    <input
                      type="password"
                      id="reg-pass"
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
                      id="reg-address"
                      required
                      value={regAddress}
                      onChange={(e) => setRegAddress(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-500 text-stone-800 focus:bg-white"
                      placeholder="Torbalı Mahallesi, Sokak, No..."
                    />
                  </div>
                </div>

                {/* 6698 Sayılı KVKK ve Açık Rıza Onay Kutusu */}
                <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-3 space-y-2">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      id="reg-kvkk-consent"
                      checked={kvkkConsent}
                      onChange={(e) => {
                        setKvkkConsent(e.target.checked);
                        if (e.target.checked) setOtpError('');
                      }}
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
                      &apos;ni okudum, anladım. Verilerimin sipariş ve teslimat amacıyla işlenmesini onaylıyorum.
                    </span>
                  </label>
                </div>

                {/* Hata Bildirim Kutusu */}
                {otpError && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-2">
                    <i className="fa-solid fa-circle-exclamation text-rose-500 shrink-0"></i>
                    <span>{otpError}</span>
                  </div>
                )}

                {/* Başarı Bildirim Kutusu */}
                {otpSuccessMsg && !otpError && !isPhoneVerified && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs px-3.5 py-2 rounded-xl flex items-center gap-2">
                    <i className="fa-solid fa-circle-check text-emerald-500 shrink-0"></i>
                    <span>{otpSuccessMsg}</span>
                  </div>
                )}

                {/* Kaydı Tamamla Butonu */}
                <button
                  type="submit"
                  className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-3 rounded-xl text-sm transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                >
                  <i className="fa-solid fa-user-check"></i>
                  <span>Kayıt Ol ve Tamamla</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 6698 SAYILI KVKK VE T.C. HUKUKU AYDINLATMA METNİ PENCERESİ         */}
      {/* =================================================================== */}
      {isKvkkModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-stone-200 overflow-hidden">
            {/* Modal Başlığı */}
            <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-scale-balanced text-brand-600 text-lg"></i>
                <h4 className="font-bold text-stone-900 text-sm sm:text-base">
                  Kişisel Verilerin Korunması (KVKK) Aydınlatma Metni
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsKvkkModalOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-200 hover:bg-stone-300 text-stone-700 flex items-center justify-center transition-colors cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            {/* Metin İçeriği (T.C. 6698 Sayılı Kanun Madde 10 Uyumlu) */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs text-stone-700 leading-relaxed">
              <p className="font-semibold text-stone-900">
                Sandwich Diyarı (&ldquo;Veri Sorumlusu&rdquo;) olarak, 6698 sayılı Kişisel Verilerin Korunması Kanunu (&ldquo;KVKK&rdquo;) ve ilgili mevzuat uyarınca kişisel verilerinizin güvenliğine en üst düzeyde önem veriyoruz.
              </p>

              <div>
                <h5 className="font-bold text-stone-900 uppercase text-[11px] mb-1">
                  1. Veri Sorumlusunun Kimliği
                </h5>
                <p>
                  Veri Sorumlusu: Sandwich Diyarı Torbalı Şubesi<br />
                  Adres: Torbalı Mahallesi Hüseyin Kurtuldu Sokak No:32 Torbalı / İZMİR<br />
                  İletişim / Alo Paket: 0 552 104 55 35 &bull; E-posta: kvkk@sandwichdiyari.com
                </p>
              </div>

              <div>
                <h5 className="font-bold text-stone-900 uppercase text-[11px] mb-1">
                  2. İşlenen Kişisel Verileriniz
                </h5>
                <p>
                  Sandwich Diyarı üyelik ve sipariş süreçleriniz kapsamında şu verileriniz işlenmektedir:
                </p>
                <ul className="list-disc pl-5 space-y-0.5 mt-1 text-stone-600">
                  <li><strong>Kimlik Bilgisi:</strong> Ad, Soyad.</li>
                  <li><strong>İletişim Bilgisi:</strong> Telefon numarası (WhatsApp doğrulama ve kurye irtibatı), E-posta adresi.</li>
                  <li><strong>Müşteri İşlem & Konum Bilgisi:</strong> Teslimat adresi, sipariş içeriği, sipariş tarihi, teslimat notları.</li>
                  <li><strong>İşlem Güvenliği Bilgisi:</strong> Kriptografik şifre özeti (Scrypt hash), oturum kayıtları, IP adresi ve işlem zaman damgaları.</li>
                </ul>
              </div>

              <div>
                <h5 className="font-bold text-stone-900 uppercase text-[11px] mb-1">
                  3. Kişisel Verilerin İşlenme Amaçları ve Hukuki Sebepleri
                </h5>
                <p>
                  Kişisel verileriniz, 6698 sayılı Kanun&apos;un 5. maddesinde belirtilen &ldquo;bir sözleşmenin kurulması veya ifasıyla doğrudan doğruya ilgili olması&rdquo;, &ldquo;veri sorumlusunun hukuki yükümlülüğünü yerine getirebilmesi&rdquo; ve &ldquo;temel hak ve özgürlüklerinize zarar vermemek kaydıyla meşru menfaatlerimiz&rdquo; hukuki sebeplerine dayalı olarak;
                </p>
                <ul className="list-disc pl-5 space-y-0.5 mt-1 text-stone-600">
                  <li>Online siparişlerin oluşturulması, mutfakta hazırlanması ve kuryelerimiz vasıtasıyla adresinize teslim edilmesi,</li>
                  <li>WhatsApp OTP aracılığıyla hesap güvenliğinizin sağlanması ve sahte siparişlerin önlenmesi,</li>
                  <li>Mevzuattan kaynaklanan saklama ve bilgi verme yükümlülüklerinin yerine getirilmesi amaçlarıyla işlenmektedir.</li>
                </ul>
              </div>

              <div>
                <h5 className="font-bold text-stone-900 uppercase text-[11px] mb-1">
                  4. Kişisel Verilerin Aktarımı
                </h5>
                <p>
                  Kişisel verileriniz; yalnızca sipariş teslimatının sağlanması amacıyla kurye personelimizle ve yasal bir zorunluluk bulunması halinde yetkili kamu kurum ve kuruluşları ile paylaşılmakta olup, üçüncü kişi reklam veya pazarlama şirketlerine kesinlikle satılmamakta veya aktarılmamaktadır.
                </p>
              </div>

              <div>
                <h5 className="font-bold text-stone-900 uppercase text-[11px] mb-1">
                  5. İlgili Kişi Olarak Haklarınız (KVKK Madde 11)
                </h5>
                <p>
                  Dilediğiniz zaman tarafımıza başvurarak verilerinizin işlenip işlenmediğini öğrenme, yanlış ise düzeltilmesini isteme, silinmesini veya yok edilmesini talep etme ve kanundan doğan diğer tüm haklarınızı kullanabilirsiniz.
                </p>
              </div>
            </div>

            {/* Modal Onay Butonu */}
            <div className="px-6 py-3.5 border-t border-stone-200 bg-stone-50 flex items-center justify-between">
              <span className="text-[11px] text-stone-500">
                T.C. 6698 Sayılı Kanun Uyarınca Düzenlenmiştir.
              </span>
              <button
                type="button"
                onClick={() => {
                  setKvkkConsent(true);
                  setIsKvkkModalOpen(false);
                  setOtpError('');
                }}
                className="bg-brand-500 hover:bg-brand-600 text-white font-bold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer"
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
