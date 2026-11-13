import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rawPrisma } from '@/lib/prisma';
import { DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS } from '@/lib/notificationDefaults';
import { sanitizeText } from '@/lib/security/validation';

export const dynamic = 'force-dynamic';

const SETTING_KEY = 'customer_notification_settings';

let memoryNotificationSettings = null;

async function getNotificationSettings() {
  try {
    if (rawPrisma && rawPrisma.systemSetting) {
      const rec = await rawPrisma.systemSetting.findUnique({
        where: { key: SETTING_KEY }
      });
      if (rec && rec.value && typeof rec.value === 'object') {
        const merged = {
          ...DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS,
          ...rec.value,
          broadcasts: Array.isArray(rec.value.broadcasts)
            ? rec.value.broadcasts
            : DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS.broadcasts
        };
        memoryNotificationSettings = merged;
        return merged;
      }
    }
  } catch (err) {
    console.warn('Prisma notification settings read fallback:', err.message);
  }

  return memoryNotificationSettings || DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS;
}

async function saveNotificationSettings(nextValue) {
  const merged = {
    ...DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS,
    ...nextValue,
    broadcasts: Array.isArray(nextValue?.broadcasts)
      ? nextValue.broadcasts
      : DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS.broadcasts
  };
  memoryNotificationSettings = merged;

  try {
    if (rawPrisma && rawPrisma.systemSetting) {
      await rawPrisma.systemSetting.upsert({
        where: { key: SETTING_KEY },
        update: { value: merged },
        create: { key: SETTING_KEY, value: merged }
      });
    }
  } catch (err) {
    console.warn('Prisma notification settings write warning:', err.message);
  }

  return merged;
}

function buildOrderStatusText(order) {
  const no = order.orderNumber || order.id;
  switch (order.status) {
    case 'Onaylandı':
      return `#${no} numaralı siparişiniz restoran tarafından onaylandı.`;
    case 'Hazırlanıyor':
      return `#${no} numaralı siparişiniz şu anda mutfakta özenle hazırlanıyor.`;
    case 'Hazır':
      return `#${no} numaralı siparişiniz paketlendi, kuryeye teslim ediliyor.`;
    case 'Kurye Teslim Aldı':
    case 'Yolda':
      return `#${no} numaralı siparişiniz kuryemizle yola çıktı! Çok yakında kapınızda.`;
    case 'Teslim Edildi':
      return `#${no} numaralı siparişiniz teslim edildi. Afiyet olsun!`;
    case 'İptal Edildi':
      return `#${no} numaralı siparişiniz iptal edildi.${order.cancellationReason ? ` (${order.cancellationReason})` : ''}`;
    default:
      return `#${no} numaralı siparişiniz alındı, onay bekleniyor.`;
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const cleanEmail = String(searchParams.get('email') || '').trim().toLowerCase();
    const cleanId = String(searchParams.get('id') || '').trim();
    const cleanOrderId = String(searchParams.get('orderId') || '').trim();
    const isGuestSession = cleanId.startsWith('guest_') || cleanEmail.startsWith('misafir_');
    const guestTsRaw = cleanId.startsWith('guest_') ? Number(cleanId.replace('guest_', '')) : 0;
    const guestStartMs = Number.isFinite(guestTsRaw) && guestTsRaw > 0 ? guestTsRaw : 0;

    const settings = await getNotificationSettings();

    let personalNotifications = [];
    let orderNotifications = [];

    if (!cleanEmail && !cleanId && !cleanOrderId) {
      return NextResponse.json({
        success: true,
        data: {
          settings,
          notifications: []
        }
      });
    }

    if (cleanEmail || cleanId || cleanOrderId) {
      // 1. Kullanıcının kişisel bildirimleri (Admin -> Üyeler veya Toplu Bildirim)
      try {
        if (rawPrisma && rawPrisma.user) {
          const pgUser = await rawPrisma.user.findFirst({
            where: {
              OR: [
                ...(cleanEmail ? [{ email: { equals: cleanEmail, mode: 'insensitive' } }] : []),
                ...(cleanId ? [{ id: cleanId }] : [])
              ]
            },
            select: {
              id: true,
              email: true,
              notifications: true
            }
          });

          if (pgUser && Array.isArray(pgUser.notifications)) {
            personalNotifications = pgUser.notifications.map((n) => ({
              ...n,
              scope: 'personal',
              type: n.type || 'personal'
            }));
          }
        } else {
          const localUser = cleanEmail
            ? db.findUserByEmail(cleanEmail)
            : db.getUserByIdOrEmail(cleanId);
          if (localUser && Array.isArray(localUser.notifications)) {
            personalNotifications = localUser.notifications.map((n) => ({
              ...n,
              scope: 'personal',
              type: n.type || 'personal'
            }));
          }
        }
      } catch (e) {}

      // 2. Sipariş durumu bildirimleri (Ayarlarda açıksa)
      if (settings.orderStatusNotifications !== false) {
        try {
          if (rawPrisma && rawPrisma.order) {
            const recentOrders = await rawPrisma.order.findMany({
              where: {
                OR: [
                  ...(cleanEmail ? [{ userEmail: { equals: cleanEmail, mode: 'insensitive' } }] : []),
                  ...(cleanId ? [{ userId: cleanId }] : []),
                  ...(cleanOrderId ? [{ id: cleanOrderId }] : [])
                ]
              },
              orderBy: { updatedAt: 'desc' },
              take: 5,
              select: {
                id: true,
                orderNumber: true,
                status: true,
                cancellationReason: true,
                updatedAt: true,
                createdAt: true,
                statusHistory: {
                  orderBy: { timestamp: 'desc' },
                  take: 10,
                  select: {
                    id: true,
                    note: true,
                    timestamp: true,
                    user: true
                  }
                }
              }
            });

            orderNotifications = recentOrders
              .filter((o) => {
                // Misafir oturumunda yalnızca bu oturuma ait sipariş bildirimlerini göster
                if (isGuestSession || (!cleanEmail && cleanOrderId)) {
                  if (cleanOrderId && o.id === cleanOrderId) return true;
                  if (guestStartMs) {
                    const orderMs = new Date(o.createdAt || 0).getTime();
                    return !Number.isNaN(orderMs) && orderMs >= guestStartMs - 60000;
                  }
                }
                return true;
              })
              .flatMap((o) => {
              const items = [
                {
                  id: `ord_${o.id}_${o.status}`,
                  orderId: o.id,
                  title: `🛵 Sipariş Durumu: ${o.status}`,
                  message: buildOrderStatusText(o),
                  type: o.status === 'İptal Edildi' ? 'warning' : 'order',
                  scope: 'order',
                  targetPage: 'profile_orders',
                  createdAt: o.updatedAt || o.createdAt
                }
              ];

              const latestEtaEntry = Array.isArray(o.statusHistory)
                ? o.statusHistory.find((h) => h.note && h.note.includes('Tahmini Varış Süresi:'))
                : null;

              if (latestEtaEntry && o.status !== 'Teslim Edildi' && o.status !== 'İptal Edildi') {
                const match = latestEtaEntry.note.match(/Tahmini Varış Süresi:\s*(.+?)\s*olarak güncellendi/i);
                const etaText = match ? match[1].trim() : latestEtaEntry.note;
                const no = o.orderNumber || o.id;
                items.push({
                  id: `eta_${o.id}_${latestEtaEntry.id}`,
                  orderId: o.id,
                  title: `⏱️ Tahmini Varış: ${etaText}`,
                  message: `#${no} numaralı siparişiniz için kuryemiz tahmini varış süresini ${etaText} olarak bildirdi.`,
                  type: 'order',
                  scope: 'order',
                  targetPage: 'profile_orders',
                  createdAt: latestEtaEntry.timestamp || o.updatedAt || o.createdAt
                });
              }

              return items;
            });
          }
        } catch (e) {}
      }
    }

    // Misafir oturumlarında gereksiz genel kampanya bildirimleri yerine sadece sipariş bildirimleri gösterilir
    const broadcastNotifications = isGuestSession || (!cleanEmail && cleanOrderId)
      ? []
      : (settings.broadcasts || []).map((b) => ({
          ...b,
          scope: 'broadcast',
          type: b.type || 'campaign'
        }));

    const combined = [
      ...personalNotifications,
      ...orderNotifications,
      ...broadcastNotifications
    ].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    return NextResponse.json({
      success: true,
      data: {
        settings,
        notifications: combined.slice(0, 40)
      }
    });
  } catch (error) {
    console.error('GET /api/notifications error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Bildirimler alınamadı.',
        data: {
          settings: DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS,
          notifications: []
        }
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const action = sanitizeText(body?.action || 'save_settings', 40, 'action', '/api/notifications');

    // 1. ADMİN: MÜŞTERİ BİLDİRİM AYARLARINI KAYDET
    if (action === 'save_settings') {
      const current = await getNotificationSettings();
      const s = body.settings || body || {};

      const updated = await saveNotificationSettings({
        ...current,
        enabled: typeof s.enabled === 'boolean' ? s.enabled : current.enabled,
        showBanner: typeof s.showBanner === 'boolean' ? s.showBanner : current.showBanner,
        bannerType: sanitizeText(s.bannerType || current.bannerType, 32, 'bannerType', '/api/notifications'),
        bannerTitle: sanitizeText(s.bannerTitle ?? current.bannerTitle, 140, 'bannerTitle', '/api/notifications'),
        bannerText: sanitizeText(s.bannerText ?? current.bannerText, 300, 'bannerText', '/api/notifications'),
        bannerActionPage: sanitizeText(
          s.bannerActionPage || current.bannerActionPage,
          32,
          'bannerActionPage',
          '/api/notifications'
        ),
        bannerActionLabel: sanitizeText(
          s.bannerActionLabel ?? current.bannerActionLabel,
          60,
          'bannerActionLabel',
          '/api/notifications'
        ),
        toastEnabled: typeof s.toastEnabled === 'boolean' ? s.toastEnabled : current.toastEnabled,
        soundEnabled: typeof s.soundEnabled === 'boolean' ? s.soundEnabled : current.soundEnabled,
        orderStatusNotifications:
          typeof s.orderStatusNotifications === 'boolean'
            ? s.orderStatusNotifications
            : current.orderStatusNotifications,
        broadcasts: Array.isArray(s.broadcasts) ? s.broadcasts : current.broadcasts
      });

      return NextResponse.json({
        success: true,
        message: 'Müşteri bildirim ayarları kaydedildi.',
        data: { settings: updated }
      });
    }

    // 2. ADMİN: YENİ GENEL DUYURU / KAMPANYA BİLDİRİMİ YAYINLA
    if (action === 'add_broadcast') {
      const title = sanitizeText(body.title || '', 140, 'Başlık', '/api/notifications');
      const message = sanitizeText(body.message || '', 600, 'Mesaj', '/api/notifications');
      const type = sanitizeText(body.type || 'campaign', 32, 'Tip', '/api/notifications');
      const targetPage = sanitizeText(body.targetPage || 'none', 32, 'Sayfa', '/api/notifications');
      const alsoSendToMembers = Boolean(body.alsoSendToMembers);

      if (!title || !message) {
        return NextResponse.json(
          { success: false, error: 'Bildirim başlığı ve mesajı zorunludur.' },
          { status: 400 }
        );
      }

      const current = await getNotificationSettings();
      const newBroadcast = {
        id: `bcast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title,
        message,
        type,
        targetPage,
        createdAt: new Date().toISOString()
      };

      const nextBroadcasts = [newBroadcast, ...(current.broadcasts || [])].slice(0, 25);
      const updated = await saveNotificationSettings({
        ...current,
        broadcasts: nextBroadcasts
      });

      // İsteğe bağlı: Kayıtlı tüm üyelerin kişisel kutusuna da düşür
      if (alsoSendToMembers && rawPrisma && rawPrisma.user) {
        try {
          const allUsers = await rawPrisma.user.findMany({
            select: { id: true, notifications: true }
          });
          const personalItem = {
            id: `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            title,
            message,
            type,
            targetPage,
            channel: 'system',
            read: false,
            createdAt: new Date().toISOString()
          };
          await Promise.all(
            allUsers.map((u) => {
              const prev = Array.isArray(u.notifications) ? u.notifications : [];
              return rawPrisma.user.update({
                where: { id: u.id },
                data: { notifications: [personalItem, ...prev].slice(0, 50) }
              });
            })
          );
        } catch (e) {}
      }

      return NextResponse.json({
        success: true,
        message: 'Canlı duyuru yayınlandı!',
        data: { settings: updated, broadcast: newBroadcast }
      });
    }

    // 3. ADMİN: GENEL DUYURU SİL
    if (action === 'delete_broadcast') {
      const broadcastId = sanitizeText(body.id || '', 80, 'id', '/api/notifications');
      const current = await getNotificationSettings();
      const nextBroadcasts = (current.broadcasts || []).filter((b) => b.id !== broadcastId);
      const updated = await saveNotificationSettings({
        ...current,
        broadcasts: nextBroadcasts
      });

      return NextResponse.json({
        success: true,
        message: 'Duyuru kaldırıldı.',
        data: { settings: updated }
      });
    }

    // 4. MÜŞTERİ: KİŞİSEL BİLDİRİMLERİ OKUNDU İŞARETLE VEYA TEMİZLE
    if (action === 'mark_all_read' || action === 'mark_read' || action === 'clear_personal') {
      const cleanEmail = String(body.email || '').trim().toLowerCase();
      const cleanId = String(body.id || '').trim();
      const targetNotifId = String(body.notificationId || '').trim();

      if ((cleanEmail || cleanId) && rawPrisma && rawPrisma.user) {
        const pgUser = await rawPrisma.user.findFirst({
          where: {
            OR: [
              ...(cleanEmail ? [{ email: { equals: cleanEmail, mode: 'insensitive' } }] : []),
              ...(cleanId ? [{ id: cleanId }] : [])
            ]
          },
          select: { id: true, notifications: true }
        });

        if (pgUser) {
          const prev = Array.isArray(pgUser.notifications) ? pgUser.notifications : [];
          let next = prev;
          if (action === 'clear_personal') {
            next = [];
          } else if (action === 'mark_all_read') {
            next = prev.map((n) => ({ ...n, read: true }));
          } else if (action === 'mark_read' && targetNotifId) {
            next = prev.map((n) => (n.id === targetNotifId ? { ...n, read: true } : n));
          }

          await rawPrisma.user.update({
            where: { id: pgUser.id },
            data: { notifications: next }
          });
        }
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Geçersiz işlem.' }, { status: 400 });
  } catch (error) {
    console.error('POST /api/notifications error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Bildirim işlemi başarısız.' },
      { status: 500 }
    );
  }
}

