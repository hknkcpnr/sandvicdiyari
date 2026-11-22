import { prisma } from '@/lib/prisma';
import { db } from '@/lib/db';
import { assertProtectedApiAccess } from '@/lib/security/auth';
import { logUserActivity } from '@/lib/activityLogger';
import {
  NotFoundError,
  ValidationError,
  handleApiError,
  jsonSuccess,
  parseJsonBody
} from '@/lib/security/errors';
import { sanitizeText } from '@/lib/security/validation';
import { invalidateProductCache } from '@/lib/productCache';

export async function GET(request, { params }) {
  try {
    const resolvedParams = await params;
    const rawId = sanitizeText(resolvedParams.id, 64, 'id', '/api/products/[id]');
    const targetId = !Number.isNaN(Number(rawId)) ? Number(rawId) : rawId;

    let product = null;
    try {
      product = await prisma.product.findUnique({ where: { id: targetId } });
    } catch {}

    if (!product) {
      product = db.getProductById(targetId);
    }

    if (!product) {
      throw new NotFoundError('Ürün bulunamadı.');
    }

    return jsonSuccess({ data: product });
  } catch (error) {
    return handleApiError(error, '/api/products/[id]', request);
  }
}

export async function PUT(request, { params }) {
  try {
    assertProtectedApiAccess(request, { endpoint: '/api/products/[id]' });
    const resolvedParams = await params;
    const rawId = sanitizeText(resolvedParams.id, 64, 'id', '/api/products/[id]');
    const targetId = !Number.isNaN(Number(rawId)) ? Number(rawId) : rawId;
    const body = await parseJsonBody(request);

    const sanitizedUpdates = { ...body };
    if (typeof body.name !== 'undefined') {
      sanitizedUpdates.name = sanitizeText(body.name, 191, 'Ürün Adı', '/api/products/[id]');
      if (!sanitizedUpdates.name) {
        throw new ValidationError('Ürün adı boş bırakılamaz.');
      }
    }
    if (typeof body.desc !== 'undefined') {
      sanitizedUpdates.desc = sanitizeText(body.desc, 500, 'Açıklama', '/api/products/[id]');
    } else if (typeof body.description !== 'undefined') {
      sanitizedUpdates.desc = sanitizeText(body.description, 500, 'Açıklama', '/api/products/[id]');
    }
    delete sanitizedUpdates.description;
    if (typeof body.image === 'string' && body.image.trim()) {
      const rawImg = body.image.trim();
      if (
        rawImg.startsWith('data:image/') ||
        rawImg.startsWith('http://') ||
        rawImg.startsWith('https://') ||
        rawImg.startsWith('/')
      ) {
        sanitizedUpdates.image = rawImg.slice(0, 10000000);
      }
    }
    if (typeof body.price !== 'undefined') {
      const p = Number(body.price);
      if (Number.isNaN(p) || p <= 0 || p > 25000) {
        throw new ValidationError('Ürün fiyatı 0 ile 25.000 ₺ arasında olmalıdır.');
      }
      sanitizedUpdates.price = Number(p.toFixed(2));
    }
    if (Array.isArray(body.ingredients) || Array.isArray(body.options)) {
      const rawTags = Array.isArray(body.ingredients) ? body.ingredients : body.options;
      const cleanTags = rawTags
        .map((t) =>
          typeof t === 'string' ? sanitizeText(t, 60, 'İçerik Etiketi', '/api/products/[id]') : t
        )
        .filter(Boolean);
      sanitizedUpdates.options = cleanTags;
      sanitizedUpdates.ingredients = cleanTags;
    }
    if (typeof body.audioUrl === 'string') {
      const rawAudio = body.audioUrl.trim();
      if (
        !rawAudio ||
        rawAudio.startsWith('data:audio/') ||
        rawAudio.startsWith('data:video/') ||
        rawAudio.startsWith('data:application/octet-stream') ||
        rawAudio.startsWith('http://') ||
        rawAudio.startsWith('https://') ||
        rawAudio.startsWith('/')
      ) {
        sanitizedUpdates.audioUrl = rawAudio.slice(0, 5000000);
      }
    }

    let updated = null;
    try {
      updated = await prisma.product.update({
        where: { id: targetId },
        data: sanitizedUpdates
      });
    } catch (pgErr) {
      console.warn('Prisma update product warning:', pgErr?.message);
    }

    try {
      db.updateProduct(targetId, sanitizedUpdates);
    } catch {}

    if (!updated) {
      updated = db.getProductById(targetId);
    }

    if (!updated) {
      throw new NotFoundError('Güncellenecek ürün bulunamadı.');
    }

    invalidateProductCache();

    await logUserActivity({
      req: request,
      action: 'PRODUCT_UPDATE',
      category: 'MENU',
      level: 'INFO',
      message: `"${updated.name}" ürün bilgileri ve fiyatı (${updated.price} ₺) güncellendi.`,
      details: { productId: updated.id, name: updated.name, price: updated.price }
    });

    return jsonSuccess({
      message: 'Ürün bilgileri başarıyla güncellendi.',
      data: updated
    });
  } catch (error) {
    return handleApiError(error, '/api/products/[id]', request);
  }
}

export async function DELETE(request, { params }) {
  try {
    assertProtectedApiAccess(request, { endpoint: '/api/products/[id]' });
    const resolvedParams = await params;
    const rawId = sanitizeText(resolvedParams.id, 64, 'id', '/api/products/[id]');
    const targetId = !Number.isNaN(Number(rawId)) ? Number(rawId) : rawId;

    try {
      await prisma.product.delete({ where: { id: targetId } });
    } catch (pgErr) {
      console.warn('Prisma delete product warning:', pgErr?.message);
    }

    try {
      db.deleteProduct(targetId);
    } catch {}

    invalidateProductCache();

    await logUserActivity({
      req: request,
      action: 'PRODUCT_DELETE',
      category: 'MENU',
      level: 'WARN',
      message: `Ürün menüden kaldırıldı: ID #${rawId}`,
      details: { productId: targetId }
    });

    return jsonSuccess({
      message: 'Ürün menüden kaldırıldı.'
    });
  } catch (error) {
    return handleApiError(error, '/api/products/[id]', request);
  }
}
