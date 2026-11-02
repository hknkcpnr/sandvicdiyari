import { db } from '@/lib/db';
import { orm } from '@/lib/orm/postgresEngine';
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

    const product = orm.executePrepared(
      'Product',
      'SELECT',
      'SELECT * FROM "products" WHERE "id" = $1 LIMIT 1',
      [id],
      () => db.getProductById(id)
    );

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
    }
    if (typeof body.price !== 'undefined') {
      const p = Number(body.price);
      if (Number.isNaN(p) || p <= 0 || p > 25000) {
        throw new ValidationError('Ürün fiyatı 0 ile 25.000 ₺ arasında olmalıdır.');
      }
      sanitizedUpdates.price = Number(p.toFixed(2));
    }

    const updated = orm.executePrepared(
      'Product',
      'UPDATE',
      'UPDATE "products" SET "name" = COALESCE($1, "name"), "price" = COALESCE($2, "price"), "stock" = COALESCE($3, "stock"), "is_available" = COALESCE($4, "is_available"), "updated_at" = NOW() WHERE "id" = $5 RETURNING *',
      [
        sanitizedUpdates.name || null,
        sanitizedUpdates.price || null,
        sanitizedUpdates.stock ?? null,
        sanitizedUpdates.isAvailable ?? null,
        id
      ],
      () => db.updateProduct(id, sanitizedUpdates)
    );

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

    const deleted = orm.executePrepared(
      'Product',
      'DELETE',
      'DELETE FROM "products" WHERE "id" = $1 RETURNING "id"',
      [id],
      () => db.deleteProduct(id)
    );

    if (!deleted) {
      throw new NotFoundError('Silinecek ürün bulunamadı.');
    }

    return jsonSuccess({
      message: 'Ürün menüden kaldırıldı.'
    });
  } catch (error) {
    return handleApiError(error, '/api/products/[id]', request);
  }
}
