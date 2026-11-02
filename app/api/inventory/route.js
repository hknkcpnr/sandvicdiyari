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

export async function GET(request) {
  try {
    const products = orm.executePrepared(
      'Product',
      'SELECT',
      'SELECT "id", "name", "category", "stock", "is_available", "track_stock", "critical_threshold" FROM "products" ORDER BY "id" ASC',
      [],
      () => db.getProducts()
    );

    const summary = {
      total: products.length,
      inStock: products.filter(p => p.status === 'in_stock').length,
      lowStock: products.filter(p => p.status === 'low_stock').length,
      outOfStock: products.filter(p => p.status === 'out_of_stock').length,
      activeCount: products.filter(p => p.isAvailable).length,
      closedCount: products.filter(p => !p.isAvailable).length
    };

    return jsonSuccess({
      data: products,
      summary
    });
  } catch (error) {
    return handleApiError(error, '/api/inventory', request);
  }
}

export async function PUT(request) {
  try {
    const body = await parseJsonBody(request);
    const { id, isAvailable, stock, delta, trackStock, criticalThreshold, bulkAction, amount } = body;

    // Bulk actions
    if (bulkAction) {
      const safeAction = sanitizeText(bulkAction, 64, 'bulkAction', '/api/inventory');
      const safeAmount = Math.max(1, Math.min(1000, Number(amount) || 20));

      const refreshedProducts = orm.executePrepared(
        'Product',
        'UPDATE',
        'UPDATE "products" SET "stock" = "stock" + $1, "is_available" = TRUE, "updated_at" = NOW() RETURNING *',
        [safeAmount],
        () => db.bulkUpdateProductStocks(safeAction, safeAmount)
      );

      return jsonSuccess({
        message: 'Toplu stok işlemi başarıyla uygulandı.',
        products: refreshedProducts
      });
    }

    if (!id) {
      throw new ValidationError('Ürün veya Malzeme ID belirtilmelidir.');
    }

    const safeId = sanitizeText(id, 64, 'id', '/api/inventory');

    // Update product stock
    const updated = orm.executePrepared(
      'Product',
      'UPDATE',
      'UPDATE "products" SET "stock" = $1, "is_available" = $2, "updated_at" = NOW() WHERE "id" = $3 RETURNING *',
      [stock ?? delta ?? 0, isAvailable ?? true, safeId],
      () =>
        db.updateProductStock(safeId, {
          isAvailable,
          stock,
          delta,
          trackStock,
          criticalThreshold
        })
    );

    if (updated) {
      const refreshedProducts = db.getProducts();
      return jsonSuccess({
        message: `"${updated.name}" stok durumu güncellendi.`,
        data: updated,
        products: refreshedProducts
      });
    }

    // Fallback: ingredient stock update
    let updatedIng = null;
    if (typeof stock !== 'undefined') {
      updatedIng = db.updateIngredientStock(safeId, stock);
    } else if (typeof delta !== 'undefined') {
      updatedIng = db.adjustIngredientStock(safeId, delta);
    }

    if (updatedIng) {
      return jsonSuccess({
        message: 'Malzeme stoğu güncellendi.',
        data: updatedIng,
        products: db.getProducts()
      });
    }

    throw new NotFoundError('Ürün bulunamadı.');
  } catch (error) {
    return handleApiError(error, '/api/inventory', request);
  }
}

export async function POST(request) {
  try {
    const body = await parseJsonBody(request);
    const name = sanitizeText(body.name, 191, 'Ürün Adı', '/api/inventory');
    const category = sanitizeText(body.category || 'menu', 64, 'Kategori', '/api/inventory');
    const price = Number(body.price);

    if (!name || Number.isNaN(price) || price <= 0) {
      throw new ValidationError('Geçerli bir ürün adı ve fiyatı zorunludur.');
    }

    const stock = typeof body.stock !== 'undefined' ? Math.max(0, Number(body.stock)) : 25;
    const isAvailable = typeof body.isAvailable === 'boolean' ? body.isAvailable : true;

    const newProduct = orm.executePrepared(
      'Product',
      'INSERT',
      'INSERT INTO "products" ("name", "category", "price", "stock", "is_available") VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, category, price, stock, isAvailable],
      () =>
        db.addProduct({
          name,
          category,
          price: Number(price.toFixed(2)),
          stock,
          isAvailable,
          trackStock: true,
          criticalThreshold: 5
        })
    );

    return jsonSuccess(
      {
        message: 'Ürün başarıyla eklendi.',
        data: newProduct
      },
      201
    );
  } catch (error) {
    return handleApiError(error, '/api/inventory', request);
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawId = searchParams.get('id');

    if (!rawId) {
      throw new ValidationError('ID zorunludur.');
    }

    const id = sanitizeText(rawId, 64, 'id', '/api/inventory');
    const deleted = orm.executePrepared(
      'Product',
      'DELETE',
      'DELETE FROM "products" WHERE "id" = $1 RETURNING "id"',
      [id],
      () => db.deleteProduct(id)
    );

    if (!deleted) {
      throw new NotFoundError('Ürün bulunamadı veya silinemedi.');
    }

    return jsonSuccess({
      message: 'Ürün silindi.',
      products: db.getProducts()
    });
  } catch (error) {
    return handleApiError(error, '/api/inventory', request);
  }
}
