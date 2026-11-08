import { db } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import {
  ConflictError,
  ValidationError,
  handleApiError,
  jsonSuccess,
  parseJsonBody
} from '@/lib/security/errors';
import { checkRateLimit } from '@/lib/security/auth';
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

    let existingPrisma = null;
    try {
      if (prisma && prisma.user) {
        existingPrisma = await prisma.user.findUnique({
          where: { email }
        });
      }
    } catch (e) {}

    const existingLocal = db.findUserByEmail(email);

    if (existingPrisma || existingLocal) {
      throw new ConflictError('Bu e-posta adresi ile zaten bir hesap mevcut.');
    }

    // Yeni kayıt: Restoran sahibi yönetim panelinden onaylayana kadar phoneVerified = false
    const phoneVerified = false;

    let newUser = null;
    try {
      if (prisma && prisma.user) {
        newUser = await prisma.user.create({
          data: {
            name,
            email,
            phone,
            phoneVerified,
            address,
            pass
          }
        });
      }
    } catch (e) {}

    // Yerel DB'ye de kaydet
    const localCreated = db.createUser({
      name,
      email,
      phone,
      phoneVerified,
      address,
      pass
    });

    const finalRecord = newUser || localCreated;
    const { pass: _, ...userSafe } = finalRecord;

    return jsonSuccess(
      {
        message: 'Kayıt talebiniz alındı! Lütfen WhatsApp üzerinden onay isteyiniz.',
        pendingApproval: true,
        data: {
          user: userSafe
        }
      },
      201
    );
  } catch (error) {
    return handleApiError(error, '/api/auth/register', request);
  }
}
