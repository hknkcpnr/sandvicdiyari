import { db } from '@/lib/db';
import { orm } from '@/lib/orm/postgresEngine';
import { rawPrisma } from '@/lib/prisma';
import {
  getCachedAdminUsers,
  setCachedAdminUsers,
  invalidateAdminUsersServerCache
} from '@/lib/productCache';
import { assertProtectedApiAccess, getOptionalAuthFromRequest, hashPassword } from '@/lib/security/auth';
import { logUserActivity } from '@/lib/activityLogger';
import {
  AuthorizationError,
  ConflictError,
  ValidationError,
  handleApiError,
  jsonSuccess,
  parseJsonBody
} from '@/lib/security/errors';
import { sanitizeEmailOrUsername, sanitizePhone, sanitizeText } from '@/lib/security/validation';

/**
 * Personel / Rol / Müşteri değişikliklerinde oturumdaki yetkiliye ait yetkiyi doğrular.
 * Süper Yönetici her zaman geçer; diğer personel için 'users' (personel & roller) veya 'members' (müşteriler) gerekir.
 */
function assertEntityPermission(request, entityType) {
  const payload = getOptionalAuthFromRequest(request);
  if (!payload || payload.type !== 'admin') return;
  const isSuper =
    payload.roleId === 'role_super_admin' ||
    payload.role === 'Süper Yönetici' ||
    String(payload.email || '').toLowerCase() === 'admin';
  if (isSuper) return;
  const perms = Array.isArray(payload.permissions) ? payload.permissions : [];
  const required = entityType === 'customer' ? 'members' : 'users';
  if (!perms.includes(required)) {
    throw new AuthorizationError(
      required === 'members'
        ? 'Bu işlem için "Üye Yönetimi" yetkiniz bulunmuyor.'
        : 'Bu işlem için "Kullanıcı & Rol Yönetimi" yetkiniz bulunmuyor.'
    );
  }
}

/**
 * Supabase / PostgreSQL'den güncel müşteri listesini (sipariş özetiyle birlikte) çeker.
 * Yalnızca bağlantı hatası durumunda yerel JSON DB yedeğine düşer.
 */
async function getSyncedCustomers() {
  try {
    if (rawPrisma && rawPrisma.user) {
      const pgCustomers = await rawPrisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          orders: {
            select: {
              id: true,
              orderNumber: true,
              total: true,
              status: true,
              createdAt: true
            },
            orderBy: { createdAt: 'desc' }
          }
        }
      });

      if (Array.isArray(pgCustomers)) {
        return pgCustomers.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone || '',
          address: u.address || '',
          phoneVerified: Boolean(u.phoneVerified),
          phoneVerifiedAt: u.phoneVerifiedAt || null,
          isBlocked: Boolean(u.isBlocked),
          blockReason: u.blockReason || '',
          blockedAt: u.blockedAt || null,
          notifications: Array.isArray(u.notifications) ? u.notifications : [],
          orders: Array.isArray(u.orders)
            ? u.orders.map((o) => ({
                id: o.id,
                orderNumber: o.orderNumber,
                total:
                  typeof o.total === 'object' && o.total !== null
                    ? Number(o.total)
                    : Number(o.total ?? 0),
                status: o.status,
                createdAt: o.createdAt
              }))
            : [],
          createdAt: u.createdAt
        }));
      }
    }
  } catch (pgErr) {
    console.warn('Prisma / Supabase customer list fallback:', pgErr.message);
  }

  const rawCustomers = db.getUsers() || [];
  return rawCustomers.map((u) => {
    const { pass: _, passHash: __, ...safeUser } = u;
    safeUser.phoneVerified = Boolean(safeUser.phoneVerified);
    safeUser.isBlocked = Boolean(safeUser.isBlocked);
    return safeUser;
  });
}

/**
 * Supabase / PostgreSQL'den güncel rol ve yönetici/personel listesini çeker.
 */
async function getSyncedRolesAndAdmins() {
  const defaultSystemRoles = db.getRoles();
  let roles = null;
  let adminUsers = null;

  try {
    if (rawPrisma && rawPrisma.role) {
      const pgRoles = await rawPrisma.role.findMany({
        orderBy: { isSystem: 'desc' }
      });
      if (pgRoles && pgRoles.length > 0) {
        const allSuperPerms = [
          'overview', 'orders', 'delete_order', 'inventory', 'stock_update',
          'products', 'product_add', 'product_edit', 'product_delete',
          'options_manage', 'manage_prices', 'members', 'users', 'reviews',
          'view_revenue', 'settings', 'site_content', 'courier_delivery'
        ];
        const normalizedPgRoles = pgRoles.map((r) =>
          r.id === 'role_super_admin' || r.code === 'super_admin'
            ? { ...r, permissions: allSuperPerms }
            : r
        );
        // Süper Yönetici rolünün eksik olmadığından emin ol
        const mergedRoles = [...normalizedPgRoles];
        const superExists = mergedRoles.some((r) => r.id === 'role_super_admin' || r.code === 'super_admin');
        if (!superExists) {
          const defaultSuper = defaultSystemRoles.find((r) => r.id === 'role_super_admin');
          if (defaultSuper) mergedRoles.unshift(defaultSuper);
        }
        roles = mergedRoles;
      }
    }

    if (rawPrisma && rawPrisma.adminUser) {
      const pgAdmins = await rawPrisma.adminUser.findMany({
        orderBy: { createdAt: 'asc' },
        include: { role: true }
      });
      if (pgAdmins && pgAdmins.length > 0) {
        adminUsers = pgAdmins.map((a) => ({
          id: a.id,
          name: a.name,
          email: a.email,
          phone: a.phone,
          roleId: a.roleId,
          roleName: a.role?.name || a.roleName || 'Yetkili',
          role: a.role?.name || a.roleName || 'Yetkili',
          roleColor: a.role?.color || 'rose',
          permissions: a.role?.permissions || [],
          isActive: a.isActive,
          createdAt: a.createdAt
        }));
      }
    }
  } catch (pgErr) {
    console.warn('Prisma / Supabase roles & admins fetch fallback:', pgErr.message);
  }

  if (!roles) roles = db.getRoles();
  if (!adminUsers) adminUsers = db.getAdminUsers();

  return { roles, adminUsers };
}

export async function GET(request) {
  try {
    assertProtectedApiAccess(request, { endpoint: '/api/admin/users' });
    const { searchParams } = new URL(request.url);
    const rawScope = searchParams.get('scope') || 'all';
    const scope = rawScope === 'staff' || rawScope === 'customers' ? rawScope : 'all';

    const cached = getCachedAdminUsers(scope);
    if (cached) {
      return jsonSuccess({
        data: cached,
        cached: true
      });
    }

    let responseData;
    if (scope === 'staff') {
      const { roles, adminUsers } = await getSyncedRolesAndAdmins();
      responseData = { adminUsers, roles };
    } else if (scope === 'customers') {
      const customers = await getSyncedCustomers();
      responseData = { customers };
    } else {
      const [{ roles, adminUsers }, customers] = await Promise.all([
        getSyncedRolesAndAdmins(),
        getSyncedCustomers()
      ]);
      responseData = { adminUsers, roles, customers };
    }

    setCachedAdminUsers(scope, responseData);

    return jsonSuccess({
      data: responseData
    });
  } catch (error) {
    return handleApiError(error, '/api/admin/users', request);
  }
}

export async function POST(request) {
  try {
    assertProtectedApiAccess(request, { endpoint: '/api/admin/users' });
    const body = await parseJsonBody(request);
    const entityType = sanitizeText(body.entityType || 'user', 32, 'entityType', '/api/admin/users');
    assertEntityPermission(request, entityType);

    // =========================================================================
    // 1. MÜŞTERİ / ÜYE İŞLEMLERİ (create, approve, unapprove, block, unblock, update, delete, notify)
    // =========================================================================
    if (entityType === 'customer') {
      const action = sanitizeText(body.action || 'block', 32, 'action', '/api/admin/users');
      const customerId = sanitizeText(body.id || body.userId || '', 191, 'id', '/api/admin/users');

      // YENİ MÜŞTERİ EKLEME (Admin Panelinden)
      if (action === 'create' || action === 'add') {
        const name = sanitizeText(body.name, 150, 'Ad Soyad', '/api/admin/users');
        if (!name || name.length < 2) {
          throw new ValidationError('Lütfen geçerli bir Ad Soyad giriniz.');
        }

        const phone = sanitizePhone(body.phone || '', false);
        const rawEmailInput = String(body.email || '').trim();
        let email = '';

        if (rawEmailInput) {
          const cleanId = sanitizeEmailOrUsername(rawEmailInput, true, '/api/admin/users');
          email = cleanId.includes('@') ? cleanId : `${cleanId}@sandwichdiyari.com`;
        } else if (phone) {
          const digits = phone.replace(/\D/g, '');
          email = `musteri_${digits}@sandwichdiyari.com`;
        } else {
          throw new ValidationError('E-posta adresi veya telefon numarası zorunludur.');
        }

        const address = sanitizeText(body.address || '', 400, 'Adres', '/api/admin/users');
        const rawPass = String(body.pass || body.password || '').trim();
        if (!rawPass || rawPass.length < 4) {
          throw new ValidationError('Müşteri giriş şifresi en az 4 karakter olmalıdır.');
        }

        const phoneVerified = typeof body.phoneVerified === 'boolean' ? body.phoneVerified : true;

        // E-posta çakışma kontrolü (Supabase)
        if (rawPrisma && rawPrisma.user) {
          const existing = await rawPrisma.user.findFirst({
            where: {
              email: { equals: email, mode: 'insensitive' }
            }
          });
          if (existing) {
            throw new ConflictError('Bu e-posta adresi ile kayıtlı bir müşteri zaten mevcut.');
          }
        }

        const newId = `u_${Date.now()}`;
        const passHash = hashPassword(rawPass);
        let createdCustomer = null;

        // 1. Supabase PostgreSQL'e kaydet
        if (rawPrisma && rawPrisma.user) {
          createdCustomer = await rawPrisma.user.create({
            data: {
              id: newId,
              name,
              email,
              phone: phone || '',
              address: address || '',
              passHash,
              phoneVerified,
              phoneVerifiedAt: phoneVerified ? new Date() : null,
              isBlocked: false,
              blockReason: '',
              notifications: []
            }
          });
        }

        // 2. Yerel DB yedeğine de yaz
        try {
          const existingLocal = db.findUserByEmail(email);
          if (!existingLocal) {
            db.createUser({
              name,
              email,
              phone: phone || '',
              address: address || '',
              pass: rawPass,
              phoneVerified
            });
          }
        } catch (e) {}

        const customers = await getSyncedCustomers();

        await logUserActivity({
          req: request,
          action: 'MEMBER_CREATE',
          category: 'USER',
          level: 'INFO',
          message: `Yeni müşteri kaydı oluşturuldu: "${name}" (${email})`,
          details: { name, email, phone }
        });

        invalidateAdminUsersServerCache();
        return jsonSuccess(
          {
            message: 'Yeni müşteri başarıyla eklendi.',
            data: {
              customer: createdCustomer,
              customers
            }
          },
          201
        );
      }

      // BİLDİRİM GÖNDERME
      if (action === 'notify') {
        const title = sanitizeText(body.title || 'Bilgilendirme', 150, 'Başlık', '/api/admin/users');
        const message = sanitizeText(body.message || '', 1000, 'Mesaj', '/api/admin/users');
        const channel = sanitizeText(body.channel || 'system', 32, 'Kanal', '/api/admin/users');

        if (!message) {
          throw new ValidationError('Bildirim mesajı boş olamaz.');
        }

        const notifItem = {
          id: `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          title,
          message,
          channel,
          read: false,
          createdAt: new Date().toISOString()
        };

        let notifiedCount = 0;
        if (rawPrisma && rawPrisma.user) {
          try {
            if (!customerId || customerId === 'all') {
              const allUsers = await rawPrisma.user.findMany({
                select: { id: true, notifications: true }
              });
              // Bağlantı havuzunu (connection pool) boğmamak için 10'arlı gruplar halinde güncelle
              const CHUNK_SIZE = 10;
              for (let i = 0; i < allUsers.length; i += CHUNK_SIZE) {
                const chunk = allUsers.slice(i, i + CHUNK_SIZE);
                await Promise.all(
                  chunk.map((u) => {
                    const prev = Array.isArray(u.notifications) ? u.notifications : [];
                    return rawPrisma.user.update({
                      where: { id: u.id },
                      data: { notifications: [notifItem, ...prev].slice(0, 50) }
                    });
                  })
                );
              }
              notifiedCount = allUsers.length;
            } else {
              const target = await rawPrisma.user.findFirst({
                where: {
                  OR: [
                    { id: customerId },
                    { email: { equals: customerId, mode: 'insensitive' } }
                  ]
                },
                select: { id: true, notifications: true }
              });
              if (target) {
                const prev = Array.isArray(target.notifications) ? target.notifications : [];
                await rawPrisma.user.update({
                  where: { id: target.id },
                  data: { notifications: [notifItem, ...prev].slice(0, 50) }
                });
                notifiedCount = 1;
              }
            }
          } catch (pgErr) {
            console.warn('Prisma notify sync warning:', pgErr.message);
          }
        }

        let localResult = null;
        try {
          localResult = db.sendNotificationToUser(customerId || 'all', { title, message, channel });
        } catch (e) {}

        const customers = await getSyncedCustomers();

        await logUserActivity({
          req: request,
          action: 'MEMBER_NOTIFY',
          category: 'USER',
          level: 'INFO',
          message: `Müşterilere bildirim gönderildi: "${title}"`,
          details: { title, target: customerId || 'all' }
        });

        invalidateAdminUsersServerCache();
        return jsonSuccess({
          message:
            !customerId || customerId === 'all'
              ? 'Tüm üyelere bildirim başarıyla iletildi.'
              : 'Üyeye bildirim başarıyla iletildi.',
          data: {
            result: { notifiedCount, ...(localResult || {}) },
            customers
          }
        });
      }

      if (!customerId) {
        throw new ValidationError('Müşteri kimliği (ID veya E-posta) belirtilmedi.');
      }

      // MÜŞTERİ ONAYLAMA / ONAY KALDIRMA
      if (action === 'approve' || action === 'unapprove') {
        const nextVerified = action !== 'unapprove';
        let pgCount = 0;

        if (rawPrisma && rawPrisma.user) {
          const pgRes = await rawPrisma.user.updateMany({
            where: {
              OR: [
                { id: customerId },
                { email: { equals: customerId, mode: 'insensitive' } }
              ]
            },
            data: {
              phoneVerified: nextVerified,
              phoneVerifiedAt: nextVerified ? new Date() : null,
              ...(nextVerified ? { isBlocked: false, blockReason: '', blockedAt: null } : {})
            }
          });
          pgCount = pgRes.count;
        }

        const localUpdated = db.updateUserPhoneVerified(customerId, nextVerified);

        if (pgCount === 0 && !localUpdated) {
          throw new ValidationError('Onaylanacak müşteri kaydı bulunamadı.');
        }

        const customers = await getSyncedCustomers();

        await logUserActivity({
          req: request,
          action: 'MEMBER_VERIFY',
          category: 'USER',
          level: 'INFO',
          message: `Müşteri hesabı (${customerId}) ${nextVerified ? 'onaylandı' : 'onayı kaldırıldı'}.`,
          details: { customerId, verified: nextVerified }
        });

        invalidateAdminUsersServerCache();
        return jsonSuccess({
          message: nextVerified
            ? 'Müşteri hesabı başarıyla onaylandı ve oturum açma izni verildi.'
            : 'Müşteri onayı kaldırıldı.',
          data: {
            customers
          }
        });
      }

      // MÜŞTERİ SİLME (POST üzerinden çağrıldığında)
      if (action === 'delete') {
        let pgCount = 0;
        if (rawPrisma && rawPrisma.user) {
          const pgRes = await rawPrisma.user.deleteMany({
            where: {
              OR: [
                { id: customerId },
                { email: { equals: customerId, mode: 'insensitive' } }
              ]
            }
          });
          pgCount = pgRes.count;
        }

        const localDeleted = db.deleteUser(customerId);
        if (pgCount === 0 && !localDeleted) {
          throw new ValidationError('Silinecek müşteri kaydı bulunamadı.');
        }

        const customers = await getSyncedCustomers();

        await logUserActivity({
          req: request,
          action: 'MEMBER_DELETE',
          category: 'USER',
          level: 'WARN',
          message: `Müşteri kaydı (${customerId}) sistemden silindi.`,
          details: { customerId }
        });

        invalidateAdminUsersServerCache();
        return jsonSuccess({
          message: 'Müşteri kaydı sistemden silindi.',
          data: {
            deletedId: customerId,
            customers
          }
        });
      }

      // MÜŞTERİ ENGELLEME / ENGEL KALDIRMA
      if (action === 'block' || action === 'unblock') {
        const isBlocked = action === 'block';
        const reason = sanitizeText(body.reason || '', 255, 'Sebep', '/api/admin/users');
        let pgCount = 0;

        if (rawPrisma && rawPrisma.user) {
          const pgRes = await rawPrisma.user.updateMany({
            where: {
              OR: [
                { id: customerId },
                { email: { equals: customerId, mode: 'insensitive' } }
              ]
            },
            data: {
              isBlocked,
              blockReason: isBlocked ? reason || 'Kullanım şartları ve sipariş kuralları ihlali' : '',
              blockedAt: isBlocked ? new Date() : null
            }
          });
          pgCount = pgRes.count;
        }

        const localUpdated = db.toggleUserBlock(customerId, isBlocked, reason);

        if (pgCount === 0 && !localUpdated) {
          throw new ValidationError('Müşteri kaydı bulunamadı.');
        }

        const customers = await getSyncedCustomers();

        await logUserActivity({
          req: request,
          action: 'MEMBER_BLOCK',
          category: 'USER',
          level: 'WARN',
          message: `Müşteri hesabı (${customerId}) ${isBlocked ? 'engellendi' : 'engeli kaldırıldı'}.${reason ? ` Sebep: ${reason}` : ''}`,
          details: { customerId, isBlocked, reason }
        });

        invalidateAdminUsersServerCache();
        return jsonSuccess({
          message: isBlocked ? 'Üye başarıyla engellendi.' : 'Üyenin engeli kaldırıldı.',
          data: {
            customers
          }
        });
      }

      // MÜŞTERİ BİLGİLERİNİ DÜZENLEME / GÜNCELLEME
      if (action === 'update') {
        const pgUpdates = {};
        const localUpdates = {};

        if (typeof body.name === 'string' && body.name.trim()) {
          const cleanName = sanitizeText(body.name, 150, 'Ad Soyad', '/api/admin/users');
          pgUpdates.name = cleanName;
          localUpdates.name = cleanName;
        }

        if (typeof body.email === 'string' && body.email.trim()) {
          const cleanId = sanitizeEmailOrUsername(body.email, true, '/api/admin/users');
          const cleanEmail = cleanId.includes('@') ? cleanId : `${cleanId}@sandwichdiyari.com`;
          pgUpdates.email = cleanEmail;
          localUpdates.email = cleanEmail;
        }

        if (typeof body.phone === 'string') {
          const cleanPhone = sanitizePhone(body.phone, false);
          pgUpdates.phone = cleanPhone;
          localUpdates.phone = cleanPhone;
        }

        if (typeof body.address === 'string') {
          const cleanAddress = sanitizeText(body.address, 400, 'Adres', '/api/admin/users');
          pgUpdates.address = cleanAddress;
          localUpdates.address = cleanAddress;
        }

        if (typeof body.phoneVerified === 'boolean') {
          pgUpdates.phoneVerified = body.phoneVerified;
          pgUpdates.phoneVerifiedAt = body.phoneVerified ? new Date() : null;
          localUpdates.phoneVerified = body.phoneVerified;
        }

        const rawPass = body.pass ? String(body.pass).trim() : '';
        if (rawPass) {
          if (rawPass.length < 4) {
            throw new ValidationError('Yeni şifre en az 4 karakter olmalıdır.');
          }
          pgUpdates.passHash = hashPassword(rawPass);
          localUpdates.pass = hashPassword(rawPass);
        }

        let updatedPg = null;
        if (rawPrisma && rawPrisma.user) {
          const target = await rawPrisma.user.findFirst({
            where: {
              OR: [
                { id: customerId },
                { email: { equals: customerId, mode: 'insensitive' } }
              ]
            }
          });

          if (target) {
            if (pgUpdates.email && pgUpdates.email.toLowerCase() !== target.email.toLowerCase()) {
              const dup = await rawPrisma.user.findFirst({
                where: {
                  email: { equals: pgUpdates.email, mode: 'insensitive' },
                  NOT: { id: target.id }
                }
              });
              if (dup) {
                throw new ConflictError('Bu e-posta adresi başka bir müşteri tarafından kullanılıyor.');
              }
            }

            updatedPg = await rawPrisma.user.update({
              where: { id: target.id },
              data: pgUpdates
            });
          }
        }

        const localUpdated = db.updateUser(customerId, localUpdates);

        if (!updatedPg && !localUpdated) {
          throw new ValidationError('Güncellenecek müşteri kaydı bulunamadı.');
        }

        const customers = await getSyncedCustomers();

        await logUserActivity({
          req: request,
          action: 'MEMBER_UPDATE',
          category: 'USER',
          level: 'INFO',
          message: `Müşteri bilgileri (${customerId}) güncellendi.`,
          details: { customerId, updates: pgUpdates }
        });

        invalidateAdminUsersServerCache();
        return jsonSuccess({
          message: 'Müşteri bilgileri başarıyla güncellendi.',
          data: {
            customer: updatedPg || localUpdated,
            customers
          }
        });
      }

      throw new ValidationError(`Geçersiz müşteri işlemi: ${action}`);
    }

    // =========================================================================
    // 2. ROL MODELİ KAYDETME / GÜNCELLEME
    // =========================================================================
    if (entityType === 'role') {
      const roleName = sanitizeText(body.name, 120, 'Rol Adı', '/api/admin/users');
      if (!roleName) {
        throw new ValidationError('Rol adı zorunludur.');
      }
      const rolePayload = {
        ...body,
        name: roleName,
        color: sanitizeText(body.color || 'blue', 32, 'Renk', '/api/admin/users'),
        description: sanitizeText(body.description || '', 400, 'Açıklama', '/api/admin/users'),
        permissions: Array.isArray(body.permissions)
          ? body.permissions.map((p) => sanitizeText(p, 64, 'Yetki', '/api/admin/users'))
          : ['orders']
      };

      const savedRole = db.saveRole(rolePayload);

      try {
        if (rawPrisma && rawPrisma.role) {
          await rawPrisma.role.upsert({
            where: { id: savedRole.id },
            update: {
              name: savedRole.name,
              color: savedRole.color || 'blue',
              description: savedRole.description || '',
              permissions: savedRole.permissions || ['orders']
            },
            create: {
              id: savedRole.id,
              name: savedRole.name,
              code: savedRole.code || `role_${Date.now()}`,
              color: savedRole.color || 'blue',
              description: savedRole.description || '',
              isSystem: Boolean(savedRole.isSystem),
              permissions: savedRole.permissions || ['orders']
            }
          });

          // Rol ismi değiştiyse atanmış admin kullanıcılarında da roleName güncelle
          if (rawPrisma.adminUser) {
            await rawPrisma.adminUser.updateMany({
              where: { roleId: savedRole.id },
              data: { roleName: savedRole.name }
            });
          }
        }
      } catch (err) {
        console.warn('Prisma role upsert warning:', err.message);
      }

      const { roles: currentRoles, adminUsers: currentAdmins } = await getSyncedRolesAndAdmins();

      await logUserActivity({
        req: request,
        action: 'ROLE_SAVE',
        category: 'USER',
        level: 'INFO',
        message: `"${savedRole.name}" rol modeli kaydedildi/güncellendi (${savedRole.permissions?.length || 0} yetki).`,
        details: { roleId: savedRole.id, name: savedRole.name }
      });

      invalidateAdminUsersServerCache();
      return jsonSuccess({
        message: 'Rol modeli başarıyla kaydedildi.',
        data: {
          role: savedRole,
          roles: currentRoles,
          adminUsers: currentAdmins
        }
      });
    }

    // =========================================================================
    // 3. YÖNETİCİ / PERSONEL EKLEME & DÜZENLEME
    // =========================================================================
    const name = sanitizeText(body.name, 150, 'Ad Soyad', '/api/admin/users');
    const identifier = sanitizeEmailOrUsername(body.email, true, '/api/admin/users');
    const email = identifier.includes('@') ? identifier : `${identifier}@sandwichdiyari.com`;
    const phone = sanitizePhone(body.phone || '', false);

    if (!name || !email) {
      throw new ValidationError('Ad Soyad ve E-Posta / Kullanıcı Adı zorunludur.');
    }

    const roleId = sanitizeText(body.roleId || 'role_super_admin', 64, 'roleId', '/api/admin/users');
    const isActive = typeof body.isActive === 'boolean' ? body.isActive : true;
    const rawPass = body.pass ? String(body.pass).trim() : '';

    const userPayload = {
      ...body,
      name,
      email,
      phone,
      roleId,
      isActive,
      ...(rawPass ? { pass: rawPass } : {})
    };

    const savedUser = db.saveAdminUser(userPayload);

    try {
      if (rawPrisma && rawPrisma.adminUser) {
        const { roles: allRoles } = await getSyncedRolesAndAdmins();
        const matchedRole = allRoles.find((r) => String(r.id) === String(roleId)) || allRoles[0];
        const passHash = rawPass ? hashPassword(rawPass) : savedUser.pass || hashPassword('123456');

        if (rawPrisma.role && matchedRole) {
          await rawPrisma.role.upsert({
            where: { id: matchedRole.id },
            update: {
              name: matchedRole.name,
              color: matchedRole.color || 'blue',
              description: matchedRole.description || '',
              permissions: matchedRole.permissions || ['orders']
            },
            create: {
              id: matchedRole.id,
              name: matchedRole.name,
              code: matchedRole.code || `role_${Date.now()}`,
              color: matchedRole.color || 'blue',
              description: matchedRole.description || '',
              isSystem: Boolean(matchedRole.isSystem),
              permissions: matchedRole.permissions || ['orders']
            }
          });
        }

        if (body.id) {
          const existingById = await rawPrisma.adminUser.findUnique({
            where: { id: String(body.id) }
          });
          if (existingById) {
            await rawPrisma.adminUser.update({
              where: { id: existingById.id },
              data: {
                name,
                email,
                phone: phone || '',
                roleId: matchedRole?.id || roleId,
                roleName: matchedRole?.name || 'Yetkili',
                isActive,
                ...(rawPass ? { passHash } : {})
              }
            });
          } else {
            await rawPrisma.adminUser.upsert({
              where: { email },
              update: {
                name,
                phone: phone || '',
                roleId: matchedRole?.id || roleId,
                roleName: matchedRole?.name || 'Yetkili',
                isActive,
                ...(rawPass ? { passHash } : {})
              },
              create: {
                id: String(body.id),
                name,
                email,
                phone: phone || '',
                passHash,
                roleId: matchedRole?.id || roleId,
                roleName: matchedRole?.name || 'Yetkili',
                isActive
              }
            });
          }
        } else {
          await rawPrisma.adminUser.upsert({
            where: { email },
            update: {
              name,
              phone: phone || '',
              roleId: matchedRole?.id || roleId,
              roleName: matchedRole?.name || 'Yetkili',
              isActive,
              ...(rawPass ? { passHash } : {})
            },
            create: {
              id: savedUser.id || `adm_${Date.now()}`,
              name,
              email,
              phone: phone || '',
              passHash,
              roleId: matchedRole?.id || roleId,
              roleName: matchedRole?.name || 'Yetkili',
              isActive
            }
          });
        }
      }
    } catch (pgErr) {
      console.warn('Prisma AdminUser sync notice:', pgErr.message);
    }

    const { roles: currentRoles, adminUsers: currentAdmins } = await getSyncedRolesAndAdmins();

    await logUserActivity({
      req: request,
      action: 'USER_SAVE',
      category: 'USER',
      level: 'INFO',
      message: `"${name}" (${email}) personeli kaydedildi. Rol: ${savedUser.roleName || roleId}`,
      details: { userId: savedUser.id, name, email, roleId }
    });

    invalidateAdminUsersServerCache();
    return jsonSuccess({
      message: 'Kullanıcı başarıyla kaydedildi.',
      data: {
        user: savedUser,
        adminUsers: currentAdmins,
        roles: currentRoles
      }
    });
  } catch (error) {
    return handleApiError(error, '/api/admin/users', request);
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityType = sanitizeText(searchParams.get('type') || 'user', 32, 'type', '/api/admin/users');
    assertEntityPermission(request, entityType);
    const id = sanitizeText(searchParams.get('id') || '', 191, 'id', '/api/admin/users');

    if (!id) {
      throw new ValidationError('Silinecek kayıt ID belirtilmedi.');
    }

    if (entityType === 'role') {
      if (id === 'role_super_admin' || id === 'super_admin') {
        throw new ValidationError('Süper Yönetici rolü sistem güvenliği gereği silinemez.');
      }

      const fallbackRoleId = 'role_cashier';
      const fallbackRoleName = 'Kasiyer & Salon';

      // 1. Prisma'da bu role atanmış yetkilileri güvenli fallback role devret (Foreign Key kısıtını çözer)
      try {
        if (rawPrisma && rawPrisma.adminUser) {
          await rawPrisma.adminUser.updateMany({
            where: { roleId: String(id) },
            data: { roleId: fallbackRoleId, roleName: fallbackRoleName }
          });
        }
      } catch (e) {
        console.warn('Prisma reassign users notice:', e.message);
      }

      // 2. Prisma'dan rolü sil
      try {
        if (rawPrisma && rawPrisma.role) {
          await rawPrisma.role.deleteMany({
            where: {
              id: String(id),
              NOT: { id: 'role_super_admin' }
            }
          });
        }
      } catch (e) {
        console.warn('Prisma delete role notice:', e.message);
      }

      // 3. Yerel veritabanından rolü sil ve personelleri devret
      db.deleteRole(id);

      const [{ roles: currentRoles, adminUsers: currentAdmins }, customers] = await Promise.all([
        getSyncedRolesAndAdmins(),
        getSyncedCustomers()
      ]);

      await logUserActivity({
        req: request,
        action: 'ROLE_DELETE',
        category: 'USER',
        level: 'WARN',
        message: `"${id}" rol modeli sistemden silindi.`,
        details: { roleId: id }
      });

      invalidateAdminUsersServerCache();
      return jsonSuccess({
        message: 'Rol modeli başarıyla silindi.',
        data: {
          roles: currentRoles,
          adminUsers: currentAdmins,
          customers
        }
      });
    }

    if (entityType === 'customer') {
      let pgCount = 0;
      if (rawPrisma && rawPrisma.user) {
        const pgRes = await rawPrisma.user.deleteMany({
          where: {
            OR: [
              { id: String(id) },
              { email: { equals: String(id), mode: 'insensitive' } }
            ]
          }
        });
        pgCount = pgRes.count;
      }

      const localDeleted = orm.executePrepared(
        'User',
        'DELETE',
        'DELETE FROM "users" WHERE "id" = $1 OR "email" = $1 RETURNING "id"',
        [id],
        () => db.deleteUser(id)
      );

      if (pgCount === 0 && !localDeleted) {
        throw new ValidationError('Silinecek müşteri kaydı bulunamadı.');
      }

      const [{ roles: currentRoles, adminUsers: currentAdmins }, customers] = await Promise.all([
        getSyncedRolesAndAdmins(),
        getSyncedCustomers()
      ]);

      await logUserActivity({
        req: request,
        action: 'MEMBER_DELETE',
        category: 'USER',
        level: 'WARN',
        message: `"${id}" müşteri hesabı sistemden silindi.`,
        details: { customerId: id }
      });

      invalidateAdminUsersServerCache();
      return jsonSuccess({
        message: 'Müşteri kaydı silindi.',
        data: {
          deletedId: id,
          customers,
          adminUsers: currentAdmins,
          roles: currentRoles
        }
      });
    }

    try {
      if (rawPrisma && rawPrisma.adminUser) {
        await rawPrisma.adminUser.deleteMany({
          where: {
            OR: [
              { id: String(id) },
              { email: { equals: String(id), mode: 'insensitive' } }
            ]
          }
        });
      }
    } catch (e) {}

    orm.executePrepared(
      'AdminUser',
      'DELETE',
      'DELETE FROM "admin_users" WHERE "id" = $1 RETURNING "id"',
      [id],
      () => db.deleteAdminUser(id)
    );

    const [{ roles: currentRoles, adminUsers: currentAdmins }, customers] = await Promise.all([
      getSyncedRolesAndAdmins(),
      getSyncedCustomers()
    ]);

    await logUserActivity({
      req: request,
      action: 'USER_DELETE',
      category: 'USER',
      level: 'WARN',
      message: `"${id}" personeli/yetkilisi sistemden silindi.`,
      details: { userId: id }
    });

    invalidateAdminUsersServerCache();
    return jsonSuccess({
      message: 'Kullanıcı silindi.',
      data: {
        adminUsers: currentAdmins,
        roles: currentRoles,
        customers
      }
    });
  } catch (error) {
    return handleApiError(error, '/api/admin/users', request);
  }
}
