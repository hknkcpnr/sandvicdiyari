export const initialProducts = [
  // ==========================================
  // 1. AVANTAJLI MENÜLER
  // ==========================================
  {
    id: 1,
    name: "1 Kişilik Maxi Karışık Menü",
    category: "menu",
    price: 450.00,
    stock: 30,
    isAvailable: true,
    trackStock: true,
    criticalThreshold: 5,
    description: "1 Adet Maxi Karışık Sandviç + Çıtır Patates Kızartması + Soğuk Kutu İçecek (Cola veya Ayran).",
    image: "/images/hero_banner.jpg",
    badge: "En Çok Satan"
  },
  {
    id: 2,
    name: "2 Kişilik Maxi Karışık Menü",
    category: "menu",
    price: 720.00,
    stock: 25,
    isAvailable: true,
    trackStock: true,
    criticalThreshold: 5,
    description: "2 Adet Maxi Karışık Sandviç + Büyük Boy Çıtır Patates Kızartması + 1 Litre Soğuk İçecek.",
    image: "/images/kasap_sucuk_ekmek.jpg",
    badge: "İkili Fırsat"
  },
  {
    id: 3,
    name: "3 Kişilik Maxi Karışık Menü",
    category: "menu",
    price: 970.00,
    stock: 20,
    isAvailable: true,
    trackStock: true,
    criticalThreshold: 4,
    description: "3 Adet Maxi Karışık Sandviç + 1.5 Porsiyon Çıtır Patates Kızartması + 1 Litre Soğuk İçecek.",
    image: "/images/kasap_kofte_ekmek.jpg",
    badge: "3'lü Menü"
  },
  {
    id: 4,
    name: "4 Kişilik Aile & Arkadaş Menüsü",
    category: "menu",
    price: 1420.00,
    stock: 15,
    isAvailable: true,
    trackStock: true,
    criticalThreshold: 3,
    description: "4 Adet Maxi Karışık Sandviç + Duble Porsiyon Çıtır Patates Kızartması + 2.5 Litre Soğuk İçecek.",
    image: "/images/hero_banner.jpg",
    badge: "Dev Paket"
  },
  {
    id: 5,
    name: "Hamburger Menüsü (Seçmeli)",
    category: "menu",
    price: 430.00,
    stock: 30,
    isAvailable: true,
    trackStock: true,
    criticalThreshold: 5,
    description: "Seçeceğiniz Hamburger, Salamlı, Sucuklu veya Sosisli Sandviç + Patates Kızartması + Kutu İçecek.",
    image: "/images/cheeseburger.jpg",
    badge: "Klasik Menü"
  },

  // ==========================================
  // 2. SANDVİÇLER, BURGERLER & TOSTLAR
  // ==========================================
  {
    id: 6,
    name: "Maxi Karışık",
    category: "sandwich",
    price: 230.00,
    stock: 35,
    isAvailable: true,
    trackStock: true,
    criticalThreshold: 5,
    description: "Sosis, salam, sucuk, eritilmiş kaşar, ketçap, mayonez, kornişon turşu.",
    image: "/images/hero_banner.jpg",
    badge: "Spesiyal"
  },
  {
    id: 7,
    name: "Full Karışık",
    category: "sandwich",
    price: 220.00,
    stock: 30,
    isAvailable: true,
    trackStock: true,
    criticalThreshold: 5,
    description: "Sosis, salam, sucuk, kaşar, ketçap, mayonez, turşu.",
    image: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&q=80&w=800",
    badge: "Favori"
  },
  {
    id: 8,
    name: "Çeşme Kumru",
    category: "sandwich",
    price: 260.00,
    stock: 25,
    isAvailable: true,
    trackStock: true,
    criticalThreshold: 4,
    description: "Özel susamlı kumru ekmeğinde ızgara sucuk, salam, taze domates, eritilmiş kaşar, ketçap, mayonez, turşu.",
    image: "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=800",
    badge: "İzmir Usulü"
  },
  {
    id: 9,
    name: "Sucuk Kaşar Sandviç",
    category: "sandwich",
    price: 230.00,
    stock: 25,
    isAvailable: true,
    trackStock: true,
    criticalThreshold: 5,
    description: "Kızarmış Kangal sucuk dilimleri, bol eritilmiş kaşar peyniri, ketçap, mayonez, turşu.",
    image: "/images/kasap_sucuk_ekmek.jpg",
    badge: "Klasik"
  },
  {
    id: 10,
    name: "Sucuk Ekmek",
    category: "sandwich",
    price: 220.00,
    stock: 25,
    isAvailable: true,
    trackStock: true,
    criticalThreshold: 5,
    description: "Izgara sucuk dilimleri, domates dilimleri, ketçap, mayonez, kornişon turşu.",
    image: "/images/kasap_sucuk_ekmek.jpg"
  },
  {
    id: 11,
    name: "Sucuklu Sandviç",
    category: "sandwich",
    price: 210.00,
    stock: 25,
    isAvailable: true,
    trackStock: true,
    criticalThreshold: 5,
    description: "Kızarmış sucuk dilimleri, ketçap, mayonez, kornişon turşu.",
    image: "/images/kasap_sucuk_ekmek.jpg"
  },
  {
    id: 12,
    name: "Sosisli Sandviç",
    category: "sandwich",
    price: 210.00,
    stock: 30,
    isAvailable: true,
    trackStock: true,
    criticalThreshold: 5,
    description: "Özel soslu kızarmış dana sosis dilimleri, ketçap, mayonez, kornişon turşu.",
    image: "https://images.unsplash.com/photo-1619740455993-9e612b1af08a?auto=format&fit=crop&q=80&w=800"
  },
  {
    id: 13,
    name: "Salamlı Sandviç",
    category: "sandwich",
    price: 210.00,
    stock: 25,
    isAvailable: true,
    trackStock: true,
    criticalThreshold: 5,
    description: "Kızarmış lezzetli salam dilimleri, ketçap, mayonez, kornişon turşu.",
    image: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&q=80&w=800"
  },
  {
    id: 14,
    name: "Kaşarlı Sandviç",
    category: "sandwich",
    price: 210.00,
    stock: 25,
    isAvailable: true,
    trackStock: true,
    criticalThreshold: 5,
    description: "Bol eritilmiş taze kaşar peyniri, domates dilimleri, ketçap, mayonez, turşu.",
    image: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&q=80&w=800"
  },
  {
    id: 15,
    name: "Maxi Cheeseburger",
    category: "sandwich",
    price: 230.00,
    stock: 25,
    isAvailable: true,
    trackStock: true,
    criticalThreshold: 4,
    description: "Çift burger köftesi, eritilmiş kaşar, domates, taze marul, ketçap, mayonez, turşu.",
    image: "/images/cheeseburger.jpg",
    badge: "Çift Köfte"
  },
  {
    id: 16,
    name: "Cheeseburger",
    category: "sandwich",
    price: 220.00,
    stock: 25,
    isAvailable: true,
    trackStock: true,
    criticalThreshold: 4,
    description: "150g sulu burger köftesi, eritilmiş kaşar peyniri, domates, marul, ketçap, mayonez, turşu.",
    image: "/images/cheeseburger.jpg"
  },
  {
    id: 17,
    name: "Maxi Burger",
    category: "sandwich",
    price: 220.00,
    stock: 25,
    isAvailable: true,
    trackStock: true,
    criticalThreshold: 4,
    description: "Çift burger köftesi, domates, çıtır marul, ketçap, mayonez, kornişon turşu.",
    image: "/images/cheeseburger.jpg",
    badge: "Duble Köfte"
  },
  {
    id: 18,
    name: "Klasik Hamburger",
    category: "sandwich",
    price: 210.00,
    stock: 30,
    isAvailable: true,
    trackStock: true,
    criticalThreshold: 5,
    description: "Özel burger köftesi, taze domates dilimleri, marul, ketçap, mayonez, turşu.",
    image: "/images/cheeseburger.jpg"
  },
  {
    id: 19,
    name: "Ayvalık Tostu",
    category: "sandwich",
    price: 230.00,
    stock: 25,
    isAvailable: true,
    trackStock: true,
    criticalThreshold: 5,
    description: "Özel Ayvalık ekmeğinde salam, sucuk, kaşar peyniri, ketçap, mayonez, kornişon turşu.",
    image: "/images/ayvalik_tostu.jpg",
    badge: "Geleneksel"
  },
  {
    id: 20,
    name: "Full Ayvalık Tostu",
    category: "sandwich",
    price: 270.00,
    stock: 20,
    isAvailable: true,
    trackStock: true,
    criticalThreshold: 4,
    description: "Ayvalık ekmeğinde sosis, salam, sucuk, bol eritilmiş kaşar, ketçap, mayonez ve turşu ziyafeti.",
    image: "/images/ayvalik_tostu.jpg",
    badge: "Dopdolu"
  },
  {
    id: 21,
    name: "Nugget Burger",
    category: "sandwich",
    price: 200.00,
    stock: 25,
    isAvailable: true,
    trackStock: true,
    criticalThreshold: 5,
    description: "5 Adet çıtır altın tavuk nugget, taze marul, domates, ketçap, mayonez, turşu (Kaşarlı seçeneği mevcuttur).",
    image: "/images/crispy_chicken_menu.jpg"
  },
  {
    id: 22,
    name: "Patates Ekmek",
    category: "sandwich",
    price: 200.00,
    stock: 30,
    isAvailable: true,
    trackStock: true,
    criticalThreshold: 5,
    description: "Taze somun ekmek arasında bol çıtır patates kızartması, ketçap, mayonez, turşu (Kaşarlı seçeneği mevcuttur).",
    image: "/images/loaded_cheddar_fries.jpg"
  },
  {
    id: 23,
    name: "Yarım Ekmek Kasap Köfte",
    category: "sandwich",
    price: 310.00,
    stock: 20,
    isAvailable: true,
    trackStock: true,
    criticalThreshold: 4,
    description: "Yarım ekmekte 6 adet özel kasap köfte, yeşillik, domates, turşu, ketçap, mayonez, soslar, karamelize soğan (Kaşarlı: ₺330).",
    image: "/images/kasap_kofte_ekmek.jpg",
    badge: "Kasap Spesiyali"
  },
  {
    id: 24,
    name: "3 Parça Kasap Köfte",
    category: "sandwich",
    price: 370.00,
    stock: 15,
    isAvailable: true,
    trackStock: true,
    criticalThreshold: 3,
    description: "3 parça ekmekte 8 adet özel kasap köfte, yeşillik, domates, turşu, soslar, karamelize soğan (Kaşarlı: ₺400).",
    image: "/images/kasap_kofte_ekmek.jpg",
    badge: "Büyük Boy"
  },
  {
    id: 25,
    name: "Megzi Dürüm",
    category: "sandwich",
    price: 280.00,
    stock: 20,
    isAvailable: true,
    trackStock: true,
    criticalThreshold: 4,
    description: "Özel lavaş dürümde sosis, salam, sucuk, eritilmiş kaşar, çıtır patates, turşu, ketçap, mayonez.",
    image: "/images/megzi_durum.jpg",
    badge: "Özel Dürüm"
  },
  {
    id: 26,
    name: "Zurna Megzi (Çift Lavaş)",
    category: "sandwich",
    price: 330.00,
    stock: 18,
    isAvailable: true,
    trackStock: true,
    criticalThreshold: 3,
    description: "Çift lavaş zurna dürümde bol sosis, salam, sucuk, kaşar, patates kızartması, turşu, ketçap, mayonez.",
    image: "/images/megzi_durum.jpg",
    badge: "Dev Zurna"
  },
  {
    id: 27,
    name: "Kasap Sucuğu Sandviç",
    category: "sandwich",
    price: 310.00,
    stock: 20,
    isAvailable: true,
    trackStock: true,
    criticalThreshold: 4,
    description: "Özel kasap sucuğu, kaşar, ketçap, mayonez, domates, turşu, salça sosu, marul (Kaşarlı: ₺330).",
    image: "/images/kasap_sucuk_ekmek.jpg",
    badge: "Hakiki Kasap"
  },
  {
    id: 28,
    name: "Kasap Sucuğu 3 Parça",
    category: "sandwich",
    price: 370.00,
    stock: 15,
    isAvailable: true,
    trackStock: true,
    criticalThreshold: 3,
    description: "3 parça ekmekte bol kasap sucuğu, eritilmiş kaşar, ketçap, mayonez, domates, turşu, salça, marul (Kaşarlı: ₺400).",
    image: "/images/kasap_sucuk_ekmek.jpg",
    badge: "Doyurucu"
  },

  // ==========================================
  // 3. ATIŞTIRMALIKLAR & YAN LEZZETLER
  // ==========================================
  {
    id: 29,
    name: "Mix Karışık Kova",
    category: "snack",
    price: 260.00,
    stock: 25,
    isAvailable: true,
    trackStock: true,
    criticalThreshold: 5,
    description: "5 Adet çıtır nugget, 5 adet altın soğan halkası ve bol baharatlı patates kızartması.",
    image: "https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?auto=format&fit=crop&q=80&w=800",
    badge: "Karışık Kova"
  },
  {
    id: 30,
    name: "Porsiyon Patates Kızartması",
    category: "snack",
    price: 180.00,
    stock: 40,
    isAvailable: true,
    trackStock: true,
    criticalThreshold: 6,
    description: "Taptaze, altın sarısı çıtır çıtır özel baharatlı patates kızartması tabağı.",
    image: "/images/loaded_cheddar_fries.jpg"
  },
  {
    id: 31,
    name: "8'li Çıtır Nugget",
    category: "snack",
    price: 180.00,
    stock: 25,
    isAvailable: true,
    trackStock: true,
    criticalThreshold: 4,
    description: "8 Adet dışı altın sarısı çıtır kaplamalı tavuk nugget ve daldırma sosları.",
    image: "https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&q=80&w=800"
  },
  {
    id: 32,
    name: "8'li Soğan Halkası",
    category: "snack",
    price: 180.00,
    stock: 25,
    isAvailable: true,
    trackStock: true,
    criticalThreshold: 4,
    description: "8 Adet çıtır tempura hamurlu kızartılmış altın soğan halkası.",
    image: "https://images.unsplash.com/photo-1639024471283-03518883512d?auto=format&fit=crop&q=80&w=800"
  },

  // ==========================================
  // 4. İÇECEKLER
  // ==========================================
  {
    id: 33,
    name: "Kutu Soğuk İçecekler (330ml)",
    category: "drink",
    price: 60.00,
    stock: 50,
    isAvailable: true,
    trackStock: true,
    criticalThreshold: 10,
    description: "Pepsi, Pepsi Max, Yedigün, 7Up, Fruko (330ml kutu).",
    image: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=800"
  },
  {
    id: 34,
    name: "1 Litre Pepsi",
    category: "drink",
    price: 100.00,
    stock: 30,
    isAvailable: true,
    trackStock: true,
    criticalThreshold: 6,
    description: "1 Litre soğuk şişe Pepsi.",
    image: "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format&fit=crop&q=80&w=800"
  },
  {
    id: 35,
    name: "2.5 Litre Pepsi",
    category: "drink",
    price: 140.00,
    stock: 20,
    isAvailable: true,
    trackStock: true,
    criticalThreshold: 5,
    description: "2.5 Litre dev boy soğuk şişe Pepsi.",
    image: "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format&fit=crop&q=80&w=800"
  },
  {
    id: 36,
    name: "Büyük Ayran (300ml)",
    category: "drink",
    price: 40.00,
    stock: 40,
    isAvailable: true,
    trackStock: true,
    criticalThreshold: 8,
    description: "Geleneksel soğuk, köpüklü taze ayran (300ml).",
    image: "https://images.unsplash.com/photo-1571212515416-fef01fc43637?auto=format&fit=crop&q=80&w=800"
  },
  {
    id: 37,
    name: "Küçük Ayran (200ml)",
    category: "drink",
    price: 35.00,
    stock: 40,
    isAvailable: true,
    trackStock: true,
    criticalThreshold: 8,
    description: "Serinletici taze ayran (200ml).",
    image: "https://images.unsplash.com/photo-1571212515416-fef01fc43637?auto=format&fit=crop&q=80&w=800"
  },
  {
    id: 38,
    name: "Meyveli Soda",
    category: "drink",
    price: 40.00,
    stock: 35,
    isAvailable: true,
    trackStock: true,
    criticalThreshold: 6,
    description: "Elmalı, limonlu veya çilekli ferahlatıcı meyveli maden suyu.",
    image: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&q=80&w=800"
  },
  {
    id: 39,
    name: "Sade Soda",
    category: "drink",
    price: 35.00,
    stock: 35,
    isAvailable: true,
    trackStock: true,
    criticalThreshold: 6,
    description: "Doğal zengin mineralli sade maden suyu (200ml).",
    image: "https://images.unsplash.com/photo-1543362906-acfc16c67564?auto=format&fit=crop&q=80&w=800"
  },
  {
    id: 40,
    name: "Şalgam Suyu",
    category: "drink",
    price: 50.00,
    stock: 25,
    isAvailable: true,
    trackStock: true,
    criticalThreshold: 5,
    description: "Geleneksel lezzet, soğuk acılı veya acısız şalgam (330ml).",
    image: "https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&q=80&w=800"
  },
  {
    id: 41,
    name: "Su (500ml)",
    category: "drink",
    price: 15.00,
    stock: 100,
    isAvailable: true,
    trackStock: true,
    criticalThreshold: 15,
    description: "Doğal kaynak suyu (0.5 Litre pet şişe).",
    image: "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&q=80&w=800"
  }
];

export const heroSlides = [
  {
    image: "/images/hero_banner.jpg",
    title: "Maxi Karışık Efsanesi"
  },
  {
    image: "/images/ayvalik_tostu.jpg",
    title: "Çeşme Kumru & Ayvalık Tostu"
  },
  {
    image: "/images/kasap_kofte_ekmek.jpg",
    title: "Özel Kasap Köfte & Kasap Sucuğu"
  }
];

export const campaignProducts = [
  {
    id: "camp-1",
    name: "1 Kişilik Maxi Karışık Menü",
    title: "1 Kişilik Maxi Karışık Menü (Sandviç + Patates + İçecek)",
    badge: "Tek Kişilik Ziyafet",
    category: "menu",
    price: 450.00,
    oldPrice: 490.00,
    description: "1 Adet bol malzemeli Maxi Karışık Sandviç, 1 Porsiyon Çıtır Patates Kızartması ve Soğuk Kutu İçecek (Cola veya Ayran).",
    image: "/images/hero_banner.jpg"
  },
  {
    id: "camp-2",
    name: "2 Kişilik Maxi Karışık Menü",
    title: "2 Kişilik Maxi Karışık Menü (2'li Sandviç + Büyük Patates + 1L İçecek)",
    badge: "En Popüler Menü",
    category: "menu",
    price: 720.00,
    oldPrice: 780.00,
    description: "2 Adet Maxi Karışık Sandviç, Büyük Boy Çıtır Patates Kızartması ve 1 Litre Soğuk İçecek.",
    image: "https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&q=80&w=800"
  },
  {
    id: "camp-3",
    name: "Hamburger Menüsü",
    title: "Hamburger & Sandviç Menüsü (Sandviç + Patates + Kutu İçecek)",
    badge: "Klasik Menü",
    category: "menu",
    price: 430.00,
    oldPrice: 470.00,
    description: "Salamlı, Sucuklu, Sosisli veya Hamburger Çeşitlerinden Biri + Patates Kızartması + Kutu İçecek.",
    image: "/images/cheeseburger.jpg"
  },
  {
    id: "camp-4",
    name: "4 Kişilik Aile & Arkadaş Menüsü",
    title: "4 Kişilik Maxi Karışık Menü (4 Sandviç + Duble Patates + 2.5L İçecek)",
    badge: "Dev Aile Paketi",
    category: "menu",
    price: 1420.00,
    oldPrice: 1550.00,
    description: "4 Adet Maxi Karışık Sandviç, Duble Porsiyon Patates Kızartması ve 2.5 Litre Soğuk İçecek.",
    image: "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=800"
  }
];

export const initialReviews = [
  {
    id: 1,
    name: "Murat Yılmaz",
    location: "Torbalı, İzmir",
    rating: 5,
    initials: "MY",
    isApproved: false,
    comment: "Torbalı'da yediğim en iyi Maxi Karışık sandviç! Gece saat 02:00'de sipariş verdik, sıcacık ve çıtır çıtır geldi. Ellerinize sağlık."
  },
  {
    id: 2,
    name: "Gizem Demir",
    location: "Ayrancılar, Torbalı",
    rating: 5,
    initials: "GD",
    isApproved: true,
    comment: "Çeşme kumrusu ve kasap köftesi efsane lezzetli. Malzemeler çok taze ve bol. Alo paketi aradığımızda da kurye çok nazikti."
  },
  {
    id: 3,
    name: "Barış Özkan",
    location: "Tepeköy, İzmir",
    rating: 5,
    initials: "BÖ",
    isApproved: true,
    comment: "2 Kişilik Maxi menüyü söyledik, patatesi ve sandviçleri inanılmaz doyurucu. Torbalı'nın 1 numaralı sandviç adresi!"
  }
];

export const initialUsers = [
  {
    id: 'u_admin',
    name: 'Admin Üye',
    email: 'admin@sandwichdiyari.com',
    username: 'admin',
    phone: '0555 555 55 55',
    address: 'İzmir, Torbalı',
    pass: 'admin',
    orders: [],
    createdAt: '2026-11-02T13:00:00.000Z'
  }
];

export const initialIngredients = [
  { id: "ing-1", name: "Maxi Sandviç Ekmeği", category: "Ekmek", unit: "Adet", stock: 120, minThreshold: 20 },
  { id: "ing-2", name: "Çeşme Kumru Ekmeği", category: "Ekmek", unit: "Adet", stock: 85, minThreshold: 15 },
  { id: "ing-3", name: "Kasap Sucuk", category: "Şarküteri", unit: "Porsiyon", stock: 90, minThreshold: 15 },
  { id: "ing-4", name: "Macar Salam & Sosis", category: "Şarküteri", unit: "Porsiyon", stock: 95, minThreshold: 15 },
  { id: "ing-5", name: "Taze Kaşar Peyniri", category: "Peynir", unit: "Porsiyon", stock: 110, minThreshold: 20 },
  { id: "ing-6", name: "Özel Soslu Tavuk Göğsü", category: "Et & Tavuk", unit: "Porsiyon", stock: 60, minThreshold: 10 },
  { id: "ing-7", name: "Dana Kasap Köfte", category: "Et & Tavuk", unit: "Porsiyon", stock: 55, minThreshold: 10 },
  { id: "ing-8", name: "Parmak Patates Kızartması", category: "Yan Ürün", unit: "Porsiyon", stock: 100, minThreshold: 20 }
];

