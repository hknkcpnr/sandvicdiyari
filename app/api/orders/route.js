import { db } from '@/lib/db';
import { prisma, rawPrisma } from '@/lib/prisma';
import { getOrderPauseState, formatOrderPauseMessage } from '@/lib/orderPause';
import { getCachedProducts, setCachedProducts } from '@/lib/productCache';
import { logUserActivity } from '@/lib/activityLogger';
import {
  AuthenticationError,
  ValidationError,
  handleApiError,
  jsonSuccess,
  parseJsonBody
} from '@/lib/security/errors';
import { assertProtectedApiAccess, checkRateLimit } from '@/lib/security/auth';
import {
  assertNoSqlInjection,
  sanitizeText,
  validateAndPriceOrderPayload
} from '@/lib/security/validation';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const phone = searchParams.get('phone');
    const orderNo = searchParams.get('orderNo');
    const userEmail = searchParams.get('userEmail');

    if (status) assertNoSqlInjection(status, 'status', '/api/orders');
    if (phone) assertNoSqlInjection(phone, 'phone', '/api/orders');
    if (orderNo) assertNoSqlInjection(orderNo, 'orderNo', '/api/orders');
    if (userEmail) assertNoSqlInjection(userEmail, 'userEmail', '/api/orders');

    const isCustomerFilteredQuery = Boolean(userEmail || orderNo || phone);
    assertProtectedApiAccess(request, {
      allowCustomerScoped: isCustomerFilteredQuery,
      endpoint: '/api/orders'
    });

    const whereClause = {};
    if (userEmail) {
      whereClause.userEmail = { equals: userEmail.trim(), mode: 'insensitive' };
    }
    if (status) {
      whereClause.status = { equals: status.trim(), mode: 'insensitive' };
    }
    if (orderNo) {
      const cleanNo = sanitizeText(orderNo, 32, 'orderNo', '/api/orders').toUpperCase();
      whereClause.OR = [
        { orderNumber: { contains: cleanNo, mode: 'insensitive' } },
        { id: { contains: cleanNo, mode: 'insensitive' } }
      ];
    }

    let orders = await prisma.order.findMany({
      where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
      take: isCustomerFilteredQuery ? 50 : 300
    });

    if (userEmail) {
      const cleanUserEmail = userEmail.trim().toLowerCase();
      orders = orders.filter(o => String(o.userEmail || '').trim().toLowerCase() === cleanUserEmail);
    }

    if (status) {
      orders = orders.filter(o => o.status.toLowerCase() === status.toLowerCase());
    }
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      orders = orders.filter(o => (o.customerPhone || '').replace(/\D/g, '').includes(cleanPhone));
    }
    if (orderNo) {
      const cleanNo = sanitizeText(orderNo, 32, 'orderNo', '/api/orders').toUpperCase();
      orders = orders.filter(
        o =>
          (o.orderNumber && o.orderNumber.toUpperCase().includes(cleanNo)) ||
          (o.id && String(o.id).toUpperCase().includes(cleanNo))
      );
    }

    return jsonSuccess({
      count: orders.length,
      data: orders
    });
  } catch (error) {
    return handleApiError(error, '/api/orders', request);
  }
}

export async function POST(request) {
  try {
    checkRateLimit(request, {
      keyPrefix: 'POST:/api/orders',
      maxRequests: 25,
      windowMs: 60 * 1000
    });

    // Yönetici "Sipariş Alımını Durdur" dediyse yeni sipariş kabul edilmez (sunucu tarafı zorunlu kontrol)
    try {
      if (rawPrisma && rawPrisma.systemSetting) {
        const rec = await rawPrisma.systemSetting.findUnique({ where: { key: 'admin_system_settings' } });
        const pauseState = getOrderPauseState(rec?.value);
        if (pauseState.paused) {
          throw new ValidationError(formatOrderPauseMessage(pauseState));
        }
      }
    } catch (pauseErr) {
      if (pauseErr instanceof ValidationError) throw pauseErr;
      // Ayar okunamazsa sipariş akışını engelleme
    }

    const body = await parseJsonBody(request);
    let pgProducts = getCachedProducts('all:public');
    if (!pgProducts) {
      pgProducts = await prisma.product.findMany({
        select: {
          id: true,
          name: true,
          price: true,
          category: true,
          stock: true,
          trackStock: true,
          isAvailable: true,
          options: true
        }
      });
      if (Array.isArray(pgProducts) && pgProducts.length > 0) {
        setCachedProducts('all:public', pgProducts);
      }
    }
    const catalogProducts = Array.isArray(pgProducts) && pgProducts.length > 0 ? pgProducts : db.getProducts();

    // Server-side validation, XSS/SQLi sanitization, and authoritative price calculation
    const validatedOrder = validateAndPriceOrderPayload(body, catalogProducts, '/api/orders');

    // ÜYE VEYA MİSAFİR KONTROLÜ
    const isGuestOrder =
      Boolean(body.isGuest) ||
      (validatedOrder.userEmail && validatedOrder.userEmail.startsWith('misafir_'));

    if (!isGuestOrder) {
      const registeredMember = await prisma.user.findUnique({
        where: { email: validatedOrder.userEmail }
      });

      if (!registeredMember) {
        throw new AuthenticationError(
          'Üyelik olmadan kesinlikle sipariş verilemez! Lütfen önce üye girişi yapın veya misafir olarak devam edin.'
        );
      }

      const localMember = db.findUserByEmail(validatedOrder.userEmail);
      if (registeredMember.isBlocked || localMember?.isBlocked) {
        const reason = registeredMember.blockReason || localMember?.blockReason || 'Yönetici kısıtlaması';
        throw new AuthenticationError(`Hesabınız engellendiği için sipariş veremezsiniz! Sebep: ${reason}`);
      }
    }

    const newOrder = await prisma.order.create({
      data: validatedOrder
    });

    await logUserActivity({
      user: { name: newOrder.userName || 'Müşteri', email: newOrder.userEmail || '' },
      action: 'ORDER_CREATE',
      category: 'ORDER',
      level: 'INFO',
      message: `Yeni sipariş oluşturuldu: #${newOrder.orderNumber || newOrder.id} (${newOrder.userName || 'Müşteri'} - ${newOrder.total} ₺)`,
      details: { orderId: newOrder.id, orderNumber: newOrder.orderNumber, total: newOrder.total },
      req: request
    });

    return jsonSuccess(
      {
        message: 'Siparişiniz başarıyla alındı ve mutfağa iletildi!',
        data: newOrder
      },
      201
    );
  } catch (error) {
    return handleApiError(error, '/api/orders', request);
  }
}
