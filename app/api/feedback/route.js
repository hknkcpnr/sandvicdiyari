import { prisma } from '@/lib/prisma';
import {
  ConflictError,
  ValidationError,
  handleApiError,
  jsonSuccess,
  parseJsonBody
} from '@/lib/security/errors';
import { checkRateLimit, assertProtectedApiAccess } from '@/lib/security/auth';
import { sanitizeEmailOrUsername, sanitizeText } from '@/lib/security/validation';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    assertProtectedApiAccess(request, { endpoint: '/api/feedback' });
    checkRateLimit(request, {
      keyPrefix: 'GET:/api/feedback',
      maxRequests: 30,
      windowMs: 60 * 1000
    });

    const list = await prisma.feedback.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    return jsonSuccess({
      count: list.length,
      data: list
    });
  } catch (error) {
    return handleApiError(error, '/api/feedback', request);
  }
}

export async function DELETE(request) {
  try {
    assertProtectedApiAccess(request, { endpoint: '/api/feedback' });
    checkRateLimit(request, {
      keyPrefix: 'DELETE:/api/feedback',
      maxRequests: 10,
      windowMs: 60 * 1000
    });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      throw new ValidationError('Silinecek geri bildirim ID zorunludur.');
    }
    await prisma.feedback.delete({
      where: { id }
    });
    return jsonSuccess({
      message: 'Geri bildirim başarıyla silindi.'
    });
  } catch (error) {
    return handleApiError(error, '/api/feedback', request);
  }
}

export async function POST(request) {
  try {
    // 1. Kısa süreli çift gönderim / seri spam koruması (30 saniyede en fazla 1 istek)
    checkRateLimit(request, {
      keyPrefix: 'POST:/api/feedback:burst',
      maxRequests: 1,
      windowMs: 30 * 1000,
      blockDurationMs: 60 * 1000
    });

    // 2. Uzun süreli kötüye kullanım koruması (15 dakikada en fazla 3 bildirim)
    checkRateLimit(request, {
      keyPrefix: 'POST:/api/feedback:window',
      maxRequests: 3,
      windowMs: 15 * 60 * 1000,
      blockDurationMs: 15 * 60 * 1000
    });

    const body = await parseJsonBody(request);

    // Honeypot (bot) koruması
    if (body.website && String(body.website).trim() !== '') {
      throw new ValidationError('Geçersiz form gönderimi.');
    }

    const name = sanitizeText(body.name, 120, 'Ad Soyad', '/api/feedback');
    const email = sanitizeEmailOrUsername(body.email, false, '/api/feedback');
    const type = sanitizeText(body.type || 'Öneri / İstek', 64, 'Bildirim Türü', '/api/feedback');
    const message = sanitizeText(body.message, 1000, 'Mesaj', '/api/feedback');

    if (!name || !email || !message || message.length < 5) {
      throw new ValidationError('Ad, geçerli bir e-posta ve en az 5 karakterlik mesaj zorunludur.');
    }

    // Aynı geri bildirimin kısa sürede tekrar kaydedilmesini engelle
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const duplicate = await prisma.feedback.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        message: { equals: message, mode: 'insensitive' },
        createdAt: { gte: oneHourAgo }
      }
    });
    if (duplicate) {
      throw new ConflictError('Bu geri bildirim zaten iletildi. Lütfen tekrar göndermeyin.');
    }

    const feedback = await prisma.feedback.create({
      data: {
        name,
        email,
        type,
        message
      }
    });

    return jsonSuccess(
      {
        message: `Sayın ${name}, "${feedback.type}" konulu bildiriminiz incelenmek üzere ekibimize iletildi.`,
        data: feedback
      },
      201
    );
  } catch (error) {
    return handleApiError(error, '/api/feedback', request);
  }
}
