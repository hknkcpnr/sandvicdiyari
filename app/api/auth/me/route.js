import { db } from '@/lib/db';
import { rawPrisma } from '@/lib/prisma';
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

    // 1. Prisma / Supabase PostgreSQL kontrolü (önce müşteri, bulunamazsa personel/yönetici)
    let dbUser = null;
    let dbAdmin = null;
    let pgConnected = false;

    try {
      if (rawPrisma && rawPrisma.user) {
        dbUser = await rawPrisma.user.findFirst({
          where: {
            OR: [
              ...(cleanEmail ? [{ email: { equals: cleanEmail, mode: 'insensitive' } }] : []),
              ...(cleanId ? [{ id: cleanId }] : [])
            ]
          }
        });
        pgConnected = true;

        if (!dbUser && rawPrisma.adminUser) {
          dbAdmin = await rawPrisma.adminUser.findFirst({
            where: {
              OR: [
                ...(cleanEmail ? [{ email: { equals: cleanEmail, mode: 'insensitive' } }] : []),
                ...(cleanId ? [{ id: cleanId }] : [])
              ]
            },
            include: { role: true }
          });
        }
      }
    } catch (e) {
      console.warn('Prisma auth/me session check warning:', e.message);
    }

    // Yönetici / personel ana sitede oturum açmışsa oturumunu koru
    if (dbAdmin) {
      if (dbAdmin.isActive === false) {
        return jsonSuccess({
          valid: false,
          reason: 'blocked',
          blockReason: 'Personel hesabı pasif durumdadır.',
          message: 'Bu personel hesabı pasif durumdadır.'
        });
      }
      return jsonSuccess({
        valid: true,
        data: {
          user: {
            id: dbAdmin.id,
            name: dbAdmin.name,
            email: dbAdmin.email,
            phone: dbAdmin.phone || '',
            role: dbAdmin.role?.name || dbAdmin.roleName || 'Yetkili',
            roleId: dbAdmin.roleId,
            permissions: dbAdmin.role?.permissions || [],
            type: 'admin',
            isBlocked: false,
            notifications: []
          }
        }
      });
    }

    // 2. Yerel JSON DB yedeği (yalnızca Supabase bağlantısı yoksa devreye girer)
    const localUser = !pgConnected
      ? cleanEmail
        ? db.findUserByEmail(cleanEmail)
        : db.getUserByIdOrEmail(cleanId)
      : null;

    if (!pgConnected && !localUser) {
      const localAdmin = (db.getAdminUsers() || []).find(
        (a) =>
          (cleanEmail && String(a.email || '').toLowerCase() === cleanEmail) ||
          (cleanId && String(a.id) === cleanId)
      );
      if (localAdmin && localAdmin.isActive !== false) {
        return jsonSuccess({
          valid: true,
          data: {
            user: {
              id: localAdmin.id,
              name: localAdmin.name,
              email: localAdmin.email,
              phone: localAdmin.phone || '',
              role: localAdmin.role || localAdmin.roleName || 'Yetkili',
              roleId: localAdmin.roleId,
              permissions: localAdmin.permissions || [],
              type: 'admin',
              isBlocked: false,
              notifications: []
            }
          }
        });
      }
    }

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
    const isBlocked = Boolean(activeRecord.isBlocked);
    if (isBlocked) {
      const blockReason = activeRecord.blockReason || 'Yönetici kısıtlaması';
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
      phone: activeRecord.phone || '',
      address: activeRecord.address || '',
      phoneVerified: Boolean(activeRecord.phoneVerified),
      isBlocked: false,
      notifications: Array.isArray(activeRecord.notifications) ? activeRecord.notifications : []
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
