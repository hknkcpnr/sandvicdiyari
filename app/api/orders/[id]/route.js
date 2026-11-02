import { db } from '@/lib/db';
import { orm } from '@/lib/orm/postgresEngine';
import {
  AuthorizationError,
  NotFoundError,
  ValidationError,
  handleApiError,
  jsonSuccess,
  parseJsonBody
} from '@/lib/security/errors';
import { getOptionalAuthFromRequest } from '@/lib/security/auth';
import { sanitizeText } from '@/lib/security/validation';

export async function GET(request, { params }) {
  try {
    const resolvedParams = await params;
    const id = sanitizeText(resolvedParams.id, 64, 'id', '/api/orders/[id]');

    const order = orm.executePrepared(
      'Order',
      'SELECT',
      'SELECT * FROM "orders" WHERE "id" = $1 OR "order_number" = $2 LIMIT 1',
      [id, id],
      () => db.getOrderById(id)
    );

    if (!order) {
      throw new NotFoundError('Sipariş bulunamadı.');
    }

    return jsonSuccess({ data: order });
  } catch (error) {
    return handleApiError(error, '/api/orders/[id]', request);
  }
}

export async function PATCH(request, { params }) {
  try {
    const resolvedParams = await params;
    const id = sanitizeText(resolvedParams.id, 64, 'id', '/api/orders/[id]');
    const body = await parseJsonBody(request);

    const action = sanitizeText(body.action || '', 64, 'action', '/api/orders/[id]');
    const status = sanitizeText(body.status || '', 64, 'status', '/api/orders/[id]');
    const paymentStatus = sanitizeText(body.paymentStatus || '', 64, 'paymentStatus', '/api/orders/[id]');
    const courierName =
      typeof body.courierName !== 'undefined'
        ? sanitizeText(body.courierName, 120, 'courierName', '/api/orders/[id]')
        : undefined;
    const user = sanitizeText(body.user || 'Restoran Yetkilisi', 120, 'user', '/api/orders/[id]');
    const note = sanitizeText(body.note || '', 300, 'note', '/api/orders/[id]');
    const reason = sanitizeText(body.reason || '', 300, 'reason', '/api/orders/[id]');
    const paymentCollectedMethod = body.paymentCollectedMethod
      ? sanitizeText(body.paymentCollectedMethod, 64, 'paymentCollectedMethod', '/api/orders/[id]')
      : null;

    // 1. View action
    if (action === 'view') {
      const viewedOrder = orm.executePrepared(
        'Order',
        'UPDATE',
        'UPDATE "orders" SET "is_viewed" = TRUE, "viewed_at" = NOW(), "viewed_by" = $1 WHERE "id" = $2 RETURNING *',
        [user, id],
        () => db.viewOrder(id, user)
      );
      if (!viewedOrder) {
        throw new NotFoundError('Sipariş bulunamadı.');
      }
      return jsonSuccess({
        message: 'Sipariş görüntülendi olarak işaretlendi.',
        data: viewedOrder
      });
    }

    // 2. Courier Delivery Completion
    if (action === 'courier_deliver') {
      const deliveredOrder = orm.executePrepared(
        'Order',
        'UPDATE',
        'UPDATE "orders" SET "status" = \'Teslim Edildi\', "payment_status" = \'Ödendi\', "delivered_by" = $1, "delivered_at" = NOW() WHERE "id" = $2 RETURNING *',
        [courierName || user || 'Kurye', id],
        () => db.completeDeliveryByCourier(id, courierName || user || 'Kurye', paymentCollectedMethod)
      );
      if (!deliveredOrder) {
        throw new NotFoundError('Sipariş bulunamadı.');
      }
      return jsonSuccess({
        message: 'Sipariş teslim edildi ve ödeme tahsilatı tamamlandı.',
        data: deliveredOrder
      });
    }

    // 3. Courier Assignment
    if (action === 'assign_courier' || (typeof courierName !== 'undefined' && !status)) {
      const updated = orm.executePrepared(
        'Order',
        'UPDATE',
        'UPDATE "orders" SET "courier_name" = $1, "updated_at" = NOW() WHERE "id" = $2 RETURNING *',
        [courierName, id],
        () => db.updateCourier(id, courierName, user)
      );
      if (!updated) {
        throw new NotFoundError('Sipariş bulunamadı.');
      }
      return jsonSuccess({
        message: courierName ? `Kurye (${courierName}) atandı.` : 'Kurye ataması güncellendi.',
        data: updated
      });
    }

    // 4. Payment Status Update
    if (paymentStatus && !status) {
      const updated = orm.executePrepared(
        'Order',
        'UPDATE',
        'UPDATE "orders" SET "payment_status" = $1, "updated_at" = NOW() WHERE "id" = $2 RETURNING *',
        [paymentStatus, id],
        () => db.updatePaymentStatus(id, paymentStatus, user)
      );
      if (!updated) {
        throw new NotFoundError('Sipariş bulunamadı.');
      }
      return jsonSuccess({
        message: `Ödeme durumu "${paymentStatus}" olarak güncellendi.`,
        data: updated
      });
    }

    // 5. Order Status State Machine Transition
    if (!status) {
      throw new ValidationError('Yeni sipariş durumu (status) veya işlem tipi (action) belirtilmelidir.');
    }

    const updatedOrder = orm.executePrepared(
      'Order',
      'TRANSACTION',
      'BEGIN; UPDATE "orders" SET "status" = $1, "updated_at" = NOW() WHERE "id" = $2; INSERT INTO "order_status_history" ("order_id", "status", "user", "note") VALUES ($3, $4, $5, $6); COMMIT;',
      [status, id, id, status, user, note],
      () => db.updateOrderStatus(id, status, user, note, reason)
    );

    if (!updatedOrder) {
      throw new NotFoundError('Sipariş bulunamadı.');
    }

    return jsonSuccess({
      message: `Sipariş durumu "${status}" olarak güncellendi.`,
      data: updatedOrder
    });
  } catch (error) {
    return handleApiError(error, '/api/orders/[id]', request);
  }
}

export async function DELETE(request, { params }) {
  try {
    const resolvedParams = await params;
    const id = sanitizeText(resolvedParams.id, 64, 'id', '/api/orders/[id]');

    let password = '';
    let restoreStock = true;
    try {
      const body = await request.json();
      password = body.password || '';
      if (typeof body.restoreStock === 'boolean') {
        restoreStock = body.restoreStock;
      }
    } catch {
      // Allow query param or Authorization header fallback
    }

    const { searchParams } = new URL(request.url);
    if (!password) {
      password = searchParams.get('password') || '';
    }

    const jwtPayload = getOptionalAuthFromRequest(request);
    const hasJwtPermission =
      jwtPayload &&
      jwtPayload.type === 'admin' &&
      Array.isArray(jwtPayload.permissions) &&
      jwtPayload.permissions.includes('delete_order');

    const hasValidPassword = db.verifyAdminActionPassword(password, 'delete_order');

    if (!hasJwtPermission && !hasValidPassword) {
      throw new AuthorizationError(
        'Yetkisiz işlem: Yönetici şifresi hatalı veya sipariş silme yetkiniz bulunmuyor!'
      );
    }

    const deletedOrder = orm.executePrepared(
      'Order',
      'DELETE',
      'DELETE FROM "orders" WHERE "id" = $1 OR "order_number" = $2 RETURNING *',
      [id, id],
      () => db.deleteOrder(id, restoreStock)
    );

    if (!deletedOrder) {
      throw new NotFoundError('Silinecek sipariş bulunamadı.');
    }

    return jsonSuccess({
      message: `Sipariş #${deletedOrder.orderNumber || id} kalıcı olarak silindi.`,
      data: deletedOrder
    });
  } catch (error) {
    return handleApiError(error, '/api/orders/[id]', request);
  }
}
