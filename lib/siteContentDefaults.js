// Müşteri Vitrin Sayfası Varsayılan İçerik ve Tasarım Şablonu (Client & Server Uyumlu)
export const DEFAULT_SITE_CONTENT = {
  hero: {
    visible: true,
    image: '/images/hero_sandwich_banner.jpg',
    badgeVisible: true,
    badgeText: "Torbalı / İzmir • Gece 03:00'e Kadar Paket Servis!",
    googleRatingVisible: true,
    googleRatingScore: '4.9 / 5.0',
    googleRatingCount: '(2,400+ Yorum)',
    googleRatingUrl: 'https://www.google.com/search?q=Sandvi%C3%A7+Diyar%C4%B1+Torbal%C4%B1',
    titlePrimary: 'Acıktın mı?',
    titleSecondary: "Sandviç Diyarı Torbalı'da!",
    description: 'Özel ekmeklerle hazırlanan Maxi Karışık, Çeşme Kumru, Kasap Köfte ve avantajlı menülerle ev ve işyerlerine sıcak paket servis.',
    btnMenuVisible: true,
    btnMenuText: 'Menüyü Keşfet',
    btnPhoneVisible: true,
    btnPhoneText: '0552 104 55 35',
    btnPhoneTel: '05521045535'
  },
  campaignsSection: {
    visible: true,
    badgeText: 'Özel Fırsat Kataloğu',
    title: 'Günün Kampanyalı Ürünleri',
    btnAllVisible: true,
    btnAllText: 'Tümünü Gör'
  },
  newMenusSection: {
    visible: true,
    badgeText: 'Avantajlı Paketler',
    title: 'En İyi Menülerimiz',
    itemCount: 3,
    btnAllVisible: true,
    btnAllText: 'Tümünü Gör'
  },
  featuresSection: {
    visible: true,
    badgeText: 'Kalite Garantisi',
    title: 'Neden Sandwich Diyarı?',
    bgImage: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&q=85&w=1800',
    items: [
      {
        id: 'f1',
        icon: 'fa-solid fa-bread-slice',
        title: '%100 Günlük Malzeme',
        desc: 'Sebzelerimiz ve çıtır ekmeklerimiz her sabah yerel taze üreticilerden günlük olarak temin edilir.'
      },
      {
        id: 'f2',
        icon: 'fa-solid fa-fire-burner',
        title: 'Sıcak Hazırlama',
        desc: 'Siparişiniz usta eller tarafından taptaze malzemelerle ızgara ve tavada anında sıcacık pişirilir.'
      },
      {
        id: 'f3',
        icon: 'fa-solid fa-motorcycle',
        title: 'Hızlı Kurye',
        desc: 'Özel ısı yalıtımlı çantalarımız ve hızlı kuryelerimizle siparişiniz hiç beklemeden kapınıza ulaşır.'
      }
    ]
  },
  reviewsSection: {
    visible: true,
    title: 'Lezzet Severler Ne Diyor?',
    subtitle: "Torbalı'da her gün yüzlerce sıcak siparişi lezzet tutkunlarıyla buluşturuyoruz."
  },
  contactBar: {
    visible: true,
    phone1: '0552 104 55 35',
    phone2: '0232 856 81 21',
    address: 'Torbalı Mah. Hüseyin Kurtuldu Sok. No:32 Torbalı/İZMİR',
    workingHours: 'Hergün 10:00 - 03:00 Gece Servisi'
  }
};

