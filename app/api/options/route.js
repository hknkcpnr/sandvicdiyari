import { NextResponse } from 'next/server';
import { db, DEFAULT_PRODUCT_OPTIONS } from '@/lib/db';
import {
  normalizeMenuDrinkGroups,
  normalizeMenuDrinkList,
  normalizeProductMenuDrinks,
  applyGlobalColaPriceToMenuGroups,
  normalizeMenuColaExtraPrice,
  isColaDrinkName,
} from '@/lib/productOptionsDefaults';
import { rawPrisma } from '@/lib/prisma';
import { assertProtectedApiAccess, checkRateLimit } from '@/lib/security/auth';
import { sanitizeText } from '@/lib/security/validation';
import { getCachedOptions, setCachedOptions, invalidateOptionsCache } from '@/lib/productCache';

export const dynamic = 'force-dynamic';

const PRODUCT_OPTIONS_KEY = 'custom_options';

function sanitizeSauceImage(raw) {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(trimmed)) {
    return trimmed.length <= 350000 ? trimmed : '';
  }
  if (/^(\/(images|uploads)\/|https?:\/\/)/i.test(trimmed)) {
    return trimmed.slice(0, 500);
  }
  return '';
}

function sanitizeDrinkList(rawList, prefix) {
  if (!Array.isArray(rawList)) return [];
  const preCleaned = rawList.map((d) => ({
    id: d?.id,
    name: sanitizeText(typeof d === 'string' ? d : (d?.name || ''), 80, 'Menü İçeceği', '/api/options'),
    price: typeof d === 'object' ? d?.price : 0,
    isAvailable: typeof d === 'object' && d?.isAvailable === false ? false : true,
  }));
  return normalizeMenuDrinkList(preCleaned, prefix);
}

function resolveMenuColaExtraPrice(val) {
  if (typeof val?.menuColaExtraPrice === 'number') {
    return normalizeMenuColaExtraPrice(val.menuColaExtraPrice);
  }
  const groups = normalizeMenuDrinkGroups(val?.menuDrinkGroups);
  const tier1Cola = (groups['1'] || []).find((d) => isColaDrinkName(d?.name));
  if (tier1Cola && typeof tier1Cola.price === 'number') {
    return normalizeMenuColaExtraPrice(tier1Cola.price);
  }
  return DEFAULT_PRODUCT_OPTIONS.menuColaExtraPrice;
}

function hydrateOptionsRecord(val) {
  const safeVal = val && typeof val === 'object' ? val : {};
  const menuDrinkGroups = normalizeMenuDrinkGroups(safeVal.menuDrinkGroups);
  return {
    freeSauceLimit:
      typeof safeVal.freeSauceLimit === 'number'
        ? safeVal.freeSauceLimit
        : DEFAULT_PRODUCT_OPTIONS.freeSauceLimit,
    extraSaucePrice:
      typeof safeVal.extraSaucePrice === 'number'
        ? safeVal.extraSaucePrice
        : DEFAULT_PRODUCT_OPTIONS.extraSaucePrice,
    menuColaExtraPrice: resolveMenuColaExtraPrice(safeVal),
    sauces: Array.isArray(safeVal.sauces) ? safeVal.sauces : DEFAULT_PRODUCT_OPTIONS.sauces,
    extras: Array.isArray(safeVal.extras) ? safeVal.extras : DEFAULT_PRODUCT_OPTIONS.extras,
    drinks: Array.isArray(safeVal.drinks) ? safeVal.drinks : menuDrinkGroups['1'] || DEFAULT_PRODUCT_OPTIONS.drinks,
    menuDrinkGroups,
    productMenuDrinks: normalizeProductMenuDrinks(safeVal.productMenuDrinks),
  };
}

async function readCurrentOptionsFromStore() {
  if (rawPrisma && rawPrisma.systemSetting) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const rec = await rawPrisma.systemSetting.findUnique({
          where: { key: PRODUCT_OPTIONS_KEY }
        });
        if (rec && rec.value && typeof rec.value === 'object') {
          return hydrateOptionsRecord(rec.value);
        }
        break;
      } catch (pgErr) {
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 150));
        } else {
          console.warn('Prisma custom_options read fallback:', pgErr.message);
        }
      }
    }
  }
  return hydrateOptionsRecord(db.getProductOptions() || DEFAULT_PRODUCT_OPTIONS);
}

async function persistOptionsToStore(payloadToSave) {
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
  invalidateOptionsCache();
  return updated;
}

export async function GET() {
  try {
    const cached = getCachedOptions();
    if (cached) {
      return NextResponse.json({
        success: true,
        data: cached,
        cached: true
      });
    }

    const resData = await readCurrentOptionsFromStore();
    setCachedOptions(resData);
    return NextResponse.json({
      success: true,
      data: resData
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
    assertProtectedApiAccess(request, { endpoint: '/api/options' });
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

    // Hızlı genel menü kola farkı güncellemesi (Menü & Ürünler veya Menü Düzenleme modalından)
    if (body.action === 'update_menu_cola_price') {
      const current = await readCurrentOptionsFromStore();
      const nextColaPrice = normalizeMenuColaExtraPrice(body.menuColaExtraPrice);
      const nextMenuDrinkGroups = applyGlobalColaPriceToMenuGroups(current.menuDrinkGroups, nextColaPrice);
      const payloadToSave = {
        freeSauceLimit: current.freeSauceLimit,
        extraSaucePrice: current.extraSaucePrice,
        menuColaExtraPrice: nextColaPrice,
        sauces: current.sauces,
        extras: current.extras,
        drinks: nextMenuDrinkGroups['1'] || current.drinks,
        menuDrinkGroups: nextMenuDrinkGroups,
        productMenuDrinks: current.productMenuDrinks || {},
      };
      const updated = await persistOptionsToStore(payloadToSave);
      return NextResponse.json({
        success: true,
        message: `Menü kola farkı +₺${nextColaPrice.toFixed(2)} olarak güncellendi.`,
        data: updated,
      });
    }

    // Ürüne özel menü içecekleri ve fiyatları güncellemesi (Menü Ekle / Düzenle modalından)
    if (body.action === 'update_product_menu_drinks') {
      const rawProductId = body.productId;
      if (rawProductId === undefined || rawProductId === null || String(rawProductId).trim() === '') {
        return NextResponse.json(
          { success: false, error: 'Geçerli ürün kimliği gereklidir.' },
          { status: 400 }
        );
      }
      const productIdKey = String(rawProductId).trim();
      const current = await readCurrentOptionsFromStore();
      const nextProductMenuDrinks = { ...(current.productMenuDrinks || {}) };

      if (body.drinks === null || (Array.isArray(body.drinks) && body.drinks.length === 0)) {
        delete nextProductMenuDrinks[productIdKey];
      } else if (Array.isArray(body.drinks)) {
        const cleanList = sanitizeDrinkList(body.drinks, `pm-${productIdKey}`);
        if (cleanList.length === 0) {
          return NextResponse.json(
            { success: false, error: 'En az 1 geçerli içecek adı gereklidir.' },
            { status: 400 }
          );
        }
        nextProductMenuDrinks[productIdKey] = cleanList;
      } else {
        return NextResponse.json(
          { success: false, error: 'Geçersiz içecek listesi gönderildi.' },
          { status: 400 }
        );
      }

      const payloadToSave = {
        freeSauceLimit: current.freeSauceLimit,
        extraSaucePrice: current.extraSaucePrice,
        menuColaExtraPrice: current.menuColaExtraPrice,
        sauces: current.sauces,
        extras: current.extras,
        drinks: current.drinks,
        menuDrinkGroups: current.menuDrinkGroups,
        productMenuDrinks: nextProductMenuDrinks,
      };
      const updated = await persistOptionsToStore(payloadToSave);
      return NextResponse.json({
        success: true,
        message: body.drinks === null
          ? 'Menü içecekleri genel kategori listesine sıfırlandı.'
          : 'Menüye özel içecekler ve fiyatlar kaydedildi.',
        data: updated,
      });
    }

    // Menü boyutuna (1-4 kişilik) ait tüm içecekleri ve fiyatları toplu güncelle
    if (body.action === 'update_tier_menu_drinks') {
      const tier = String(body.tier || '');
      if (!['1', '2', '3', '4'].includes(tier) || !Array.isArray(body.drinks)) {
        return NextResponse.json(
          { success: false, error: 'Geçerli menü boyutu (1-4) ve içecek listesi gereklidir.' },
          { status: 400 }
        );
      }
      const cleanTierDrinks = sanitizeDrinkList(body.drinks, `m${tier}`);
      if (cleanTierDrinks.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Her menü boyutu için en az 1 içecek gereklidir.' },
          { status: 400 }
        );
      }
      const current = await readCurrentOptionsFromStore();
      const nextMenuDrinkGroups = {
        ...current.menuDrinkGroups,
        [tier]: cleanTierDrinks,
      };
      const nextDrinks = tier === '1' ? cleanTierDrinks : current.drinks;
      const tier1Cola = tier === '1' ? cleanTierDrinks.find((d) => isColaDrinkName(d?.name)) : null;
      const nextColaPrice = tier1Cola
        ? normalizeMenuColaExtraPrice(tier1Cola.price)
        : current.menuColaExtraPrice;
      const nextProductMenuDrinks = { ...(current.productMenuDrinks || {}) };
      if (body.clearProductId !== undefined && body.clearProductId !== null && String(body.clearProductId).trim() !== '') {
        delete nextProductMenuDrinks[String(body.clearProductId).trim()];
      }
      const payloadToSave = {
        freeSauceLimit: current.freeSauceLimit,
        extraSaucePrice: current.extraSaucePrice,
        menuColaExtraPrice: nextColaPrice,
        sauces: current.sauces,
        extras: current.extras,
        drinks: nextDrinks,
        menuDrinkGroups: nextMenuDrinkGroups,
        productMenuDrinks: nextProductMenuDrinks,
      };
      const updated = await persistOptionsToStore(payloadToSave);
      return NextResponse.json({
        success: true,
        message: `${tier} kişilik tüm menülerin içecek ve ek fiyat listesi güncellendi.`,
        data: updated,
      });
    }

    // Sanitize sauces
    const cleanSauces = Array.isArray(body.sauces)
      ? body.sauces.map((s, idx) => ({
          id: s.id ? String(s.id).trim().slice(0, 50) : `sauce-${Date.now()}-${idx}`,
          name: sanitizeText(s.name || '', 60, 'Sos Adı', '/api/options'),
          isAvailable: s.isAvailable !== false,
          price: Math.max(0, Number(s.price) || 0),
          image: sanitizeSauceImage(s.image)
        })).filter(s => s.name.length > 0)
      : DEFAULT_PRODUCT_OPTIONS.sauces;

    // Sanitize extras
    const cleanExtras = Array.isArray(body.extras)
      ? body.extras.map((e, idx) => ({
          id: e.id ? String(e.id).trim().slice(0, 50) : `extra-${Date.now()}-${idx}`,
          name: sanitizeText(e.name || '', 80, 'Ekstra Adı', '/api/options'),
          price: Math.max(0, Math.min(500, Number(e.price) || 0)),
          isAvailable: e.isAvailable !== false,
          image: sanitizeSauceImage(e.image)
        })).filter(e => e.name.length > 0)
      : DEFAULT_PRODUCT_OPTIONS.extras;

    // Sanitize drinks (optional)
    const cleanDrinks = Array.isArray(body.drinks)
      ? body.drinks.map((d, idx) => ({
          id: d.id ? String(d.id).trim().slice(0, 50) : `drink-${Date.now()}-${idx}`,
          name: sanitizeText(typeof d === 'string' ? d : (d.name || ''), 60, 'İçecek Adı', '/api/options'),
          price: typeof d === 'object' && typeof d.price === 'number' ? Math.max(0, Math.min(500, Number(d.price) || 0)) : 0,
          isAvailable: typeof d === 'object' && d.isAvailable === false ? false : true
        })).filter(d => d.name.length > 0)
      : DEFAULT_PRODUCT_OPTIONS.drinks;

    // Sanitize menuDrinkGroups (1, 2, 3, 4 kişilik menü içecek seçenekleri)
    const cleanMenuDrinkGroups = {};
    const rawGroups = body.menuDrinkGroups && typeof body.menuDrinkGroups === 'object'
      ? body.menuDrinkGroups
      : DEFAULT_PRODUCT_OPTIONS.menuDrinkGroups;
    ['1', '2', '3', '4'].forEach((tier) => {
      const list = Array.isArray(rawGroups[tier])
        ? rawGroups[tier]
        : DEFAULT_PRODUCT_OPTIONS.menuDrinkGroups[tier];
      cleanMenuDrinkGroups[tier] = list
        .map((d, idx) => ({
          id: d?.id ? String(d.id).trim().slice(0, 50) : `m${tier}-${Date.now()}-${idx}`,
          name: sanitizeText(typeof d === 'string' ? d : (d?.name || ''), 80, 'Menü İçeceği', '/api/options'),
          price: typeof d === 'object' ? Math.max(0, Math.min(500, Number(d?.price) || 0)) : 0,
          isAvailable: typeof d === 'object' && d?.isAvailable === false ? false : true,
        }))
        .filter((d) => d.name.length > 0);
    });

    const freeSauceLimit = typeof body.freeSauceLimit === 'number'
      ? Math.max(0, Math.min(20, Math.floor(body.freeSauceLimit)))
      : DEFAULT_PRODUCT_OPTIONS.freeSauceLimit;

    const extraSaucePrice = typeof body.extraSaucePrice === 'number'
      ? Math.max(0, Math.min(100, Number(body.extraSaucePrice)))
      : DEFAULT_PRODUCT_OPTIONS.extraSaucePrice;

    const menuColaExtraPrice = typeof body.menuColaExtraPrice === 'number'
      ? normalizeMenuColaExtraPrice(body.menuColaExtraPrice)
      : resolveMenuColaExtraPrice({ menuDrinkGroups: cleanMenuDrinkGroups });

    const finalMenuDrinkGroups = body.applyColaPriceToAllTiers === true
      ? applyGlobalColaPriceToMenuGroups(cleanMenuDrinkGroups, menuColaExtraPrice)
      : cleanMenuDrinkGroups;

    const finalDrinks = body.applyColaPriceToAllTiers === true
      ? (finalMenuDrinkGroups['1'] || cleanDrinks)
      : cleanDrinks;

    let finalProductMenuDrinks = {};
    if (body.productMenuDrinks && typeof body.productMenuDrinks === 'object' && !Array.isArray(body.productMenuDrinks)) {
      const preCleanMap = {};
      Object.entries(body.productMenuDrinks).forEach(([pid, list]) => {
        if (Array.isArray(list)) {
          preCleanMap[pid] = sanitizeDrinkList(list, `pm-${pid}`);
        }
      });
      finalProductMenuDrinks = normalizeProductMenuDrinks(preCleanMap);
    } else {
      const existing = await readCurrentOptionsFromStore();
      finalProductMenuDrinks = existing.productMenuDrinks || {};
    }

    const payloadToSave = {
      freeSauceLimit,
      extraSaucePrice,
      menuColaExtraPrice,
      sauces: cleanSauces,
      extras: cleanExtras,
      drinks: finalDrinks,
      menuDrinkGroups: finalMenuDrinkGroups,
      productMenuDrinks: finalProductMenuDrinks
    };

    const updated = await persistOptionsToStore(payloadToSave);

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

