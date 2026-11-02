import { NextResponse } from 'next/server';
import { db, DEFAULT_SITE_CONTENT } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
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
    const body = await request.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Geçersiz veri gönderildi.' },
        { status: 400 }
      );
    }

    const updated = db.saveSiteContent(body);
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

