import { prisma } from '@/lib/prisma';
import {
  NotFoundError,
  ValidationError,
  handleApiError,
  jsonSuccess,
  parseJsonBody
} from '@/lib/security/errors';
import { sanitizeText } from '@/lib/security/validation';

export async function GET(request, { params }) {
  try {
    const resolvedParams = await params;
    const id = sanitizeText(resolvedParams.id, 64, 'id', '/api/products/[id]');

    const product = await prisma.product.findUnique({ where: { id } });

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
    const resolvedParams = await params;
    const id = sanitizeText(resolvedParams.id, 64, 'id', '/api/products/[id]');
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

    const updated = await prisma.product.update({
      where: { id },
      data: sanitizedUpdates
    });

    if (!updated) {
      throw new NotFoundError('Güncellenecek ürün bulunamadı.');
    }

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
    const resolvedParams = await params;
    const id = sanitizeText(resolvedParams.id, 64, 'id', '/api/products/[id]');

    await prisma.product.delete({ where: { id } });

    return jsonSuccess({
      message: 'Ürün menüden kaldırıldı.'
    });
  } catch (error) {
    return handleApiError(error, '/api/products/[id]', request);
  }
}
