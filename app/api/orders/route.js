import { db } from '@/lib/db';
import { prisma, rawPrisma } from '@/lib/prisma';
import { getOrderPauseState, formatOrderPauseMessage } from '@/lib/orderPause';
import {
  getCachedProducts,
  setCachedProducts,
  getCachedOrders,
  setCachedOrders,
  invalidateOrdersCache,
  getCachedAdminSettings,
  setCachedAdminSettings
} from '@/lib/productCache';
import { logUserActivity } from '@/lib/activityLogger';
import {
  AuthenticationError,
  ValidationError,
  handleApiError,
  jsonSuccess,
  parseJsonBody
} from '@/lib/security/errors';
import {
  assertProtectedApiAccess,
  buildAuthCookieHeader,
  checkRateLimit,
  signJwtToken
} from '@/lib/security/auth';
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
    const limitParam = searchParams.get('limit');

    if (status) assertNoSqlInjection(status, 'status', '/api/orders');
    if (phone) assertNoSqlInjection(phone, 'phone', '/api/orders');
    if (orderNo) assertNoSqlInjection(orderNo, 'orderNo', '/api/orders');
    if (userEmail) assertNoSqlInjection(userEmail, 'userEmail', '/api/orders');

    const isCustomerFilteredQuery = Boolean(userEmail || orderNo || phone);
    const auth = assertProtectedApiAccess(request, {
      allowCustomerScoped: isCustomerFilteredQuery,
      endpoint: '/api/orders'
    });

    const isCustomerActor = auth?.type === 'customer';
    const effectiveUserEmail = isCustomerActor
      ? String(auth.email || '').trim().toLowerCase()
      : userEmail
      ? userEmail.trim().toLowerCase()
      : '';
    const effectiveStatus = status ? status.trim() : '';
    const effectivePhone = isCustomerActor ? '' : phone || '';
    const effectiveOrderNo = isCustomerActor ? '' : orderNo || '';

    const parsedLimit = limitParam ? parseInt(limitParam, 10) : NaN;
    const takeLimit = Number.isFinite(parsedLimit)
      ? Math.max(1, Math.min(300, parsedLimit))
      : isCustomerFilteredQuery || isCustomerActor
      ? 50
      : 120;

    const cacheKey = `${effectiveStatus}|${effectivePhone}|${effectiveOrderNo}|${effectiveUserEmail}|${takeLimit}`;
    const cachedOrders = getCachedOrders(cacheKey);
    if (cachedOrders) {
      return jsonSuccess({
        count: cachedOrders.length,
        data: cachedOrders,
        cached: true
      });
    }

    const whereClause = {};
    if (effectiveUserEmail) {
      whereClause.userEmail = { equals: effectiveUserEmail, mode: 'insensitive' };
    }
    if (effectiveStatus) {
      whereClause.status = { equals: effectiveStatus, mode: 'insensitive' };
    }
    if (effectiveOrderNo) {
      const cleanNo = sanitizeText(effectiveOrderNo, 32, 'orderNo', '/api/orders').toUpperCase();
      whereClause.OR = [
        { orderNumber: { contains: cleanNo, mode: 'insensitive' } },
        { id: { contains: cleanNo, mode: 'insensitive' } }
      ];
    }

    let orders = await prisma.order.findMany({
      where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
      take: takeLimit
    });

    if (effectiveUserEmail) {
      orders = orders.filter(
        o => String(o.userEmail || '').trim().toLowerCase() === effectiveUserEmail
      );
    }

    if (effectiveStatus) {
      orders = orders.filter(o => o.status.toLowerCase() === effectiveStatus.toLowerCase());
    }
    if (effectivePhone) {
      const cleanPhone = effectivePhone.replace(/\D/g, '');
      orders = orders.filter(o => (o.customerPhone || '').replace(/\D/g, '').includes(cleanPhone));
    }
    if (effectiveOrderNo) {
      const cleanNo = sanitizeText(effectiveOrderNo, 32, 'orderNo', '/api/orders').toUpperCase();
      orders = orders.filter(
        o =>
          (o.orderNumber && o.orderNumber.toUpperCase().includes(cleanNo)) ||
          (o.id && String(o.id).toUpperCase().includes(cleanNo))
      );
    }

    setCachedOrders(cacheKey, orders);

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
      let cachedSettings = getCachedAdminSettings();
      if (!cachedSettings && rawPrisma && rawPrisma.systemSetting) {
        const rec = await rawPrisma.systemSetting.findUnique({ where: { key: 'admin_system_settings' } });
        if (rec?.value && typeof rec.value === 'object') {
          cachedSettings = rec.value;
          setCachedAdminSettings(cachedSettings);
        }
      }
      if (cachedSettings) {
        const pauseState = getOrderPauseState(cachedSettings);
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

    invalidateOrdersCache();

    void logUserActivity({
      user: { name: newOrder.userName || 'Müşteri', email: newOrder.userEmail || '' },
      action: 'ORDER_CREATE',
      category: 'ORDER',
      level: 'INFO',
      message: `Yeni sipariş oluşturuldu: #${newOrder.orderNumber || newOrder.id} (${newOrder.userName || 'Müşteri'} - ${newOrder.total} ₺)`,
      details: { orderId: newOrder.id, orderNumber: newOrder.orderNumber, total: newOrder.total },
      req: request
    }).catch(() => {});

    const response = jsonSuccess(
      {
        message: 'Siparişiniz başarıyla alındı ve mutfağa iletildi!',
        data: newOrder
      },
      201
    );

    if (isGuestOrder) {
      const guestToken = signJwtToken(
        {
          sub: `guest:${newOrder.id}`,
          email: validatedOrder.userEmail,
          name: validatedOrder.customerName,
          type: 'customer'
        },
        6
      );
      response.headers.append('Set-Cookie', buildAuthCookieHeader(guestToken, 'sd_auth_token', 6 * 3600));
    }

    return response;
  } catch (error) {
    return handleApiError(error, '/api/orders', request);
  }
}
