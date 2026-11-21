'use client';

import { useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { showMessageModal, openTrackOrderModal } from '@/store/slices/uiSlice';
import { getRestaurantStatus, CLOSED_MESSAGE } from '@/lib/openingHours';

export default function Footer() {
  const dispatch = useDispatch();
  const { activePage } = useSelector((state) => state.ui);
  const [rating, setRating] = useState(5);
  const [reviewName, setReviewName] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [website, setWebsite] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [legalDocModal, setLegalDocModal] = useState(null); // 'kvkk' | 'privacy' | 'terms' | null
  const isSubmittingRef = useRef(false);

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;

    const trimmedName = reviewName.trim();
    const trimmedComment = reviewComment.trim();
    if (trimmedName.length < 2 || trimmedComment.length < 5) {
      dispatch(
        showMessageModal({
          title: 'Eksik Bilgi',
          text: 'Lütfen adınızı (en az 2 karakter) ve yorumunuzu (en az 5 karakter) girin.',
          type: 'error'
        })
      );
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          rating,
          comment: trimmedComment,
          location: 'Torbalı, İzmir',
          website
        })
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.success) {
        dispatch(
          showMessageModal({
            title: res.status === 429 ? 'Lütfen Bekleyin' : 'Gönderilemedi',
            text: json.error || json.message || 'Değerlendirmeniz gönderilemedi. Lütfen biraz sonra tekrar deneyin.',
            type: 'error'
          })
        );
        return;
      }

      dispatch(
        showMessageModal({
          title: 'Değerlendirmeniz Alındı! ⭐',
          text: `Teşekkür ederiz, ${trimmedName}! Yorumunuz incelenip yönetici tarafından onaylandıktan sonra sitemizde yayınlanacaktır.`,
          type: 'success',
        })
      );

      setReviewName('');
      setReviewComment('');
      setRating(5);
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

  return (
    <footer className={`bg-stone-900 text-white pb-12 border-t border-stone-800 ${activePage === 'iletisim' ? 'pt-8 mt-0' : 'pt-16 mt-20'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Bizi Değerlendir Bölümü (İletişim sayfasında gösterilmez) */}
        {activePage !== 'iletisim' && (
          <div className="bg-stone-800/80 border border-stone-700/60 rounded-3xl p-8 sm:p-12 shadow-2xl grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Sol Taraf: İştah Açıcı Görsel ve Bilgi */}
            <div className="lg:col-span-5 relative h-72 lg:h-full min-h-[300px] rounded-2xl overflow-hidden shadow-xl border border-stone-700">
              <img
                src="/images/kasap_kofte_ekmek.jpg"
                alt="Lezzetli Sandviç"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-900/90 via-stone-900/30 to-transparent flex items-end p-8">
                <div className="space-y-1">
                  <span className="bg-brand-500 text-white text-[11px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
                    Gurme Deneyim
                  </span>
                  <h4 className="font-extrabold text-2xl text-white mt-2">Her Lokmada Mutluluk</h4>
                  <p className="text-stone-300 text-xs">
                    Kalitemizi artırmak için her geri bildiriminiz bizim için çok kıymetli.
                  </p>
                </div>
              </div>
            </div>

            {/* Sağ Taraf: Değerlendirme Formu */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="space-y-2">
                <span className="text-xs font-bold text-brand-400 uppercase tracking-widest">
                  <i className="fa-solid fa-star text-brand-500 mr-1"></i> Geri Bildiriminiz Değerli
                </span>
                <h3 className="text-3xl font-extrabold">Sandviç Diyarı'nı Değerlendirin</h3>
                <p className="text-stone-400 text-sm">
                  Lezzetlerimiz ve hizmetimiz hakkında düşüncelerinizi bizimle paylaşın.
                </p>
              </div>

              <form onSubmit={handleSubmitReview} className="space-y-5">
                {/* Yıldız Seçimi */}
                <div className="flex justify-center lg:justify-start gap-2.5 text-2xl text-stone-500" id="star-rating-container">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className={`star-btn transition-colors cursor-pointer ${
                        star <= rating ? 'text-brand-500' : 'text-stone-500 hover:text-brand-500'
                      }`}
                    >
                      <i className="fa-solid fa-star"></i>
                    </button>
                  ))}
                </div>

                <div className="space-y-4 text-left">
                  <div>
                    <label className="block text-xs font-semibold text-stone-400 uppercase mb-1.5">
                      Adınız Soyadınız
                    </label>
                    <input
                      type="text"
                      id="review-name"
                      required
                      value={reviewName}
                      onChange={(e) => setReviewName(e.target.value)}
                      className="w-full bg-stone-900 border border-stone-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500 text-white"
                      placeholder="Ad Soyad"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-400 uppercase mb-1.5">
                      Deneyiminiz
                    </label>
                    <textarea
                      id="review-comment"
                      required
                      rows={3}
                      maxLength={600}
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      className="w-full bg-stone-900 border border-stone-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500 text-white resize-y min-h-[92px]"
                      placeholder="Örn: Efsane lezzet, çok hızlı geldi!"
                    />
                  </div>
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
                  {isSubmitting ? 'Gönderiliyor...' : 'Değerlendirmeyi Gönder'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* İletişim, Şube Adresi ve Çalışma Saatleri (İletişim sayfasında kendi yatay kartları olduğu için tekrar gösterilmez) */}
        {activePage !== 'iletisim' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 py-8 border-t border-b border-stone-800 text-center">
            {/* Adres */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-center gap-2 text-brand-400 font-bold text-sm uppercase tracking-wider">
                <i className="fa-solid fa-location-dot"></i>
                <span>Adresimiz</span>
              </div>
              <p className="text-stone-300 text-xs leading-relaxed">
                Torbalı Mahallesi Hüseyin Kurtuldu Sokak No:32<br />
                Torbalı / İZMİR
              </p>
              <a
                href="https://www.google.com/maps/dir/?api=1&destination=Torbal%C4%B1+Mahallesi+H%C3%BCseyin+Kurtuldu+Sokak+No:32+Torbal%C4%B1+%C4%B0zmir"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-brand-500/15 hover:bg-brand-500 text-brand-400 hover:text-white border border-brand-500/30 font-bold text-xs px-3 py-1.5 rounded-xl transition-all"
              >
                <i className="fa-solid fa-diamond-turn-right"></i>
                <span>Yol Tarifi Al</span>
              </a>
            </div>

            {/* Telefon & Alo Paket */}
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 text-brand-400 font-bold text-sm uppercase tracking-wider">
                <i className="fa-solid fa-phone-volume"></i>
                <span>Sipariş & Alo Paket</span>
              </div>
              <p className="text-stone-300 text-xs leading-relaxed space-y-1">
                {getRestaurantStatus().isOpen ? (
                  <>
                    <a href="tel:02328568121" className="block hover:text-white transition-colors">
                      <strong className="text-white">Sabit Hat:</strong> 0 232 856 81 21
                    </a>
                    <a href="tel:05521045535" className="block text-brand-400 hover:text-brand-300 font-bold">
                      <i className="fa-solid fa-mobile-screen mr-1"></i> ALO PAKET: 0 552 104 55 35
                    </a>
                  </>
                ) : (
                  <>
                    <span
                      onClick={() => alert(CLOSED_MESSAGE)}
                      className="block text-stone-500 line-through cursor-not-allowed opacity-60"
                      title="Saat 03:00 - 10:00 arası kapalıdır"
                    >
                      <strong>Sabit Hat:</strong> 0 232 856 81 21 (Kapalı)
                    </span>
                    <span
                      onClick={() => alert(CLOSED_MESSAGE)}
                      className="block text-stone-500 font-medium cursor-not-allowed opacity-60"
                      title="Saat 03:00 - 10:00 arası kapalıdır"
                    >
                      <i className="fa-solid fa-phone-slash mr-1"></i> ALO PAKET: 0 552 104 55 35 (Kapalı)
                    </span>
                  </>
                )}
              </p>
            </div>

            {/* Çalışma Saatleri & Ödeme */}
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 text-brand-400 font-bold text-sm uppercase tracking-wider">
                <i className="fa-solid fa-clock"></i>
                <span>Çalışma Saatleri & Ödeme</span>
              </div>
              <p className="text-stone-300 text-xs leading-relaxed">
                Sabah 10:00 - Gece 03:00 Arası Açığız<br />
                <span className="text-stone-400">Paket Servisimiz Gece 03:00&apos;e Kadar Vardır.</span><br />
                <span className="text-amber-400 font-semibold flex items-center justify-center gap-1.5 mt-1">
                  <i className="fa-brands fa-cc-visa text-sm"></i>
                  <i className="fa-brands fa-cc-mastercard text-sm"></i>
                  <span>Kapıda Kredi Kartı & Nakit Ödeme</span>
                </span>
              </p>
            </div>
          </div>
        )}

        {/* Telif ve Alt Bilgi */}
        <div className="text-center text-stone-500 text-xs space-y-3.5 pt-2 flex flex-col items-center">
          <div className="inline-flex items-center gap-2.5">
            <img
              src="/logo.png?v=2"
              alt="Sandviç Diyarı Logo"
              className="h-9 w-auto object-contain drop-shadow-md shrink-0"
            />
            <span className="text-lg font-extrabold tracking-tight text-white">
              Sandviç <span className="text-brand-500">Diyarı</span>
            </span>
          </div>
          <p>&copy; 2026 Sandviç Diyarı - Torbalı / İzmir. Tüm Hakları Saklıdır.</p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-stone-400 text-xs">
            <span>Ev ve işyerlerine sıcak & hızlı paket servis.</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1 text-[11px] font-medium text-stone-400">
            <button
              type="button"
              onClick={() => setLegalDocModal('kvkk')}
              className="hover:text-brand-400 underline underline-offset-4 transition-colors cursor-pointer"
            >
              KVKK Aydınlatma Metni
            </button>
            <span className="text-stone-700">&bull;</span>
            <button
              type="button"
              onClick={() => setLegalDocModal('privacy')}
              className="hover:text-brand-400 underline underline-offset-4 transition-colors cursor-pointer"
            >
              Gizlilik ve Güvenlik Politikası
            </button>
            <span className="text-stone-700">&bull;</span>
            <button
              type="button"
              onClick={() => setLegalDocModal('terms')}
              className="hover:text-brand-400 underline underline-offset-4 transition-colors cursor-pointer"
            >
              Sipariş ve İptal Koşulları
            </button>
            <span className="text-stone-700">&bull;</span>
            <button
              type="button"
              onClick={() => dispatch(openTrackOrderModal())}
              className="text-amber-400 hover:text-amber-300 font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
            >
              <i className="fa-solid fa-location-crosshairs text-xs"></i>
              <span>Sipariş Takibi &amp; Sorgula</span>
            </button>
          </div>
        </div>
      </div>

      {/* KVKK, Gizlilik ve Sipariş Koşulları Açılır Penceresi */}
      {legalDocModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setLegalDocModal(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-stone-950/75 backdrop-blur-xs"
        >
          <div className="bg-white text-stone-800 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-5 py-4 bg-stone-50 border-b border-stone-200">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-shield-halved text-brand-600 text-base"></i>
                <h4 className="font-extrabold text-sm sm:text-base text-stone-900">
                  {legalDocModal === 'kvkk' && '6698 Sayılı KVKK Kapsamında Aydınlatma Metni'}
                  {legalDocModal === 'privacy' && 'Gizlilik, Veri Güvenliği ve Çerez Politikası'}
                  {legalDocModal === 'terms' && 'Sipariş, Teslimat ve İptal Koşulları'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setLegalDocModal(null)}
                className="w-8 h-8 rounded-full bg-stone-200/70 hover:bg-stone-300 text-stone-700 flex items-center justify-center cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            <div className="flex gap-1.5 px-5 pt-3 bg-white border-b border-stone-100 pb-2.5">
              {[
                { key: 'kvkk', label: 'KVKK Aydınlatma' },
                { key: 'privacy', label: 'Gizlilik & Güvenlik' },
                { key: 'terms', label: 'Sipariş & İptal' }
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setLegalDocModal(t.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    legalDocModal === t.key
                      ? 'bg-brand-500 text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="p-5 overflow-y-auto text-xs sm:text-sm text-stone-600 space-y-3 leading-relaxed text-left">
              {legalDocModal === 'kvkk' && (
                <>
                  <p>
                    <strong>1. Veri Sorumlusu:</strong> 6698 sayılı Kişisel Verilerin Korunması Kanunu (&ldquo;KVKK&rdquo;) uyarınca kişisel verileriniz, veri sorumlusu sıfatıyla <strong>Sandviç Diyarı (Torbalı / İzmir)</strong> tarafından aşağıda açıklanan kapsamda işlenmektedir.
                  </p>
                  <p>
                    <strong>2. İşlenen Kişisel Veriler ve Amaçları:</strong> Sitemiz üzerinden verdiğiniz siparişlerin hazırlanması, adresinize teslim edilmesi ve gerektiğinde kurye/restoran bilgilendirmelerinin yapılması amacıyla yalnızca <em>Ad-Soyad, Telefon Numarası, Teslimat Adresi, E-posta Adresi ve Sipariş Detaylarınız</em> işlenmektedir.
                  </p>
                  <p>
                    <strong>3. Ödeme Güvenliği:</strong> Sitemizde online kredi kartı bilgisi talep edilmemekte ve saklanmamaktadır. Tüm ödemeler teslimat anında kapıda nakit veya fiziksel POS cihazı ile tahsil edilir.
                  </p>
                  <p>
                    <strong>4. Verilerin Aktarımı ve Korunması:</strong> Verileriniz, siparişin ulaştırılması dışında üçüncü kişi veya reklam firmalarıyla paylaşılmaz; şifreli bulut veritabanı altyapısında (SSL/TLS ve kriptografik parola koruması altında) muhafaza edilir.
                  </p>
                  <p>
                    <strong>5. KVKK Madde 11 Kapsamındaki Haklarınız:</strong> İletişim numaramız üzerinden bize ulaşarak kayıtlı kişisel verilerinizin silinmesini, düzeltilmesini veya bilgi verilmesini her zaman talep edebilirsiniz.
                  </p>
                </>
              )}

              {legalDocModal === 'privacy' && (
                <>
                  <p>
                    <strong>1. Bilgi Güvenliği:</strong> Kullanıcı şifreleri veritabanımızda açık metin olarak tutulmaz; tek yönlü kriptografik özetleme (Scrypt + Salt) ile korunur.
                  </p>
                  <p>
                    <strong>2. Yetkisiz Erişim Koruması:</strong> Müşteri ve sipariş uç noktaları oturum doğrulaması (HttpOnly JWT), hız sınırlaması (Rate Limiting) ve SQL/XSS filtreleriyle korunmaktadır.
                  </p>
                  <p>
                    <strong>3. Çerez (Cookie) Kullanımı:</strong> Sitemizde yalnızca sepet içeriğinizi ve üye oturumunuzu korumak için zorunlu işlevsel çerezler/oturum verileri kullanılır; reklam veya üçüncü taraf takip çerezi kullanılmaz.
                  </p>
                </>
              )}

              {legalDocModal === 'terms' && (
                <>
                  <p>
                    <strong>1. Teslimat Bölgesi ve Saatleri:</strong> Paket servisimiz Torbalı teslimat bölgelerimize 10:00 &ndash; 03:00 saatleri arasında ücretsiz olarak yapılmaktadır.
                  </p>
                  <p>
                    <strong>2. Sipariş İptali ve Değişiklik:</strong> Siparişiniz &ldquo;Mutfakta Hazırlanıyor&rdquo; aşamasına geçmeden önce sitemizdeki Sipariş Takip ekranından veya telefon/WhatsApp hattımızdan ücretsiz iptal edebilirsiniz.
                  </p>
                  <p>
                    <strong>3. Kapıda Ödeme:</strong> Sipariş tutarı teslimat sırasında kapıda nakit veya kredi/banka kartı (POS) ile ödenir.
                  </p>
                </>
              )}
            </div>

            <div className="px-5 py-3 bg-stone-50 border-t border-stone-200 flex justify-end">
              <button
                type="button"
                onClick={() => setLegalDocModal(null)}
                className="bg-stone-900 hover:bg-stone-800 text-white font-bold px-5 py-2 rounded-xl text-xs cursor-pointer"
              >
                Anladım, Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}
