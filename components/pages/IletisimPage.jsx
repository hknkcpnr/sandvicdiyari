'use client';

import { useState, useRef, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { showMessageModal } from '@/store/slices/uiSlice';
import { getRestaurantStatus, CLOSED_MESSAGE } from '@/lib/openingHours';
import { DEFAULT_SITE_CONTENT } from '@/lib/siteContentDefaults';
import {
  getBrowserCache,
  isBrowserCacheStale,
  fetchWithBrowserCache,
  CACHE_TTL_LONG
} from '@/lib/browserDataCache';

export default function IletisimPage({ previewContact = null, previewCardsOnly = false } = {}) {
  const dispatch = useDispatch();
  const isPreview = Boolean(previewContact);
  const [contactInfo, setContactInfo] = useState(DEFAULT_SITE_CONTENT.contactBar);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [type, setType] = useState('Öneri / İstek');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (isPreview) return;
    const loadContact = (force = false) => {
      const cached = getBrowserCache('site_content_contactBar');
      if (!force && cached?.data) {
        setContactInfo((prev) => ({ ...prev, ...cached.data }));
        if (!isBrowserCacheStale('site_content_contactBar', CACHE_TTL_LONG)) return;
      }
      fetchWithBrowserCache('site_content_contactBar', '/api/site-content?section=contactBar', {
        force: force === true,
        maxAgeMs: CACHE_TTL_LONG,
        persist: true,
        extract: (res) => res.data?.contactBar
      })
        .then((res) => {
          if (res.ok && res.data) {
            setContactInfo((prev) => ({ ...prev, ...res.data }));
          }
        })
        .catch(() => {});
    };
    loadContact(false);
    const handleStorage = (e) => {
      if (e.key === 'sandwich_site_content_updated') loadContact(true);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [isPreview]);

  const effectiveContact = {
    ...DEFAULT_SITE_CONTENT.contactBar,
    ...(previewContact || contactInfo)
  };
  const phone1Clean = String(effectiveContact.phone1 || '0552 104 55 35').replace(/\s+/g, '');
  const phone2Clean = String(effectiveContact.phone2 || '0232 856 81 21').replace(/\s+/g, '');
  const addressText =
    effectiveContact.address || 'Torbalı Mahallesi Hüseyin Kurtuldu Sokak No:32, Torbalı / İZMİR';
  const workingHoursText = effectiveContact.workingHours || 'Hergün 10:00 - 03:00';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedMessage = message.trim();
    if (!trimmedName || !trimmedEmail || trimmedMessage.length < 5) {
      dispatch(
        showMessageModal({
          title: 'Eksik Bilgi',
          text: 'Lütfen adınızı, geçerli bir e-posta adresini ve en az 5 karakterlik mesajınızı girin.',
          type: 'error'
        })
      );
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          type,
          message: trimmedMessage,
          website
        })
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.success) {
        dispatch(
          showMessageModal({
            title: res.status === 429 ? 'Lütfen Bekleyin' : 'Gönderilemedi',
            text: json.error || json.message || 'Bildiriminiz gönderilemedi. Lütfen biraz sonra tekrar deneyin.',
            type: 'error'
          })
        );
        return;
      }

      dispatch(
        showMessageModal({
          title: 'Bildiriminiz Alındı! 📝',
          text: `Sayın ${trimmedName}, "${type}" konulu bildiriminiz incelenmek üzere ekibimize iletildi. Teşekkür ederiz!`,
          type: 'success',
        })
      );

      setName('');
      setEmail('');
      setType('Öneri / İstek');
      setMessage('');
      setWebsite('');
    } catch (err) {
      console.error(err);
      dispatch(
        showMessageModal({
          title: 'Bağlantı Hatası',
          text: 'Sunucuya ulaşılamadı. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.',
          type: 'error'
        })
      );
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const contactCardsBlock = (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {/* 1. Şube Adresi Kartı */}
            <div className="bg-stone-900/95 border border-stone-800/90 hover:border-stone-700 backdrop-blur-md rounded-3xl p-6 shadow-xl flex flex-col justify-between gap-5 transition-all">
              <div className="space-y-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 bg-brand-500/15 border border-brand-500/30 text-brand-400 rounded-2xl flex items-center justify-center text-lg shrink-0">
                    <i className="fa-solid fa-location-dot"></i>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-brand-400 uppercase tracking-widest block">
                      Merkez Şube
                    </span>
                    <h4 className="font-extrabold text-base text-white leading-snug">Şubemiz &amp; Konum</h4>
                  </div>
                </div>

                <div className="bg-stone-950/70 border border-stone-800/80 rounded-2xl p-4 space-y-2">
                  <p className="text-stone-300 text-xs sm:text-sm leading-relaxed">
                    {addressText}
                  </p>
                  <div className="flex items-center justify-between pt-1 border-t border-stone-800/80">
                    <span className="text-xs font-extrabold text-white">Torbalı / İZMİR</span>
                    <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      Gel-Al &amp; Servis
                    </span>
                  </div>
                </div>
              </div>

              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addressText)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (isPreview) e.preventDefault();
                }}
                className="w-full bg-brand-500 hover:bg-brand-600 text-stone-950 font-extrabold py-3 px-4 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 transition-all"
              >
                <i className="fa-solid fa-diamond-turn-right text-sm"></i>
                <span>Yol Tarifi Al</span>
              </a>
            </div>

            {/* 2. Alo Paket & Sipariş Hattı Kartı */}
            <div className="bg-stone-900/95 border border-stone-800/90 hover:border-stone-700 backdrop-blur-md rounded-3xl p-6 shadow-xl flex flex-col justify-between gap-5 transition-all">
              <div className="space-y-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 bg-brand-500/15 border border-brand-500/30 text-brand-400 rounded-2xl flex items-center justify-center text-lg shrink-0">
                    <i className="fa-solid fa-phone-volume"></i>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-brand-400 uppercase tracking-widest block">
                      Hızlı Sipariş
                    </span>
                    <h4 className="font-extrabold text-base text-white leading-snug">Alo Paket Hattı</h4>
                  </div>
                </div>

                <div className="bg-stone-950/70 border border-stone-800/80 rounded-2xl p-4 space-y-2.5">
                  <a
                    href={`tel:${phone1Clean}`}
                    onClick={(e) => {
                      if (isPreview) e.preventDefault();
                    }}
                    className="flex items-center justify-between text-xs sm:text-sm text-brand-400 hover:text-brand-300 font-extrabold transition-colors"
                  >
                    <span className="text-stone-400 font-medium text-xs">Alo Paket:</span>
                    <span className="whitespace-nowrap">{effectiveContact.phone1 || '0552 104 55 35'}</span>
                  </a>
                  {getRestaurantStatus().isOpen ? (
                    <a
                      href={`tel:${phone2Clean}`}
                      onClick={(e) => {
                        if (isPreview) e.preventDefault();
                      }}
                      className="flex items-center justify-between text-xs sm:text-sm text-white hover:text-brand-400 font-bold pt-2 border-t border-stone-800/80 transition-colors"
                    >
                      <span className="text-stone-400 font-medium text-xs">Sabit Hat:</span>
                      <span className="whitespace-nowrap">{effectiveContact.phone2 || '0232 856 81 21'}</span>
                    </a>
                  ) : (
                    <div
                      onClick={() => {
                        if (!isPreview) alert(CLOSED_MESSAGE);
                      }}
                      className="flex items-center justify-between text-xs sm:text-sm text-stone-500 font-bold pt-2 border-t border-stone-800/80 cursor-not-allowed opacity-60"
                      title="Saat 03:00 - 10:00 arası kapalıdır"
                    >
                      <span className="text-stone-500 font-medium text-xs">Sabit Hat:</span>
                      <span className="whitespace-nowrap line-through">{effectiveContact.phone2 || '0232 856 81 21'} (Kapalı)</span>
                    </div>
                  )}
                </div>
              </div>

              {getRestaurantStatus().isOpen ? (
                <a
                  href={`tel:${phone1Clean}`}
                  onClick={(e) => {
                    if (isPreview) e.preventDefault();
                  }}
                  className="w-full bg-stone-800 hover:bg-stone-700 text-brand-400 border border-stone-700 font-extrabold py-3 px-4 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
                >
                  <i className="fa-solid fa-phone text-xs"></i>
                  <span>Hemen Ara &amp; Sipariş Ver</span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (!isPreview) alert(CLOSED_MESSAGE);
                  }}
                  className="w-full bg-stone-900 text-stone-500 border border-stone-800 font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-not-allowed opacity-60"
                  title="Saat 03:00 - 10:00 arası telefon siparişi kapalıdır"
                >
                  <i className="fa-solid fa-phone-slash text-xs"></i>
                  <span>03:00 - 10:00 Arası Telefon Kapalı</span>
                </button>
              )}
            </div>

            {/* 3. Çalışma & Paket Saatleri Kartı */}
            <div className="bg-stone-900/95 border border-stone-800/90 hover:border-stone-700 backdrop-blur-md rounded-3xl p-6 shadow-xl flex flex-col justify-between gap-5 transition-all">
              <div className="space-y-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 bg-brand-500/15 border border-brand-500/30 text-brand-400 rounded-2xl flex items-center justify-center text-lg shrink-0">
                    <i className="fa-solid fa-clock"></i>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-brand-400 uppercase tracking-widest block">
                      Servis Saatleri
                    </span>
                    <h4 className="font-extrabold text-base text-white leading-snug">Çalışma Saatlerimiz</h4>
                  </div>
                </div>

                <div className="bg-stone-950/70 border border-stone-800/80 rounded-2xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between text-xs sm:text-sm gap-2">
                    <span className="text-stone-400">Hizmet Saatleri:</span>
                    <strong className="text-white font-extrabold text-right">{workingHoursText}</strong>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-stone-800/80">
                    <span className="text-stone-400">Gece Paket Servis:</span>
                    <span className="text-amber-400 font-bold">03:00&apos;e Kadar Açık</span>
                  </div>
                </div>
              </div>

              <div className="w-full text-xs text-emerald-400 font-bold bg-emerald-500/10 py-3 px-4 rounded-xl border border-emerald-500/20 flex items-center justify-center gap-2">
                <i className="fa-solid fa-credit-card"></i>
                <span>Kapıda Kredi Kartı &amp; Nakit Ödeme</span>
              </div>
            </div>
          </div>
  );

  if (previewCardsOnly) {
    return (
      <section className="relative bg-stone-900 text-white py-10 px-6 overflow-hidden">
        <div className="max-w-5xl mx-auto space-y-6 relative z-10">
          <div className="text-center space-y-1.5">
            <span className="text-xs font-bold text-brand-500 uppercase tracking-widest">Bize Ulaşın</span>
            <h3 className="text-2xl sm:text-3xl font-extrabold">Şube, Telefon &amp; Çalışma Saatleri</h3>
          </div>
          {contactCardsBlock}
        </div>
      </section>
    );
  }

  return (
    <div id="page-iletisim" className="page-content animate-in fade-in duration-300">
      <section className="relative bg-stone-900 text-white py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Arka Plan Görseli */}
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=1600"
            alt="İletişim Arka Plan"
            className="w-full h-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-stone-950/85"></div>
        </div>

        <div className="max-w-5xl mx-auto space-y-12 relative z-10">
          <div className="text-center space-y-3">
            <span className="text-xs font-bold text-brand-500 uppercase tracking-widest">
              Bize Ulaşın
            </span>
            <h3 className="text-3xl sm:text-4xl font-extrabold">
              Sorularınız, Şikayet ve Önerileriniz İçin
            </h3>
            <p className="text-stone-300 text-sm max-w-xl mx-auto">
              Kalitemizi artırmak ve size daha iyi hizmet verebilmek için her türlü görüşünüzü bizimle paylaşabilirsiniz.
            </p>
          </div>

          {/* Üst Bölüm: Sol Görsel & Sağ Şikayet/Öneri Formu */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* Görsel Kartı (Sol) */}
            <div className="lg:col-span-5 relative h-72 lg:h-auto min-h-[320px] rounded-3xl overflow-hidden shadow-2xl border border-stone-800">
              <img
                src="/images/kasap_kofte_ekmek.jpg"
                alt="Sandviç Diyarı Lezzetleri"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/35 to-transparent flex items-end p-8">
                <div className="space-y-2">
                  <span className="bg-brand-500 text-white text-[11px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider inline-block">
                    7/24 Müşteri Memnuniyeti
                  </span>
                  <h4 className="font-extrabold text-2xl text-white">Sizin Görüşünüz, Bizim Rehberimiz</h4>
                  <p className="text-stone-300 text-xs leading-relaxed">
                    Torbalı&apos;nın en sıcak ve taze sandviç deneyimini sunmak için tüm öneri ve taleplerinizi titizlikle değerlendiriyoruz.
                  </p>
                </div>
              </div>
            </div>

            {/* Şikayet & Öneri Formu (Sağ) */}
            <div className="lg:col-span-7 bg-stone-900/90 border border-stone-800 backdrop-blur-md rounded-3xl p-8 sm:p-10 shadow-2xl">
              <div className="mb-6 space-y-1">
                <h4 className="text-2xl font-bold">Şikayet & Öneri Formu</h4>
                <p className="text-stone-400 text-xs">
                  Görüşleriniz yönetim ekibimiz tarafından doğrudan incelenmektedir.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-400 uppercase mb-1.5">
                      Adınız Soyadınız
                    </label>
                    <input
                      type="text"
                      id="fb-name"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500 text-white"
                      placeholder="Ad Soyad"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-400 uppercase mb-1.5">
                      E-Posta Adresiniz
                    </label>
                    <input
                      type="email"
                      id="fb-email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500 text-white"
                      placeholder="ornek@mail.com"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-400 uppercase mb-1.5">
                    Konu Türü
                  </label>
                  <select
                    id="fb-type"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="app-select-dark w-full bg-stone-950 hover:bg-stone-900 border border-stone-800 hover:border-stone-700 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500 text-white font-semibold cursor-pointer shadow-2xs transition-all"
                  >
                    <option value="Öneri / İstek">Öneri & İstek</option>
                    <option value="Şikayet">Şikayet (Lezzet / Kurye / Servis)</option>
                    <option value="Teşekkür">Teşekkür & Memnuniyet</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-400 uppercase mb-1.5">
                    Mesajınız / Detay
                  </label>
                  <textarea
                    id="fb-message"
                    required
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500 text-white"
                    placeholder="Görüşlerinizi detaylıca yazabilirsiniz..."
                  />
                </div>
                {/* Bot Koruması (Honeypot) */}
                <input
                  type="text"
                  name="website"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="hidden"
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-brand-500 hover:bg-brand-600 disabled:bg-stone-700 disabled:text-stone-400 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl text-sm uppercase tracking-wider shadow-lg shadow-brand-500/20 transition-all cursor-pointer"
                >
                  {isSubmitting ? 'Gönderiliyor...' : 'Bildirimi Gönder'}
                </button>
              </form>
            </div>
          </div>

          {/* Alt Bölüm: Dengeli 3'lü Yatay İletişim Kartları */}
          {contactCardsBlock}

          {/* Geniş Etkileşimli Harita & Yol Tarifi Bölümü */}
          <div className="bg-stone-900/95 border border-stone-800 rounded-3xl p-3 sm:p-4 shadow-2xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-2 pt-1">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-500 animate-ping"></span>
                <div>
                  <h4 className="font-extrabold text-sm sm:text-base text-white">
                    Harita Üzerinde Konumumuz
                  </h4>
                  <p className="text-xs text-stone-400">
                    {addressText}
                  </p>
                </div>
              </div>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addressText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-brand-500 hover:bg-brand-600 text-stone-950 font-extrabold px-4 py-2 rounded-xl text-xs uppercase tracking-wider inline-flex items-center justify-center gap-2 transition-all shrink-0 shadow-md"
              >
                <i className="fa-solid fa-location-arrow"></i>
                <span>Google Haritalar&apos;da Yol Tarifi Al</span>
              </a>
            </div>

            <div className="relative w-full h-64 sm:h-80 rounded-2xl overflow-hidden border border-stone-800 bg-stone-950">
              <iframe
                title="Sandviç Diyarı Konum Haritası"
                src={`https://maps.google.com/maps?q=${encodeURIComponent(addressText)}&t=&z=16&ie=UTF8&iwloc=&output=embed`}
                className="w-full h-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
