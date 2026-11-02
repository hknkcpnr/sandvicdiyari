import { prisma } from '@/lib/prisma';
import {
  ValidationError,
  handleApiError,
  jsonSuccess,
  parseJsonBody
} from '@/lib/security/errors';
import { checkRateLimit } from '@/lib/security/auth';
import { sanitizeText } from '@/lib/security/validation';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const getAll = searchParams.get('all') === 'true';

    // Normal müşteri sayfası için sadece ONAYLANMIŞ yorumları getir
    // Admin paneli için (all=true) tüm yorumları (onay bekleyenler dahil) getir
    const reviews = await prisma.review.findMany({
      where: getAll ? undefined : { isApproved: true }
    });

    return jsonSuccess({
      count: reviews.length,
      data: reviews
    });
  } catch (error) {
    return handleApiError(error, '/api/reviews', request);
  }
}

export async function POST(request) {
  try {
    checkRateLimit(request, {
      keyPrefix: 'POST:/api/reviews',
      maxRequests: 10,
      windowMs: 60 * 1000
    });

    const body = await parseJsonBody(request);
    const name = sanitizeText(body.name, 120, 'Ad Soyad', '/api/reviews');
    const comment = sanitizeText(body.comment, 600, 'Yorum', '/api/reviews');
    const location = sanitizeText(body.location || 'Torbalı, İzmir', 100, 'Konum', '/api/reviews');

    if (!name || name.length < 2 || !comment || comment.length < 3) {
      throw new ValidationError('Geçerli bir ad ve yorum metni zorunludur.');
    }

    const rating = Math.max(1, Math.min(5, parseInt(String(body.rating), 10) || 5));

    // Müşteriden gelen yeni değerlendirmeler ONAY BEKLİYOR olarak kaydedilir (isApproved: false)
    const review = await prisma.review.create({
      data: {
        name,
        rating,
        comment,
        location,
        isApproved: false
      }
    });

    return jsonSuccess(
      {
        message: 'Değerlendirmeniz alındı! Yönetici onayından sonra sitede yayınlanacaktır.',
        data: review
      },
      201
    );
  } catch (error) {
    return handleApiError(error, '/api/reviews', request);
  }
}

export async function PATCH(request) {
  try {
    const body = await parseJsonBody(request);
    const { id, isApproved } = body;

    if (!id || typeof isApproved !== 'boolean') {
      throw new ValidationError('Geçerli değerlendirme ID ve onay durumu (isApproved) zorunludur.');
    }

    const updated = await prisma.review.update({
      where: { id },
      data: { isApproved }
    });

    return jsonSuccess({
      message: isApproved ? 'Değerlendirme onaylandı ve sitede yayına alındı.' : 'Değerlendirme yayından kaldırıldı.',
      data: updated
    });
  } catch (error) {
    return handleApiError(error, '/api/reviews', request);
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      throw new ValidationError('Silinecek değerlendirme ID zorunludur.');
    }

    await prisma.review.delete({
      where: { id }
    });

    return jsonSuccess({
      message: 'Değerlendirme başarıyla silindi.'
    });
  } catch (error) {
    return handleApiError(error, '/api/reviews', request);
  }
}
