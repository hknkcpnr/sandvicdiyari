'use client';

import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { showMessageModal, addReview } from '@/store/slices/uiSlice';

export default function Footer() {
  const dispatch = useDispatch();
  const { activePage } = useSelector((state) => state.ui);
  const [rating, setRating] = useState(5);
  const [reviewName, setReviewName] = useState('');
  const [reviewComment, setReviewComment] = useState('');

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!reviewName || !reviewComment) return;

    const newReview = {
      id: Date.now(),
      name: reviewName,
      rating,
      comment: reviewComment,
      initials: reviewName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase(),
      location: 'Torbalı, İzmir',
      isApproved: false
    };

    // Submit to API (Yeni yorumlar yönetici onayı bekler)
    try {
      await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newReview)
      });
    } catch (err) {
      console.error(err);
    }

    dispatch(
      showMessageModal({
        title: 'Değerlendirmeniz Alındı! ⭐',
        text: `Teşekkür ederiz, ${reviewName}! Yorumunuz incelenip yönetici tarafından onaylandıktan sonra sitemizde yayınlanacaktır.`,
        type: 'success',
      })
    );

    setReviewName('');
    setReviewComment('');
    setRating(5);
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
            <div className="lg:col-span-7 space-y-6 text-left">
              <div className="space-y-2">
                <span className="text-xs font-bold text-brand-400 uppercase tracking-widest">
                  <i className="fa-solid fa-star text-brand-500 mr-1"></i> Geri Bildiriminiz Değerli
                </span>
                <h3 className="text-3xl font-extrabold">Sandwich Diyarı'nı Değerlendirin</h3>
                <p className="text-stone-400 text-sm">
                  Lezzetlerimiz ve hizmetimiz hakkında düşüncelerinizi bizimle paylaşın.
                </p>
              </div>

              <form onSubmit={handleSubmitReview} className="space-y-5">
                {/* Yıldız Seçimi */}
                <div className="flex justify-start gap-2.5 text-2xl text-stone-500" id="star-rating-container">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
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
                    <input
                      type="text"
                      id="review-comment"
                      required
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      className="w-full bg-stone-900 border border-stone-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500 text-white"
                      placeholder="Örn: Efsane lezzet, çok hızlı geldi!"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-3.5 rounded-xl text-sm uppercase tracking-wider shadow-lg shadow-brand-500/20 transition-all cursor-pointer"
                >
                  Değerlendirmeyi Gönder
                </button>
              </form>
            </div>
          </div>
        )}

        {/* İletişim, Şube Adresi ve Çalışma Saatleri (İletişim sayfasında kendi yatay kartları olduğu için tekrar gösterilmez) */}
        {activePage !== 'iletisim' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 py-8 border-t border-b border-stone-800 text-left">
            {/* Adres */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-brand-400 font-bold text-sm uppercase tracking-wider">
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
              <div className="flex items-center gap-2 text-brand-400 font-bold text-sm uppercase tracking-wider">
                <i className="fa-solid fa-phone-volume"></i>
                <span>Sipariş & Alo Paket</span>
              </div>
              <p className="text-stone-300 text-xs leading-relaxed space-y-1">
                <a href="tel:02328568121" className="block hover:text-white transition-colors">
                  <strong className="text-white">Sabit Hat:</strong> 0 232 856 81 21
                </a>
                <a href="tel:05521045535" className="block text-brand-400 hover:text-brand-300 font-bold">
                  <i className="fa-solid fa-mobile-screen mr-1"></i> ALO PAKET: 0 552 104 55 35
                </a>
              </p>
            </div>

            {/* Çalışma Saatleri & Ödeme */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-brand-400 font-bold text-sm uppercase tracking-wider">
                <i className="fa-solid fa-clock"></i>
                <span>Çalışma Saatleri & Ödeme</span>
              </div>
              <p className="text-stone-300 text-xs leading-relaxed">
                Sabah 10:00 - Gece 03:00 Arası Açığız<br />
                <span className="text-stone-400">Paket Servisimiz Gece 03:00&apos;e Kadar Vardır.</span><br />
                <span className="text-amber-400 font-semibold flex items-center gap-1.5 mt-1">
                  <i className="fa-brands fa-cc-visa text-sm"></i>
                  <i className="fa-brands fa-cc-mastercard text-sm"></i>
                  <span>Kapıda Kredi Kartı & Nakit Ödeme</span>
                </span>
              </p>
            </div>
          </div>
        )}

        {/* Telif, Alt Bilgi ve Yönetim Paneli Linki */}
        <div className="text-center text-stone-500 text-xs space-y-3 pt-2">
          <p>&copy; 2026 Sandviç Diyarı - Torbalı / İzmir. Tüm Hakları Saklıdır.</p>
          <div className="flex items-center justify-center gap-4 text-stone-400 text-xs">
            <span>Ev ve işyerlerine sıcak & hızlı paket servis.</span>
            <span>&bull;</span>
            <a
              href="/admin"
              className="text-brand-400 hover:text-brand-300 transition-colors font-medium flex items-center gap-1.5 bg-stone-800 hover:bg-stone-700 px-3 py-1 rounded-lg border border-stone-700"
            >
              <i className="fa-solid fa-lock text-[11px]"></i>
              Yönetici Paneli (Admin)
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
