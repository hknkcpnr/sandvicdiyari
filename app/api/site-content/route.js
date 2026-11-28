import { NextResponse } from 'next/server';
import { db, DEFAULT_SITE_CONTENT } from '@/lib/db';
import { rawPrisma } from '@/lib/prisma';
import { assertProtectedApiAccess, checkRateLimit } from '@/lib/security/auth';
import {
  getCachedSiteContent,
  setCachedSiteContent,
  invalidateSiteContentCache
} from '@/lib/productCache';

export const dynamic = 'force-dynamic';

const SITE_CONTENT_KEY = 'site_content';

function sanitizeSiteContent(content) {
  if (!content || typeof content !== 'object') return content;
  const clone = JSON.parse(JSON.stringify(content));
  if (clone.featuresSection && typeof clone.featuresSection.title === 'string') {
    clone.featuresSection.title = clone.featuresSection.title.replace(/sandwich/gi, 'Sandviç');
  }
  if (clone.hero && typeof clone.hero.titleSecondary === 'string') {
    clone.hero.titleSecondary = clone.hero.titleSecondary.replace(/sandwich/gi, 'Sandviç');
  }
  return clone;
}

async function loadFullSanitizedSiteContent() {
  const cachedFull = getCachedSiteContent('full');
  if (cachedFull) {
    return { data: cachedFull, cached: true };
  }

  let rawData = null;
  try {
    if (rawPrisma && rawPrisma.systemSetting) {
      const rec = await rawPrisma.systemSetting.findUnique({
        where: { key: SITE_CONTENT_KEY }
      });
      if (rec && rec.value && typeof rec.value === 'object') {
        rawData = { ...DEFAULT_SITE_CONTENT, ...rec.value };
      }
    }
  } catch (pgErr) {
    console.warn('Prisma site-content read fallback:', pgErr.message);
  }

  if (!rawData) {
    rawData = db.getSiteContent() || DEFAULT_SITE_CONTENT;
  }

  const sanitized = sanitizeSiteContent(rawData);
  setCachedSiteContent('full', sanitized);
  return { data: sanitized, cached: false };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const section = searchParams.get('section');
    const scope = searchParams.get('scope');

    const { data: fullContent, cached } = await loadFullSanitizedSiteContent();

    if (section === 'contactBar') {
      return NextResponse.json({
        success: true,
        cached,
        data: {
          contactBar: fullContent?.contactBar || DEFAULT_SITE_CONTENT.contactBar
        }
      });
    }

    if (section === 'storyImages') {
      return NextResponse.json({
        success: true,
        cached,
        data: {
          images: Array.isArray(fullContent?.storySection?.images)
            ? fullContent.storySection.images
            : []
        }
      });
    }

    if (scope === 'editorLight') {
      const storyImages = Array.isArray(fullContent?.storySection?.images)
        ? fullContent.storySection.images
        : [];
      return NextResponse.json({
        success: true,
        cached,
        data: {
          ...fullContent,
          storySection: {
            ...(fullContent?.storySection || DEFAULT_SITE_CONTENT.storySection),
            images: [],
            _imagesDeferred: true,
            _imageCount: storyImages.length
          }
        }
      });
    }

    if (scope === 'home') {
      return NextResponse.json({
        success: true,
        cached,
        data: {
          ...fullContent,
          storySection: {
            ...(fullContent?.storySection || DEFAULT_SITE_CONTENT.storySection),
            images: []
          }
        }
      });
    }

    return NextResponse.json({
      success: true,
      cached,
      data: fullContent
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
    assertProtectedApiAccess(request, { endpoint: '/api/site-content' });
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

    const sanitizedBody = sanitizeSiteContent(body);
    if (sanitizedBody?.storySection && typeof sanitizedBody.storySection === 'object') {
      if (sanitizedBody.storySection._imagesDeferred === true) {
        const { data: existingContent } = await loadFullSanitizedSiteContent();
        sanitizedBody.storySection.images = Array.isArray(existingContent?.storySection?.images)
          ? existingContent.storySection.images
          : [];
      }
      delete sanitizedBody.storySection._imagesDeferred;
      delete sanitizedBody.storySection._imageCount;
    }
    const updated = db.saveSiteContent(sanitizedBody);

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

    const sanitizedUpdated = sanitizeSiteContent(updated);
    invalidateSiteContentCache();
    setCachedSiteContent('full', sanitizedUpdated);

    return NextResponse.json({
      success: true,
      message: 'Müşteri sayfası içeriği başarıyla güncellendi.',
      data: sanitizedUpdated
    });
  } catch (error) {
    console.error('POST /api/site-content error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Site içeriği kaydedilemedi.' },
      { status: 500 }
    );
  }
}
