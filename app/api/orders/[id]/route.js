import { db } from '@/lib/db';
import { rawPrisma, formatPrismaOrder } from '@/lib/prisma';
import { orm } from '@/lib/orm/postgresEngine';
import { logUserActivity } from '@/lib/activityLogger';
import {
  AuthorizationError,
  NotFoundError,
  ValidationError,
  handleApiError,
  jsonSuccess,
  parseJsonBody
} from '@/lib/security/errors';
import { assertProtectedApiAccess, getOptionalAuthFromRequest, verifyPassword } from '@/lib/security/auth';
import { sanitizeText } from '@/lib/security/validation';

const VALID_ORDER_STATUSES = [
  'Yeni',
  'Görüntülendi',
  'Onaylandı',
  'Hazırlanıyor',
  'Hazır',
  'Kurye Teslim Aldı',
  'Yolda',
  'Teslim Edildi',
  'İptal Edildi'
];

function getDefaultStatusNote(status) {
  const notes = {
    'Görüntülendi': 'Sipariş yetkili tarafından görüntülendi.',
    'Onaylandı': 'Sipariş onaylandı ve mutfak sırasına alındı.',
    'Hazırlanıyor': 'Mutfakta hazırlanmaya başlandı.',
    'Hazır': 'Sipariş hazırlandı ve paketlendi, kurye bekliyor.',
    'Kurye Teslim Aldı': 'Kurye paketi teslim aldı.',
    'Yolda': 'Kurye teslimat için yola çıktı.',
    'Teslim Edildi': 'Sipariş müşteriye teslim edildi ve kapıda ödeme tahsil edildi.',
    'İptal Edildi': 'Sipariş iptal edildi.'
  };
  return notes[status] || `Durum "${status}" olarak güncellendi.`;
}

async function findOrderInPg(idOrNumber) {
  try {
    return await rawPrisma.order.findFirst({
      where: {
        OR: [{ id: idOrNumber }, { orderNumber: idOrNumber }]
      },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, recipe: true }
            }
          }
        },
        statusHistory: true
      }
    });
  } catch {
    return null;
  }
}

export async function GET(request, { params }) {
  try {
    assertProtectedApiAccess(request, { allowCustomerScoped: true, endpoint: '/api/orders/[id]' });
    const resolvedParams = await params;
    const id = sanitizeText(resolvedParams.id, 64, 'id', '/api/orders/[id]');

    const pgOrder = await findOrderInPg(id);
    if (pgOrder) {
      orm.executePrepared(
        'Order',
        'SELECT',
        'SELECT * FROM "orders" WHERE "id" = $1 OR "order_number" = $2 LIMIT 1',
        [id, id],
        () => pgOrder.id
      );
      return jsonSuccess({ data: formatPrismaOrder(pgOrder) });
    }

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
    assertProtectedApiAccess(request, { allowCustomerScoped: true, endpoint: '/api/orders/[id]' });
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
    const paymentMethodInput = body.paymentMethod
      ? sanitizeText(body.paymentMethod, 64, 'paymentMethod', '/api/orders/[id]')
      : null;

    const pgOrder = await findOrderInPg(id);

    // 1. View action
    if (action === 'view') {
      if (pgOrder) {
        const shouldMoveToViewed = pgOrder.status === 'Yeni';
        const updatedPg = await rawPrisma.order.update({
          where: { id: pgOrder.id },
          data: {
            isViewed: true,
            viewedAt: pgOrder.viewedAt || new Date(),
            viewedBy: pgOrder.viewedBy || user,
            ...(shouldMoveToViewed
              ? {
                  status: 'Görüntülendi',
                  statusHistory: {
                    create: {
                      status: 'Görüntülendi',
                      user,
                      note: 'Sipariş yetkili tarafından görüntülendi, onay bekliyor.'
                    }
                  }
                }
              : {})
          },
          include: { items: true, statusHistory: true }
        });

        try {
          db.viewOrder(id, user);
        } catch {}

        orm.executePrepared(
          'Order',
          'UPDATE',
          'UPDATE "orders" SET "is_viewed" = TRUE, "viewed_at" = NOW(), "viewed_by" = $1 WHERE "id" = $2 RETURNING *',
          [user, pgOrder.id],
          () => updatedPg.id
        );

        return jsonSuccess({
          message: 'Sipariş görüntülendi olarak işaretlendi.',
          data: formatPrismaOrder(updatedPg)
        });
      }

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
      if (pgOrder) {
        if (pgOrder.status === 'İptal Edildi') {
          throw new ValidationError('İptal edilmiş sipariş teslim edilemez.');
        }
        const actorName = courierName || user || 'Kurye';
        const updatedPg = await rawPrisma.order.update({
          where: { id: pgOrder.id },
          data: {
            status: 'Teslim Edildi',
            paymentStatus: 'Ödendi',
            isViewed: true,
            deliveredBy: actorName,
            deliveredAt: new Date(),
            courierName: pgOrder.courierName || actorName,
            ...(paymentCollectedMethod ? { paymentMethod: paymentCollectedMethod } : {}),
            statusHistory: {
              create: {
                status: 'Teslim Edildi',
                user: `Kurye (${actorName})`,
                note: `Sipariş müşteriye teslim edildi ve kapıda ödeme (${paymentCollectedMethod || pgOrder.paymentMethod}) tahsil edildi.`
              }
            }
          },
          include: { items: true, statusHistory: true }
        });

        try {
          db.completeDeliveryByCourier(id, actorName, paymentCollectedMethod);
        } catch {}

        await logUserActivity({
          user: { name: actorName, role: 'Kurye' },
          action: 'ORDER_STATUS_UPDATE',
          category: 'ORDER',
          level: 'INFO',
          message: `#${pgOrder.orderNumber || id} sipariş teslim edildi ve tahsilat tamamlandı.`,
          details: { orderId: id, status: 'Teslim Edildi', paymentCollectedMethod },
          req: request
        });

        return jsonSuccess({
          message: 'Sipariş teslim edildi ve ödeme tahsilatı tamamlandı.',
          data: formatPrismaOrder(updatedPg)
        });
      }

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

      await logUserActivity({
        user: { name: courierName || user || 'Kurye', role: 'Kurye' },
        action: 'ORDER_STATUS_UPDATE',
        category: 'ORDER',
        level: 'INFO',
        message: `#${deliveredOrder.orderNumber || id} sipariş teslim edildi ve tahsilat tamamlandı.`,
        details: { orderId: id, status: 'Teslim Edildi', paymentCollectedMethod },
        req: request
      });

      return jsonSuccess({
        message: 'Sipariş teslim edildi ve ödeme tahsilatı tamamlandı.',
        data: deliveredOrder
      });
    }

    // 2b. Update Payment Method (Kurye tarafından kapıda ödeme şekli değişikliği)
    if (action === 'update_payment_method') {
      const allowedMethods = ['Kapıda Nakit', 'Kapıda Kart'];
      const nextMethod = paymentMethodInput || paymentCollectedMethod;
      if (!nextMethod || !allowedMethods.includes(nextMethod)) {
        throw new ValidationError('Geçerli bir ödeme şekli seçilmelidir (Kapıda Nakit veya Kapıda Kart).');
      }
      const actorName = courierName || user || 'Kurye';
      if (pgOrder) {
        if (pgOrder.status === 'İptal Edildi') {
          throw new ValidationError('İptal edilmiş siparişin ödeme şekli değiştirilemez.');
        }
        const updatedPg = await rawPrisma.order.update({
          where: { id: pgOrder.id },
          data: {
            paymentMethod: nextMethod,
            statusHistory: {
              create: {
                status: pgOrder.status,
                user: `Kurye (${actorName})`,
                note: `Ödeme şekli "${nextMethod}" olarak güncellendi.`
              }
            }
          },
          include: { items: true, statusHistory: true }
        });

        return jsonSuccess({
          message: `Ödeme şekli "${nextMethod}" olarak güncellendi.`,
          data: formatPrismaOrder(updatedPg)
        });
      }

      const memOrder = db.getOrderById(id);
      if (!memOrder) {
        throw new NotFoundError('Sipariş bulunamadı.');
      }
      memOrder.paymentMethod = nextMethod;
      return jsonSuccess({
        message: `Ödeme şekli "${nextMethod}" olarak güncellendi.`,
        data: memOrder
      });
    }

    // 3. Courier Assignment
    if (action === 'assign_courier' || (!action && typeof courierName !== 'undefined' && !status)) {
      if (pgOrder) {
        const updatedPg = await rawPrisma.order.update({
          where: { id: pgOrder.id },
          data: {
            courierName: courierName || null,
            statusHistory: {
              create: {
                status: pgOrder.status,
                user,
                note: courierName
                  ? `Sipariş kuryeye (${courierName}) atandı.`
                  : 'Kurye ataması kaldırıldı.'
              }
            }
          },
          include: { items: true, statusHistory: true }
        });

        try {
          db.updateCourier(id, courierName, user);
        } catch {}

        await logUserActivity({
          user: { name: user || 'Yetkili' },
          action: 'COURIER_ASSIGN',
          category: 'ORDER',
          level: 'INFO',
          message: courierName
            ? `#${pgOrder.orderNumber || id} siparişi "${courierName}" adlı kuryeye atandı.`
            : `#${pgOrder.orderNumber || id} siparişinin kurye ataması kaldırıldı.`,
          details: { orderId: id, courierName },
          req: request
        });

        return jsonSuccess({
          message: courierName ? `Kurye (${courierName}) atandı.` : 'Kurye ataması güncellendi.',
          data: formatPrismaOrder(updatedPg)
        });
      }

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

      await logUserActivity({
        user: { name: user || 'Yetkili' },
        action: 'COURIER_ASSIGN',
        category: 'ORDER',
        level: 'INFO',
        message: courierName
          ? `#${updated.orderNumber || id} siparişi "${courierName}" adlı kuryeye atandı.`
          : `#${updated.orderNumber || id} siparişinin kurye ataması kaldırıldı.`,
        details: { orderId: id, courierName },
        req: request
      });

      return jsonSuccess({
        message: courierName ? `Kurye (${courierName}) atandı.` : 'Kurye ataması güncellendi.',
        data: updated
      });
    }

    // 3.1. Set Estimated Arrival Time (ETA) by Courier
    const eta = body.courierEta || body.estimatedDeliveryTime
      ? sanitizeText(body.courierEta || body.estimatedDeliveryTime, 64, 'courierEta', '/api/orders/[id]')
      : null;

    if (action === 'set_eta' || (eta && !status && typeof courierName === 'undefined' && !paymentStatus)) {
      const actorName = courierName || user || 'Kurye';
      if (pgOrder) {
        const updatedPg = await rawPrisma.order.update({
          where: { id: pgOrder.id },
          data: {
            updatedAt: new Date(),
            statusHistory: {
              create: {
                status: pgOrder.status,
                user: `Kurye (${actorName})`,
                note: `⏱️ Tahmini Varış Süresi: ${eta} olarak güncellendi.`
              }
            }
          },
          include: { items: true, statusHistory: true }
        });

        try {
          db.updateCourierEta(id, eta, actorName);
        } catch {}

        const formatted = formatPrismaOrder(updatedPg);
        formatted.courierEta = eta;
        formatted.estimatedDeliveryTime = eta;

        return jsonSuccess({
          message: `Tahmini varış süresi (${eta}) müşteriye bildirildi.`,
          data: formatted
        });
      }

      const updated = db.updateCourierEta(id, eta, actorName);
      if (!updated) {
        throw new NotFoundError('Sipariş bulunamadı.');
      }
      return jsonSuccess({
        message: `Tahmini varış süresi (${eta}) müşteriye bildirildi.`,
        data: updated
      });
    }

    // 4. Payment Status Update
    if (paymentStatus && !status) {
      if (pgOrder) {
        const updatedPg = await rawPrisma.order.update({
          where: { id: pgOrder.id },
          data: {
            paymentStatus,
            statusHistory: {
              create: {
                status: pgOrder.status,
                user,
                note: `Ödeme durumu güncellendi: ${paymentStatus}`
              }
            }
          },
          include: { items: true, statusHistory: true }
        });

        try {
          db.updatePaymentStatus(id, paymentStatus, user);
        } catch {}

        return jsonSuccess({
          message: `Ödeme durumu "${paymentStatus}" olarak güncellendi.`,
          data: formatPrismaOrder(updatedPg)
        });
      }

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

      await logUserActivity({
        user: { name: user || 'Yetkili' },
        action: 'PAYMENT_UPDATE',
        category: 'ORDER',
        level: 'INFO',
        message: `#${updated.orderNumber || id} siparişinin ödeme durumu "${paymentStatus}" olarak güncellendi.`,
        details: { orderId: id, paymentStatus },
        req: request
      });

      return jsonSuccess({
        message: `Ödeme durumu "${paymentStatus}" olarak güncellendi.`,
        data: updated
      });
    }

    // 5. Order Status State Machine Transition
    if (!status) {
      throw new ValidationError('Yeni sipariş durumu (status) veya işlem tipi (action) belirtilmelidir.');
    }

    if (!VALID_ORDER_STATUSES.includes(status)) {
      throw new ValidationError(`Geçersiz sipariş durumu: "${status}".`);
    }

    if (pgOrder) {
      if (pgOrder.status === status) {
        return jsonSuccess({
          message: `Sipariş durumu zaten "${status}".`,
          data: formatPrismaOrder(pgOrder)
        });
      }

      if (pgOrder.status === 'Teslim Edildi' || pgOrder.status === 'İptal Edildi') {
        throw new ValidationError(
          `Tamamlanmış veya iptal edilmiş siparişlerin durumu değiştirilemez (Mevcut: ${pgOrder.status}).`
        );
      }

      const historyNote = reason
        ? `İptal Sebebi: ${reason}`
        : note || getDefaultStatusNote(status);

      const updateData = {
        status,
        isViewed: true,
        viewedAt: pgOrder.viewedAt || new Date(),
        viewedBy: pgOrder.viewedBy || user,
        ...(status === 'Teslim Edildi'
          ? {
              paymentStatus: 'Ödendi',
              deliveredAt: pgOrder.deliveredAt || new Date()
            }
          : {}),
        ...(status === 'İptal Edildi'
          ? {
              cancellationReason: reason || note || 'Belirtilmedi',
              ...(pgOrder.paymentStatus === 'Ödendi' ? { paymentStatus: 'İade Edildi' } : {})
            }
          : {}),
        statusHistory: {
          create: {
            status,
            user,
            note: historyNote
          }
        }
      };

      const updatedPg = await rawPrisma.order.update({
        where: { id: pgOrder.id },
        data: updateData,
        include: { items: true, statusHistory: true }
      });

      // Restore product stock in Supabase if cancelled
      if (status === 'İptal Edildi' && Array.isArray(pgOrder.items)) {
        for (const item of pgOrder.items) {
          if (item.productId) {
            try {
              const prod = await rawPrisma.product.findUnique({ where: { id: item.productId } });
              if (prod && prod.trackStock) {
                const newStock = (Number(prod.stock) || 0) + (Number(item.quantity) || 1);
                await rawPrisma.product.update({
                  where: { id: prod.id },
                  data: {
                    stock: newStock,
                    ...(newStock > 0 ? { isAvailable: true } : {})
                  }
                });
              }
            } catch {}
          }
        }
      }

      try {
        db.updateOrderStatus(id, status, user, note, reason);
      } catch {}

      orm.executePrepared(
        'Order',
        'TRANSACTION',
        'BEGIN; UPDATE "orders" SET "status" = $1, "updated_at" = NOW() WHERE "id" = $2; INSERT INTO "order_status_history" ("order_id", "status", "user", "note") VALUES ($3, $4, $5, $6); COMMIT;',
        [status, pgOrder.id, pgOrder.id, status, user, historyNote],
        () => updatedPg.id
      );

      await logUserActivity({
        user: { name: user || 'Personel' },
        action: 'ORDER_STATUS_UPDATE',
        category: 'ORDER',
        level: status === 'İptal Edildi' ? 'WARN' : 'INFO',
        message: `#${pgOrder.orderNumber || id} sipariş durumu "${status}" yapıldı${reason ? ` (Gerekçe: ${reason})` : ''}`,
        details: { orderId: id, status, note, reason },
        req: request
      });

      return jsonSuccess({
        message: `Sipariş durumu "${status}" olarak güncellendi.`,
        data: formatPrismaOrder(updatedPg)
      });
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

    await logUserActivity({
      user: { name: user || 'Personel' },
      action: 'ORDER_STATUS_UPDATE',
      category: 'ORDER',
      level: status === 'İptal Edildi' ? 'WARN' : 'INFO',
      message: `#${updatedOrder.orderNumber || id} sipariş durumu "${status}" yapıldı${reason ? ` (Gerekçe: ${reason})` : ''}`,
      details: { orderId: id, status, note, reason },
      req: request
    });

    return jsonSuccess({
      message: `Sipariş durumu "${status}" olarak güncellendi.`,
      data: updatedOrder
    });
  } catch (error) {
    return handleApiError(error, '/api/orders/[id]', request);
  }
}

async function notifyUserOrderDeleted(orderObj) {
  if (!orderObj) return;
  const userEmail = String(orderObj.userEmail || '').trim().toLowerCase();
  const userId = String(orderObj.userId || '').trim();
  if (!userEmail && !userId) return;

  const orderNo = orderObj.orderNumber || orderObj.id;
  const notifItem = {
    id: `ord_del_${orderObj.id}_${Date.now()}`,
    orderId: orderObj.id,
    title: '❌ Siparişiniz İptal Edilmiştir',
    message: `#${orderNo} numaralı siparişiniz iptal edilmiştir.`,
    type: 'warning',
    scope: 'personal',
    targetPage: 'profile_orders',
    createdAt: new Date().toISOString()
  };

  try {
    if (rawPrisma && rawPrisma.user) {
      const pgUser = await rawPrisma.user.findFirst({
        where: {
          OR: [
            ...(userEmail ? [{ email: { equals: userEmail, mode: 'insensitive' } }] : []),
            ...(userId ? [{ id: userId }] : [])
          ]
        },
        select: { id: true, notifications: true }
      });

      if (pgUser) {
        const prev = Array.isArray(pgUser.notifications) ? pgUser.notifications : [];
        await rawPrisma.user.update({
          where: { id: pgUser.id },
          data: { notifications: [notifItem, ...prev].slice(0, 50) }
        });
      }
    }
  } catch (err) {
    console.warn('Order delete notification error:', err.message);
  }
}

export async function DELETE(request, { params }) {
  try {
    const resolvedParams = await params;
    const id = sanitizeText(resolvedParams.id, 64, 'id', '/api/orders/[id]');

    let password = '';
    let supervisorEmail = '';
    let restoreStock = true;
    try {
      const body = await request.json();
      password = body.password || body.supervisorPassword || '';
      supervisorEmail = body.supervisorEmail || '';
      if (typeof body.restoreStock === 'boolean') {
        restoreStock = body.restoreStock;
      }
    } catch {
      // Allow query param or Authorization header fallback
    }

    const { searchParams } = new URL(request.url);
    if (!password) {
      password = searchParams.get('password') || searchParams.get('supervisorPassword') || '';
    }
    if (!supervisorEmail) {
      supervisorEmail = searchParams.get('supervisorEmail') || '';
    }

    const jwtPayload = getOptionalAuthFromRequest(request);
    const hasJwtPermission =
      jwtPayload &&
      jwtPayload.type === 'admin' &&
      Array.isArray(jwtPayload.permissions) &&
      jwtPayload.permissions.includes('delete_order');

    let approverInfo = null;

    if (hasJwtPermission) {
      // İstek yapan personelin kendi JWT oturumunda delete_order yetkisi var
      approverInfo = {
        type: 'self',
        name: jwtPayload.name || jwtPayload.email || 'Yetkili Personel',
        role: jwtPayload.role || 'Yönetici'
      };
    } else {
      // İstek yapan personelin delete_order yetkisi YOK!
      // Bu durumda gerçek bir Restoran Müdürü veya Yönetici şifresi doğrulanması zorunludur.
      const cleanPass = (password || '').trim();
      if (!cleanPass) {
        throw new AuthorizationError(
          'Bu personel hesabının sipariş silme yetkisi bulunmamaktadır. Siparişi silmek için lütfen Restoran Müdürü veya Yönetici onay şifresini giriniz.'
        );
      }

      // 1. Yerel veritabanında yetkili yönetici şifre kontrolü
      let authorizedManager = db.verifyAdminActionPassword(cleanPass, 'delete_order', supervisorEmail);

      // 2. PostgreSQL Prisma veritabanında yetkili yönetici şifre kontrolü
      if (!authorizedManager) {
        try {
          const whereClause = { isActive: true };
          if (supervisorEmail) {
            whereClause.email = supervisorEmail.toLowerCase();
          }
          const pgAdmins = await rawPrisma.adminUser.findMany({
            where: whereClause,
            include: { role: true }
          });
          for (const adm of pgAdmins) {
            if (verifyPassword(cleanPass, adm.passHash || adm.passwordHash)) {
              const isSuper = adm.roleId === 'role_super_admin' || String(adm.email || '').toLowerCase() === 'admin';
              const perms = Array.isArray(adm.role?.permissions) ? adm.role.permissions : [];
              if (isSuper || perms.includes('delete_order')) {
                authorizedManager = {
                  id: adm.id,
                  name: adm.name || adm.email,
                  email: adm.email,
                  roleName: isSuper ? 'Süper Yönetici' : (adm.role?.name || 'Restoran Müdürü')
                };
                break;
              }
            }
          }
        } catch {}
      }

      if (!authorizedManager) {
        throw new AuthorizationError(
          'Yetkisiz işlem: Girilen onay şifresi hatalı veya sipariş silme yetkisine sahip bir Restoran Müdürü / Yöneticiye ait değil!'
        );
      }

      approverInfo = {
        type: 'supervisor',
        name: authorizedManager.name,
        role: authorizedManager.roleName
      };
    }

    const pgOrder = await findOrderInPg(id);
    if (pgOrder) {
      if (restoreStock && pgOrder.status !== 'İptal Edildi' && Array.isArray(pgOrder.items)) {
        for (const item of pgOrder.items) {
          if (item.productId) {
            try {
              const prod = await rawPrisma.product.findUnique({ where: { id: item.productId } });
              if (prod && prod.trackStock) {
                const newStock = (Number(prod.stock) || 0) + (Number(item.quantity) || 1);
                await rawPrisma.product.update({
                  where: { id: prod.id },
                  data: {
                    stock: newStock,
                    ...(newStock > 0 ? { isAvailable: true } : {})
                  }
                });
              }
            } catch {}
          }
        }
      }

      await notifyUserOrderDeleted(pgOrder);
      await rawPrisma.order.delete({ where: { id: pgOrder.id } });

      try {
        db.deleteOrder(id, restoreStock);
      } catch {}

      orm.executePrepared(
        'Order',
        'DELETE',
        'DELETE FROM "orders" WHERE "id" = $1 OR "order_number" = $2 RETURNING *',
        [id, id],
        () => pgOrder.id
      );

      const successMsg =
        approverInfo?.type === 'supervisor'
          ? `Sipariş #${pgOrder.orderNumber || id}, ${approverInfo.role} (${approverInfo.name}) onayıyla kalıcı olarak silindi.`
          : `Sipariş #${pgOrder.orderNumber || id} kalıcı olarak silindi.`;

      await logUserActivity({
        user: { name: approverInfo?.name, role: approverInfo?.role },
        action: 'ORDER_DELETE',
        category: 'ORDER',
        level: 'WARN',
        message: successMsg,
        details: { orderId: id, approver: approverInfo, restoreStock },
        req: request
      });

      return jsonSuccess({
        message: successMsg,
        data: formatPrismaOrder(pgOrder)
      });
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

    await notifyUserOrderDeleted(deletedOrder);

    const successMsg =
      approverInfo?.type === 'supervisor'
        ? `Sipariş #${deletedOrder.orderNumber || id}, ${approverInfo.role} (${approverInfo.name}) onayıyla kalıcı olarak silindi.`
        : `Sipariş #${deletedOrder.orderNumber || id} kalıcı olarak silindi.`;

    await logUserActivity({
      user: { name: approverInfo?.name, role: approverInfo?.role },
      action: 'ORDER_DELETE',
      category: 'ORDER',
      level: 'WARN',
      message: successMsg,
      details: { orderId: id, approver: approverInfo, restoreStock },
      req: request
    });

    return jsonSuccess({
      message: successMsg,
      data: deletedOrder
    });
  } catch (error) {
    return handleApiError(error, '/api/orders/[id]', request);
  }
}
