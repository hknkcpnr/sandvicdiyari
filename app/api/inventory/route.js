import { db } from '@/lib/db';
import { prisma, rawPrisma, formatPrismaProduct } from '@/lib/prisma';
import { orm } from '@/lib/orm/postgresEngine';
import { logUserActivity } from '@/lib/activityLogger';
import {
  NotFoundError,
  ValidationError,
  handleApiError,
  jsonSuccess,
  parseJsonBody
} from '@/lib/security/errors';
import { assertProtectedApiAccess, checkRateLimit } from '@/lib/security/auth';
import { sanitizeText } from '@/lib/security/validation';

function computeInventorySummary(products) {
  return {
    total: products.length,
    inStock: products.filter((p) => p.status === 'in_stock').length,
    lowStock: products.filter((p) => p.status === 'low_stock').length,
    outOfStock: products.filter((p) => p.status === 'out_of_stock').length,
    activeCount: products.filter((p) => p.isAvailable).length,
    closedCount: products.filter((p) => !p.isAvailable).length
  };
}

async function getAllProductsFromPgOrLocal() {
  try {
    const pgRows = await rawPrisma.product.findMany({
      orderBy: { id: 'asc' }
    });
    orm.executePrepared(
      'Product',
      'SELECT',
      'SELECT "id", "name", "category", "stock", "is_available", "track_stock", "critical_threshold" FROM "products" ORDER BY "id" ASC',
      [],
      () => pgRows.length
    );
    if (Array.isArray(pgRows)) {
      return pgRows.map((r) => formatPrismaProduct(r));
    }
  } catch (err) {
    console.error('Inventory PG read fallback:', err);
  }
  return db.getProducts();
}

export async function GET(request) {
  try {
    const products = await getAllProductsFromPgOrLocal();
    const summary = computeInventorySummary(products);

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
    assertProtectedApiAccess(request, { endpoint: '/api/inventory' });
    checkRateLimit(request, {
      keyPrefix: 'PUT:/api/inventory',
      maxRequests: 60,
      windowMs: 60 * 1000
    });

    const body = await parseJsonBody(request);
    const { id, isAvailable, stock, delta, trackStock, criticalThreshold, bulkAction, amount } = body;

    // Bulk actions
    if (bulkAction) {
      const safeAction = sanitizeText(bulkAction, 64, 'bulkAction', '/api/inventory');
      const safeAmount = Math.max(1, Math.min(1000, Number(amount) || 20));

      try {
        if (safeAction === 'set_all_available') {
          await rawPrisma.product.updateMany({
            where: { stock: { lte: 0 } },
            data: { stock: 20, isAvailable: true }
          });
          await rawPrisma.product.updateMany({
            data: { isAvailable: true }
          });
        } else if (safeAction === 'refill_all') {
          await rawPrisma.product.updateMany({
            data: {
              stock: { increment: safeAmount },
              isAvailable: true
            }
          });
        } else if (safeAction === 'reset_all') {
          await rawPrisma.product.updateMany({
            data: {
              stock: 25,
              isAvailable: true
            }
          });
        }
        orm.executePrepared(
          'Product',
          'UPDATE',
          'UPDATE "products" SET "stock" = "stock" + $1, "is_available" = TRUE, "updated_at" = NOW() RETURNING *',
          [safeAmount],
          () => safeAmount
        );
      } catch (err) {
        console.error('Inventory bulk update PG fallback:', err);
      }

      try {
        db.bulkUpdateProductStocks(safeAction, safeAmount);
      } catch {}

      const refreshedProducts = await getAllProductsFromPgOrLocal();
      const summary = computeInventorySummary(refreshedProducts);

      await logUserActivity({
        req: request,
        action: 'STOCK_BULK_UPDATE',
        category: 'MENU',
        level: 'INFO',
        message: `Toplu stok işlemi uygulandı: ${safeAction} (${safeAmount} adet)`,
        details: { action: safeAction, amount: safeAmount }
      });

      return jsonSuccess({
        message: 'Toplu stok işlemi başarıyla uygulandı.',
        products: refreshedProducts,
        summary
      });
    }

    if (id === undefined || id === null || id === '') {
      throw new ValidationError('Ürün veya Malzeme ID belirtilmelidir.');
    }

    const safeId = sanitizeText(id, 64, 'id', '/api/inventory');
    const numericId = Number(safeId);

    if (Number.isInteger(numericId) && numericId > 0) {
      try {
        const pgProd = await rawPrisma.product.findUnique({
          where: { id: numericId }
        });

        if (pgProd) {
          const nextTrackStock =
            typeof trackStock === 'boolean' ? trackStock : pgProd.trackStock;
          const nextThreshold =
            typeof criticalThreshold !== 'undefined'
              ? Math.max(0, Number(criticalThreshold) || 5)
              : pgProd.criticalThreshold;

          let nextStock = typeof pgProd.stock === 'number' ? pgProd.stock : 25;
          let nextAvailable =
            typeof isAvailable === 'boolean' ? isAvailable : pgProd.isAvailable;

          if (typeof stock !== 'undefined' && stock !== null) {
            nextStock = Math.max(0, Math.floor(Number(stock) || 0));
            if (nextTrackStock) {
              if (nextStock === 0) {
                nextAvailable = false;
              } else if (nextStock > 0 && typeof isAvailable === 'undefined') {
                nextAvailable = true;
              }
            }
          } else if (typeof delta !== 'undefined' && delta !== null) {
            nextStock = Math.max(0, nextStock + Math.floor(Number(delta) || 0));
            if (nextTrackStock) {
              if (nextStock === 0) {
                nextAvailable = false;
              } else if (nextStock > 0 && typeof isAvailable === 'undefined') {
                nextAvailable = true;
              }
            }
          }

          if (typeof isAvailable === 'boolean' && isAvailable === true && nextTrackStock && nextStock <= 0) {
            nextStock = 15;
          }

          if (!nextTrackStock && typeof isAvailable === 'undefined') {
            nextAvailable = true;
          }

          const updatedPg = await rawPrisma.product.update({
            where: { id: numericId },
            data: {
              stock: nextStock,
              isAvailable: nextAvailable,
              trackStock: nextTrackStock,
              criticalThreshold: nextThreshold
            }
          });

          try {
            db.updateProductStock(numericId, {
              isAvailable: nextAvailable,
              stock: nextStock,
              trackStock: nextTrackStock,
              criticalThreshold: nextThreshold
            });
          } catch {}

          orm.executePrepared(
            'Product',
            'UPDATE',
            'UPDATE "products" SET "stock" = $1, "is_available" = $2, "updated_at" = NOW() WHERE "id" = $3 RETURNING *',
            [nextStock, nextAvailable, numericId],
            () => updatedPg.id
          );

          const refreshedProducts = await getAllProductsFromPgOrLocal();
          const summary = computeInventorySummary(refreshedProducts);

          await logUserActivity({
            req: request,
            action: 'STOCK_UPDATE',
            category: 'MENU',
            level: 'INFO',
            message: `"${updatedPg.name}" stoku güncellendi: ${nextStock} adet (Satış: ${nextAvailable ? 'Açık' : 'Kapalı'})`,
            details: {
              productId: numericId,
              name: updatedPg.name,
              stock: nextStock,
              isAvailable: nextAvailable
            }
          });

          return jsonSuccess({
            message: `"${updatedPg.name}" stok durumu güncellendi.`,
            data: formatPrismaProduct(updatedPg),
            products: refreshedProducts,
            summary
          });
        }
      } catch (err) {
        console.error('Inventory single update PG fallback:', err);
      }
    }

    // Fallback: local product stock update
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
      const refreshedProducts = await getAllProductsFromPgOrLocal();
      const summary = computeInventorySummary(refreshedProducts);

      await logUserActivity({
        req: request,
        action: 'STOCK_UPDATE',
        category: 'MENU',
        level: 'INFO',
        message: `"${updated.name}" stoku güncellendi: ${updated.stock} adet (Satış: ${updated.isAvailable ? 'Açık' : 'Kapalı'})`,
        details: {
          productId: safeId,
          name: updated.name,
          stock: updated.stock,
          isAvailable: updated.isAvailable
        }
      });

      return jsonSuccess({
        message: `"${updated.name}" stok durumu güncellendi.`,
        data: updated,
        products: refreshedProducts,
        summary
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
      const refreshedProducts = await getAllProductsFromPgOrLocal();
      return jsonSuccess({
        message: 'Malzeme stoğu güncellendi.',
        data: updatedIng,
        products: refreshedProducts,
        summary: computeInventorySummary(refreshedProducts)
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

    const newProduct = await prisma.product.create({
      data: {
        name,
        category,
        price: Number(price.toFixed(2)),
        stock,
        isAvailable,
        trackStock: true,
        criticalThreshold: 5
      }
    });

    await logUserActivity({
      req: request,
      action: 'PRODUCT_ADD',
      category: 'MENU',
      level: 'INFO',
      message: `Envantere yeni ürün eklendi: "${newProduct.name}" (${newProduct.price} ₺, Stok: ${newProduct.stock})`,
      details: { productId: newProduct.id, name: newProduct.name, price: newProduct.price }
    });

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
    const targetId = !Number.isNaN(Number(id)) ? Number(id) : id;
    try {
      await prisma.product.delete({ where: { id: targetId } });
    } catch (pgErr) {
      console.warn('Prisma delete product inventory warning:', pgErr?.message);
    }
    try {
      db.deleteProduct(targetId);
    } catch {}

    await logUserActivity({
      req: request,
      action: 'PRODUCT_DELETE',
      category: 'MENU',
      level: 'WARN',
      message: `Envanterden ürün silindi: ID #${id}`,
      details: { productId: id }
    });

    const refreshedProducts = await getAllProductsFromPgOrLocal();
    return jsonSuccess({
      message: 'Ürün silindi.',
      products: refreshedProducts,
      summary: computeInventorySummary(refreshedProducts)
    });
  } catch (error) {
    return handleApiError(error, '/api/inventory', request);
  }
}
