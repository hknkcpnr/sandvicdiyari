# 🥪 Sandviç Diyarı - Gurme Lezzetler & Online Sipariş Platformu

İzmir Torbalı'da gece 03:00'e kadar sıcak paket servis sunan, özel ekmekli sandviçler, kasap köfteler, burgerler ve tatlılar için geliştirilmiş yeni nesil restoran yönetim ve sipariş platformu.

---

## 🚀 Temel Özellikler

- **Müşteri Sipariş Arayüzü:** Canlı sepet, ürün seçenekleri/malzeme çıkarma-ekleme, kapıda nakit/POS veya online ödeme.
- **Canlı Sipariş Takibi:** Sipariş onaylandı, mutfakta hazırlanıyor, kurye yolda ve teslim edildi aşamalarını gerçek zamanlı takip.
- **Kurye Portalı (`/kurye`):** Motosikletli kuryelere özel dokunmatik arayüz, tek tıkla navigasyon ve telefonla müşteri arama, teslimat onayı.
- **Yönetici Paneli (`/admin`):**
  - Mutfak sipariş yönetim paneli (sesli zil bildirimi ve görsel durum takibi).
  - Hammadde stok ve reçete takibi (porsiyon bazlı otomatik stok düşümü).
  - Canlı ciro, Z-Raporu ve satış istatistikleri.
  - Rol bazlı yetkilendirme (Süper Yönetici, Mutfak Şefi, Kasiyer).
  - Site içerik ve görsel yönetim editörü.
- **Çift Katmanlı Veritabanı:** PostgreSQL 18 + Prisma ORM ve kesintisiz yerel JSON fallback mimarisi.
- **Yüksek Güvenlik:** Scrypt şifreleme, HMAC-SHA256 imzalı JWT oturumları, Price Tampering koruması ve sunucu taraflı doğrulama.

---

## 🛠️ Teknoloji Yığını

- **Framework:** Next.js 15 (App Router)
- **Kullanıcı Arayüzü:** React 19, Tailwind CSS, FontAwesome Icons
- **Durum Yönetimi:** Redux Toolkit
- **Veritabanı & ORM:** PostgreSQL 18, Prisma ORM
- **Dil:** TypeScript & Modern JavaScript

---

## 💻 Kurulum & Çalıştırma

### 1. Bağımlılıkları Yükleyin:
```bash
npm install
```

### 2. Çevre Değişkenlerini Ayarlayın:
`.env.example` dosyasını `.env` olarak kopyalayın ve veritabanı bilgilerinizi girin:
```bash
cp .env.example .env
```

### 3. Geliştirme Sunucusunu Başlatın:
```bash
npm run dev
```
Tarayıcınızda [http://localhost:3000](http://localhost:3000) adresine gidin.

### 4. Üretim Derlemesi:
```bash
npm run build
npm run start
```

---

## 📄 Lisans
Bu proje özel mülkiyettir. Tüm hakları saklıdır.
