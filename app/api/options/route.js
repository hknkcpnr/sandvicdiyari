import { NextResponse } from 'next/server';
import { db, DEFAULT_PRODUCT_OPTIONS } from '@/lib/db';
import { rawPrisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/security/auth';
import { sanitizeText } from '@/lib/security/validation';

export const dynamic = 'force-dynamic';

const PRODUCT_OPTIONS_KEY = 'custom_options';

export async function GET() {
  try {
    try {
      if (rawPrisma && rawPrisma.systemSetting) {
        const rec = await rawPrisma.systemSetting.findUnique({
          where: { key: PRODUCT_OPTIONS_KEY }
        });
        if (rec && rec.value && typeof rec.value === 'object') {
          const val = rec.value;
          return NextResponse.json({
            success: true,
            data: {
              freeSauceLimit: typeof val.freeSauceLimit === 'number' ? val.freeSauceLimit : DEFAULT_PRODUCT_OPTIONS.freeSauceLimit,
              extraSaucePrice: typeof val.extraSaucePrice === 'number' ? val.extraSaucePrice : DEFAULT_PRODUCT_OPTIONS.extraSaucePrice,
              sauces: Array.isArray(val.sauces) ? val.sauces : DEFAULT_PRODUCT_OPTIONS.sauces,
              extras: Array.isArray(val.extras) ? val.extras : DEFAULT_PRODUCT_OPTIONS.extras,
              drinks: Array.isArray(val.drinks) ? val.drinks : DEFAULT_PRODUCT_OPTIONS.drinks
            }
          });
        }
      }
    } catch (pgErr) {
      console.warn('Prisma custom_options read fallback:', pgErr.message);
    }

    const data = db.getProductOptions();
    return NextResponse.json({
      success: true,
      data: data || DEFAULT_PRODUCT_OPTIONS
    });
  } catch (error) {
    console.error('GET /api/options error:', error);
    return NextResponse.json(
      { success: false, error: 'Seçenekler yüklenemedi.', data: DEFAULT_PRODUCT_OPTIONS },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    checkRateLimit(request, {
      keyPrefix: 'POST:/api/options',
      maxRequests: 60,
      windowMs: 60 * 1000
    });

    const body = await request.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Geçersiz veri gönderildi.' },
        { status: 400 }
      );
    }

    // Sanitize sauces
    const cleanSauces = Array.isArray(body.sauces)
      ? body.sauces.map((s, idx) => ({
          id: s.id ? String(s.id).trim().slice(0, 50) : `sauce-${Date.now()}-${idx}`,
          name: sanitizeText(s.name || '', 60, 'Sos Adı', '/api/options'),
          isAvailable: s.isAvailable !== false,
          price: Math.max(0, Number(s.price) || 0)
        })).filter(s => s.name.length > 0)
      : DEFAULT_PRODUCT_OPTIONS.sauces;

    // Sanitize extras
    const cleanExtras = Array.isArray(body.extras)
      ? body.extras.map((e, idx) => ({
          id: e.id ? String(e.id).trim().slice(0, 50) : `extra-${Date.now()}-${idx}`,
          name: sanitizeText(e.name || '', 80, 'Ekstra Adı', '/api/options'),
          price: Math.max(0, Math.min(500, Number(e.price) || 0)),
          isAvailable: e.isAvailable !== false
        })).filter(e => e.name.length > 0)
      : DEFAULT_PRODUCT_OPTIONS.extras;

    // Sanitize drinks (optional)
    const cleanDrinks = Array.isArray(body.drinks)
      ? body.drinks.map((d, idx) => ({
          id: d.id ? String(d.id).trim().slice(0, 50) : `drink-${Date.now()}-${idx}`,
          name: sanitizeText(typeof d === 'string' ? d : (d.name || ''), 60, 'İçecek Adı', '/api/options'),
          isAvailable: typeof d === 'object' && d.isAvailable === false ? false : true
        })).filter(d => d.name.length > 0)
      : DEFAULT_PRODUCT_OPTIONS.drinks;

    const freeSauceLimit = typeof body.freeSauceLimit === 'number'
      ? Math.max(0, Math.min(20, Math.floor(body.freeSauceLimit)))
      : DEFAULT_PRODUCT_OPTIONS.freeSauceLimit;

    const extraSaucePrice = typeof body.extraSaucePrice === 'number'
      ? Math.max(0, Math.min(100, Number(body.extraSaucePrice)))
      : DEFAULT_PRODUCT_OPTIONS.extraSaucePrice;

    const payloadToSave = {
      freeSauceLimit,
      extraSaucePrice,
      sauces: cleanSauces,
      extras: cleanExtras,
      drinks: cleanDrinks
    };

    const updated = db.saveProductOptions(payloadToSave);

    try {
      if (rawPrisma && rawPrisma.systemSetting) {
        await rawPrisma.systemSetting.upsert({
          where: { key: PRODUCT_OPTIONS_KEY },
          update: { value: payloadToSave },
          create: { key: PRODUCT_OPTIONS_KEY, value: payloadToSave }
        });
      }
    } catch (pgErr) {
      console.warn('Prisma custom_options write warning:', pgErr.message);
    }

    return NextResponse.json({
      success: true,
      message: 'Soslar ve ekstralar başarıyla kaydedildi.',
      data: updated
    });
  } catch (error) {
    console.error('POST /api/options error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Seçenekler güncellenirken hata oluştu.' },
      { status: 500 }
    );
  }
}

