/**
 * Xprinter 80mm Termal Adisyon & Paket Servis Fiş Yazdırma Modülü
 * 80mm (72-80mm efektif baskı alanı) standart termal POS yazıcıları için tasarlanmıştır.
 */

export function generateReceiptHtml(order, settings = {}, isCopy = false) {
  const storeName = settings?.storeName || 'Sandviç Diyarı';
  const storeAddress = settings?.storeAddress || 'Torbalı Mah. Hüseyin Kurtuldu Sok. No:32 Torbalı/İZMİR';
  const storePhone = settings?.storePhone || '0232 856 81 21 / 0552 104 55 35';
  const receiptFooter = settings?.receiptFooter || 'Bizi Tercih Ettiğiniz İçin Teşekkür Ederiz! Afiyet Olsun';
  const showPrices = settings?.showPricesOnReceipt !== false;
  const showPhone = settings?.showPhoneOnReceipt !== false;
  const showNotes = settings?.receiptShowNotes !== false;
  const paperWidth = settings?.receiptPaperWidth === '58mm' ? '54mm' : '76mm';

  const orderNum = order?.orderNumber || (order?.id ? String(order.id).slice(-6) : '---');
  const orderDate = order?.createdAt
    ? new Date(order.createdAt).toLocaleString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date().toLocaleString('tr-TR');

  const customerName = order?.customerName || order?.userName || order?.fullName || order?.name || 'Misafir Müşteri';
  const customerPhone = order?.phone || order?.userPhone || order?.phoneNumber || '-';
  const customerAddress = order?.address || order?.deliveryAddress || 'Adres bilgisi yok';
  const serviceType = order?.serviceType || order?.orderType || 'Paket Servis (Adrese Teslim)';
  const paymentMethod = order?.paymentMethod || 'Kapıda Nakit';
  const paymentStatus = order?.paymentStatus || (order?.isPaid ? 'Ödendi' : 'Kapıda Tahsilat');
  const courierName = order?.courierName || '';
  const orderNote = String(order?.notes || order?.note || order?.orderNote || '').trim();

  // Items normalize (string / JSON / array)
  let rawItems = [];
  if (Array.isArray(order?.items)) {
    rawItems = order.items;
  } else if (typeof order?.items === 'string') {
    try {
      const parsed = JSON.parse(order.items);
      if (Array.isArray(parsed)) rawItems = parsed;
      else rawItems = [{ name: order.items, quantity: 1, price: order?.total || 0 }];
    } catch {
      rawItems = String(order.items)
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => {
          const m = s.match(/^(\d+)x\s+(.+)$/i);
          return m ? { name: m[2].trim(), quantity: Number(m[1]), price: 0 } : { name: s, quantity: 1, price: 0 };
        });
    }
  }

  // Tüm ürünleri tek tek alt alta aç (her ürün ayrı satırda 1x olarak yazılır)
  const items = [];
  rawItems.forEach((raw) => {
    let item = raw;
    if (typeof raw === 'string') {
      const m = raw.match(/^(\d+)x\s+(.+)$/i);
      item = m ? { name: m[2].trim(), quantity: Number(m[1]), price: 0 } : { name: raw, quantity: 1, price: 0 };
    }
    const qty = Math.max(1, Math.min(100, Math.floor(Number(item?.quantity || item?.qty || 1))));
    const name = String(item?.name || item?.title || 'Ürün').trim();
    const price = Number(item?.price) || 0;
    const rawDetails =
      item?.details ||
      item?.notes ||
      item?.description ||
      (Array.isArray(item?.selectedOptions) && item.selectedOptions.length > 0
        ? item.selectedOptions.join(' | ')
        : item?.options
        ? Array.isArray(item.options)
          ? item.options.join(' | ')
          : String(item.options)
        : '');
    const detailsStr = String(rawDetails || '').trim();
    const category = String(item?.category || '').toLowerCase();

    for (let i = 0; i < qty; i++) {
      items.push({
        name,
        quantity: 1,
        price,
        details: detailsStr,
        category,
      });
    }
  });

  // İçecekleri ve Ürün Notlarını aşağıda listelemek için ayrıştır (her biri tek tek 1x)
  const summaryDrinks = [];
  const itemNotesList = [];

  items.forEach((it) => {
    const parts = it.details
      ? it.details.split(/\s*\|\s*|\n/).map((p) => p.trim()).filter(Boolean)
      : [];

    parts.forEach((part) => {
      const drinkMatch = part.match(/^İçecek\s*:\s*(.+)$/i);
      if (drinkMatch && drinkMatch[1].trim()) {
        summaryDrinks.push(drinkMatch[1].trim());
      }
      const noteMatch = part.match(/^Not\s*:\s*(.+)$/i);
      if (noteMatch) {
        const cleanNote = noteMatch[1].replace(/^["']|["']$/g, '').trim();
        if (cleanNote) {
          itemNotesList.push({ itemName: it.name, note: cleanNote });
        }
      }
    });

    // Tek başına sipariş edilen içecek ürünleri
    const lowerName = it.name.toLowerCase();
    const isStandaloneDrink =
      it.category === 'drink' ||
      (!lowerName.includes('menü') &&
        !lowerName.includes('sandviç') &&
        !lowerName.includes('tost') &&
        !lowerName.includes('dürüm') &&
        /(kola|cola|ayran|fanta|sprite|fuse tea|ice tea|şalgam|soda|gazoz|su\b|meyve suyu|limonata)/i.test(lowerName));
    if (isStandaloneDrink) {
      summaryDrinks.push(it.name);
    }
  });

  const subtotal = Number(order?.subtotal) || Number(order?.total) || 0;
  const discount = Number(order?.discount) || 0;
  const deliveryFee = Number(order?.deliveryFee) || 0;
  const total = Number(order?.total) || (subtotal - discount + deliveryFee);

  return `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <title>Fiş #${orderNum} - ${storeName}</title>
  <style>
    @page {
      size: ${settings?.receiptPaperWidth === '58mm' ? '58mm' : '80mm'} auto;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
      font-family: 'Courier New', Courier, monospace, 'Lucida Console';
      font-size: 12px;
      line-height: 1.35;
      font-weight: 600;
    }
    .ticket {
      width: ${paperWidth};
      max-width: ${paperWidth};
      margin: 0 auto;
      padding: 6px 3px 24px 3px;
    }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .text-right { text-align: right; }
    .bold { font-weight: 900; }
    .uppercase { text-transform: uppercase; }
    
    .store-title {
      font-size: 17px;
      font-weight: 900;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    .store-sub {
      font-size: 10px;
      font-weight: 700;
      line-height: 1.25;
    }
    .divider {
      border-top: 1px dashed #000;
      margin: 6px 0;
    }
    .double-divider {
      border-top: 2px dashed #000;
      margin: 7px 0;
    }
    .solid-divider {
      border-top: 2px solid #000;
      margin: 7px 0;
    }
    .badge-box {
      border: 2px solid #000;
      padding: 4px 6px;
      margin: 5px 0;
      text-align: center;
      font-size: 13px;
      font-weight: 900;
      background: #000;
      color: #fff;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin: 2px 0;
      font-size: 11px;
    }
    .info-label {
      font-weight: 800;
      width: 32%;
      flex-shrink: 0;
    }
    .info-val {
      font-weight: 700;
      width: 68%;
      text-align: right;
      word-break: break-word;
    }
    .note-box {
      border: 2px solid #000;
      background: #f4f4f4;
      padding: 6px 7px;
      margin: 7px 0;
      font-size: 12px;
      font-weight: 900;
      line-height: 1.35;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 5px 0;
    }
    .items-table th {
      border-bottom: 1px dashed #000;
      font-size: 11px;
      font-weight: 900;
      padding: 3px 0;
      text-align: left;
    }
    .items-table td {
      padding: 5px 0 4px 0;
      vertical-align: top;
      font-size: 12px;
      font-weight: 800;
      border-bottom: 1px dotted #999;
    }
    .qty-badge {
      display: inline-block;
      border: 1.5px solid #000;
      padding: 0 4px;
      margin-left: 4px;
      font-size: 11px;
      font-weight: 900;
      background: #000;
      color: #fff;
      white-space: nowrap;
    }
    .item-extras {
      font-size: 11px;
      font-weight: 700;
      color: #000;
      padding-left: 4px;
      line-height: 1.3;
      margin-top: 2px;
    }
    .summary-section {
      border: 2px solid #000;
      padding: 6px 7px;
      margin: 7px 0;
      background: #fff;
    }
    .summary-title {
      font-size: 12px;
      font-weight: 900;
      text-transform: uppercase;
      border-bottom: 1px dashed #000;
      padding-bottom: 3px;
      margin-bottom: 4px;
    }
    .summary-line {
      font-size: 12px;
      font-weight: 800;
      line-height: 1.35;
      margin: 2px 0;
    }
    .total-banner {
      font-size: 16px;
      font-weight: 900;
      display: flex;
      justify-content: space-between;
      margin: 4px 0;
    }
    .footer-text {
      font-size: 10px;
      font-weight: 700;
      text-align: center;
      margin-top: 8px;
      line-height: 1.3;
    }
    .cut-spacing {
      height: 45px;
    }
    @media print {
      body { width: ${paperWidth}; }
      .cut-spacing { height: 50px; }
    }
  </style>
</head>
<body>
  <div class="ticket">
    <!-- MAĞAZA BAŞLIĞI -->
    <div class="text-center">
      <div class="store-title uppercase">${storeName}</div>
      <div class="store-sub">${storeAddress}</div>
      <div class="store-sub">Tel: ${storePhone}</div>
      ${isCopy ? '<div style="margin-top:4px; font-size:11px; font-weight:900;">*** (2. KOPYA - KASA/KURYE) ***</div>' : ''}
    </div>

    <div class="double-divider"></div>

    <!-- SİPARİŞ KİMLİĞİ VE SERVİS TİPİ -->
    <div class="badge-box uppercase">
      ${serviceType}
    </div>

    <div class="info-row">
      <span class="info-label">SİPARİŞ NO:</span>
      <span class="info-val bold" style="font-size:14px;">#${orderNum}</span>
    </div>
    <div class="info-row">
      <span class="info-label">TARİH/SAAT:</span>
      <span class="info-val">${orderDate}</span>
    </div>
    ${courierName ? `
    <div class="info-row">
      <span class="info-label">KURYE:</span>
      <span class="info-val bold">🛵 ${courierName}</span>
    </div>` : ''}

    <div class="divider"></div>

    <!-- MÜŞTERİ BİLGİLERİ -->
    <div class="info-row">
      <span class="info-label">MÜŞTERİ:</span>
      <span class="info-val bold" style="font-size:13px;">${customerName}</span>
    </div>
    ${showPhone ? `
    <div class="info-row">
      <span class="info-label">TELEFON:</span>
      <span class="info-val bold">${customerPhone}</span>
    </div>` : ''}
    <div class="info-row" style="margin-top:3px;">
      <span class="info-label">ADRES:</span>
      <span class="info-val" style="text-align:left; padding-left:6px; font-size:11px; line-height:1.25;">
        ${customerAddress}
      </span>
    </div>

    <div class="solid-divider"></div>

    <!-- SİPARİŞ KALEMLERİ (TÜM ÜRÜNLER TEK TEK ALT ALTA 1x) -->
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 14%;"></th>
          <th style="width: ${showPrices ? '58%' : '86%'};">ÜRÜN</th>
          ${showPrices ? '<th style="width: 28%; text-align:right;">TUTAR</th>' : ''}
        </tr>
      </thead>
      <tbody>
        ${items.map((item) => {
          const name = item.name || 'Ürün';
          const price = Number(item.price) || 0;
          const detailLines = item.details
            ? item.details.split(/\s*\|\s*|\n/).map((p) => p.trim()).filter(Boolean)
            : [];

          return `
          <tr>
            <td class="bold" style="font-size:13px; white-space:nowrap;">1x</td>
            <td>
              <div class="bold" style="font-size:12px; line-height:1.3;">${name}</div>
              ${detailLines.map((line) => `<div class="item-extras">↳ ${line}</div>`).join('')}
            </td>
            ${showPrices ? `<td class="text-right bold" style="white-space:nowrap;">₺${price.toFixed(2)}</td>` : ''}
          </tr>`;
        }).join('')}
      </tbody>
    </table>

    <!-- AŞAĞIDA: İÇECEKLER -->
    ${summaryDrinks.length > 0 ? `
    <div class="summary-section">
      <div class="summary-title">🥤 İÇECEKLER</div>
      ${summaryDrinks.map((drinkName) => `
        <div class="summary-line">1x ${drinkName}</div>
      `).join('')}
    </div>` : ''}

    <!-- AŞAĞIDA: ÜRÜN & MÜŞTERİ NOTLARI -->
    ${showNotes && (orderNote || itemNotesList.length > 0) ? `
    <div class="note-box">
      <div style="font-size:12px; text-decoration:underline; margin-bottom:4px;">⚠️ NOTLAR &amp; ÖZEL İSTEKLER:</div>
      ${itemNotesList.map((n) => `
        <div style="margin-bottom:3px;">1x <strong>${n.itemName}:</strong> "${n.note}"</div>
      `).join('')}
      ${orderNote ? `
        <div style="margin-top:${itemNotesList.length > 0 ? '4px; padding-top:4px; border-top:1px dashed #000;' : '0'}">
          <strong>MÜŞTERİ NOTU:</strong> "${orderNote}"
        </div>
      ` : ''}
    </div>` : ''}

    <div class="solid-divider"></div>

    <!-- FİNANSAL DETAYLAR -->
    ${showPrices ? `
    <div class="info-row">
      <span>Ara Toplam:</span>
      <span class="bold">₺${subtotal.toFixed(2)}</span>
    </div>
    ${discount > 0 ? `
    <div class="info-row">
      <span>İndirim / Kupon:</span>
      <span class="bold">-₺${discount.toFixed(2)}</span>
    </div>` : ''}
    ${deliveryFee > 0 ? `
    <div class="info-row">
      <span>Getirme Ücreti:</span>
      <span class="bold">₺${deliveryFee.toFixed(2)}</span>
    </div>` : ''}
    
    <div class="divider"></div>
    <div class="total-banner">
      <span>GENEL TOPLAM:</span>
      <span>₺${total.toFixed(2)}</span>
    </div>
    <div class="divider"></div>
    ` : ''}

    <!-- ÖDEME BİLGİSİ -->
    <div class="info-row" style="font-size:12px;">
      <span class="info-label" style="width:36%;">ÖDEME TÜRÜ:</span>
      <span class="info-val bold uppercase">${paymentMethod}</span>
    </div>
    <div class="info-row" style="font-size:12px;">
      <span class="info-label" style="width:36%;">DURUM:</span>
      <span class="info-val bold" style="color:#000;">[ ${paymentStatus.toUpperCase()} ]</span>
    </div>

    <div class="double-divider"></div>

    <!-- ALT BİLGİ VE AFİYET OLSUN MESAJI -->
    <div class="footer-text">
      ${receiptFooter}
    </div>
    <div class="text-center" style="margin-top:6px; font-size:9px; letter-spacing:1px;">
      *** AFİYET OLSUN ***
    </div>

    <!-- YAZICI OTOMATİK KESİM BOŞLUĞU -->
    <div class="cut-spacing"></div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Termal Yazıcıya Fiş Gönderici
 * Sayfayı yenilemeden, gizli iframe üzerinden doğrudan yazdırır.
 * Chrome kiosk modunda (--kiosk-printing) onay kutusu çıkmadan anında Xprinter'a basar.
 */
export function printThermalReceipt(order, settings = {}) {
  if (typeof window === 'undefined') return false;

  try {
    const copies = Math.max(1, Math.min(3, Number(settings?.receiptCopies) || 1));
    
    for (let c = 0; c < copies; c++) {
      const isCopy = c > 0;
      const htmlContent = generateReceiptHtml(order, settings, isCopy);

      const iframeId = `thermal_printer_frame_${c}`;
      let iframe = document.getElementById(iframeId);
      if (iframe) {
        iframe.remove();
      }

      iframe = document.createElement('iframe');
      iframe.id = iframeId;
      iframe.name = iframeId;
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '1px';
      iframe.style.height = '1px';
      iframe.style.border = 'none';
      iframe.style.opacity = '0.01';
      iframe.style.pointerEvents = 'none';
      iframe.style.zIndex = '-9999';
      document.body.appendChild(iframe);

      const frameDoc = iframe.contentWindow || iframe.contentDocument;
      const targetDoc = frameDoc.document || frameDoc;

      targetDoc.open();
      targetDoc.write(htmlContent);
      targetDoc.close();

      setTimeout(() => {
        try {
          const win = iframe.contentWindow;
          if (win) {
            win.focus();
            win.print();
          }
        } catch (printErr) {
          console.warn('Iframe print tetiklenemedi, fallback açılıyor:', printErr);
          const win = window.open('', '_blank', 'width=380,height=600');
          if (win) {
            win.document.open();
            win.document.write(htmlContent);
            win.document.close();
            win.focus();
            setTimeout(() => {
              win.print();
              win.close();
            }, 300);
          }
        }
      }, 250 + c * 350);
    }

    return true;
  } catch (error) {
    console.error('printThermalReceipt hatası:', error);
    return false;
  }
}

/**
 * Ayarlar ekranında Xprinter 80mm'yi test etmek için örnek fiş
 */
export function printTestThermalReceipt(settings = {}) {
  const sampleOrder = {
    id: 'TEST-' + Math.floor(1000 + Math.random() * 9000),
    orderNumber: 'TEST-001',
    createdAt: new Date().toISOString(),
    customerName: 'Test Müşteri (Ahmet Bey)',
    phone: '0555 123 45 67',
    address: 'Torbalı Mah. 5000 Sok. No:10 Daire:4 Torbalı/İZMİR',
    serviceType: 'Paket Servis (Adrese Teslim)',
    courierName: 'Kurye Mehmet',
    notes: 'Zili çalmayın lütfen bebek uyuyor, kapıya asın.',
    items: [
      {
        name: '1 Kişilik Maxi Karışık Menü',
        quantity: 3,
        price: 450,
        details: 'İçecek: Kutu Kola 330ml | Soslar: Sarımsaklı Mayonez (1 Adet), Ketçap (1 Adet) | Ekstralar: Bol Kaşar | Not: "Acısız olsun"',
      },
      {
        name: 'Patates Kızartması (Özel Baharatlı)',
        quantity: 2,
        price: 65,
        details: 'Soslar: Ketçap (1 Adet), Mayonez (1 Adet)',
      },
      {
        name: 'Ayran 300ml',
        quantity: 2,
        price: 35,
        category: 'drink',
        details: 'Soğuk',
      },
    ],
    subtotal: 1550,
    discount: 0,
    deliveryFee: 0,
    total: 1550,
    paymentMethod: 'Kapıda Kredi Kartı (POS)',
    paymentStatus: 'Kapıda Tahsilat',
  };

  return printThermalReceipt(sampleOrder, settings);
}
