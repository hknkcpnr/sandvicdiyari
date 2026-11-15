import { prisma } from '@/lib/prisma';
import {
  ConflictError,
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
    // 1. Kısa süreli çift gönderim / seri spam koruması (30 saniyede en fazla 1 istek)
    checkRateLimit(request, {
      keyPrefix: 'POST:/api/reviews:burst',
      maxRequests: 1,
      windowMs: 30 * 1000,
      blockDurationMs: 60 * 1000
    });

    // 2. Uzun süreli kötüye kullanım koruması (15 dakikada en fazla 3 değerlendirme)
    checkRateLimit(request, {
      keyPrefix: 'POST:/api/reviews:window',
      maxRequests: 3,
      windowMs: 15 * 60 * 1000,
      blockDurationMs: 15 * 60 * 1000
    });

    const body = await parseJsonBody(request);

    // Honeypot (bot) koruması
    if (body.website && String(body.website).trim() !== '') {
      throw new ValidationError('Geçersiz form gönderimi.');
    }

    const name = sanitizeText(body.name, 120, 'Ad Soyad', '/api/reviews');
    const comment = sanitizeText(body.comment, 600, 'Yorum', '/api/reviews');
    const location = sanitizeText(body.location || 'Torbalı, İzmir', 100, 'Konum', '/api/reviews');

    if (!name || name.length < 2 || !comment || comment.length < 5) {
      throw new ValidationError('Geçerli bir ad (en az 2 karakter) ve yorum (en az 5 karakter) zorunludur.');
    }

    // Aynı yorumun kısa süre içinde tekrar kaydedilmesini engelle (çift tıklama / tekrar gönderim)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const duplicate = await prisma.review.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        comment: { equals: comment, mode: 'insensitive' },
        createdAt: { gte: oneHourAgo }
      }
    });
    if (duplicate) {
      throw new ConflictError('Bu değerlendirme zaten gönderildi. Lütfen tekrar göndermeyin.');
    }

    const rating = Math.max(1, Math.min(5, parseInt(String(body.rating), 10) || 5));
    const initials =
      name
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase() || 'M';

    // Müşteriden gelen yeni değerlendirmeler ONAY BEKLİYOR olarak kaydedilir (isApproved: false)
    const review = await prisma.review.create({
      data: {
        name,
        initials,
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
    checkRateLimit(request, {
      keyPrefix: 'PATCH:/api/reviews',
      maxRequests: 30,
      windowMs: 60 * 1000
    });

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
    checkRateLimit(request, {
      keyPrefix: 'DELETE:/api/reviews',
      maxRequests: 20,
      windowMs: 60 * 1000
    });

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
