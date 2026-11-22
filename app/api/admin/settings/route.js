import { NextResponse } from 'next/server';
import { rawPrisma } from '@/lib/prisma';
import { assertProtectedApiAccess } from '@/lib/security/auth';
import { handleApiError, ValidationError } from '@/lib/security/errors';
import { sanitizeText } from '@/lib/security/validation';
import { getOrderPauseState } from '@/lib/orderPause';

export const dynamic = 'force-dynamic';

const SETTING_KEY = 'admin_system_settings';

const DEFAULT_SETTINGS = {
  courierModuleEnabled: false,
  fontSize: 'medium',
  density: 'comfortable',
  storeName: 'Sandviç Diyarı',
  storeAddress: 'Torbalı Mah. Hüseyin Kurtuldu Sok. No:32 Torbalı/İZMİR',
  storePhone: '0232 856 81 21 / 0552 104 55 35',
  receiptFooter: 'Bizi Tercih Ettiğiniz İçin Teşekkür Ederiz! Afiyet Olsun - sandwichdiyari.com',
  showPricesOnReceipt: true,
  showPhoneOnReceipt: true,
  autoPrintOnApproval: true,
  receiptPaperWidth: '80mm',
  receiptCopies: 1,
  receiptShowNotes: true,
  ordersPaused: false,
  ordersPausedUntil: null,
  ordersPausedReason: ''
};

let memorySettings = null;

async function getAdminSettings() {
  try {
    if (rawPrisma && rawPrisma.systemSetting) {
      const rec = await rawPrisma.systemSetting.findUnique({
        where: { key: SETTING_KEY }
      });
      if (rec && rec.value && typeof rec.value === 'object') {
        memorySettings = { ...DEFAULT_SETTINGS, ...rec.value };
        return memorySettings;
      }
    }
  } catch (err) {
    console.warn('Prisma admin settings read warning:', err.message);
  }
  return memorySettings || DEFAULT_SETTINGS;
}

function withComputedState(settings) {
  return { ...settings, orderPause: getOrderPauseState(settings) };
}

export async function GET() {
  try {
    const settings = await getAdminSettings();
    return NextResponse.json({ success: true, data: withComputedState(settings) });
  } catch (e) {
    return NextResponse.json(
      { success: false, data: withComputedState(DEFAULT_SETTINGS) },
      { status: 500 }
    );
  }
}

// Ayarları yalnızca yönetim panelleri (/panel, /yonetici) veya admin oturumu değiştirebilir.
export async function POST(request) {
  try {
    assertProtectedApiAccess(request, { endpoint: '/api/admin/settings' });

    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new ValidationError('Geçersiz ayar verisi.');
    }

    // Hesaplanan alan istemciden gelirse saklanmasın
    const { orderPause: _ignoredComputed, ...incoming } = body;

    const current = await getAdminSettings();
    const updated = {
      ...current,
      ...incoming,
      courierModuleEnabled:
        typeof incoming.courierModuleEnabled === 'boolean'
          ? incoming.courierModuleEnabled
          : current.courierModuleEnabled === true
    };

    // Sipariş alımı durdurma alanlarını doğrula
    if (typeof incoming.ordersPaused !== 'undefined') {
      updated.ordersPaused = incoming.ordersPaused === true;
      if (!updated.ordersPaused) {
        updated.ordersPausedUntil = null;
        updated.ordersPausedReason = '';
      }
    }
    if (typeof incoming.ordersPausedUntil !== 'undefined' && updated.ordersPaused) {
      const ms = incoming.ordersPausedUntil ? new Date(incoming.ordersPausedUntil).getTime() : NaN;
      updated.ordersPausedUntil = Number.isFinite(ms) ? new Date(ms).toISOString() : null;
    }
    if (typeof incoming.ordersPausedReason !== 'undefined' && updated.ordersPaused) {
      updated.ordersPausedReason = incoming.ordersPausedReason
        ? sanitizeText(incoming.ordersPausedReason, 160, 'ordersPausedReason', '/api/admin/settings')
        : '';
    }

    memorySettings = updated;

    try {
      if (rawPrisma && rawPrisma.systemSetting) {
        await rawPrisma.systemSetting.upsert({
          where: { key: SETTING_KEY },
          update: { value: updated },
          create: { key: SETTING_KEY, value: updated }
        });
      }
    } catch (err) {
      console.warn('Prisma admin settings write warning:', err.message);
    }

    return NextResponse.json({
      success: true,
      message: 'Sistem ayarları kaydedildi.',
      data: withComputedState(updated)
    });
  } catch (error) {
    return handleApiError(error, '/api/admin/settings', request);
  }
}
