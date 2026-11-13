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
import { getRestaurantStatus, CLOSED_MESSAGE } from '@/lib/openingHours';

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
    dispatch(openOptionsModal(menu));
  };

  const hero = siteContent?.hero || DEFAULT_SITE_CONTENT.hero;
  const campaignsSection = siteContent?.campaignsSection || DEFAULT_SITE_CONTENT.campaignsSection;
  const newMenusSection = siteContent?.newMenusSection || DEFAULT_SITE_CONTENT.newMenusSection;
  const featuresSection = siteContent?.featuresSection || DEFAULT_SITE_CONTENT.featuresSection;
  const reviewsSection = siteContent?.reviewsSection || DEFAULT_SITE_CONTENT.reviewsSection;

  // En iyi avantajlı menüler (öncelikli olarak category: 'menu' olanlar)
  const menuCategoryProducts = (products || []).filter((p) => p.category === 'menu');
  const bestMenus = (menuCategoryProducts.length > 0 ? menuCategoryProducts : products || []).slice(
    0,
    newMenusSection.itemCount || 3
  );

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
                    getRestaurantStatus().isOpen ? (
                      <a
                        href={`tel:${hero.btnPhoneTel || '05521045535'}`}
                        className="bg-amber-500 hover:bg-amber-400 text-stone-950 font-black px-6 py-4 rounded-2xl shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2.5 cursor-pointer"
                      >
                        <i className="fa-solid fa-phone-volume text-lg animate-icon-phone"></i>
                        <span>{hero.btnPhoneText || '0552 104 55 35'}</span>
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => alert(CLOSED_MESSAGE)}
                        className="bg-stone-800 text-stone-400 font-bold px-6 py-4 rounded-2xl border border-stone-700 transition-all flex items-center gap-2.5 cursor-pointer opacity-70"
                        title="Saat 03:00 - 10:00 arası telefon siparişi kapalıdır"
                      >
                        <i className="fa-solid fa-phone-slash text-lg text-stone-500"></i>
                        <span>{hero.btnPhoneText || '0552 104 55 35'} (Kapalı)</span>
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* 2. Ana Sayfa Vitrini (Banner Altında: İlk Olarak En İyi Menülerimiz) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-16">
        {/* En İyi Menüler Alanı (Doğrudan Banner Altında) */}
        {newMenusSection.visible !== false && (
          <div>
            <div className="flex items-end justify-between mb-4 sm:mb-6">
              <div>
                <span className="text-[11px] font-bold text-brand-600 uppercase tracking-wider block mb-0.5">
                  {newMenusSection.badgeText || 'Avantajlı Paketler'}
                </span>
                <h3 className="text-xl sm:text-2xl font-extrabold text-stone-900 tracking-tight">
                  {newMenusSection.title || 'En İyi Menülerimiz'}
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
              {bestMenus.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        )}

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
                        <i className="fa-solid fa-plus"></i> Sepete Ekle
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 4. Neden Sandviç Diyarı? (Admin panelinden arka plan ve metinler düzenlenebilir) */}
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
                alt="Sandviç Diyarı Izgara Lezzetleri"
                className="w-full h-full object-cover object-center opacity-45 scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950/95 via-stone-950/75 to-stone-950/85"></div>
            </div>

            {/* Dekoratif Arka Plan Işıltıları */}
            <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-brand-500/15 blur-3xl z-0"></div>
            <div className="pointer-events-none absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-amber-500/15 blur-3xl z-0"></div>

            <div className="relative z-10 text-center max-w-2xl mx-auto mb-10 space-y-2 flex flex-col items-center">
              <span className="text-xs font-bold text-brand-400 uppercase tracking-widest block">
                {(featuresSection.badgeText || 'Kalite Garantisi').replace(/sandwich/gi, 'Sandviç')}
              </span>
              <h3 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight drop-shadow-sm">
                {(featuresSection.title || 'Neden Sandviç Diyarı?').replace(/sandwich/gi, 'Sandviç')}
              </h3>
            </div>

            <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6 md:divide-x md:divide-white/10">
              {(featuresSection.items || []).map((feat, idx) => {
                // Güvenli başlık ve açıklama eşleşmesi (Eski veritabanı / tarayıcı önbelleğini anında günceller)
                let displayTitle = feat.title;
                let displayDesc = feat.desc;

                if (idx === 0) {
                  if (
                    !displayTitle ||
                    displayTitle === '%100 Günlük Malzeme' ||
                    displayTitle === 'Sipariş'
                  ) {
                    displayTitle = 'Tazelik & Doğallık';
                    displayDesc =
                      'Çıtır ekmeklerimiz ve yeşilliklerimiz her sabah yerel taze üreticilerden günlük temin edilir, tazeliği ilk lokmada hissettirir.';
                  }
                } else if (idx === 1) {
                  if (
                    !displayTitle ||
                    displayTitle === 'Hızlı & Sıcak Kurye Servisi' ||
                    displayTitle === 'Hazırlama' ||
                    displayTitle === 'Sıcak Hazırlama'
                  ) {
                    displayTitle = 'Ürünün Hazırlanışı & Lezzeti';
                    displayDesc =
                      'Siparişiniz usta eller tarafından taptaze malzemelerle tavada ve ızgarada anında sıcacık pişirilir, enfes bir lezzete kavuşur.';
                  }
                } else if (idx === 2) {
                  if (
                    !displayTitle ||
                    displayTitle === 'Hijyen & Güven' ||
                    displayTitle === 'Kurye' ||
                    displayTitle === 'Hızlı Kurye'
                  ) {
                    displayTitle = 'Hızlı & Sıcak Kurye';
                    displayDesc =
                      'Özel ısı yalıtımlı çantalarımız ve seri kuryelerimizle siparişiniz hiç soğumadan en kısa sürede kapınıza teslim edilir.';
                  }
                }

                const isBread = idx === 0 || feat.icon?.includes('bread') || feat.icon?.includes('seedling');
                const isPan = !isBread && (idx === 1 || feat.icon?.includes('pan') || feat.icon?.includes('fire'));
                const isCourier = !isBread && !isPan && (idx === 2 || feat.icon?.includes('motorcycle'));
                const isOrder = !isBread && !isPan && !isCourier && (feat.icon?.includes('bell') || feat.title?.toLowerCase().includes('sipariş'));

                return (
                  <div key={feat.id || idx} className="group px-4 sm:px-6 py-2 flex flex-col items-center text-center space-y-3.5">
                    {isBread ? (
                      /* 1. SARI DİLİMLENEN EKMEK İKONU (GÜNLÜK MALZEME) */
                      <div className="sliced-bread-badge w-[74px] h-[74px] sm:w-[82px] sm:h-[82px] shrink-0">
                        <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                          <defs>
                            {/* Görselindeki Sıcak Altın/Sarı Tonlar */}
                            <linearGradient id={`crustGold-${idx}`} x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#FEF08A" />
                              <stop offset="35%" stopColor="#FBBF24" />
                              <stop offset="75%" stopColor="#F59E0B" />
                              <stop offset="100%" stopColor="#B45309" />
                            </linearGradient>
                            <linearGradient id={`crumbWhite-${idx}`} x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#FFFFFF" />
                              <stop offset="50%" stopColor="#FEF9C3" />
                              <stop offset="100%" stopColor="#FDE68A" />
                            </linearGradient>
                            <linearGradient id={`knifeSteel-${idx}`} x1="0%" y1="0%" x2="0%" y2="100%">
                              <stop offset="0%" stopColor="#FFFFFF" />
                              <stop offset="60%" stopColor="#E2E8F0" />
                              <stop offset="100%" stopColor="#94A3B8" />
                            </linearGradient>
                          </defs>

                          {/* Buhar */}
                          <circle className="bread-steam steam-1" cx="44" cy="24" r="3.5" fill="#FEF08A" />
                          <circle className="bread-steam steam-2" cx="58" cy="20" r="3" fill="#FFFFFF" />

                          {/* Kesme Tahtası */}
                          <rect x="8" y="75" width="84" height="6" rx="3" fill="#78350F" stroke="#B45309" strokeWidth="1.2" />

                          {/* Kırıntılar */}
                          <circle className="bread-crumb crumb-1" cx="58" cy="66" r="2" fill="#FBBF24" />
                          <circle className="bread-crumb crumb-2" cx="64" cy="70" r="1.6" fill="#FEF08A" />

                          {/* Ana Ekmek Somunu */}
                          <g>
                            <path d="M 18 75 C 15 54 24 38 42 38 C 52 38 58 46 60 75 Z" fill={`url(#crustGold-${idx})`} stroke="#78350F" strokeWidth="2" />
                            <path d="M 27 46 Q 34 52 36 68" stroke="#78350F" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.8" />
                            <path d="M 37 42 Q 44 48 47 66" stroke="#78350F" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.8" />
                          </g>

                          {/* Dilimlenen ve Yana Yatan Ekmek Dilimi */}
                          <g className="bread-slice">
                            <path d="M 60 75 C 60 48 54 38 68 38 C 81 38 83 54 80 75 Z" fill={`url(#crustGold-${idx})`} stroke="#78350F" strokeWidth="2" />
                            <path d="M 62 73 C 62 50 57 42 68 42 C 77 42 79 55 77 73 Z" fill={`url(#crumbWhite-${idx})`} />
                            <circle cx="68" cy="52" r="1.8" fill="#F59E0B" opacity="0.55" />
                            <circle cx="72" cy="60" r="2.2" fill="#F59E0B" opacity="0.55" />
                          </g>

                          {/* Dilimleyen Bıçak */}
                          <g className="bread-knife">
                            <path d="M 36 46 L 76 33 L 78 40 L 38 53 Z" fill={`url(#knifeSteel-${idx})`} stroke="#64748B" strokeWidth="1.2" />
                            <line x1="36" y1="46" x2="76" y2="33" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" />
                            <path d="M 76 33 L 94 27 C 96 26 98 28 97 30 L 95 36 C 94 38 92 39 90 40 L 78 40 Z" fill={`url(#crustGold-${idx})`} stroke="#78350F" strokeWidth="1.2" />
                            <circle cx="84" cy="33" r="1.2" fill="#18181B" />
                          </g>
                        </svg>
                      </div>
                    ) : isOrder ? (
                      /* 1. SARI SİPARİŞ İKONU */
                      <div className="order-badge-icon w-[74px] h-[74px] sm:w-[82px] sm:h-[82px] shrink-0">
                        <svg viewBox="0 0 120 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                          <defs>
                            <linearGradient id={`orderGold-${idx}`} x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#FEF08A" />
                              <stop offset="35%" stopColor="#FBBF24" />
                              <stop offset="75%" stopColor="#F59E0B" />
                              <stop offset="100%" stopColor="#B45309" />
                            </linearGradient>
                          </defs>

                          {/* Sipariş Işıltıları & Ses Dalgaları */}
                          <path className="order-wave wave-1" d="M 32 32 C 30 24 35 16 44 12" stroke="#FEF08A" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                          <path className="order-wave wave-2" d="M 88 32 C 90 24 85 16 76 12" stroke="#FEF08A" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                          <circle className="order-sparkle spark-1" cx="24" cy="24" r="2.5" fill="#ffffff" />
                          <circle className="order-sparkle spark-2" cx="96" cy="22" r="3" fill="#FEF08A" />

                          {/* Zil Çanı ve Buton (Sallanan Gövde) */}
                          <g className="order-bell-ring">
                            <rect x="57" y="24" width="6" height="8" rx="2" fill="#78350F" />
                            <ellipse cx="60" cy="24" rx="5" ry="3" fill={`url(#orderGold-${idx})`} />
                            <path d="M 28 62 C 28 38 42 30 60 30 C 78 30 92 38 92 62 Z" fill={`url(#orderGold-${idx})`} stroke="#B45309" strokeWidth="1.2" />
                            <path d="M 36 58 C 36 42 46 36 60 36" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity="0.6" fill="none" />
                            <ellipse cx="60" cy="62" rx="34" ry="7" fill={`url(#orderGold-${idx})`} />
                            <ellipse cx="60" cy="63" rx="30" ry="5" fill="#78350F" />
                            <circle cx="60" cy="63" r="3.5" fill="#FEF08A" />
                          </g>

                          {/* Taban Standı */}
                          <g className="order-bell-base">
                            <ellipse cx="60" cy="74" rx="42" ry="9" fill="#18181B" stroke="#27272A" strokeWidth="2" />
                            <ellipse cx="60" cy="72" rx="38" ry="7" fill="#27272A" />
                            <ellipse cx="60" cy="70" rx="24" ry="4" fill={`url(#orderGold-${idx})`} opacity="0.9" />
                          </g>

                          {/* Sipariş Onay Rozeti (Zıplayan) */}
                          <g className="order-badge-pop">
                            <circle cx="86" cy="38" r="11" fill="#10B981" stroke="#ffffff" strokeWidth="2" />
                            <path d="M 81 38 L 84 41 L 91 34" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                          </g>
                        </svg>
                      </div>
                    ) : isPan ? (
                      /* 2. SARI PİŞİRME TAVASI İKONU */
                      <div className="pan-badge-icon w-[74px] h-[74px] sm:w-[82px] sm:h-[82px] shrink-0">
                        <svg viewBox="0 0 120 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                          <defs>
                            <linearGradient id={`panGoldGrad-${idx}`} x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#FEF08A" />
                              <stop offset="35%" stopColor="#FBBF24" />
                              <stop offset="75%" stopColor="#F59E0B" />
                              <stop offset="100%" stopColor="#B45309" />
                            </linearGradient>
                          </defs>

                          {/* Buharlar */}
                          <circle className="steam-dot steam-1" cx="68" cy="34" r="3" fill="#FEF08A" />
                          <circle className="steam-dot steam-2" cx="84" cy="30" r="2.5" fill="#ffffff" />

                          {/* Havaya Zıplayan Lezzet */}
                          <g className="pan-food-flip">
                            <ellipse cx="77" cy="50" rx="14" ry="7.5" fill="#18181B" />
                            <ellipse cx="77" cy="50" rx="11" ry="5.5" fill="#F59E0B" />
                            <circle cx="77" cy="49" r="3.2" fill="#FEF08A" />
                          </g>

                          {/* Sote Yapan Tava */}
                          <g className="pan-cook-shake">
                            <path d="M 43 56 C 40 54 36 55 35 57 C 36 61 40 63 43 62 Z" fill="#78350F" />
                            <path d="M 37 57 C 26 59 16 63 8 66 C 4 67.5 3 71.5 6 73.5 C 8.5 75 13 74 17 72 C 26 68 34 65 41 63 Z" fill={`url(#panGoldGrad-${idx})`} />
                            <ellipse cx="9" cy="70" rx="2.5" ry="1.8" fill="#0b0d11" />

                            <path d="M 44 54 C 44 69 59 81 77 81 C 95 81 110 69 110 54 L 110 60 C 110 75 95 87 77 87 C 59 87 44 75 44 60 Z" fill="#92400E" />

                            <ellipse cx="77" cy="54" rx="33" ry="15" fill={`url(#panGoldGrad-${idx})`} />
                            <ellipse cx="77" cy="53" rx="28" ry="11.5" fill="#18181B" />
                            <ellipse cx="77" cy="54" rx="23" ry="8" fill="#27272A" />
                          </g>
                        </svg>
                      </div>
                    ) : isCourier ? (
                      /* 3. SARI KURYE TESLİMAT İKONU */
                      <div className="courier-badge-icon w-[74px] h-[74px] sm:w-[82px] sm:h-[82px] shrink-0">
                        <svg viewBox="0 0 120 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                          <defs>
                            <linearGradient id={`courierGold-${idx}`} x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#FEF08A" />
                              <stop offset="35%" stopColor="#FBBF24" />
                              <stop offset="75%" stopColor="#F59E0B" />
                              <stop offset="100%" stopColor="#B45309" />
                            </linearGradient>
                          </defs>

                          {/* Hız Çizgileri & Egzoz Dumanı */}
                          <circle className="exhaust-puff puff-1" cx="19" cy="70" r="3.2" fill="#FEF08A" />
                          <path className="speed-line speed-1" d="M 6 38 L 22 38" stroke="#FEF08A" strokeWidth="2.5" strokeLinecap="round" />
                          <path className="speed-line speed-2" d="M 2 50 L 16 50" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />

                          {/* Arka Tekerlek */}
                          <g className="wheel-spin wheel-back">
                            <circle cx="34" cy="72" r="12" fill="#18181B" stroke="#27272A" strokeWidth="2" />
                            <circle cx="34" cy="72" r="5" fill={`url(#courierGold-${idx})`} />
                            <line x1="34" y1="62" x2="34" y2="82" stroke="#0b0d11" strokeWidth="1.3" />
                            <line x1="24" y1="72" x2="44" y2="72" stroke="#0b0d11" strokeWidth="1.3" />
                          </g>

                          {/* Ön Tekerlek */}
                          <g className="wheel-spin wheel-front">
                            <circle cx="86" cy="72" r="12" fill="#18181B" stroke="#27272A" strokeWidth="2" />
                            <circle cx="86" cy="72" r="5" fill={`url(#courierGold-${idx})`} />
                            <line x1="86" y1="62" x2="86" y2="82" stroke="#0b0d11" strokeWidth="1.3" />
                            <line x1="76" y1="72" x2="96" y2="72" stroke="#0b0d11" strokeWidth="1.3" />
                          </g>

                          {/* Yaylanan Kurye Gövdesi */}
                          <g className="scooter-ride">
                            {/* Şasi & Kaporta */}
                            <path d="M 34 68 L 52 68 L 65 58 L 78 58 L 86 38 L 80 38 L 72 54 L 56 56 L 46 64 Z" fill={`url(#courierGold-${idx})`} />
                            <path d="M 76 54 L 88 38 L 82 30 L 74 30 L 72 42 Z" fill={`url(#courierGold-${idx})`} />
                            <ellipse cx="88" cy="36" rx="3.5" ry="4.5" fill="#ffffff" />

                            {/* Gidon & Koltuk */}
                            <path d="M 75 30 L 68 24" stroke="#18181B" strokeWidth="3" strokeLinecap="round" />
                            <circle cx="67" cy="23" r="2.2" fill="#F59E0B" />
                            <path d="M 44 56 C 44 50 60 50 63 56 Z" fill="#18181B" />

                            {/* Sarı Teslimat Çantası */}
                            <g className="box-bounce">
                              <rect x="22" y="34" width="22" height="22" rx="4" fill={`url(#courierGold-${idx})`} stroke="#B45309" strokeWidth="1.2" />
                              <rect x="22" y="43" width="22" height="4" fill="#78350F" opacity="0.7" />
                              <circle cx="33" cy="45" r="2.5" fill="#FEF08A" />
                            </g>
                          </g>
                        </svg>
                      </div>
                    ) : (
                      <i className={`${feat.icon || 'fa-solid fa-seedling'} text-4xl text-brand-400 drop-shadow`}></i>
                    )}
                    <h4 className="font-extrabold text-lg sm:text-xl text-white tracking-tight">
                      {displayTitle}
                    </h4>
                    <p className="text-stone-300 text-xs sm:text-sm leading-relaxed max-w-xs">
                      {displayDesc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 5. Müşteri Yorumları Vitrini (Özel Işıltılı & Sıcak Dokulu Başlık Alanı) */}
        {reviewsSection.visible !== false && (
          <div className="py-2">
            <div className="rounded-3xl p-6 sm:p-10 lg:p-12 border border-stone-200/90 bg-gradient-to-b from-amber-50/60 via-stone-50/30 to-white shadow-xs relative overflow-hidden">
              {/* Arka Plan 1: Üst Sıcak Işık Vurgusu (Spotlight Ambient Glow) */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-72 bg-gradient-to-b from-amber-300/25 via-orange-200/15 to-transparent rounded-full blur-3xl pointer-events-none z-0"></div>

              {/* Arka Plan 2: Modern Geometrik Nokta Izgarası (Garantili Inline Style Texture) */}
              <div
                className="absolute inset-x-0 top-0 h-72 opacity-35 pointer-events-none z-0"
                style={{
                  backgroundImage: 'radial-gradient(#f59e0b 1.2px, transparent 1.2px)',
                  backgroundSize: '22px 22px',
                  maskImage: 'radial-gradient(ellipse 70% 60% at 50% 30%, black 40%, transparent 100%)',
                  WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 30%, black 40%, transparent 100%)'
                }}
              ></div>

              {/* Arka Plan 3: Sol ve Sağ Büyük Filigran Tırnak İkonları */}
              <div className="absolute top-6 left-4 sm:left-10 text-amber-500/15 pointer-events-none select-none z-0 -rotate-6">
                <i className="fa-solid fa-quote-left text-6xl sm:text-8xl"></i>
              </div>
              <div className="absolute top-6 right-4 sm:right-10 text-orange-500/15 pointer-events-none select-none z-0 rotate-6">
                <i className="fa-solid fa-quote-right text-6xl sm:text-8xl"></i>
              </div>

              {/* Başlık & Güven Rozeti */}
              <div className="text-center max-w-2xl mx-auto mb-10 space-y-3 relative z-10">
                {/* Sol & Sağ Küçük Uçuşan Güven Rozetleri (Desktop) */}
                <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-white/95 backdrop-blur-xs border border-amber-200/80 rounded-full shadow-xs text-[11px] font-bold text-stone-700 absolute -left-20 top-2 -rotate-3 hover:rotate-0 transition-transform pointer-events-none">
                  <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-[10px]">
                    <i className="fa-solid fa-heart"></i>
                  </span>
                  <span>%98 Tavsiye Edilme</span>
                </div>

                <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-white/95 backdrop-blur-xs border border-amber-200/80 rounded-full shadow-xs text-[11px] font-bold text-stone-700 absolute -right-20 top-2 rotate-3 hover:rotate-0 transition-transform pointer-events-none">
                  <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-[10px]">
                    <i className="fa-solid fa-fire-flame-curved"></i>
                  </span>
                  <span>Sıcak & Hızlı Servis</span>
                </div>

                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/95 backdrop-blur-xs text-amber-950 border border-amber-300/90 text-xs font-bold shadow-xs">
                  <span className="flex text-amber-500 text-xs gap-0.5">
                    <i className="fa-solid fa-star"></i>
                    <i className="fa-solid fa-star"></i>
                    <i className="fa-solid fa-star"></i>
                    <i className="fa-solid fa-star"></i>
                    <i className="fa-solid fa-star"></i>
                  </span>
                  <span>4.9 / 5.0 Memnuniyet</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  <span className="text-stone-600 font-semibold">Doğrulanmış Siparişler</span>
                </div>

                <h3 className="text-2xl sm:text-4xl font-black text-stone-900 tracking-tight text-center">
                  {reviewsSection.title || 'Lezzet Severler Ne Diyor?'}
                </h3>
                <p className="text-stone-500 text-xs sm:text-sm leading-relaxed max-w-lg mx-auto font-medium">
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
