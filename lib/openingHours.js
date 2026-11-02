// Restaurant operating hours: 10:00 - 03:00 every day
export const MIN_ORDER_AMOUNT = 150;

export const TORBALI_NEIGHBORHOODS = [
  { name: 'Ertuğrul Mahallesi (Merkez)', minAmount: 150, estimate: '20-30 dk' },
  { name: 'Tepeköy Mahallesi (Merkez)', minAmount: 150, estimate: '20-30 dk' },
  { name: 'Muratbey Mahallesi (Merkez)', minAmount: 150, estimate: '25-35 dk' },
  { name: 'Torbalı Mahallesi (Merkez)', minAmount: 150, estimate: '20-30 dk' },
  { name: 'Alpkent Mahallesi (Merkez)', minAmount: 150, estimate: '25-35 dk' },
  { name: 'Cumhuriyet Mahallesi', minAmount: 150, estimate: '25-35 dk' },
  { name: 'Yemişlik Mahallesi', minAmount: 180, estimate: '30-40 dk' },
  { name: 'Çaybaşı Mahallesi', minAmount: 250, estimate: '35-45 dk' },
  { name: 'Ayrancılar', minAmount: 300, estimate: '40-50 dk' },
  { name: 'Subaşı', minAmount: 350, estimate: '45-55 dk' },
  { name: 'Diğer / Açık Adres', minAmount: 150, estimate: '30-40 dk' }
];

export function getRestaurantStatus() {
  const now = new Date();
  const hour = now.getHours();

  // Open from 10:00 (10 AM) to 03:00 (3 AM next day)
  const isOpen = hour >= 10 || hour < 3;

  if (isOpen) {
    return {
      isOpen: true,
      badgeText: '🟢 Siparişe Açık',
      deliveryEstimate: '25 - 35 dk',
      message: 'Şu an açığız! Gece 03:00\'e kadar ev ve işyerlerine sıcak paket servisimiz vardır.'
    };
  }

  return {
    isOpen: false,
    badgeText: '🔴 Şu an Kapalıyız',
    nextOpeningTime: '10:00',
    message: 'Restoranımız şu an kapalıdır. Sipariş verirseniz sabah 10:00\'da ilk sırada hazırlanıp gönderilecektir.'
  };
}
