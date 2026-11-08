'use client';

import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  setActivePage,
  openAuthModal,
  openOptionsModal,
  setReviews
} from '@/store/slices/uiSlice';
import ProductCard from '@/components/ProductCard';
import { campaignProducts } from '@/data/initialData';
import { DEFAULT_SITE_CONTENT } from '@/lib/siteContentDefaults';

export default function HomePage() {
  const dispatch = useDispatch();
  const { items: products } = useSelector((state) => state.product);
  const { reviews } = useSelector((state) => state.ui);
  const { currentUser } = useSelector((state) => state.auth);

  const [siteContent, setSiteContent] = useState(DEFAULT_SITE_CONTENT);

  // Müşteri sayfası vitrin ve içerik ayarlarını getir
  const loadSiteContent = () => {
    fetch('/api/site-content')
      .then((res) => res.json())
      .then((res) => {
        if (res.success && res.data) {
          setSiteContent(res.data);
        }
      })
      .catch((err) => console.error('Site içerik yükleme hatası:', err));
  };

  // Sadece yönetici tarafından ONAYLANMIŞ müşteri değerlendirmelerini getir
  const loadApprovedReviews = () => {
    fetch('/api/reviews')
      .then((res) => res.json())
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          dispatch(setReviews(res.data));
        }
      })
      .catch((err) => console.error('Onaylı yorumlar yüklenemedi:', err));
  };

  useEffect(() => {
    loadSiteContent();
    loadApprovedReviews();

    // Admin panelinden içerik kaydedildiğinde anında canlı güncelleme
    const handleStorageChange = (e) => {
      if (e.key === 'sandwich_site_content_updated' || e.key === 'sandwich_reviews_updated') {
        loadSiteContent();
        loadApprovedReviews();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', () => {
      loadSiteContent();
      loadApprovedReviews();
    });

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', loadSiteContent);
    };
  }, []);

  const handleCampaignOrderClick = (menu) => {
    if (!currentUser || !currentUser.email) {
      dispatch(openAuthModal('login'));
      return;
    }
    dispatch(openOptionsModal(menu));
  };

  const hero = siteContent?.hero || DEFAULT_SITE_CONTENT.hero;
  const campaignsSection = siteContent?.campaignsSection || DEFAULT_SITE_CONTENT.campaignsSection;
  const newMenusSection = siteContent?.newMenusSection || DEFAULT_SITE_CONTENT.newMenusSection;
  const featuresSection = siteContent?.featuresSection || DEFAULT_SITE_CONTENT.featuresSection;
  const reviewsSection = siteContent?.reviewsSection || DEFAULT_SITE_CONTENT.reviewsSection;

  const newMenus = products.slice(0, newMenusSection.itemCount || 3);

  return (
    <div id="page-home" className="page-content animate-in fade-in duration-300">
      {/* 1. Hero Bölümü (Admin panelden gizlenebilir veya düzenlenebilir) */}
      {hero.visible !== false && (
        <header className="relative bg-[#181619] text-white overflow-hidden min-h-[560px] lg:min-h-[640px] flex items-center py-16 sm:py-24">
          {/* Banner görseli */}
          <div className="absolute inset-0 z-0">
            <img
              src={hero.image || '/images/hero_sandwich_banner.jpg'}
              alt="Sandviç Diyarı Manşet"
              className="w-full h-full object-cover object-[30%_center] lg:absolute lg:top-0 lg:-left-24 xl:left-0 lg:w-auto lg:max-w-none"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = '/images/hero_sandwich_banner.jpg';
              }}
            />
            {/* Mobilde okunabilirlik için alttan, masaüstünde sağdan karartma */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#181619] via-[#181619]/70 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:via-transparent lg:to-[#181619]/80"></div>
          </div>

          {/* Google Puan Kartı */}
          {hero.googleRatingVisible !== false && (
            <a
              id="hero-google-rating"
              href={hero.googleRatingUrl || 'https://www.google.com/search?q=Sandvi%C3%A7+Diyar%C4%B1+Torbal%C4%B1'}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute top-5 left-4 sm:top-8 sm:left-8 z-30 flex items-center gap-3 bg-white/95 backdrop-blur-md text-stone-900 pl-3 pr-4 py-3 rounded-2xl shadow-2xl shadow-black/40 border border-white/60 hover:-translate-y-0.5 hover:shadow-brand-500/20"
            >
              <div className="w-10 h-10 bg-brand-500 text-white rounded-xl flex items-center justify-center text-lg shadow-md shadow-brand-500/30 shrink-0">
                <i className="fa-solid fa-star"></i>
              </div>
              <div className="leading-tight">
                <span className="text-xs text-stone-500 flex items-center gap-1.5 font-medium">
                  <i className="fa-brands fa-google text-[11px]"></i> Google Müşteri Puanı
                </span>
                <span className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                  {hero.googleRatingScore || '4.9 / 5.0'}
                  <span className="text-brand-500 text-[10px] tracking-tight">
                    <i className="fa-solid fa-star"></i>
                    <i className="fa-solid fa-star"></i>
                    <i className="fa-solid fa-star"></i>
                    <i className="fa-solid fa-star"></i>
                    <i className="fa-solid fa-star"></i>
                  </span>
                  <span className="text-stone-500 font-medium text-xs">
                    {hero.googleRatingCount || '(2,400+ Yorum)'}
                  </span>
                </span>
              </div>
            </a>
          )}

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20 w-full">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              <div className="lg:col-start-8 lg:col-span-5 space-y-6 text-left pt-48 sm:pt-64 lg:pt-0">
                {/* Üst Rozet */}
                {hero.badgeVisible !== false && (
                  <div className="inline-flex items-center gap-2 bg-brand-500/10 border border-brand-500/30 text-brand-400 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide uppercase">
                    <i className="fa-solid fa-fire text-brand-500 animate-pulse"></i>
                    <span>{hero.badgeText || "Torbalı / İzmir • Gece 03:00'e Kadar Paket Servis!"}</span>
                  </div>
                )}

                {/* Başlıklar */}
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight text-left">
                    {hero.titlePrimary || 'Acıktın mı?'}
                  </h1>
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-brand-500/20 border border-brand-500/40 flex items-center justify-center text-brand-400 text-3xl shadow-lg shadow-brand-500/10 shrink-0">
                    <i className="fa-solid fa-burger animate-icon-burger"></i>
                  </div>
                </div>

                <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-amber-200 text-left">
                  {hero.titleSecondary || "Sandviç Diyarı Torbalı'da!"}
                </h2>

                <p className="text-stone-300 text-base sm:text-lg max-w-xl text-left font-light leading-relaxed">
                  {hero.description ||
                    'Özel ekmeklerle hazırlanan Maxi Karışık, Çeşme Kumru, Kasap Köfte ve avantajlı menülerle ev ve işyerlerine sıcak paket servis.'}
                </p>

                {/* Eylem Butonları */}
                <div className="flex flex-wrap justify-start gap-4 pt-2">
                  {hero.btnMenuVisible !== false && (
                    <button
                      onClick={() => dispatch(setActivePage('menu'))}
                      className="bg-brand-500 hover:bg-brand-600 text-white font-bold px-8 py-4 rounded-2xl shadow-lg shadow-brand-500/30 transition-all flex items-center gap-3 cursor-pointer"
                    >
                      <span>{hero.btnMenuText || 'Menüyü Keşfet'}</span>
                      <i className="fa-solid fa-arrow-right"></i>
                    </button>
                  )}

                  {hero.btnPhoneVisible !== false && (
                    <a
                      href={`tel:${hero.btnPhoneTel || '05521045535'}`}
                      className="bg-amber-500 hover:bg-amber-400 text-stone-950 font-black px-6 py-4 rounded-2xl shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2.5 cursor-pointer"
                    >
                      <i className="fa-solid fa-phone-volume text-lg animate-icon-phone"></i>
                      <span>{hero.btnPhoneText || '0552 104 55 35'}</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* 2. Ana Sayfa Kampanya ve Yeni Menüler Vitrini */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        {/* Kampanya Ürünleri Alanı (Katalog Görünümü) */}
        {campaignsSection.visible !== false && (
          <div>
            <div className="flex justify-between items-end mb-8">
              <div>
                <span className="text-xs font-bold text-brand-600 uppercase tracking-widest">
                  {campaignsSection.badgeText || 'Özel Fırsat Kataloğu'}
                </span>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-stone-900">
                  {campaignsSection.title || 'Günün Kampanyalı Ürünleri'}
                </h3>
              </div>
              {campaignsSection.btnAllVisible !== false && (
                <button
                  onClick={() => dispatch(setActivePage('kampanyalar'))}
                  className="text-brand-600 hover:text-brand-700 font-bold text-sm flex items-center gap-2 cursor-pointer"
                >
                  <span>{campaignsSection.btnAllText || 'Tümünü Gör'}</span>{' '}
                  <i className="fa-solid fa-arrow-right"></i>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {campaignProducts.map((menu) => {
                const savings = menu.oldPrice ? Math.round(menu.oldPrice - menu.price) : 0;
                return (
                  <div
                    key={menu.id}
                    className="bg-white rounded-3xl p-4 border border-stone-200/80 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group"
                  >
                    <div>
                      <div className="relative w-full h-44 rounded-2xl overflow-hidden mb-4 bg-stone-100">
                        <img
                          src={menu.image}
                          alt={menu.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src =
                              'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=500';
                          }}
                        />
                        <span className="absolute top-2.5 left-2.5 bg-white/95 backdrop-blur-md text-stone-900 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm">
                          {menu.badge}
                        </span>
                        {savings > 0 && (
                          <span className="absolute top-2.5 right-2.5 bg-rose-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-md">
                            -₺{savings} İndirim
                          </span>
                        )}
                      </div>

                      <h4 className="font-extrabold text-base text-stone-900 group-hover:text-brand-600 transition-colors leading-snug">
                        {menu.name}
                      </h4>
                      <p className="text-stone-500 text-xs mt-1.5 leading-relaxed line-clamp-2">
                        {menu.description}
                      </p>
                    </div>

                    <div className="pt-4 mt-4 border-t border-stone-100 flex items-center justify-between gap-2">
                      <div>
                        {menu.oldPrice && (
                          <span className="text-[11px] text-stone-400 line-through block font-medium">
                            ₺{menu.oldPrice.toFixed(2)}
                          </span>
                        )}
                        <span className="text-lg font-extrabold text-brand-600">
                          ₺{menu.price.toFixed(2)}
                        </span>
                      </div>
                      <button
                        onClick={() => handleCampaignOrderClick(menu)}
                        className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2.5 rounded-xl shadow-md shadow-brand-500/20 transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer active:scale-95"
                      >
                        <i className={`fa-solid ${currentUser ? 'fa-plus' : 'fa-user-lock'}`}></i> Sepete Ekle
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. Yeni Menüler Alanı (Minimal & Mobil Uyumlu) */}
        {newMenusSection.visible !== false && (
          <div>
            <div className="flex items-end justify-between mb-4 sm:mb-6">
              <div>
                <span className="text-[11px] font-bold text-brand-600 uppercase tracking-wider block mb-0.5">
                  {newMenusSection.badgeText || 'Taze Çıktı'}
                </span>
                <h3 className="text-xl sm:text-2xl font-extrabold text-stone-900 tracking-tight">
                  {newMenusSection.title || 'En Yeni Menülerimiz'}
                </h3>
              </div>
              {newMenusSection.btnAllVisible !== false && (
                <button
                  onClick={() => dispatch(setActivePage('menu'))}
                  className="text-xs sm:text-sm font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1 cursor-pointer transition-colors active:scale-95"
                >
                  <span>{newMenusSection.btnAllText || 'Tümünü Gör'}</span>
                  <i className="fa-solid fa-chevron-right text-[10px]"></i>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5 lg:gap-6">
              {newMenus.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        )}

        {/* 4. Neden Sandwich Diyarı? (Admin panelinden arka plan ve metinler düzenlenebilir) */}
        {featuresSection.visible !== false && (
          <div className="relative bg-stone-950 text-white border border-stone-800 rounded-3xl p-6 sm:p-10 lg:p-12 shadow-2xl overflow-hidden">
            {/* Arka Plan Görseli & Karartma Katmanı */}
            <div className="pointer-events-none absolute inset-0 z-0">
              <img
                src={
                  featuresSection.bgImage ||
                  'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&q=85&w=1800'
                }
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = '/images/kasap_kofte_ekmek.jpg';
                }}
                alt="Sandwich Diyarı Izgara Lezzetleri"
                className="w-full h-full object-cover object-center opacity-45 scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950/95 via-stone-950/75 to-stone-950/85"></div>
            </div>

            {/* Dekoratif Arka Plan Işıltıları */}
            <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-brand-500/15 blur-3xl z-0"></div>
            <div className="pointer-events-none absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-amber-500/15 blur-3xl z-0"></div>

            <div className="relative z-10 text-center max-w-2xl mx-auto mb-10 space-y-2">
              <span className="text-xs font-bold text-brand-400 uppercase tracking-widest block">
                {featuresSection.badgeText || 'Kalite Garantisi'}
              </span>
              <h3 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight drop-shadow-sm">
                {featuresSection.title || 'Neden Sandwich Diyarı?'}
              </h3>
            </div>

            <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6 md:divide-x md:divide-white/10">
              {(featuresSection.items || []).map((feat, idx) => (
                <div key={feat.id || idx} className="group px-4 sm:px-6 py-2 flex flex-col items-center text-center space-y-3">
                  <i className={`${feat.icon || 'fa-solid fa-seedling'} text-3xl sm:text-4xl text-brand-400 drop-shadow`}></i>
                  <h4 className="font-extrabold text-lg sm:text-xl text-white tracking-tight">
                    {feat.title}
                  </h4>
                  <p className="text-stone-300 text-xs sm:text-sm leading-relaxed max-w-xs">
                    {feat.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. Müşteri Yorumları Vitrini (Yenilenmiş & Premium Tasarım) */}
        {reviewsSection.visible !== false && (
          <div className="py-4">
            <div className="bg-gradient-to-b from-stone-50/80 via-white to-amber-50/20 rounded-3xl p-6 sm:p-10 lg:p-12 border border-stone-200/80 shadow-sm relative overflow-hidden">
              {/* Arka Plan Dekoratif Işık Halkaları */}
              <div className="absolute top-0 right-0 -mt-12 -mr-12 w-80 h-80 bg-amber-400/10 rounded-full blur-3xl pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl pointer-events-none"></div>

              {/* Başlık & Güven Rozeti */}
              <div className="text-center max-w-2xl mx-auto mb-10 space-y-3 relative z-10">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200 text-xs font-bold shadow-2xs">
                  <span className="flex text-amber-400 text-xs gap-0.5">
                    <i className="fa-solid fa-star"></i>
                    <i className="fa-solid fa-star"></i>
                    <i className="fa-solid fa-star"></i>
                    <i className="fa-solid fa-star"></i>
                    <i className="fa-solid fa-star"></i>
                  </span>
                  <span>4.9 / 5.0 Memnuniyet</span>
                  <span className="w-1 h-1 rounded-full bg-amber-400"></span>
                  <span className="text-stone-500 font-semibold">Doğrulanmış Siparişler</span>
                </div>

                <h3 className="text-2xl sm:text-4xl font-black text-stone-900 tracking-tight">
                  {reviewsSection.title || 'Lezzet Severler Ne Diyor?'}
                </h3>
                <p className="text-stone-500 text-xs sm:text-sm leading-relaxed max-w-lg mx-auto">
                  {reviewsSection.subtitle ||
                    "Torbalı'da her gün yüzlerce sıcak siparişi lezzet tutkunlarıyla buluşturuyoruz."}
                </p>
              </div>

              {/* Yorum Kartları Izgarası */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                {(reviews || [])
                  .filter((r) => r.isApproved === true)
                  .slice(0, 3)
                  .map((review, index) => {
                    const avatarThemes = [
                      {
                        gradient: 'bg-gradient-to-br from-amber-500 via-orange-500 to-red-600',
                        ring: 'ring-4 ring-orange-200/80 shadow-md shadow-orange-500/20',
                        accentLine: 'from-amber-400 via-orange-500 to-red-500',
                        badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                        starScore: '5.0'
                      },
                      {
                        gradient: 'bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600',
                        ring: 'ring-4 ring-emerald-200/80 shadow-md shadow-emerald-500/20',
                        accentLine: 'from-emerald-400 via-teal-500 to-cyan-500',
                        badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                        starScore: '5.0'
                      },
                      {
                        gradient: 'bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-600',
                        ring: 'ring-4 ring-purple-200/80 shadow-md shadow-purple-500/20',
                        accentLine: 'from-violet-400 via-purple-500 to-fuchsia-500',
                        badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                        starScore: '5.0'
                      }
                    ];
                    const theme = avatarThemes[index % avatarThemes.length];

                    return (
                      <div
                        key={review.id}
                        className="bg-white rounded-3xl p-6 sm:p-7 border border-stone-200/80 shadow-xs hover:shadow-2xl hover:border-amber-300 hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between relative overflow-hidden group min-h-[230px]"
                      >
                        {/* Kart Üstü Renkli İnce Çizgi Vurgusu */}
                        <div
                          className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${theme.accentLine} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
                        ></div>

                        {/* Arka Planda Zarif Filigran Tırnak İkonu (Çakışma yapmadan alt-sağda) */}
                        <i className="fa-solid fa-quote-right text-7xl absolute -bottom-3 right-3 text-stone-100 group-hover:text-amber-100/60 transition-colors pointer-events-none select-none z-0"></i>

                        {/* Üst Kısım: Yıldızlar & Onay Rozeti */}
                        <div className="space-y-4 relative z-10">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <div className="flex text-amber-400 text-xs sm:text-sm gap-0.5">
                                {[...Array(Number(review.rating) || 5)].map((_, i) => (
                                  <i key={i} className="fa-solid fa-star"></i>
                                ))}
                              </div>
                              <span className="text-[11px] font-black text-amber-900 bg-amber-100/70 px-1.5 py-0.5 rounded-md">
                                {Number(review.rating || 5).toFixed(1)}
                              </span>
                            </div>

                            <span
                              className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${theme.badgeBg} flex items-center gap-1.5 shrink-0 shadow-2xs`}
                            >
                              <i className="fa-solid fa-circle-check text-emerald-600 text-[10px]"></i>
                              <span>Onaylı Sipariş</span>
                            </span>
                          </div>

                          {/* Yorum Metni */}
                          <p className="text-stone-700 text-xs sm:text-sm leading-relaxed font-medium italic">
                            &ldquo;{review.comment}&rdquo;
                          </p>
                        </div>

                        {/* Alt Kısım: Müşteri Profili & Konum */}
                        <div className="flex items-center gap-3.5 pt-4 mt-4 border-t border-stone-100 relative z-10">
                          <div className="relative shrink-0">
                            <div
                              className={`w-11 h-11 ${theme.gradient} ${theme.ring} rounded-full flex items-center justify-center font-black text-xs text-white tracking-wider select-none`}
                            >
                              {review.initials || 'SD'}
                            </div>
                            <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center text-[8px] text-white shadow-xs">
                              <i className="fa-solid fa-check"></i>
                            </span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-xs sm:text-sm text-stone-900 block truncate">
                              {review.name}
                            </span>
                            <span className="text-[11px] text-stone-500 font-medium flex items-center gap-1 truncate">
                              <i className="fa-solid fa-location-dot text-brand-500 text-[10px]"></i>
                              <span>{review.location || 'Torbalı, İzmir'}</span>
                              {review.date && (
                                <span className="text-stone-400 text-[10px]"> &bull; {review.date}</span>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Alt Alan: Değerlendirme Butonu ve Güven Rozetleri */}
              <div className="mt-8 pt-6 border-t border-stone-200/70 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left relative z-10">
                <div className="flex items-center gap-3 text-xs text-stone-600">
                  <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <i className="fa-solid fa-shield-halved"></i>
                  </span>
                  <span>Tüm değerlendirmeler gerçek ve doğrulanmış müşteri siparişlerine aittir.</span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('review-name') || document.querySelector('footer');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="bg-brand-500 hover:bg-brand-600 active:scale-98 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md shadow-brand-500/20 transition-all flex items-center gap-2 cursor-pointer shrink-0"
                >
                  <i className="fa-regular fa-pen-to-square"></i>
                  <span>Siz de Deneyiminizi Paylaşın</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
