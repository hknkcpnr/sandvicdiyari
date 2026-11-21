import { NextResponse } from 'next/server';
import { rawPrisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const SETTING_KEY = 'admin_system_settings';

const DEFAULT_SETTINGS = {
  courierModuleEnabled: true,
  fontSize: 'medium',
  density: 'comfortable',
  storeName: 'Sandviç Diyarı'
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

export async function GET() {
  try {
    const settings = await getAdminSettings();
    return NextResponse.json({ success: true, data: settings });
  } catch (e) {
    return NextResponse.json({ success: false, data: DEFAULT_SETTINGS }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const current = await getAdminSettings();
    const updated = {
      ...current,
      ...body,
      courierModuleEnabled:
        typeof body.courierModuleEnabled === 'boolean'
          ? body.courierModuleEnabled
          : current.courierModuleEnabled !== false
    };

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
      data: updated
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
