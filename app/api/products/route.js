import { prisma } from '@/lib/prisma';
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
    const body = await parseJsonBody(request);
    const name = sanitizeText(body.name, 191, 'Ürün Adı', '/api/products');
    const desc = sanitizeText(body.description || body.desc || 'Özel şef sandviçimiz.', 500, 'Açıklama', '/api/products');
    const category = sanitizeText(body.category || 'sandwich', 64, 'Kategori', '/api/products');
    const badge = body.badge ? sanitizeText(body.badge, 64, 'Rozet', '/api/products') : null;
    const image = sanitizeText(
      body.image || 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=500',
      500,
      'Görsel URL',
      '/api/products'
    );
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

    const newProduct = await prisma.product.create({
      data: {
        name,
        desc,
        description: desc,
        price: Number(numericPrice.toFixed(2)),
        category,
        badge,
        image,
        calories,
        prepTime,
        rating: 5.0,
        stock,
        trackStock: typeof body.trackStock === 'boolean' ? body.trackStock : true,
        isAvailable: typeof body.isAvailable === 'boolean' ? body.isAvailable : stock > 0,
        criticalThreshold,
        options: Array.isArray(body.options) ? body.options : []
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
