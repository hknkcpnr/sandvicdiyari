import { prisma } from '@/lib/prisma';
import {
  ConflictError,
  ValidationError,
  handleApiError,
  jsonSuccess,
  parseJsonBody
} from '@/lib/security/errors';
import { checkRateLimit, signJwtToken } from '@/lib/security/auth';
import {
  sanitizeEmailOrUsername,
  sanitizePhone,
  sanitizeText
} from '@/lib/security/validation';

export async function POST(request) {
  try {
    checkRateLimit(request, {
      keyPrefix: 'POST:/api/auth/register',
      maxRequests: 10,
      windowMs: 60 * 1000
    });

    const body = await parseJsonBody(request);
    const name = sanitizeText(body.name, 120, 'Ad Soyad', '/api/auth/register');
    const email = sanitizeEmailOrUsername(body.email, false, '/api/auth/register');
    const phone = sanitizePhone(body.phone || '', false);
    const address = sanitizeText(body.address || '', 400, 'Adres', '/api/auth/register');
    const pass = String(body.pass || '');

    if (!name || name.length < 2) {
      throw new ValidationError('Lütfen geçerli bir Ad Soyad giriniz.');
    }
    if (!pass || pass.length < 4) {
      throw new ValidationError('Şifre en az 4 karakter olmalıdır.');
    }

    const existing = await prisma.user.findUnique({
      where: { email }
    });

    if (existing) {
      throw new ConflictError('Bu e-posta adresi ile zaten bir hesap mevcut.');
    }

    const phoneVerified = Boolean(body.phoneVerified);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        phoneVerified,
        address,
        pass
      }
    });

    const { pass: _, ...userSafe } = newUser;
    const token = signJwtToken({
      sub: String(newUser.id),
      email: newUser.email,
      name: newUser.name,
      type: 'customer'
    });

    return jsonSuccess(
      {
        message: 'Hesabınız başarıyla oluşturuldu!',
        data: {
          user: userSafe,
          token
        }
      },
      201
    );
  } catch (error) {
    return handleApiError(error, '/api/auth/register', request);
  }
}
