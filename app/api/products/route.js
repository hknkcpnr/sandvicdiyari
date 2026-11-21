import { prisma } from '@/lib/prisma';
import { assertProtectedApiAccess } from '@/lib/security/auth';
import {
  ValidationError,
  handleApiError,
  jsonSuccess,
  parseJsonBody
} from '@/lib/security/errors';
import {
  assertNoSqlInjection,
  sanitizeText
} from '@/lib/security/validation';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    if (category) {
      assertNoSqlInjection(category, 'category', '/api/products');
    }

    const products = await prisma.product.findMany({
      where: category ? { category } : undefined,
      orderBy: { id: 'asc' }
    });

    return jsonSuccess({
      count: products.length,
      data: products
    });
  } catch (error) {
    return handleApiError(error, '/api/products', request);
  }
}

export async function POST(request) {
  try {
    assertProtectedApiAccess(request, { endpoint: '/api/products' });
    const body = await parseJsonBody(request);
    const name = sanitizeText(body.name, 191, 'Ürün Adı', '/api/products');
    const desc = sanitizeText(body.description || body.desc || 'Özel şef sandviçimiz.', 500, 'Açıklama', '/api/products');
    const category = sanitizeText(body.category || 'sandwich', 64, 'Kategori', '/api/products');
    const badge = body.badge ? sanitizeText(body.badge, 64, 'Rozet', '/api/products') : null;
    let image = 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=500';
    if (typeof body.image === 'string' && body.image.trim()) {
      const rawImg = body.image.trim();
      if (
        rawImg.startsWith('data:image/') ||
        rawImg.startsWith('http://') ||
        rawImg.startsWith('https://') ||
        rawImg.startsWith('/')
      ) {
        image = rawImg.slice(0, 10000000);
      }
    }
    const calories = sanitizeText(body.calories || '450 kcal', 64, 'Kalori', '/api/products');
    const prepTime = sanitizeText(body.prepTime || '15 dk', 64, 'Hazırlama Süresi', '/api/products');

    const numericPrice = Number(body.price);
    if (!name || Number.isNaN(numericPrice) || numericPrice <= 0 || numericPrice > 25000) {
      throw new ValidationError('Geçerli bir ürün adı ve pozitif bir fiyat (₺) zorunludur.');
    }

    const stock = Math.max(0, Math.min(99999, typeof body.stock !== 'undefined' ? Number(body.stock) : 25));
    const criticalThreshold = Math.max(
      0,
      Math.min(1000, typeof body.criticalThreshold !== 'undefined' ? Number(body.criticalThreshold) : 5)
    );

    const rawTags = Array.isArray(body.ingredients)
      ? body.ingredients
      : Array.isArray(body.options)
      ? body.options
      : [];
    const cleanOptions = rawTags
      .map((t) => (typeof t === 'string' ? sanitizeText(t, 60, 'İçerik Etiketi', '/api/products') : t))
      .filter(Boolean);

    let audioUrl = '';
    if (typeof body.audioUrl === 'string' && body.audioUrl.trim()) {
      const rawAudio = body.audioUrl.trim();
      if (
        rawAudio.startsWith('data:audio/') ||
        rawAudio.startsWith('data:video/') ||
        rawAudio.startsWith('data:application/octet-stream') ||
        rawAudio.startsWith('http://') ||
        rawAudio.startsWith('https://') ||
        rawAudio.startsWith('/')
      ) {
        audioUrl = rawAudio.slice(0, 5000000);
      }
    }

    const newProduct = await prisma.product.create({
      data: {
        name,
        desc,
        price: Number(numericPrice.toFixed(2)),
        category,
        badge,
        image,
        audioUrl,
        calories,
        prepTime,
        rating: 5.0,
        stock,
        trackStock: typeof body.trackStock === 'boolean' ? body.trackStock : true,
        isAvailable: typeof body.isAvailable === 'boolean' ? body.isAvailable : stock > 0,
        criticalThreshold,
        options: cleanOptions,
        ingredients: cleanOptions
      }
    });

    return jsonSuccess(
      {
        message: 'Yeni ürün başarıyla eklendi.',
        data: newProduct
      },
      201
    );
  } catch (error) {
    return handleApiError(error, '/api/products', request);
  }
}
