import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { rawPrisma } from '@/lib/prisma';
import { assertProtectedApiAccess } from '@/lib/security/auth';
import { handleApiError } from '@/lib/security/errors';

export const dynamic = 'force-dynamic';

function safeDateStr(val) {
  if (!val) return '';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
  } catch {
    return String(val);
  }
}

function safeNum(val) {
  if (val === null || val === undefined) return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function readFallbackDb() {
  try {
    const p = path.join(process.cwd(), 'data', 'db.json');
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  } catch (e) {
    console.warn('Fallback db.json read error:', e.message);
  }
  return {};
}

export async function GET(request) {
  try {
    assertProtectedApiAccess(request, { endpoint: '/api/admin/backup' });
    const { searchParams } = new URL(request.url);
    const format = (searchParams.get('format') || 'excel').toLowerCase();

    // 1. Verileri Topla (PostgreSQL öncelikli, db.json yedekli)
    let orders = [];
    let products = [];
    let users = [];
    let adminUsers = [];
    let roles = [];
    let ingredients = [];
    let reviews = [];
    let feedback = [];
    let finance = [];
    let settings = {};

    let dbFallback = null;

    if (rawPrisma) {
      try {
        orders = (await rawPrisma.order?.findMany({
          include: { items: true },
          orderBy: { createdAt: 'desc' }
        })) || [];
      } catch {
        dbFallback = dbFallback || readFallbackDb();
        orders = dbFallback.orders || [];
      }

      try {
        products = (await rawPrisma.product?.findMany({
          orderBy: { id: 'asc' }
        })) || [];
      } catch {
        dbFallback = dbFallback || readFallbackDb();
        products = dbFallback.products || [];
      }

      try {
        users = (await rawPrisma.user?.findMany({
          orderBy: { createdAt: 'desc' }
        })) || [];
      } catch {
        dbFallback = dbFallback || readFallbackDb();
        users = dbFallback.users || [];
      }

      try {
        adminUsers = (await rawPrisma.adminUser?.findMany({
          include: { role: true },
          orderBy: { createdAt: 'desc' }
        })) || [];
      } catch {
        dbFallback = dbFallback || readFallbackDb();
        adminUsers = dbFallback.adminUsers || [];
      }

      try {
        roles = (await rawPrisma.role?.findMany()) || [];
      } catch {
        dbFallback = dbFallback || readFallbackDb();
        roles = dbFallback.roles || [];
      }

      try {
        ingredients = (await rawPrisma.ingredient?.findMany()) || [];
      } catch {
        dbFallback = dbFallback || readFallbackDb();
        ingredients = dbFallback.ingredients || [];
      }

      try {
        reviews = (await rawPrisma.review?.findMany({
          orderBy: { createdAt: 'desc' }
        })) || [];
      } catch {
        dbFallback = dbFallback || readFallbackDb();
        reviews = dbFallback.reviews || [];
      }

      try {
        feedback = (await rawPrisma.feedback?.findMany({
          orderBy: { createdAt: 'desc' }
        })) || [];
      } catch {
        dbFallback = dbFallback || readFallbackDb();
        feedback = dbFallback.feedback || [];
      }

      try {
        const sysSettings = (await rawPrisma.systemSetting?.findMany()) || [];
        for (const s of sysSettings) {
          settings[s.key] = s.value;
          if (s.key === 'cash_transactions' && Array.isArray(s.value)) {
            finance = s.value;
          }
        }
      } catch {}
    } else {
      dbFallback = readFallbackDb();
      orders = dbFallback.orders || [];
      products = dbFallback.products || [];
      users = dbFallback.users || [];
      adminUsers = dbFallback.adminUsers || [];
      roles = dbFallback.roles || [];
      ingredients = dbFallback.ingredients || [];
      reviews = dbFallback.reviews || [];
      feedback = dbFallback.feedback || [];
    }

    const exportTimestamp = new Date();
    const dateStr = exportTimestamp.toISOString().slice(0, 10);
    const dateReadable = safeDateStr(exportTimestamp);

    // =========================================================================
    // FORMAT: JSON YEDEK
    // =========================================================================
    if (format === 'json') {
      const fullBackup = {
        meta: {
          system: 'Sandviç Diyarı - Sistem Yedekleme',
          exportedAt: exportTimestamp.toISOString(),
          exportedAtReadable: dateReadable,
          version: '2.0.0'
        },
        stats: {
          orderCount: orders.length,
          productCount: products.length,
          userCount: users.length,
          adminCount: adminUsers.length,
          ingredientCount: ingredients.length,
          reviewCount: reviews.length
        },
        orders,
        products,
        users,
        adminUsers,
        roles,
        ingredients,
        reviews,
        feedback,
        finance,
        settings
      };

      const jsonStr = JSON.stringify(fullBackup, null, 2);
      return new NextResponse(jsonStr, {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="Sandvic_Diyari_Sistem_Yedek_${dateStr}.json"`
        }
      });
    }

    // =========================================================================
    // FORMAT: EXCEL (.XLSX) ÇOK SAYFALI ÇALIŞMA KİTABI
    // =========================================================================
    const wb = XLSX.utils.book_new();

    // 1. SAYFA: ÖZET BİLGİLER
    const totalRevenue = orders.reduce((sum, o) => {
      if (o.status !== 'İptal Edildi') {
        return sum + safeNum(o.total);
      }
      return sum;
    }, 0);

    const summaryData = [
      { 'Özet Başlığı': 'Sistem Adı', 'Değer': 'Sandviç Diyarı' },
      { 'Özet Başlığı': 'Yedekleme Tarihi', 'Değer': dateReadable },
      { 'Özet Başlığı': 'Yedekleme Türü', 'Değer': 'Tam Sistem & Veritabanı Excel Raporu' },
      { 'Özet Başlığı': 'Toplam Sipariş Adedi', 'Değer': orders.length },
      { 'Özet Başlığı': 'Toplam Ciro (₺)', 'Değer': totalRevenue.toFixed(2) },
      { 'Özet Başlığı': 'Aktif Menü & Ürün Sayısı', 'Değer': products.length },
      { 'Özet Başlığı': 'Kayıtlı Müşteri Sayısı', 'Değer': users.length },
      { 'Özet Başlığı': 'Yönetici & Personel Sayısı', 'Değer': adminUsers.length },
      { 'Özet Başlığı': 'Stok Malzeme Çeşidi', 'Değer': ingredients.length },
      { 'Özet Başlığı': 'Müşteri Yorum Sayısı', 'Değer': reviews.length },
      { 'Özet Başlığı': 'Geri Bildirim / Öneri Sayısı', 'Değer': feedback.length },
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    wsSummary['!cols'] = [{ wch: 30 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Özet Bilgiler');

    // 2. SAYFA: SİPARİŞLER
    const ordersData = orders.map((o) => {
      const itemsList = Array.isArray(o.items)
        ? o.items.map((it) => `${it.quantity}x ${it.name}`).join(', ')
        : '';
      return {
        'Sipariş No': o.orderNumber || o.id,
        'Müşteri Adı': o.customerName || '',
        'Telefon': o.customerPhone || '',
        'Teslimat Adresi': o.customerAddress || '',
        'Durum': o.status || 'Yeni',
        'Ödeme Yöntemi': o.paymentMethod || '',
        'Ödeme Durumu': o.paymentStatus || '',
        'Ara Toplam (₺)': safeNum(o.subtotal).toFixed(2),
        'Teslimat Ücreti (₺)': safeNum(o.deliveryFee).toFixed(2),
        'Toplam Tutar (₺)': safeNum(o.total).toFixed(2),
        'Atanan Kurye': o.courierName || '',
        'Müşteri / Sipariş Notu': o.orderNote || '',
        'Sipariş Tarihi': safeDateStr(o.createdAt),
        'Teslim Edildi Tarihi': safeDateStr(o.deliveredAt),
        'İptal Nedeni': o.cancellationReason || '',
        'Ürünler Özeti': itemsList
      };
    });
    const wsOrders = XLSX.utils.json_to_sheet(ordersData.length ? ordersData : [{ 'Bilgi': 'Henüz kayıtlı sipariş yok' }]);
    wsOrders['!cols'] = [
      { wch: 16 }, { wch: 22 }, { wch: 16 }, { wch: 35 }, { wch: 14 },
      { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 },
      { wch: 18 }, { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 25 }, { wch: 40 }
    ];
    XLSX.utils.book_append_sheet(wb, wsOrders, 'Siparişler');

    // 3. SAYFA: SİPARİŞ KALEMLERİ & DETAYLAR
    const orderItemsRows = [];
    orders.forEach((o) => {
      const oNum = o.orderNumber || o.id;
      if (Array.isArray(o.items)) {
        o.items.forEach((it) => {
          let optsStr = '';
          if (it.selectedOptions) {
            try {
              if (typeof it.selectedOptions === 'object') {
                optsStr = Object.entries(it.selectedOptions)
                  .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
                  .join(' | ');
              }
            } catch {}
          }
          orderItemsRows.push({
            'Sipariş No': oNum,
            'Müşteri Adı': o.customerName || '',
            'Ürün Adı': it.name || '',
            'Adet': safeNum(it.quantity || 1),
            'Birim Fiyat (₺)': safeNum(it.price).toFixed(2),
            'Toplam Tutar (₺)': (safeNum(it.price) * safeNum(it.quantity || 1)).toFixed(2),
            'Seçilen Opsiyonlar & Malzemeler': optsStr,
            'Sipariş Tarihi': safeDateStr(o.createdAt)
          });
        });
      }
    });
    const wsOrderItems = XLSX.utils.json_to_sheet(orderItemsRows.length ? orderItemsRows : [{ 'Bilgi': 'Sipariş kalemi bulunamadı' }]);
    wsOrderItems['!cols'] = [
      { wch: 16 }, { wch: 22 }, { wch: 28 }, { wch: 8 }, { wch: 14 },
      { wch: 16 }, { wch: 40 }, { wch: 20 }
    ];
    XLSX.utils.book_append_sheet(wb, wsOrderItems, 'Sipariş Detayları');

    // 4. SAYFA: MENÜ VE ÜRÜNLER
    const productsData = products.map((p) => ({
      'Ürün ID': p.id,
      'Ürün Adı': p.name || '',
      'Kategori': p.category || '',
      'Fiyat (₺)': safeNum(p.price).toFixed(2),
      'Stok Adedi': safeNum(p.stock),
      'Stok Takibi': p.trackStock ? 'Açık' : 'Kapalı',
      'Satışta mı?': p.isAvailable ? 'Satışta' : 'Kapalı / Tükendi',
      'Puan': safeNum(p.rating).toFixed(1),
      'Kalori': p.calories || '',
      'Hazırlık Süresi': p.prepTime || '',
      'Etiket / Rozet': p.badge || '',
      'Açıklama': p.desc || ''
    }));
    const wsProducts = XLSX.utils.json_to_sheet(productsData.length ? productsData : [{ 'Bilgi': 'Menüde ürün bulunamadı' }]);
    wsProducts['!cols'] = [
      { wch: 10 }, { wch: 28 }, { wch: 16 }, { wch: 12 }, { wch: 12 },
      { wch: 12 }, { wch: 16 }, { wch: 8 }, { wch: 12 }, { wch: 14 },
      { wch: 16 }, { wch: 40 }
    ];
    XLSX.utils.book_append_sheet(wb, wsProducts, 'Menü & Ürünler');

    // 5. SAYFA: KAYITLI MÜŞTERİLER
    const usersData = users.map((u) => ({
      'Müşteri ID': u.id,
      'Ad Soyad': u.name || '',
      'E-posta': u.email || '',
      'Telefon': u.phone || '',
      'Telefon Onaylı mı?': u.phoneVerified ? 'Evet' : 'Hayır',
      'Kayıtlı Adres': u.address || '',
      'Engelli mi?': u.isBlocked ? 'Evet (Engelli)' : 'Aktif',
      'Engel Nedeni': u.blockReason || '',
      'Kayıt Tarihi': safeDateStr(u.createdAt)
    }));
    const wsUsers = XLSX.utils.json_to_sheet(usersData.length ? usersData : [{ 'Bilgi': 'Kayıtlı müşteri bulunamadı' }]);
    wsUsers['!cols'] = [
      { wch: 16 }, { wch: 24 }, { wch: 28 }, { wch: 16 }, { wch: 18 },
      { wch: 35 }, { wch: 16 }, { wch: 22 }, { wch: 20 }
    ];
    XLSX.utils.book_append_sheet(wb, wsUsers, 'Kayıtlı Müşteriler');

    // 6. SAYFA: YÖNETİCİ & PERSONEL
    const adminsData = adminUsers.map((a) => ({
      'Kullanıcı ID': a.id,
      'Ad Soyad': a.name || '',
      'E-posta': a.email || '',
      'Telefon': a.phone || '',
      'Rol / Departman': a.role?.name || a.roleName || '',
      'Durum': a.isActive ? 'Aktif' : 'Pasif',
      'Kayıt Tarihi': safeDateStr(a.createdAt)
    }));
    const wsAdmins = XLSX.utils.json_to_sheet(adminsData.length ? adminsData : [{ 'Bilgi': 'Personel bulunamadı' }]);
    wsAdmins['!cols'] = [
      { wch: 16 }, { wch: 24 }, { wch: 28 }, { wch: 16 }, { wch: 20 },
      { wch: 12 }, { wch: 20 }
    ];
    XLSX.utils.book_append_sheet(wb, wsAdmins, 'Personel & Roller');

    // 7. SAYFA: STOK & MALZEMELER
    const ingredientsData = ingredients.map((ing) => ({
      'Malzeme Kodu': ing.id,
      'Malzeme Adı': ing.name || '',
      'Kategori': ing.category || '',
      'Mevcut Stok': safeNum(ing.stock),
      'Birim': ing.unit || 'Adet',
      'Kritik Eşik': safeNum(ing.criticalThreshold),
      'Açıklama': ing.description || ''
    }));
    const wsIngredients = XLSX.utils.json_to_sheet(ingredientsData.length ? ingredientsData : [{ 'Bilgi': 'Stok malzemesi bulunamadı' }]);
    wsIngredients['!cols'] = [
      { wch: 16 }, { wch: 24 }, { wch: 16 }, { wch: 14 }, { wch: 10 },
      { wch: 14 }, { wch: 35 }
    ];
    XLSX.utils.book_append_sheet(wb, wsIngredients, 'Stok & Hammadde');

    // 8. SAYFA: KASA & FİNANS HAREKETLERİ
    const financeData = Array.isArray(finance)
      ? finance.map((f, i) => ({
          'İşlem Sıra': i + 1,
          'İşlem Türü': f.type === 'in' || f.type === 'income' ? 'Giren (+)' : 'Çıkan (-)',
          'Tutar (₺)': safeNum(f.amount).toFixed(2),
          'Kategori': f.category || '',
          'Ödeme Kaynağı': f.paymentSource || '',
          'Açıklama': f.description || '',
          'Tarih': f.date || safeDateStr(f.createdAt),
          'Kaydeden': f.createdBy || f.user || ''
        }))
      : [];
    const wsFinance = XLSX.utils.json_to_sheet(financeData.length ? financeData : [{ 'Bilgi': 'Kasa hareketi bulunamadı' }]);
    wsFinance['!cols'] = [
      { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 30 },
      { wch: 20 }, { wch: 18 }
    ];
    XLSX.utils.book_append_sheet(wb, wsFinance, 'Kasa & Finans');

    // 9. SAYFA: MÜŞTERİ YORUMLARI
    const reviewsData = reviews.map((r) => ({
      'Yorum ID': r.id,
      'Müşteri Adı': r.name || '',
      'Puan': r.rating,
      'Şehir / Lokasyon': r.location || '',
      'Onaylı mı?': r.isApproved ? 'Yayında (Onaylı)' : 'Beklemede',
      'Yorum Metni': r.comment || '',
      'Tarih': safeDateStr(r.createdAt)
    }));
    const wsReviews = XLSX.utils.json_to_sheet(reviewsData.length ? reviewsData : [{ 'Bilgi': 'Müşteri yorumu bulunamadı' }]);
    wsReviews['!cols'] = [
      { wch: 10 }, { wch: 22 }, { wch: 8 }, { wch: 18 }, { wch: 18 },
      { wch: 45 }, { wch: 20 }
    ];
    XLSX.utils.book_append_sheet(wb, wsReviews, 'Müşteri Yorumları');

    // Buffer oluştur
    const excelBuffer = XLSX.write(wb, {
      type: 'buffer',
      bookType: 'xlsx',
      compression: true
    });

    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Sandvic_Diyari_Sistem_Yedek_${dateStr}.xlsx"`,
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    return handleApiError(error, '/api/admin/backup', request);
  }
}
