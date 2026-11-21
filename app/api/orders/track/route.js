import { db } from '@/lib/db';
import { rawPrisma, formatPrismaOrder } from '@/lib/prisma';
import {
  NotFoundError,
  ValidationError,
  handleApiError,
  jsonSuccess,
  parseJsonBody
} from '@/lib/security/errors';
import { checkRateLimit } from '@/lib/security/auth';
import { sanitizeText } from '@/lib/security/validation';

export const dynamic = 'force-dynamic';

// Telefon karşılaştırması: son 10 hane (0 / +90 ön ekinden bağımsız)
function phoneKey(value) {
  return String(value || '').replace(/\D/g, '').slice(-10);
}

const NOT_FOUND_MESSAGE =
  'Bu sipariş numarası ve telefon numarasıyla eşleşen bir sipariş bulunamadı. Bilgileri kontrol edip tekrar deneyin.';

/**
 * Misafir sipariş sorgulama.
 * Güvenlik: Sipariş numarası VE siparişte kullanılan telefon numarası birlikte eşleşmelidir.
 * Eşleşmeyen her durumda aynı genel mesaj döner (numara tahmini/enumeration engellenir).
 */
export async function POST(request) {
  try {
    checkRateLimit(request, {
      keyPrefix: 'POST:/api/orders/track',
      maxRequests: 10,
      windowMs: 60 * 1000
    });

    const body = await parseJsonBody(request);
    const rawOrderNo = sanitizeText(body.orderNo || '', 32, 'orderNo', '/api/orders/track')
      .replace(/^#/, '')
      .trim()
      .toUpperCase();
    const inputPhone = phoneKey(body.phone);

    if (!rawOrderNo || rawOrderNo.length < 3) {
      throw new ValidationError('Lütfen geçerli bir sipariş numarası girin (Örn: SD-1234).');
    }
    if (inputPhone.length !== 10) {
      throw new ValidationError('Lütfen siparişte kullandığınız telefon numarasını eksiksiz girin.');
    }

    const candidates = Array.from(new Set([rawOrderNo, rawOrderNo.startsWith('SD-') ? rawOrderNo : `SD-${rawOrderNo}`]));

    let order = null;
    try {
      const pgOrder = await rawPrisma.order.findFirst({
        where: {
          OR: candidates.flatMap((c) => [
            { orderNumber: { equals: c, mode: 'insensitive' } },
            { id: { equals: c, mode: 'insensitive' } }
          ])
        },
        include: { items: true, statusHistory: true }
      });
      if (pgOrder) order = formatPrismaOrder(pgOrder);
    } catch {
      order = null;
    }

    if (!order) {
      for (const c of candidates) {
        try {
          const local = db.getOrderById(c);
          if (local) {
            order = local;
            break;
          }
        } catch {}
      }
    }

    if (!order || phoneKey(order.customerPhone || order.phone) !== inputPhone) {
      throw new NotFoundError(NOT_FOUND_MESSAGE);
    }

    return jsonSuccess({ data: order });
  } catch (error) {
    return handleApiError(error, '/api/orders/track', request);
  }
}
