import { db } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import { jsonSuccess, handleApiError } from '@/lib/security/errors';
import { verifyJwtToken } from '@/lib/security/auth';

async function handleCheckSession(request) {
  try {
    const { searchParams } = new URL(request.url);
    let email = searchParams.get('email') || request.headers.get('x-user-email') || '';
    let id = searchParams.get('id') || '';

    // Authorization Bearer token desteği
    const authHeader = request.headers.get('authorization') || '';
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      const payload = verifyJwtToken(token);
      if (payload?.email && !email) email = payload.email;
      if (payload?.sub && !id) id = payload.sub;
    }

    // POST isteği ise body'den de alabilir
    if (request.method === 'POST') {
      try {
        const body = await request.clone().json();
        if (body?.email && !email) email = body.email;
        if (body?.id && !id) id = body.id;
      } catch (e) {}
    }

    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanId = String(id || '').trim();

    if (!cleanEmail && !cleanId) {
      return jsonSuccess({
        valid: false,
        reason: 'no_identity',
        message: 'Oturum kimlik bilgisi belirtilmedi.'
      });
    }

    // 1. Prisma / PostgreSQL kontrolü
    let dbUser = null;
    try {
      if (prisma && prisma.user) {
        dbUser = await prisma.user.findFirst({
          where: {
            OR: [
              ...(cleanEmail ? [{ email: cleanEmail }] : []),
              ...(cleanId ? [{ id: cleanId }] : [])
            ]
          }
        });
      }
    } catch (e) {}

    // 2. Yerel JSON DB kontrolü
    const localUser = cleanEmail ? db.findUserByEmail(cleanEmail) : db.getUserByIdOrEmail(cleanId);
    const activeRecord = dbUser || localUser;

    // Üye veritabanında bulunamadı (Admin panelinden silinmiş!)
    if (!activeRecord) {
      return jsonSuccess({
        valid: false,
        reason: 'deleted',
        message: 'Bu kullanıcı hesabı sistemden silinmiştir. Oturum kapatılıyor.'
      });
    }

    // Üye engellenmiş mi kontrolü
    const isBlocked = Boolean(activeRecord.isBlocked || localUser?.isBlocked);
    if (isBlocked) {
      const blockReason = activeRecord.blockReason || localUser?.blockReason || 'Yönetici kısıtlaması';
      return jsonSuccess({
        valid: false,
        reason: 'blocked',
        blockReason,
        message: `Hesabınız yönetici tarafından engellenmiştir. Sebep: ${blockReason}`
      });
    }

    // Kullanıcı mevcut ve aktif
    const safeUser = {
      id: activeRecord.id,
      name: activeRecord.name,
      email: activeRecord.email,
      phone: activeRecord.phone,
      address: activeRecord.address || '',
      isBlocked: false,
      notifications: localUser?.notifications || []
    };

    return jsonSuccess({
      valid: true,
      data: {
        user: safeUser
      }
    });
  } catch (error) {
    return handleApiError(error, '/api/auth/me', request);
  }
}

export async function GET(request) {
  return handleCheckSession(request);
}

export async function POST(request) {
  return handleCheckSession(request);
}
