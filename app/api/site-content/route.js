import { NextResponse } from 'next/server';
import { db, DEFAULT_SITE_CONTENT } from '@/lib/db';
import { rawPrisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/security/auth';

export const dynamic = 'force-dynamic';

const SITE_CONTENT_KEY = 'site_content';

export async function GET() {
  try {
    try {
      if (rawPrisma && rawPrisma.systemSetting) {
        const rec = await rawPrisma.systemSetting.findUnique({
          where: { key: SITE_CONTENT_KEY }
        });
        if (rec && rec.value && typeof rec.value === 'object') {
          return NextResponse.json({
            success: true,
            data: { ...DEFAULT_SITE_CONTENT, ...rec.value }
          });
        }
      }
    } catch (pgErr) {
      console.warn('Prisma site-content read fallback:', pgErr.message);
    }

    const data = db.getSiteContent();
    return NextResponse.json({
      success: true,
      data: data || DEFAULT_SITE_CONTENT
    });
  } catch (error) {
    console.error('GET /api/site-content error:', error);
    return NextResponse.json(
      { success: false, error: 'Site içerik verisi alınamadı.', data: DEFAULT_SITE_CONTENT },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    checkRateLimit(request, {
      keyPrefix: 'POST:/api/site-content',
      maxRequests: 30,
      windowMs: 60 * 1000
    });

    const body = await request.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Geçersiz veri gönderildi.' },
        { status: 400 }
      );
    }

    const updated = db.saveSiteContent(body);

    try {
      if (rawPrisma && rawPrisma.systemSetting) {
        await rawPrisma.systemSetting.upsert({
          where: { key: SITE_CONTENT_KEY },
          update: { value: updated },
          create: { key: SITE_CONTENT_KEY, value: updated }
        });
      }
    } catch (pgErr) {
      console.warn('Prisma site-content write warning:', pgErr.message);
    }

    return NextResponse.json({
      success: true,
      message: 'Müşteri sayfası içeriği başarıyla güncellendi.',
      data: updated
    });
  } catch (error) {
    console.error('POST /api/site-content error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Site içeriği kaydedilemedi.' },
      { status: 500 }
    );
  }
}
