export const DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS = {
  enabled: true, // Müşteri sayfasında bildirim zili ve bildirim merkezini göster
  showBanner: true, // Müşteri sayfası üst kısmında canlı duyuru/fırsat bandı göster
  bannerType: 'campaign', // 'campaign' | 'info' | 'delivery' | 'warning'
  bannerTitle: 'Sıcak Paket Servis Aktif!',
  bannerText: "Torbalı içi her gün 03:00'e kadar taze ve sıcak teslimat fırsatlarını kaçırmayın.",
  bannerActionPage: 'kampanyalar', // 'none' | 'menu' | 'kampanyalar' | 'iletisim'
  bannerActionLabel: 'Kampanyaları İncele',
  toastEnabled: true, // Yeni bildirim geldiğinde müşteri ekranında anlık bildirim balonu göster
  soundEnabled: true, // Yeni bildirim geldiğinde müşteri ekranında yumuşak bildirim sesi çal
  orderStatusNotifications: true, // Sipariş durumu değiştiğinde (Onaylandı, Hazırlanıyor, Yolda, Teslim Edildi) otomatik bildirim üret
  broadcasts: [
    {
      id: 'bcast_default_welcome',
      title: "🥪 Sandviç Diyarı'na Hoş Geldiniz!",
      message:
        "Gece 03:00'e kadar sıcak paket servisimiz aktiftir. Avantajlı menülerimizi Kampanyalar sayfasından hemen inceleyebilirsiniz.",
      type: 'campaign',
      targetPage: 'kampanyalar',
      createdAt: '2026-11-08T12:00:00.000Z'
    }
  ]
};

