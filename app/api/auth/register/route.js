import { db } from '@/lib/db';
import { rawPrisma } from '@/lib/prisma';
import {
  ConflictError,
  ValidationError,
  handleApiError,
  jsonSuccess,
  parseJsonBody
} from '@/lib/security/errors';
import { checkRateLimit, hashPassword } from '@/lib/security/auth';
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

    let pgConnected = false;
    let existingPrisma = null;

    try {
      if (rawPrisma && rawPrisma.user) {
        existingPrisma = await rawPrisma.user.findFirst({
          where: {
            email: { equals: email, mode: 'insensitive' }
          }
        });
        pgConnected = true;
      }
    } catch (e) {
      console.warn('Prisma register lookup warning:', e.message);
    }

    if (pgConnected) {
      if (existingPrisma) {
        throw new ConflictError('Bu e-posta adresi ile zaten bir hesap mevcut.');
      }
    } else {
      const existingLocal = db.findUserByEmail(email);
      if (existingLocal) {
        throw new ConflictError('Bu e-posta adresi ile zaten bir hesap mevcut.');
      }
    }

    // Yeni kayıt: Restoran sahibi yönetim panelinden onaylayana kadar phoneVerified = false
    const phoneVerified = false;
    const newId = `u_${Date.now()}`;
    const passHash = hashPassword(pass);

    let newUser = null;
    try {
      if (rawPrisma && rawPrisma.user) {
        const created = await rawPrisma.user.create({
          data: {
            id: newId,
            name,
            email,
            phone: phone || '',
            address: address || '',
            passHash,
            phoneVerified: false,
            phoneVerifiedAt: null,
            isBlocked: false,
            blockReason: '',
            notifications: []
          }
        });
        newUser = {
          id: created.id,
          name: created.name,
          email: created.email,
          phone: created.phone,
          address: created.address,
          phoneVerified: created.phoneVerified,
          isBlocked: created.isBlocked,
          createdAt: created.createdAt
        };
      }
    } catch (e) {
      console.warn('Prisma register create warning:', e.message);
    }

    // Yerel DB yedeğine de senkronize et (tek kayıt)
    let localCreated = null;
    try {
      const existingLocal = db.findUserByEmail(email);
      if (!existingLocal) {
        localCreated = db.createUser({
          name,
          email,
          phone,
          phoneVerified,
          address,
          pass
        });
      }
    } catch (e) {}

    const finalRecord = newUser || localCreated || {
      id: newId,
      name,
      email,
      phone,
      address,
      phoneVerified: false
    };
    const { pass: _, passHash: __, ...userSafe } = finalRecord;

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
