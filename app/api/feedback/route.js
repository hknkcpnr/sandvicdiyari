import { prisma } from '@/lib/prisma';
import {
  ValidationError,
  handleApiError,
  jsonSuccess,
  parseJsonBody
} from '@/lib/security/errors';
import { checkRateLimit } from '@/lib/security/auth';
import { sanitizeEmailOrUsername, sanitizeText } from '@/lib/security/validation';

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
