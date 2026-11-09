import { prisma } from '@/lib/prisma';
import {
  ValidationError,
  handleApiError,
  jsonSuccess,
  parseJsonBody
} from '@/lib/security/errors';
import { checkRateLimit } from '@/lib/security/auth';
import { sanitizeEmailOrUsername, sanitizeText } from '@/lib/security/validation';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
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
    checkRateLimit(request, {
      keyPrefix: 'POST:/api/feedback',
      maxRequests: 10,
      windowMs: 60 * 1000
    });

    const body = await parseJsonBody(request);
    const name = sanitizeText(body.name, 120, 'Ad Soyad', '/api/feedback');
    const email = sanitizeEmailOrUsername(body.email, false, '/api/feedback');
    const type = sanitizeText(body.type || 'Öneri / İstek', 64, 'Bildirim Türü', '/api/feedback');
    const message = sanitizeText(body.message, 1000, 'Mesaj', '/api/feedback');

    if (!name || !email || !message || message.length < 4) {
      throw new ValidationError('Ad, geçerli bir e-posta ve mesaj zorunludur.');
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
