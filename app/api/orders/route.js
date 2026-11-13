import { db } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import {
  AuthenticationError,
  handleApiError,
  jsonSuccess,
  parseJsonBody
} from '@/lib/security/errors';
import { checkRateLimit } from '@/lib/security/auth';
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

    let orders = await prisma.order.findMany();

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

    const body = await parseJsonBody(request);
    const pgProducts = await prisma.product.findMany();
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
