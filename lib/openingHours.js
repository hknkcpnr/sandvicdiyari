// Restaurant operating hours: 10:00 - 03:00 every day
export const MIN_ORDER_AMOUNT = 150;

export const CLOSED_MESSAGE =
  "Restoranımız saat 03:00 ile 10:00 arasında kapalıdır. Bu saatlerde WhatsApp mesajı ve telefon araması kabul edilmemektedir. Sabah 10:00'da hizmetinizdeyiz!";

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

export function getIstanbulHour() {
  try {
    const formatted = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Istanbul',
      hour: '2-digit',
      hour12: false
    }).format(new Date());
    const parsed = parseInt(formatted, 10);
    if (!Number.isNaN(parsed)) {
      return parsed === 24 ? 0 : parsed;
    }
  } catch {}
  return new Date().getHours();
}

export function getMinOrderAmountForAddress(neighborhood = '', address = '') {
  const cleanNh = String(neighborhood || '').trim().toLowerCase();
  const cleanAddr = String(address || '').trim().toLowerCase();

  let matched = null;
  if (cleanNh) {
    matched = TORBALI_NEIGHBORHOODS.find(
      (n) => n.name.toLowerCase() === cleanNh || cleanNh.includes(n.name.toLowerCase())
    );
  }
  if (!matched && cleanAddr) {
    const bracketMatch = cleanAddr.match(/^\[([^\]]+)\]/);
    if (bracketMatch && bracketMatch[1]) {
      const inner = bracketMatch[1].trim().toLowerCase();
      matched = TORBALI_NEIGHBORHOODS.find(
        (n) => n.name.toLowerCase() === inner || inner.includes(n.name.toLowerCase())
      );
    }
  }
  return matched?.minAmount || MIN_ORDER_AMOUNT;
}

export function getRestaurantStatus() {
  const hour = getIstanbulHour();

  // Open from 10:00 (10 AM) to 03:00 (3 AM next day)
  const isOpen = hour >= 10 || hour < 3;

  if (isOpen) {
    return {
      isOpen: true,
      badgeText: '🟢 Siparişe Açık',
      deliveryEstimate: '25 - 35 dk',
      message: "Şu an açığız! Gece 03:00'e kadar ev ve işyerlerine sıcak paket servisimiz vardır."
    };
  }

  return {
    isOpen: false,
    badgeText: '🔴 Şu an Kapalıyız',
    nextOpeningTime: '10:00',
    message: "Restoranımız saat 03:00 ile 10:00 arasında kapalıdır. Bu saatlerde WhatsApp sipariş hattımız ve telefon araması kapalıdır. Sabah 10:00'da ilk sırada hazırlanmak üzere online sipariş verebilirsiniz."
  };
}
